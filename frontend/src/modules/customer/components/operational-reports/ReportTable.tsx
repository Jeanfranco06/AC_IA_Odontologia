import React from 'react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface ReportTableProps<T> {
  title?: string;
  subtitle?: string;
  columns: ColumnDef<T>[];
  data: T[];
  emptyMessage?: string;
}

export function ReportTable<T>({
  title,
  subtitle,
  columns,
  data,
  emptyMessage = 'No se registran elementos en este bloque documental.',
}: ReportTableProps<T>) {
  return (
    <section className="report-table-section space-y-2">
      {title && (
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-[var(--pt-line)] pb-1.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--pt-ink)] font-mono">
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs text-[var(--pt-muted)]">{subtitle}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--pt-line)] bg-[var(--pt-surface)] shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-[var(--pt-sunken)] border-b border-[var(--pt-line)] font-mono uppercase tracking-wider text-[11px] text-[var(--pt-muted)]">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-2.5 px-3 font-semibold ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--pt-line)] text-[var(--pt-ink)]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 px-4 text-center text-xs text-[var(--pt-muted)] font-mono"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-[var(--pt-paper)] transition-colors odd:bg-[var(--pt-surface)] even:bg-[var(--pt-paper)]/50"
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className={`py-2.5 px-3 leading-relaxed ${
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {col.cell
                        ? col.cell(row, rIdx)
                        : col.accessorKey
                        ? (row[col.accessorKey] as unknown as React.ReactNode)
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
