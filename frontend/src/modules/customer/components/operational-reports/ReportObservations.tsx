import React from 'react';

export interface MetricItem {
  label: string;
  value: React.ReactNode;
  hint?: string;
  badge?: string;
}

interface ReportObservationsProps {
  title?: string;
  metrics?: MetricItem[];
  observations?: React.ReactNode;
  notesTitle?: string;
}

export const ReportObservations: React.FC<ReportObservationsProps> = ({
  title = 'Resultados y Observaciones Clínicas',
  metrics,
  observations,
  notesTitle = 'Dictamen / Observaciones Técnicas',
}) => {
  return (
    <section className="report-observations space-y-3">
      {title && (
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--pt-ink)] font-mono border-b border-[var(--pt-line)] pb-1.5">
          {title}
        </h2>
      )}

      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] p-3 space-y-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono block">
                {m.label}
              </span>
              <div className="text-lg font-bold text-[var(--pt-ink)] font-mono flex items-baseline gap-2">
                {m.value}
                {m.badge && (
                  <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full bg-[var(--pt-accent-soft)] text-[var(--pt-accent)]">
                    {m.badge}
                  </span>
                )}
              </div>
              {m.hint && <p className="text-[10px] text-[var(--pt-muted)]">{m.hint}</p>}
            </div>
          ))}
        </div>
      )}

      {observations && (
        <div className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-sunken)]/40 p-4 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono block">
            {notesTitle}
          </span>
          <div className="text-xs text-[var(--pt-ink)] whitespace-pre-wrap leading-relaxed font-sans">
            {observations}
          </div>
        </div>
      )}
    </section>
  );
};
