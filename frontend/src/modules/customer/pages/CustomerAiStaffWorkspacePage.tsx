import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { 
  AlertTriangle, 
  BookOpen, 
  Calendar, 
  Check, 
  CheckCircle2, 
  Clock, 
  FileText, 
  LoaderCircle, 
  LogOut, 
  MessageCircle, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  Stethoscope, 
  User, 
  XCircle,
  FileCheck2,
  Send,
  AlertCircle,
  CalendarCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { 
  customerAiAgentApi, 
  type AgentAlert, 
  type AvailableSlotItem, 
  type ClinicalContext, 
  type DocumentationStatus, 
  type DocumentDraft, 
  type RescheduleRequest, 
  type StaffAttentionItem 
} from '../services/customerAiAgentApi';

export default function CustomerAiStaffWorkspacePage() {
  const navigate = useNavigate();
  const session = staffAuthService.getSession();
  const role = session?.agentRole;
  const hasSession = Boolean(session?.accessToken);
  const isDentist = role === 'ODONTOLOGO' || role === 'ADMIN';
  const isReception = role === 'RECEPCION' || role === 'ADMIN';

  const [section, setSection] = useState('workspace');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attentionId, setAttentionId] = useState('');
  const [context, setContext] = useState<ClinicalContext | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationStatus | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  
  // Drafts
  const [draftId, setDraftId] = useState('');
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);

  // Staff lists
  const [staffAttentionsList, setStaffAttentionsList] = useState<StaffAttentionItem[]>([]);
  const [availableSlotsList, setAvailableSlotsList] = useState<AvailableSlotItem[]>([]);
  
  // In-App Action Modals
  const [applyModalRequest, setApplyModalRequest] = useState<RescheduleRequest | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [applyReason, setApplyReason] = useState('');

  const [alertReviewModal, setAlertReviewModal] = useState<{ alert: AgentAlert; nextStatus: string } | null>(null);
  const [alertEvidenceText, setAlertEvidenceText] = useState('');

  const [requestReviewModal, setRequestReviewModal] = useState<{ request: RescheduleRequest; nextStatus: string } | null>(null);
  const [requestReviewReason, setRequestReviewReason] = useState('');

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string; references?: string[] }>>([]);

  async function loadAlerts() {
    const result = await customerAiAgentApi.alerts(); 
    setAlerts(result.data);
  }

  async function loadRequests() {
    const result = await customerAiAgentApi.rescheduleRequests('staff'); 
    setRequests(result.data);
  }

  async function loadStaffAttentions() {
    if (!isDentist) return;
    try {
      const res = await customerAiAgentApi.staffAttentions();
      setStaffAttentionsList(res.data);
    } catch {
      setStaffAttentionsList([]);
    }
  }

  useEffect(() => {
    if (!hasSession || !role) return;
    setBusy(true);
    Promise.all([
      isReception ? loadRequests() : Promise.resolve(),
      loadAlerts(),
      loadStaffAttentions(),
    ])
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar la información inicial.'))
      .finally(() => setBusy(false));
  }, [role, hasSession]);

  if (!session) return <Navigate to="/" replace state={{ message: 'Inicia sesión con tu cuenta institucional.' }} />;

  async function fetchAttentionData(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) { 
      setError('Ingresa un identificador de atención válido.'); 
      return; 
    }
    setBusy(true); setError(''); setContext(null); setDocumentation(null);
    try {
      const [contextResult, documentationResult] = await Promise.all([
        customerAiAgentApi.clinicalContext(id),
        customerAiAgentApi.documentationStatus(id),
      ]);
      setContext(contextResult.data);
      setDocumentation(documentationResult.data);
      setAttentionId(String(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar esta atención. Verifica que pertenezca a tu ámbito asistencial.');
    } finally {
      setBusy(false);
    }
  }

  async function loadAttention(event: FormEvent) {
    event.preventDefault();
    await fetchAttentionData(Number(attentionId));
  }

  async function openApplyModal(request: RescheduleRequest) {
    setBusy(true); setError('');
    try {
      const res = await customerAiAgentApi.availableSlots();
      setAvailableSlotsList(res.data);
      setApplyModalRequest(request);
      setSelectedSlotId(res.data[0]?.id_disponibilidad ?? null);
      setApplyReason(`Aplicación de reprogramación aprobada para solicitud #${request.requestId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la disponibilidad de agenda.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmApplyReschedule() {
    if (!applyModalRequest || !selectedSlotId) return;
    if (!applyReason.trim()) { setError('Ingresa el motivo o justificación de la aplicación.'); return; }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.applyReschedule(applyModalRequest.requestId, selectedSlotId, applyReason.trim());
      setApplyModalRequest(null);
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aplicar la reprogramación.');
    } finally {
      setBusy(false);
    }
  }

  async function detectAlerts() {
    setBusy(true); setError('');
    try { 
      await customerAiAgentApi.detectAlerts(Number(attentionId)); 
      await loadAlerts(); 
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron detectar alertas.'); }
    finally { setBusy(false); }
  }

  async function loadDraft(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { 
      const result = await customerAiAgentApi.getDraft(Number(draftId)); 
      setDraft(result.data); 
      setDraftContent(result.data.content); 
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Borrador no disponible o fuera de tu ámbito asistencial.'); }
    finally { setBusy(false); }
  }

  async function prepareDraft() {
    setBusy(true); setError('');
    try { 
      const result = await customerAiAgentApi.prepareDraft(Number(attentionId), crypto.randomUUID()) as { success: boolean; data: DocumentDraft }; 
      setDraft(result.data); 
      setDraftContent(result.data.content); 
      setDraftId(String(result.data.draftId)); 
      setSection('drafts');
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar el borrador con IA.'); }
    finally { setBusy(false); }
  }

  async function handleApproveDraftConfirmed() {
    if (!draft) return;
    setShowApproveConfirmModal(false);
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.approveDraft(draft.draftId, true);
      const result = await customerAiAgentApi.getDraft(draft.draftId);
      setDraft(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aprobar el borrador.');
    } finally {
      setBusy(false);
    }
  }

  async function updateDraft(action: 'revise' | 'approve' | 'issue' | 'reject') {
    if (!draft) return;
    if (action === 'reject' && !draftReason.trim()) { 
      setError('Escribe la justificación del rechazo antes de proceder.'); 
      return; 
    }
    if (action === 'approve') {
      setShowApproveConfirmModal(true);
      return;
    }
    setBusy(true); setError('');
    try {
      if (action === 'revise') {
        const result = await customerAiAgentApi.reviseDraft(draft.draftId, draftContent) as { data: { draftId: number } };
        const refreshed = await customerAiAgentApi.getDraft(result.data.draftId);
        setDraft(refreshed.data); setDraftContent(refreshed.data.content); setDraftId(String(refreshed.data.draftId));
      }
      if (action === 'issue') { 
        await customerAiAgentApi.issueDraft(draft.draftId); 
        const result = await customerAiAgentApi.getDraft(draft.draftId); 
        setDraft(result.data); 
      }
      if (action === 'reject') { 
        await customerAiAgentApi.rejectDraft(draft.draftId, draftReason); 
        const result = await customerAiAgentApi.getDraft(draft.draftId); 
        setDraft(result.data); 
      }
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'El borrador cambió de estado o no pudo actualizarse. Recarga la versión.'); 
    }
    finally { setBusy(false); }
  }

  function openReviewAlertModal(alert: AgentAlert, nextStatus: string) {
    setAlertReviewModal({ alert, nextStatus });
    setAlertEvidenceText('');
  }

  async function confirmReviewAlert() {
    if (!alertReviewModal) return;
    if (!alertEvidenceText.trim()) {
      setError('Registra la evidencia o motivo de la revisión clínica.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.reviewAlert(alertReviewModal.alert.alertId, alertReviewModal.nextStatus, alertEvidenceText.trim());
      setAlertReviewModal(null);
      await loadAlerts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado de la alerta.');
    } finally {
      setBusy(false);
    }
  }

  function openReviewRequestModal(request: RescheduleRequest, nextStatus: string) {
    setRequestReviewModal({ request, nextStatus });
    setRequestReviewReason(nextStatus === 'Aprobada' ? 'Aprobada tras validación de disponibilidad y continuidad.' : '');
  }

  async function confirmReviewRequest() {
    if (!requestReviewModal) return;
    if (requestReviewModal.nextStatus === 'Rechazada' && !requestReviewReason.trim()) {
      setError('Debes ingresar el motivo del rechazo.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.reviewReschedule(requestReviewModal.request.requestId, requestReviewModal.nextStatus, requestReviewReason.trim());
      setRequestReviewModal(null);
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(event?: FormEvent, presetText?: string) {
    if (event) event.preventDefault();
    const text = (presetText || chatInput).trim(); 
    if (!text) return;
    setChatInput(''); 
    setChatMessages((items) => [...items, { role: 'Tú', content: text }]); 
    setBusy(true); setError('');
    try {
      const result = await customerAiAgentApi.chat(text, 'staff');
      const docMatches = result.message.match(/\[Documento:\s*([A-Z0-9._-]+)(?:\s+v\d+)?(?:,\s*Sección:[^\]]+)?\]/gi) || [];
      const cleanMessage = result.message.replace(/\[Documento:[^\]]+\]/gi, '').trim();
      setChatMessages((items) => [
        ...items,
        {
          role: 'Copiloto NexoSalud',
          content: `${cleanMessage}\n\n${result.limitations.join(' ')}`,
          references: docMatches.map((m) => m.replace(/^\[|\]$/g, '').trim()),
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El asistente clínico no está disponible.');
    } finally {
      setBusy(false);
    }
  }

  const sections = [
    ...(isDentist ? [
      { id: 'workspace', label: 'Atención & Documentación', icon: Stethoscope },
      { id: 'drafts', label: 'Borradores Clínicos', icon: FileText }
    ] : []),
    ...(isReception ? [
      { id: 'requests', label: 'Reprogramaciones', icon: Calendar, badge: requests.filter(r => r.status === 'Pendiente' || r.status === 'En_Revision').length }
    ] : []),
    { id: 'alerts', label: 'Alertas Asistenciales', icon: AlertTriangle, badge: alerts.filter(a => a.status === 'Generada' || a.status === 'En_Revision').length },
    { id: 'assistant', label: 'Copiloto Normativo IA', icon: MessageCircle },
  ];

  const pendingAlertsCount = alerts.filter(a => a.status === 'Generada' || a.status === 'En_Revision').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'Pendiente' || r.status === 'En_Revision').length;

  return (
    <div className="w-full space-y-5 pb-12">
        
        {/* Cabecera Premium Quirúrgica Cockpit Full-Width */}
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#072421] via-[#0c3531] to-[#114b45] p-6 text-white shadow-xl border border-teal-700/40 sm:p-7 w-full">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-teal-200 shadow-inner">
                <Stethoscope className="h-6 w-6 text-teal-100" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200 border border-teal-300/30 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ESTACIÓN CLÍNICA INSTITUCIONAL · CUSTOMER
                  </span>
                  <span className="font-mono text-[11px] text-teal-200/80">Fase 4</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Copiloto Asistencial & Documental
                </h1>
                <p className="mt-1 text-xs text-teal-100/90">
                  {session.nombres} {session.apellidos} · <span className="font-semibold text-teal-200">{role}</span> · Sedes Autorizadas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => {
                  setBusy(true);
                  Promise.all([
                    isReception ? loadRequests() : Promise.resolve(),
                    loadAlerts(),
                    loadStaffAttentions()
                  ])
                    .catch((cause) => setError(cause instanceof Error ? cause.message : 'Error al actualizar'))
                    .finally(() => setBusy(false));
                }}
                disabled={busy}
                title="Actualizar datos"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-semibold text-white hover:bg-white/20 transition-all backdrop-blur-sm cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
              <button 
                onClick={() => { staffAuthService.logout(); navigate('/'); }} 
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-black/25 px-3.5 text-xs font-semibold text-rose-200 hover:bg-rose-950/50 hover:text-white transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Micro indicadores rápidos en header */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15 text-xs text-teal-100/90">
            <div className="rounded-xl bg-white/5 p-2 border border-white/5">
              <span className="opacity-75 block text-[10px] uppercase font-semibold">Alertas Activas</span>
              <span className="font-mono font-bold text-sm text-white">{pendingAlertsCount}</span>
            </div>
            <div className="rounded-xl bg-white/5 p-2 border border-white/5">
              <span className="opacity-75 block text-[10px] uppercase font-semibold">Reprogramaciones</span>
              <span className="font-mono font-bold text-sm text-white">{pendingRequestsCount}</span>
            </div>
            <div className="rounded-xl bg-white/5 p-2 border border-white/5">
              <span className="opacity-75 block text-[10px] uppercase font-semibold">Atenciones Asignadas</span>
              <span className="font-mono font-bold text-sm text-white">{staffAttentionsList.length}</span>
            </div>
            <div className="rounded-xl bg-white/5 p-2 border border-white/5">
              <span className="opacity-75 block text-[10px] uppercase font-semibold">Gobernanza Médica</span>
              <span className="font-semibold text-teal-300 flex items-center gap-1 text-xs mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Supervisión Humana
              </span>
            </div>
          </div>
        </header>

        {/* Barra de Navegación por Secciones con Pills Full-Width */}
        <nav aria-label="Secciones del copiloto" className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm w-full">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => setSection(item.id)} 
                aria-current={active ? 'page' : undefined} 
                className={`flex items-center gap-2 min-h-10 shrink-0 rounded-xl px-4 text-xs font-semibold transition-all cursor-pointer ${
                  active 
                    ? 'bg-teal-800 dark:bg-teal-700 text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-white text-teal-900' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mensaje de Error si aplica */}
        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 shadow-sm w-full">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="flex-1 font-medium">{error}</span>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 font-bold px-1 cursor-pointer">✕</button>
          </div>
        )}

        {/* SECCIÓN 1: ATENCIÓN Y DOCUMENTACIÓN */}
        {section === 'workspace' && isDentist && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            {/* Panel Izquierdo: Selección de Atención */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  Expediente de Atención
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Selecciona a tu paciente programado en agenda o busca directamente por número de atención.
                </p>
              </div>

              {staffAttentionsList.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pacientes Asignados a tu Turno
                    </label>
                    <span className="text-[10px] font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-full border border-teal-200">
                      {staffAttentionsList.length} en lista
                    </span>
                  </div>
                  <select
                    className="w-full rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-slate-800 px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700"
                    value={attentionId}
                    onChange={(e) => void fetchAttentionData(Number(e.target.value))}
                  >
                    <option value="" disabled>Selecciona un paciente para cargar su historial clínico…</option>
                    {staffAttentionsList.map((att) => (
                      <option key={att.id_atencion} value={att.id_atencion}>
                        #{att.id_atencion} · {att.paciente} — {att.servicio} ({att.sede})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Sin atenciones precargadas en tu turno</p>
                  <p className="text-[11px]">
                    Puedes ingresar el ID de atención directamente abajo (ej. 153, 220) o seleccionarla desde la tabla del Módulo CUSTOMER.
                  </p>
                </div>
              )}

              <form onSubmit={loadAttention} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  O buscar por ID de Atención Directo
                </label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700 font-mono" 
                    inputMode="numeric" 
                    placeholder="Ej. 153, 220..." 
                    value={attentionId} 
                    onChange={(event) => setAttentionId(event.target.value)} 
                    required 
                  />
                  <button 
                    disabled={busy} 
                    className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  >
                    Cargar
                  </button>
                </div>
              </form>

              {context && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acciones del Copiloto</p>
                  <button 
                    disabled={busy} 
                    onClick={() => void detectAlerts()} 
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-all"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Detectar Alertas Documentales
                  </button>
                  {role === 'ODONTOLOGO' && (
                    <button 
                      disabled={busy} 
                      onClick={() => void prepareDraft()} 
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 px-3 py-2.5 text-xs font-semibold text-teal-900 dark:text-teal-200 hover:bg-teal-100 transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                      Generar Borrador Asistido con IA
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Panel Derecho: Contexto Clínico y Estado Documental */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  Contexto Clínico & Validador Documental
                </h2>
                {attentionId && (
                  <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                    Atención #{attentionId}
                  </span>
                )}
              </div>

              {context ? (
                <div className="space-y-4">
                  {/* Disclaimer Clínico */}
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                    <p className="leading-relaxed">{context.clinicalDisclaimer}</p>
                  </div>

                  {/* Resumen de Tratamiento y Atención */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Tratamiento Vinculado</span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {renderTreatmentSummary(context.currentTreatment)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Detalles de la Cita</span>
                      <div className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                        {renderAttentionSummary(context.currentAttention)}
                      </div>
                    </div>
                  </div>

                  {/* Antecedentes Registrados */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Antecedentes Clínicos del Paciente</h3>
                    {context.relevantBackground && context.relevantBackground.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {context.relevantBackground.map((item, index) => (
                          <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 p-3 text-xs shadow-2xs">
                            <span className="font-semibold text-slate-900 dark:text-white block">{String(item.category || 'Antecedente')}</span>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">{String(item.description || 'Sin detalle')}</p>
                            <span className="mt-1.5 inline-block text-[10px] font-mono font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded">
                              Verificación: {String(item.verificationStatus || 'Registrado')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500">
                        No hay antecedentes recuperables registrados en esta consulta; esto no confirma su ausencia clínica.
                      </p>
                    )}
                  </div>

                  {/* Estado de Cierre Documental */}
                  {documentation && (
                    <div className="rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/30 dark:bg-teal-950/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                          <FileCheck2 className="w-4 h-4 text-teal-700" />
                          Cierre Documental: {documentation.closureStatus || 'En Proceso'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          Indicaciones por aprobar: {documentation.pendingInstructions.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Última validación técnica: <span className="font-medium text-slate-900 dark:text-white">{documentation.lastValidation?.result || 'Sin registrar'}</span>
                        {documentation.lastValidation?.pendingFields ? ` · Pendientes: ${documentation.lastValidation.pendingFields}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-300">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ninguna atención seleccionada</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Selecciona una atención asignada de la lista o escribe su identificador numérico en el panel izquierdo para recuperar su contexto clínico seguro.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 2: BORRADORES CLÍNICOS */}
        {section === 'drafts' && isDentist && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-teal-700" />
                  Borradores Clínicos
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Consulta versiones previas por su ID o genera un borrador nuevo desde tu atención activa.
                </p>
              </div>

              {attentionId && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 p-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    Atención Activa en Memoria: #{attentionId}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => void prepareDraft()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 dark:bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-all shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generar Nuevo Borrador para #{attentionId}
                  </button>
                </div>
              )}

              <form onSubmit={loadDraft} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Buscar Borrador Específico por ID
                </label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700" 
                    inputMode="numeric" 
                    value={draftId} 
                    onChange={(event) => setDraftId(event.target.value)} 
                    placeholder="Ej. 46, 49..." 
                    required 
                  />
                  <button className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer">
                    Cargar
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700" /> Gobernanza del Borrador
                </p>
                <p>• Los borradores se originan desde una atención clínica autorizada.</p>
                <p>• La IA redacta sugerencias basadas en el procedimiento y guías clínicas.</p>
                <p>• El odontólogo es el único facultado para aprobar y emitir al paciente.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700" />
                  Estudio de Revisión Humana y Emisión
                </h2>
                {draft && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    draft.status === 'Emitido' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                    draft.status.includes('Aprobado') ? 'bg-teal-50 text-teal-800 border-teal-300' :
                    draft.status === 'Rechazado' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                    'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {draft.status} · Versión {draft.version}
                  </span>
                )}
              </div>

              {draft ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">Borrador #{draft.draftId} (Raíz #{draft.rootId})</span>
                    <span className="text-[11px]">{draft.status === 'Emitido' ? 'Documento emitido formalmente al paciente' : 'Borrador interno no emitido al paciente'}</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contenido Clínico del Documento
                    </label>
                    <textarea 
                      className="w-full min-h-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs leading-relaxed text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700" 
                      value={draftContent} 
                      onChange={(event) => setDraftContent(event.target.value)} 
                      disabled={draft.status === 'Aprobado' || draft.status === 'Corregido_Y_Aprobado' || draft.status === 'Emitido'} 
                    />
                  </div>

                  {draft.status !== 'Aprobado' && draft.status !== 'Corregido_Y_Aprobado' && draft.status !== 'Emitido' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Justificación de Rechazo (solo si decide descartar el borrador)
                      </label>
                      <input 
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-700" 
                        value={draftReason} 
                        onChange={(event) => setDraftReason(event.target.value)} 
                        maxLength={300} 
                        placeholder="Motivo clínico del rechazo..."
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {draft.status !== 'Aprobado' && draft.status !== 'Corregido_Y_Aprobado' && draft.status !== 'Emitido' && (
                      <>
                        <button 
                          disabled={busy} 
                          onClick={() => void updateDraft('revise')} 
                          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-100 transition-all"
                        >
                          Guardar como Nueva Versión
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => void updateDraft('approve')} 
                          className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-all shadow-sm"
                        >
                          Aprobar Versión {draft.version}
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => void updateDraft('reject')} 
                          className="rounded-xl border border-rose-300 dark:border-rose-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-all"
                        >
                          Rechazar Borrador
                        </button>
                      </>
                    )}

                    {(draft.status === 'Aprobado' || draft.status === 'Corregido_Y_Aprobado') && (
                      <button 
                        disabled={busy} 
                        onClick={() => void updateDraft('issue')} 
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-800 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Emitir Formalmente al Paciente
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-14 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-300">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ningún borrador activo en el visor</p>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                      Para redactar indicaciones con IA, selecciona a tu paciente en <span className="font-semibold text-teal-800 dark:text-teal-300">"Atención & Documentación"</span> y haz clic en <span className="font-semibold text-teal-800 dark:text-teal-300">"Generar Borrador Asistido con IA"</span>. Se abrirá automáticamente aquí.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSection('workspace')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-all cursor-pointer shadow-sm"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      Ir a Selección de Atención
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 3: SOLICITUDES DE REPROGRAMACIÓN (RECEPCIÓN & ADMIN) */}
        {section === 'requests' && isReception && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-700" />
                    Bandeja de Reprogramaciones Solicitadas
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Aprobar una solicitud registra la conformidad. La reasignación de horario se realiza mediante la selección de un cupo real en agenda.
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-teal-800 bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded-full border border-teal-200">
                  {requests.length} Solicitud(es)
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {requests.map((item) => (
                <article key={item.requestId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Solicitud #{item.requestId} · Sesión #{item.sessionId}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'Aprobada' ? 'bg-teal-50 text-teal-800 border-teal-300' :
                        item.status === 'Rechazada' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                        item.status === 'Aplicada' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                        'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Fecha original: <span className="font-medium text-slate-800 dark:text-slate-200">{dateLabel(item.originalDate)}</span> · Preferencia solicitada: <span className="font-medium text-teal-700 dark:text-teal-300">{item.preferredDate ? dateLabel(item.preferredDate) : 'No indicada'} {item.preferredSlot || ''}</span>
                    </p>
                    {item.resolutionReason && (
                      <p className="text-[11px] text-slate-500 italic">Nota de resolución: {item.resolutionReason}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.status === 'Pendiente' && (
                      <button 
                        disabled={busy} 
                        onClick={() => openReviewRequestModal(item, 'En_Revision')} 
                        className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 transition-all"
                      >
                        Iniciar Revisión
                      </button>
                    )}
                    {item.status === 'En_Revision' && (
                      <>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Aprobada')} 
                          className="rounded-xl bg-teal-800 dark:bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 transition-all"
                        >
                          Aprobar
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Rechazada')} 
                          className="rounded-xl border border-rose-300 dark:border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 transition-all"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {item.status === 'Aprobada' && (
                      <button 
                        disabled={busy} 
                        onClick={() => void openApplyModal(item)} 
                        className="rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/60 px-3 py-1.5 text-xs font-semibold text-teal-900 dark:text-teal-200 hover:bg-teal-100 transition-all"
                      >
                        Aplicar en Agenda Oficial
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!requests.length && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-xs text-slate-500">
                  No hay solicitudes de reprogramación en esta bandeja.
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 4: BANDEJA DE ALERTAS ASISTENCIALES */}
        {section === 'alerts' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm">Bandeja de Alertas Clínicas (AL-C01 a AL-C05)</h2>
                  <p className="text-xs text-slate-500">
                    Reglas determinísticas y supervisión continua. Toda transición de estado requiere evidencia documentada.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-200">
                {alerts.length} Alertas Totales
              </span>
            </div>

            <div className="grid gap-3">
              {alerts.map((alert) => {
                const isCritical = alert.severity === 'CRITICA' || alert.severity === 'ALTA';
                return (
                  <article key={alert.alertId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isCritical ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200' :
                          'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                        }`}>
                          {alert.type} · {alert.severity}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{alert.status}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{alert.message}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Atención: #{alert.attentionId ?? '—'} · Tratamiento: #{alert.treatmentId ?? '—'} · {dateLabel(alert.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'Generada' && (
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewAlertModal(alert, 'En_Revision')} 
                          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 transition-all"
                        >
                          Revisar
                        </button>
                      )}
                      {['Generada', 'En_Revision'].includes(alert.status) && (
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewAlertModal(alert, 'Atendida')} 
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 dark:bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 transition-all"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar Atendida
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {!alerts.length && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-xs text-slate-500">
                  No hay alertas registradas para este perfil profesional.
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 5: ASISTENTE COPILOTO IA STAFF (FULL WIDTH WORKSPACE) */}
        {section === 'assistant' && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            {/* Panel Izquierdo: Guías Clínicas & Acceso Rápido */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  Biblioteca Normativa & Guías
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Protocolos clínicos, directivas MINSA y normativas institucionales de NexoSalud indexadas en el motor RAG.
                </p>
              </div>

              {/* Consultas Frecuentes por Categoría */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Consultas Documentales
                </span>
                <div className="space-y-1.5">
                  {[
                    '¿Cuáles son los requisitos de cierre documental de una atención?',
                    '¿Qué campos mínimos debe contener la ficha de evolución clínica?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendChat(undefined, chip)}
                      className="w-full text-left text-xs p-2.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 hover:bg-teal-100/70 hover:border-teal-300 dark:hover:bg-teal-900/50 transition-all cursor-pointer font-medium leading-relaxed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block pt-2">
                  Protocolos Odontológicos
                </span>
                <div className="space-y-1.5">
                  {[
                    '¿Cuál es el protocolo postoperatorio para exodoncia quirúrgica?',
                    '¿Cómo opera la política institucional de reprogramación de citas?',
                    '¿Qué criterios definen la transición de CUSTOMER a TURNED?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendChat(undefined, chip)}
                      className="w-full text-left text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-all cursor-pointer font-medium leading-relaxed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sello de Gobernanza RAG */}
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> Motor RAG Lexical Activo
                </p>
                <p>
                  Las respuestas se fundamentan en documentos institucionales auditados mediante concordancia léxica BM25 y function calling autorizados.
                </p>
              </div>
            </div>

            {/* Panel Derecho: Área de Conversación Panorámica a Todo el Ancho */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4 min-h-[580px]">
              {/* Encabezado del Chat */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-800 dark:text-teal-300">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                      Copiloto Normativo & Documental
                    </h2>
                    <p className="text-xs text-slate-500">
                      Asistencia inteligente fundamentada en guías clínicas oficiales y políticas institucionales
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded-full border border-teal-200">
                    {chatMessages.length} {chatMessages.length === 1 ? 'mensaje' : 'mensajes'}
                  </span>
                  {chatMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setChatMessages([])}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      title="Limpiar conversación actual"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Flujo de Mensajes a Ancho Completo */}
              <div aria-live="polite" className="flex-1 space-y-3.5 overflow-y-auto max-h-[500px] pr-2">
                {chatMessages.map((item, index) => (
                  <div 
                    key={index} 
                    className={`rounded-2xl p-4 text-xs leading-relaxed transition-all ${
                      item.role === 'Tú' 
                        ? 'ml-12 md:ml-32 bg-teal-800 text-white shadow-sm' 
                        : 'mr-6 md:mr-16 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 border-b border-black/10 dark:border-white/10 pb-1">
                      <span className="font-bold text-[11px] opacity-85">{item.role}</span>
                      {item.role !== 'Tú' && (
                        <span className="text-[10px] font-mono opacity-60">Respuesta Oficial Asistida</span>
                      )}
                    </div>
                    
                    <p className="whitespace-pre-wrap">{item.content}</p>
                    
                    {item.references && item.references.length > 0 && (
                      <div className="mt-3 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-white dark:bg-slate-900 p-3 text-[11px] text-slate-800 dark:text-slate-200 shadow-2xs">
                        <p className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
                          <BookOpen className="h-3.5 w-3.5" /> Referencias Institucionales Verificadas:
                        </p>
                        <ul className="mt-1.5 list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                          {item.references.map((ref, idx) => (
                            <li key={idx} className="font-mono text-[10.5px] bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded inline-block mr-1">
                              {ref}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {!chatMessages.length && (
                  <div className="py-16 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-300">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Copiloto Normativo Listo
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Escribe una consulta en la barra inferior o selecciona una de las preguntas sugeridas en el panel izquierdo para consultar reglamentos, protocolos y directivas clínicas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Entrada del Chat Full-Width */}
              <form onSubmit={sendChat} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 w-full">
                <input 
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700 shadow-inner" 
                  value={chatInput} 
                  onChange={(event) => setChatInput(event.target.value)} 
                  maxLength={2000} 
                  placeholder="Pregunta sobre reglamentos de atención, guías de práctica clínica o requisitos documentales..." 
                />
                <button 
                  disabled={busy || !chatInput.trim()} 
                  className="rounded-xl bg-teal-800 dark:bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </section>
        )}

        {/* MODAL: APLICAR REPROGRAMACIÓN EN AGENDA */}
        {applyModalRequest && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="apply-reschedule-title" className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <CheckCircle2 className="h-5 w-5" />
                <h2 id="apply-reschedule-title" className="font-bold text-sm text-slate-900 dark:text-white">
                  Aplicar Reprogramación a la Agenda Oficial
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Solicitud #{applyModalRequest.requestId} (Sesión #{applyModalRequest.sessionId}). Fecha original: <span className="font-semibold">{dateLabel(applyModalRequest.originalDate)}</span>.
              </p>
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cupo Disponible en Agenda
                  {availableSlotsList.length > 0 ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700"
                      value={selectedSlotId ?? ''}
                      onChange={(e) => setSelectedSlotId(Number(e.target.value))}
                    >
                      {availableSlotsList.map((slot) => (
                        <option key={slot.id_disponibilidad} value={slot.id_disponibilidad}>
                          {slot.fecha} · {slot.hora_inicio} - {slot.hora_fin} ({slot.sede} · {slot.profesional})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 rounded-xl border border-dashed border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                      No hay slots libres en este momento.
                    </p>
                  )}
                </label>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motivo o Justificación de la Aplicación
                  <textarea
                    className="mt-1 w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700"
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    maxLength={300}
                    required
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setApplyModalRequest(null)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !selectedSlotId || !applyReason.trim()}
                  onClick={() => void confirmApplyReschedule()}
                  className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all"
                >
                  Confirmar Cambio en Agenda
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: REVISAR ALERTA CON EVIDENCIA */}
        {alertReviewModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Registrar Revisión de Alerta #{alertReviewModal.alert.alertId}
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Transición solicitada a estado: <span className="font-bold text-teal-800 dark:text-teal-300">{alertReviewModal.nextStatus}</span>.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Evidencia o Motivo Clínico (Obligatorio, máx. 200 caracteres)
                </label>
                <textarea 
                  className="w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700" 
                  value={alertEvidenceText} 
                  onChange={(e) => setAlertEvidenceText(e.target.value)} 
                  maxLength={200} 
                  placeholder="Ej. Se verificó con el paciente y se agendó sesión de control..." 
                  required 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setAlertReviewModal(null)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !alertEvidenceText.trim()}
                  onClick={() => void confirmReviewAlert()}
                  className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all"
                >
                  Guardar Revisión
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: REVISAR SOLICITUD DE REPROGRAMACIÓN */}
        {requestReviewModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <CalendarCheck className="h-5 w-5" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Revisión de Solicitud #{requestReviewModal.request.requestId}
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Cambio a: <span className="font-bold">{requestReviewModal.nextStatus}</span>.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {requestReviewModal.nextStatus === 'Rechazada' ? 'Motivo del Rechazo (Obligatorio)' : 'Nota de Revisión (Opcional)'}
                </label>
                <textarea 
                  className="w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-700" 
                  value={requestReviewReason} 
                  onChange={(e) => setRequestReviewReason(e.target.value)} 
                  maxLength={300} 
                  placeholder="Detalles de la resolución..." 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setRequestReviewModal(null)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || (requestReviewModal.nextStatus === 'Rechazada' && !requestReviewReason.trim())}
                  onClick={() => void confirmReviewRequest()}
                  className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all"
                >
                  Confirmar Estado
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN DE APROBACIÓN DE BORRADOR */}
        {showApproveConfirmModal && draft && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-xs p-4" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Confirmación de Aprobación Clínica Explícita
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Confirmas aprobar explícitamente la <span className="font-bold">versión {draft.version}</span> del borrador #{draft.draftId}? 
                Esta acción certifica que el contenido ha sido revisado por ti como odontólogo responsable.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowApproveConfirmModal(false)} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleApproveDraftConfirmed()}
                  className="rounded-xl bg-teal-800 dark:bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-all"
                >
                  Aprobar Explícitamente
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Footer Institucional con Declaración de Seguridad */}
        <footer className="flex items-start gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-800 dark:text-teal-400" />
          <span>
            Las decisiones de aprobación clínica, revisión de alertas y asignación de agenda son acciones humanas auditadas y registradas en el backend. Los modelos de IA actúan estrictamente como copilotos de apoyo documental.
          </span>
        </footer>

    </div>
  );
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'No disponible';
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderTreatmentSummary(treatment: unknown): string {
  if (!treatment) return 'Sin tratamiento vinculado';
  if (typeof treatment === 'string') return treatment;
  if (typeof treatment === 'object') {
    const t = treatment as Record<string, unknown>;
    const name = t.nombre || t.servicio || t.serviceName || t.tipo || 'Tratamiento Odontológico';
    const state = t.estado || t.status || '';
    return `${name}${state ? ` (${state})` : ''}`;
  }
  return String(treatment);
}

function renderAttentionSummary(attention: Record<string, unknown> | null | undefined) {
  if (!attention || Object.keys(attention).length === 0) {
    return <p className="text-slate-500">Sin datos registrados de la cita.</p>;
  }
  return Object.entries(attention).slice(0, 5).map(([key, val]) => (
    <div key={key} className="flex items-center justify-between text-[11px]">
      <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}:</span>
      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{String(val ?? '—')}</span>
    </div>
  ));
}
