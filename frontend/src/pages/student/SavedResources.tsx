import { useMemo, useState } from 'react';
import { Bookmark, Search, Star } from 'lucide-react';
import { MathText } from '@/components/MathText';
import type { Role } from '@/types';
import {
  importLegacySavedItems,
  readLegacySavedItems,
  removeLegacySavedItems,
  useSavedItems,
  type SavedItem,
} from './savedItems';

const labels: Record<SavedItem['type'], string> = {
  quiz: 'Bộ câu hỏi AI',
  answer: 'Câu trả lời AI',
  resource: 'Tài liệu',
  question: 'Câu hỏi',
  exam: 'Đề kiểm tra',
  assignment: 'Bài tập',
  lesson: 'Giáo án AI',
};

function itemLabel(role: Role, type: SavedItem['type']) {
  return role === 'student' && type === 'exam' ? 'Kết quả kiểm tra' : labels[type];
}

export function SavedResources({ role, onOpen }: {
  role: Role;
  onOpen: (item: SavedItem) => void;
}) {
  const { items, loading, error: loadError, refresh, removeSavedItem } = useSavedItems();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [legacy, setLegacy] = useState(() => {
    if (role !== 'student') return null;
    try {
      return readLegacySavedItems();
    } catch (readError) {
      return { raw: '', items: [], error: readError instanceof Error ? readError.message : 'Không thể đọc dữ liệu cũ.' };
    }
  });
  const [importAcknowledged, setImportAcknowledged] = useState(false);
  const [importedRaw, setImportedRaw] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const kinds: SavedItem['type'][] = role === 'student'
    ? ['resource', 'assignment', 'exam', 'quiz', 'answer']
    : ['question', 'exam', 'assignment', 'lesson'];
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return items.filter((item) => (filter === 'all' || item.type === filter)
      && `${item.title} ${item.subject} ${itemLabel(role, item.type)}`.toLocaleLowerCase('vi').includes(normalized))
      .sort((a, b) => sort === 'newest'
        ? Date.parse(b.savedAt) - Date.parse(a.savedAt)
        : Date.parse(a.savedAt) - Date.parse(b.savedAt));
  }, [items, filter, query, role, sort]);

  const remove = async (item: SavedItem) => {
    setBusy(`${item.type}:${item.id}`);
    try {
      await removeSavedItem(item.type, item.id);
      setError('');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Không thể bỏ lưu nội dung.');
    } finally {
      setBusy('');
    }
  };

  const importLegacy = async () => {
    if (!legacy || !importAcknowledged || 'error' in legacy) return;
    setBusy('import');
    try {
      await importLegacySavedItems(legacy.items);
      setImportedRaw(legacy.raw);
      setError('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Không thể nhập dữ liệu cũ.');
    } finally {
      setBusy('');
    }
  };

  const deleteLegacy = () => {
    if (importedRaw === null) return;
    try {
      removeLegacySavedItems(importedRaw);
      setLegacy(null);
      setImportedRaw(null);
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa dữ liệu cũ.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 px-6 py-7 sm:px-8 sm:py-9">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-600 p-3 text-white"><Bookmark className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Nội dung đã lưu</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">Những nội dung bạn muốn quay lại, được lưu riêng trong tài khoản EduFlow.</p>
          </div>
        </div>
      </header>

      {legacy && !('error' in legacy) && (
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h2 className="font-bold">Dữ liệu đã lưu cũ trên trình duyệt</h2>
          <p>Dữ liệu này có thể bao gồm nội dung của tài khoản khác đã dùng cùng trình duyệt. Chỉ nhập nếu bạn đã kiểm tra và muốn đưa dữ liệu vào tài khoản hiện tại.</p>
          {importedRaw === null ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={importAcknowledged} onChange={(event) => setImportAcknowledged(event.target.checked)} /> Tôi hiểu và muốn nhập {legacy.items.length} nội dung cũ.</label>
              <button type="button" disabled={!importAcknowledged || Boolean(busy)} onClick={() => void importLegacy()} className="rounded-lg bg-amber-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Nhập vào tài khoản</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span>Đã nhập thành công. Dữ liệu cũ vẫn còn trên trình duyệt.</span>
              <button type="button" onClick={deleteLegacy} className="rounded-lg border border-amber-700 px-4 py-2 font-semibold hover:bg-amber-100">Xác nhận xóa dữ liệu cũ trên trình duyệt</button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input aria-label="Tìm nội dung đã lưu" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc môn học" className="input-field w-full pl-10" />
          </label>
          <select aria-label="Lọc loại nội dung" className="input-field" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Tất cả nội dung</option>
            {kinds.map((kind) => <option key={kind} value={kind}>{itemLabel(role, kind)}</option>)}
          </select>
          <select aria-label="Sắp xếp nội dung" className="input-field" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Mới lưu nhất</option><option value="oldest">Cũ nhất</option>
          </select>
        </div>
        {(error || loadError) && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error || loadError}
          {loadError && <button type="button" onClick={() => void refresh().then(() => setError('')).catch((retryError: unknown) => setError(retryError instanceof Error ? retryError.message : 'Không thể tải nội dung đã lưu.'))} className="ml-3 font-semibold underline">Thử lại</button>}
        </div>}
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải nội dung đã lưu...</p>
          : !loadError && visible.length === 0 ? (
            <div className="py-12 text-center">
              <Star className="mx-auto h-9 w-9 text-blue-300" />
              <h2 className="mt-4 text-lg font-bold text-slate-800">{items.length ? 'Không tìm thấy nội dung phù hợp' : 'Chưa có nội dung nào được lưu'}</h2>
              <p className="mt-2 text-sm text-slate-500">{items.length ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Chọn ngôi sao trên nội dung bạn muốn xem lại để lưu vào đây.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((item) => {
                const key = `${item.type}:${item.id}`;
                const canPreview = item.type === 'answer' || item.type === 'question' || item.type === 'lesson';
                return (
                  <li key={key} className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-blue-700">
                          <span>{itemLabel(role, item.type)}</span><span className="text-slate-500">{item.subject || 'Chưa phân loại'}</span>
                        </div>
                        <button type="button" onClick={() => canPreview ? setExpanded(expanded === key ? null : key) : onOpen(item)} className="mt-1 text-left text-base font-semibold text-slate-900 hover:text-blue-700">{item.title}</button>
                        <p className="mt-1 text-xs text-slate-500">Đã lưu {formatDate(item.savedAt)}</p>
                      </div>
                      <button type="button" disabled={Boolean(busy)} aria-label={`Bỏ lưu ${item.title}`} title="Bỏ lưu" onClick={() => void remove(item)} className="rounded-lg p-2 text-amber-500 hover:bg-amber-50 disabled:opacity-50"><Star className="h-5 w-5 fill-amber-400" /></button>
                    </div>
                    {expanded === key && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {item.type === 'answer' && <><p className="mb-3 font-semibold">{item.question}</p><MathText text={item.answer} /></>}
                        {item.type === 'question' && <MathText text={item.question.question} />}
                        {item.type === 'lesson' && <MathText text={item.content} />}
                        {item.type === 'answer' && item.conversationId && <button type="button" onClick={() => onOpen(item)} className="mt-4 font-semibold text-blue-700">Mở cuộc trò chuyện</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}
