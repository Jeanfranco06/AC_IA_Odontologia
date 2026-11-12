import React from 'react';

export interface InfoField {
  label: string;
  value: React.ReactNode;
  isMono?: boolean;
  highlight?: boolean;
}

export interface InfoSection {
  title?: string;
  fields: InfoField[];
}

interface GeneralInfoGridProps {
  sections: InfoSection[];
}

export const GeneralInfoGrid: React.FC<GeneralInfoGridProps> = ({ sections }) => {
  return (
    <section className="report-general-info space-y-4">
      {sections.map((section, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] p-4 space-y-3"
        >
          {section.title && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pt-muted)] font-mono border-b border-[var(--pt-line)] pb-1.5">
              {section.title}
            </h3>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 text-xs">
            {section.fields.map((field, fIdx) => (
              <div key={fIdx} className="space-y-0.5">
                <dt className="text-[11px] font-semibold text-[var(--pt-muted)] uppercase tracking-wider">
                  {field.label}
                </dt>
                <dd
                  className={`text-[13px] font-medium leading-relaxed ${
                    field.isMono ? 'font-mono' : ''
                  } ${
                    field.highlight
                      ? 'text-[var(--pt-accent)] font-semibold'
                      : 'text-[var(--pt-ink)]'
                  }`}
                >
                  {field.value ?? '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
};
