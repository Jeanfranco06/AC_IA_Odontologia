import type { ExecutiveReportData } from '@/shared/services/report.service';
import type { MeasureOption, StageConfig } from '../config/stages';
import { columnLabel } from './format';
import { buildMatrixRows, grandTotalRow, toPercent, type DisplayMode } from './matrix';

export interface ExportSection {
  stage: StageConfig;
  measure: MeasureOption;
  report: ExecutiveReportData;
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function exportFileName(sections: ExportSection[], ext: 'csv' | 'pdf'): string {
  const period = sections[0]?.report.periodKey ?? 'historico';
  const scope = sections.length === 1 ? slug(sections[0].stage.label) : 'consolidado';
  return `nexosalud-embudo-${scope}-${period === 'all' ? 'historico' : period}.${ext}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV plano (UTF-8 con BOM para Excel). Una sección por etapa, separadas por línea en blanco. */
export function downloadCsv(sections: ExportSection[], mode: DisplayMode = 'absolute') {
  const lines: string[] = [];

  sections.forEach(({ stage, measure, report }, idx) => {
    if (idx > 0) lines.push('');
    const pct = mode === 'percent' && measure.aggregation === 'sum';
    const val = (n: number | null) => n === null ? '' : (pct ? toPercent(n, report).toFixed(2) : String(Math.round(n * 100) / 100));

    lines.push(csvCell(`${stage.label} — ${measure.label}${pct ? ' (% del total)' : ''}`));
    lines.push(csvCell(`Período: ${report.period}`));
    lines.push(['Categoría', report.rowHeader, ...report.columns.map(columnLabel), report.totalColumnName].map(csvCell).join(','));

    for (const row of buildMatrixRows(report)) {
      if (row.kind === 'item') {
        lines.push([row.category, row.label, ...report.columns.map((c) => val(row.values[c] === undefined ? 0 : row.values[c])), val(row.total)].map(csvCell).join(','));
      } else if (row.kind === 'subtotal') {
        lines.push([row.category, row.label, ...report.columns.map((c) => val(row.values[c] === undefined ? 0 : row.values[c])), val(row.total)].map(csvCell).join(','));
      }
    }
    const t = grandTotalRow(report);
    lines.push(['', t.label, ...report.columns.map((c) => val(t.values[c] === undefined ? 0 : t.values[c])), val(t.total)].map(csvCell).join(','));
  });

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, exportFileName(sections, 'csv'));
}

/** PDF ejecutivo vectorial (texto seleccionable). Se carga bajo demanda para no inflar el bundle. */
export async function downloadPdf(sections: ExportSection[], mode: DisplayMode = 'absolute') {
  const { createReportsPdf } = await import('./reportPdf');
  const doc = await createReportsPdf(sections, mode);
  doc.save(exportFileName(sections, 'pdf'));
}
