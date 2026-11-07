import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  Lightbulb,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  analyzeTeacherClassProgress,
  getClassGradebook,
  getHomeroomClassGradeSummary,
  getTeacherExamRoomGrading,
  listClassAssignments,
  listClasses,
  listClassSubjects,
  listTeacherExamRooms,
  type ClassAssignment,
  type GradebookStudent,
  type HomeroomGradeSummary,
  type SchoolClass,
  type TeacherExamGradingRoom,
  type TeacherExamGradingStudent,
  type TeacherProgressAnalysisResult,
} from '@/api/schoolApi';
import { useChartViewport } from '@/hooks/useChartViewport';
import { sortByVietnameseName } from './studentSorting';

interface ScorePoint {
  label: string;
  value: number;
  detail?: string;
  kind?: 'assignment' | 'exam';
  recordedAt?: string;
}

interface TeacherExamChartResult {
  room: TeacherExamGradingRoom;
  students: TeacherExamGradingStudent[];
}

function semesterForExamStart(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return month === 1
    ? day < 18 ? 'Kỳ 1' : 'Kỳ 2'
    : month >= 9 ? 'Kỳ 1' : 'Kỳ 2';
}

function StudentScoreChart({ points }: { points: ScorePoint[] }) {
  const width = 760;
  const height = 320;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 54;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const slotWidth = chartWidth / Math.max(points.length, 1);
  const plottedPoints = points.map((point, index) => ({
    ...point,
    x: left + slotWidth * (index + 0.5),
    y: top + chartHeight - (Math.max(0, Math.min(10, point.value)) / 10) * chartHeight,
  }));
  const chartViewport = useChartViewport(width, left, width - right);
  const linePoints = plottedPoints.map(({ x, y }) => `${chartViewport.mapX(x)},${y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Biểu đồ điểm của học sinh"
        viewBox={`0 0 ${width} ${height}`}
        className={`h-auto min-w-[560px] w-full touch-pan-y ${chartViewport.cursorClass}`}
        onWheel={chartViewport.onWheel}
        onPointerDown={chartViewport.onPointerDown}
        onPointerMove={chartViewport.onPointerMove}
        onPointerUp={chartViewport.onPointerUp}
        onPointerCancel={chartViewport.onPointerCancel}
      >
        <defs>
          <clipPath id={chartViewport.clipId}>
            <rect x={left} y={top} width={chartWidth} height={chartHeight + 34} />
          </clipPath>
        </defs>
        {[0, 5, 10].map((score) => {
          const y = top + ((10 - score) / 10) * chartHeight;
          return (
            <g key={score}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={score === 0 ? undefined : '4 4'} />
              <text x={left - 10} y={y + 5} textAnchor="end" fill="#475569" fontSize="14">{score}</text>
            </g>
          );
        })}
        <g clipPath={`url(#${chartViewport.clipId})`}>
        {plottedPoints.length > 1 && (
          <polyline points={linePoints} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {plottedPoints.map((point, index) => {
          const label = point.label.length > 14 ? `${point.label.slice(0, 12)}…` : point.label;
          const valueLabelY = point.y - 14 >= top + 8 ? point.y - 14 : point.y + 25;
          const recordedAt = point.recordedAt ? new Date(point.recordedAt) : null;
          const dateLabel = recordedAt && !Number.isNaN(recordedAt.getTime())
            ? recordedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
            : label;
          return (
            <g key={`${point.label}-${index}`}>
              <title>{`${point.detail ?? point.label}: ${point.value.toFixed(1)}`}</title>
              {point.kind === 'exam' ? (
                <>
                  <circle cx={chartViewport.mapX(point.x)} cy={point.y} r="9" fill="#fff7ed" stroke="#f59e0b" strokeWidth="1.5" />
                  <path
                    d="M0,-6.5 1.8,-2 6.2,-2 2.7,0.8 4,5.2 0,2.7 -4,5.2 -2.7,0.8 -6.2,-2 -1.8,-2 Z"
                    transform={`translate(${chartViewport.mapX(point.x)} ${point.y})`}
                    fill="#f59e0b"
                    stroke="#b45309"
                    strokeWidth="0.7"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <circle cx={chartViewport.mapX(point.x)} cy={point.y} r="5" fill="#4f46e5" stroke="white" strokeWidth="2" />
              )}
              <text x={chartViewport.mapX(point.x)} y={valueLabelY} textAnchor="middle" fill="#312e81" fontSize="15" fontWeight="700">
                {point.value.toFixed(1)}
              </text>
              <text x={chartViewport.mapX(point.x)} y={height - 18} textAnchor="middle" fill="#334155" fontSize="14">{dateLabel}</text>
            </g>
          );
        })}
        </g>
      </svg>
      <div className="flex justify-center gap-5 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />Bài tập</span>
        <span className="inline-flex items-center gap-1.5 text-amber-700"><span aria-hidden="true">★</span>Bài thi</span>
      </div>
    </div>
  );
}

export function ClassAnalytics() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('Kỳ 1');
  const [scoreMode, setScoreMode] = useState<'subject' | 'assignment'>('subject');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [students, setStudents] = useState<GradebookStudent[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [examChartResults, setExamChartResults] = useState<TeacherExamChartResult[]>([]);
  const [homeroomSummary, setHomeroomSummary] = useState<HomeroomGradeSummary | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingExamResults, setLoadingExamResults] = useState(false);
  const [loadingHomeroomSummary, setLoadingHomeroomSummary] = useState(false);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [examResultsError, setExamResultsError] = useState('');
  const [homeroomError, setHomeroomError] = useState('');
  const [analysis, setAnalysis] = useState<TeacherProgressAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const analysisRequestId = useRef(0);

  const selectedClass = classes.find((classroom) => classroom.id === classId) ?? null;
  const sortedStudents = useMemo(() => sortByVietnameseName(students, (student) => student.fullName), [students]);
  const selectedStudent = sortedStudents.find((student) => student.id === selectedStudentId)
    ?? sortedStudents[0]
    ?? null;
  const recentAssignments = useMemo(() => [...assignments]
    .sort((first, second) => Date.parse(first.dueAt) - Date.parse(second.dueAt))
    .slice(-8), [assignments]);
  const report = useMemo(() => {
    const allScores = students.flatMap((student) => [
      ...student.grades.regular,
      student.grades.midterm,
      student.grades.final,
    ].filter((score): score is number => score !== null));
    const assignmentTotal = students.reduce((total, student) => total + student.assignments.total, 0);
    const assignmentSubmitted = students.reduce((total, student) => total + student.assignments.submitted, 0);
    return {
      average: allScores.length
        ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(2)
        : null,
      assignmentTotal,
      assignmentSubmitted,
      assignmentRate: assignmentTotal ? Math.round((assignmentSubmitted / assignmentTotal) * 100) : null,
    };
  }, [students]);
  const classSubjectAverages = useMemo(() => {
    if (!homeroomSummary) return [];
    return homeroomSummary.subjects.map((item) => {
      const scores = homeroomSummary.students
        .map((student) => student.averages[item])
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
      return {
        subject: item,
        classAverage: scores.length
          ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2))
          : null,
        studentsWithGrades: scores.length,
      };
    });
  }, [homeroomSummary]);
  const chartPoints = useMemo<ScorePoint[]>(() => {
    if (!selectedStudent) return [];
    if (scoreMode === 'assignment') {
      const assignmentPoints = recentAssignments
        .flatMap((assignment): ScorePoint[] => {
          const studentResult = assignment.students.find((student) => student.id === selectedStudent.id);
          return typeof studentResult?.score === 'number' && Number.isFinite(studentResult.score)
            ? [{
              label: assignment.title,
              value: studentResult.score,
              detail: assignment.title,
              kind: 'assignment',
              recordedAt: studentResult.gradedAt ?? assignment.dueAt,
            }]
            : [];
        });
      const examPoints = examChartResults.flatMap(({ room, students: examStudents }): ScorePoint[] => {
        const studentResult = examStudents.find((student) => student.studentId === selectedStudent.id);
        const grade = studentResult?.grade;
        const maximum = room.examSnapshot.questions.reduce((total, question) => total + question.points, 0);
        if (!grade || !grade.publishedAt || !Number.isFinite(maximum) || maximum <= 0
          || !Number.isFinite(grade.totalScore) || grade.totalScore < 0 || grade.totalScore > maximum) {
          return [];
        }
        return [{
          label: room.title,
          value: (grade.totalScore / maximum) * 10,
          detail: room.title,
          kind: 'exam',
          recordedAt: grade.gradedAt,
        }];
      });
      return [...assignmentPoints, ...examPoints]
        .sort((first, second) => Date.parse(first.recordedAt ?? '') - Date.parse(second.recordedAt ?? ''))
        .slice(-8);
    }

    return selectedStudent.averageHistory.slice(-12).map((snapshot) => {
      const recordedAt = new Date(snapshot.recordedAt);
      return {
        label: recordedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        value: snapshot.average,
        detail: recordedAt.toLocaleString('vi-VN'),
        recordedAt: snapshot.recordedAt,
      };
    });
  }, [examChartResults, recentAssignments, scoreMode, selectedStudent]);

  useEffect(() => {
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setClassId(items[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSubjects([]);
    setSubject('');
    setStudents([]);
    if (!classId) return () => { active = false; };
    listClassSubjects(classId)
      .then((items) => {
        if (!active) return;
        setSubjects(items);
        const homeroomSubject = selectedClass?.homeroom_subject;
        setSubject(homeroomSubject && items.includes(homeroomSubject) ? homeroomSubject : items[0] ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải môn học được phân công.');
      });
    return () => { active = false; };
  }, [classId, selectedClass?.homeroom_subject]);

  useEffect(() => {
    let active = true;
    if (!selectedClass || !subject) {
      setStudents([]);
      setLoadingReport(false);
      return () => { active = false; };
    }
    setLoadingReport(true);
    setError('');
    getClassGradebook(selectedClass.id, selectedClass.academic_year, semester, subject)
      .then((items) => {
        if (active) setStudents(items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu tiến độ.');
      })
      .finally(() => {
        if (active) setLoadingReport(false);
      });
    return () => { active = false; };
  }, [selectedClass, semester, subject]);

  useEffect(() => {
    let active = true;
    setExamChartResults([]);
    setExamResultsError('');
    if (!selectedClass || !subject || scoreMode !== 'assignment') {
      setLoadingExamResults(false);
      return () => { active = false; };
    }

    setLoadingExamResults(true);
    listTeacherExamRooms<TeacherExamGradingRoom>()
      .then(async (rooms) => {
        if (rooms.some((room) => !Array.isArray(room.classIds)
          || typeof room.startsAt !== 'string'
          || typeof room.examSnapshot?.subject !== 'string')) {
          throw new Error('Dữ liệu phòng thi không đủ thông tin lớp, môn hoặc ngày thi.');
        }
        const matchingRooms = rooms.filter((room) => (
          room.classIds.includes(selectedClass.id)
          && room.examSnapshot.subject === subject
          && semesterForExamStart(room.startsAt) === semester
        ));
        return Promise.all(matchingRooms.map((room) => getTeacherExamRoomGrading(room.id)));
      })
      .then((results) => {
        if (active) setExamChartResults(results);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setExamResultsError(requestError instanceof Error ? requestError.message : 'Không thể tải điểm bài thi.');
        }
      })
      .finally(() => {
        if (active) setLoadingExamResults(false);
      });
    return () => { active = false; };
  }, [scoreMode, selectedClass, semester, subject]);

  useEffect(() => {
    let active = true;
    if (!selectedClass || !subject) {
      setAssignments([]);
      setLoadingAssignments(false);
      setAssignmentError('');
      return () => { active = false; };
    }
    setLoadingAssignments(true);
    setAssignmentError('');
    listClassAssignments(selectedClass.id, selectedClass.academic_year, semester, subject)
      .then((items) => {
        if (active) setAssignments(items);
      })
      .catch((requestError: unknown) => {
        if (active) setAssignmentError(requestError instanceof Error ? requestError.message : 'Không thể tải điểm bài tập.');
      })
      .finally(() => {
        if (active) setLoadingAssignments(false);
      });
    return () => { active = false; };
  }, [selectedClass, semester, subject]);

  useEffect(() => {
    let active = true;
    if (!selectedClass?.is_homeroom) {
      setHomeroomSummary(null);
      setLoadingHomeroomSummary(false);
      setHomeroomError('');
      return () => { active = false; };
    }
    setHomeroomSummary(null);
    setLoadingHomeroomSummary(true);
    setHomeroomError('');
    getHomeroomClassGradeSummary(selectedClass.id, selectedClass.academic_year, semester)
      .then((summary) => {
        if (active) setHomeroomSummary(summary);
      })
      .catch((requestError: unknown) => {
        if (active) setHomeroomError(requestError instanceof Error ? requestError.message : 'Không thể tải điểm trung bình các môn.');
      })
      .finally(() => {
        if (active) setLoadingHomeroomSummary(false);
      });
    return () => { active = false; };
  }, [selectedClass, semester]);

  useEffect(() => {
    if (students.length > 0 && !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [selectedStudentId, students]);

  useEffect(() => {
    analysisRequestId.current += 1;
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisLoading(false);
  }, [classId, semester, subject]);

  const runAnalysis = async () => {
    if (!selectedClass || !subject || analysisLoading) return;
    const requestId = analysisRequestId.current + 1;
    analysisRequestId.current = requestId;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const result = await analyzeTeacherClassProgress(selectedClass.id, {
        academicYear: selectedClass.academic_year,
        semester,
        subject,
      });
      if (requestId === analysisRequestId.current) setAnalysis(result);
    } catch (requestError: unknown) {
      if (requestId === analysisRequestId.current) {
        setAnalysisError(requestError instanceof Error ? requestError.message : 'Không thể phân tích tiến độ lớp.');
      }
    } finally {
      if (requestId === analysisRequestId.current) setAnalysisLoading(false);
    }
  };

  const studentNamesByKey = new Map(
    (analysis?.students ?? []).map((student) => [student.studentKey, student.fullName]),
  );
  const displayStudentNames = (text: string) => [...studentNamesByKey.entries()]
    .reduce((result, [studentKey, fullName]) => result.split(studentKey).join(fullName), text);
  const insightStyles = {
    support: 'border-rose-200 bg-rose-50 text-rose-900',
    steady: 'border-amber-200 bg-amber-50 text-amber-900',
    strong: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;
  const insightLabels = {
    support: 'Cần chú ý',
    steady: 'Ổn định',
    strong: 'Điểm mạnh',
  } as const;
  const recommendationIcons = {
    assignment: ClipboardCheck,
    exam: BookOpenCheck,
    review: BookOpen,
    classroom: Users,
  } as const;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="progress-class">Lớp</label>
          <select
            id="progress-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            disabled={loadingClasses || classes.length === 0}
            className="input-field min-h-10 w-40 px-3 text-sm"
          >
            {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="progress-semester">Học kỳ</label>
          <select
            id="progress-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            className="input-field min-h-10 w-28 px-3 text-sm"
          >
            <option>Kỳ 1</option>
            <option>Kỳ 2</option>
          </select>
          <button
            type="button"
            disabled={loadingClasses || loadingReport || analysisLoading || !selectedClass || !subject}
            onClick={() => void runAnalysis()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analysisLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysisLoading ? 'Đang phân tích...' : 'AI phân tích lớp'}
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {loadingClasses ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải danh sách lớp...</p>
      ) : !classes.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chưa có lớp được phân công.</p>
      ) : !subjects.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Lớp này chưa có môn học được phân công.</p>
      ) : loadingReport ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải dữ liệu tiến độ...</p>
      ) : !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'Học sinh trong lớp', value: students.length, icon: Users },
              { label: 'Điểm trung bình các cột đã nhập', value: report.average ?? 'Chưa có điểm', icon: BarChart3 },
              {
                label: 'Bài tập đã nộp',
                value: report.assignmentTotal
                  ? `${report.assignmentSubmitted}/${report.assignmentTotal} (${report.assignmentRate}%)`
                  : 'Chưa có bài tập',
                icon: ClipboardCheck,
              },
            ].map(({ label, value, icon: Icon }) => (
              <section key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-500">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-blue-700" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
              </section>
            ))}
          </div>

          {selectedClass?.is_homeroom && (
            <section className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-indigo-950">Điểm trung bình các môn trong lớp chủ nhiệm</h2>
                <span className="text-xs text-slate-500">{selectedClass.academic_year} - {semester}</span>
              </div>
              {homeroomError && (
                <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {homeroomError}
                </div>
              )}
              {loadingHomeroomSummary ? (
                <p role="status" className="mt-3 text-sm text-slate-500">Đang tải điểm trung bình các môn...</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {classSubjectAverages.map((item, index) => {
                    const colors = [
                      'border-blue-200 bg-blue-50 text-blue-900',
                      'border-violet-200 bg-violet-50 text-violet-900',
                      'border-teal-200 bg-teal-50 text-teal-900',
                      'border-amber-200 bg-amber-50 text-amber-950',
                      'border-rose-200 bg-rose-50 text-rose-900',
                      'border-emerald-200 bg-emerald-50 text-emerald-900',
                    ];
                    return (
                      <article key={item.subject} className={`rounded-lg border p-3 ${colors[index % colors.length]}`}>
                        <p className="text-sm font-semibold">{item.subject}</p>
                        <p className="mt-1 text-xl font-extrabold">{item.classAverage?.toFixed(2) ?? 'Chưa có điểm'}</p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {analysisError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{analysisError}
            </div>
          )}
          {analysis && (
            <section className="space-y-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-4 shadow-sm sm:p-5">
              <header className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-950">Góc nhìn AI về tiến độ lớp</h2>
                    {analysis.scope.isHomeroom && (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">Lớp chủ nhiệm - liên môn</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {analysis.scope.className} - {analysis.scope.subject} - {analysis.scope.semester}
                  </p>
                </div>
              </header>

              <div className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-xl border border-blue-200 bg-white/90 p-4">
                  <h3 className="font-bold text-blue-900">Tình hình chung</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{displayStudentNames(analysis.analysis.classOverview)}</p>
                </article>
                <article className="rounded-xl border border-violet-200 bg-white/90 p-4">
                  <h3 className="font-bold text-violet-900">Gợi ý nhìn nhận cách học</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{displayStudentNames(analysis.analysis.learningAdvice)}</p>
                </article>
              </div>

              {(analysis.analysis.strengths.length > 0 || analysis.analysis.focusAreas.length > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {analysis.analysis.strengths.length > 0 && (
                    <article className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                      <h3 className="flex items-center gap-2 font-bold text-emerald-900"><BookOpenCheck className="h-4 w-4" /> Điểm lớp đang làm tốt</h3>
                      <ul className="mt-2 space-y-2 text-sm leading-5 text-emerald-950">
                        {analysis.analysis.strengths.map((item, index) => <li key={index}>• {displayStudentNames(item)}</li>)}
                      </ul>
                    </article>
                  )}
                  {analysis.analysis.focusAreas.length > 0 && (
                    <article className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                      <h3 className="flex items-center gap-2 font-bold text-amber-950"><TriangleAlert className="h-4 w-4" /> Cần quan tâm</h3>
                      <ul className="mt-2 space-y-2 text-sm leading-5 text-amber-950">
                        {analysis.analysis.focusAreas.map((item, index) => <li key={index}>• {displayStudentNames(item)}</li>)}
                      </ul>
                    </article>
                  )}
                </div>
              )}

              {analysis.analysis.studentInsights.length > 0 && (
                <section className="rounded-xl border border-slate-200 bg-white/90 p-4">
                  <h3 className="flex items-center gap-2 font-bold text-slate-900"><Users className="h-4 w-4 text-indigo-600" /> Học sinh cần lưu ý</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {analysis.analysis.studentInsights.map((item) => (
                      <article key={item.studentKey} className={`rounded-xl border p-3 ${insightStyles[item.level]}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-bold">{studentNamesByKey.get(item.studentKey) ?? 'Học sinh'}</h4>
                          <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold">{insightLabels[item.level]}</span>
                        </div>
                        <p className="mt-2 text-sm leading-5">{displayStudentNames(item.insight)}</p>
                        <ul className="mt-2 space-y-1 text-xs opacity-90">
                          {item.evidence.map((evidence, index) => <li key={index}>• {displayStudentNames(evidence)}</li>)}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {analysis.analysis.recommendations.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 font-bold text-slate-900"><Lightbulb className="h-4 w-4 text-amber-500" /> Gợi ý bước tiếp theo</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {analysis.analysis.recommendations.map((item, index) => {
                      const Icon = recommendationIcons[item.type];
                      return (
                        <article key={`${item.type}-${index}`} className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
                          <h4 className="flex items-center gap-2 font-bold text-indigo-900"><Icon className="h-4 w-4" /> {displayStudentNames(item.title)}</h4>
                          <p className="mt-2 text-sm leading-5 text-slate-700">{displayStudentNames(item.action)}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{displayStudentNames(item.reason)}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="space-y-1 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-slate-500">
                <p>AI chỉ hỗ trợ tham khảo; cần kiểm tra dữ liệu và quyết định cách hỗ trợ phù hợp. Học sinh được ẩn danh khi gửi dữ liệu phân tích.</p>
                {analysis.analysis.limitations.map((item, index) => <p key={index}>• {displayStudentNames(item)}</p>)}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-900">Tiến độ từng học sinh - {selectedClass?.name} - {subject} - {semester}</h2>
            </div>
            {students.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Lớp hiện chưa có học sinh đang theo học.</p>
            ) : (
              <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="min-w-0 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{selectedStudent?.fullName}</h3>
                    </div>
                    <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Chọn loại điểm">
                      <button
                        type="button"
                        aria-pressed={scoreMode === 'assignment'}
                        onClick={() => setScoreMode('assignment')}
                        className={`rounded-md px-3 py-2 text-xs font-semibold ${scoreMode === 'assignment' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        Điểm các bài
                      </button>
                      <button
                        type="button"
                        aria-pressed={scoreMode === 'subject'}
                        onClick={() => setScoreMode('subject')}
                        className={`rounded-md px-3 py-2 text-xs font-semibold ${scoreMode === 'subject' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
                      >
                        Điểm TBM môn
                      </button>
                    </div>
                  </div>
                  {scoreMode === 'assignment' && (loadingAssignments || loadingExamResults) ? (
                    <p role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải điểm bài tập và bài thi...
                    </p>
                  ) : scoreMode === 'assignment' && assignmentError ? (
                    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{assignmentError}</p>
                  ) : selectedClass?.is_homeroom && scoreMode === 'subject' && loadingHomeroomSummary ? (
                    <p role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải điểm các môn...
                    </p>
                  ) : chartPoints.length ? (
                    <StudentScoreChart points={chartPoints} />
                  ) : (
                    <p className="flex min-h-72 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
                      {scoreMode === 'assignment'
                        ? 'Học sinh chưa có điểm bài tập được chấm trong các bài gần đây.'
                        : 'Chưa có lịch sử điểm TBM của học sinh trong học kỳ này.'}
                    </p>
                  )}
                  {scoreMode === 'assignment' && !loadingAssignments && !assignmentError && (
                    <p className="mt-2 text-xs text-slate-500">Bài tập đã chấm và bài thi đã công bố điểm được hiển thị theo thang điểm 10.</p>
                  )}
                  {scoreMode === 'assignment' && examResultsError && (
                    <p role="alert" className="mt-2 text-xs text-rose-700">Không thể tải điểm bài thi: {examResultsError}</p>
                  )}
                </div>
                <aside className="border-t border-slate-100 lg:max-h-[32rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-bold text-slate-800">Học sinh trong lớp</h3>
                    <p className="mt-1 text-xs text-slate-500">{students.length} học sinh</p>
                  </div>
                  <div className="space-y-1 p-2">
                    {sortedStudents.map((student) => (
                      <button
                        type="button"
                        key={student.id}
                        aria-pressed={student.id === selectedStudent?.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left transition ${
                          student.id === selectedStudent?.id
                            ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">{student.fullName}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          TBM {student.confirmedAverage?.toFixed(1) ?? '—'} - Bài tập {student.assignments.submitted}/{student.assignments.total}
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
