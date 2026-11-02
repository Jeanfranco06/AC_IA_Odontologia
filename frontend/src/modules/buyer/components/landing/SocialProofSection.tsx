import React from 'react';
import { motion } from 'motion/react';
import { Award, ShieldCheck, MapPin, Clock3, FileCheck, Stethoscope } from 'lucide-react';

const STAGGER_GRID = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const ITEM_REVEAL = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export const SocialProofSection: React.FC = () => {
  return (
    <section className="border-y border-slate-200/80 bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
            Garantías y Transparencia
          </span>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Atención odontológica basada en evidencia y trato humano
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            Nuestros compromisos no son promesas comerciales; son protocolos clínicos verificables en cada consulta.
          </p>
        </div>

        <motion.div
          variants={STAGGER_GRID}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Pilar 1: Especialistas RNE */}
          <motion.div
            variants={ITEM_REVEAL}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Especialistas RNE Colegiados
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Todo tratamiento es planificado por odontólogos con Registro Nacional de Especialista (RNE) vigente ante el Colegio Odontológico del Perú.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-medium text-sky-700">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Verificación de colegiatura pública</span>
            </div>
          </motion.div>

          {/* Pilar 2: 3 Sedes en Trujillo */}
          <motion.div
            variants={ITEM_REVEAL}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                3 Sedes Físicas en Trujillo
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ubicaciones céntricas con infraestructura accesible y estacionamiento en Víctor Larco (California, Primavera) y Centro Histórico.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>IPRESS registrada ante SUSALUD</span>
            </div>
          </motion.div>

          {/* Pilar 3: Tiempos de respuesta */}
          <motion.div
            variants={ITEM_REVEAL}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Respuesta Inicial &lt; 15 min
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Compromiso de primera atención orientativa en horario hábil. Asignamos un asesor humano que comprende tu caso antes de citarte.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <Award className="h-3.5 w-3.5" />
              <span>Monitoreo de SLA en tiempo real</span>
            </div>
          </motion.div>

          {/* Pilar 4: Privacidad y consentimiento */}
          <motion.div
            variants={ITEM_REVEAL}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Privacidad Ley N° 29733
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tus datos de contacto e historial se resguardan bajo estricto secreto profesional y nunca se comparten con terceros ni para spam.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Consentimiento explícito no premarcado</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
