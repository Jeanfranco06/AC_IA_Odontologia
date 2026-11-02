import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  HeartPulse,
  History,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Phone,
  RotateCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';
import type { PatientSession } from '@/shared/services/patientAuthService';
import {
  CLINIC_LOCATIONS,
  TIME_SLOT_CHIPS,
  normalizeBranchKey,
  type ReasonChipOption,
} from './landingData';

export interface HeroIntakeWidgetProps {
  catalogs: {
    servicios: any[];
    sedes: any[];
    canales: any[];
    fuentes: any[];
  };
  portalMode: 'new' | 'registered';
  setPortalMode: (mode: 'new' | 'registered') => void;

  // Estado formulario paciente nuevo
  selectedReasonChip: ReasonChipOption['id'] | '';
  onSelectReasonChip: (chipId: ReasonChipOption['id']) => void;
  serviceId: string;
  setServiceId: (val: string) => void;
  sede: string;
  setSede: (val: string) => void;
  timeSlot: string;
  setTimeSlot: (val: string) => void;
  fullName: string;
  setFullName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  dudaEspecifica: string;
  setDudaEspecifica: (val: string) => void;
  termsAccepted: boolean;
  setTermsAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loading: boolean;
  resolvingIdentity: boolean;
  submitError: string | null;
  onSubmitNewPatient: (e?: React.FormEvent) => void;

  // Estado de éxito paciente nuevo
  submittedSuccess: boolean;
  isRecurringSubmitted: boolean;
  isNewSharedSubmitted: boolean;
  consultationCount: number;
  onResetNewPatient: () => void;
  onBackToDashboard: () => void;

  // Estado paciente registrado
  patientSession: PatientSession | null;
  loginDni: string;
  setLoginDni: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  loginLoading: boolean;
  loginError: string | null;
  setLoginError: (val: string | null) => void;
  onLoginWithPassword: (e?: React.FormEvent) => void;
  otpSending: boolean;
  onSendOtp: () => void;
  onLogout: () => void;

  // Agendamiento express paciente autenticado
  expressServiceId: string;
  setExpressServiceId: (val: string) => void;
  expressSede: string;
  setExpressSede: (val: string) => void;
  expressTimeSlot: string;
  setExpressTimeSlot: (val: string) => void;
  expressDuda: string;
  setExpressDuda: (val: string) => void;
  expressSubmitting: boolean;
  expressSuccess: boolean;
  setExpressSuccess: (val: boolean) => void;
  onExpressSubmit: (e: React.FormEvent) => void;

  // Control externo de paso y feedback visual de preselección
  step: number;
  setStep: (step: number) => void;
  highlightTrigger?: number;
  preselectionNotice?: string | null;
}

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -32 : 32,
    opacity: 0,
  }),
};

// Opciones concisas del Evaluador de Sonrisa (Paso 1)
const SMILE_GOALS = [
  {
    id: 'ortodoncia' as const,
    title: 'Alinear mis dientes',
    desc: 'Alineadores invisibles o brackets estéticos',
    icon: Sparkles,
  },
  {
    id: 'estetica' as const,
    title: 'Diseño y blanqueamiento',
    desc: 'Carillas cerámicas o aclaramiento LED',
    icon: Zap,
  },
  {
    id: 'implante' as const,
    title: 'Recuperar un diente',
    desc: 'Implantes 3D o coronas fijas',
    icon: ShieldCheck,
  },
  {
    id: 'limpieza_dolor' as const,
    title: 'Limpieza o dolor dental',
    desc: 'Chequeo preventivo o alivio de molestia',
    icon: Stethoscope,
  },
];

// Opciones de Prioridad (Paso 2)
const PRIORITIES = [
  {
    id: 'sin_dolor' as const,
    title: 'Atención 100% sin dolor',
    desc: 'Anestesia suave computarizada y cero estrés',
    icon: HeartPulse,
  },
  {
    id: 'horarios' as const,
    title: 'Horarios flexibles',
    desc: 'Turnos extendidos tarde/noche y sábados',
    icon: Clock,
  },
  {
    id: 'presupuesto' as const,
    title: 'Presupuesto y cuotas',
    desc: 'Planes claros sin intereses y convenios',
    icon: Briefcase,
  },
];

// Opciones de Sedes en Trujillo (Paso 3)
const SEDE_CARDS = [
  {
    name: 'Sede California',
    reference: 'Av. Larco · Estacionamiento privado',
  },
  {
    name: 'Sede El Golf',
    reference: 'Av. El Golf · Tomografía 3D in-house',
  },
  {
    name: 'Sede Centro Histórico',
    reference: 'Jr. Pizarro · A 2 cuadras de Plaza de Armas',
  },
];

export function HeroIntakeWidget({
  catalogs,
  portalMode,
  setPortalMode,
  selectedReasonChip,
  onSelectReasonChip,
  serviceId,
  setServiceId,
  sede,
  setSede,
  timeSlot,
  setTimeSlot,
  fullName,
  setFullName,
  phone,
  setPhone,
  email,
  setEmail,
  dudaEspecifica,
  setDudaEspecifica,
  termsAccepted,
  setTermsAccepted,
  errors,
  setErrors,
  loading,
  resolvingIdentity,
  submitError,
  onSubmitNewPatient,
  submittedSuccess,
  isRecurringSubmitted,
  isNewSharedSubmitted,
  consultationCount,
  onResetNewPatient,
  onBackToDashboard,
  patientSession,
  loginDni,
  setLoginDni,
  loginPassword,
  setLoginPassword,
  loginLoading,
  loginError,
  setLoginError,
  onLoginWithPassword,
  otpSending,
  onSendOtp,
  onLogout,
  expressServiceId,
  setExpressServiceId,
  expressSede,
  setExpressSede,
  expressTimeSlot,
  setExpressTimeSlot,
  expressDuda,
  setExpressDuda,
  expressSubmitting,
  expressSuccess,
  setExpressSuccess,
  onExpressSubmit,
  step,
  setStep,
  highlightTrigger = 0,
  preselectionNotice = null,
}: HeroIntakeWidgetProps) {
  const [direction, setDirection] = useState<number>(1);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Estados interactivos para perfil lúdico de bajo compromiso
  const [selectedPriority, setSelectedPriority] = useState<'sin_dolor' | 'horarios' | 'presupuesto'>('sin_dolor');
  const [leadOccupation, setLeadOccupation] = useState<'estudiante' | 'trabajador' | 'independiente' | 'flexible' | ''>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const availableSedes: Array<{ name: string; subtitle: string }> =
    catalogs.sedes && catalogs.sedes.length > 0
      ? catalogs.sedes.map((s: any) => ({
          name: s.nombre,
          subtitle: s.direccion || 'Trujillo',
        }))
      : CLINIC_LOCATIONS.map((loc) => ({
          name: loc.name,
          subtitle: loc.neighborhood.replace(' · Trujillo', ''),
        }));

  const selectedGoalObj =
    SMILE_GOALS.find((g) => g.id === selectedReasonChip) || SMILE_GOALS[0];

  const selectedPriorityObj =
    PRIORITIES.find((p) => p.id === selectedPriority) || PRIORITIES[0];

  const selectedServiceName =
    catalogs.servicios.find((s: any) => String(s.id_servicio) === String(serviceId))?.nombre ||
    selectedGoalObj.title;

  const selectedTimeSlotObj = TIME_SLOT_CHIPS.find((t) => t.id === timeSlot);

  // Navegación fluida entre micro-pasos
  const handleSelectGoal = (goalId: ReasonChipOption['id']) => {
    onSelectReasonChip(goalId);
    if (errors.reason) setErrors((prev) => ({ ...prev, reason: '' }));
    setDirection(1);
    setStep(2);
  };

  const handleSelectPriority = (priorityId: 'sin_dolor' | 'horarios' | 'presupuesto') => {
    setSelectedPriority(priorityId);
    setDirection(1);
    setStep(3);
  };

  const handleSelectSede = (sedeName: string) => {
    setSede(sedeName);
    if (errors.sede) setErrors((prev) => ({ ...prev, sede: '' }));

    // Simulación diagnóstica ultra persuasiva de 1.1s
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setDirection(1);
      setStep(4);

      // Disparo de celebración sutil con confetti
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#0F766E', '#065F46', '#2DD4BF', '#F59E0B'],
          disableForReducedMotion: true,
        });
      } catch (err) {
        // Safe fallback
      }
    }, 1100);
  };

  const handleGoBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // Guardar datos enriquecidos antes del submit
  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Enriquecer la duda clínica si no se ha agregado el contexto de prioridad
    const priorityText = `[Prioridad: ${selectedPriorityObj.title}]`;
    const occupationText = leadOccupation ? `[Convenio: ${leadOccupation}]` : '';
    let enrichedDuda = dudaEspecifica.trim();

    if (!enrichedDuda.includes(priorityText)) {
      enrichedDuda = `${priorityText} ${occupationText} ${enrichedDuda}`.trim();
      setDudaEspecifica(enrichedDuda);
    }

    onSubmitNewPatient(e);
  };

  // ESTADO DE ÉXITO (POST-REGISTRO)
  if (submittedSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.08)]"
      >
        <div className="flex flex-col items-center text-center">
          {/* Estado de Coordinación Médica */}
          <div className="w-full mb-4 rounded-xl border border-teal-100 bg-teal-50/70 p-3.5 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-900 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Coordinación de Citas en Curso
              </span>
              <span className="text-[10.5px] font-mono text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200/70">
                Sede {sede || 'Trujillo'}
              </span>
            </div>
            <p className="text-[11.5px] text-teal-800 leading-relaxed">
              Estamos revisando la agenda para enviarte los turnos exactos y el especialista indicado a tu WhatsApp.
            </p>
          </div>

          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#065F46] ring-1 ring-emerald-600/20">
            {isRecurringSubmitted ? (
              <RotateCw className="h-5 w-5 text-[#0F766E]" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-[#0F766E]" />
            )}
          </div>

          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-0.5 text-[11px] font-semibold text-[#065F46]">
            {isRecurringSubmitted
              ? `Consulta anexada a tu historial (#${consultationCount})`
              : isNewSharedSubmitted
                ? 'Nuevo expediente creado'
                : 'Diagnóstico Preliminar Solicitado'}
          </span>

          <h2 className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {isRecurringSubmitted
              ? 'Actualizamos tu expediente odontológico'
              : '¡Recibimos tu solicitud de evaluación!'}
          </h2>

          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600">
            Gracias, <strong className="font-semibold text-slate-900">{fullName}</strong>. Te escribiremos a tu WhatsApp en menos de 15 minutos con las opciones de horario y tu protocolo personalizado.
          </p>

          {/* Resumen de la Solicitud Inicial */}
          <dl className="mt-4 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-left text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">WhatsApp de contacto</dt>
              <dd className="font-mono font-semibold text-slate-900">+51 {phone}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
              <dt className="text-slate-500">Tratamiento de interés</dt>
              <dd className="font-medium text-[#0F766E] text-right">{selectedGoalObj.title}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
              <dt className="text-slate-500">Prioridad clínica</dt>
              <dd className="font-medium text-slate-800 text-right">{selectedPriorityObj.title}</dd>
            </div>
            {sede && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                <dt className="text-slate-500">Sede</dt>
                <dd className="font-medium text-slate-800">{sede}</dd>
              </div>
            )}
          </dl>

          {/* Acciones */}
          <div className="mt-4 flex w-full flex-col gap-2">
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('tu-experiencia');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 h-9 rounded-xl border border-teal-200 bg-teal-50/60 px-3 text-xs font-semibold text-teal-800 transition-all hover:bg-teal-100/70 active:scale-[0.98] cursor-pointer"
              >
                Cómo atendemos (Paso a paso)
              </button>
              <button
                type="button"
                onClick={onResetNewPatient}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
              >
                Nueva consulta
              </button>
            </div>

            <button
              type="button"
              onClick={onBackToDashboard}
              className="mt-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Lock className="h-3 w-3" />
              <span>Acceso para Staff / Doctores</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // CÁLCULO DE PROGRESO Y TEXTO DE CABECERA
  const stepProgress = portalMode === 'new' ? (step / 4) * 100 : 100;

  return (
    <motion.div
      key={`widget-highlight-${highlightTrigger}`}
      initial={highlightTrigger > 0 ? { scale: 0.985 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full overflow-hidden rounded-2xl border bg-white shadow-[0_25px_60px_-15px_rgba(15,118,110,0.16)] ring-1 ring-teal-600/10 transition-all duration-300 ${
        preselectionNotice
          ? 'border-[#0F766E] ring-4 ring-teal-600/20'
          : 'border-slate-200/90'
      }`}
    >
      {/* Barra de progreso de micro-pasos */}
      <div className="h-[3px] w-full bg-slate-100 overflow-hidden" aria-hidden>
        <motion.div
          className="h-full bg-[#0F766E]"
          initial={false}
          animate={{
            width: `${stepProgress}%`,
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Banner de preselección externa */}
      <AnimatePresence>
        {preselectionNotice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-emerald-700/15 bg-[#ECFDF5] px-5 py-2.5 text-xs font-medium text-[#065F46] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
              <span className="truncate font-semibold">{preselectionNotice}</span>
            </div>
            <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[#0F766E]">
              Evaluador listo
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabecera del Evaluador */}
      <div className="border-b border-slate-100 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {portalMode === 'new' && step > 1 && !isAnalyzing && (
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Paso anterior"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}

            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E]" aria-hidden />
              {portalMode === 'new'
                ? 'Evaluación Odontológica'
                : patientSession
                  ? 'Expediente verificado'
                  : 'Portal de Pacientes'}
            </span>
          </div>

          {patientSession ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          ) : (
            <div
              role="tablist"
              aria-label="Tipo de paciente"
              className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'new'}
                onClick={() => setPortalMode('new')}
                className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                  portalMode === 'new'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Evaluación
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'registered'}
                onClick={() => setPortalMode('registered')}
                className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                  portalMode === 'registered'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ya soy paciente
              </button>
            </div>
          )}
        </div>

        {/* Stepper dinámico con SVG Path Length Animation y resortes elásticos */}
        {portalMode === 'new' && (
          <div className="relative mt-3.5 pt-1 border-t border-slate-100">
            {/* Línea animada SVG entre los nodos del Stepper */}
            <svg
              className="pointer-events-none absolute left-0 right-0 top-[17px] h-2 w-full overflow-visible"
              aria-hidden
            >
              <line
                x1="12.5%"
                y1="50%"
                x2="87.5%"
                y2="50%"
                stroke="#E2E8F0"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <motion.line
                x1="12.5%"
                y1="50%"
                x2="87.5%"
                y2="50%"
                stroke="#0F766E"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: shouldReduceMotion ? 1 : Math.max(0, Math.min(1, (step - 1) / 3)) }}
                transition={{ type: 'spring', damping: 22, stiffness: 140 }}
              />
            </svg>

            <div className="relative z-10 grid grid-cols-4 gap-1">
              {[
                { num: 1, label: 'Objetivo', icon: Sparkles },
                { num: 2, label: 'Prioridad', icon: HeartPulse },
                { num: 3, label: 'Sede', icon: MapPin },
                { num: 4, label: 'Contacto', icon: CheckCircle2 },
              ].map((s) => {
                const isPast = step > s.num;
                const isCurrent = step === s.num;
                const IconComponent = s.icon;
                return (
                  <div key={s.num} className="flex flex-col items-center">
                    <motion.div
                      animate={isCurrent && !shouldReduceMotion ? { scale: [1, 1.12, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        isPast
                          ? 'bg-[#0F766E] text-white shadow-xs'
                          : isCurrent
                            ? 'bg-[#0F766E] text-white ring-4 ring-teal-500/25 shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-400'
                      }`}
                    >
                      {isPast ? <Check className="h-3 w-3 stroke-[3]" /> : <IconComponent className="h-3 w-3" />}
                    </motion.div>
                    <span
                      className={`mt-1 text-[10px] font-medium tracking-tight truncate ${
                        isCurrent ? 'text-[#0F766E] font-semibold' : isPast ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
            {portalMode === 'new'
              ? step === 1
                ? '¿Qué deseas mejorar en tu sonrisa?'
                : step === 2
                  ? '¿Cuál es tu mayor prioridad?'
                  : step === 3
                    ? '¿En qué sede prefieres atenderte?'
                    : 'Propuesta lista · Turno por WhatsApp'
              : patientSession
                ? `Hola, ${patientSession.nombres}`
                : 'Ingresa a tu expediente clínico'}
          </h2>

          {/* Badge interactivo con LayoutId (Layout Morphing de la selección activa) */}
          <AnimatePresence>
            {portalMode === 'new' && step > 1 && (
              <motion.div
                layoutId="active-selection-badge"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-medium text-[#065F46] border border-teal-200/70"
              >
                <Sparkles className="h-2.5 w-2.5 text-[#0F766E]" />
                <span className="font-semibold truncate max-w-[140px]">{selectedGoalObj.title}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-0.5 text-xs text-slate-500">
          {portalMode === 'new'
            ? step === 1
              ? 'Elige una opción para orientar tu diagnóstico.'
              : step === 2
                ? 'Adaptamos la atención a tu comodidad.'
                : step === 3
                  ? 'Todas nuestras sedes cuentan con tecnología 3D.'
                  : 'Te compartimos turnos disponibles y propuesta personalizada.'
            : patientSession
              ? 'Reserva tu control en un solo clic.'
              : 'Accede con tu DNI para revisar tus citas.'}
        </p>
      </div>

      {/* Cuerpo del Evaluador Interactivo con altura mínima reservada (CLS = 0) */}
      <div className="px-5 py-5 sm:px-6 min-h-[350px] sm:min-h-[330px]">
        {/* INTERMEDIO: Animación de Diagnóstico (1.1s) */}
        {isAnalyzing ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200">
              <ScanLine className="h-7 w-7 text-[#0F766E] animate-pulse" />
              <div className="absolute -inset-1 rounded-2xl border border-teal-400/40 animate-ping" />
            </div>

            <div className="space-y-1 max-w-xs">
              <h3 className="text-sm font-semibold text-slate-900">
                Preparando tu evaluación personalizada…
              </h3>
              <p className="text-xs text-slate-500">
                Asignando especialista y agenda en <strong className="text-slate-800">{sede}</strong>.
              </p>
            </div>
          </div>
        ) : portalMode === 'new' ? (
          <form onSubmit={handleFormSubmit} noValidate>
            <AnimatePresence mode="wait" custom={direction}>
              {/* PASO 1: Objetivo de Sonrisa */}
              {step === 1 && (
                <motion.div
                  key="quiz-step-1"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2.5"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SMILE_GOALS.map((goal) => {
                      const IconComponent = goal.icon;
                      const isSelected = selectedReasonChip === goal.id;
                      return (
                        <motion.button
                          key={goal.id}
                          layoutId={`goal-option-${goal.id}`}
                          type="button"
                          whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectGoal(goal.id)}
                          className={`group flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0F766E] bg-[#ECFDF5]/80 ring-2 ring-teal-600/20 shadow-xs'
                              : 'border-slate-200/90 bg-white hover:border-[#0F766E]/60 hover:bg-slate-50/80 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <motion.span
                              whileHover={shouldReduceMotion ? {} : { rotate: [0, -8, 8, 0], scale: 1.15 }}
                              transition={{ duration: 0.35, ease: 'easeInOut' }}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-[#0F766E] text-white shadow-xs'
                                  : 'bg-[#ECFDF5] text-[#0F766E] group-hover:bg-teal-100/90'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                            </motion.span>
                            <div className="min-w-0">
                              <h3 className="text-xs font-semibold text-slate-900 leading-snug">
                                {goal.title}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">
                                {goal.desc}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#0F766E] group-hover:translate-x-0.5 transition-all" />
                        </motion.button>
                      );
                    })}
                  </div>

                  {errors.reason && (
                    <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.reason}</span>
                    </p>
                  )}
                </motion.div>
              )}

              {/* PASO 2: Mayor Prioridad */}
              {step === 2 && (
                <motion.div
                  key="quiz-step-2"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2.5"
                >
                  <div className="space-y-2">
                    {PRIORITIES.map((item) => {
                      const IconComponent = item.icon;
                      const isSelected = selectedPriority === item.id;
                      return (
                        <motion.button
                          key={item.id}
                          layoutId={`priority-option-${item.id}`}
                          type="button"
                          whileHover={shouldReduceMotion ? {} : { y: -2, scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectPriority(item.id)}
                          className={`group w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0F766E] bg-[#ECFDF5]/80 ring-2 ring-teal-600/20 shadow-xs'
                              : 'border-slate-200/90 bg-white hover:border-[#0F766E]/60 hover:bg-slate-50/80 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <motion.span
                              whileHover={shouldReduceMotion ? {} : { rotate: [0, -8, 8, 0], scale: 1.15 }}
                              transition={{ duration: 0.35, ease: 'easeInOut' }}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-[#0F766E] text-white shadow-xs'
                                  : 'bg-[#ECFDF5] text-[#0F766E] group-hover:bg-teal-100/90'
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                            </motion.span>
                            <div className="min-w-0">
                              <h3 className="text-xs font-semibold text-slate-900 leading-snug">
                                {item.title}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#0F766E] group-hover:translate-x-0.5 transition-all" />
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* PASO 3: Selección de Sede */}
              {step === 3 && (
                <motion.div
                  key="quiz-step-3"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2.5"
                >
                  <div className="space-y-2">
                    {SEDE_CARDS.map((branch) => {
                      const isSelected =
                        normalizeBranchKey(sede) === normalizeBranchKey(branch.name);
                      return (
                        <motion.button
                          key={branch.name}
                          layoutId={`sede-option-${branch.name}`}
                          type="button"
                          whileHover={shouldReduceMotion ? {} : { y: -2, scale: 1.015 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectSede(branch.name)}
                          className={`group w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0F766E] bg-[#ECFDF5]/80 ring-2 ring-teal-600/20 shadow-xs'
                              : 'border-slate-200/90 bg-white hover:border-[#0F766E]/60 hover:bg-slate-50/80 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <motion.span
                              whileHover={shouldReduceMotion ? {} : { scale: 1.18, y: -1 }}
                              transition={{ duration: 0.35, ease: 'easeInOut' }}
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-[#0F766E] text-white shadow-xs'
                                  : 'bg-[#ECFDF5] text-[#0F766E] group-hover:bg-teal-100/90'
                              }`}
                            >
                              <MapPin className="h-4 w-4" />
                            </motion.span>
                            <div className="min-w-0">
                              <h3 className="text-xs font-semibold text-slate-900 leading-snug">
                                {branch.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">
                                {branch.reference}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#0F766E] group-hover:translate-x-0.5 transition-all" />
                        </motion.button>
                      );
                    })}
                  </div>

                  {errors.sede && (
                    <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.sede}</span>
                    </p>
                  )}
                </motion.div>
              )}

              {/* PASO 4: Resultado & Captación de WhatsApp Cero Fricción */}
              {step === 4 && (
                <motion.div
                  key="quiz-step-4"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3.5"
                >
                  {/* Resumen conciso */}
                  <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles className="h-3.5 w-3.5 text-[#0F766E] shrink-0" />
                        <h3 className="text-xs font-semibold text-slate-900 truncate">
                          {selectedGoalObj.title}
                        </h3>
                      </div>
                      <span className="shrink-0 text-[10.5px] font-medium text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                        {sede || 'Trujillo'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Prioridad: <strong className="text-slate-800">{selectedPriorityObj.title}</strong>
                    </p>
                  </div>

                  {/* Input: Nombres y apellidos */}
                  <div>
                    <div className="relative">
                      <input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder=" "
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                        }}
                        aria-invalid={Boolean(errors.fullName)}
                        className={`peer block h-11 w-full rounded-xl border bg-white px-3.5 pt-4 pb-1 text-xs text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                          errors.fullName
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200/90 focus:border-[#0F766E] focus:ring-teal-600/20'
                        }`}
                      />
                      <label
                        htmlFor="fullName"
                        className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
                      >
                        Tus nombres y apellidos completos *
                      </label>
                    </div>
                    {errors.fullName && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Input: WhatsApp (+51) */}
                  <div>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                        +51
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={9}
                        autoComplete="tel-national"
                        placeholder=" "
                        value={phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPhone(val);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                        }}
                        aria-invalid={Boolean(errors.phone)}
                        className={`peer block h-11 w-full rounded-xl border bg-white pl-14 pr-3.5 pt-4 pb-1 font-mono text-xs text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                          errors.phone
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200/90 focus:border-[#0F766E] focus:ring-teal-600/20'
                        }`}
                      />
                      <label
                        htmlFor="phone"
                        className="pointer-events-none absolute left-14 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
                      >
                        Número de WhatsApp para coordinar tu cita *
                      </label>
                    </div>
                    {errors.phone ? (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.phone}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-[10.5px] text-slate-400">
                        Te enviaremos los turnos exactos sin llamadas comerciales molestas.
                      </p>
                    )}
                  </div>

                  {/* Acordeón Opcional: Convenios, Horario y Correo */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields((v) => !v)}
                      aria-expanded={showOptionalFields}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#0F766E] cursor-pointer"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          showOptionalFields ? 'rotate-180 text-[#0F766E]' : ''
                        }`}
                      />
                      <span>¿Convenio universitario o laboral? (Tarifas especiales · Opcional)</span>
                    </button>

                    {showOptionalFields && (
                      <div className="mt-3 space-y-3">
                        {/* Convenio / Ocupación */}
                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-semibold text-slate-700 flex items-center gap-1">
                            <GraduationCap className="h-3 w-3 text-[#0F766E]" />
                            <span>Aplicar descuento por convenio institucional</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {[
                              { id: 'estudiante', label: 'Estudiante (UPAO/UNT/UPN)' },
                              { id: 'trabajador', label: 'Trabajador Dependiente' },
                              { id: 'independiente', label: 'Independiente / Empresa' },
                              { id: 'flexible', label: 'Horario Libre' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  setLeadOccupation(
                                    leadOccupation === item.id ? '' : (item.id as any)
                                  )
                                }
                                className={`p-1.5 text-[10.5px] rounded-lg border text-left transition-all cursor-pointer ${
                                  leadOccupation === item.id
                                    ? 'border-teal-700 bg-teal-700 text-white font-semibold'
                                    : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-teal-500'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Turno Preferido */}
                        <div className="space-y-1.5">
                          <label className="text-[10.5px] font-semibold text-slate-700 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#0F766E]" />
                            <span>Franja horaria preferida</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1.5 text-xs">
                            {TIME_SLOT_CHIPS.map((slot) => {
                              const isSelected = timeSlot === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => setTimeSlot(isSelected ? '' : slot.id)}
                                  className={`p-1.5 text-center rounded-lg border text-[10.5px] transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#0F766E] bg-[#ECFDF5] text-[#065F46] font-semibold'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  <div>{slot.label}</div>
                                  <div className="font-mono text-[9.5px] text-slate-400">
                                    {slot.hours}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Correo Opcional */}
                        <div className="relative">
                          <input
                            id="email"
                            type="email"
                            placeholder=" "
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                            }}
                            className="peer block h-10 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pt-3.5 pb-1 text-xs text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                          />
                          <label
                            htmlFor="email"
                            className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
                          >
                            Correo electrónico (opcional)
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Consentimiento */}
                  <div>
                    <div
                      role="checkbox"
                      aria-checked={termsAccepted}
                      tabIndex={0}
                      onClick={() => {
                        setTermsAccepted((prev) => !prev);
                        if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setTermsAccepted((prev) => !prev);
                          if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                        }
                      }}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 transition-all cursor-pointer select-none ${
                        termsAccepted
                          ? 'border-[#0F766E]/40 bg-[#ECFDF5]/40'
                          : errors.terms
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          termsAccepted
                            ? 'border-[#0F766E] bg-[#0F766E] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {termsAccepted && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <span className="text-[11px] leading-snug text-slate-600">
                        Autorizo a <strong className="font-semibold text-slate-800">NexoSalud Dental</strong> a
                        enviarme mi diagnóstico preliminar y horarios por WhatsApp (Ley N° 29733).
                      </span>
                    </div>
                    {errors.terms && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.terms}</span>
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Botón Principal de Envío con Shimmer Beam y Spring Hover */}
                  <motion.button
                    whileHover={shouldReduceMotion ? {} : { scale: 1.018, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    type="submit"
                    disabled={loading || resolvingIdentity}
                    className="relative overflow-hidden flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F766E] via-[#0D9488] to-[#115E59] px-5 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:shadow-teal-900/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 disabled:opacity-60 cursor-pointer group"
                  >
                    {/* Shimmer light bar */}
                    <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    {resolvingIdentity ? (
                      <>
                        <ShieldCheck className="h-4 w-4 animate-pulse" />
                        <span>Verificando disponibilidad clínica…</span>
                      </>
                    ) : loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Conectando con admisión de Trujillo…</span>
                      </>
                    ) : (
                      <>
                        <span>Ver mi propuesta y turnos en WhatsApp</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </motion.button>

                  <p className="flex items-center justify-center gap-1.5 text-center text-[10.5px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
                    <span>Sin costo previo por web · Respuesta personalizada en &lt; 15 min</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        ) : !patientSession ? (
          /* MODO PACIENTE REGISTRADO: Login DNI + Clave o Código WhatsApp OTP */
          <form onSubmit={onLoginWithPassword} className="space-y-4" noValidate>
            <div className="relative">
              <input
                id="loginDni"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder=" "
                value={loginDni}
                onChange={(e) => {
                  setLoginDni(e.target.value.replace(/\D/g, ''));
                  setLoginError(null);
                }}
                className="peer block h-12 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pt-4 pb-1 font-mono text-sm text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
              <label
                htmlFor="loginDni"
                className="pointer-events-none absolute left-3.5 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
              >
                Documento de identidad (DNI 8 dígitos) *
              </label>
            </div>

            <div className="relative">
              <input
                id="loginPassword"
                type={showLoginPassword ? 'text' : 'password'}
                placeholder=" "
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError(null);
                }}
                className="peer block h-12 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pr-10 pt-4 pb-1 text-sm text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
              <label
                htmlFor="loginPassword"
                className="pointer-events-none absolute left-3.5 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
              >
                Contraseña de tu portal
              </label>
              <button
                type="button"
                onClick={() => setShowLoginPassword((v) => !v)}
                aria-label="Mostrar u ocultar contraseña"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {loginError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando expediente…</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Ingresar con mi contraseña</span>
                </>
              )}
            </button>

            <div className="relative py-1 text-center">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-medium text-slate-400">
                o accede sin contraseña
              </span>
            </div>

            <button
              type="button"
              onClick={onSendOtp}
              disabled={otpSending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0F766E]/30 bg-[#ECFDF5]/60 px-4 text-xs font-semibold text-[#065F46] transition-all hover:bg-[#ECFDF5] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {otpSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#0F766E]" />
                  <span>Enviando código por WhatsApp…</span>
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 text-[#0F766E]" />
                  <span>Recibir código de 4 dígitos por WhatsApp</span>
                </>
              )}
            </button>
          </form>
        ) : expressSuccess ? (
          /* ÉXITO AGENDAMIENTO EXPRESS PACIENTE REGISTRADO */
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#0F766E]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <span className="inline-flex rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                Prioridad Paciente Activo
              </span>
              <h3 className="text-base font-semibold text-slate-900">
                Solicitud express vinculada a tu historia
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Asociamos este requerimiento a tu expediente <strong>(DNI {patientSession.dni})</strong>. Te
                confirmaremos la hora por WhatsApp en breves minutos.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExpressSuccess(false)}
                className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
              >
                Nueva solicitud
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 h-9 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98] cursor-pointer"
              >
                Finalizar sesión
              </button>
            </div>
          </div>
        ) : (
          /* DASHBOARD COMPACTO PACIENTE AUTENTICADO */
          <form onSubmit={onExpressSubmit} className="space-y-4">
            <div className="rounded-xl border border-[#0F766E]/20 bg-[#ECFDF5]/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{patientSession.fullName}</p>
                  <p className="font-mono text-[11px] text-slate-500">DNI {patientSession.dni}</p>
                </div>
                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-semibold text-[#065F46] ring-1 ring-emerald-600/20">
                  Historia Activa
                </span>
              </div>

              {patientSession.proxima_cita ? (
                <div className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs border border-slate-200/70">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-[#0F766E] mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">
                      Próxima cita: {patientSession.proxima_cita.fecha} ({patientSession.proxima_cita.hora})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {patientSession.proxima_cita.servicio} · {patientSession.proxima_cita.sede}
                    </p>
                  </div>
                </div>
              ) : patientSession.ultima_atencion ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/90 p-2 text-[11px] text-slate-600 border border-slate-200/60">
                  <History className="h-3.5 w-3.5 text-[#0F766E]" />
                  <span>
                    Última atención: <strong>{patientSession.ultima_atencion.servicio}</strong>
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="express-service" className="mb-1.5 block text-xs font-semibold text-slate-800">
                Motivo de tu nueva cita
              </label>
              <select
                id="express-service"
                value={expressServiceId}
                onChange={(e) => setExpressServiceId(e.target.value)}
                required
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              >
                <option value="">Selecciona el tratamiento o control…</option>
                {catalogs.servicios.map((s: any) => (
                  <option key={s.id_servicio} value={String(s.id_servicio)}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="express-sede" className="mb-1.5 block text-xs font-semibold text-slate-800">
                  Sede
                </label>
                <select
                  id="express-sede"
                  value={expressSede}
                  onChange={(e) => setExpressSede(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                >
                  {availableSedes.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name.replace('Sede ', '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="express-slot" className="mb-1.5 block text-xs font-semibold text-slate-800">
                  Turno
                </label>
                <select
                  id="express-slot"
                  value={expressTimeSlot}
                  onChange={(e) => setExpressTimeSlot(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                >
                  <option value="1">Mañana (08:00–13:00)</option>
                  <option value="2">Tarde (13:00–18:00)</option>
                  <option value="3">Noche (18:00–21:00)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="express-duda" className="mb-1.5 block text-xs font-semibold text-slate-800">
                Observación o molestia (opcional)
              </label>
              <input
                id="express-duda"
                type="text"
                maxLength={140}
                placeholder="Ej. Control de ortodoncia, molestia en molar..."
                value={expressDuda}
                onChange={(e) => setExpressDuda(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={expressSubmitting || !expressServiceId}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white transition-all hover:bg-[#115E59] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {expressSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando requerimiento express…</span>
                </>
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4" />
                  <span>Solicitar turno express</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
