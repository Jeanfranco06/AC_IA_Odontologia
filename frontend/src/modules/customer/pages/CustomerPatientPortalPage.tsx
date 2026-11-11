import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { 
  AlertCircle,
  AlertOctagon,
  ArrowRight, 
  BookOpen, 
  Calendar, 
  CalendarCheck, 
  CalendarClock, 
  Check, 
  CheckCircle2, 
  CircleAlert, 
  Clock, 
  Copy,
  ExternalLink,
  FileCheck2, 
  FileText, 
  HeartPulse, 
  HelpCircle, 
  Info,
  KeyRound, 
  LoaderCircle, 
  Lock, 
  LogOut, 
  MapPin, 
  MessageSquare, 
  Phone, 
  PhoneCall,
  Printer,
  QrCode, 
  RefreshCw, 
  Send, 
  Shield, 
  ShieldCheck, 
  Sparkles, 
  Stethoscope, 
  User, 
  UserCheck,
  X
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
  type UpcomingSession 
} from '../services/customerAiAgentApi';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: string[];
  limitations?: string[];
  timestamp: string;
}

export default function CustomerPatientPortalPage() {
  const [patient, setPatient] = useState<PatientSession | null>(null);
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

  // Form Reschedule State
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [reason, setReason] = useState('');
  const [prepared, setPrepared] = useState<{ token: string; summary: string } | null>(null);

  // Assistant State (Conversational Stream)
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);

  // Modals & Floating Feedback State
  const [activeTab, setActiveTab] = useState<'timeline' | 'instructions' | 'reschedule' | 'assistant'>('timeline');
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [printInstruction, setPrintInstruction] = useState<PostCareInstructionItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedTreatment = useMemo(
    () => treatments.find((item) => item.treatmentId === selectedId) || null,
    [treatments, selectedId]
  );

  async function loadPortal() {
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
      setSelectedId((current) => current && treatmentsResult.data.some((item) => item.treatmentId === current) ? current : treatmentsResult.data[0]?.treatmentId ?? null);
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
    if (!selectedId) { setSessions(null); setProgress(null); return; }
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
  }, [selectedId]);

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

  function fillDemoCredentials() {
    setDni('40000315');
    setPassword('Paciente2026!');
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
      const result = await customerAiAgentApi.chat(prompt, 'patient');
      const docMatches = result.message.match(/\[Documento:\s*([A-Z0-9._-]+)(?:\s+v\d+)?(?:,\s*Sección:[^\]]+)?\]/gi) || [];
      const cleanMessage = result.message.replace(/\[Documento:[^\]]+\]/gi, '').trim();
      
      const assistantBubble: ChatBubble = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: cleanMessage,
        limitations: result.limitations,
        references: docMatches.map((m) => m.replace(/^\[|\]$/g, '').trim()),
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      };
      setChatHistory((prev) => [...prev, assistantBubble]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El asistente clínico no está disponible en este momento.');
    } finally {
      setBusy(false);
    }
  }

  function handleCopyInstructions(content: string) {
    navigator.clipboard.writeText(content);
    setToast({
      type: 'info',
      message: 'Indicaciones copiadas al portapapeles para consulta rápida.'
    });
  }

  // --------------------------------------------------------------------------
  // VISTA 1: ACCESO AL PORTAL (LOGIN SEGURO DEL PACIENTE) - ANCHO COMPLETO & PALETA EQUILIBRADA
  // --------------------------------------------------------------------------
  if (!patient) {
    return (
      <div className="min-h-screen w-full bg-[#090d16] flex flex-col justify-between text-slate-100 selection:bg-teal-500 selection:text-white">
        {/* Top Navbar */}
        <header className="w-full px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between border-b border-slate-800/80 bg-[#0c1220]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-900/30">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">NexoSalud Dental</span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">PORTAL PACIENTE · CUSTOMER</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
              <span>Urgencia 24h</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conexión Cifrada SSL</span>
            </div>
          </div>
        </header>

        {/* Hero & Login Section - Ocupa todo el ancho con respiración adecuada */}
        <main className="flex-1 w-full flex items-center justify-center px-4 sm:px-10 lg:px-16 py-8 sm:py-12">
          <div className="w-full max-w-6xl xl:max-w-7xl grid lg:grid-cols-[1.15fr_0.85fr] rounded-3xl overflow-hidden border border-slate-800 bg-[#0f172a] shadow-2xl shadow-black/60">
            
            {/* Columna Izquierda: Identidad y Beneficios Clínicos (Base Slate Neutro con Acentos Quirúrgicos) */}
            <div className="p-8 sm:p-12 xl:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-gradient-to-br from-[#0f172a] via-[#111c33] to-[#0c1626]">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-teal-400 text-xs font-semibold">
                  <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
                  <span>Seguimiento Asistencial y Odontológico</span>
                </div>

                <h1 className="mt-6 text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Toda tu evolución dental en un solo lugar.
                </h1>

                <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Consulta tus citas confirmadas, indicaciones postoperatorias firmadas por tu odontólogo y solicita reprogramaciones de forma transparente.
                </p>

                {/* Features List con diseño neutro limpio */}
                <div className="mt-8 space-y-3.5">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-850/60 border border-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Continuidad de Sesiones</p>
                      <p className="text-[11px] text-slate-400">Consulta sesiones completadas, planificadas y próximas citas programadas.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-850/60 border border-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Indicaciones Médicas Oficiales</p>
                      <p className="text-[11px] text-slate-400">Recetas, cuidados y directivas postatención aprobadas por tu odontólogo.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-850/60 border border-slate-800/80">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Asistente NexoSalud 24/7</p>
                      <p className="text-[11px] text-slate-400">Resuelve dudas sobre tus cuidados postquirúrgicos en cualquier momento.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Pill */}
              <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">Acceso validado contra el expediente clínico de NexoSalud · Cumplimiento de Privacidad Dental MINSA.</span>
              </div>
            </div>

            {/* Columna Derecha: Formulario de Autenticación */}
            <div className="p-8 sm:p-12 xl:p-14 flex flex-col justify-center bg-[#111a2e]">
              <div className="mb-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Acceso Pacientes</span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">Iniciar Sesión</h2>
                <p className="text-xs text-slate-400 mt-1">Ingresa tu documento nacional de identidad registrado.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Número de Documento (DNI)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type="text"
                      inputMode="numeric"
                      autoComplete="username"
                      placeholder="Ej. 40000315"
                      maxLength={15}
                      required
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input 
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-300">
                    <CircleAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full mt-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
                  <span>Acceder a mi Historial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Atajo con datos de prueba oficiales para evaluación */}
                <div className="pt-4 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="text-[11px] text-teal-400 hover:text-teal-300 underline underline-offset-4 font-mono transition-colors cursor-pointer"
                  >
                    Usar Paciente de Prueba (DNI: 40000315)
                  </button>
                </div>
              </form>
            </div>

          </div>
        </main>

        {/* Modal de Urgencia 24h accesible desde Login */}
        {showEmergencyModal && (
          <EmergencyTriageModal onClose={() => setShowEmergencyModal(false)} />
        )}

        {/* Footer */}
        <footer className="w-full px-6 py-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          NexoSalud Dental · Trujillo, Perú · Plataforma de Servicios Asistenciales Odontológicos
        </footer>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VISTA 2: PORTAL PACIENTE AUTENTICADO (STUDIO & COCKPIT - ANCHO TOTAL)
  // --------------------------------------------------------------------------
  const initials = `${patient.nombres.charAt(0)}${patient.apellidos?.charAt(0) || ''}`.toUpperCase();
  const nextSession = upcoming[0];
  const progressPercent = progress?.operationalProgressPercent ?? (progress?.plannedSessions ? Math.round((progress.completedSessions / progress.plannedSessions) * 100) : 0);

  return (
    <div className="min-h-screen w-full bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      
      {/* Barra de Navegación Superior Paciente - Ancho Total */}
      <nav className="sticky top-0 z-40 w-full bg-[#0c1220]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 lg:px-12 py-3.5">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-teal-900/30">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white block leading-tight">NexoSalud Dental</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">PORTAL PACIENTE · CUSTOMER</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón de Urgencia Clínica Rápida */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Contacto de Guardia para Dolor o Sangrado Agudo"
            >
              <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Urgencias 24h</span>
            </button>

            <button
              onClick={() => void loadPortal()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-all cursor-pointer"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            <button
              onClick={() => { patientAuthApi.clearSession(); setPatient(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 text-xs font-semibold hover:bg-rose-900/50 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Contenido Principal - Ocupa todo el ancho de la pantalla */}
      <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-8 space-y-6">
        
        {/* Banner de Identidad del Paciente (Hero) - Paleta Slate Neutra con Reflejo Azul Marino y Acentos Quirúrgicos */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f172a] via-[#111c33] to-[#0c1c2e] p-6 sm:p-8 xl:p-10 text-white shadow-xl border border-slate-800 w-full">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-400/30 flex items-center justify-center font-bold text-lg text-teal-300 shadow-inner">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px] font-bold uppercase tracking-wider">
                    Paciente Activo
                  </span>
                  <span className="font-mono text-xs text-slate-400">DNI: {dni || '40000315'}</span>
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Hola, {patient.nombres} {patient.apellidos || ''}
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sede Trujillo · Expediente Odontológico #{patient.id_persona || '101'}
                </p>
              </div>
            </div>

            {/* Tarjeta de Próxima Cita en el Hero */}
            {nextSession ? (
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 p-4 flex items-center gap-4 min-w-[280px]">
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Próxima Cita Confirmada</span>
                  <p className="font-bold text-white text-sm">{dateLabel(nextSession.date)}</p>
                  <p className="text-slate-300 text-[11px]">{nextSession.serviceName} · {nextSession.professional}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3.5 text-xs text-slate-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No tienes citas pendientes para los próximos días.</span>
              </div>
            )}
          </div>

          {/* Micro Strip de Progreso Operativo */}
          {progress && (
            <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Tratamiento Actual</span>
                <span className="font-bold text-white truncate block">{selectedTreatment?.serviceName || 'Evaluación General'}</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Sesiones Realizadas</span>
                <span className="font-bold text-white font-mono">{progress.completedSessions} de {progress.plannedSessions ?? '—'}</span>
              </div>
              <div className="rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Avance Operativo</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-400">{progressPercent}%</span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Responsable</span>
                <span className="font-bold text-white truncate block">{selectedTreatment?.responsibleProfessional || 'Dr. Diego Salazar'}</span>
              </div>
            </div>
          )}
        </section>

        {/* Pestañas de Navegación del Portal */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full">
          {[
            { id: 'timeline', label: 'Línea de Sesiones & Citas', icon: Calendar },
            { id: 'instructions', label: 'Indicaciones Médicas', icon: FileCheck2, badge: instructions.length },
            { id: 'reschedule', label: 'Reprogramar Citas', icon: CalendarClock, badge: requests.length },
            { id: 'assistant', label: 'Asistente NexoSalud', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  active 
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-950/40 border border-teal-500' 
                    : 'bg-[#111726] text-slate-300 border border-slate-800 hover:bg-[#161f33] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white text-teal-900' : 'bg-slate-800 text-teal-300 border border-slate-700'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: LÍNEA DE SESIONES Y EVOLUCIÓN - ANCHO COMPLETO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'timeline' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] w-full">
            {/* Timeline Principal de Sesiones */}
            <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 sm:p-7 shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-teal-400" />
                    Cronograma de Citas Odontológicas
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Historial de sesiones asistidas y citas pendientes en tu plan de tratamiento.
                  </p>
                </div>

                {treatments.length > 1 && (
                  <select
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:ring-1 focus:ring-teal-400"
                    value={selectedId ?? ''}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                  >
                    {treatments.map((t) => (
                      <option key={t.treatmentId} value={t.treatmentId}>{t.serviceName}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Stepper / Timeline con estados reales */}
              {sessions?.items && sessions.items.length > 0 ? (
                <div className="space-y-4">
                  <ol className="relative border-l-2 border-slate-700 ml-4 space-y-6">
                    {sessions.items.map((sessionItem) => {
                      const isCompleted = ['Completada', 'Atendido', 'Finalizado', 'Completado'].includes(sessionItem.careStatus);
                      const isScheduled = ['Programada', 'Confirmada'].includes(sessionItem.schedulingStatus);
                      
                      return (
                        <li key={sessionItem.sessionId} className="relative pl-6">
                          {/* Nodo del Stepper */}
                          <div className={`absolute -left-[17px] top-1 h-8 w-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold ${
                            isCompleted 
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm shadow-emerald-600/30' 
                              : isScheduled 
                                ? 'bg-teal-600 border-teal-400 text-white' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : sessionItem.number}
                          </div>

                          {/* Tarjeta de Sesión */}
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition-all">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-sm text-white">
                                Sesión #{sessionItem.number} · {dateLabel(sessionItem.date)}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isCompleted ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' :
                                isScheduled ? 'bg-teal-950/60 text-teal-300 border-teal-500/40' :
                                'bg-slate-800/60 text-slate-400 border-slate-700'
                              }`}>
                                {isCompleted ? 'Atención Concluida' : sessionItem.schedulingStatus}
                              </span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                              <div className="flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                                <span>Odontólogo: <strong className="text-white">{sessionItem.professional}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Sede: <strong className="text-white">{sessionItem.branch}</strong></span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Calendar className="w-8 h-8 mx-auto text-slate-600" />
                  <p>No hay sesiones registradas para este tratamiento.</p>
                </div>
              )}
            </div>

            {/* Columna Derecha: Tarjeta de Resumen y Acciones Rápidas */}
            <div className="space-y-5">
              {/* Resumen del Tratamiento */}
              <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  Plan Contratado Activo
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Especialidad Asignada</span>
                    <span className="font-bold text-white text-sm">{selectedTreatment?.serviceName || 'Evaluación Odontológica'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Fecha de Inicio / Alta</span>
                    <span className="font-semibold text-slate-200">{dateLabel(selectedTreatment?.realStartDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Estado Clínico</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-teal-300 font-bold text-[11px] mt-0.5">
                      {selectedTreatment?.status || 'En Tratamiento'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setActiveTab('reschedule')}
                    className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-teal-400" />
                    <span>¿Necesitas cambiar tu fecha?</span>
                  </button>
                </div>
              </div>

              {/* Indicaciones Recientes Badge */}
              <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <FileText className="w-4 h-4 text-teal-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Tus Indicaciones Médicas</h3>
                </div>
                <p className="text-xs text-slate-300">
                  Tienes <strong className="text-white">{instructions.length}</strong> documento(s) emitido(s) con indicaciones para tu cuidado en casa.
                </p>
                <button
                  onClick={() => setActiveTab('instructions')}
                  className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  Ver Indicaciones Emitidas
                </button>
              </div>

              {/* Tarjeta de Sede Trujillo & Guardia */}
              <div className="rounded-3xl border border-slate-800 bg-[#111726] p-5 shadow-xl space-y-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  <span>Sede Trujillo Central</span>
                </div>
                <p className="text-[11px] text-slate-400">Av. Larco 850, Trujillo · Lun - Sáb: 8:00 a 20:00</p>
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(true)}
                  className="w-full py-2 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-rose-400" />
                  <span>Teléfonos de Guardia y Urgencia</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: INDICACIONES MÉDICAS POSTOPERATORIAS (ESTILO CÉDULA CLÍNICA) - ANCHO COMPLETO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'instructions' && (
          <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 sm:p-8 shadow-xl space-y-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-teal-400" />
                  Indicaciones Postoperatorias & Cuidados en Casa
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Documentos clínicos aprobados y emitidos formalmente por tu odontólogo para tu recuperación.
                </p>
              </div>

              {attentions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Seleccionar Atención:</span>
                  <select
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-teal-400"
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 w-full">
                {instructions.map((inst) => (
                  <article key={inst.id_indicacion} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 space-y-4 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all">
                    <div>
                      {/* Sello de Autenticidad Clínica */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400 font-mono block">
                            NEXOSALUD RECETA POST-ATENCIÓN
                          </span>
                          <span className="text-xs font-bold text-white">
                            Versión Oficial {inst.version} · Estado: {inst.estado}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">
                          {dateLabel(inst.emitido_en)}
                        </span>
                      </div>

                      <div className="mt-4 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap font-normal">
                        {inst.contenido}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      {/* Acciones de Imprimir y Copiar */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintInstruction(inst)}
                          className="flex-1 py-1.5 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-400" />
                          <span>Imprimir Cédula Oficial</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyInstructions(inst.contenido)}
                          className="py-1.5 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Copiar texto de indicaciones"
                        >
                          <Copy className="w-3.5 h-3.5 text-teal-400" />
                          <span>Copiar</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Supervisado odontológicamente
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">ID: #{inst.id_indicacion}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 space-y-3">
                <FileCheck2 className="w-10 h-10 mx-auto text-slate-600" />
                <p className="font-semibold text-white">Sin indicaciones emitidas para esta consulta</p>
                <p className="max-w-md mx-auto text-slate-400">
                  Si tu odontólogo emitió directivas en consulta, asegúrate de haber seleccionado la fecha correcta en el menú superior o consúltalo en el Asistente NexoSalud.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: SOLICITUD DE REPROGRAMACIÓN DE CITAS - ANCHO COMPLETO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'reschedule' && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] w-full">
            {/* Formulario de Solicitud */}
            <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 sm:p-7 shadow-xl space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-teal-400" />
                  Solicitar Cambio de Horario
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Las solicitudes son revisadas por el equipo de recepción para asignar un cupo oficial de disponibilidad médica.
                </p>
              </div>

              {sessions?.items && sessions.items.filter((item) => item.number > 1 && item.careStatus === 'Pendiente').length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-xs text-slate-300 space-y-3">
                  <div className="flex items-center gap-2 text-teal-400 font-bold">
                    <Info className="w-4 h-4" />
                    <span>Sin sesiones posteriores pendientes de reprogramar</span>
                  </div>
                  <p className="leading-relaxed text-slate-400">
                    Tu tratamiento actual (<strong>{selectedTreatment?.serviceName || 'Evaluación General'}</strong>) cuenta con sus sesiones concluidas o una sola sesión programada. Si deseas agendar una nueva fase o control periódico, contacta a recepción.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowEmergencyModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-teal-400" />
                    <span>Contactar a Recepción Sede Trujillo</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={prepareRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Sesión que deseas reprogramar
                    </label>
                    <select 
                      name="sessionId" 
                      defaultValue="" 
                      required
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-teal-400"
                    >
                      <option value="" disabled>Selecciona una sesión programada posterior…</option>
                      {sessions?.items.filter((item) => item.number > 1 && item.careStatus === 'Pendiente').map((item) => (
                        <option key={item.sessionId} value={item.sessionId}>
                          Sesión #{item.number} · {dateLabel(item.date)} ({item.professional})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Fecha preferida
                      </label>
                      <input 
                        type="date"
                        value={preferredDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Franja horaria preferida
                      </label>
                      <input 
                        type="text"
                        placeholder="Ej. Mañana (9:00 - 12:00)"
                        maxLength={40}
                        value={preferredSlot}
                        onChange={(e) => setPreferredSlot(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Motivo o justificación de cambio
                    </label>
                    <textarea 
                      rows={3}
                      placeholder="Describe brevemente el motivo para que recepción evalúe la disponibilidad..."
                      maxLength={300}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-white outline-none focus:ring-1 focus:ring-teal-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !sessions?.items.some((item) => item.number > 1 && item.careStatus === 'Pendiente')}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    Preparar Solicitud de Reprogramación
                  </button>
                </form>
              )}
            </div>

            {/* Historial de Solicitudes Realizadas */}
            <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 sm:p-7 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Estado de tus Solicitudes</span>
                <span className="font-mono text-xs text-teal-300 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700">
                  {requests.length} Registradas
                </span>
              </h3>

              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req.requestId} className="rounded-2xl border border-slate-800 p-4 space-y-2 bg-slate-950/60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">
                          Solicitud #{req.requestId} (Sesión #{req.sessionId})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          req.status === 'Aprobada' ? 'bg-teal-950 text-teal-300 border-teal-400' :
                          req.status === 'Rechazada' ? 'bg-rose-950 text-rose-300 border-rose-500' :
                          req.status === 'Aplicada' ? 'bg-emerald-950 text-emerald-300 border-emerald-400' :
                          'bg-amber-950 text-amber-300 border-amber-500'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Cita original: <strong className="text-white">{dateLabel(req.originalDate)}</strong>
                      </p>
                      {req.preferredDate && (
                        <p className="text-xs text-teal-400 font-medium">
                          Preferencia: {dateLabel(req.preferredDate)} {req.preferredSlot ? `(${req.preferredSlot})` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p className="font-semibold text-white">Sin solicitudes activas</p>
                  <p>Cuando solicites un cambio, aquí podrás seguir el estado de aprobación por parte de recepción.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: ASISTENTE CLÍNICO AL PACIENTE NEXOSALUD - ANCHO COMPLETO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'assistant' && (
          <div className="rounded-3xl border border-slate-800 bg-[#111726] p-6 sm:p-8 shadow-xl space-y-5 w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shadow-inner">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Asistente Clínico Inteligente al Paciente
                  </h2>
                  <p className="text-xs text-slate-400">
                    Orientación sobre tus cuidados postoperatorios, citas y políticas institucionales de NexoSalud.
                  </p>
                </div>
              </div>
            </div>

            {/* Chips de Preguntas Frecuentes Sugeridas */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Consultas frecuentes de pacientes:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  '¿Cuáles son mis cuidados después de la extracción o limpieza?',
                  '¿Qué alimentos debo evitar en las primeras 24 horas?',
                  '¿Cómo puedo solicitar una reprogramación de mi cita?',
                  '¿Qué debo hacer si presento dolor o molestia intensa?'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={busy}
                    onClick={() => void askAssistant(undefined, chip)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:border-teal-500 hover:text-teal-300 transition-all text-left cursor-pointer font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversational Stream (Historial de Mensajes) */}
            {chatHistory.length > 0 && (
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 pt-2">
                {chatHistory.map((bubble) => (
                  <div
                    key={bubble.id}
                    className={`flex flex-col ${bubble.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2.5 ${
                        bubble.role === 'user'
                          ? 'bg-teal-600 text-white rounded-tr-xs shadow-md'
                          : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-xs shadow-xl'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px] opacity-75">
                        <span className="font-bold">
                          {bubble.role === 'user' ? 'Tú' : 'Asistente NexoSalud'}
                        </span>
                        <span>{bubble.timestamp}</span>
                      </div>

                      <p className="whitespace-pre-wrap">{bubble.text}</p>

                      {bubble.references && bubble.references.length > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-2.5 text-[11px] space-y-1">
                          <p className="font-bold text-teal-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> Guías Médicas Verificadas:
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                            {bubble.references.map((ref, idx) => (
                              <li key={idx} className="font-mono text-[10.5px]">{ref}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {bubble.limitations && bubble.limitations.length > 0 && (
                        <p className="text-[10px] text-slate-400 italic border-t border-slate-800 pt-1.5">
                          {bubble.limitations.join(' ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Campo de Pregunta */}
            <form onSubmit={askAssistant} className="flex gap-2 pt-2">
              <input 
                id="patient-question"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                placeholder="Escribe tu consulta sobre tus citas o cuidados dentales..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-teal-400"
              />
              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="rounded-xl bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {busy ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Consultar</span>
              </button>
            </form>
          </div>
        )}

      </main>

      {/* MODAL DE CONFIRMACIÓN DE REPROGRAMACIÓN */}
      {prepared && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-xs p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-reschedule-title" className="w-full max-w-lg rounded-3xl bg-[#0f172a] border border-slate-700 p-6 sm:p-7 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center gap-2 text-teal-400">
              <CheckCircle2 className="h-5 w-5" />
              <h2 id="confirm-reschedule-title" className="font-bold text-sm text-white">
                Confirma el Envío de tu Solicitud
              </h2>
            </div>
            
            <p className="text-xs leading-relaxed text-slate-300">
              {prepared.summary}
            </p>

            <div className="rounded-xl bg-amber-950/40 border border-amber-600/50 p-3 text-xs text-amber-200 leading-relaxed">
              <strong>Nota importante:</strong> Tu cita actual continuará vigente hasta que el equipo de recepción verifique la agenda y confirme el cambio.
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button 
                type="button" 
                onClick={() => setPrepared(null)} 
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
              >
                Volver
              </button>
              <button 
                type="button" 
                disabled={busy} 
                onClick={() => void confirmRequest()} 
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                Confirmar y Enviar a Recepción
              </button>
            </div>
          </section>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN OFICIAL DE RECETA / INDICACIONES */}
      {printInstruction && (
        <PrintPrescriptionModal 
          instruction={printInstruction} 
          patient={patient} 
          treatment={selectedTreatment}
          onClose={() => setPrintInstruction(null)} 
        />
      )}

      {/* MODAL DE URGENCIAS ODONTOLÓGICAS */}
      {showEmergencyModal && (
        <EmergencyTriageModal onClose={() => setShowEmergencyModal(false)} />
      )}

      {/* FLOATING TOAST FEEDBACK */}
      {toast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border bg-slate-900/95 backdrop-blur-md shadow-2xl text-xs max-w-md animate-in slide-in-from-bottom-3 duration-300 border-slate-700 text-slate-100"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-teal-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="flex-1 font-medium">{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Footer del Portal Paciente - Ancho Total */}
      <footer className="w-full border-t border-slate-800/80 bg-[#0c1220] px-4 sm:px-8 lg:px-12 py-5 text-center text-xs text-slate-400">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Portal del Paciente Seguro · NexoSalud Odontología Especializada</span>
          </div>
          <span>
            Este portal presenta información clínica documentada. En caso de dolor agudo o urgencia, comunícate con la sede central Trujillo.
          </span>
        </div>
      </footer>

    </div>
  );
}

// --------------------------------------------------------------------------
// MODAL DE IMPRESIÓN Y DESCARGA OFICIAL DE RECETA / INDICACIONES
// --------------------------------------------------------------------------
function PrintPrescriptionModal({
  instruction,
  patient,
  treatment,
  onClose
}: {
  instruction: PostCareInstructionItem;
  patient: PatientSession;
  treatment: PatientTreatment | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="prescription-title" className="w-full max-w-2xl rounded-3xl bg-white text-slate-900 border border-slate-300 p-8 shadow-2xl space-y-6">
        
        {/* Encabezado Membrete Oficial */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 id="prescription-title" className="text-lg font-black tracking-tight text-slate-900 uppercase">
                NexoSalud Odontología Especializada
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Sede Trujillo: Av. Larco 850 · Central: (044) 284-910 · Trujillo, Perú
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-500">
            <p className="font-bold text-slate-900">DOC-REC #{instruction.id_indicacion}</p>
            <p>VERSIÓN {instruction.version}</p>
          </div>
        </div>

        {/* Ficha del Paciente */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Paciente</span>
            <span className="font-bold text-slate-900 text-sm">{patient.nombres} {patient.apellidos || ''}</span>
            <span className="block text-[11px] text-slate-600 font-mono">DNI: {patient.dni || '40000315'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Tratamiento Asistido</span>
            <span className="font-semibold text-slate-900">{treatment?.serviceName || 'Evaluación Odontológica Integral'}</span>
            <span className="block text-[11px] text-slate-600">Fecha de emisión: {dateLabel(instruction.emitido_en)}</span>
          </div>
        </div>

        {/* Cuerpo de Indicaciones Odontológicas */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
            Indicaciones Médicas y Plan Farmacológico Postatención
          </h3>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
            {instruction.contenido}
          </div>
        </div>

        {/* Pie de Firma y Sello de Validación */}
        <div className="pt-6 border-t border-slate-200 grid sm:grid-cols-2 items-end gap-6 text-[11px]">
          <div className="space-y-1 text-slate-500">
            <p className="font-semibold text-slate-900 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Documento Oficial Validado
            </p>
            <p className="text-[10.5px]">Este memorándum ha sido emitido bajo supervisión del odontólogo tratante.</p>
          </div>
          <div className="text-center sm:text-right">
            <div className="border-t border-slate-400 inline-block pt-1.5 px-6">
              <span className="block font-bold text-xs text-slate-900">Dr(a). Responsable Odontológico</span>
              <span className="block text-[10px] text-slate-500 font-mono">Colegio Odontológico del Perú (COP)</span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Cédula</span>
          </button>
        </div>

      </section>
    </div>
  );
}

// --------------------------------------------------------------------------
// MODAL DE URGENCIAS ODONTOLÓGICAS (TRIAJE Y CONTACTO INMEDIATO)
// --------------------------------------------------------------------------
function EmergencyTriageModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="emergency-title" className="w-full max-w-lg rounded-3xl bg-[#0f172a] text-slate-100 border border-rose-500/40 p-6 sm:p-7 shadow-2xl space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <div>
              <h2 id="emergency-title" className="text-sm font-bold text-white">
                Guardia y Urgencia Odontológica 24h
              </h2>
              <span className="text-[11px] text-slate-400 font-normal">Sede Central Trujillo · NexoSalud</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal de urgencia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Triage de primeros auxilios */}
        <div className="space-y-3 text-xs">
          <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-3.5 space-y-2 text-rose-200">
            <p className="font-bold text-rose-100 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              Primeros auxilios antes de acudir:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-rose-200/90">
              <li><strong>Sangrado persistente:</strong> Muerde firmemente una gasa limpia o bolsa de té negro húmeda durante 45 minutos continuos sin escupir.</li>
              <li><strong>Dolor agudo:</strong> Toma el analgésico recetado. Nunca coloques aspirina directa sobre la encía ni apliques compresas calientes externas.</li>
              <li><strong>Sutura suelta o desalojo:</strong> No intentes recolocarla; mantén higiene suave con agua tibia.</li>
            </ul>
          </div>

          {/* Central telefónica directa */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-xs">Central Telefónica de Sede</p>
                <p className="text-[11px] text-teal-400 font-mono">(044) 284-910</p>
              </div>
              <a 
                href="tel:044284910" 
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Llamar</span>
              </a>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <p className="font-bold text-white text-xs">WhatsApp de Guardia Inmediata</p>
                <p className="text-[11px] text-teal-400 font-mono">+51 948 123 456</p>
              </div>
              <a 
                href="https://wa.me/51948123456?text=Hola,%20tengo%20una%20urgencia%20odontológica%20y%20requiero%20asistencia%20en%20Sede%20Trujillo." 
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Escribir</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-all cursor-pointer"
          >
            Entendido, volver al portal
          </button>
        </div>

      </section>
    </div>
  );
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Por coordinar';
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value));
  } catch {
    return value;
  }
}
