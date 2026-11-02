import { motion } from 'motion/react';
import { ArrowUpRight, Check, Clock, Cpu, ScanLine, Sparkles, Waves } from 'lucide-react';
import {
  CLINICAL_TREATMENTS,
  TECH_SPECIALTIES,
  type ReasonChipOption,
} from './landingData';

interface SpecialtiesTechSectionProps {
  onSelectTreatmentAndBook: (reasonId: ReasonChipOption['id'], label?: string) => void;
}

const TECH_ICONS: Record<string, typeof ScanLine> = {
  'scanner-3d': ScanLine,
  'panoramica-cbct': Cpu,
  'ortodoncia-invisible': Sparkles,
};

const STAGGER_GRID = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.04 },
  },
};

const CARD_REVEAL = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function SpecialtiesTechSection({
  onSelectTreatmentAndBook,
}: SpecialtiesTechSectionProps) {
  return (
    <div className="space-y-20 py-16 sm:py-20">
      {/* Sección de Especialidades Clínicas */}
      <section id="tratamientos" className="scroll-mt-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
              Especialidades Odontológicas
            </span>
            <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Atención clínica integral por especialistas certificados
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Cada caso es evaluado por un odontólogo especialista con Registro Nacional (RNE), nunca por
              vendedores comisionistas.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Selecciona una especialidad para pre-cargarla en tu solicitud
          </p>
        </motion.div>

        <motion.div
          variants={STAGGER_GRID}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {CLINICAL_TREATMENTS.map((treatment) => (
            <motion.button
              key={treatment.id}
              type="button"
              variants={CARD_REVEAL}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectTreatmentAndBook(treatment.reasonId, treatment.title)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition-colors duration-200 hover:border-[#0F766E]/40 hover:shadow-md cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 group-hover:bg-[#ECFDF5] group-hover:text-[#065F46] transition-colors">
                    <Clock className="h-3 w-3" aria-hidden />
                    {treatment.duration}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#0F766E]" />
                </div>

                <h3 className="mt-3.5 text-sm font-semibold text-slate-900 group-hover:text-[#0F766E] transition-colors">
                  {treatment.title}
                </h3>

                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {treatment.summary}
                </p>
              </div>

              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E]">
                <span>Solicitar evaluación</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* Sección de Tecnología 3D e Innovación Clínica */}
      <section id="tecnologia" className="scroll-mt-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
            <Waves className="h-3 w-3 text-[#0F766E]" aria-hidden />
            Odontología Digital 3D
          </span>
          <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Diagnósticos precisos en minutos, sin moldes incómodos
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Invertimos en equipamiento de imagenología y escaneo óptico de última generación para reducir el
            número de citas y garantizar resultados predecibles.
          </p>
        </motion.div>

        <motion.div
          variants={STAGGER_GRID}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {TECH_SPECIALTIES.map((tech) => {
            const Icon = TECH_ICONS[tech.id] || ScanLine;
            return (
              <motion.div
                key={tech.id}
                variants={CARD_REVEAL}
                whileHover={{ y: -5 }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-colors duration-300 hover:border-[#0F766E]/40 hover:shadow-[0_20px_40px_-20px_rgba(15,118,110,0.12)]"
              >
                {/* Ilustración técnica vectorial interactiva en la parte superior */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                      {tech.tag}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-slate-400">
                      {tech.metrics}
                    </span>
                  </div>

                  {/* Visor esquemático con microinteracción hover */}
                  <div className="mt-4 flex h-28 items-center justify-between rounded-xl border border-slate-200/70 bg-gradient-to-br from-[#F8FAFC] to-[#ECFDF5]/40 px-5 transition-colors group-hover:border-[#0F766E]/25">
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F766E] font-semibold">
                        Protocolo Digital NexoSalud
                      </p>
                      <p className="text-xs font-medium text-slate-700 max-w-[190px]">
                        {tech.subtitle}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F766E] shadow-xs ring-1 ring-slate-200/80 transition-transform duration-300 group-hover:scale-110 group-hover:bg-[#0F766E] group-hover:text-white">
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                  </div>

                  <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-900">
                    {tech.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {tech.description}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {tech.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#0F766E]">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectTreatmentAndBook(tech.reasonId, tech.title)}
                    className="inline-flex w-full items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-800 transition-all group-hover:border-[#0F766E]/30 group-hover:bg-[#ECFDF5]/60 group-hover:text-[#065F46] cursor-pointer"
                  >
                    <span>Agendar evaluación con {tech.title.split(' ')[0]}</span>
                    <ArrowUpRight className="h-4 w-4 text-[#0F766E]" aria-hidden />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    </div>
  );
}
