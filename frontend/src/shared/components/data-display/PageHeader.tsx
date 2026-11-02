import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 pb-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[70ch] leading-relaxed font-normal">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">{actions}</div>}
    </div>
  );
}
