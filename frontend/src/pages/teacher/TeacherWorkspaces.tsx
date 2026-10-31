import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpenCheck, ClipboardList, FileText } from 'lucide-react';
import { deleteTeacherExamRoom, listTeacherExamRooms, saveTeacherExamRoom } from '@/api/schoolApi';
import type { Page } from '@/types';
import type { SavedExam } from './assessmentStorage';
import { AssignmentGradingWorkspace } from './AssignmentGradingWorkspace';
import { AppealsCenter } from './AppealsCenter';
import { ClassAnalytics } from './ClassAnalytics';
import { ExamManagement } from './ExamManagement';
import { AssignmentManagement } from './AssignmentManagement';
import { ExamMonitor } from './ExamMonitor';
import { ExamRoomWizard } from './ExamRoomWizard';
import type { ExamRoomRecord } from './examRoomDemoData';
import { QuestionBank } from './QuestionBank';

interface WorkspaceTab {
  page: Page;
  label: string;
  icon: typeof ClipboardList;
}

function WorkspaceTabs({
  currentPage,
  onNavigate,
  navigateOnTabChange = true,
  tabs,
  children,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  navigateOnTabChange?: boolean;
  tabs: WorkspaceTab[];
  children: (activePage: Page) => ReactNode;
}) {
  const [activePage, setActivePage] = useState(currentPage);

  useEffect(() => {
    setActivePage(currentPage);
  }, [currentPage]);

  const selectTab = (page: Page) => {
    setActivePage(page);
    if (navigateOnTabChange) onNavigate(page);
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
  onAssignAssignment,
  onCreateExamRoom,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onAssignAssignment: (draft: { title: string; subject: string; content: string }) => void;
  onCreateExamRoom: (exam: SavedExam) => void;
}) {
  return (
    <div className="space-y-4">
      <WorkspaceTabs
        currentPage={currentPage}
        onNavigate={onNavigate}
        navigateOnTabChange={false}
        tabs={[
          { page: 'question-bank', label: 'Ngân hàng câu hỏi', icon: ClipboardList },
          { page: 'saved-assignments', label: 'Bài tập đã lưu', icon: BookOpenCheck },
          { page: 'exams', label: 'Đề thi đã lưu', icon: FileText },
        ]}
      >
        {(activePage) => activePage === 'question-bank'
          ? <QuestionBank />
          : activePage === 'saved-assignments'
            ? <AssignmentManagement onAssignToClass={onAssignAssignment} />
            : <ExamManagement onCreateExamRoom={onCreateExamRoom} />}
      </WorkspaceTabs>
    </div>
  );
}

export function GradingAnalyticsWorkspace({
  currentPage,
}: {
  currentPage: Page;
}) {
  return currentPage === 'analytics' ? <ClassAnalytics /> : <AssignmentGradingWorkspace />;
}

export function ProctoringWorkspace({
  currentPage,
  onNavigate,
  initialExam,
  onInitialExamConsumed,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  initialExam: SavedExam | null;
  onInitialExamConsumed: () => void;
}) {
  const [rooms, setRooms] = useState<ExamRoomRecord[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoomRecord | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [wizardExam, setWizardExam] = useState<SavedExam | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const roomsRefreshInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const refreshRooms = async () => {
      if (roomsRefreshInFlight.current) return;
      roomsRefreshInFlight.current = true;
      try {
        const items = await listTeacherExamRooms<ExamRoomRecord>();
        if (active) {
          setRooms(items);
          setRoomsError('');
        }
      } catch (loadError: unknown) {
        console.error('Không thể tải phòng thi từ máy chủ.', loadError);
        if (active) setRoomsError(loadError instanceof Error ? loadError.message : 'Không thể tải phòng thi.');
      } finally {
        roomsRefreshInFlight.current = false;
        if (active) setRoomsLoading(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshRooms();
    };
    void refreshRooms();
    const intervalId = window.setInterval(refreshWhenVisible, 5_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!initialExam) return;
    setEditingRoom(null);
    setWizardExam(initialExam);
    setWizardOpen(true);
    setFeedback('');
    setError('');
    onInitialExamConsumed();
  }, [initialExam, onInitialExamConsumed]);

  const saveRoom = async (room: ExamRoomRecord, publish: boolean) => {
    const saved = await saveTeacherExamRoom(room, Boolean(editingRoom));
    setRooms((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setFeedback(publish ? 'Đã tạo và lưu phòng thi.' : 'Đã lưu cấu hình phòng thi.');
    setError('');
    setWizardOpen(false);
    setEditingRoom(null);
    setWizardExam(null);
    setOpenRoomId(publish ? room.id : null);
  };

  return (
    <div className="space-y-4">
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{feedback}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <div className={currentPage === 'appeals' ? 'hidden' : ''}>
        {roomsLoading
          ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải phòng thi...</p>
          : roomsError
            ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{roomsError}</p>
            : <ExamMonitor
              rooms={rooms}
              openRoomId={openRoomId}
              onEditDraft={(room) => { setEditingRoom(room); setWizardOpen(true); setFeedback(''); setError(''); }}
              onUpdateRoom={(updatedRoom) => {
                void saveTeacherExamRoom(updatedRoom, true)
                  .then((saved) => {
                    setRooms((current) => current.map((room) => room.id === saved.id ? saved : room));
                    setError('');
                  })
                  .catch((saveError: unknown) => {
                    console.error('Không thể cập nhật trạng thái phòng thi.', saveError);
                    setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật phòng thi.');
                  });
              }}
              onDeleteRoom={(roomId) => {
                void deleteTeacherExamRoom(roomId)
                  .then(() => {
                    setRooms((current) => current.filter((room) => room.id !== roomId));
                    setFeedback('Đã xóa phòng thi.');
                    setError('');
                  })
                  .catch((deleteError: unknown) => {
                    console.error('Không thể xóa phòng thi.', deleteError);
                    setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa phòng thi.');
                  });
              }}
            />}
      </div>
      <div className={currentPage === 'appeals' ? '' : 'hidden'}><AppealsCenter /></div>
      {wizardOpen && <ExamRoomWizard initialRoom={editingRoom} initialExam={wizardExam} onCancel={() => { setWizardOpen(false); setEditingRoom(null); setWizardExam(null); }} onSave={saveRoom} onNavigate={onNavigate} />}
    </div>
  );
}
