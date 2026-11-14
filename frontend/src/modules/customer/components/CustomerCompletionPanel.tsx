import { useCallback, useEffect, useRef, useState } from 'react';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { patientAuthApi } from '@/shared/services/patientAuthService';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  RefreshCw, 
  Stethoscope,
  X,
  Image as ImageIcon,
  Send,
  ExternalLink,
  Star
} from 'lucide-react';

const labels: Record<string, string> = { 
  motivo_consulta: 'Motivo de consulta',
  antecedentes: 'Antecedentes',
  alergias: 'Alergias documentadas',
  evaluacion: 'Evaluación declarada',
  procedimiento: 'Procedimiento registrado',
  observaciones: 'Observaciones',
  indicaciones_finales: 'Indicaciones del profesional' 
};

function policyConfiguration(value: string): Record<string, unknown> {
  try { 
    const config = JSON.parse(value); 
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {}; 
  } catch { 
    return {}; 
  }
}

type Props = { 
  audience: 'patient' | 'staff'; 
  attentionId?: number; 
  treatmentId?: number; 
  role?: string; 
  onChanged?: () => void; 
  onDocumentationChanged?: () => void;
};

export default function CustomerCompletionPanel({
  audience,
  attentionId,
  treatmentId,
  role,
  onChanged,
  onDocumentationChanged
}: Props) {
  const [requests, setRequests] = useState<any[]>([]); 
  const [pending, setPending] = useState<number[]>([]); 
  const [slots, setSlots] = useState<any[]>([]);
  const [number, setNumber] = useState(''); 
  const [slot, setSlot] = useState(''); 
  const [prepared, setPrepared] = useState<any>(null);
  const [notes, setNotes] = useState(''); 
  const [draft, setDraft] = useState<any>(null); 
  const [sections, setSections] = useState<Record<string, string>>({}); 
  const [savedSections, setSavedSections] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<any>(null); 
  const [evidence, setEvidence] = useState('');
  const [transferConfirmed, setTransferConfirmed] = useState(false); 
  const [confirmed, setConfirmed] = useState(false); 
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); 
  const [message, setMessage] = useState(''); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadVersion = useRef(0);
  const [policies, setPolicies] = useState<any[]>([]); 
  const [services, setServices] = useState<any[]>([]);
  const [policyCode, setPolicyCode] = useState('DOCUMENTACION'); 
  const [serviceId, setServiceId] = useState(''); 
  const [source, setSource] = useState(''); 
  const [version, setVersion] = useState(1); 
  const [windowMinutes, setWindowMinutes] = useState('');
  const [requiresProcedure, setRequiresProcedure] = useState(false); 
  const [requiresInstructions, setRequiresInstructions] = useState(false);
  const [required, setRequired] = useState<string[]>([]); 
  const [template, setTemplate] = useState('');
  const [capabilities, setCapabilities] = useState({ externalDraftingEnabled: false }); 
  const [useLlm, setUseLlm] = useState(false);
  const [showOriginalDetails, setShowOriginalDetails] = useState(false);

  const api = useCallback(async (path: string, body?: unknown, base = '/completion') => {
    const token = audience === 'patient' ? patientAuthApi.getAccessToken() : staffAuthService.getAccessToken();
    if (!token) throw new Error('Se requiere una sesión válida.');
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/customer/ai-agent${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const result = await response.json(); 
    if (!response.ok) throw new Error(result.error?.message || result.error || 'La operación no pudo completarse.'); 
    return result.data;
  }, [audience]);

  const load = useCallback(async () => {
    const v = ++loadVersion.current;
    setLoading(true);
    try {
      const roleUpper = (role || '').toUpperCase();
      const isDentistRole = roleUpper.includes('ODONTOLOG') || roleUpper.includes('ADMIN');
      const staff = audience === 'staff' && isDentistRole;
      const [rows, caps, patientData, policyRows, catalog, latestDraft] = await Promise.all([
        api('/requests'),
        api('/capabilities'),
        audience === 'patient' && treatmentId 
          ? Promise.all([
              api(`/treatments/${treatmentId}/pending-sessions`),
              api(`/treatments/${treatmentId}/slots`),
              api(`/treatments/${treatmentId}/sessions`, undefined, '')
            ])
          : null,
        staff ? api('/policies') : [],
        staff ? api('/catalog') : [],
        staff && attentionId ? api(`/attentions/${attentionId}/clinical-drafts/latest`).catch(() => null) : null
      ]);
      if (v !== loadVersion.current) return;
      setRequests(rows || []);
      setCapabilities(caps || { externalDraftingEnabled: false });
      setPolicies(policyRows || []);
      setServices(catalog || []);
      if (patientData) {
        setPending(patientData[0]?.pendingNumbers || []);
        setSlots(patientData[1] || []);
      }
      if (latestDraft && latestDraft.draft) {
        setDraft(latestDraft.draft);
        setTransferConfirmed(Boolean(latestDraft.draft.fecha_transferencia_ficha));
        setSections(latestDraft.content.sections || {});
        setSavedSections(latestDraft.content.sections || {});
        if (latestDraft.content.originalNotes) {
          setNotes(prev => prev || latestDraft.content.originalNotes);
        }
      }
    } finally {
      if (v === loadVersion.current) setLoading(false);
    }
  }, [api, audience, treatmentId, role]);

  useEffect(() => {
    setDraft(null);
    setCheck(null);
    setPrepared(null);
    setConfirmed(false);
    setClosureConfirmed(false);
    void load().catch(e => setError(e.message));
  }, [load, attentionId]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  async function act(work: () => Promise<unknown>, notice = 'Operación registrada exitosamente.') {
    setBusy(true); 
    setError(''); 
    setMessage('');
    try {
      await work();
      setMessage(notice);
      setConfirmed(false);
      setClosureConfirmed(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  async function openDraft(data: any) {
    const detail = await api(`/clinical-drafts/${data.id_borrador_ia}`);
    setDraft(detail.draft || data);
    setTransferConfirmed(false);
    setSections(detail.content.sections || {});
    setSavedSections(detail.content.sections || {});
    setConfirmed(false);
  }

  const dirtySections = [...new Set([...Object.keys(sections), ...Object.keys(savedSections)])]
    .some(field => (sections[field] || '') !== (savedSections[field] || ''));

  const roleUpper = (role || '').toUpperCase();
  const dentist = audience === 'staff' && (roleUpper.includes('ODONTOLOG') || roleUpper.includes('ADMIN')); 
  const operations = audience === 'staff' && (roleUpper.includes('ADMIN') || roleUpper.includes('RECEPCION'));

  return (
    <section className="my-6 rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm transition-all" aria-label="Continuidad y revisión supervisada">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[color:var(--pt-line)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[color:var(--pt-ink)]">Registro y Validación Clínica Supervisada</h2>
            <p className="text-xs text-[color:var(--pt-muted)]">Asistente documental con trazabilidad y estructuración sin pérdida de texto</p>
          </div>
        </div>
        <button 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-xs font-semibold text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] transition-colors disabled:opacity-50"
          type="button" 
          disabled={busy} 
          onClick={() => void act(load, 'Información actualizada.')}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy || loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Notificaciones Flotantes en la Esquina Inferior Derecha (Toast Fijo) */}
      <aside aria-label="Notificaciones del sistema" className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {message && (
          <div 
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-emerald-500/60 ring-1 ring-emerald-500/30 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Notificación del Sistema</p>
              <p className="text-xs text-slate-100 font-medium leading-relaxed mt-0.5">{message}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setMessage('')} 
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
              aria-label="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div 
            role="alert"
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-rose-500/60 ring-1 ring-rose-500/30 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Atención Requerida</p>
              <p className="text-xs text-slate-100 font-medium leading-relaxed mt-0.5">{error}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setError('')} 
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
              aria-label="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* Panel para Paciente: Programación y Confirmaciones */}
      {audience === 'patient' && treatmentId && (
        <fieldset className="min-w-0 space-y-4 my-4">
          <legend className="text-sm font-bold text-[color:var(--pt-ink)]">Programar una nueva sesión del plan</legend>
          <p className="text-xs text-[color:var(--pt-muted)]">La solicitud requiere confirmación del paciente y revisión de recepción. No reserva un cupo automáticamente.</p>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)] mb-1">Sesión prevista</label>
              <select className="w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" value={number} onChange={e => { setNumber(e.target.value); setPrepared(null); }}>
                <option value="">Seleccionar ordinal</option>
                {pending.map(n => <option key={n} value={n}>Sesión #{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)] mb-1">Horario disponible</label>
              <select className="w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" value={slot} onChange={e => { setSlot(e.target.value); setPrepared(null); }}>
                <option value="">Seleccionar horario</option>
                {slots.map(s => <option key={s.slotId} value={s.slotId}>{new Date(s.date).toLocaleString('es-PE', { timeZone: 'America/Lima' })} · {s.professionalName} ({s.branchName})</option>)}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button 
              className="px-4 py-2 rounded-xl bg-[var(--pt-accent)] text-white text-xs font-semibold hover:bg-[var(--pt-accent)]/90 transition-colors disabled:opacity-50"
              type="button" 
              disabled={busy || !number || !slot} 
              onClick={() => void act(async () => setPrepared(await api('/scheduling/prepare', { treatmentId, number: Number(number), slotId: Number(slot), idempotencyKey: crypto.randomUUID() })), 'Propuesta preparada; todavía no registrada.')}
            >
              Preparar propuesta
            </button>
          </div>

          {prepared && (
            <div className="p-4 rounded-xl border border-[color:var(--pt-accent)]/40 bg-[var(--pt-accent-soft)] space-y-3">
              <p className="text-xs text-[color:var(--pt-ink)] leading-relaxed">{prepared.summary}</p>
              <button 
                className="px-4 py-2 rounded-xl bg-[var(--pt-accent)] text-white text-xs font-semibold hover:bg-[var(--pt-accent)]/90 transition-colors"
                type="button" 
                disabled={busy} 
                onClick={() => void act(async () => { await api('/scheduling/confirm', { confirmationToken: prepared.confirmationToken }); setPrepared(null); }, 'Solicitud confirmada y enviada a recepción.')}
              >
                Confirmar y enviar a recepción
              </button>
            </div>
          )}
        </fieldset>
      )}

      {/* Panel Odontólogo: Asistencia al Registro Clínico */}
      {dentist && attentionId && (
        <fieldset className="min-w-0 space-y-5 my-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[color:var(--pt-ink)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[color:var(--pt-accent)]" />
              Asistencia al Registro Clínico
            </h3>
            <p className="text-xs text-[color:var(--pt-muted)] leading-relaxed">
              Escribe tus notas de evolución o procedimiento. La organización extractiva con IA conservará íntegramente tu contenido sin inferir ni inventar datos.
            </p>
          </div>

          {/* Área de Notas Originales */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="notes-input" className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                Notas originales del profesional
              </label>
              {!notes.trim() && (
                <button
                  type="button"
                  onClick={() => setNotes(`Motivo: Restauración estética de pieza anterior\nEvaluación: Esmalte y dentina íntegros tras preparación\nProcedimiento: Restauración con resina compuesta en pieza 2.1\nIndicaciones: Evitar alimentos duros o pigmentantes por 24 horas. Paracetamol 500mg cada 8 horas si hay molestia.`)}
                  className="text-[11px] font-semibold text-[color:var(--pt-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  ⚡ Cargar notas del procedimiento
                </button>
              )}
            </div>
            <textarea 
              id="notes-input"
              aria-label="Notas originales del profesional"
              className="w-full min-h-28 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-xs text-[color:var(--pt-ink)] placeholder-[color:var(--pt-muted)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)] transition-all font-mono leading-relaxed" 
              value={notes} 
              maxLength={8000} 
              onChange={e => setNotes(e.target.value)} 
              placeholder={`Motivo: Restauración estética de pieza anterior\nEvaluación: Esmalte y dentina íntegros tras preparación\nProcedimiento: Restauración con resina compuesta en pieza 2.1\nIndicaciones: Evitar alimentos duros por 24 horas. Paracetamol 500mg cada 8 horas si hay molestia.`}
            />
          </div>

          {/* Opciones y Acción de Preparación */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl bg-[var(--pt-sunken)] border border-[color:var(--pt-line)]">
            <label className="flex items-center gap-2 text-xs text-[color:var(--pt-ink-2)] cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={useLlm} 
                disabled={!capabilities.externalDraftingEnabled} 
                onChange={e => setUseLlm(e.target.checked)}
                className="w-4 h-4 rounded border-[color:var(--pt-line)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)]"
              />
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Estructurar con IA externa autorizada
              </span>
            </label>

            <button 
              type="button" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--pt-accent)] text-white text-xs font-semibold hover:bg-[var(--pt-accent)]/90 transition-all shadow-sm disabled:opacity-50"
              disabled={busy || !notes.trim()} 
              onClick={() => void act(async () => openDraft(await api(`/attentions/${attentionId}/clinical-drafts`, { notes, idempotencyKey: crypto.randomUUID(), useLlm })), 'Borrador estructurado listo para revisión. La historia oficial aún no cambia.')}
            >
              <Sparkles className="w-4 h-4" />
              {useLlm ? 'Preparar borrador con IA' : 'Preparar borrador extractivo'}
            </button>
          </div>

          {/* Tarjeta de Borrador Estructurado */}
          {draft && (
            <div className="p-5 rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] shadow-md space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[color:var(--pt-line)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] uppercase">
                    Borrador v{draft.version_borrador}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Estado: {draft.estado}
                  </span>
                </div>
                {draft.fecha_transferencia_ficha && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Transferido a Ficha
                  </span>
                )}
              </div>

              {/* Advertencias */}
              {JSON.parse(draft.contenido_sugerido).warnings?.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Nota de reemplazo:
                  </p>
                  {JSON.parse(draft.contenido_sugerido).warnings.map((w: string, i: number) => (
                    <p key={i} className="pl-5 text-[11px] text-amber-800">{w}</p>
                  ))}
                </div>
              )}

              {/* Acordeón de Notas Originales */}
              <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] overflow-hidden text-xs">
                <button 
                  type="button" 
                  onClick={() => setShowOriginalDetails(!showOriginalDetails)}
                  className="w-full flex items-center justify-between p-3 font-semibold text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-surface)] transition-colors"
                >
                  <span>Ver texto original ingresado y ficha previa</span>
                  {showOriginalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showOriginalDetails && (
                  <div className="p-3 pt-0 border-t border-[color:var(--pt-line)] space-y-2 text-[color:var(--pt-ink)]">
                    <p className="font-mono text-[11px] whitespace-pre-wrap bg-[var(--pt-surface)] p-2.5 rounded-lg border border-[color:var(--pt-line)]">
                      {JSON.parse(draft.contenido_sugerido).originalNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Secciones Estructuradas en Cards Limpias */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-muted)]">
                  Campos Clínicos Estructurados (Edita antes de transferir)
                </h4>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  {Object.entries(labels).map(([field, label]) => {
                    const hasValue = Boolean(sections[field]?.trim());
                    return (
                      <div 
                        key={field} 
                        className={`rounded-xl border p-3 transition-all ${
                          hasValue 
                            ? 'border-[color:var(--pt-line)] bg-[var(--pt-surface)] shadow-xs' 
                            : 'border-dashed border-[color:var(--pt-line-strong)]/60 bg-[var(--pt-sunken)]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor={`field-${field}`} className="text-xs font-bold text-[color:var(--pt-ink-2)]">
                            {label}
                          </label>
                          {!hasValue && (
                            <span className="text-[10px] text-[color:var(--pt-muted)] italic">Sin datos en notas</span>
                          )}
                        </div>
                        <textarea 
                          id={`field-${field}`}
                          aria-label={label}
                          className="w-full min-h-16 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)] transition-all leading-relaxed" 
                          disabled={busy || Boolean(draft.fecha_transferencia_ficha)} 
                          maxLength={['motivo_consulta', 'alergias'].includes(field) ? 300 : 500} 
                          value={sections[field] || ''} 
                          placeholder={hasValue ? '' : `Sin mención en las notas`}
                          onChange={e => {
                            setSections(v => ({ ...v, [field]: e.target.value }));
                            setConfirmed(false);
                            setTransferConfirmed(false);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón Guardar Versión si hay cambios */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-xs font-semibold text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-surface)] transition-all disabled:opacity-50"
                  disabled={busy || Boolean(draft.fecha_transferencia_ficha)} 
                  type="button" 
                  onClick={() => void act(async () => openDraft(await api(`/clinical-drafts/${draft.id_borrador_ia}/revisions`, { sections })), 'Nueva versión guardada.')}
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar nueva versión corregida
                </button>

                {dirtySections && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                    ⚠️ Hay correcciones sin guardar en la versión actual.
                  </span>
                )}
              </div>

              {/* Confirmación y Transferencia a Ficha Oficial */}
              <div className="pt-4 border-t border-[color:var(--pt-line)] space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--pt-ink-2)] cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    aria-label="He revisado cada sección y confirmo la acción profesional seleccionada."
                    disabled={busy || Boolean(draft.fecha_transferencia_ficha)} 
                    checked={transferConfirmed} 
                    onChange={e => setTransferConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-[color:var(--pt-line)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)]"
                  />
                  <span>He revisado cada sección y confirmo la acción profesional seleccionada.</span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  {!draft.fecha_transferencia_ficha ? (
                    <button 
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={busy || !transferConfirmed || dirtySections} 
                      type="button" 
                      onClick={() => void act(async () => {
                        await api(`/clinical-drafts/${draft.id_borrador_ia}/transfer`, { confirmed: true });
                        await openDraft(draft);
                        onDocumentationChanged?.();
                      }, 'Contenido transferido oficialmente a la historia clínica.')}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Transferir esta versión a la ficha oficial
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5 w-full p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mr-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Borrador aprobado y transferido a la ficha oficial</span>
                      </div>
                      
                      {attentionId && (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => window.open(`/api/customer/media/aftercare/${attentionId}.png`, '_blank')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-300 bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold transition-all shadow-2xs"
                            title="Previsualizar imagen gráfica con logo y cuidados aprobados"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver Tarjeta Gráfica
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void act(
                              () => api(`/attentions/${attentionId}/nps/send`),
                              'Encuesta NPS de satisfacción enviada exitosamente al WhatsApp del paciente.'
                            )}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 text-xs font-bold transition-all shadow-2xs"
                            title="Enviar encuesta NPS de recomendación al WhatsApp del paciente"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            Mandar Encuesta NPS
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void act(
                              () => api(`/attentions/${attentionId}/aftercare-card/send`, { immediate: true }),
                              'Guía gráfica post-atención enviada exitosamente al WhatsApp del paciente.'
                            )}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-bold transition-all shadow-sm"
                            title="Enviar tarjeta de cuidados por WhatsApp inmediatamente al paciente"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Mandar indicaciones por WhatsApp ahora
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Acciones de Validación y Cierre de Sesión */}
          <div className="p-4 rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)]/60 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-ink-2)]">
              Acciones Finales de la Atención
            </h4>
            <p className="text-xs text-[color:var(--pt-muted)]">
              Comprueba los requisitos documentales exigidos por la clínica antes de validar y cerrar la sesión.
            </p>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--pt-ink-2)] cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  aria-label="Confirmo la revisión y la acción profesional seleccionada."
                  disabled={busy} 
                  checked={confirmed} 
                  onChange={e => setConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-[color:var(--pt-line)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)]"
                />
                <span>Confirmo la revisión y la acción profesional seleccionada.</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button 
                type="button" 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-xs font-semibold text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] transition-colors shadow-xs disabled:opacity-50"
                disabled={busy} 
                onClick={() => void act(async () => setCheck(await api(`/attentions/${attentionId}/validate`, { confirmed: false })), 'Comprobación de requisitos actualizada.')}
              >
                <ShieldCheck className="w-4 h-4 text-[color:var(--pt-accent)]" />
                Comprobar requisitos
              </button>

              <button 
                type="button" 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-xs font-semibold text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] transition-colors shadow-xs disabled:opacity-40"
                disabled={busy || !confirmed} 
                onClick={() => void act(async () => {
                  setCheck(await api(`/attentions/${attentionId}/validate`, { confirmed: true }));
                  onDocumentationChanged?.();
                }, 'Validación profesional registrada en historia clínica.')}
              >
                <Check className="w-4 h-4 text-emerald-600" />
                Registrar validación profesional
              </button>

              <button 
                type="button" 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-xs disabled:opacity-40"
                disabled={busy || !confirmed} 
                onClick={() => void act(() => api(`/attentions/${attentionId}/outcome`, { confirmed: true, action: 'FINALIZAR_ATENCION' }), 'Atención marcada como realizada.')}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Registrar atención realizada
              </button>

              <button 
                type="button" 
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors shadow-md disabled:opacity-40"
                disabled={busy || !confirmed} 
                onClick={() => void act(() => api(`/attentions/${attentionId}/close`, { confirmed: true }), 'Sesión cerrada y validada formalmente.')}
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                Cerrar sesión con validación
              </button>
            </div>

            {/* Resultado de Comprobación */}
            {check && (
              <div aria-label="Resultado de comprobación documental" className="mt-3 p-3.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-xs space-y-2">
                <p className={`font-semibold flex items-center gap-1.5 ${check.blocked ? 'text-[color:var(--pt-danger)]' : check.pending.length ? 'text-amber-800' : 'text-emerald-700'}`}>
                  {check.blocked 
                    ? <><AlertCircle className="w-4 h-4" /> Comprobación bloqueada; revise requisitos institucionales.</>
                    : check.pending.length 
                      ? <><AlertCircle className="w-4 h-4 text-amber-600" /> Pendientes documentales actuales:</>
                      : <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sin pendientes. Documentación completa para cierre.</>
                  }
                </p>
                {check.pending.length > 0 && (
                  <ul className="list-disc list-inside pl-2 space-y-1 text-[color:var(--pt-ink-2)]">
                    {check.pending.map((v: string) => (
                      <li key={v}>
                        {labels[v] || ({ procedimiento_confirmado: 'Procedimiento confirmado', indicaciones_emitidas: 'Indicaciones vigentes, aprobadas y emitidas' } as Record<string, string>)[v] || v}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-[color:var(--pt-muted)]">
                  {check.validationRecorded ? 'Validación registrada por confirmación profesional. La ficha no se ha cerrado.' : 'Consulta de solo lectura: no registra una validación, no firma ni cierra la ficha.'}
                </p>
                <p className="text-[11px] text-[color:var(--pt-muted)]">
                  La comprobación verifica registros; no certifica su exactitud clínica.
                </p>
              </div>
            )}
          </div>

          {/* Tarjeta Gráfica de Cuidados Post-Atención Digital NexoSalud */}
          {attentionId && (
            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/60 to-emerald-50/40 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-teal-600 text-white shadow-sm">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                      Guía Gráfica Post-Atención
                      <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-semibold">
                        NexoSalud Brand
                      </span>
                    </h4>
                    <p className="text-[11px] text-teal-800/80">
                      Generada automáticamente con indicaciones y logo oficial.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.open(`/api/customer/media/aftercare/${attentionId}.png`, '_blank')}
                  className="px-2.5 py-1 rounded-lg border border-teal-300 bg-white hover:bg-teal-50 text-teal-800 font-semibold text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                  title="Ver imagen en alta definición"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver Tarjeta
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-teal-100/80">
                <p className="text-[11px] text-teal-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Envío programado a WhatsApp tras el cierre clínico (diferido 1h).
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(
                      () => api(`/attentions/${attentionId}/nps/send`),
                      'Encuesta NPS de satisfacción enviada exitosamente al WhatsApp del paciente.'
                    )}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-95 disabled:opacity-40 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                    title="Enviar encuesta NPS de recomendación (0 al 10) inmediatamente"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                    Enviar Encuesta NPS (0-10)
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act(
                      () => api(`/attentions/${attentionId}/aftercare-card/send`, { immediate: true }),
                      'Tarjeta gráfica post-atención enviada exitosamente al WhatsApp del paciente.'
                    )}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar Tarjeta a WhatsApp ahora
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Acordeón Decisión Formal de Cierre de Tratamiento */}
          {treatmentId && (
            <details className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 text-xs space-y-3">
              <summary className="font-semibold cursor-pointer text-[color:var(--pt-ink)]">Decisión formal de cierre del tratamiento</summary>
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Evidencia y decisión profesional
                  <textarea 
                    aria-label="Evidencia y decisión profesional"
                    className="w-full min-h-16 mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" 
                    value={evidence} 
                    onChange={e => setEvidence(e.target.value)} 
                    maxLength={500}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--pt-ink-2)] cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    aria-label="He revisado el checklist y confirmo personalmente la conclusión del tratamiento."
                    checked={closureConfirmed} 
                    onChange={e => setClosureConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-[color:var(--pt-line)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)]"
                  />
                  <span>He revisado el checklist y confirmo personalmente la conclusión del tratamiento.</span>
                </label>
                <button 
                  type="button" 
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-all disabled:opacity-40"
                  disabled={busy || !confirmed || !closureConfirmed || !evidence.trim()} 
                  onClick={() => void act(() => api(`/treatments/${treatmentId}/close`, { confirmed: true, evidence }), 'Decisión formal registrada por confirmación profesional.')}
                >
                  Confirmar decisión y transición oficial
                </button>
                <p className="text-[11px] text-[color:var(--pt-muted)]">
                  No se ejecuta por conteo automático. Las excepciones o revisiones pendientes bloquean la operación.
                </p>
              </div>
            </details>
          )}
        </fieldset>
      )}

      {/* Bandeja de Solicitudes y Revisiones Humanas */}
      <details open={operations} className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 text-xs space-y-3 my-3">
        <summary className="font-semibold cursor-pointer text-[color:var(--pt-ink)]">Bandeja de solicitudes y revisiones humanas</summary>
        <div className="space-y-3 mt-3">
          {!requests.length && <p className="text-[color:var(--pt-muted)]">No hay solicitudes autorizadas para este perfil.</p>}
          {requests.map(r => (
            <article key={r.id_solicitud} className="border-b border-[color:var(--pt-line)] py-3 space-y-2">
              <p className="font-semibold text-[color:var(--pt-ink)]">
                {r.tipo === 'AGENDAMIENTO' ? 'Programación de sesión' : r.tipo === 'DERIVACION' ? 'Revisión humana' : 'Decisión de cierre'} · {r.estado} · {new Date(r.fecha_creacion).toLocaleString('es-PE')}
              </p>
              {r.tipo === 'AGENDAMIENTO' && (
                <p className="text-[color:var(--pt-muted)]">
                  Sesión {JSON.parse(r.payload).number} · {JSON.parse(r.payload).date ? new Date(JSON.parse(r.payload).date).toLocaleString('es-PE') : 'Horario por verificar'} · {JSON.parse(r.payload).professionalName} · {JSON.parse(r.payload).branchName}
                </p>
              )}
              {((operations && r.tipo === 'AGENDAMIENTO') || (dentist && r.tipo === 'DERIVACION')) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <label className="text-xs text-[color:var(--pt-ink-2)]">
                    Evidencia de revisión
                    <input 
                      aria-label={`Evidencia de solicitud ${r.id_solicitud}`} 
                      className="ml-2 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-2 py-1 text-xs text-[color:var(--pt-ink)]" 
                      value={evidence} 
                      onChange={e => setEvidence(e.target.value)} 
                      maxLength={500}
                    />
                  </label>
                  {(r.tipo === 'AGENDAMIENTO' ? ['En_Revision', 'Aprobada', 'Rechazada'] : ['En_Revision', 'Atendida', 'Resuelta']).map(status => (
                    <button 
                      type="button" 
                      key={status} 
                      className="px-2.5 py-1 rounded-lg border border-[color:var(--pt-line)] text-xs hover:bg-[var(--pt-sunken)]" 
                      disabled={busy || !evidence.trim()} 
                      onClick={() => void act(() => api(`/requests/${r.id_solicitud}/review`, { status, evidence }))}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                  {r.tipo === 'AGENDAMIENTO' && r.estado === 'Aprobada' && (
                    <button 
                      className="px-3 py-1 rounded-lg bg-[var(--pt-accent)] text-white text-xs font-semibold" 
                      type="button" 
                      disabled={busy} 
                      onClick={() => void act(() => api(`/requests/${r.id_solicitud}/apply`, {}), 'Programación aplicada por la agenda oficial.')}
                    >
                      Aplicar programación aprobada
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </details>

      {/* Plantillas y Políticas */}
      {audience === 'staff' && ['ADMIN', 'ODONTOLOGO'].includes(role || '') && (
        <details className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 text-xs space-y-3 my-3">
          <summary className="font-semibold cursor-pointer text-[color:var(--pt-ink)]">Plantillas y políticas: revisión y publicación</summary>
          <p className="text-xs text-[color:var(--pt-muted)] my-2">Las pruebas sintéticas no acreditan aprobación institucional. Publicar requiere revisión profesional previa.</p>
          
          {role === 'ADMIN' && (
            <div className="grid gap-3 sm:grid-cols-2 p-3 rounded-xl bg-[var(--pt-sunken)] border border-[color:var(--pt-line)]">
              <label className="text-xs font-semibold">
                Ámbito
                <select className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 text-xs" value={policyCode} onChange={e => setPolicyCode(e.target.value)}>
                  <option value="DOCUMENTACION">Documentación por servicio</option>
                  <option value="CONFIRMACION">Confirmación de sesiones</option>
                  <option value="DERIVACION">Revisión humana de consultas</option>
                  <option value="PLANTILLA_INDICACIONES">Plantilla de indicaciones</option>
                </select>
              </label>
              <label className="text-xs font-semibold">
                Servicio
                <select className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 text-xs" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                  <option value="">Seleccionar cuando corresponda</option>
                  {services.map(s => <option key={s.id_servicio} value={s.id_servicio}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Referencia de la aprobación o documento fuente
                <input className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 text-xs" value={source} onChange={e => setSource(e.target.value)} />
              </label>
              <label className="text-xs font-semibold">
                Versión
                <input type="number" className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 text-xs" min={1} value={version} onChange={e => setVersion(Number(e.target.value))} />
              </label>

              {policyCode === 'DOCUMENTACION' && (
                <fieldset className="col-span-2 space-y-1.5 p-2 rounded-lg border border-[color:var(--pt-line)]">
                  <legend className="text-xs font-bold">Campos exigidos por la política</legend>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={requiresProcedure} onChange={e => setRequiresProcedure(e.target.checked)} />
                    Exigir procedimiento confirmado
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={requiresInstructions} onChange={e => setRequiresInstructions(e.target.checked)} />
                    Exigir indicaciones aprobadas y emitidas
                  </label>
                  {Object.entries(labels).map(([field, label]) => (
                    <label className="flex items-center gap-2 text-xs" key={field}>
                      <input type="checkbox" checked={required.includes(field)} onChange={e => setRequired(v => e.target.checked ? [...v, field] : v.filter(f => f !== field))} />
                      {label}
                    </label>
                  ))}
                </fieldset>
              )}

              {policyCode === 'CONFIRMACION' && (
                <label className="text-xs font-semibold">
                  Ventana autorizada en minutos
                  <input className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 text-xs" type="number" min={1} value={windowMinutes} onChange={e => setWindowMinutes(e.target.value)} />
                </label>
              )}

              {['PLANTILLA_INDICACIONES', 'DERIVACION'].includes(policyCode) && (
                <label className="col-span-2 text-xs font-semibold">
                  {policyCode === 'DERIVACION' ? 'Expresiones aprobadas para solicitar revisión, separadas por coma' : 'Contenido de plantilla aprobado'}
                  <textarea className="w-full mt-1 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-2 text-xs" value={template} onChange={e => setTemplate(e.target.value)} />
                </label>
              )}

              <div className="col-span-2 pt-2">
                <button 
                  className="px-4 py-2 rounded-xl bg-[var(--pt-accent)] text-white text-xs font-semibold hover:bg-[var(--pt-accent)]/90 transition-all disabled:opacity-50"
                  type="button" 
                  disabled={busy || !source.trim()} 
                  onClick={() => void act(() => api('/policies', {
                    code: policyCode,
                    version,
                    serviceId: serviceId ? Number(serviceId) : undefined,
                    configuration: {
                      sourceReference: source,
                      ...(policyCode === 'DOCUMENTACION' 
                        ? { requiredFields: required, requiresProcedure, requiresInstructions } 
                        : policyCode === 'CONFIRMACION' 
                          ? { windowMinutes: Number(windowMinutes) } 
                          : policyCode === 'DERIVACION' 
                            ? { prioritization: 'REVISION_HUMANA', triggers: template.split(',').map(v => v.trim()) } 
                            : { text: template })
                    }
                  }), 'Política propuesta; todavía no publicada.')}
                >
                  Registrar propuesta
                </button>
              </div>
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {policies.map(p => {
              const configuration = policyConfiguration(p.configuracion);
              const serviceName = services.find(service => service.id_servicio === p.id_servicio)?.nombre || String(configuration.serviceName || 'Ámbito general');
              return (
                <li key={p.id_politica} className="rounded-xl border border-[color:var(--pt-line)] p-3 space-y-2 bg-[var(--pt-surface)]">
                  <p className="font-semibold text-xs text-[color:var(--pt-ink)]">
                    {String(configuration.title || (p.codigo === 'PLANTILLA_INDICACIONES' ? 'Plantilla de indicaciones' : p.codigo))} · {serviceName}
                  </p>
                  <p className="text-[11px] text-[color:var(--pt-muted)]">
                    Versión de política {p.version} · Estado: {p.estado} · {p.id_profesional_revisor ? `Revisión registrada por profesional #${p.id_profesional_revisor}` : 'Sin revisión profesional registrada'}
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[color:var(--pt-accent)] font-semibold">Ver contenido y procedencia antes de revisar</summary>
                    {typeof configuration.text === 'string' && (
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs bg-[var(--pt-sunken)] p-2 rounded-lg border border-[color:var(--pt-line)]">{configuration.text}</pre>
                    )}
                    <p className="mt-2 text-xs text-[color:var(--pt-ink-2)]">Procedencia: {String(configuration.sourceReference || 'No registrada')}</p>
                    {p.codigo === 'PLANTILLA_INDICACIONES' && (
                      <p className="text-xs mt-2 text-[color:var(--pt-muted)]">Los campos se completan con registros de la atención. La plantilla no añade dosis ni tratamientos; cada borrador requiere aprobación antes de emitirse al paciente.</p>
                    )}
                  </details>
                  {dentist && p.estado === 'Borrador' && (
                    <button className="px-3 py-1.5 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-xs font-semibold hover:bg-[var(--pt-surface)]" type="button" disabled={busy} onClick={() => void act(() => api(`/policies/${p.id_politica}/review`, {}))}>
                      Revisar profesionalmente
                    </button>
                  )}
                  {role === 'ADMIN' && p.estado === 'Revisada' && (
                    <button className="px-3 py-1.5 rounded-lg bg-[var(--pt-accent)] text-white text-xs font-semibold" type="button" disabled={busy} onClick={() => void act(() => api(`/policies/${p.id_politica}/publish`, {}))}>
                      Publicar política revisada
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
