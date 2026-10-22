import { useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CircleAlert,
  Clock3,
  Search,
} from 'lucide-react';
import { getSavedItems, saveItem } from './savedItems';
import { StudentSubjectCard } from './StudentSubjectCard';

interface MyClassesProps {
  onOpenSchedule: () => void;
  initialSubjectCode: string | null;
  initialSubjectView: 'lessons' | 'assignments' | null;
  initialSubjectTopic: string | null;
}

type Semester = 'Học kỳ 1' | 'Học kỳ 2';
type SubjectView =
  | { type: 'lesson'; index: number }
  | { type: 'assignment'; index: number };

interface SubjectAssignment {
  title: string;
  due: string;
  status: 'Chưa làm' | 'Đang làm';
}

interface ExerciseQuestion {
  prompt: string;
  options: string[];
  answer: number;
}

interface Subject {
  name: string;
  code: string;
  teacher: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  resources: number;
  pendingAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
  assignments: SubjectAssignment[];
  exerciseQuestions: ExerciseQuestion[];
  lessons: Record<Semester, string[]>;
  theme: string;
}

const subjects: Subject[] = [
  {
    name: 'Toán học',
    code: 'TOAN10',
    teacher: 'Cô Nguyễn Hà',
    progress: 51,
    completedLessons: 18,
    totalLessons: 35,
    resources: 12,
    pendingAssignments: 3,
    completedAssignments: 2,
    overdueAssignments: 1,
    assignments: [
      { title: 'Hàm số bậc hai', due: '22/10/2026 · 20:00', status: 'Chưa làm' },
      { title: 'Đồ thị hàm số', due: '23/10/2026 · 20:00', status: 'Chưa làm' },
      { title: 'Phương trình bậc hai', due: '24/10/2026 · 20:00', status: 'Đang làm' },
    ],
    exerciseQuestions: [
      { prompt: 'Đồ thị y = 2x² − 3x + 1 mở về phía nào?', options: ['Phía trên', 'Phía dưới', 'Không có đồ thị'], answer: 0 },
      { prompt: 'Trục đối xứng của y = x² − 4x + 1 là đường thẳng nào?', options: ['x = 2', 'x = −2', 'x = 4'], answer: 0 },
      { prompt: 'Nghiệm của phương trình x² − 5x + 6 = 0 là gì?', options: ['1 và 6', '2 và 3', '−2 và −3'], answer: 1 },
    ],
    lessons: {
      'Học kỳ 1': ['Hàm số bậc hai', 'Phương trình và hệ phương trình', 'Bất phương trình'],
      'Học kỳ 2': ['Vectơ và các phép toán', 'Phương pháp tọa độ trong mặt phẳng', 'Đại số tổ hợp'],
    },
    theme: 'from-blue-600 to-indigo-600',
  },
  {
    name: 'Ngữ văn',
    code: 'VAN10',
    teacher: 'Thầy Lê Minh',
    progress: 57,
    completedLessons: 20,
    totalLessons: 35,
    resources: 10,
    pendingAssignments: 0,
    completedAssignments: 1,
    overdueAssignments: 0,
    assignments: [],
    exerciseQuestions: [],
    lessons: {
      'Học kỳ 1': ['Truyện dân gian Việt Nam', 'Thực hành tiếng Việt', 'Viết bài văn nghị luận'],
      'Học kỳ 2': ['Thơ và truyện hiện đại', 'Văn bản thông tin', 'Thực hành viết và nói'],
    },
    theme: 'from-orange-500 to-amber-500',
  },
  {
    name: 'Hóa học',
    code: 'HOA10',
    teacher: 'Cô Thu Dung',
    progress: 43,
    completedLessons: 12,
    totalLessons: 28,
    resources: 6,
    pendingAssignments: 1,
    completedAssignments: 1,
    overdueAssignments: 0,
    assignments: [
      { title: 'Cấu tạo nguyên tử', due: '25/10/2026 · 17:00', status: 'Chưa làm' },
    ],
    exerciseQuestions: [
      { prompt: 'Nguyên tử trung hòa có số proton bằng 11 thì có bao nhiêu electron?', options: ['10', '11', '12'], answer: 1 },
    ],
    lessons: {
      'Học kỳ 1': ['Cấu tạo nguyên tử', 'Bảng tuần hoàn các nguyên tố', 'Liên kết hóa học'],
      'Học kỳ 2': ['Phản ứng oxi hóa – khử', 'Năng lượng hóa học', 'Tốc độ phản ứng'],
    },
    theme: 'from-rose-500 to-pink-500',
  },
  {
    name: 'Vật lý',
    code: 'LY10',
    teacher: 'Thầy Trần Nam',
    progress: 50,
    completedLessons: 14,
    totalLessons: 28,
    resources: 8,
    pendingAssignments: 2,
    completedAssignments: 2,
    overdueAssignments: 1,
    assignments: [
      { title: 'Định luật II Newton', due: '23/10/2026 · 23:00', status: 'Đang làm' },
      { title: 'Lực ma sát', due: '24/10/2026 · 20:00', status: 'Chưa làm' },
    ],
    exerciseQuestions: [
      { prompt: 'Một vật chịu hợp lực 10 N, có khối lượng 2 kg. Gia tốc của vật là bao nhiêu?', options: ['5 m/s²', '12 m/s²', '20 m/s²'], answer: 0 },
      { prompt: 'Lực ma sát trượt thường có hướng như thế nào?', options: ['Cùng chiều chuyển động', 'Ngược chiều chuyển động tương đối', 'Luôn hướng thẳng đứng'], answer: 1 },
    ],
    lessons: {
      'Học kỳ 1': ['Chuyển động thẳng', 'Lực và định luật Newton', 'Lực ma sát'],
      'Học kỳ 2': ['Năng lượng và công', 'Động lượng', 'Chuyển động tròn'],
    },
    theme: 'from-violet-600 to-purple-600',
  },
  {
    name: 'Tiếng Anh',
    code: 'ANH10',
    teacher: 'Cô Phạm Linh',
    progress: 78,
    completedLessons: 22,
    totalLessons: 28,
    resources: 10,
    pendingAssignments: 1,
    completedAssignments: 2,
    overdueAssignments: 0,
    assignments: [
      { title: 'Unit 4 · For a better community', due: '26/10/2026 · 20:00', status: 'Chưa làm' },
    ],
    exerciseQuestions: [
      { prompt: 'Chọn câu đúng: “They ___ part in a clean-up activity every month.”', options: ['take', 'takes', 'taking'], answer: 0 },
    ],
    lessons: {
      'Học kỳ 1': ['Unit 3 · Music', 'Unit 4 · For a better community', 'Review · Units 1–4'],
      'Học kỳ 2': ['Unit 6 · Gender equality', 'Unit 7 · Viet Nam and international organisations', 'Review · Units 5–8'],
    },
    theme: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Tin học',
    code: 'TIN10',
    teacher: 'Cô Hoàng Mai',
    progress: 91,
    completedLessons: 32,
    totalLessons: 35,
    resources: 8,
    pendingAssignments: 0,
    completedAssignments: 1,
    overdueAssignments: 0,
    assignments: [],
    exerciseQuestions: [],
    lessons: {
      'Học kỳ 1': ['Thông tin và xử lý thông tin', 'Mạng máy tính và Internet', 'Thực hành tìm kiếm thông tin'],
      'Học kỳ 2': ['Đạo đức và pháp luật trong môi trường số', 'Ứng dụng tin học', 'Giải quyết vấn đề với máy tính'],
    },
    theme: 'from-cyan-500 to-sky-600',
  },
  {
    name: 'Sinh học',
    code: 'SINH10',
    teacher: 'Cô Đặng Vy',
    progress: 63,
    completedLessons: 22,
    totalLessons: 35,
    resources: 8,
    pendingAssignments: 0,
    completedAssignments: 1,
    overdueAssignments: 0,
    assignments: [],
    exerciseQuestions: [],
    lessons: {
      'Học kỳ 1': ['Tế bào nhân thực', 'Trao đổi chất ở tế bào', 'Chu kì tế bào và phân bào'],
      'Học kỳ 2': ['Vi sinh vật và virus', 'Sinh trưởng ở thực vật', 'Sinh thái học'],
    },
    theme: 'from-lime-500 to-green-600',
  },
  {
    name: 'Lịch sử',
    code: 'SU10',
    teacher: 'Thầy Phan An',
    progress: 69,
    completedLessons: 24,
    totalLessons: 35,
    resources: 7,
    pendingAssignments: 1,
    completedAssignments: 1,
    overdueAssignments: 0,
    assignments: [
      { title: 'Văn minh cổ đại', due: '29/10/2026 · 20:00', status: 'Chưa làm' },
    ],
    exerciseQuestions: [
      { prompt: 'Các nền văn minh cổ đại phương Đông thường hình thành bên cạnh đâu?', options: ['Các dòng sông lớn', 'Sa mạc khô hạn', 'Đảo xa bờ'], answer: 0 },
    ],
    lessons: {
      'Học kỳ 1': ['Văn minh cổ đại', 'Các quốc gia cổ đại phương Đông', 'Một số nền văn minh phương Tây'],
      'Học kỳ 2': ['Các cuộc cách mạng công nghiệp', 'Văn minh Đông Nam Á', 'Một số nền văn minh trên đất Việt'],
    },
    theme: 'from-amber-500 to-yellow-600',
  },
  {
    name: 'Địa lý',
    code: 'DIA10',
    teacher: 'Cô Bùi Lan',
    progress: 0,
    completedLessons: 0,
    totalLessons: 1,
    resources: 1,
    pendingAssignments: 0,
    completedAssignments: 0,
    overdueAssignments: 0,
    assignments: [],
    exerciseQuestions: [],
    lessons: {
      'Học kỳ 1': ['Địa lý dân cư'],
      'Học kỳ 2': ['Địa lý dân cư'],
    },
    theme: 'from-teal-500 to-cyan-600',
  },
  {
    name: 'Giáo dục thể chất',
    code: 'GDTC10',
    teacher: 'Thầy Vũ Long',
    progress: 0,
    completedLessons: 0,
    totalLessons: 1,
    resources: 1,
    pendingAssignments: 0,
    completedAssignments: 0,
    overdueAssignments: 0,
    assignments: [],
    exerciseQuestions: [],
    lessons: {
      'Học kỳ 1': ['Bóng chuyền cơ bản'],
      'Học kỳ 2': ['Bóng chuyền cơ bản'],
    },
    theme: 'from-rose-500 to-orange-500',
  },
];

function findTopicIndex(items: string[], topic: string | null) {
  if (!topic || items.length === 0) return 0;
  const normalize = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi');
  const normalizedTopic = normalize(topic);
  const exactMatch = items.findIndex((item) => normalize(item) === normalizedTopic);
  if (exactMatch >= 0) return exactMatch;

  const ignoredWords = new Set(['kiem', 'tra', 'tiet', 'bai', 'tap', 'han', 'nop', 'phieu', 'kiemtra']);
  const topicWords = normalizedTopic.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !ignoredWords.has(word));
  const rankedMatches = items
    .map((item, index) => ({
      index,
      score: topicWords.filter((word) => normalize(item).includes(word)).length,
    }))
    .sort((first, second) => second.score - first.score);
  return rankedMatches[0]?.score ? rankedMatches[0].index : 0;
}

export function MyClasses({ onOpenSchedule, initialSubjectCode, initialSubjectView, initialSubjectTopic }: MyClassesProps) {
  const initialSubject = subjects.find((subject) => subject.code === initialSubjectCode) ?? null;
  const [semester, setSemester] = useState<Semester>('Học kỳ 1');
  const [query, setQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(initialSubject);
  const [selectedSubjectView, setSelectedSubjectView] = useState<SubjectView>(() => {
    if (initialSubjectView === 'assignments') {
      return { type: 'assignment', index: findTopicIndex(initialSubject?.assignments.map((assignment) => assignment.title) ?? [], initialSubjectTopic) };
    }
    return { type: 'lesson', index: findTopicIndex(initialSubject?.lessons['Học kỳ 1'] ?? [], initialSubjectTopic) };
  });
  const [savingError, setSavingError] = useState('');
  const [savedResourceIds, setSavedResourceIds] = useState(
    () => new Set(getSavedItems().filter((item) => item.type === 'resource').map((item) => item.id)),
  );

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    return subjects.filter((subject) =>
      `${subject.name} ${subject.code} ${subject.teacher}`.toLocaleLowerCase('vi').includes(normalizedQuery),
    );
  }, [query]);

  const pendingAssignments = subjects.reduce((total, subject) => total + subject.pendingAssignments, 0);
  const completedAssignments = subjects.reduce((total, subject) => total + subject.completedAssignments, 0);
  const overdueAssignments = subjects.reduce((total, subject) => total + subject.overdueAssignments, 0);
  const handleSaveLesson = (subject: Subject, lesson: string, index: number) => {
    const id = `resource-${subject.code}-${semester}-${index}`;
    if (savedResourceIds.has(id)) return;
    try {
      saveItem({
        id,
        type: 'resource',
        title: lesson,
        subject: subject.name,
        savedAt: new Date().toISOString(),
      });
      setSavedResourceIds((current) => new Set(current).add(id));
      setSavingError('');
    } catch (saveError) {
      setSavingError(saveError instanceof Error ? saveError.message : 'Không thể lưu bài học.');
    }
  };

  if (selectedSubject) {
    return (
      <SubjectLearningView
        subject={selectedSubject}
        semester={semester}
        selectedView={selectedSubjectView}
        savedResourceIds={savedResourceIds}
        savingError={savingError}
        onBack={() => setSelectedSubject(null)}
        onSemesterChange={(nextSemester) => {
          setSemester(nextSemester);
          setSelectedSubjectView({ type: 'lesson', index: 0 });
        }}
        onSelectView={setSelectedSubjectView}
        onSaveLesson={handleSaveLesson}
      />
    );
  }

  return (
    <div className="animate-fadeIn space-y-7 text-base">
      <section className="flex justify-end">
        <label className="flex items-center gap-2 text-base font-medium text-slate-600">
          <span className="whitespace-nowrap">Học kỳ</span>
          <select className="input-field min-w-40 px-3 py-2.5 text-base" value={semester} onChange={(event) => setSemester(event.target.value as Semester)}>
            <option>Học kỳ 1</option>
            <option>Học kỳ 2</option>
          </select>
        </label>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Tổng quan bài tập">
        <AssignmentStatCard label="Cần làm / Chưa nộp" value={pendingAssignments} icon={Clock3} tone="amber" />
        <AssignmentStatCard label="Đã hoàn thành / Đã nộp" value={completedAssignments} icon={CheckCircle2} tone="emerald" />
        <AssignmentStatCard label="Quá hạn" value={overdueAssignments} icon={CircleAlert} tone="rose" />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{filteredSubjects.length} môn học</h3>
          </div>
        </div>

        {filteredSubjects.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredSubjects.map((subject) => {
              return (
                <StudentSubjectCard
                  key={subject.code}
                  artworkKey={subject.code}
                  name={`${subject.name} 10`}
                  lessons={`${subject.completedLessons}/${subject.totalLessons}`}
                  resources={subject.resources}
                  assignments={subject.pendingAssignments}
                  progress={subject.progress}
                            onLessonsClick={onOpenSchedule}
                            onResourcesClick={() => {
                              setSelectedSubject(subject);
                              setSelectedSubjectView({ type: 'lesson', index: 0 });
                            }}
                            onAssignmentsClick={() => {
                              setSelectedSubject(subject);
                              setSelectedSubjectView({ type: 'assignment', index: 0 });
                            }}
                />
              );
            })}
          </div>
        ) : (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <Search className="h-8 w-8 text-slate-300" />
            <p className="mt-3 font-medium text-slate-700">Không tìm thấy môn học phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Thử tìm bằng tên môn, mã môn hoặc tên giáo viên nhé.</p>
          </div>
        )}
      </section>

    </div>
  );
}

const lessonGuides: Record<string, { summary: string; points: string[]; example: string }> = {
  TOAN10: {
    summary: 'Ôn lại khái niệm chính, nhận biết dạng bài và thử áp dụng vào ví dụ.',
    points: ['Xác định dữ kiện và yêu cầu của bài toán.', 'Chọn công thức hoặc cách biến đổi phù hợp.', 'Thử lại kết quả bằng cách thay ngược vào đề.'],
    example: 'Với hàm số bậc hai, hãy xác định hệ số a trước để biết đồ thị mở lên hay mở xuống.',
  },
  VAN10: {
    summary: 'Đọc văn bản, tìm ý chính và dùng dẫn chứng để giải thích nhận xét.',
    points: ['Xác định nội dung và cảm xúc chủ đạo.', 'Chú ý chi tiết, hình ảnh hoặc từ ngữ nổi bật.', 'Nêu nhận xét kèm dẫn chứng từ văn bản.'],
    example: 'Khi phân tích nhân vật, chọn một hành động tiêu biểu rồi giải thích hành động ấy cho thấy điều gì.',
  },
  HOA10: {
    summary: 'Kết nối cấu tạo hạt, đặc điểm nguyên tố và cách chúng tham gia phản ứng.',
    points: ['Đọc số hiệu nguyên tử để xác định số proton.', 'Với nguyên tử trung hòa, số electron bằng số proton.', 'Dùng electron lớp ngoài cùng để dự đoán liên kết.'],
    example: 'Nguyên tử có 11 proton là nguyên tố Natri; nguyên tử trung hòa đó có 11 electron.',
  },
  LY10: {
    summary: 'Tóm tắt hiện tượng bằng sơ đồ, đại lượng và đơn vị trước khi tính.',
    points: ['Vẽ lực tác dụng lên vật.', 'Chọn chiều dương và ghi rõ đơn vị.', 'Thay số vào công thức sau khi đã đổi đơn vị.'],
    example: 'Nếu hợp lực cùng chiều chuyển động, vật tăng tốc; gia tốc được tính từ hợp lực chia cho khối lượng.',
  },
  ANH10: {
    summary: 'Học từ vựng trong ngữ cảnh, sau đó luyện dùng từ trong câu ngắn.',
    points: ['Đoán nghĩa từ dựa vào câu xung quanh.', 'Ghi lại cụm từ thay vì chỉ ghi từ đơn.', 'Đọc câu thành tiếng để nhớ cách dùng.'],
    example: 'Viết một câu ngắn về hoạt động cộng đồng bằng từ vựng mới của bài.',
  },
  TIN10: {
    summary: 'Hiểu cách thông tin được biểu diễn, lưu trữ và xử lý bằng máy tính.',
    points: ['Phân biệt dữ liệu đầu vào và thông tin thu được.', 'Chọn công cụ phù hợp với nhiệm vụ.', 'Kiểm tra kết quả trước khi chia sẻ.'],
    example: 'Bảng điểm là dữ liệu; điểm trung bình được tính từ bảng là thông tin đã xử lý.',
  },
  SINH10: {
    summary: 'Quan sát cấu trúc, gọi tên thành phần và liên hệ với chức năng.',
    points: ['Nêu đặc điểm dễ nhận biết của đối tượng.', 'Ghép mỗi cấu trúc với chức năng tương ứng.', 'Dùng hình vẽ để ghi nhớ các thành phần.'],
    example: 'Màng tế bào giúp kiểm soát các chất đi vào và đi ra khỏi tế bào.',
  },
  SU10: {
    summary: 'Đặt sự kiện vào đúng bối cảnh thời gian, địa điểm và nguyên nhân.',
    points: ['Ghi lại mốc thời gian chính.', 'Phân biệt nguyên nhân với kết quả.', 'So sánh điểm giống và khác giữa các nền văn minh.'],
    example: 'Khi học về một nền văn minh cổ đại, hãy liên hệ điều kiện tự nhiên với cách cư dân sinh sống.',
  },
  DIA10: {
    summary: 'Đọc số liệu và bản đồ để nhận biết đặc điểm, phân bố dân cư.',
    points: ['Xác định đơn vị và phạm vi của số liệu.', 'So sánh mật độ dân cư giữa các khu vực.', 'Dùng chú giải để đọc đúng bản đồ.'],
    example: 'Khi so sánh dân cư các vùng, hãy nêu khu vực đông dân và dẫn số liệu hoặc ký hiệu bản đồ làm căn cứ.',
  },
  GDTC10: {
    summary: 'Luyện các kỹ thuật bóng chuyền cơ bản an toàn và phối hợp cùng đồng đội.',
    points: ['Khởi động kỹ trước khi luyện tập.', 'Giữ tư thế sẵn sàng và quan sát hướng bóng.', 'Phối hợp gọi bóng rõ ràng với đồng đội.'],
    example: 'Khi đỡ bóng, hạ thấp trọng tâm, ghép hai cẳng tay và hướng mặt phẳng tay về phía mục tiêu.',
  },
};

function SubjectLearningView({
  subject,
  semester,
  selectedView,
  savedResourceIds,
  savingError,
  onBack,
  onSemesterChange,
  onSelectView,
  onSaveLesson,
}: {
  subject: Subject;
  semester: Semester;
  selectedView: SubjectView;
  savedResourceIds: Set<string>;
  savingError: string;
  onBack: () => void;
  onSemesterChange: (semester: Semester) => void;
  onSelectView: (view: SubjectView) => void;
  onSaveLesson: (subject: Subject, lesson: string, index: number) => void;
}) {
  const lessons = subject.lessons[semester];
  const activeIndex = selectedView.type === 'lesson' ? Math.min(selectedView.index, lessons.length - 1) : 0;
  const activeLesson = lessons[activeIndex];
  const activeAssignmentIndex = selectedView.type === 'assignment' ? selectedView.index : 0;
  const activeAssignment = subject.assignments[activeAssignmentIndex];
  const guide = lessonGuides[subject.code];
  const resourceId = `resource-${subject.code}-${semester}-${activeIndex}`;
  const isSaved = savedResourceIds.has(resourceId);

  return (
    <section className="animate-fadeIn overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700">
            <ChevronLeft className="h-5 w-5" /> Môn học
          </button>
          <span className="h-6 border-l border-slate-200" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{subject.name} lớp 10</p>
            <p className="text-sm text-slate-500">{subject.code} · {subject.teacher}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span>Học kỳ</span>
          <select className="input-field min-h-11 min-w-36 px-3" value={semester} onChange={(event) => onSemesterChange(event.target.value as Semester)}>
            <option>Học kỳ 1</option>
            <option>Học kỳ 2</option>
          </select>
        </label>
      </header>

      <div className="grid min-h-[min(72vh,760px)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r sm:p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <h2>Tài liệu</h2>
              <span>{subject.progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full bg-gradient-to-r ${subject.theme}`} style={{ width: `${subject.progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-500">{subject.completedLessons}/{subject.totalLessons} tiết đã học</p>
          </div>
          <nav aria-label={`Tài liệu ${subject.name}`} className="grid max-h-[40vh] gap-1 overflow-y-auto">
            {lessons.map((lesson, index) => (
              <button
                key={lesson}
                type="button"
                onClick={() => onSelectView({ type: 'lesson', index })}
                aria-current={selectedView.type === 'lesson' && index === activeIndex ? 'page' : undefined}
                className={`flex min-h-12 items-start gap-3 border-l-2 px-3 py-2.5 text-left transition ${
                  selectedView.type === 'lesson' && index === activeIndex
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-transparent text-slate-700 hover:bg-white'
                }`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  index === activeIndex ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-500'
                }`}>{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-5">{lesson}</span>
                  <span className="mt-1 block text-xs text-slate-500">Bài đọc tự soạn · 30 phút</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Bài tập</h2>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{subject.pendingAssignments} cần làm</span>
            </div>
            {subject.assignments.length ? (
              <nav aria-label={`Bài tập ${subject.name}`} className="grid max-h-[30vh] gap-1 overflow-y-auto">
                {subject.assignments.map((assignment, index) => (
                  <button
                    key={assignment.title}
                    type="button"
                    onClick={() => onSelectView({ type: 'assignment', index })}
                    aria-current={selectedView.type === 'assignment' && activeAssignmentIndex === index ? 'page' : undefined}
                    className={`flex min-h-12 items-start gap-3 border-l-2 px-3 py-2.5 text-left transition ${
                      selectedView.type === 'assignment' && activeAssignmentIndex === index
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-transparent text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-5">{assignment.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">Bài tập · {assignment.due}</span>
                    </span>
                  </button>
                ))}
              </nav>
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">Chưa có bài cần làm.</p>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col">
          {selectedView.type === 'lesson' ? (
          <article className="flex-1 px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            <div className="mx-auto max-w-4xl">
              <p className="text-sm font-medium text-blue-700">{subject.name} lớp 10 · {semester}</p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">{activeLesson}</h1>
              <p className="mt-3 text-base text-slate-500">Bài đọc · 30 phút</p>

              {savingError && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{savingError}</p>}

              <section className="mt-8 space-y-7 text-base leading-7 text-slate-700">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Mục tiêu</h2>
                  <p className="mt-2">{guide.summary}</p>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Ghi nhớ</h2>
                  <ul className="mt-2 list-disc space-y-2 pl-6">
                    {guide.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                  <h2 className="font-bold text-blue-950">Ví dụ</h2>
                  <p className="mt-2 text-blue-900">{guide.example}</p>
                </div>
              </section>
            </div>
          </article>
          ) : activeAssignment ? (
            <section className="flex-1 px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
              <div className="mx-auto max-w-4xl">
                <p className="text-sm font-medium text-rose-700">{subject.name} lớp 10</p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Bài tập: {activeAssignment.title}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">Bài tập</span>
                  <span>{subject.exerciseQuestions.length} câu hỏi</span>
                  <span>·</span>
                  <span>{subject.assignments.length} bài cần làm</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div><span className="block text-slate-500">Điểm cao nhất</span><strong className="mt-1 block text-lg">—</strong></div>
                  <div><span className="block text-slate-500">Lượt làm bài</span><strong className="mt-1 block text-lg">0 / 3</strong></div>
                  <div><span className="block text-slate-500">Điểm đạt</span><strong className="mt-1 block text-lg">5</strong></div>
                </div>
                <p className="mt-4 border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  Làm bài để tự kiểm tra kiến thức vừa học. Có thể làm lại nhiều lần.
                </p>
                <div className="mt-6">
                  <ExerciseCard
                    key={activeAssignment.title}
                    assignment={activeAssignment}
                    question={subject.exerciseQuestions[activeAssignmentIndex]}
                    number={activeAssignmentIndex + 1}
                  />
                </div>
              </div>
            </section>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
              Môn này hiện chưa có bài tập.
            </div>
          )}
          {selectedView.type === 'lesson' && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-8 lg:px-12">
            <button
              type="button"
              onClick={() => onSaveLesson(subject, activeLesson, activeIndex)}
              disabled={isSaved}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                isSaved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {isSaved ? 'Đã lưu' : 'Lưu bài'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSelectView({ type: 'lesson', index: Math.max(0, activeIndex - 1) })}
                disabled={activeIndex === 0}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Bài trước
              </button>
              <button
                type="button"
                onClick={() => onSelectView({ type: 'lesson', index: Math.min(lessons.length - 1, activeIndex + 1) })}
                disabled={activeIndex === lessons.length - 1}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Bài tiếp theo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
          )}
        </main>
      </div>
    </section>
  );
}

function ExerciseCard({
  assignment,
  question,
  number,
}: {
  assignment: SubjectAssignment;
  question: ExerciseQuestion;
  number: number;
}) {
  const [started, setStarted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bài {number}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{assignment.title}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <Clock3 className="h-4 w-4 text-rose-600" /> Hạn nộp: {assignment.due}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${assignment.status === 'Đang làm' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
          {assignment.status}
        </span>
      </div>

      {started ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="font-medium leading-6 text-slate-800">{question.prompt}</p>
          <div className="mt-3 grid gap-2">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = selectedAnswer !== null && index === question.answer;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedAnswer(index)}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-left text-sm transition ${
                    isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : isSelected ? 'border-rose-300 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              );
            })}
          </div>
          {selectedAnswer !== null && (
            <p role="status" className={`mt-3 text-sm font-medium ${selectedAnswer === question.answer ? 'text-emerald-700' : 'text-rose-700'}`}>
              {selectedAnswer === question.answer ? 'Chính xác!' : 'Chưa đúng, thử lại nhé.'}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Bắt đầu làm bài
        </button>
      )}
    </article>
  );
}

function AssignmentStatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock3;
  tone: 'amber' | 'rose' | 'emerald';
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <article className={`flex min-h-[88px] items-center justify-between gap-3 rounded-xl border border-white px-5 py-4 shadow-sm ${tones[tone]}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Icon className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </p>
      </div>
      <p className="text-3xl font-bold leading-none">{value}</p>
    </article>
  );
}
