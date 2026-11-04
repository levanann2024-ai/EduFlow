const schoolService = require('./school.service');
const { getStudentProgress } = require('./studentProgress.service');

const MAX_LEARNING_MATERIALS = 40;
const MAX_ASSIGNMENT_TEXT = 1800;
const MAX_MATERIAL_TEXT = 2800;

function contextError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function text(value, maximum = 500) {
  return typeof value === 'string' ? value.slice(0, maximum) : '';
}

function currentVietnamWeekStart(now) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(
    Number(dateValues.year),
    Number(dateValues.month) - 1,
    Number(dateValues.day),
  ));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function normalizeWeeklyPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const completedPriorities = Array.isArray(value.completedPriorities)
    ? value.completedPriorities.filter((index) => Number.isInteger(index) && index >= 0 && index < 3)
    : [];
  return {
    freeTime: text(value.freeTime, 1800),
    busyTime: text(value.busyTime, 1800),
    legacyAvailability: text(value.legacyAvailability, 1800),
    suggestion: text(value.suggestion, 5000),
    completedPriorities,
  };
}

function mapAssignment(assignment) {
  return {
    title: text(assignment.title, 200),
    subject: text(assignment.subject, 100),
    className: text(assignment.className, 100),
    chapter: text(assignment.chapter, 120),
    lesson: text(assignment.lesson, 160),
    dueAt: assignment.dueAt ?? null,
    status: assignment.score !== null && assignment.score !== undefined
      ? 'Đã chấm'
      : assignment.submittedAt ? 'Đã nộp, chờ chấm' : 'Chưa nộp',
    submittedAt: assignment.submittedAt ?? null,
    score: assignment.score ?? null,
    teacherFeedback: text(assignment.teacherFeedback, 700),
    description: text(assignment.description, MAX_ASSIGNMENT_TEXT),
    responseText: text(assignment.responseText, MAX_ASSIGNMENT_TEXT),
    questionScores: assignment.questionScores ?? {},
    questionFeedback: assignment.questionFeedback ?? {},
  };
}

function mapExamResult(result) {
  const grade = result.grade ?? {};
  const questions = Array.isArray(result.questions) ? result.questions : [];
  return {
    title: text(result.title, 200),
    subject: text(result.subject, 100),
    className: text(result.className, 100),
    submittedAt: result.submittedAt ?? null,
    score: grade.totalScore ?? null,
    maxScore: questions.reduce((total, question) => total + (Number(question.points) || 0), 0),
    teacherFeedback: text(grade.teacherFeedback, 700),
    gradedAt: grade.gradedAt ?? null,
    questions: questions.map((question, index) => ({
      number: index + 1,
      prompt: text(question.question, 600),
      answer: text(result.answers?.[String(index + 1)], 600),
      correctAnswer: text(question.correctAnswer, 600),
      earnedScore: Object.prototype.hasOwnProperty.call(grade.questionScores ?? {}, question.id)
        ? grade.questionScores[question.id]
        : null,
      maxScore: question.points ?? question.maxScore ?? null,
      explanation: text(question.explanation, 500),
      teacherFeedback: text(grade.questionFeedback?.[question.id], 300),
    })),
  };
}

function mapTimetable(schedule) {
  return {
    semester: schedule.timetable?.semester ?? null,
    classroom: schedule.classroom
      ? { name: schedule.classroom.name, code: schedule.classroom.code, academicYear: schedule.classroom.academicYear }
      : null,
    weekNumber: schedule.weekNumber,
    entries: (schedule.timetable?.entries ?? []).map((entry) => ({
      weekday: entry.weekday,
      period: entry.period,
      subject: text(entry.subject, 100),
      type: entry.type,
      title: text(entry.title, 200),
      topic: text(entry.topic, 300),
      hasHomework: Boolean(entry.hasHomework),
      homeworkTitle: text(entry.homeworkTitle, 200),
      homeworkDueAt: entry.homeworkDueAt ?? null,
      hasExam: Boolean(entry.hasExam),
      examTitle: text(entry.examTitle, 200),
      examStartsAt: entry.examStartsAt ?? null,
      hasExamReturn: Boolean(entry.hasExamReturn),
      examReturnNote: text(entry.examReturnNote, 300),
      examReturnAt: entry.examReturnAt ?? null,
    })),
  };
}

function createStudentChatContextService({
  getProgress = getStudentProgress,
  getTimetable = schoolService.getStudentTimetable,
  listLearningResources = schoolService.listStudentLearningResources,
  listExamRooms = schoolService.listStudentExamRooms,
  now = () => new Date(),
} = {}) {
  return async function getStudentChatContext(auth, weeklyPlanInput) {
    if (auth?.role !== 'student') {
      throw contextError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được dùng ngữ cảnh học tập cá nhân.');
    }

    const weekStart = currentVietnamWeekStart(now());
    const semesters = ['Kỳ 1', 'Kỳ 2'];
    const [progress, resources, examRooms, timetableResponses] = await Promise.all([
      getProgress(auth),
      listLearningResources(auth),
      listExamRooms(auth),
      Promise.all(semesters.map((semester) => getTimetable(auth, semester, weekStart))),
    ]);

    const learningMaterials = resources.slice(0, MAX_LEARNING_MATERIALS).map((resource) => ({
      subject: text(resource.subject, 100),
      className: text(resource.className, 100),
      academicYear: text(resource.academicYear, 32),
      semester: text(resource.semester, 20),
      chapter: text(resource.chapter, 120),
      lesson: text(resource.lesson, 160),
      title: text(resource.title, 200),
      content: text(resource.content, MAX_MATERIAL_TEXT),
      note: text(resource.note, 500),
    }));

    return {
      currentWeek: weekStart,
      classes: progress.classes.map((classroom) => ({
        name: classroom.name,
        code: classroom.code,
        grade: classroom.grade,
        academicYear: classroom.academicYear,
        subjects: classroom.subjects,
      })),
      timetables: timetableResponses.map(mapTimetable),
      assignments: progress.assignments.map(mapAssignment),
      officialSubjectAverages: progress.officialAverages.map((item) => ({
        className: item.className,
        subject: item.subject,
        academicYear: item.academicYear,
        semester: item.semester,
        average: item.average,
        previousAverage: item.previousAverage,
      })),
      examResults: progress.examResults.map(mapExamResult),
      examRooms: examRooms.map((exam) => ({
        title: text(exam.title, 200),
        subject: text(exam.subject, 100),
        status: exam.status,
        startsAt: exam.startsAt,
        endsAt: exam.endsAt ?? null,
        hasSubmitted: Boolean(exam.hasSubmitted),
      })),
      academicCalendar: progress.academicCalendar,
      learningMaterials,
      omittedLearningMaterialCount: Math.max(0, resources.length - learningMaterials.length),
      weeklyPlan: normalizeWeeklyPlan(weeklyPlanInput),
    };
  };
}

module.exports = {
  createStudentChatContextService,
  currentVietnamWeekStart,
};
