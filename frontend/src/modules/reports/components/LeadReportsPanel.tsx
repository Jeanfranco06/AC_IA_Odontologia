import { useEffect, useState, type ReactNode } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const root = API + '/lead/commercial';
type Report = 'R1' | 'R2' | 'R3';
type Row = Record<string, string | number | boolean | null | undefined>;
type Catalogs = Record<string, Row[] | string | null>;
type Filters = Record<string, string>;
type ReportData = { rows: Row[]; summary?: Row };
const titles = {
  R1: 'Resultados de Negociaciones Comerciales',
  R2: 'Precios, Promociones y Motivos de Rechazo',
  R3: 'Preferencias y Alternativas de Atención',
};
const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const decimal = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function leadPercent(value: Row[string]) {
  return value == null ? 'No calculable' : decimal.format(Number(value)) + ' %';
}

function dateLabel(value: Row[string]) {
  const [year, month, day] = String(value ?? '').slice(0, 10).split('-');
  return day ? [day, month, year].join('/') : '—';
}

function todayLima() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
}

export function leadReportQuery(report: Report, filters: Filters, now = new Date()) {
  const [year, month] = filters.periodo.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const query = new URLSearchParams({ inicio: filters.periodo + '-01', fin_exclusivo: end });
  for (const [key, value] of Object.entries(filters)) {
    if (!value || key === 'periodo' || key === 'corte') continue;
    if (key === 'id_promocion' && value === 'sin-promocion') query.set('con_promocion', 'false');
    else query.set(key, value);
  }
  if (report === 'R1') {
    const endOfCutoff = new Date(filters.corte + 'T23:59:59.999-05:00');
    query.set('corte_utc', new Date(Math.min(endOfCutoff.getTime(), now.getTime())).toISOString());
  }
  return query;
}

function money(value: Row[string]) {
  return value == null ? '—' : decimal.format(Number(value));
}

function timeLabel(value: Row[string]) {
  return String(value ?? '').match(/(?:T|^)(\d{2}:\d{2})/)?.[1] ?? '';
}

function schedule(day: Row[string], shift: Row[string], start: Row[string], end: Row[string], date?: Row[string]) {
  const dayLabel = day ? days[Number(day) - 1] : '';
  const interval = timeLabel(start) && timeLabel(end) ? timeLabel(start) + '–' + timeLabel(end) : '';
  return <>{[dayLabel, shift].filter(Boolean).join(' · ') || (date ? dateLabel(date) : 'Sin especificar')}
    {interval && <span className="block text-xs text-slate-500">{interval}</span>}
    {date && dayLabel && <span className="block text-xs text-slate-500">{dateLabel(date)}</span>}</>;
}

function ReportTable({ columns, children, footer }: { columns: string[]; children: ReactNode; footer?: ReactNode }) {
  return <div className="overflow-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-slate-50 dark:bg-slate-900"><tr>
        {columns.map(column => <th key={column} scope="col" className="px-3 py-2">{column}</th>)}
      </tr></thead>
      <tbody className="divide-y">{children}</tbody>
      {footer && <tfoot className="border-t font-semibold">{footer}</tfoot>}
    </table>
  </div>;
}

const cell = 'px-3 py-2';
const control = 'rounded-md border bg-transparent px-2 py-1.5 text-sm';

function reportGroups(report: 'R2' | 'R3', rows: Row[], sedeName: (id: Row[string]) => string) {
  const grouped = new Map<string, { labels: string[]; total: number }>();
  for (const row of rows) {
    const labels = report === 'R2'
      ? [String(row.Tratamiento ?? 'Sin tratamiento'), row.ConPromocion ? 'Con promoción' : 'Sin promoción', String(row.Resultado ?? 'Sin evidencia')]
      : [sedeName(row.id_sede),
         [days[Number(row.DiaOfrecido) - 1], row.ofr_turno_lead, timeLabel(row.HoraInicioOfrecida) + '–' + timeLabel(row.HoraFinOfrecida)].filter(Boolean).join(' · '),
         String(row.Resultado ?? 'Sin evidencia')];
    const key = JSON.stringify(labels);
    const group = grouped.get(key) ?? { labels, total: 0 };
    group.total++;
    grouped.set(key, group);
  }
  return Array.from(grouped.values()).sort((a, b) => a.labels.join(' ').localeCompare(b.labels.join(' '), 'es'));
}

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(root + path, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No fue posible cargar el reporte.');
  return body;
}

export function LeadReportsPanel() {
  const today = todayLima();
  const defaults = { periodo: today.slice(0, 7), corte: today };
  const [report, setReport] = useState<Report>('R1');
  const [filters, setFilters] = useState<Filters>(defaults);
  const [catalogs, setCatalogs] = useState<Catalogs>({});
  const [catalogError, setCatalogError] = useState('');
  const [result, setResult] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    readJson<Catalogs>('/report-catalogs', controller.signal).then(setCatalogs).catch(err => {
      if (!controller.signal.aborted) setCatalogError(err.message);
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    setError('');
    if (!filters.periodo || (report === 'R1' && !filters.corte)) {
      setLoading(false);
      return () => controller.abort();
    }
    readJson<Row[] | { detalle: Row[]; resumen: Row[] }>(
      '/reports/' + report + '?' + leadReportQuery(report, filters), controller.signal,
    ).then(data => {
      if (controller.signal.aborted) return;
      setResult(Array.isArray(data) ? { rows: data } : { rows: data.detalle, summary: data.resumen[0] });
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, report, retry]);

  function field(key: string, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  function catalog(key: string) {
    const items = catalogs[key];
    return Array.isArray(items) ? items : [];
  }

  function select(label: string, key: string, options: { id: string; name: string }[], all = 'Todos') {
    return <label className="grid gap-1 text-sm">{label}
      <select className={control} value={filters[key] ?? ''} onChange={e => field(key, e.target.value)}>
        <option value="">{all}</option>
        {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>;
  }

  function catalogSelect(label: string, key: string, source: string, name = 'nombre', sourceKey = key) {
    return select(label, key, catalog(source).map(item => ({ id: String(item[sourceKey]), name: String(item[name]) })));
  }

  function hours(prefix: 'pref' | 'ofr', label: string) {
    const shifts = [...new Set(catalog('horarios').map(item => item[prefix + '_turno_lead']).filter(Boolean).map(String))].sort();
    return <fieldset className="rounded-md border p-2">
      <legend className="px-1 text-sm">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {select('Día ' + label.toLowerCase(), prefix + '_dia', days.map((name, index) => ({ id: String(index + 1), name })))}
        {select('Franja ' + label.toLowerCase(), prefix + '_turno', shifts.map(name => ({ id: name, name })))}
      </div>
    </fieldset>;
  }

  const rows = result?.rows ?? [];
  const summary = result?.summary;
  const r1Total = rows.find(row => row.EsTotal);
  const reasonOptions = catalog('motivos').filter(row => row.ambito === (report === 'R2' ? 'PROPUESTA' : 'ALTERNATIVA'));
  const professionals = Array.from(new Map(catalog('horarios').map(item => [
    String(item.id_profesional), { id: String(item.id_profesional), name: String(item.profesional) },
  ])).values());
  const summaryLabel = filters.id_motivo ? 'Totales del indicador con los demás filtros, para conservar el denominador' : 'Totales';
  const names = new Map(catalog('sedes').map(item => [String(item.id_sede), String(item.nombre)]));
  const groups = report === 'R1' ? [] : reportGroups(report, rows, id => names.get(String(id)) ?? 'Sin sede');

  return <section aria-label="Reportes LEAD" className="space-y-4 rounded-xl border p-4">
    <div aria-label="Reportes de la etapa LEAD" className="flex flex-wrap gap-2">
      {(Object.keys(titles) as Report[]).map(key => <button type="button" key={key}
        className={control} aria-pressed={report === key} onClick={() => { setReport(key); setFilters(defaults); }}>
        {key}
      </button>)}
    </div>
    <h2 className="text-lg font-semibold">{report}. {titles[report]}</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Filtros del reporte">
      <label className="grid gap-1 text-sm">{report === 'R1' ? 'Período de ingreso a LEAD' : 'Período de presentación'}
        <input className={control} type="month" value={filters.periodo} onChange={e => field('periodo', e.target.value)} />
      </label>
      {report === 'R1' && <label className="grid gap-1 text-sm">Fecha de corte
        <input className={control} type="date" max={today} value={filters.corte} onChange={e => field('corte', e.target.value)} />
      </label>}
      {catalogSelect('Tratamiento', 'id_servicio', 'servicios')}
      {report === 'R1' && catalogSelect('Canal de origen', 'id_canal', 'canales')}
      {report === 'R1' && catalogSelect('Fuente de captación', 'id_fuente', 'fuentes')}
      {catalogSelect(report === 'R1' ? 'Sede de interés' : report === 'R3' ? 'Sede ofrecida' : 'Sede', 'id_sede', 'sedes')}
      {report === 'R1' && catalogSelect('Negociador', 'id_negociador', 'negociadores', 'nombre', 'id_usuario')}
      {report === 'R2' && <>
        {select('Promoción aplicada', 'id_promocion', [
          { id: 'sin-promocion', name: 'Sin promoción' },
          ...catalog('promociones').map(item => ({ id: String(item.id_promocion), name: String(item.nombre) })),
        ], 'Todas')}
        <fieldset className="rounded-md border p-2"><legend className="px-1 text-sm">Rango de precios (S/)</legend>
          <div className="grid grid-cols-2 gap-2">{['min', 'max'].map((key, index) =>
            <label className="grid gap-1 text-sm" key={key}>{index === 0 ? 'Mínimo' : 'Máximo'}
              <input type="number" min="0" step="0.01" className={control} value={filters['precio_' + key] ?? ''}
                onChange={e => field('precio_' + key, e.target.value)} />
            </label>)}</div>
        </fieldset>
      </>}
      {report === 'R3' && <>
        {select('Profesional ofrecido', 'id_profesional', professionals)}
        {hours('pref', 'Horario preferido')}
        {hours('ofr', 'Horario ofrecido')}
      </>}
      {report !== 'R1' && select('Motivo de rechazo', 'id_motivo', reasonOptions.map(row => ({
        id: String(row.id_motivo_rechazo), name: String(row.motivo),
      })))}
    </div>
    <div className="flex flex-wrap gap-4 text-sm">
      <button type="button" className={control} onClick={() => setFilters(defaults)}>Limpiar</button>
      {report === 'R1' && <label className="flex items-center gap-2"><input type="checkbox"
        checked={filters.desglosar_canal === 'true'} onChange={e => field('desglosar_canal', e.target.checked ? 'true' : '')} />
        Desglosar por canal de origen
      </label>}
    </div>
    {loading && <p role="status">Cargando reporte…</p>}
    {(error || catalogError) && <p role="alert">{error || catalogError} <button type="button" className={control}
      onClick={() => setRetry(retry + 1)}>Reintentar</button></p>}
    {result && <>
      {rows.length === 0 && <p>Sin registros para los filtros seleccionados.</p>}
      {report === 'R1' && <>
        <p className="font-semibold">L1 · Tasa de aceptación de oportunidades comerciales: {leadPercent(r1Total?.AceptacionPorcentaje)}</p>
        <ReportTable columns={['Tratamiento', ...(filters.desglosar_canal ? ['Canal de origen'] : []), 'Ingresadas',
          'Aceptadas', 'Cerradas sin acuerdo', 'Pendientes', 'Aceptación %', 'Valor acordado (S/)']}
          footer={r1Total && <R1Row row={r1Total} channel={filters.desglosar_canal === 'true' ? '—' : undefined} />}>
          {rows.filter(row => !row.EsTotal).map(row => <R1Row key={[row.Mes, row.Tratamiento, row.IdCanal].join('|')}
            row={row} channel={filters.desglosar_canal === 'true'
              ? String(catalog('canales').find(c => c.id_canal === row.IdCanal)?.nombre ?? 'Sin canal') : undefined} />)}
        </ReportTable>
        {Number(r1Total?.SinResultadoDocumentado ?? 0) > 0 &&
          <p className="text-sm text-slate-500">Sin resultado documentado: {r1Total?.SinResultadoDocumentado}.</p>}
      </>}
      {report === 'R2' && <>
        <p className="font-semibold">L2 · Tasa de rechazo por motivos económicos: {leadPercent(summary?.L2Porcentaje)}</p>
        <ReportTable columns={['Fecha / Propuesta', 'Tratamiento', 'Precio cotizado (S/)', 'Promoción aplicada', 'Resultado', 'Motivo de rechazo']}>
          {rows.map(row => <tr key={String(row.id_propuesta_logica)}>
            <td className={cell}>PROP-{row.id_propuesta_logica}<br />{dateLabel(row.fecha_presentacion)}</td>
            <td className={cell}>{row.Tratamiento}</td><td className={cell}>{money(row.PrecioCotizado)}</td>
            <td className={cell}>{row.PromocionAplicada}</td><td className={cell}>{row.Resultado ?? 'Sin evidencia'}</td>
            <td className={cell}>{row.MotivoRechazo ?? '—'}</td>
          </tr>)}
        </ReportTable>
        {summary && <p>{summaryLabel} · Presentadas {summary.Presentadas} · Aceptadas {summary.Aceptadas} · Rechazadas {summary.Rechazadas} · Pendientes {summary.Pendientes} · Aceptación {leadPercent(summary.AceptacionPorcentaje)}</p>}
      </>}
      {report === 'R3' && <>
        <p className="font-semibold">L3 · Tasa de rechazo por incompatibilidad: {leadPercent(summary?.L3Porcentaje)}</p>
        <ReportTable columns={['Solicitud / Alternativa', 'Horario preferido', 'Horario ofrecido', 'Resultado', 'Motivo de rechazo', 'N.º cambios']}>
          {rows.map(row => <tr key={String(row.id_opcion)}>
            <td className={cell}>SOL-{row.id_solicitud} / ALT-{row.id_opcion}<br />{dateLabel(row.fecha_ofrecida)}</td>
            <td className={cell}>{schedule(row.pref_dia_semana_lead, row.pref_turno_lead, row.pref_hora_inicio_lead, row.pref_hora_fin_lead, row.pref_fecha_lead)}</td>
            <td className={cell}>{schedule(row.DiaOfrecido, row.ofr_turno_lead, row.HoraInicioOfrecida, row.HoraFinOfrecida, row.FechaAtencionOfrecida)}</td>
            <td className={cell}>{row.Resultado ?? 'Sin evidencia'}</td><td className={cell}>{row.MotivoRechazo ?? '—'}</td>
            <td className={cell}>{row.NumeroCambios ?? 0}</td>
          </tr>)}
        </ReportTable>
        {summary && <p>{summaryLabel} · Presentadas {summary.Presentadas} · Aceptadas {summary.Aceptadas} · Rechazadas {summary.Rechazadas} · Pendientes {summary.Pendientes} · Modificadas {summary.Modificadas}</p>}
      </>}
      {groups.length > 0 && <details>
        <summary>{report === 'R2' ? 'Desglose por tratamiento, promoción y resultado' : 'Desglose por sede, horario ofrecido y resultado'}</summary>
        <ReportTable columns={report === 'R2' ? ['Tratamiento', 'Condición comercial', 'Resultado', 'Propuestas'] : ['Sede', 'Horario ofrecido', 'Resultado', 'Alternativas']}>
          {groups.map(group => <tr key={JSON.stringify(group.labels)}>{group.labels.map((value, i) =>
            <td key={i} className={cell}>{value}</td>)}<td className={cell}>{group.total}</td></tr>)}
        </ReportTable>
      </details>}
    </>}
  </section>;
}

function R1Row({ row, channel }: { row: Row; channel?: string }) {
  const values = [row.Tratamiento,
    ...(channel === undefined ? [] : [channel]), row.Ingresadas, row.Aceptadas, row.CerradasSinAcuerdo,
    row.Pendientes ?? 0, leadPercent(row.AceptacionPorcentaje), money(row.ValorAcordadoSoles)];
  return <tr>{values.map((value, index) => <td className={cell} key={index}>{value}</td>)}</tr>;
}
