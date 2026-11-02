export function ReportsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando reportes">
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="ns-skeleton h-4 w-48" />
            <div className="ns-skeleton h-3 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <div className="ns-skeleton h-8 w-48" />
            <div className="ns-skeleton h-8 w-28" />
            <div className="ns-skeleton h-8 w-24" />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          <div className="grid grid-cols-4 gap-4 bg-slate-50/80 px-5 py-3 dark:bg-slate-800/40">
            <div className="ns-skeleton h-3 w-36" />
            <div className="ns-skeleton ml-auto h-3 w-20" />
            <div className="ns-skeleton ml-auto h-3 w-20" />
            <div className="ns-skeleton ml-auto h-3 w-16" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 items-center gap-4 px-5 py-3">
              <div className="ns-skeleton h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
              <div className="ns-skeleton ml-auto h-3.5 w-14" />
              <div className="ns-skeleton ml-auto h-3.5 w-14" />
              <div className="ns-skeleton ml-auto h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
