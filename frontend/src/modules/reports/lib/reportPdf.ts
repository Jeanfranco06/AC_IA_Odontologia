import jsPDF from 'jspdf';
import { regularFont, boldFont } from '@/shared/pdf/paymentFonts';
import logoDataUrl from '@/shared/pdf/Logo_NexoSalud.png?inline';
import type { ExportSection } from './export';
import { columnLabel, formatDateTime, formatNumber, formatPercent } from './format';
import { buildMatrixRows, grandTotalRow, toPercent, type DisplayMode, type MatrixRow } from './matrix';
import { UNIT_LABEL } from '../config/stages';

type RGB = [number, number, number];

// Paleta alineada con la UI (slate + teal-700)
const INK: RGB = [15, 23, 42]; // slate-900
const BODY: RGB = [51, 65, 85]; // slate-700
const MUTED: RGB = [100, 116, 139]; // slate-500
const FAINT: RGB = [148, 163, 184]; // slate-400
const LINE: RGB = [226, 232, 240]; // slate-200
const HEAD_BG: RGB = [241, 245, 249]; // slate-100
const SUB_BG: RGB = [248, 250, 252]; // slate-50
const ACCENT: RGB = [15, 118, 110]; // teal-700

const PAGE_W = 297;
const PAGE_H = 210;
const M = 14; // margen
const ROW_H = 6.4;
const FOOTER_SPACE = 14;

export async function createReportsPdf(sections: ExportSection[], mode: DisplayMode): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('OpenSans-Regular.ttf', regularFont);
  doc.addFileToVFS('OpenSans-Bold.ttf', boldFont);
  doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
  doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
  doc.setProperties({
    title: 'NexoSalud — Reportes matriciales del embudo',
    subject: 'Reporte ejecutivo',
    author: 'NexoSalud',
  });

  const font = (size: number, bold = false, color: RGB = INK) => {
    doc.setFont('OpenSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const fit = (text: string, maxW: number) => {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  const issued = formatDateTime(new Date());

  sections.forEach(({ stage, measure, report }, sectionIdx) => {
    if (sectionIdx > 0) doc.addPage();
    const pct = mode === 'percent' && measure.aggregation === 'sum';
    const fmt = (n: number | null) => (pct ? formatPercent(toPercent(n, report)) : formatNumber(n, measure.unit));

    // ── Cabecera de documento ──
    const drawDocHeader = () => {
      doc.addImage(logoDataUrl, 'PNG', M, M - 2, 17.7, 10, undefined, 'FAST');
      font(7.5, false, MUTED);
      doc.text('NexoSalud · Reportes matriciales del embudo', M + 21, M + 1.5);
      font(14, true, INK);
      doc.text(`${stage.label} — ${measure.label}`, M + 21, M + 7.5);

      font(7.5, false, MUTED);
      doc.text(`Emitido: ${issued}`, PAGE_W - M, M + 1.5, { align: 'right' });
      doc.text(`Período: ${report.period}`, PAGE_W - M, M + 5.5, { align: 'right' });
      doc.text(`Unidad: ${pct ? '% del total general' : UNIT_LABEL[measure.unit]}`, PAGE_W - M, M + 9.5, { align: 'right' });

      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(M, M + 13, PAGE_W - M, M + 13);
      return M + 19;
    };

    // ── Geometría de columnas ──
    const tableW = PAGE_W - M * 2;
    const nValues = report.columns.length + 1; // + total
    const labelW = Math.min(92, Math.max(64, tableW - nValues * 30));
    const valueW = (tableW - labelW) / nValues;
    const colX = (i: number) => M + labelW + valueW * i; // inicio de la columna de valor i

    const drawTableHeader = (y: number) => {
      // Super-cabecera de dimensión
      doc.setFillColor(...HEAD_BG);
      doc.rect(M, y, tableW, ROW_H * 2, 'F');
      font(6.5, true, MUTED);
      doc.text(report.superHeader.toUpperCase(), colX(0) + (valueW * report.columns.length) / 2, y + 4.2, { align: 'center' });
      doc.setDrawColor(...LINE);
      doc.line(colX(0) + 2, y + ROW_H, colX(report.columns.length) - 2, y + ROW_H);

      font(6.5, true, MUTED);
      doc.text(fit(report.rowHeader.toUpperCase(), labelW - 6), M + 3, y + ROW_H + 4.2);
      report.columns.forEach((c, i) => {
        doc.text(fit(columnLabel(c).toUpperCase(), valueW - 4), colX(i + 1) - 3, y + ROW_H + 4.2, { align: 'right' });
      });
      doc.text(report.totalColumnName.toUpperCase(), colX(nValues) - 3, y + ROW_H + 4.2, { align: 'right' });

      doc.setDrawColor(...LINE);
      doc.line(M, y + ROW_H * 2, M + tableW, y + ROW_H * 2);
      return y + ROW_H * 2;
    };

    const drawRow = (row: MatrixRow, y: number) => {
      if (row.kind === 'category') {
        font(7.8, true, INK);
        doc.text(fit(row.label, tableW - 6), M + 3, y + 4.3);
        return;
      }
      const isSub = row.kind === 'subtotal';
      const isTotal = row.kind === 'total';
      if (isSub || isTotal) {
        doc.setFillColor(...(isTotal ? HEAD_BG : SUB_BG));
        doc.rect(M, y, tableW, ROW_H, 'F');
      }
      if (isTotal) {
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.4);
        doc.line(M, y, M + tableW, y);
        doc.setLineWidth(0.2);
      }

      font(7.6, isSub || isTotal, isSub || isTotal ? INK : BODY);
      doc.text(fit(row.label, labelW - 10), M + (row.kind === 'item' ? 7 : 3), y + 4.3);

      report.columns.forEach((c, i) => {
        const v = row.values[c] === undefined ? 0 : row.values[c];
        font(7.6, isSub || isTotal, v === 0 && !isTotal ? FAINT : isSub || isTotal ? INK : BODY);
        doc.text(fmt(v), colX(i + 1) - 3, y + 4.3, { align: 'right' });
      });
      font(7.6, true, INK);
      doc.text(fmt(row.total), colX(nValues) - 3, y + 4.3, { align: 'right' });

      doc.setDrawColor(...LINE);
      doc.line(M, y + ROW_H, M + tableW, y + ROW_H);
    };

    let y = drawDocHeader();
    y = drawTableHeader(y);

    const rows: MatrixRow[] = [...buildMatrixRows(report), grandTotalRow(report)];
    if (rows.length === 1) {
      font(8, false, MUTED);
      doc.text('Sin registros para el período seleccionado.', M + 3, y + 6);
    }
    rows.forEach((row) => {
      if (y + ROW_H > PAGE_H - FOOTER_SPACE) {
        doc.addPage();
        y = drawTableHeader(M);
      }
      drawRow(row, y);
      y += ROW_H;
    });

    if (report.comparison && !pct) {
      const prev = report.comparison.grandTotal;
      const delta = prev === null || report.grandTotal === null || prev === 0 ? null : ((report.grandTotal - prev) / Math.abs(prev)) * 100;
      font(7, false, MUTED);
      const deltaText = delta === null ? 'sin base comparable' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} %`;
      if (y + 8 < PAGE_H - FOOTER_SPACE) {
        doc.text(
          `Total del período anterior (${report.comparison.period}): ${formatNumber(prev, measure.unit)} · Variación: ${deltaText}`,
          M,
          y + 6
        );
      }
    }
  });

  // ── Pie de página con numeración ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.line(M, PAGE_H - 10, PAGE_W - M, PAGE_H - 10);
    font(6.8, false, FAINT);
    doc.text('NexoSalud · Documento generado automáticamente desde el data mart analítico', M, PAGE_H - 6);
    doc.text(`Página ${p} de ${pages}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }

  return doc;
}
