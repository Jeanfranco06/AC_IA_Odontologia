import { useEffect, useState, type FormEvent } from 'react';
import { staffAuthService } from '@/shared/services/staffAuthService';

const ACTIVITY_LABELS: Record<string, string> = {
  treatments: 'Seguimiento y Cumplimiento de Tratamientos',
  sessions: 'Programación y Reprogramación de Sesiones',
  documentation: 'Atenciones Clínicas y Documentación de Ficha',
  ai: 'Supervisión de Copiloto IA y Trazabilidad',
};

export default function CustomerAnalyticsPanel() {
  const [catalog, setCatalog] = useState<any>(null);
  const [kind, setKind] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const [branch, setBranch] = useState('');
  const [service, setService] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const endpoint = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/customer/ai-agent';

  async function api(path: string, body?: unknown) {
    const response = await fetch(endpoint + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: 'Bearer ' + staffAuthService.getAccessToken(),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'No fue posible consultar el análisis autorizado.');
    return data;
  }

  useEffect(() => {
    let current = true;
    void api('/analytics/catalog')
      .then(({ data }) => {
        if (!current) return;
        setCatalog(data);
        setKind(data.allowed[0]?.kind || '');
        setStartDate(data.defaultPeriod.startDate);
        setEndDate(data.defaultPeriod.endDate);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, []);

  async function query(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    setAnswer('');
    try {
      const response = await api('/analytics/' + kind, {
        startDate,
        endDate,
        groupBy,
        ...(branch ? { branchId: Number(branch) } : {}),
        ...(service ? { serviceId: Number(service) } : {}),
      });
      setResult(response.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Consulta no disponible.');
    } finally {
      setBusy(false);
    }
  }

  async function explain(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setAnswer('');
    try {
      const selectedActivityLabel = ACTIVITY_LABELS[kind] || catalog.allowed.find((a: any) => a.kind === kind)?.kind || kind;
      const r = await api('/chat', {
        mode: 'analytics',
        message: `${question}\nActividad seleccionada: ${selectedActivityLabel}. Período inclusivo ${startDate} a ${endDate}. Agrupar por ${groupBy}.${branch ? ' Sede autorizada ' + branch + '.' : ''}${service ? ' Servicio autorizado ' + service + '.' : ''}`,
      });
      setAnswer(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El asistente no está habilitado.');
    } finally {
      setBusy(false);
    }
  }

  const label = (s: string) => s.replaceAll('_', ' ');
  const value = (v: any) => (v === null ? 'Sin denominador' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 }));

  return (
    <section aria-label="Análisis inteligente del Data Mart" className="rounded-2xl border border-[var(--pt-line)] bg-[var(--pt-surface)] p-5 space-y-5">
      <div>
        <p className="pt-eyebrow">Inteligencia de Negocios · Métricas Consolidadas</p>
        <h2 className="pt-display text-2xl">Análisis y Medidas del Data Mart</h2>
        <p className="text-sm mt-2">
          Indicadores históricos agregados de {catalog?.source || 'la conexión analítica autorizada'}. La agenda y las alertas operativas se consultan en Asistencia operacional.
        </p>
      </div>
      {error && <p role="alert" className="pt-alert">{error}</p>}
      {!catalog && !error && <p aria-live="polite">Consultando permisos y dimensiones…</p>}
      {catalog && (
        <>
          <form onSubmit={(e) => void query(e)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="pt-field">
              Área de Medición
              <select className="pt-input" value={kind} onChange={(e) => { setKind(e.target.value); setResult(null); setAnswer(''); }}>
                {catalog.allowed.map((a: any) => (
                  <option key={a.kind} value={a.kind}>
                    {ACTIVITY_LABELS[a.kind] || label(a.kind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="pt-field">
              Desde
              <input className="pt-input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="pt-field">
              Hasta
              <input className="pt-input" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="pt-field">
              Agrupar por
              <select className="pt-input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                {catalog.groupings.map((g: string) => (
                  <option key={g} value={g}>
                    {({ none: 'Total', month: 'Mes', branch: 'Sede', service: 'Servicio' } as Record<string, string>)[g] || g}
                  </option>
                ))}
              </select>
            </label>
            <label className="pt-field">
              Sede
              <select className="pt-input" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">Todas las autorizadas</option>
                {catalog.branches.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
            <label className="pt-field">
              Servicio
              <select className="pt-input" value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Todos los autorizados</option>
                {catalog.services.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
            <button className="pt-btn pt-btn-primary" type="submit" disabled={busy || !kind}>
              {busy ? 'Consultando…' : 'Consultar indicadores'}
            </button>
            <p className="text-sm">Ámbito: {catalog.scope}. Período máximo: {catalog.maxPeriodDays} días. Hasta {catalog.maxGroups} grupos.</p>
          </form>

          {result && (
            <div className="space-y-4" aria-live="polite">
              <p className="pt-note">Fuente: {result.source}. {result.fact}. {result.definition}</p>
              <p>
                {result.freshness.warning} Última sincronización: {result.freshness.lastSuccessfulSync || 'No disponible'}. Estado: {result.freshness.latestLoadStatus || 'Sin registro'}.
              </p>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(result.totals).map(([key, v]) => (
                  <div key={key} className="rounded-xl border border-[var(--pt-line)] p-3">
                    <dt className="text-sm capitalize">{label(key)}</dt>
                    <dd className="text-2xl font-semibold">{value(v)}</dd>
                  </div>
                ))}
              </dl>
              {result.groups.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="text-left my-2 font-medium">Desglose del período solicitado</caption>
                    <thead>
                      <tr>
                        {Object.keys(result.groups[0]).map((k) => (
                          <th className="p-2 text-left capitalize border-b border-[var(--pt-line)] font-semibold" key={k}>
                            {label(k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.groups.map((row: any, index: number) => (
                        <tr key={index}>
                          {Object.entries(row).map(([k, v]) => (
                            <td className="p-2 border-t border-[var(--pt-line)]" key={k}>
                              {k === 'label' ? String(v) : value(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.possiblyTruncated && (
                <p>Se alcanzó el límite de grupos; acota el período o los filtros para consultar más detalle.</p>
              )}
            </div>
          )}

          <form onSubmit={(e) => void explain(e)} className="space-y-3 border-t border-[var(--pt-line)] pt-5">
            <label className="pt-field">
              Pregunta sobre estos indicadores
              <textarea
                className="pt-input"
                maxLength={1500}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Consulta las métricas del período y explica su alcance clínico o administrativo."
              />
            </label>
            <p className="text-sm">El asistente usa herramientas analíticas acotadas. Requiere habilitación autorizada del proveedor; las consultas directas de indicadores siguen disponibles sin Gemini.</p>
            <button className="pt-btn" type="submit" disabled={busy || !question.trim()}>
              Consultar al asistente analítico
            </button>
          </form>
          {answer && <p className="pt-note whitespace-pre-wrap" role="status">{answer}</p>}
        </>
      )}
    </section>
  );
}
