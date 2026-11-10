import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LeadReportsPanel, leadPercent, leadReportQuery } from './LeadReportsPanel';

const fetchMock = vi.fn();
const catalogs = {
  servicios: [{ id_servicio: 1, nombre: 'Ortodoncia' }],
  sedes: [{ id_sede: 1, nombre: 'Centro' }],
  canales: [{ id_canal: 1, nombre: 'WhatsApp' }],
  fuentes: [{ id_fuente: 1, nombre: 'Referencia' }],
  negociadores: [{ id_usuario: 1, nombre: 'Asesor QA' }],
  promociones: [{ id_promocion: 1, nombre: 'Promoción QA' }],
  motivos: [
    { id_motivo_rechazo: 1, motivo: 'Presupuesto insuficiente', ambito: 'PROPUESTA' },
    { id_motivo_rechazo: 2, motivo: 'Incompatibilidad de horario', ambito: 'ALTERNATIVA' },
  ],
  horarios: [{ id_profesional: 1, profesional: 'Profesional QA', pref_turno_lead: 'Mañana', ofr_turno_lead: 'Tarde' }],
};
const pending = { Mes: '2026-11-01', Tratamiento: 'Ortodoncia', Ingresadas: 2, Aceptadas: 0,
  CerradasSinAcuerdo: 0, Pendientes: 1, SinResultadoDocumentado: 1, AceptacionPorcentaje: null, ValorAcordadoSoles: '0' };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    const body = url.endsWith('/report-catalogs') ? catalogs :
      url.includes('/reports/R1?') ? [pending, { ...pending, EsTotal: true, Tratamiento: 'TOTAL' }] :
      url.includes('/reports/R2?') ? {
        detalle: [{ id_propuesta_logica: 11, id_version_vigente: 13, fecha_presentacion: '2026-11-02',
          Tratamiento: 'Ortodoncia', PrecioCotizado: '120.50', PromocionAplicada: 'Promoción QA',
          ConPromocion: true, Resultado: 'Rechazada', MotivoRechazo: 'Presupuesto insuficiente' }],
        resumen: [{ Presentadas: 1, Aceptadas: 0, Rechazadas: 1, Pendientes: 0, L2Porcentaje: 100 }],
      } : {
        detalle: [{ id_solicitud: 5, id_opcion: 8, fecha_ofrecida: '2026-11-03', id_sede: 1,
          pref_dia_semana_lead: 2, pref_turno_lead: 'Mañana', pref_hora_inicio_lead: '09:00', pref_hora_fin_lead: '11:00',
          DiaOfrecido: 3, ofr_turno_lead: 'Tarde', HoraInicioOfrecida: '14:00', HoraFinOfrecida: '15:00',
          Resultado: 'Rechazada', MotivoRechazo: 'Incompatibilidad de horario', NumeroCambios: 2 }],
        resumen: [{ Presentadas: 1, Rechazadas: 1, Aceptadas: 0, Pendientes: 0, Modificadas: 1, L3Porcentaje: 100 }],
      };
    return new Response(JSON.stringify(body), { status: 200 });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('R1 conserva sus filtros, separa pendientes de históricos y muestra No calculable', async () => {
  render(<LeadReportsPanel />);
  const filters = within(screen.getByLabelText('Filtros del reporte'));
  expect(filters.getByLabelText('Período de ingreso a LEAD')).toBeTruthy();
  expect(filters.getByLabelText('Fecha de corte')).toBeTruthy();
  for (const label of ['Tratamiento', 'Canal de origen', 'Fuente de captación', 'Sede de interés', 'Negociador']) {
    expect(filters.getByLabelText(label)).toBeTruthy();
  }
  expect(filters.queryByLabelText('Motivo de rechazo')).toBeNull();
  await screen.findByText(/L1.*No calculable/);
  expect(screen.getByText('Sin resultado documentado: 1.')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Pendientes' })).toBeTruthy();
  expect(screen.getByText('TOTAL')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Desglosar por canal de origen'));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('desglosar_canal=true'))).toBe(true));
});

test('R2 presenta la raíz y los valores de su versión vigente con el desglose aprobado', async () => {
  render(<LeadReportsPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'R2' }));
  await screen.findByText(/PROP-11/);
  expect(screen.queryByText(/PROP-13/)).toBeNull();
  const row = screen.getByText(/PROP-11/).closest('tr')!;
  expect(within(row).getByText('Promoción QA')).toBeTruthy();
  expect(within(row).getByText('Rechazada')).toBeTruthy();
  expect(within(row).getByText('Presupuesto insuficiente')).toBeTruthy();
  expect(within(row).getByText(/120[.,]50/)).toBeTruthy();
  expect(screen.getByLabelText('Promoción aplicada')).toBeTruthy();
  expect(screen.getByLabelText('Mínimo')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Promoción aplicada'), { target: { value: 'sin-promocion' } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('con_promocion=false'))).toBe(true));
  expect(screen.getByText('Desglose por tratamiento, promoción y resultado')).toBeTruthy();
  expect(screen.queryByLabelText('Fecha de corte')).toBeNull();
});

test('R3 presenta ambos horarios, el motivo tipificado y el conteo de cambios en la misma fila', async () => {
  render(<LeadReportsPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'R3' }));
  const row = (await screen.findByText(/SOL-5 \/ ALT-8/)).closest('tr')!;
  for (const label of ['Martes · Mañana', '09:00–11:00', 'Miércoles · Tarde', '14:00–15:00',
    'Rechazada', 'Incompatibilidad de horario', '2']) expect(within(row).getByText(label)).toBeTruthy();
  expect(screen.getAllByText(/SOL-5 \/ ALT-8/)).toHaveLength(1);
  expect(screen.getByLabelText('Profesional ofrecido')).toBeTruthy();
  expect(screen.getByLabelText('Franja horario ofrecido')).toBeTruthy();
  expect(screen.queryByLabelText('Promoción aplicada')).toBeNull();
});

test('el corte incluye el día de Lima y un porcentaje real cero se conserva', () => {
  const query = leadReportQuery('R1', { periodo: '2026-12', corte: '2026-12-31' }, new Date('2027-01-02T00:00:00Z'));
  expect(query.get('inicio')).toBe('2026-12-01');
  expect(query.get('fin_exclusivo')).toBe('2027-01-01');
  expect(query.get('corte_utc')).toBe('2027-01-01T04:59:59.999Z');
  expect(leadPercent(null)).toBe('No calculable');
  expect(leadPercent(0)).toMatch(/^0[.,]00 %$/);
});
