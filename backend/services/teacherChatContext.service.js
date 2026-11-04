const schoolService = require('./school.service');
const timetableService = require('./timetable.service');

const SEMESTERS = ['Kỳ 1', 'Kỳ 2'];
const MAX_DESCRIPTION_LENGTH = 1800;
const MAX_RESOURCE_LENGTH = 3000;
const MAX_QUESTIONS_PER_ASSESSMENT = 50;

function contextError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function text(value, maximum = 500) {
  return typeof value === 'string' ? value.slice(0, maximum) : '';
}

function dateKeyInVietnam(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentVietnamWeekStart(now) {
  const [year, month, day] = dateKeyInVietnam(now).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function mapTimetable(schedule) {
  return {
    academicYear: schedule.timetable?.academicYear ?? '',
    semester: schedule.timetable?.semester ?? '',
    weekStart: schedule.timetable?.weekStart ?? '',
    status: schedule.timetable?.status ?? '',
    teacherNote: text(schedule.timetable?.dailyNote, 3000),
    entries: schedule.entries.map((entry) => ({
      weekday: entry.weekday,
      period: entry.period,
      className: text(entry.className, 100),
      classCode: text(entry.classCode, 40),
      subject: text(entry.subject, 100),
      type: entry.type,
      title: text(entry.title, 180),
      topic: text(entry.topic, 300),
      dueAt: entry.dueAt ?? null,
      homeworkTitle: text(entry.homeworkTitle, 180),
      homeworkDueAt: entry.homeworkDueAt ?? null,
      examTitle: text(entry.examTitle, 180),
      examStartsAt: entry.examStartsAt ?? null,
      examReturnNote: text(entry.examReturnNote, 250),
      examReturnAt: entry.examReturnAt ?? null,
    })),
    upcomingWork: schedule.upcomingWork.map((work) => ({
      title: text(work.title, 180),
      subject: text(work.subject, 100),
      classCode: text(work.classCode, 40),
      dueAt: work.dueAt,
      submittedCount: work.submittedCount,
      ungradedCount: work.ungradedCount,
    })),
  };
}

function summarizeGradebook(classroom, subject, semester, rows) {
  const averages = rows
    .map((row) => row.confirmedAverage)
    .filter((average) => typeof average === 'number' && Number.isFinite(average));
  const enrolledCount = rows.length;
  const aggregate = {
    className: classroom.name,
    subject,
    academicYear: classroom.academic_year,
    semester,
    enrolledCount,
  };

  if (enrolledCount < 5) return aggregate;
  return {
    ...aggregate,
    studentsWithPublishedAverage: averages.length,
    classAverage: averages.length >= 5
      ? Number((averages.reduce((total, average) => total + average, 0) / averages.length).toFixed(2))
      : null,
    overdueMissingAssignmentCount: rows.reduce((total, row) => total + (row.assignments?.overdueMissing ?? 0), 0),
  };
}

function mapAssessment(assessment) {
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  return {
    title: text(assessment.title, 180),
    subject: text(assessment.subject, 100),
    grade: text(assessment.grade, 32),
    academicYear: text(assessment.academicYear, 32),
    semester: text(assessment.semester, 20),
    chapter: text(assessment.chapter, 120),
    lesson: text(assessment.lesson, 160),
    questionCount: questions.length,
    questions: questions.slice(0, MAX_QUESTIONS_PER_ASSESSMENT).map((question) => ({
      type: text(question.type, 40),
      question: text(question.question, 500),
      correctAnswer: text(question.correctAnswer, 400),
      explanation: text(question.explanation, 400),
    })),
    omittedQuestionCount: Math.max(0, questions.length - MAX_QUESTIONS_PER_ASSESSMENT),
  };
}

function mapClassAssignment(assignment, classroom) {
  const students = Array.isArray(assignment.students) ? assignment.students : [];
  const gradedCount = students.filter((student) => student.gradedAt).length;
  return {
    title: text(assignment.title, 180),
    subject: text(assignment.subject, 100),
    className: classroom.name,
    academicYear: assignment.academicYear,
    semester: assignment.semester,
    chapter: text(assignment.chapter, 120),
    lesson: text(assignment.lesson, 160),
    dueAt: assignment.dueAt,
    description: text(assignment.description, MAX_DESCRIPTION_LENGTH),
    studentCount: assignment.studentCount,
    submittedCount: assignment.submittedCount,
    ungradedCount: Math.max(0, assignment.submittedCount - gradedCount),
  };
}

function mapExamRoom(room) {
  const sessions = Array.isArray(room.sessions) ? room.sessions : [];
  return {
    title: text(room.title, 180),
    subject: text(room.examSnapshot?.subject ?? room.subject, 100),
    classNames: Array.isArray(room.classNames) ? room.classNames.map((name) => text(name, 100)) : [],
    status: text(room.status, 32),
    startsAt: room.startsAt ?? null,
    durationMinutes: room.durationMinutes ?? null,
    studentCount: room.studentCount >= 5 ? room.studentCount : null,
    submittedCount: sessions.length >= 5
      ? sessions.filter((session) => session.status === 'submitted').length
      : null,
    inProgressCount: sessions.length >= 5
      ? sessions.filter((session) => ['in-progress', 'review'].includes(session.status)).length
      : null,
  };
}

function mapResource(resource, classroom) {
  return {
    className: classroom.name,
    subject: text(resource.subject, 100),
    academicYear: text(resource.academic_year, 32),
    semester: text(resource.semester, 20),
    chapter: text(resource.chapter, 120),
    lesson: text(resource.lesson, 160),
    title: text(resource.title, 180),
    content: text(resource.content, MAX_RESOURCE_LENGTH),
    note: text(resource.note, 500),
  };
}

function createTeacherChatContextService({
  listClasses = schoolService.listClasses,
  listTeacherClassSubjects = schoolService.listTeacherClassSubjects,
  getTimetable = timetableService.getTeacherTimetable,
  listClassAssignments = schoolService.listClassAssignments,
  getGradebook = schoolService.getClassGradebook,
  listClassLearningResources = schoolService.listClassLearningResources,
  listTeacherAssessments = schoolService.listTeacherAssessments,
  listTeacherExamRooms = schoolService.listTeacherExamRooms,
  now = () => new Date(),
} = {}) {
  return async function getTeacherChatContext(auth) {
    if (auth?.role !== 'lecturer') {
      throw contextError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được dùng ngữ cảnh công việc cá nhân.');
    }

    const [classRows, savedExams, savedAssignments, examRooms] = await Promise.all([
      listClasses(auth),
      listTeacherAssessments(auth, 'exam'),
      listTeacherAssessments(auth, 'assignment'),
      listTeacherExamRooms(auth),
    ]);
    const classes = await Promise.all(classRows.map(async (classroom) => ({
      ...classroom,
      subjects: await listTeacherClassSubjects(auth, classroom.id),
    })));
    const weekStart = currentVietnamWeekStart(now());
    const scheduleFilters = classes.length
      ? [...new Set(classes.map((classroom) => classroom.academic_year))].flatMap((academicYear) => (
        SEMESTERS.map((semester) => ({ academicYear, semester, weekStart }))
      ))
      : [];
    const classSubjectPeriods = classes.flatMap((classroom) => (
      classroom.subjects.flatMap((subject) => SEMESTERS.map((semester) => ({ classroom, subject, semester })))
    ));

    const [timetables, classAssignments, gradebooks, resources] = await Promise.all([
      Promise.all(scheduleFilters.map((filters) => getTimetable(auth, filters))),
      Promise.all(classSubjectPeriods.map(async ({ classroom, subject, semester }) => ({
        classroom,
        assignments: await listClassAssignments(auth, classroom.id, {
          academicYear: classroom.academic_year,
          semester,
          subject,
        }),
      }))),
      Promise.all(classSubjectPeriods.map(async ({ classroom, subject, semester }) => ({
        classroom,
        subject,
        semester,
        rows: await getGradebook(auth, classroom.id, {
          academicYear: classroom.academic_year,
          semester,
          subject,
        }),
      }))),
      Promise.all(classes.map(async (classroom) => ({
        classroom,
        resources: await listClassLearningResources(auth, classroom.id),
      }))),
    ]);

    const assignments = classAssignments.flatMap(({ classroom, assignments: items }) => (
      items.map((item) => mapClassAssignment(item, classroom))
    ));
    const classPerformance = gradebooks.map(({ classroom, subject, semester, rows }) => (
      summarizeGradebook(classroom, subject, semester, rows)
    ));
    const learningResources = resources.flatMap(({ classroom, resources: items }) => (
      items.map((item) => mapResource(item, classroom))
    ));
    return {
      currentWeek: weekStart,
      classes: classes.map((classroom) => ({
        name: classroom.name,
        code: classroom.code,
        grade: classroom.grade,
        academicYear: classroom.academic_year,
        isHomeroom: classroom.is_homeroom,
        homeroomSubject: classroom.homeroom_subject,
        subjects: classroom.subjects,
      })),
      timetables: timetables.map(mapTimetable),
      assignments,
      classPerformance,
      savedAssessments: [
        ...savedExams.map((item) => ({ kind: 'exam', ...mapAssessment(item) })),
        ...savedAssignments.map((item) => ({ kind: 'assignment', ...mapAssessment(item) })),
      ],
      examRooms: examRooms.map(mapExamRoom),
      learningResources,
    };
  };
}

module.exports = {
  createTeacherChatContextService,
  currentVietnamWeekStart,
};
