import CustomerCompletionPanel from '../components/CustomerCompletionPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTheme } from '@/shared/context/ThemeContext';
import { 
  AlertCircle,
  AlertOctagon,
  ArrowRight, 
  BookOpen, 
  Calendar, 
  CalendarClock, 
  Clock, 
  Check, 
  CheckCircle2, 
  CircleAlert, 
  Copy,
  Download,
  FileCheck2, 
  FileDown,
  Info,
  LoaderCircle, 
  Lock, 
  LogOut, 
  MapPin, 
  MessageSquare, 
  Phone, 
  PhoneCall,
  Printer,
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Sparkles, 
  Stethoscope, 
  User, 
  Moon,  Sun,  X
} from 'lucide-react';
import { patientAuthApi, type PatientSession } from '@/shared/services/patientAuthService';
import { 
  customerAiAgentApi, 
  type PatientAttentionItem, 
  type PatientTreatment, 
  type PostCareInstructionItem, 
  type RescheduleRequest, 
  type SessionPage, 
  type TreatmentProgress, 
  type UpcomingSession,
  type RescheduleDraft 
} from '../services/customerAiAgentApi';

type TabId = 'timeline' | 'instructions' | 'reschedule' | 'assistant';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: string[];
  limitations?: string[];
  rescheduleDraft?: RescheduleDraft;
  timestamp: string;
}

export default function CustomerPatientPortalPage() {
  const [patient, setPatient] = useState<PatientSession | null>(() => patientAuthApi.getSession());
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  
  // Data State
  const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [attentions, setAttentions] = useState<PatientAttentionItem[]>([]);
  const [selectedAttentionId, setSelectedAttentionId] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<PostCareInstructionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionPage | null>(null);
  const [progress, setProgress] = useState<TreatmentProgress | null>(null);
  const [dataRevision, setDataRevision] = useState(0);

  // Form Reschedule State
  const [candidateSessionId, setCandidateSessionId] = useState('');
  const [draftAlternatives, setDraftAlternatives] = useState<Array<{ date: string; professionalName: string; branchName: string }>>([]);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [reason, setReason] = useState('');
  const [prepared, setPrepared] = useState<{ token: string; summary: string } | null>(null);

  // Assistant State (Conversational Stream)
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);

  // Modals & Floating Feedback State
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = sessionStorage.getItem('nexosalud_patient_portal_tab') as TabId | null;
    return saved && ['timeline', 'instructions', 'reschedule', 'assistant'].includes(saved) ? saved : 'timeline';
  });
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [printInstruction, setPrintInstruction] = useState<PostCareInstructionItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('nexosalud_patient_portal_tab', activeTab);
  }, [activeTab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedTreatment = useMemo(
    () => treatments?.find((item) => item?.treatmentId === selectedId) || null,
    [treatments, selectedId]
  );

  async function loadPortal() {
    setDataRevision(value => value + 1);
    setBusy(true); setError('');
    try {
      const [treatmentsResult, upcomingResult, requestResult, attentionsResult] = await Promise.all([
        customerAiAgentApi.patientTreatments(),
        customerAiAgentApi.patientUpcoming(),
        customerAiAgentApi.rescheduleRequests('patient'),
        customerAiAgentApi.patientAttentions(),
      ]);
      setTreatments(treatmentsResult.data);
      setUpcoming(upcomingResult.data);
      setRequests(requestResult.data);
      setAttentions(attentionsResult.data);
      setSelectedId((current) => current && treatmentsResult.data?.some((item) => item?.treatmentId === current) ? current : treatmentsResult.data?.[0]?.treatmentId ?? null);
      setSelectedAttentionId((current) => current && attentionsResult.data.some((item) => item.id_atencion === current) ? current : attentionsResult.data[0]?.id_atencion ?? null);
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'No fue posible sincronizar tu información clínica.'); 
    }
    finally { setBusy(false); }
  }

  useEffect(() => { 
    if (patient && patientAuthApi.getAccessToken()) void loadPortal(); 
  }, [patient]);

  useEffect(() => {
    if (!selectedAttentionId) { setInstructions([]); return; }
    let current = true;
    customerAiAgentApi.patientPostCareInstructions(selectedAttentionId)
      .then((res) => { if (current) setInstructions(res.data); })
      .catch(() => { if (current) setInstructions([]); });
    return () => { current = false; };
  }, [selectedAttentionId]);

  useEffect(() => {
    if (!selectedId || (treatments.length > 0 && !treatments.some((t) => t.treatmentId === selectedId))) { setSessions(null); setProgress(null); return; }
    let current = true;
    setBusy(true); setError('');
    Promise.all([
      customerAiAgentApi.treatmentSessions(selectedId), 
      customerAiAgentApi.treatmentProgress(selectedId)
    ])
      .then(([sessionResult, progressResult]) => { 
        if (current) { 
          setSessions(sessionResult.data); 
          setProgress(progressResult.data); 
        } 
      })
      .catch((cause: unknown) => { 
        if (current) setError(cause instanceof Error ? cause.message : 'No fue posible cargar las sesiones.'); 
      })
      .finally(() => { 
        if (current) setBusy(false); 
      });
    return () => { current = false; };
  }, [selectedId, dataRevision]);

  useEffect(() => {
    if (!patient) return;
    const refresh = () => { if (document.visibilityState === 'visible') void loadPortal(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [patient]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { 
      const authenticated = await patientAuthApi.loginWithPassword(dni, password); 
      setPatient(authenticated); 
      setToast({ type: 'success', message: `¡Bienvenido(a), ${authenticated.nombres}! Acceso seguro verificado.` });
    }
    catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'DNI o contraseña incorrectos. Verifica tus credenciales.'); 
    }
    finally { setBusy(false); }
  }

  async function prepareRequest(event: FormEvent) {
    event.preventDefault();
    const sessionId = Number(new FormData(event.currentTarget as HTMLFormElement).get('sessionId'));
    const candidate = sessions?.items.find((item) => item.sessionId === sessionId);
    if (!candidate) { setError('Elige una sesión válida de tu tratamiento.'); return; }
    setBusy(true); setError('');
    try {
      const result = await customerAiAgentApi.prepareReschedule({ 
        sessionId: candidate.sessionId, 
        preferredDate: preferredDate || undefined, 
        preferredSlot: preferredSlot || undefined, 
        reason: reason || undefined, 
        idempotencyKey: crypto.randomUUID() 
      });
      const preparedResult = result as { requiresConfirmation?: boolean; confirmationToken?: string; data?: { originalDate?: string; preferredDate?: string | null; preferredSlot?: string | null } };
      if (!preparedResult.requiresConfirmation || !preparedResult.confirmationToken) {
        throw new Error('El servidor no devolvió una confirmación válida.');
      }
      setPrepared({ 
        token: preparedResult.confirmationToken, 
        summary: `Sesión programada actual: ${dateLabel(preparedResult.data?.originalDate)}. Preferencia solicitada: ${dateLabel(preparedResult.data?.preferredDate)}${preparedResult.data?.preferredSlot ? ` · ${preparedResult.data.preferredSlot}` : ''}. Tu cita continuará vigente hasta que recepción confirme el nuevo horario.` 
      });
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar la solicitud.'); 
    }
    finally { setBusy(false); }
  }

  async function confirmRequest() {
    if (!prepared) return;
    setBusy(true); setError('');
    try { 
      await customerAiAgentApi.confirmReschedule(prepared.token); 
      setPrepared(null); 
      setReason(''); 
      setPreferredDate(''); 
      setPreferredSlot(''); 
      setToast({
        type: 'success',
        message: '¡Solicitud enviada a Recepción con éxito! Se evaluará el cupo y te confirmaremos a la brevedad.'
      });
      await loadPortal(); 
    }
    catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar la solicitud.'); 
    }
    finally { setBusy(false); }
  }

  async function askAssistant(event?: FormEvent, presetText?: string) {
    if (event) event.preventDefault();
    const prompt = (presetText || message).trim(); 
    if (!prompt) return;
    setMessage(''); 
    setBusy(true); 
    setError('');

    const userBubble: ChatBubble = {
      id: crypto.randomUUID(),
      role: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory((prev) => [...prev, userBubble]);

    try {
      const result = await customerAiAgentApi.chat(prompt, 'patient', {treatmentId:selectedId ?? undefined,attentionId:selectedAttentionId ?? undefined});
      const docMatches = result.message.match(/\[Documento:\s*([A-Z0-9._-]+)(?:\s+v\d+)?(?:,\s*Sección:[^\]]+)?\]/gi) || [];
      const cleanMessage = result.message
        .replace(/\[Documento:[^\]]+\]/gi, '')
        .replace(/\n\s*\.\s*\n/g, '\n\n')
        .replace(/\n\s*\.\s*$/g, '')
        .replace(/\s+\./g, '.')
        .trim();
      
      const assistantBubble: ChatBubble = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: cleanMessage,
        limitations: result.limitations,
        references: docMatches.map((m) => m.replace(/^\[|\]$/g, '').trim()),
        rescheduleDraft: result.rescheduleDraft,
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory((prev) => [...prev, assistantBubble]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El asistente clínico no está disponible en este momento.');
    } finally {
      setBusy(false);
    }
  }

  function applyRescheduleDraft(draft: RescheduleDraft) {
    setActiveTab('reschedule');
    setCandidateSessionId(String(draft.sessionId));
    setPreferredDate(draft.preferredDate ?? '');
    setPreferredSlot(draft.preferredSlot ?? '');
    setReason(draft.reason ?? '');
    setDraftAlternatives(draft.alternatives ?? []);
  }

  function handleSelectAlternative(alt: { date: string; professionalName: string; branchName: string }) {
    const dateObj = new Date(alt.date);
    const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj);
    const timePart = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(dateObj);
    setPreferredDate(datePart);
    setPreferredSlot(timePart);
  }

  function handleCopyInstructions(content: string) {
    navigator.clipboard.writeText(content);
    setToast({
      type: 'info',
      message: 'Indicaciones copiadas al portapapeles para consulta rápida.'
    });
  }

  // --------------------------------------------------------------------------
  // VISTA 1: ACCESO AL PORTAL
  // --------------------------------------------------------------------------
  if (!patient) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="pt">
          <PortalTopbar
            onEmergency={() => setShowEmergencyModal(true)}
            subtitle="Portal del paciente"
          />

          <main className="relative flex-1 grid lg:grid-cols-[7fr_5fr]">
            {/* Columna editorial */}
            <section className="relative overflow-hidden px-6 sm:px-12 lg:px-20 py-14 lg:py-24 flex flex-col justify-between gap-16 lg:border-r border-[var(--pt-line)]">
              <div className="max-w-2xl">
                <p className="pt-eyebrow pt-rise" style={{ '--i': 0 } as CSSProperties}>
                  Seguimiento odontológico
                </p>
                <h1 className="pt-display pt-rise mt-6 text-[clamp(2.4rem,5vw,4.2rem)]" style={{ '--i': 1 } as CSSProperties}>
                  Tu tratamiento,
                  <br />
                  <em className="pt-accent-text not-italic" style={{ fontStyle: 'italic' }}>sesión a sesión.</em>
                </h1>
                <p className="pt-rise pt-ink2 mt-6 max-w-[52ch] text-[17px]" style={{ '--i': 2 } as CSSProperties}>
                  Revisa tus citas, consulta las indicaciones aprobadas y emitidas por tu odontólogo y solicita un cambio de horario.
                </p>
              </div>

              <ol className="pt-ledger pt-divide max-w-xl border-t border-[var(--pt-line)] list-none p-0 m-0">
                {[
                  ['Cronograma de sesiones', 'Qué se hizo, qué sigue y con quién.'],
                  ['Indicaciones oficiales', 'Cuidados posteriores con la versión vigente y su fecha de emisión.'],
                  ['Reprogramación con respaldo', 'Tu cita sigue vigente hasta que recepción confirme el nuevo horario.'],
                ].map(([title, text], i) => (
                  <li key={title} className="pt-rise" style={{ '--i': 3 + i } as CSSProperties}>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="pt-muted pt-small">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <svg aria-hidden="true" className="pt-tooth-line" viewBox="0 0 200 220" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M100 16c-22-14-60-10-70 26-8 30 6 52 12 78 6 28 6 70 22 80 12 6 16-30 22-52 2-8 8-8 10 0 6 22 10 58 22 52 16-10 16-52 22-80 6-26 20-48 12-78-10-36-48-40-70-26Z" />
                <path d="M62 60c10-8 22-6 38 2" strokeDasharray="3 5" />
              </svg>
            </section>

            {/* Formulario */}
            <section className="relative flex items-center px-6 sm:px-12 lg:px-16 py-14">
              <div className="w-full max-w-md mx-auto pt-rise" style={{ '--i': 2 } as CSSProperties}>
                <p className="pt-eyebrow">Acceso para pacientes</p>
                <h2 className="pt-display mt-3 text-3xl">Ingresa a tu historial</h2>
                <p className="pt-muted mt-2 pt-small">Usa el DNI con el que te registraste en la clínica.</p>

                <form onSubmit={handleLogin} className="mt-8 grid gap-5" noValidate={false}>
                  <div className="pt-field">
                    <label className="pt-label" htmlFor="pt-dni">Documento de identidad (DNI)</label>
                    <div className="pt-input-icon">
                      <User className="h-4 w-4" strokeWidth={1.75} />
                      <input
                        id="pt-dni"
                        className="pt-input pt-num"
                        type="text"
                        inputMode="numeric"
                        autoComplete="username"
                        placeholder="Ej. 40000315"
                        maxLength={15}
                        required
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-field">
                    <label className="pt-label" htmlFor="pt-pass">Contraseña</label>
                    <div className="pt-input-icon">
                      <Lock className="h-4 w-4" strokeWidth={1.75} />
                      <input
                        id="pt-pass"
                        className="pt-input"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Tu contraseña"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        role="alert"
                        className="pt-alert"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                      >
                        <CircleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={busy} className="pt-btn pt-btn-primary pt-btn-block">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    <span>{busy ? 'Verificando…' : 'Entrar a mi historial'}</span>
                    {!busy && <ArrowRight className="h-4 w-4" />}
                  </button>

                  <div className="flex items-center gap-3 pt-small pt-muted">
                    <ShieldCheck className="h-4 w-4 shrink-0 pt-accent-text" strokeWidth={1.75} />
                    <span>Acceso personal a información autorizada de tu atención.</span>
                  </div>

                </form>
              </div>
            </section>
          </main>

          <footer className="relative border-t border-[var(--pt-line)] px-6 sm:px-12 py-5 pt-small pt-muted">
            NexoSalud Dental · Portal del paciente
          </footer>

          <AnimatePresence>
            {showEmergencyModal && <EmergencyTriageModal onClose={() => setShowEmergencyModal(false)} />}
          </AnimatePresence>
        </div>
      </MotionConfig>
    );
  }

  // --------------------------------------------------------------------------
  // VISTA 2: PORTAL AUTENTICADO
  // --------------------------------------------------------------------------
  const initials = `${patient.nombres.charAt(0)}${patient.apellidos?.charAt(0) || ''}`.toUpperCase();
  const nextSession = upcoming[0];
  const progressPercent = progress?.operationalProgressPercent ?? null;
  const pendingForReschedule = sessions?.items.filter((item) => item.number > 1 && item.careStatus === 'Pendiente') ?? [];
  const tabs: { id: TabId; label: string; icon: typeof Calendar; badge?: number }[] = [
    { id: 'timeline', label: 'Cronograma', icon: Calendar },
    { id: 'instructions', label: 'Indicaciones', icon: FileCheck2, badge: instructions.length },
    { id: 'reschedule', label: 'Reprogramar', icon: CalendarClock, badge: requests.length },
    { id: 'assistant', label: 'Asistente', icon: Sparkles },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="pt">
        <PortalTopbar
          subtitle="Portal del paciente"
          onEmergency={() => setShowEmergencyModal(true)}
          actions={
            <>
              <button
                type="button"
                onClick={() => void loadPortal()}
                disabled={busy}
                className="pt-btn pt-btn-ghost"
                title="Actualizar datos"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                <span className="hidden md:inline">Sincronizar</span>
              </button>
              <button
                type="button"
                onClick={() => { patientAuthApi.clearSession(); setPatient(null); }}
                className="pt-btn pt-btn-ghost"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden md:inline">Salir</span>
              </button>
            </>
          }
        />

        <main className="relative flex-1 w-full max-w-[1320px] mx-auto px-5 sm:px-10 py-10 sm:py-14">
          {/* Encabezado del paciente */}
          <section className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div className="pt-rise" style={{ '--i': 0 } as CSSProperties}>
              <div className="flex items-center gap-3">
                <span className="pt-mark !rounded-full pt-num text-[13px] font-semibold" aria-hidden="true">{initials}</span>
                <span className="pt-eyebrow">DNI {patient.dni || dni || 'No disponible'} · Expediente n.º {patient.id_persona || 'No disponible'}</span>
              </div>
              <h1 className="pt-display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)]">
                Buenas, <em style={{ fontStyle: 'italic' }} className="pt-accent-text">{patient.nombres}</em>
                {patient.apellidos ? ` ${patient.apellidos}` : ''}.
              </h1>
              <p className="pt-muted mt-3">{sessions?.items[0]?.branch || 'Sede por consultar'} · {selectedTreatment?.serviceName || 'Servicio por consultar'}</p>
            </div>

            <div className="pt-panel pt-rise p-6" style={{ '--i': 2 } as CSSProperties}>
              {nextSession ? (
                <div className="flex gap-4">
                  <CalendarClock className="h-6 w-6 shrink-0 pt-accent-text" strokeWidth={1.5} />
                  <div>
                    <p className="pt-eyebrow">Próxima cita confirmada</p>
                    <p className="pt-display mt-1 text-2xl">{dateLabel(nextSession.date)}</p>
                    <p className="pt-muted pt-small mt-1">{nextSession.serviceName} · {nextSession.professional}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <CheckCircle2 className="h-6 w-6 shrink-0 pt-accent-text" strokeWidth={1.5} />
                  <div>
                    <p className="pt-eyebrow">Agenda</p>
                    <p className="mt-1 pt-ink2">No tienes citas pendientes por ahora.</p>
                  </div>
                </div>
              )}
            </div>
          </section>



          {/* Indicadores de avance: separados por línea, sin tarjetas */}
          {progress && (
            <dl className="pt-rise mt-12 grid grid-cols-2 lg:grid-cols-4 border-y border-[var(--pt-line)]" style={{ '--i': 3 } as CSSProperties}>
              {[
                ['Tratamiento', <span key="t" className="truncate block">{selectedTreatment?.serviceName || 'Evaluación general'}</span>],
                ['Sesiones realizadas y cerradas', <span key="s" className="pt-num">{progress.completedSessions} de {progress.plannedSessions ?? '—'}</span>],
                ['Avance', (
                  <div key="a" className="flex items-center gap-3">
                    <span className="pt-num">{progressPercent === null ? 'Requiere revisión' : `${progressPercent}%`}</span>
                    {progressPercent !== null && <div className="pt-meter flex-1" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                    </div>}
                  </div>
                )],
                ['Responsable', <span key="r" className="truncate block">{selectedTreatment?.responsibleProfessional || 'Por asignar'}</span>],
              ].map(([label, value], i) => (
                <div key={String(label)} className={`py-5 px-4 sm:px-6 min-w-0 ${i % 2 === 1 ? 'border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} lg:border-l border-[var(--pt-line)] ${i === 0 ? 'lg:border-l-0 pl-0' : ''}`}>
                  <dt className="pt-eyebrow">{label}</dt>
                  <dd className="mt-1.5 text-lg font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Pestañas */}
          <div className="mt-12" role="tablist" aria-label="Secciones del portal">
            <div className="pt-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={active}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className="pt-tab"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span>{tab.label}</span>
                    {typeof tab.badge === 'number' && tab.badge > 0 && <span className="pt-count">{tab.badge}</span>}
                    {active && <motion.span layoutId="pt-tab-bar" className="pt-tab-bar" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              style={{ paddingTop: 36 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ---------------- CRONOGRAMA ---------------- */}
              {activeTab === 'timeline' && (
                <div className="grid gap-12 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                      <div>
                        <h2 className="pt-display text-2xl">Cronograma de sesiones</h2>
                        <p className="pt-muted pt-small mt-1">Sesiones atendidas y citas pendientes de tu plan.</p>
                      </div>
                      {treatments.length > 1 && (
                        <div className="pt-field min-w-[220px]">
                          <label htmlFor="pt-treatment" className="pt-label">Tratamiento</label>
                          <select
                            id="pt-treatment"
                            className="pt-input"
                            value={selectedId ?? ''}
                            onChange={(e) => setSelectedId(Number(e.target.value))}
                          >
                            {treatments?.filter(Boolean)?.map((t) => (
                              <option key={t.treatmentId} value={t.treatmentId}>{t.serviceName}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {busy && !sessions ? (
                      <div className="grid gap-6" aria-hidden="true">
                        {[0, 1, 2].map((n) => <div key={n} className="pt-skel h-20" />)}
                      </div>
                    ) : sessions?.items && sessions.items.length > 0 ? (
                      <ol className="pt-timeline">
                        {sessions.items.map((sessionItem, idx) => {
                          const isCompleted = sessionItem.careStatus === 'Realizada' && sessionItem.closureStatus === 'Cerrada';
                          const isScheduled = ['Programada', 'Confirmada'].includes(sessionItem.schedulingStatus);
                          return (
                            <motion.li
                              key={sessionItem.sessionId}
                              className="pt-step"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <div className={`pt-node ${isCompleted ? 'pt-node-done' : isScheduled ? 'pt-node-next' : ''}`}>
                                {isCompleted ? <Check className="h-4 w-4" strokeWidth={2.5} /> : sessionItem.number}
                              </div>
                              <div className="pt-1">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <h3 className="font-semibold text-[17px]">Sesión {sessionItem.number}</h3>
                                  <span className={`pt-tag ${isCompleted ? 'pt-tag-ok' : isScheduled ? 'pt-tag-accent' : ''}`}>
                                    {isCompleted ? 'Atención concluida' : sessionItem.schedulingStatus}
                                  </span>
                                </div>
                                <p className="pt-num pt-small pt-muted mt-1">{dateLabel(sessionItem.date)}</p>
                                <p className="pt-small pt-ink2 mt-2 flex flex-wrap gap-x-5 gap-y-1">
                                  <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 pt-accent-text" strokeWidth={1.75} />{sessionItem.professional}</span>
                                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 pt-muted" strokeWidth={1.75} />{sessionItem.branch}</span>
                                </p>
                              </div>
                            </motion.li>
                          );
                        })}
                      </ol>
                    ) : (
                      <div className="pt-empty border border-dashed border-[var(--pt-line-strong)] rounded-md">
                        <Calendar className="h-8 w-8 mx-auto pt-muted" strokeWidth={1.25} />
                        <p className="pt-display mt-3 text-xl">Aún no hay sesiones</p>
                        <p className="pt-muted pt-small mt-1">Cuando tu odontólogo programe tu plan, aparecerá aquí.</p>
                      </div>
                    )}

                    {/* Acordeón de Programación y Confirmación Adicional del Plan */}
                    {selectedId && (
                      <details className="mt-8 rounded-2xl border border-[var(--pt-line)] bg-[var(--pt-surface)] p-4 text-sm transition-all group">
                        <summary className="font-semibold cursor-pointer text-[var(--pt-ink)] flex items-center justify-between select-none list-none">
                          <span className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-[var(--pt-accent)]" />
                            Programar sesión adicional o confirmar asistencia anticipada
                          </span>
                          <span className="text-xs text-[var(--pt-muted)] font-mono group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="mt-4 pt-4 border-t border-[var(--pt-line)]">
                          <CustomerCompletionPanel audience="patient" treatmentId={selectedId} onChanged={() => void loadPortal()} />
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Columna lateral */}
                  <aside className="grid gap-10 content-start lg:border-l lg:pl-10 border-[var(--pt-line)]">
                    <section>
                      <p className="pt-eyebrow">Plan activo</p>
                      <dl className="mt-4 grid gap-4">
                        <div>
                          <dt className="pt-small pt-muted">Especialidad</dt>
                          <dd className="pt-display text-xl">{selectedTreatment?.serviceName || 'Evaluación odontológica'}</dd>
                        </div>
                        <div>
                          <dt className="pt-small pt-muted">Inicio</dt>
                          <dd className="font-medium">{dateLabel(selectedTreatment?.realStartDate)}</dd>
                        </div>
                        <div>
                          <dt className="pt-small pt-muted">Estado clínico</dt>
                          <dd className="mt-1"><span className="pt-tag pt-tag-accent">{selectedTreatment?.status || 'En tratamiento'}</span></dd>
                        </div>
                      </dl>
                      <button type="button" onClick={() => setActiveTab('reschedule')} className="pt-btn mt-6 pt-btn-block">
                        <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                        <span>Cambiar una fecha</span>
                      </button>
                    </section>

                    <hr className="pt-rule" />

                    <section>
                      <p className="pt-eyebrow">Indicaciones</p>
                      <p className="mt-3 pt-ink2">
                        <span className="pt-display text-4xl pt-num align-middle mr-2">{instructions.length}</span>
                        documento{instructions.length === 1 ? '' : 's'} para tu cuidado en casa.
                      </p>
                      <button type="button" onClick={() => setActiveTab('instructions')} className="pt-btn pt-btn-primary mt-5 pt-btn-block">
                        Ver indicaciones <ArrowRight className="h-4 w-4" />
                      </button>
                    </section>

                    <hr className="pt-rule" />

                    <section>
                      <p className="pt-eyebrow">Sede</p>
                      <p className="mt-3 font-medium">{sessions?.items[0]?.branch || 'Sede por consultar'}</p>
                      <p className="pt-muted pt-small">Consulta los datos de la sede en tu programación vigente.</p>
                      <button type="button" onClick={() => setShowEmergencyModal(true)} className="pt-btn pt-btn-danger mt-4 pt-btn-block">
                        <Phone className="h-4 w-4" strokeWidth={1.75} />
                        <span>Contacto de urgencia</span>
                      </button>
                    </section>
                  </aside>
                </div>
              )}

              {/* ---------------- INDICACIONES ---------------- */}
              {activeTab === 'instructions' && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
                    <div>
                      <h2 className="pt-display text-2xl">Indicaciones postoperatorias</h2>
                      <p className="pt-muted pt-small mt-1 max-w-[60ch]">Documentos emitidos y aprobados por tu odontólogo para tu recuperación.</p>
                    </div>
                    {attentions.length > 0 && (
                      <div className="pt-field min-w-[260px]">
                        <label htmlFor="pt-attention" className="pt-label">Atención</label>
                        <select
                          id="pt-attention"
                          className="pt-input"
                          value={selectedAttentionId ?? ''}
                          onChange={(e) => setSelectedAttentionId(Number(e.target.value))}
                        >
                          {attentions.map((att) => (
                            <option key={att.id_atencion} value={att.id_atencion}>
                              {dateLabel(att.fecha_hora)} · {att.servicio} ({att.profesional})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {instructions.length > 0 ? (
                    <div className="grid gap-8 xl:grid-cols-2">
                      {instructions.map((inst, idx) => (
                        <motion.article
                          key={inst.id_indicacion}
                          className="pt-panel pt-doc flex flex-col justify-between gap-6"
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div>
                            <header className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--pt-line)]">
                              <div>
                                <p className="pt-eyebrow" style={{ color: 'var(--pt-brass)' }}>Indicaciones post-atención</p>
                                <p className="font-semibold mt-1">Versión {inst.version} · {inst.estado}</p>
                              </div>
                              <span className="pt-num pt-small pt-muted">{dateLabel(inst.emitido_en)}</span>
                            </header>
                            <div className="pt-doc-body mt-5 whitespace-pre-wrap leading-relaxed">{inst.contenido}</div>
                          </div>

                          <footer className="grid gap-4 pt-4 border-t border-[var(--pt-line)]">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setPrintInstruction(inst)} className="pt-btn flex-1">
                                <FileDown className="h-4 w-4" strokeWidth={1.75} />
                                <span>Ver y descargar PDF</span>
                              </button>
                              <button type="button" onClick={() => handleCopyInstructions(inst.contenido)} className="pt-btn" title="Copiar texto">
                                <Copy className="h-4 w-4" strokeWidth={1.75} />
                                <span>Copiar</span>
                              </button>
                            </div>
                            <div className="flex items-center justify-between pt-small">
                              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--pt-ok)' }}>
                                <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} /> Revisado por el odontólogo
                              </span>
                              <span className="pt-num pt-muted">N.º {inst.id_indicacion}</span>
                            </div>
                          </footer>
                        </motion.article>
                      ))}
                    </div>
                  ) : (
                    <div className="pt-empty border border-dashed border-[var(--pt-line-strong)] rounded-md">
                      <FileCheck2 className="h-9 w-9 mx-auto pt-muted" strokeWidth={1.25} />
                      <p className="pt-display mt-3 text-xl">Sin indicaciones para esta consulta</p>
                      <p className="pt-muted pt-small mt-2 max-w-md mx-auto">
                        Si tu odontólogo emitió indicaciones, revisa que la atención seleccionada sea la correcta o pregunta al asistente.
                      </p>
                      <button type="button" onClick={() => setActiveTab('assistant')} className="pt-btn mt-5">
                        <Sparkles className="h-4 w-4" strokeWidth={1.75} /> Preguntar al asistente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ---------------- REPROGRAMAR ---------------- */}
              {activeTab === 'reschedule' && (
                <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <h2 className="pt-display text-2xl">Solicitar cambio de horario</h2>
                    <p className="pt-muted pt-small mt-1 max-w-[58ch]">
                      Recepción revisa cada solicitud y te confirma un nuevo cupo. Mientras tanto, tu cita actual sigue vigente.
                    </p>

                    {sessions?.items && pendingForReschedule.length === 0 ? (
                      <div className="mt-8 border-l-2 border-[var(--pt-accent)] pl-5 py-1">
                        <p className="font-semibold inline-flex items-center gap-2"><Info className="h-4 w-4 pt-accent-text" /> No hay sesiones por reprogramar</p>
                        <p className="pt-muted pt-small mt-2 max-w-[56ch]">
                          Tu tratamiento ({selectedTreatment?.serviceName || 'evaluación general'}) tiene sus sesiones concluidas o una sola sesión programada. Para una nueva fase o control, contacta a recepción.
                        </p>
                        <button type="button" onClick={() => setShowEmergencyModal(true)} className="pt-btn mt-4">
                          <Phone className="h-4 w-4" strokeWidth={1.75} /> Contactar a recepción
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={prepareRequest} className="mt-8 grid gap-6">
                        <div className="pt-field">
                          <label className="pt-label" htmlFor="pt-session">Sesión que quieres mover</label>
                          <select id="pt-session" name="sessionId" value={candidateSessionId} onChange={(e) => setCandidateSessionId(e.target.value)} required className="pt-input">
                            <option value="" disabled>Elige una sesión programada…</option>
                            {pendingForReschedule.map((item) => (
                              <option key={item.sessionId} value={item.sessionId}>
                                Sesión {item.number} · {dateLabel(item.date)} ({item.professional})
                              </option>
                            ))}
                          </select>
                        </div>

                        {draftAlternatives.length > 0 && (
                          <div className="pt-field p-3.5 rounded-lg bg-[var(--pt-sunken)] border border-[var(--pt-line)]">
                            <label className="pt-label block mb-2 text-xs font-semibold">Horarios sugeridos por el copiloto IA</label>
                            <div className="flex flex-wrap gap-2">
                              {draftAlternatives.map((alt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSelectAlternative(alt)}
                                  className="pt-chip text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer hover:border-[var(--pt-accent)] transition-colors"
                                >
                                  <Clock className="h-3 w-3 pt-accent-text" />
                                  <span>{alt.professionalName} · {alt.branchName} ({dateLabel(alt.date)})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-5">
                          <div className="pt-field">
                            <label className="pt-label" htmlFor="pt-date">Fecha preferida</label>
                            <input
                              id="pt-date"
                              type="date"
                              className="pt-input pt-num"
                              value={preferredDate}
                              min={new Date().toISOString().split('T')[0]}
                              onChange={(e) => setPreferredDate(e.target.value)}
                            />
                          </div>
                          <div className="pt-field">
                            <label className="pt-label" htmlFor="pt-slot">Franja horaria</label>
                            <input
                              id="pt-slot"
                              type="text"
                              className="pt-input"
                              placeholder="Ej. Mañana, 9:00 a 12:00"
                              maxLength={40}
                              value={preferredSlot}
                              onChange={(e) => setPreferredSlot(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="pt-field">
                          <label className="pt-label" htmlFor="pt-reason">Motivo del cambio</label>
                          <textarea
                            id="pt-reason"
                            rows={3}
                            className="pt-input"
                            placeholder="Cuéntanos brevemente para que recepción pueda evaluar la disponibilidad."
                            maxLength={300}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <span className="pt-help pt-num self-end">{reason.length}/300</span>
                        </div>

                        {error && (
                          <div role="alert" className="pt-alert"><CircleAlert className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span></div>
                        )}

                        <button type="submit" disabled={busy || pendingForReschedule.length === 0} className="pt-btn pt-btn-primary self-start px-6">
                          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                          <span>Revisar solicitud</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </div>

                  <aside className="lg:border-l lg:pl-10 border-[var(--pt-line)]">
                    <div className="flex items-baseline justify-between">
                      <h3 className="pt-display text-xl">Tus solicitudes</h3>
                      <span className="pt-num pt-small pt-muted">{requests.length} registradas</span>
                    </div>

                    {requests.length > 0 ? (
                      <ul className="pt-divide mt-4 list-none p-0 m-0">
                        {requests.map((req) => (
                          <li key={req.requestId} className="py-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold pt-small">{req.serviceName || `Solicitud #${req.requestId}`} (Sesión #{req.sessionNumber || req.sessionId})</span>
                              <span className={`pt-tag ${req.status === 'Aprobada' ? 'pt-tag-accent' : req.status === 'Rechazada' ? 'pt-tag-danger' : req.status === 'Aplicada' ? 'pt-tag-ok' : 'pt-tag-warn'}`}>
                                {req.status}
                              </span>
                            </div>
                            <p className="pt-small pt-muted mt-1">Cita original: <span className="pt-ink2">{dateLabel(req.originalDate)}</span> · {req.professionalName || 'Profesional asignado'}</p>
                            {req.preferredDate && (
                              <p className="pt-small mt-0.5 pt-accent-text">
                                Preferencia: {dateLabel(req.preferredDate)} {req.preferredSlot ? `(${req.preferredSlot})` : ''}
                              </p>
                            )}
                            {req.resolutionReason && (
                              <p className="text-[11px] text-[color:var(--pt-muted)] italic mt-1 bg-[var(--pt-sunken)] p-1.5 rounded">
                                Nota de recepción: {req.resolutionReason}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="pt-empty">
                        <p className="pt-display text-lg">Sin solicitudes</p>
                        <p className="pt-muted pt-small mt-1">Cuando pidas un cambio, podrás seguir aquí su estado.</p>
                      </div>
                    )}
                  </aside>
                </div>
              )}

              {/* ---------------- ASISTENTE ---------------- */}
              {activeTab === 'assistant' && (
                <div className="max-w-4xl">
                  <h2 className="pt-display text-2xl">Asistente clínico</h2>
                  <p className="pt-muted pt-small mt-1 max-w-[60ch]">
                    Orientación sobre cuidados, citas y políticas de la clínica. No reemplaza la consulta con tu odontólogo.
                  </p>

                  <div className="mt-6">
                    <p className="pt-eyebrow mb-3">Consultas frecuentes</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '¿Cuáles son mis cuidados después de la extracción o limpieza?',
                        '¿Qué alimentos debo evitar en las primeras 24 horas?',
                        '¿Cómo puedo solicitar una reprogramación de mi cita?',
                        '¿Qué debo hacer si presento dolor o molestia intensa?',
                      ].map((chip) => (
                        <button key={chip} type="button" disabled={busy} onClick={() => void askAssistant(undefined, chip)} className="pt-chip">
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 grid gap-5 max-h-[460px] overflow-y-auto pr-2" aria-live="polite">
                    <AnimatePresence initial={false}>
                      {chatHistory.map((bubble) => (
                        <motion.div
                          key={bubble.id}
                          className={`flex flex-col ${bubble.role === 'user' ? 'items-end' : 'items-start'}`}
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                        >
                          <div className={`pt-bubble ${bubble.role === 'user' ? 'pt-bubble-user' : 'pt-bubble-bot'}`}>
                            <div className="flex items-center justify-between gap-6 text-[11px] opacity-70 pt-num mb-1.5">
                              <span>{bubble.role === 'user' ? 'Tú' : 'Asistente'}</span>
                              <span>{bubble.timestamp}</span>
                            </div>
                            <FormattedMessage text={bubble.text} />
                            {bubble.references && bubble.references.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[var(--pt-line)] pt-small">
                                <p className="font-semibold pt-accent-text inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Fuentes verificadas</p>
                                <ul className="mt-1 pl-4 list-disc pt-num text-[12px] pt-muted">
                                  {bubble.references.map((ref, i) => <li key={i}>{ref}</li>)}
                                </ul>
                              </div>
                            )}
                            {bubble.limitations && bubble.limitations.length > 0 && (
                              <p className="mt-2 text-[12px] pt-muted italic">{bubble.limitations.join(' ')}</p>
                            )}
                            {bubble.rescheduleDraft && (
                              <div className="mt-3 pt-3 border-t border-[var(--pt-line)]">
                                <button
                                  type="button"
                                  onClick={() => applyRescheduleDraft(bubble.rescheduleDraft!)}
                                  className="pt-btn pt-btn-primary text-xs py-1.5 px-3 flex items-center gap-2 cursor-pointer shadow-sm"
                                >
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>Revisar propuesta en Reprogramar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {busy && chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user' && (
                      <div className="pt-bubble pt-bubble-bot pt-typing inline-flex gap-1.5 w-fit" aria-label="El asistente está escribiendo"><span /><span /><span /></div>
                    )}
                  </div>

                  {error && <div role="alert" className="pt-alert mt-5"><CircleAlert className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span></div>}

                  <form onSubmit={askAssistant} className="mt-6 flex gap-3">
                    <label htmlFor="patient-question" className="sr-only">Tu consulta</label>
                    <input
                      id="patient-question"
                      type="text"
                      className="pt-input flex-1"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={2000}
                      placeholder="Escribe tu consulta sobre citas o cuidados…"
                    />
                    <button type="submit" disabled={busy || !message.trim()} className="pt-btn pt-btn-primary shrink-0">
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.75} />}
                      <span className="hidden sm:inline">Consultar</span>
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="relative border-t border-[var(--pt-line)] px-5 sm:px-10 py-6">
          <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-small pt-muted">
            <span className="inline-flex items-center gap-2 font-medium pt-ink2"><ShieldCheck className="h-4 w-4 pt-accent-text" strokeWidth={1.75} /> Portal del paciente · NexoSalud Odontología</span>
            <span>En caso de dolor agudo o sangrado, usa el botón de urgencias.</span>
          </div>
        </footer>

        {/* Diálogos */}
        <AnimatePresence>
          {prepared && (
            <motion.div className="pt-overlay" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-reschedule-title"
                className="pt-dialog grid gap-4"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              >
                <p className="pt-eyebrow">Paso final</p>
                <h2 id="confirm-reschedule-title" className="pt-display text-2xl">Confirma tu solicitud</h2>
                <p className="pt-ink2 pt-small leading-relaxed">{prepared.summary}</p>
                <div className="pt-note"><strong>Importante:</strong> tu cita actual sigue vigente hasta que recepción verifique la agenda y confirme el cambio.</div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--pt-line)]">
                  <button type="button" onClick={() => setPrepared(null)} className="pt-btn">Volver</button>
                  <button type="button" disabled={busy} onClick={() => void confirmRequest()} className="pt-btn pt-btn-primary">
                    {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Confirmar y enviar
                  </button>
                </div>
              </motion.section>
            </motion.div>
          )}

          {printInstruction && (
            <PrintPrescriptionModal
              instruction={printInstruction}
              patient={patient}
              treatment={selectedTreatment}
              onClose={() => setPrintInstruction(null)}
            />
          )}

          {showEmergencyModal && <EmergencyTriageModal onClose={() => setShowEmergencyModal(false)} />}

          {toast && (
            <motion.aside
              role="status"
              aria-live="polite"
              className="pt-toast"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
              {toast.type === 'info' && <Info className="h-5 w-5 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 cursor-pointer" aria-label="Cerrar notificación">
                <X className="h-4 w-4" />
              </button>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

// --------------------------------------------------------------------------
// BARRA SUPERIOR + SELECTOR DE TEMA
// --------------------------------------------------------------------------
function PortalTopbar({
  subtitle,
  onEmergency,
  actions,
}: {
  subtitle: string;
  onEmergency: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="pt-topbar">
      <div className="max-w-[1320px] mx-auto px-5 sm:px-10 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="pt-mark" aria-hidden="true"><Stethoscope className="h-[18px] w-[18px]" strokeWidth={1.75} /></span>
          <div className="min-w-0 leading-tight">
            <span className="pt-display block text-[19px] truncate">NexoSalud Dental</span>
            <span className="pt-eyebrow !text-[10px] block">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {actions}
          <button type="button" onClick={onEmergency} className="pt-btn pt-btn-danger" title="Información sobre contacto profesional" aria-label="Contacto profesional">
            <PhoneCall className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Contacto profesional</span>
          </button>
          <PortalThemeToggle />
        </div>
      </div>
    </header>
  );
}

function PortalThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="pt-icon-btn"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          className="grid place-items-center"
          initial={{ rotate: -80, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 80, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22 }}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// --------------------------------------------------------------------------
// COMPROBANTE IMPRIMIBLE (siempre en papel claro)
// --------------------------------------------------------------------------
function PrintPrescriptionModal({
  instruction,
  patient,
  treatment,
  onClose,
}: {
  instruction: PostCareInstructionItem;
  patient: PatientSession;
  treatment: PatientTreatment | null;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    if (!sheetRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fbfaf6'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const printableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, Math.min(imgHeight, pageHeight - margin * 2));
      const safeDni = patient.dni || 'sin-identificador';
      pdf.save(`NexoSalud_Indicaciones_${safeDni}_Doc${instruction.id_indicacion}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <motion.div className="pt-overlay" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="prescription-title"
        className="pt-dialog pt-sheet grid gap-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div ref={sheetRef} className="grid gap-6 p-5 rounded-xl bg-[#fbfaf6] text-[#1c2420] border border-[#e4decb]">
          <div className="flex items-start justify-between gap-4 pb-4 border-b-2" style={{ borderColor: '#1c2420' }}>
            <div className="flex items-center gap-3">
              <span className="pt-mark" aria-hidden="true"><Stethoscope className="h-[18px] w-[18px]" strokeWidth={1.75} /></span>
              <div>
                <h2 id="prescription-title" className="pt-display text-xl">NexoSalud Odontología Especializada</h2>
                <p className="text-[12px] pt-muted">Indicaciones aprobadas y emitidas para consulta personal</p>
              </div>
            </div>
            <div className="text-right pt-num text-[11px] pt-muted">
              <p className="font-semibold" style={{ color: '#1c2420' }}>Doc. n.º {instruction.id_indicacion}</p>
              <p>Versión {instruction.version}</p>
            </div>
          </div>

          <dl className="grid sm:grid-cols-2 gap-4 p-4 rounded-md" style={{ background: '#ebe6da' }}>
            <div>
              <dt className="pt-eyebrow">Paciente</dt>
              <dd className="font-semibold">{patient.nombres} {patient.apellidos || ''}</dd>
              <dd className="pt-num text-[12px] pt-muted">DNI {patient.dni || 'No disponible'}</dd>
            </div>
            <div>
              <dt className="pt-eyebrow">Tratamiento</dt>
              <dd className="font-semibold">{treatment?.serviceName || 'Evaluación odontológica integral'}</dd>
              <dd className="text-[12px] pt-muted">Emitido: {dateLabel(instruction.emitido_en)}</dd>
            </div>
          </dl>

          <div>
            <h3 className="pt-eyebrow pb-2 border-b border-[var(--pt-line)]">Indicaciones y plan postatención</h3>
            <div className="pt-doc-body mt-4 !text-[14px] whitespace-pre-wrap leading-relaxed">{instruction.contenido}</div>
          </div>

          <div className="pt-6 pt-4 border-t border-[var(--pt-line)] grid sm:grid-cols-2 items-end gap-6 text-[12px]">
            <p className="pt-muted inline-flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0" style={{ color: '#2c6b3f' }} /> Documento emitido bajo supervisión del odontólogo tratante.</p>
            <div className="sm:text-right">
              <div className="inline-block border-t border-[#8a8472] pt-2 px-6">
                <span className="block font-semibold">Odontólogo responsable</span>
                <span className="block pt-num text-[11px] pt-muted">Colegio Odontológico del Perú</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[var(--pt-line)]">
          <button type="button" onClick={onClose} className="pt-btn cursor-pointer">
            Cerrar
          </button>
          <button type="button" onClick={() => window.print()} className="pt-btn cursor-pointer" title="Imprimir directamente">
            <Printer className="h-4 w-4" strokeWidth={1.75} /> Imprimir
          </button>
          <button 
            type="button" 
            disabled={downloading}
            onClick={() => void handleDownloadPdf()} 
            className="pt-btn pt-btn-primary cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {downloading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" strokeWidth={1.75} />
                <span>Descargar PDF</span>
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

// --------------------------------------------------------------------------
// MODAL DE URGENCIAS
// --------------------------------------------------------------------------
function EmergencyTriageModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="pt-overlay" role="presentation" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        className="pt-dialog grid gap-5"
        style={{ borderTop: '3px solid var(--pt-danger)' }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <AlertOctagon className="h-6 w-6 shrink-0" style={{ color: 'var(--pt-danger)' }} strokeWidth={1.5} />
            <div>
              <h2 id="emergency-title" className="pt-display text-2xl">Urgencia odontológica</h2>
              <p className="pt-muted pt-small">Contacto profesional</p>
            </div>
          </div>
          <button onClick={onClose} className="pt-icon-btn !w-9 !h-9" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="pt-note" style={{ borderLeftColor: 'var(--pt-danger)', background: 'var(--pt-danger-soft)' }}>
          <p className="font-semibold mb-1.5">Solicita evaluación profesional</p>
          <p>Este portal no realiza diagnóstico, triaje ni derivación automática. Consulta al profesional mediante el canal que la clínica te haya proporcionado.</p>
          <p className="mt-3">No hay un contacto institucional de urgencias verificado en esta vista. No se garantiza atención de guardia ni un tiempo de respuesta.</p>
        </div>

        <button type="button" onClick={onClose} className="pt-btn pt-btn-block">Volver al portal</button>
      </motion.section>
    </motion.div>
  );
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Por coordinar';
  try {
    if (/^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(value)) {
      const parts = value.slice(0, 10).split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date(year, month, day, 12, 0, 0));
    }
    const hasTime = value.includes('T') && !value.includes('T00:00:00');
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: hasTime ? 'short' : undefined }).format(new Date(value));
  } catch {
    return value;
  }
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;
        if (trimmed === '.') return null;

        const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="font-semibold opacity-90 shrink-0">{numMatch[1]}</span>
              <span className="flex-1">{renderBoldSpans(numMatch[2])}</span>
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="opacity-75 shrink-0">•</span>
              <span className="flex-1">{renderBoldSpans(bulletMatch[1])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderBoldSpans(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderBoldSpans(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold underline decoration-[var(--pt-accent)]/30 decoration-1 underline-offset-2">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
