import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  UserCheck,
  CalendarCheck2,
  Stethoscope,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Zap,
  MapPin,
  HeartPulse,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface StageData {
  id: 'consulta' | 'propuesta' | 'reserva' | 'atencion';
  stepNumber: string;
  name: string;
  tagline: string;
  badge: string;
  objective: string;
  whatHappens: {
    title: string;
    items: string[];
  };
  whyItMatters: string;
  guaranteeText: string;
  icon: React.ElementType;
  previewData: {
    statusBadge: string;
    title: string;
    subtitle: string;
    attributes: { label: string; value: string; highlight?: boolean }[];
  };
}

const STAGES: StageData[] = [
  {
    id: 'consulta',
    stepNumber: '01',
    name: 'Consulta Inicial Rápida',
    tagline: 'Cero formularios engorrosos ni preguntas invasivas',
    badge: 'Privacidad Protegida',
    objective: 'Solo necesitamos tu WhatsApp y sede de conveniencia para responderte. Respetamos tu privacidad y no te pedimos cuestionarios largos ni antecedentes clínicos en el primer contacto.',
    whatHappens: {
      title: 'Lo que sucede en este paso',
      items: [
        'Ingresas tu nombre y WhatsApp en menos de 30 segundos',
        'Eliges la sede más cercana (California, El Golf o Centro)',
        'Respuesta directa de nuestro equipo en menos de 15 minutos',
        'Tus datos están protegidos bajo la Ley de Protección de Datos Personales',
      ],
    },
    whyItMatters: 'Creemos que acceder a buena salud dental no debe implicar trámites pesados ni llamadas invasivas.',
    guaranteeText: 'Compromiso NexoSalud: Cero spam y contacto exclusivo para la atención solicitada.',
    icon: ShieldCheck,
    previewData: {
      statusBadge: 'CONSULTA RECIBIDA',
      title: 'Solicitud de Turno',
      subtitle: 'Portal de Admisión NexoSalud Dental',
      attributes: [
        { label: 'Tiempo de respuesta', value: '< 15 minutos', highlight: true },
        { label: 'Canal de atención', value: 'WhatsApp Directo' },
        { label: 'Trámite previo', value: '0 formularios clínicos' },
        { label: 'Privacidad', value: 'Cifrado y protegido' },
      ],
    },
  },
  {
    id: 'propuesta',
    stepNumber: '02',
    name: 'Propuesta Personalizada',
    tagline: 'Coordinamos tus horarios, convenios y especialista',
    badge: 'A tu Medida',
    objective: 'Un asesor de admisión se comunica contigo para conocer tus horarios ideales, si estudias o trabajas para aplicarte convenios de tarifa, y qué especialista se adapta mejor a tu caso.',
    whatHappens: {
      title: 'Lo que coordinamos juntos',
      items: [
        'Revisión de turnos disponibles en tu sede preferida',
        'Validación de convenios (estudiantes de UPAO, UNT, UPN y trabajadores)',
        'Orientación clara sobre el tratamiento, duración y costos estimados',
        'Presentación de 2 a 3 alternativas de horario para que elijas la más cómoda',
      ],
    },
    whyItMatters: 'Adaptamos la clínica a tu agenda diaria, no al revés. Si trabajas o estudias, encontramos la franja perfecta.',
    guaranteeText: 'Compromiso NexoSalud: Presupuestos claros y transparentes antes de iniciar.',
    icon: UserCheck,
    previewData: {
      statusBadge: 'PROPUESTA EN CURSO',
      title: 'Opciones de Cita Disponibles',
      subtitle: 'Sede y horario adaptados a tu ritmo',
      attributes: [
        { label: 'Convenio identificado', value: 'Tarifa Preferencial', highlight: true },
        { label: 'Horario sugerido', value: 'Vespertino / Sábado' },
        { label: 'Especialista asignado', value: 'Odontólogo Colegiado' },
        { label: 'Alternativas', value: '2 opciones de turno' },
      ],
    },
  },
  {
    id: 'reserva',
    stepNumber: '03',
    name: 'Reserva Garantizada',
    tagline: 'Bloqueo exclusivo de tu turno y sillón dental',
    badge: 'Sin Esperas',
    objective: 'Una vez que eliges tu horario favorito, se bloquea el sillón y equipo para ti. Puedes asegurar tu turno por Yape, transferencia o directamente en la clínica con constancia oficial.',
    whatHappens: {
      title: 'Beneficios de tu confirmación',
      items: [
        'Turno médico 100% reservado sin riesgo de sobreventa de agenda',
        'Facilidades de confirmación con Yape, tarjeta o pago en recepción',
        'Emisión instantánea de tu constancia oficial de cita en PDF',
        'Políticas de reprogramación amigables sin penalidad si surge un imprevisto',
      ],
    },
    whyItMatters: 'Respetamos tu tiempo. Un turno reservado garantiza que tu doctor y box clínico te esperen puntualmente.',
    guaranteeText: 'Compromiso NexoSalud: Tiempo de espera en sala garantizado menor a 10 minutos.',
    icon: CalendarCheck2,
    previewData: {
      statusBadge: 'TURNO RESERVADO',
      title: 'Constancia de Cita Emitida',
      subtitle: 'Sillón y especialista asignados',
      attributes: [
        { label: 'Sillón dental', value: 'Box Clínico Reservado', highlight: true },
        { label: 'Comprobante', value: 'Constancia Oficial en PDF' },
        { label: 'Tolerancia', value: 'Reprogramación flexible' },
        { label: 'Recordatorio', value: 'Vía WhatsApp 24h antes' },
      ],
    },
  },
  {
    id: 'atencion',
    stepNumber: '04',
    name: 'Tu Consulta en Sillón',
    tagline: 'Diagnóstico 3D en pantalla y trato humano sin dolor',
    badge: 'Atención Clínica',
    objective: 'Llegas a la clínica y pasas directo al consultorio. Realizamos tu escaneo digital intraoral 3D para que veas tus dientes en pantalla grande y entiendas cada paso de tu salud bucal.',
    whatHappens: {
      title: 'Tu experiencia en el consultorio',
      items: [
        'Recepción puntual y bienvenida personalizada en sala',
        'Escaneo óptico 3D sin pastas incómodas ni náuseas',
        'Explicación visual del diagnóstico con el doctor en pantalla',
        'Apertura de tu historia clínica unificada válida en todas nuestras sedes',
      ],
    },
    whyItMatters: 'Queremos que sientas tranquilidad y control total sobre tu salud, con profesionales que te escuchan y explican.',
    guaranteeText: 'Compromiso NexoSalud: Anestesia atraumática y protocolos sin dolor.',
    icon: Stethoscope,
    previewData: {
      statusBadge: 'EN ATENCIÓN',
      title: 'Evaluación Clínica Presencial',
      subtitle: 'Sede Trujillo · Tecnología Digital 3D',
      attributes: [
        { label: 'Diagnóstico', value: 'Visual en Pantalla 4K', highlight: true },
        { label: 'Historia clínica', value: 'Unificada en 3 Sedes' },
        { label: 'Plan odontológico', value: 'Entregado al paciente' },
        { label: 'Seguimiento', value: 'Control preventivo' },
      ],
    },
  },
];

interface InteractiveJourneyFlowSectionProps {
  onSelectStageAction?: () => void;
}

export function InteractiveJourneyFlowSection({ onSelectStageAction }: InteractiveJourneyFlowSectionProps) {
  const [activeStageId, setActiveStageId] = useState<StageData['id']>('consulta');

  const currentStage = STAGES.find((s) => s.id === activeStageId) || STAGES[0];
  const Icon = currentStage.icon;

  return (
    <section id="tu-experiencia" className="scroll-mt-16 relative overflow-hidden bg-white border-y border-slate-200/80 py-16 sm:py-24">
      {/* Luz ambiental sutil */}
      <div
        className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-teal-50/50 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-emerald-50/40 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado Principal Orientado al Paciente */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-700/15 bg-teal-50/80 px-3.5 py-1 text-xs font-medium text-teal-800">
            <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
            <span>Atención Transparente y Sin Sorpresas</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">
            Cómo cuidamos tu experiencia en cada paso
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Sabemos que visitar al dentista puede generar dudas. Por eso te explicamos con total
            claridad cómo coordinamos tu cita: sin formularios pesados, con horarios que se respetan y
            presupuestos claros antes de comenzar.
          </p>
        </div>

        {/* Selector Interactivo de Pasos */}
        <div className="mt-10 max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/80 backdrop-blur-xs">
            {STAGES.map((stage) => {
              const isSelected = stage.id === activeStageId;
              const StageIcon = stage.icon;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={`relative flex flex-col items-start gap-1 p-3 sm:p-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="active-stage-indicator"
                      className="absolute inset-0 rounded-xl bg-white border border-slate-200/90 shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                      transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between w-full">
                    <span className="font-mono text-[10px] font-bold text-teal-700 tracking-wider">
                      PASO {stage.stepNumber}
                    </span>
                    <StageIcon className={`h-4 w-4 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                  </div>
                  <span className="relative z-10 text-xs sm:text-sm font-semibold truncate w-full">
                    {stage.name}
                  </span>
                  <span className="relative z-10 text-[10.5px] text-slate-500 truncate w-full hidden sm:block">
                    {stage.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Detallado de la Etapa Seleccionada */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          >
            {/* Columna Izquierda: Beneficios para el Paciente */}
            <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.05)]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 border border-teal-200/70">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono text-[11px] font-bold text-teal-700 uppercase tracking-widest">
                        Paso {currentStage.stepNumber} de 04
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                        {currentStage.name}
                      </h3>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-600/20 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                    {currentStage.badge}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {currentStage.objective}
                </p>

                {/* Lo que sucede en el paso */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    {currentStage.whatHappens.title}
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {currentStage.whatHappens.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11.5px] text-slate-600 leading-snug">
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-teal-600 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Por qué es importante */}
                <div className="rounded-xl border border-teal-100/80 bg-teal-50/40 p-3.5 flex items-start gap-3 text-xs text-teal-900">
                  <Zap className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Nuestra filosofía:</span>
                    <p className="mt-0.5 text-[11.5px] text-teal-800 leading-relaxed">
                      {currentStage.whyItMatters}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pie de la columna con CTA amigable */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
                <span className="font-medium text-slate-600">{currentStage.guaranteeText}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    if (onSelectStageAction) {
                      onSelectStageAction();
                    } else {
                      const el = document.getElementById('agendar-cita');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="h-8 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <span>Solicitar mi Turno Ahora</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta de Vista Previa Limpia */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-7 text-white shadow-xl">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono tracking-widest uppercase text-slate-300">
                      Coordinación Clínica NexoSalud
                    </span>
                  </div>
                  <span className="rounded-full bg-teal-500/20 border border-teal-400/30 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-teal-300">
                    {currentStage.previewData.statusBadge}
                  </span>
                </div>

                <div className="mt-5 space-y-1">
                  <h4 className="text-base font-semibold text-white tracking-tight">
                    {currentStage.previewData.title}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {currentStage.previewData.subtitle}
                  </p>
                </div>

                {/* Atributos Clave */}
                <div className="mt-6 space-y-2.5">
                  {currentStage.previewData.attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-800/40 text-xs"
                    >
                      <span className="text-slate-400">{attr.label}</span>
                      <span
                        className={`font-mono text-right ${
                          attr.highlight
                            ? 'text-teal-300 font-semibold'
                            : 'text-slate-200 font-medium'
                        }`}
                      >
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Respaldo Institucional en la Tarjeta */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-emerald-400" />
                  Atención Odontológica Ética
                </span>
                <span className="text-teal-400 font-semibold">Sedes Trujillo</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
