import { describe, expect, it } from 'vitest';
import type { ExecutiveReportData } from '@/shared/services/report.service';
import { cleanLabel, computeDelta, formatNumber, formatPercent } from './format';
import { buildMatrixRows, grandTotalRow, toPercent } from './matrix';
import { STAGE_BY_ID, getMeasure } from '../config/stages';
import { createReportsPdf } from './reportPdf';

const sampleReport: ExecutiveReportData = {
  stage: 'BUYER',
  reportTitle: 'Resumen de captación',
  period: 'Septiembre 2026',
  periodKey: '2026-09',
  metric: 'Contactos Registrados [Cant.]',
  rowHeader: 'Fuente de Atracción / Canal',
  superHeader: 'Sede Física',
  columns: ['Sede Centro Historico', 'Sede California'],
  totalColumnName: 'Total',
  categories: [
    {
      categoryName: 'Redes Sociales',
      items: [
        { itemName: 'Instagram Ads', values: { 'Sede Centro Historico': 60, 'Sede California': 40 }, total: 100 },
        { itemName: 'Meta Lead Gen', values: { 'Sede Centro Historico': 30, 'Sede California': 20 }, total: 50 },
      ],
      subtotals: { 'Sede Centro Historico': 90, 'Sede California': 60 },
      subtotalTotal: 150,
      subtotalLabel: '** Total Redes Sociales **',
    },
  ],
  grandTotals: { 'Sede Centro Historico': 90, 'Sede California': 60 },
  grandTotal: 150,
  grandTotalLabel: '** Totales Generales **',
  isCurrency: false,
  generatedAt: '2026-10-22T12:00:00.000Z',
  sourceMart: 'NexoSalud_Mart.Fact_CaptacionBuyer',
  comparison: { periodKey: '2026-08', period: 'Agosto 2026', grandTotal: 120 },
};

describe('Reportes Matriciales del Embudo — utilidades y PDF', () => {
  it('limpia asteriscos de formato crudo en subtotales y totales generales', () => {
    expect(cleanLabel('** Totales Generales **')).toBe('Totales Generales');
    const rows = buildMatrixRows(sampleReport);
    const subtotal = rows.find((r) => r.kind === 'subtotal');
    expect(subtotal?.label).toBe('Total Redes Sociales');
    expect(grandTotalRow(sampleReport).label).toBe('Totales Generales');
  });

  it('filtra filas por canal o categoría y calcula participación porcentual', () => {
    const filtered = buildMatrixRows(sampleReport, 'instagram');
    const items = filtered.filter((r) => r.kind === 'item');
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Instagram Ads');
    expect(formatPercent(toPercent(75, sampleReport))).toContain('50');
  });

  it('calcula la variación porcentual contra el período anterior', () => {
    const delta = computeDelta(sampleReport);
    expect(delta).not.toBeNull();
    expect(delta?.direction).toBe('up');
    expect(delta?.pct).toBeCloseTo(25, 1);
    expect(delta?.label).toBe('Agosto 2026');
    expect(formatNumber(1250.5, 'pen')).toMatch(/1.*250.*50/);
  });

  it('conserva valores no calculables en formato, matriz y comparacion', () => {
    const report = { ...sampleReport, grandTotal: null };
    expect(formatNumber(null, 'pen')).toBe('—');
    expect(grandTotalRow(report).total).toBeNull();
    expect(computeDelta(report)).toBeNull();
  });

  it('genera el PDF ejecutivo vectorial sin errores', async () => {
    const doc = await createReportsPdf(
      [
        {
          stage: STAGE_BY_ID.buyer,
          measure: getMeasure('buyer', 'contactos_registrados'),
          report: sampleReport,
        },
      ],
      'absolute'
    );
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
