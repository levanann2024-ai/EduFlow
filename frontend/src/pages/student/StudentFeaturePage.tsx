import type { LucideIcon } from 'lucide-react';

interface StudentFeaturePageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function StudentFeaturePage({ icon: Icon, title, description }: StudentFeaturePageProps) {
  return (
    <section className="card min-h-[320px] p-8 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
        <Icon className="w-7 h-7 text-violet-600" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <span className="mt-5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        Khu vực đang được chuẩn bị
      </span>
    </section>
  );
}
