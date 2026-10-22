import { useState, type FormEvent } from 'react';
import { Bug, Check, Heart, Lightbulb, Send } from 'lucide-react';

const categories = [
  { value: 'idea', label: 'Góp ý', icon: Lightbulb, active: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'bug', label: 'Báo lỗi', icon: Bug, active: 'border-rose-300 bg-rose-50 text-rose-800' },
  { value: 'love', label: 'Điều em thích', icon: Heart, active: 'border-pink-300 bg-pink-50 text-pink-800' },
] as const;

export function StudentFeedback() {
  const [category, setCategory] = useState<(typeof categories)[number]['value']>('idea');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-white px-6 py-10 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Cảm ơn em đã chia sẻ!</h2>
        <button
          type="button"
          onClick={() => { setMessage(''); setSubmitted(false); }}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Gửi góp ý khác
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-800">Em muốn chia sẻ điều gì?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {categories.map(({ value, label, icon: Icon, active }) => {
              const selected = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(value)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? active : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="feedback-message" className="mb-2 block text-sm font-semibold text-slate-800">
            Lời nhắn
          </label>
          <textarea
            id="feedback-message"
            required
            maxLength={500}
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Viết góp ý hoặc mô tả lỗi..."
            className="input-field min-h-32 resize-y"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">{message.length}/500</span>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={!message.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Gửi đi
          </button>
        </div>
      </form>
    </div>
  );
}
