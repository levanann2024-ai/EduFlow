import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, ClipboardList, Eye, FileText, PenLine, ShieldAlert } from 'lucide-react';
import type { Page } from '@/types';
import { AIGradingEngine } from './AIGradingEngine';
import { AppealsCenter } from './AppealsCenter';
import { ClassAnalytics } from './ClassAnalytics';
import { ExamManagement } from './ExamManagement';
import { ExamMonitor } from './ExamMonitor';
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
    <WorkspaceTabs
      currentPage={currentPage}
      onNavigate={onNavigate}
      tabs={[
        { page: 'question-bank', label: 'Ngân hàng câu hỏi', icon: ClipboardList },
        { page: 'exams', label: 'Đề thi & bài kiểm tra', icon: FileText },
      ]}
    >
      {(activePage) => activePage === 'question-bank'
        ? <QuestionBank />
        : <ExamManagement onNavigate={onNavigate} />}
    </WorkspaceTabs>
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
  return (
    <WorkspaceTabs
      currentPage={currentPage}
      onNavigate={onNavigate}
      tabs={[
        { page: 'exam-monitor', label: 'Giám sát phòng thi', icon: Eye },
        { page: 'appeals', label: 'Kháng nghị & sự cố', icon: ShieldAlert },
      ]}
    >
      {(activePage) => activePage === 'appeals' ? <AppealsCenter /> : <ExamMonitor />}
    </WorkspaceTabs>
  );
}
