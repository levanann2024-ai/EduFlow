import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, ClipboardList, Eye, FileText, PenLine, Plus, ShieldAlert } from 'lucide-react';
import type { Page } from '@/types';
import { AIGradingEngine } from './AIGradingEngine';
import { AppealsCenter } from './AppealsCenter';
import { ClassAnalytics } from './ClassAnalytics';
import { ExamManagement } from './ExamManagement';
import { ExamMonitor } from './ExamMonitor';
import { ExamRoomWizard } from './ExamRoomWizard';
import { demoRoomSeed, type ExamRoomRecord } from './examRoomDemoData';
import { QuestionBank } from './QuestionBank';

interface WorkspaceTab {
  page: Page;
  label: string;
  icon: typeof ClipboardList;
}

function WorkspaceTabs({
  currentPage,
  onNavigate,
  tabs,
  children,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  tabs: WorkspaceTab[];
  children: (activePage: Page) => ReactNode;
}) {
  const [activePage, setActivePage] = useState(currentPage);

  useEffect(() => {
    setActivePage(currentPage);
  }, [currentPage]);

  const selectTab = (page: Page) => {
    setActivePage(page);
    onNavigate(page);
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Các chức năng trong khu vực" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            type="button"
            aria-current={activePage === page ? 'page' : undefined}
            onClick={() => selectTab(page)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activePage === page
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
      {children(activePage)}
    </div>
  );
}

export function ExamQuestionWorkspace({
  currentPage,
  onNavigate,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">Ngân hàng câu hỏi & Đề thi</h1>
        <p className="mt-1 text-sm text-slate-600">Quản lý nội dung đã lưu để xem lại và sử dụng khi soạn bài tập, đề kiểm tra.</p>
      </header>
      <WorkspaceTabs
        currentPage={currentPage}
        onNavigate={onNavigate}
        tabs={[
          { page: 'question-bank', label: 'Ngân hàng câu hỏi', icon: ClipboardList },
          { page: 'exams', label: 'Đề thi đã lưu', icon: FileText },
        ]}
      >
        {(activePage) => activePage === 'question-bank'
          ? <QuestionBank />
          : <ExamManagement onNavigate={onNavigate} />}
      </WorkspaceTabs>
    </div>
  );
}

export function GradingAnalyticsWorkspace({
  currentPage,
  onNavigate,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <WorkspaceTabs
      currentPage={currentPage}
      onNavigate={onNavigate}
      tabs={[
        { page: 'ai-grading', label: 'Chấm bài', icon: PenLine },
        { page: 'analytics', label: 'Phân tích kết quả', icon: BarChart3 },
      ]}
    >
      {(activePage) => activePage === 'analytics' ? <ClassAnalytics /> : <AIGradingEngine />}
    </WorkspaceTabs>
  );
}

export function ProctoringWorkspace({
  currentPage,
  onNavigate,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}) {
  const [rooms, setRooms] = useState<ExamRoomRecord[]>(() => demoRoomSeed.map((room) => ({
    ...room,
    examSnapshot: { ...room.examSnapshot, questions: room.examSnapshot.questions.map((question) => ({ ...question, options: [...question.options] })) },
    settings: { ...room.settings },
    sessions: room.sessions.map((session) => ({ ...session, events: session.events.map((event) => ({ ...event })) })),
  })));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoomRecord | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const saveRoom = (room: ExamRoomRecord, publish: boolean) => {
    setRooms((current) => current.some((item) => item.id === room.id)
      ? current.map((item) => item.id === room.id ? room : item)
      : [room, ...current]);
    setFeedback(publish
      ? 'Đã tạo phòng trong bản demo frontend. Dữ liệu chưa được gửi lên máy chủ.'
      : 'Đã lưu cấu hình phòng trong bản demo frontend. Dữ liệu chỉ còn trong phiên chạy này.');
    setWizardOpen(false);
    setEditingRoom(null);
    setOpenRoomId(publish ? room.id : null);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-950">Phòng thi trực tuyến</h1>
          <p className="mt-1 text-sm text-slate-600">Cấu hình lịch thi, theo dõi phiên và xem xét sự cố.</p>
        </div>
        {currentPage === 'exam-monitor' && <button type="button" onClick={() => { setEditingRoom(null); setWizardOpen(true); setFeedback(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="h-4 w-4" /> Tạo phòng thi</button>}
      </header>
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{feedback}</p>}
      <nav aria-label="Các chức năng trong khu vực" className="flex w-fit max-w-full flex-wrap gap-1 border-b border-slate-200">
        {[
          { page: 'exam-monitor' as Page, label: 'Giám sát phòng thi', icon: Eye },
          { page: 'appeals' as Page, label: 'Kháng nghị & sự cố', icon: ShieldAlert },
        ].map(({ page, label, icon: Icon }) => <button key={page} type="button" aria-current={currentPage === page ? 'page' : undefined} onClick={() => onNavigate(page)} className={`inline-flex min-h-10 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition ${currentPage === page ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </nav>
      <div className={currentPage === 'appeals' ? 'hidden' : ''}>
        <ExamMonitor
          rooms={rooms}
          openRoomId={openRoomId}
          onCreateRoom={() => { setEditingRoom(null); setWizardOpen(true); setFeedback(''); }}
          onEditDraft={(room) => { setEditingRoom(room); setWizardOpen(true); setFeedback(''); }}
          onUpdateRoom={(updatedRoom) => setRooms((current) => current.map((room) => room.id === updatedRoom.id ? updatedRoom : room))}
          onOpenAppeals={() => onNavigate('appeals')}
        />
      </div>
      <div className={currentPage === 'appeals' ? '' : 'hidden'}><AppealsCenter /></div>
      {wizardOpen && <ExamRoomWizard initialRoom={editingRoom} onCancel={() => { setWizardOpen(false); setEditingRoom(null); }} onSave={saveRoom} onNavigate={onNavigate} />}
    </div>
  );
}
