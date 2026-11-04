import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  analyzeStudentProgress,
  getStudentProgress,
  type ProgressSemester,
  type StudentProgressAnalysis,
  type StudentProgressData,
} from '@/api/schoolApi';
import { useChartViewport } from '@/hooks/useChartViewport';

interface MyResultsProps {
  studentUserId: string;
  studentName: string;
  onOpenResources: (subject: string, topic: string) => void;
  onCreatePractice: (subject: string, topic: string) => void;
}

type SemesterFilter = ProgressSemester | 'Cả năm';
type HistoryFilter = 'completed' | 'average';
type AllSubjectsChartMode = 'subjects' | 'overall';

interface StoredProgressAnalysis {
  version: 3;
  analysis: StudentProgressAnalysis | null;
  lastClickedAt: string;
}

interface StoredProgressAnalysisScope {
  version: 3;
  classId: string;
  academicYear: string;
  semester: ProgressSemester | 'Cả năm';
  subject: string;
}

interface AnalysisRequest {
  semester?: SemesterFilter;
}

type PriorityRecommendation = StudentProgressAnalysis['recommendations'][number] & { index: number };
type OrderedPlanStage = StudentProgressAnalysis['roadmap'][number] & {
  index: number;
  priorityRank: number;
  relatedRecommendations: StudentProgressAnalysis['recommendations'];
};

interface ScoredAssessment {
  id: string;
  title: string;
  score: number;
  maxScore: number;
  gradedAt: string | null;
  kind: 'Bài tập' | 'Bài thi' | 'Điểm trung bình môn';
  label?: string;
}

interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: Array<{ recordedAt: string; score: number }>;
}

const SUBJECT_CHART_COLORS = [
  '#7c3aed',
  '#0284c7',
  '#059669',
  '#ea580c',
  '#db2777',
  '#4f46e5',
  '#0891b2',
  '#65a30d',
];

function localDateKey(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function localDateTimestamp(dateKey: string) {
  return Date.parse(`${dateKey}T12:00:00+07:00`);
}

function scorePercent(score: number, maxScore: number) {
  return maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : null;
}

function scoreStanding(score: number | null) {
  if (score === null) {
    return { label: 'Chưa có điểm', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300', color: 'text-slate-600' };
  }
  if (score < 5) {
    return { label: 'Kém', badge: 'bg-rose-100 text-rose-800', bar: 'bg-rose-500', color: 'text-rose-800' };
  }
  if (score < 7) {
    return { label: 'Trung bình', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', color: 'text-amber-800' };
  }
  if (score < 9) {
    return { label: 'Giỏi', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', color: 'text-emerald-800' };
  }
  return { label: 'Xuất sắc', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-600', color: 'text-blue-800' };
}

function isValidOfficialAverage(average: number | null): average is number {
  return average !== null && Number.isFinite(average) && average >= 0 && average <= 10;
}

function subjectAverageForScope(
  averages: StudentProgressData['officialAverages'],
  subject: string,
  semester: SemesterFilter,
) {
  const subjectAverages = averages.filter((item) => item.subject === subject);
  if (semester === 'Cả năm') {
    const semesterOne = subjectAverages.find((item) => item.semester === 'Kỳ 1')?.average ?? null;
    const semesterTwo = subjectAverages.find((item) => item.semester === 'Kỳ 2')?.average ?? null;
    return isValidOfficialAverage(semesterOne) && isValidOfficialAverage(semesterTwo)
      ? (semesterOne + 2 * semesterTwo) / 3
      : null;
  }
  const average = subjectAverages.find((item) => item.semester === semester)?.average ?? null;
  return isValidOfficialAverage(average) ? average : null;
}

function regularScoreAverageForScope(
  averages: StudentProgressData['officialAverages'],
  subject: string,
  semester: SemesterFilter,
) {
  const subjectAverages = averages.filter((item) => item.subject === subject);
  const selectedRows = semester === 'Cả năm'
    ? subjectAverages
    : subjectAverages.filter((item) => item.semester === semester);
  const regularScores = selectedRows.flatMap((item) => item.regularScores ?? [])
    .filter((score): score is number => (
      score !== null && Number.isFinite(score) && score >= 0 && score <= 10
    ));
  return regularScores.length
    ? regularScores.reduce((total, score) => total + score, 0) / regularScores.length
    : null;
}

function assessmentAverage(scores: Array<number | null>) {
  const validScores = scores.filter((score): score is number => (
    score !== null && Number.isFinite(score) && score >= 0 && score <= 10
  ));
  return validScores.length
    ? validScores.reduce((total, score) => total + score, 0) / validScores.length
    : null;
}

function normalizedExamScore(exam: StudentProgressData['examResults'][number]) {
  const maximum = exam.questions.reduce((total, question) => total + question.points, 0);
  const total = exam.grade.totalScore;
  if (!Number.isFinite(maximum) || maximum <= 0
    || !Number.isFinite(total) || total < 0 || total > maximum) {
    return null;
  }
  return (total / maximum) * 10;
}

function progressAnalysisStorageKey(
  studentUserId: string,
  classId: string,
  academicYear: string,
  semester: SemesterFilter,
  subject: string,
) {
  const scope = [studentUserId, classId, academicYear, semester, subject]
    .map((value) => encodeURIComponent(value))
    .join(':');
  return `eduflow.student.progress-analysis.v3:${scope}`;
}

function progressAnalysisScopeStorageKey(studentUserId: string) {
  return `eduflow.student.progress-analysis.v3:${encodeURIComponent(studentUserId)}:last-scope`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEvidenceTextItem(value: unknown, fields: string[]) {
  return isRecord(value)
    && fields.every((field) => typeof value[field] === 'string')
    && isStringArray(value.evidenceIds);
}

function isStoredProgressAnalysis(value: unknown): value is StoredProgressAnalysis {
  if (!isRecord(value) || value.version !== 2
    || typeof value.lastClickedAt !== 'string'
    || Number.isNaN(Date.parse(value.lastClickedAt))) {
    return false;
  }
  if (value.analysis === null) return true;
  if (!isRecord(value.analysis)) return false;

  const analysis = value.analysis;
  return isEvidenceTextItem(analysis.overview, ['text'])
    && Array.isArray(analysis.strengths)
    && analysis.strengths.every((item) => isEvidenceTextItem(item, ['text']))
    && Array.isArray(analysis.focusAreas)
    && analysis.focusAreas.every((item) => isEvidenceTextItem(item, ['topic', 'text']))
    && Array.isArray(analysis.recommendations)
    && analysis.recommendations.every((item) => (
      isRecord(item)
      && typeof item.action === 'string'
      && ['high', 'medium', 'low'].includes(String(item.priority))
      && isStringArray(item.evidenceIds)
      && isStringArray(item.resourceIds)
    ))
    && Array.isArray(analysis.roadmap)
    && analysis.roadmap.every((item) => (
      isRecord(item)
      && typeof item.stage === 'string'
      && typeof item.goal === 'string'
      && typeof item.evaluation === 'string'
      && isStringArray(item.actions)
      && isStringArray(item.evidenceIds)
    ))
    && isStringArray(analysis.limitations);
}

function isStoredProgressAnalysisScope(value: unknown): value is StoredProgressAnalysisScope {
  return isRecord(value)
    && value.version === 3
    && typeof value.classId === 'string'
    && typeof value.academicYear === 'string'
    && (value.semester === 'Kỳ 1' || value.semester === 'Kỳ 2' || value.semester === 'Cả năm')
    && typeof value.subject === 'string';
}

function saveProgressAnalysisValue(key: string, value: StoredProgressAnalysis | StoredProgressAnalysisScope) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Không thể lưu nhận xét vào trình duyệt.';
  }
}

function evidenceLabel(id: string, progress: StudentProgressData) {
  if (id.startsWith('assignment:')) {
    const item = progress.assignments.find((assignment) => assignment.id === id.slice('assignment:'.length));
    return item ? `Bài tập: ${item.title}` : 'Bài tập đã chấm';
  }
  if (id.startsWith('exam:')) {
    const item = progress.examResults.find((exam) => exam.sessionId === id.slice('exam:'.length));
    return item ? `Bài kiểm tra: ${item.title}` : 'Bài kiểm tra đã công bố điểm';
  }
  if (id.startsWith('grade:')) {
    const [, , academicYear, semester, ...subjectParts] = id.split(':');
    return `Điểm chính thức ${subjectParts.join(':')} - ${semester} - ${academicYear}`;
  }
  return 'Dữ liệu học tập';
}

function relatedAssessments(ids: string[], progress: StudentProgressData) {
  return ids.flatMap((id) => {
    if (id.startsWith('assignment:')) {
      const assessmentId = id.slice('assignment:'.length);
      const assessment = progress.assignments.find((item) => item.id === assessmentId);
      return assessment ? [{ id: assessmentId, title: assessment.title }] : [];
    }
    if (id.startsWith('exam:')) {
      const assessmentId = id.slice('exam:'.length);
      const assessment = progress.examResults.find((item) => item.sessionId === assessmentId);
      return assessment ? [{ id: assessmentId, title: assessment.title }] : [];
    }
    return [];
  });
}

function subjectForEvidence(ids: string[], progress: StudentProgressData | null) {
  if (!progress) return null;
  for (const id of ids) {
    if (id.startsWith('assignment:')) {
      const assignment = progress.assignments.find((item) => item.id === id.slice('assignment:'.length));
      if (assignment) return assignment.subject;
    }
    if (id.startsWith('exam:')) {
      const exam = progress.examResults.find((item) => item.sessionId === id.slice('exam:'.length));
      if (exam) return exam.subject;
    }
    if (id.startsWith('grade:')) {
      const [, , , , ...subjectParts] = id.split(':');
      if (subjectParts.length) return subjectParts.join(':');
    }
  }
  return null;
}

export function MyResults({ studentUserId, onOpenResources, onCreatePractice }: MyResultsProps) {
  const [progress, setProgress] = useState<StudentProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [semester, setSemester] = useState<SemesterFilter>('Kỳ 1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [analysis, setAnalysis] = useState<StudentProgressAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [lastAnalysisClickAt, setLastAnalysisClickAt] = useState<Date | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('completed');
  const [allSubjectsChartMode, setAllSubjectsChartMode] = useState<AllSubjectsChartMode>('subjects');
  const [chartExpanded, setChartExpanded] = useState(false);
  const analysisRequestId = useRef(0);
  const restoredAnalysisScopeUserId = useRef('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    getStudentProgress()
      .then((result) => {
        if (!active) return;
        setProgress(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu tiến độ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  const selectedClass = progress?.classes.find((item) => item.id === progress.scope.classId)
    ?? progress?.classes[0]
    ?? null;
  const analysisCacheKey = selectedClass && studentUserId
    ? progressAnalysisStorageKey(
      studentUserId,
      selectedClass.id,
      selectedClass.academicYear,
      semester,
      selectedSubject,
    )
    : null;
  const subjects = useMemo(() => {
    if (!progress || !selectedClass) return [];
    const related = [
      ...selectedClass.subjects,
      ...progress.officialAverages.filter((item) => item.classId === selectedClass.id).map((item) => item.subject),
      ...progress.assignments.filter((item) => item.classId === selectedClass.id).map((item) => item.subject),
      ...progress.examResults.filter((item) => item.classId === selectedClass.id).map((item) => item.subject),
    ];
    return [...new Set(related.filter(Boolean))].sort((first, second) => first.localeCompare(second, 'vi'));
  }, [progress, selectedClass]);

  useEffect(() => {
    if (!selectedSubject || subjects.includes(selectedSubject)) return;
    setSelectedSubject('');
  }, [selectedSubject, subjects]);

  useEffect(() => {
    if (!progress || restoredAnalysisScopeUserId.current === studentUserId) return;
    restoredAnalysisScopeUserId.current = studentUserId;
    const storageKey = progressAnalysisScopeStorageKey(studentUserId);
    try {
      const serialized = localStorage.getItem(storageKey);
      if (!serialized) return;
      const savedScope: unknown = JSON.parse(serialized);
      if (!isStoredProgressAnalysisScope(savedScope)) {
        localStorage.removeItem(storageKey);
        return;
      }
      const savedClass = progress.classes.find(
        (item) => item.id === savedScope.classId && item.academicYear === savedScope.academicYear,
      );
      if (!savedClass || (savedScope.subject && !subjects.includes(savedScope.subject))) {
        localStorage.removeItem(storageKey);
        return;
      }
      setSemester(savedScope.semester);
      setSelectedSubject('');
    } catch (error) {
      setAnalysisError(error instanceof Error
        ? `Không thể khôi phục bộ lọc nhận xét đã lưu: ${error.message}`
        : 'Không thể khôi phục bộ lọc nhận xét đã lưu.');
    }
  }, [progress, studentUserId, subjects]);

  useEffect(() => {
    analysisRequestId.current += 1;
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisMessage('');
    setAnalysisLoading(false);
    setLastAnalysisClickAt(null);

    if (!analysisCacheKey) return;
    try {
      const serialized = localStorage.getItem(analysisCacheKey);
      if (!serialized) return;
      const cached: unknown = JSON.parse(serialized);
      if (!isStoredProgressAnalysis(cached)) {
        localStorage.removeItem(analysisCacheKey);
        throw new Error('Dữ liệu nhận xét đã lưu không đúng định dạng.');
      }
      setAnalysis(cached.analysis);
      setLastAnalysisClickAt(new Date(cached.lastClickedAt));
    } catch (error) {
      setAnalysisError(error instanceof Error
        ? `Không thể tải nhận xét đã lưu: ${error.message}`
        : 'Không thể tải nhận xét đã lưu từ trình duyệt.');
    }
  }, [analysisCacheKey]);

  const scopedAverages = useMemo(() => {
    if (!progress || !selectedClass) return [];
    return progress.officialAverages.filter((item) => (
      item.classId === selectedClass.id
      && item.academicYear === selectedClass.academicYear
      && (semester === 'Cả năm' || item.semester === semester)
    ));
  }, [progress, selectedClass, semester]);

  const assignments = useMemo(() => {
    if (!progress || !selectedClass) return [];
    return progress.assignments
      .filter((item) => (
        item.classId === selectedClass.id
        && item.academicYear === selectedClass.academicYear
        && (!selectedSubject || item.subject === selectedSubject)
        && (semester === 'Cả năm' || item.semester === semester)
      ))
      .sort((first, second) => new Date(second.gradedAt ?? second.dueAt).getTime()
        - new Date(first.gradedAt ?? first.dueAt).getTime());
  }, [progress, selectedClass, selectedSubject, semester]);
  const exams = useMemo(() => {
    if (!progress || !selectedClass) return [];
    return progress.examResults
      .filter((item) => (
        item.classId === selectedClass.id
        && item.academicYear === selectedClass.academicYear
        && (!selectedSubject || item.subject === selectedSubject)
        && (semester === 'Cả năm' || item.semester === semester)
      ))
      .sort((first, second) => new Date(second.grade.gradedAt).getTime()
        - new Date(first.grade.gradedAt).getTime());
  }, [progress, selectedClass, selectedSubject, semester]);
  const runAnalysis = async ({ semester: assessmentSemester }: AnalysisRequest) => {
    if (!selectedClass || analysisLoading) return;
    const requestId = analysisRequestId.current + 1;
    analysisRequestId.current = requestId;
    const clickedAt = new Date();
    const clickedAtIso = clickedAt.toISOString();
    setLastAnalysisClickAt(clickedAt);
    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysisMessage('');
    if (analysisCacheKey) {
      const saveError = saveProgressAnalysisValue(analysisCacheKey, {
        version: 3,
        analysis,
        lastClickedAt: clickedAtIso,
      });
      if (saveError) setAnalysisError(`Không thể lưu nhận xét vào trình duyệt: ${saveError}`);
    }
    if (assessmentSemester) {
      const scopeSaveError = saveProgressAnalysisValue(progressAnalysisScopeStorageKey(studentUserId), {
        version: 3,
        classId: selectedClass.id,
        academicYear: selectedClass.academicYear,
        semester: assessmentSemester,
        subject: selectedSubject,
      });
      if (scopeSaveError) setAnalysisError(`Không thể lưu bộ lọc nhận xét vào trình duyệt: ${scopeSaveError}`);
    }
    setAnalysis(null);
    try {
      const response = await analyzeStudentProgress({
        classId: selectedClass.id,
        academicYear: selectedClass.academicYear,
        ...(selectedSubject ? { subject: selectedSubject } : {}),
        ...(assessmentSemester ? { semester: assessmentSemester } : {}),
      });
      if (requestId !== analysisRequestId.current) return;
      if (response.status === 'insufficient-data') {
        setAnalysisMessage(response.message);
        if (analysisCacheKey) {
          const saveError = saveProgressAnalysisValue(analysisCacheKey, {
            version: 3,
            analysis: null,
            lastClickedAt: clickedAtIso,
          });
          if (saveError) setAnalysisError(`Không thể lưu nhận xét vào trình duyệt: ${saveError}`);
        }
      } else {
        setAnalysis(response.analysis);
        setDetailsOpen(true);
        if (analysisCacheKey) {
          const saveError = saveProgressAnalysisValue(analysisCacheKey, {
            version: 3,
            analysis: response.analysis,
            lastClickedAt: clickedAtIso,
          });
          if (saveError) setAnalysisError(`Đã phân tích xong nhưng không thể lưu vào trình duyệt: ${saveError}`);
        }
      }
    } catch (error) {
      if (requestId !== analysisRequestId.current) return;
      setAnalysisError(error instanceof Error ? error.message : 'Không thể phân tích tiến độ lúc này.');
    } finally {
      if (requestId === analysisRequestId.current) setAnalysisLoading(false);
    }
  };

  const gradedAssignments = useMemo(
    () => assignments.filter((item) => item.score !== null),
    [assignments],
  );
  const assessmentAverages = useMemo(() => {
    const examScores = exams.flatMap((exam) => {
      const score = normalizedExamScore(exam);
      return score === null ? [] : [score];
    });
    return {
      assignments: assessmentAverage(gradedAssignments.map((item) => item.score)),
      exams: assessmentAverage(examScores),
    };
  }, [exams, gradedAssignments]);
  const recentSubjectAssignments = useMemo(() => gradedAssignments
    .filter((item) => !selectedSubject || item.subject === selectedSubject)
    .sort((first, second) => Date.parse(second.gradedAt ?? second.dueAt) - Date.parse(first.gradedAt ?? first.dueAt))
    .slice(0, 3), [gradedAssignments, selectedSubject]);
  const recentSubjectExams = useMemo(() => exams
    .flatMap((exam) => {
      const score = normalizedExamScore(exam);
      return score === null ? [] : [{ exam, score }];
    })
    .sort((first, second) => Date.parse(second.exam.grade.gradedAt) - Date.parse(first.exam.grade.gradedAt))
    .slice(0, 3), [exams]);
  const attendanceAverage = selectedSubject
    ? regularScoreAverageForScope(scopedAverages, selectedSubject, semester)
    : null;
  const completedAssignments = useMemo(
    () => assignments.filter((item) => item.submittedAt !== null),
    [assignments],
  );
  const chartAssessments = useMemo(() => {
    const assignmentScores = completedAssignments.flatMap((assignment): ScoredAssessment[] => (
      assignment.score === null
        ? []
        : [{
          id: assignment.id,
          title: selectedSubject ? assignment.title : `${assignment.subject}: ${assignment.title}`,
          score: assignment.score,
          maxScore: 10,
          gradedAt: assignment.gradedAt,
          kind: 'Bài tập',
        }]
    ));
    const examScores = exams.flatMap((exam): ScoredAssessment[] => {
      const score = normalizedExamScore(exam);
      if (score === null) return [];
      return [{
        id: exam.sessionId,
        title: selectedSubject ? exam.title : `${exam.subject}: ${exam.title}`,
        score,
        maxScore: 10,
        gradedAt: exam.grade.gradedAt,
        kind: 'Bài thi',
      }];
    });
    return [...assignmentScores, ...examScores].sort((first, second) => new Date(first.gradedAt ?? '').getTime()
      - new Date(second.gradedAt ?? '').getTime());
  }, [completedAssignments, exams, selectedSubject]);
  const chartAverageHistory = useMemo(() => (
    scopedAverages
      .filter((item) => !selectedSubject || item.subject === selectedSubject)
      .flatMap((item) => (item.averageHistory ?? []).map((snapshot, index): ScoredAssessment => ({
        id: `${item.classId}-${item.academicYear}-${item.semester}-${snapshot.recordedAt}-${index}`,
        title: `TBM ${item.subject} - ${item.semester} - ${item.academicYear}`,
        score: snapshot.average,
        maxScore: 10,
        gradedAt: snapshot.recordedAt,
        kind: 'Điểm trung bình môn',
        label: `${item.subject} · ${item.semester} - ${new Date(snapshot.recordedAt).toLocaleDateString('vi-VN')}`,
      })))
      .sort((first, second) => new Date(first.gradedAt ?? '').getTime()
        - new Date(second.gradedAt ?? '').getTime())
  ), [scopedAverages, selectedSubject]);
  const allSubjectsChartSeries = useMemo<ChartSeries[]>(() => {
    const subjectsWithHistory = subjects.map((subject, index) => {
      const subjectAverages = scopedAverages.filter((item) => item.subject === subject);
      const historyForSemester = (targetSemester: ProgressSemester) => {
        const byDate = new Map<string, { recordedAt: number; score: number }>();
        subjectAverages
          .filter((item) => item.semester === targetSemester)
          .flatMap((item) => item.averageHistory ?? [])
          .forEach((snapshot) => {
            const dateKey = localDateKey(snapshot.recordedAt);
            const recordedAt = Date.parse(snapshot.recordedAt);
            if (!dateKey || !Number.isFinite(recordedAt) || !isValidOfficialAverage(snapshot.average)) return;
            const existing = byDate.get(dateKey);
            if (!existing || recordedAt >= existing.recordedAt) {
              byDate.set(dateKey, { recordedAt, score: snapshot.average });
            }
          });
        return byDate;
      };
      return {
        id: subject,
        label: subject,
        color: SUBJECT_CHART_COLORS[index % SUBJECT_CHART_COLORS.length],
        semesterOne: historyForSemester('Kỳ 1'),
        semesterTwo: historyForSemester('Kỳ 2'),
      };
    });

    const allDateKeys = subjectsWithHistory.flatMap((series) => [
      ...series.semesterOne.keys(),
      ...series.semesterTwo.keys(),
    ]);
    if (!allDateKeys.length) return [];
    const dateTimeline = [...new Set(allDateKeys)].sort();

    const latestAt = (history: Map<string, { recordedAt: number; score: number }>, dateKey: string) => {
      let latest: { dateKey: string; score: number } | null = null;
      for (const [historyDate, snapshot] of history) {
        if (historyDate <= dateKey && (!latest || historyDate > latest.dateKey)) {
          latest = { dateKey: historyDate, score: snapshot.score };
        }
      }
      return latest?.score;
    };

    return subjectsWithHistory.flatMap((series) => {
      const points = dateTimeline.flatMap((dateKey) => {
        const score = semester === 'Cả năm'
          ? (() => {
            const semesterOne = latestAt(series.semesterOne, dateKey);
            const semesterTwo = latestAt(series.semesterTwo, dateKey);
            return semesterOne !== undefined && semesterTwo !== undefined
              ? (semesterOne + 2 * semesterTwo) / 3
              : null;
          })()
          : latestAt(semester === 'Kỳ 1' ? series.semesterOne : series.semesterTwo, dateKey) ?? null;
        return score === null
          ? []
          : [{ recordedAt: new Date(localDateTimestamp(dateKey)).toISOString(), score }];
      });
      return points.length
        ? [{ id: series.id, label: series.label, color: series.color, points }]
        : [];
    });
  }, [scopedAverages, semester, subjects]);
  const overallAverageChartSeries = useMemo<ChartSeries[]>(() => {
    if (!allSubjectsChartSeries.length) return [];
    const timeline = [...new Set(allSubjectsChartSeries.flatMap((series) => (
      series.points.map((point) => point.recordedAt)
    )))].sort((first, second) => Date.parse(first) - Date.parse(second));
    const points = timeline.flatMap((recordedAt) => {
      const scores = allSubjectsChartSeries.flatMap((series) => {
        const latest = series.points
          .filter((point) => Date.parse(point.recordedAt) <= Date.parse(recordedAt))
          .sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt))[0];
        return latest ? [latest.score] : [];
      });
      return scores.length
        ? [{ recordedAt, score: scores.reduce((total, score) => total + score, 0) / scores.length }]
        : [];
    });
    return points.length ? [{ id: 'overall-average', label: 'Điểm trung bình các môn', color: '#7c3aed', points }] : [];
  }, [allSubjectsChartSeries]);
  const subjectAchievements = useMemo(() => {
    if (!progress || !selectedClass) return [];
    const achievementSubjects = selectedSubject ? [selectedSubject] : subjects;
    return achievementSubjects.map((subject) => {
      return {
        subject,
        average: subjectAverageForScope(scopedAverages, subject, semester),
        count: gradedAssignments.filter((item) => item.subject === subject).length
          + exams.filter((item) => item.subject === subject).length,
      };
    });
  }, [progress, selectedClass, selectedSubject, subjects, scopedAverages, gradedAssignments, semester, exams]);
  const officialSubjectScores = subjectAchievements.flatMap((item) => (
    isValidOfficialAverage(item.average) ? [item.average] : []
  ));
  const allSubjectAverage = officialSubjectScores.length
    ? officialSubjectScores.reduce((total, average) => total + average, 0) / officialSubjectScores.length
    : null;
  const planStages = useMemo<OrderedPlanStage[]>(() => {
    if (!analysis) return [];
    const priority = { high: 0, medium: 1, low: 2 } as const;
    return analysis.roadmap
      .map((stage, index) => {
        const relatedRecommendations = analysis.recommendations
          .filter((item) => item.evidenceIds.some((id) => stage.evidenceIds.includes(id)))
          .sort((first, second) => priority[first.priority] - priority[second.priority]);
        return {
          ...stage,
          index,
          relatedRecommendations,
          priorityRank: relatedRecommendations.length
            ? priority[relatedRecommendations[0].priority]
            : 3,
        };
      })
      .sort((first, second) => first.priorityRank - second.priorityRank || first.index - second.index);
  }, [analysis]);
  const orderedRecommendations = useMemo<PriorityRecommendation[]>(() => {
    if (!analysis) return [];
    const priority = { high: 0, medium: 1, low: 2 } as const;
    return analysis.recommendations
      .map((item, index) => ({ ...item, index }))
      .sort((first, second) => priority[first.priority] - priority[second.priority] || first.index - second.index);
  }, [analysis]);
  const displayedHistoryFilter: HistoryFilter = selectedSubject ? historyFilter : 'average';
  const displayedChartSeries = allSubjectsChartMode === 'subjects'
    ? allSubjectsChartSeries
    : overallAverageChartSeries;
  const lastAnalysisClickLabel = lastAnalysisClickAt
    ? lastAnalysisClickAt.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
    : null;

  return (
    <main className={`mx-auto space-y-4 pb-10 text-slate-800 ${chartExpanded ? 'max-w-none' : 'max-w-5xl'}`}>
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">Lọc theo học kỳ</span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value as SemesterFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="Kỳ 1">Kỳ 1</option>
              <option value="Kỳ 2">Kỳ 2</option>
              <option value="Cả năm">Cả năm</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc theo môn học</span>
            <select
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
              disabled={!subjects.length}
              className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">Tất cả môn học</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              {!subjects.length && <option value="" disabled>Chưa có môn học</option>}
            </select>
          </label>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="font-semibold underline">Thử lại</button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">Đang tải dữ liệu học tập…</p>
        ) : !selectedClass ? (
          <EmptyState text="Chưa có lớp học đang hoạt động trong dữ liệu tài khoản." />
        ) : (
          <>
            {(analysis || analysisError || analysisMessage) && (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {analysis && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 sm:px-4">
                <p className={detailsOpen ? '' : 'line-clamp-3'}>{analysis.overview.text}</p>
              </div>
            )}

            {analysis?.focusAreas[0] ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-center text-sm font-medium leading-5 text-amber-900 sm:px-4">
                <strong>{analysis.focusAreas[0].topic}:</strong> {analysis.focusAreas[0].text}
              </div>
            ) : analysis?.strengths[0] ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm leading-5 text-emerald-900 sm:px-4">
                {analysis.strengths[0].text}
              </div>
            ) : null}

            {analysisError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{analysisError}</p>}
            {analysisMessage && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{analysisMessage}</p>}

            {analysis && (
              <>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  className="mx-auto mt-3 flex items-center gap-1 py-2 text-xs font-bold text-violet-700 hover:text-violet-900"
                >
                  {detailsOpen ? 'Ẩn phân tích chi tiết' : 'Xem phân tích chi tiết'}
                  {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {detailsOpen && (
                  <div className="space-y-3 px-4 pb-4 sm:px-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <InsightPanel
                        title="Điểm mạnh"
                        tone="green"
                        items={analysis.strengths.map((item) => ({ title: item.text, text: '', ids: item.evidenceIds }))}
                        progress={progress}
                        empty="Chưa có bằng chứng đủ rõ để nhận định điểm mạnh."
                      />
                      <InsightPanel
                        title="Cần cải thiện"
                        tone="red"
                        items={analysis.focusAreas.map((item) => ({ title: item.topic, text: item.text, ids: item.evidenceIds }))}
                        progress={progress}
                        onPractice={(topic, evidenceIds) => onCreatePractice(
                          selectedSubject || subjectForEvidence(evidenceIds, progress) || subjects[0] || '',
                          topic,
                        )}
                        empty="Chưa có bằng chứng đủ rõ để xác định nội dung cần cải thiện."
                      />
                    </div>

                    <section className="rounded-lg border border-violet-200 bg-white p-3 sm:p-4">
                      <h3 className="text-sm font-bold text-violet-800">Kế hoạch học tập dài hạn</h3>
                      <LongTermPlan
                        stages={planStages}
                        recommendations={orderedRecommendations}
                        progress={progress}
                        onOpenResource={onOpenResources}
                      />
                    </section>

                    <section className="rounded-lg border border-violet-200 bg-white p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-violet-800">Các lỗi / nội dung thường cần ôn</h3>
                      </div>
                      {analysis.focusAreas.length ? (
                        <ul className="mt-3 space-y-2">
                          {analysis.focusAreas.map((item, index) => {
                            const references = progress ? relatedAssessments(item.evidenceIds, progress) : [];
                            const uniqueReferences = [...new Map(references.map((entry) => [entry.id, entry])).values()];
                            return (
                              <li key={`${item.topic}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-slate-800">{item.topic}</h4>
                                  </div>
                                  {uniqueReferences.length > 0 && (
                                    <span className="shrink-0 text-[11px] font-medium text-slate-500">{uniqueReferences.length} bài liên quan</span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{item.text}</p>
                                {uniqueReferences.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                    {uniqueReferences.map((entry) => (
                                      <span key={entry.id} className="text-[11px] text-slate-600">
                                        {entry.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-slate-500">Chưa có lỗi cụ thể được xác định từ dữ liệu bài làm hoặc nhận xét.</p>
                      )}
                    </section>

                  </div>
                )}
              </>
            )}
              </section>
            )}
          </>
        )}

        <div>
          <button
            type="button"
            disabled={analysisLoading || !selectedClass}
            onClick={() => void runAnalysis({ semester })}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analysisLoading
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : <ArrowRight className="h-4 w-4" />}
            {analysisLoading
              ? 'Đang phân tích...'
              : analysis ? 'Phân tích lại tiến độ học tập cùng với AI' : 'Phân tích tiến độ học tập cùng với AI'}
          </button>
          {lastAnalysisClickLabel && (
            <p className="mt-2 text-right text-xs text-slate-500">{lastAnalysisClickLabel}</p>
          )}
        </div>
      </div>

      <section className={`grid gap-3 ${chartExpanded ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        {!chartExpanded && <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Thành tích theo môn</h2>
            </div>
          </div>
          {!selectedSubject && (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-slate-700">Điểm trung bình các môn:</span>
              <strong className={`text-xl font-extrabold tabular-nums ${scoreStanding(allSubjectAverage).color}`}>
                {allSubjectAverage === null ? '—' : `${allSubjectAverage.toFixed(1)}/10`}
              </strong>
            </div>
          )}
          {selectedSubject ? (
            <div className="mt-4">
              <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-700">Điểm trung bình môn {selectedSubject}:</span>
                <strong className={`text-xl font-extrabold tabular-nums ${scoreStanding(subjectAchievements[0]?.average ?? null).color}`}>
                  {subjectAchievements[0]?.average === null || subjectAchievements[0]?.average === undefined
                    ? '—'
                    : `${subjectAchievements[0].average.toFixed(1)}/10`}
                </strong>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Điểm TB bài tập', average: assessmentAverages.assignments },
                  { label: 'Điểm TB bài kiểm tra', average: assessmentAverages.exams },
                  { label: 'Điểm TB chuyên cần (CC)', average: attendanceAverage },
                ].map(({ label, average }) => {
                  const standing = scoreStanding(average);
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-700">{label}</span>
                        <strong className="tabular-nums text-slate-700">
                          {average === null ? 'Chưa có dữ liệu' : `${average.toFixed(1)}/10`}
                        </strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-[width] ${average === null ? 'bg-slate-300' : standing.bar}`}
                          style={{ width: `${average === null ? 0 : Math.min(100, Math.max(0, average * 10))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                  <h3 className="text-sm font-bold text-blue-900">3 bài tập gần nhất</h3>
                  {recentSubjectAssignments.length ? (
                    <ul className="mt-2 space-y-2">
                      {recentSubjectAssignments.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2 border-t border-blue-200/70 pt-2 first:border-0 first:pt-0">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-800" title={item.title}>{item.title}</p>
                            <p className="mt-0.5 text-[10px] text-blue-800/70">
                              {new Date(item.gradedAt ?? item.dueAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </p>
                          </div>
                          <strong className={`shrink-0 text-sm font-bold tabular-nums ${scoreStanding(item.score).color}`}>
                            {item.score === null ? '—' : `${item.score.toFixed(1)}/10`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-blue-900/70">Chưa có bài tập được chấm.</p>
                  )}
                </section>

                <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                  <h3 className="text-sm font-bold text-blue-900">3 bài kiểm tra gần nhất</h3>
                  {recentSubjectExams.length ? (
                    <ul className="mt-2 space-y-2">
                      {recentSubjectExams.map(({ exam, score }) => (
                        <li key={exam.sessionId} className="flex items-start justify-between gap-2 border-t border-blue-200/70 pt-2 first:border-0 first:pt-0">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-800" title={exam.title}>{exam.title}</p>
                            <p className="mt-0.5 text-[10px] text-blue-800/70">
                              {new Date(exam.grade.gradedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </p>
                          </div>
                          <strong className={`shrink-0 text-sm font-bold tabular-nums ${scoreStanding(score).color}`}>
                            {score.toFixed(1)}/10
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-blue-900/70">Chưa có bài kiểm tra được công bố điểm.</p>
                  )}
                </section>
              </div>
            </div>
          ) : subjectAchievements.length ? (
            <div className="mt-4 space-y-3">
              {subjectAchievements.map((item) => {
                const standing = scoreStanding(item.average);
                return (
                  <div key={item.subject}>
                    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_6.5rem_3.5rem_4.25rem] items-center gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{item.subject}</span>
                      <span className={`justify-self-center whitespace-nowrap rounded-full px-2 py-1 text-center text-[10px] font-semibold ${standing.badge}`}>{standing.label}</span>
                      <span className="text-center text-[10px] text-slate-500">{item.count} bài</span>
                      <strong className="text-right tabular-nums text-slate-800">{item.average === null ? '—' : `${item.average.toFixed(1)}/10`}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${standing.bar}`}
                        style={{ width: `${item.average === null ? 0 : Math.min(100, Math.max(0, item.average * 10))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Chưa có dữ liệu môn học trong phạm vi đang chọn." />
          )}
        </article>}

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-extrabold text-slate-900">Lịch sử bài làm &amp; điểm TBM</h2>
              <button
                type="button"
                onClick={() => setChartExpanded((expanded) => !expanded)}
                aria-label={chartExpanded ? 'Thoát phóng to biểu đồ' : 'Phóng to biểu đồ'}
                title={chartExpanded ? 'Thoát phóng to' : 'Phóng to biểu đồ'}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {chartExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!selectedSubject ? (
                <div role="group" aria-label="Chọn cách hiển thị điểm các môn" className="flex rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    aria-pressed={allSubjectsChartMode === 'subjects'}
                    onClick={() => {
                      setAllSubjectsChartMode('subjects');
                      setHistoryOpen(false);
                    }}
                    className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${allSubjectsChartMode === 'subjects' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Từng môn
                  </button>
                  <button
                    type="button"
                    aria-pressed={allSubjectsChartMode === 'overall'}
                    onClick={() => {
                      setAllSubjectsChartMode('overall');
                      setHistoryOpen(false);
                    }}
                    className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${allSubjectsChartMode === 'overall' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    TBM chung
                  </button>
                </div>
              ) : (
                <div role="group" aria-label="Lọc lịch sử kết quả" className="flex rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    aria-pressed={historyFilter === 'completed'}
                    onClick={() => {
                      setHistoryFilter('completed');
                      setHistoryOpen(false);
                    }}
                    className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${historyFilter === 'completed' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Bài đã làm
                  </button>
                  <button
                    type="button"
                    aria-pressed={historyFilter === 'average'}
                    onClick={() => {
                      setHistoryFilter('average');
                      setHistoryOpen(false);
                    }}
                    className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${historyFilter === 'average' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Điểm TBM
                  </button>
                </div>
              )}
              {(selectedSubject
                ? (historyFilter === 'completed' ? chartAssessments : chartAverageHistory).length > 8
                : displayedChartSeries.some((series) => series.points.length > 8)) && (
                <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="text-xs font-semibold text-violet-700">
                  {historyOpen ? 'Thu gọn' : 'Xem đầy đủ'}
                </button>
              )}
            </div>
          </div>
          {!selectedSubject ? (
            <AssessmentTrendChart
              items={[]}
              series={displayedChartSeries.map((series) => ({
                ...series,
                points: historyOpen ? series.points : series.points.slice(-8),
              }))}
              legend={allSubjectsChartMode === 'subjects' ? 'Điểm TBM theo môn' : 'Điểm trung bình các môn'}
              empty="Chưa có lịch sử điểm TBM trong phạm vi đang chọn."
            />
          ) : displayedHistoryFilter === 'completed' ? (
            <>
              <AssessmentTrendChart
                items={historyOpen ? chartAssessments : chartAssessments.slice(-8)}
                legend="Bài tập / Bài thi"
                empty="Chưa có bài tập hoặc bài thi đã chấm trong phạm vi đang chọn."
              />
            </>
          ) : (
            <AssessmentTrendChart
              items={historyOpen ? chartAverageHistory : chartAverageHistory.slice(-8)}
              legend="Điểm trung bình môn đã lưu"
              empty="Chưa có lịch sử điểm trung bình môn được lưu cho môn và học kỳ này."
            />
          )}
        </article>
      </section>

    </main>
  );
}

function AssessmentTrendChart({
  items,
  series,
  legend,
  empty,
}: {
  items: ScoredAssessment[];
  series?: ChartSeries[];
  legend: string;
  empty: string;
}) {
  const chartViewport = useChartViewport(600, 28, 580);
  const visibleSeries = series?.filter((item) => item.points.length > 0) ?? [];
  if (!items.length && !visibleSeries.length) {
    return <p className="mt-4 text-xs text-slate-500">{empty}</p>;
  }

  if (visibleSeries.length) {
    const timestamps = [...new Set(visibleSeries.flatMap((item) => item.points.map((point) => point.recordedAt)))]
      .map((recordedAt) => Date.parse(recordedAt))
      .filter(Number.isFinite)
      .sort((first, second) => first - second);
    if (!timestamps.length) return <p className="mt-4 text-xs text-slate-500">{empty}</p>;
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const xForTimestamp = (timestamp: number) => firstTimestamp === lastTimestamp
      ? 304
      : 52 + ((timestamp - firstTimestamp) / (lastTimestamp - firstTimestamp)) * 504;
    const dateTicks = [...new Set([timestamps[0], timestamps[Math.floor((timestamps.length - 1) / 2)], timestamps[timestamps.length - 1]])];
    return (
      <div className="mt-3">
        <svg
          viewBox="0 0 600 260"
          role="img"
          aria-label={`Diễn biến ${legend.toLocaleLowerCase('vi')}`}
          className={`block h-auto w-full touch-pan-y ${chartViewport.cursorClass}`}
          onWheel={chartViewport.onWheel}
          onPointerDown={chartViewport.onPointerDown}
          onPointerMove={chartViewport.onPointerMove}
          onPointerUp={chartViewport.onPointerUp}
          onPointerCancel={chartViewport.onPointerCancel}
        >
          <defs>
            <clipPath id={chartViewport.clipId}>
              <rect x="28" y="16" width="552" height="226" />
            </clipPath>
          </defs>
          {[28, 120, 212].map((y, index) => (
            <g key={y}>
              <line x1="28" y1={y} x2="580" y2={y} stroke="#e2e8f0" strokeDasharray={index === 2 ? undefined : '4 5'} />
              <text x="20" y={y + 4} textAnchor="end" fill="#64748b" fontSize="13">{10 - index * 5}</text>
            </g>
          ))}
          <g clipPath={`url(#${chartViewport.clipId})`}>
          {visibleSeries.map((item) => {
            const plotted = item.points.flatMap((point) => {
              const timestamp = Date.parse(point.recordedAt);
              if (!Number.isFinite(timestamp) || !isValidOfficialAverage(point.score)) return [];
              return [{ ...point, x: chartViewport.mapX(xForTimestamp(timestamp)), y: 212 - (point.score / 10) * 184 }];
            });
            return (
              <g key={item.id}>
                {plotted.length > 1 && (
                  <polyline
                    points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {plotted.map((point, index) => (
                  <g key={`${item.id}-${point.recordedAt}-${index}`}>
                    <circle cx={point.x} cy={point.y} r="5" fill={item.color} />
                    <circle cx={point.x} cy={point.y} r="10" fill="transparent" pointerEvents="all">
                      <title>{`${item.label}: ${point.score.toFixed(1)}/10 · ${new Date(point.recordedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`}</title>
                    </circle>
                  </g>
                ))}
              </g>
            );
          })}
          {dateTicks.map((timestamp) => (
            <text key={timestamp} x={chartViewport.mapX(xForTimestamp(timestamp))} y="240" textAnchor="middle" fill="#64748b" fontSize="12">
              {new Date(timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            </text>
          ))}
          </g>
        </svg>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-slate-700">
          {visibleSeries.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const points = items.map((item, index) => {
    const x = items.length === 1 ? 300 : 52 + (index * 496) / (items.length - 1);
    const ratio = scorePercent(item.score, item.maxScore) ?? 0;
    const y = 212 - (ratio / 100) * 184;
    const scoreLabelY = y - 12 >= 40 ? y - 12 : y + 22;
    const date = item.gradedAt ? new Date(item.gradedAt) : null;
    return {
      ...item,
      x,
      y,
      scoreLabelY,
      ratio,
      dateLabel: date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : '',
    };
  });

  return (
    <div className="mt-3">
      <svg
        viewBox="0 0 600 260"
        role="img"
        aria-label={`Diễn biến ${legend.toLocaleLowerCase('vi')}`}
        className={`block h-auto w-full touch-pan-y ${chartViewport.cursorClass}`}
        onWheel={chartViewport.onWheel}
        onPointerDown={chartViewport.onPointerDown}
        onPointerMove={chartViewport.onPointerMove}
        onPointerUp={chartViewport.onPointerUp}
        onPointerCancel={chartViewport.onPointerCancel}
      >
        <defs>
          <clipPath id={chartViewport.clipId}>
            <rect x="28" y="16" width="552" height="226" />
          </clipPath>
        </defs>
        {[28, 120, 212].map((y, index) => (
          <g key={y}>
            <line x1="28" y1={y} x2="580" y2={y} stroke="#e2e8f0" strokeDasharray={index === 2 ? undefined : '4 5'} />
            <text x="20" y={y + 4} textAnchor="end" fill="#64748b" fontSize="13">{10 - index * 5}</text>
          </g>
        ))}
        <g clipPath={`url(#${chartViewport.clipId})`}>
        {points.length > 1 && (
          <polyline
            points={points.map((point) => `${chartViewport.mapX(point.x)},${point.y}`).join(' ')}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((point) => (
          <g key={point.id}>
            {point.kind === 'Bài thi' ? (
              <>
                <circle cx={chartViewport.mapX(point.x)} cy={point.y} r="10" fill="#fff7ed" stroke="#f59e0b" strokeWidth="1.5" />
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
              <circle cx={chartViewport.mapX(point.x)} cy={point.y} r="5" fill="#7c3aed" />
            )}
            <circle cx={chartViewport.mapX(point.x)} cy={point.y} r="10" fill="transparent" pointerEvents="all">
              <title>{point.title}</title>
            </circle>
            <text x={chartViewport.mapX(point.x)} y={point.scoreLabelY} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="700">
              {point.score.toFixed(1)}
            </text>
            <text x={chartViewport.mapX(point.x)} y="240" textAnchor="middle" fill="#64748b" fontSize="12">{point.dateLabel}</text>
          </g>
        ))}
        </g>
      </svg>
      <div className="flex justify-center text-sm text-slate-600">
        {legend === 'Bài tập / Bài thi' ? (
          <span className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />Bài tập</span>
            <span className="inline-flex items-center gap-1.5 text-amber-700"><span aria-hidden="true">★</span>Bài thi</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />{legend}</span>
        )}
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  tone,
  items,
  progress,
  onPractice,
  empty,
}: {
  title: string;
  tone: 'green' | 'red';
  items: Array<{ title: string; text: string; ids: string[] }>;
  progress: StudentProgressData | null;
  onPractice?: (topic: string, evidenceIds: string[]) => void;
  empty: string;
}) {
  const green = tone === 'green';
  return (
    <section className={`rounded-lg border p-3 ${green ? 'border-emerald-200 bg-emerald-50/80' : 'border-rose-200 bg-rose-50/80'}`}>
      <h3 className={`flex items-center gap-1.5 text-xs font-bold ${green ? 'text-emerald-800' : 'text-rose-800'}`}>
        {green ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="border-t border-black/5 pt-2 first:border-0 first:pt-0">
              <h4 className={`text-xs font-bold ${green ? 'text-emerald-950' : 'text-rose-950'}`}>{item.title}</h4>
              {item.text && <p className="mt-1 text-[11px] leading-4 text-slate-700">{item.text}</p>}
              <EvidenceList ids={item.ids} progress={progress} />
              {!green && onPractice && (
                <button
                  type="button"
                  onClick={() => onPractice(item.title, item.ids)}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 hover:underline"
                >
                  Luyện tập chủ đề này <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[11px] leading-4 text-slate-600">{empty}</p>}
    </section>
  );
}

function LongTermPlan({
  stages,
  recommendations,
  progress,
  onOpenResource,
}: {
  stages: OrderedPlanStage[];
  recommendations: PriorityRecommendation[];
  progress: StudentProgressData | null;
  onOpenResource: (subject: string, topic: string) => void;
}) {
  if (!stages.length) {
    return (
      <div className="mt-2">
        <p className="text-xs leading-5 text-slate-500">Chưa có dữ liệu chia kế hoạch thành các giai đoạn dài hạn.</p>
      </div>
    );
  }

  const assignedRecommendations = new Set(stages.flatMap((stage) => stage.relatedRecommendations.map((item) => item.action)));
  const remainingRecommendations = recommendations.filter((item) => !assignedRecommendations.has(item.action));
  return (
    <div className="mt-3">
      <ol className="space-y-0">
        {stages.map((stage, index) => {
          const priority = stage.relatedRecommendations[0]?.priority;
          const mergedActions = [
            ...stage.relatedRecommendations.map((item) => item.action),
            ...stage.actions.filter((action) => !stage.relatedRecommendations.some((item) => item.action === action)),
          ];
          const evidenceIds = [...new Set([
            ...stage.evidenceIds,
            ...stage.relatedRecommendations.flatMap((item) => item.evidenceIds),
          ])];
          return (
            <li key={`${stage.stage}-${stage.index}`} className="relative flex gap-2.5 pb-4 last:pb-0">
              {index < stages.length - 1 && <span className="absolute -bottom-3 left-[11px] top-3 w-[2px] bg-violet-300" />}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">{index + 1}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="text-sm font-semibold text-slate-800">{stage.stage}: {stage.goal}</h4>
                  {priority && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority === 'high' ? 'bg-rose-100 text-rose-800' : priority === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {priority === 'high' ? 'Ưu tiên cao' : priority === 'medium' ? 'Ưu tiên vừa' : 'Theo dõi'}
                    </span>
                  )}
                </div>
                {mergedActions.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                    {mergedActions.map((action, actionIndex) => <li key={`${action}-${actionIndex}`}>{action}</li>)}
                  </ul>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Theo dõi tiến bộ: {stage.evaluation}</p>
                <EvidenceList ids={evidenceIds} progress={progress} />
                {stage.relatedRecommendations.flatMap((item) => item.resourceIds).map((resourceId) => {
                  const resource = progress?.resources.find((entry) => entry.id === resourceId);
                  return resource ? (
                    <button
                      key={resource.id}
                      type="button"
                      onClick={() => onOpenResource(resource.subject, resource.lesson || resource.chapter)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      <BookOpen className="h-3 w-3" /> {resource.title}
                    </button>
                  ) : null;
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {remainingRecommendations.length > 0 && (
        <div className="mt-3 border-t border-violet-100 pt-3">
          <p className="text-xs font-semibold text-slate-700">Ưu tiên bổ sung</p>
          <ol className="mt-2 space-y-2">
            {remainingRecommendations.map((item, index) => (
              <li key={`${item.action}-${index}`} className="flex gap-2 text-xs text-slate-700">
                <span className="font-bold text-violet-700">{index + 1}.</span>
                <span>{item.action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function EvidenceList({ ids, progress }: { ids: string[]; progress: StudentProgressData | null }) {
  if (!ids.length || !progress) return null;
  return (
    <p className="mt-1 text-[10px] leading-4 text-slate-500">
      Căn cứ: {ids.map((id) => evidenceLabel(id, progress)).join(' - ')}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs leading-5 text-slate-500">{text}</p>;
}
