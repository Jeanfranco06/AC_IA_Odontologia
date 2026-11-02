import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, type LucideIcon } from 'lucide-react';

interface HeroBenefitCardProps {
  icon: LucideIcon;
  title: string;
}

export function HeroBenefitCard({ icon: Icon, title }: HeroBenefitCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={
        shouldReduceMotion
          ? {}
          : {
              y: -4,
              transition: { type: 'spring', damping: 18, stiffness: 240 },
            }
      }
      className="group relative flex items-center justify-between gap-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all duration-300 hover:border-teal-600/40 hover:shadow-md hover:shadow-teal-700/5 cursor-default"
    >
      {/* Efecto Border Beam sutil al interactuar con el cursor */}
      {!shouldReduceMotion && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute -inset-[1px] rounded-xl overflow-hidden"
          aria-hidden
        >
          <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,transparent_300deg,#0F766E_340deg,#2DD4BF_360deg)] opacity-70" />
          {/* Fondo interior para que solo el borde de 1px reciba el haz */}
          <div className="absolute inset-[1px] rounded-[11px] bg-white" />
        </motion.div>
      )}

      {/* Contenido de la tarjeta (elevado sobre el border beam) */}
      <div className="relative z-10 flex items-center gap-2.5 min-w-0">
        <motion.span
          animate={
            isHovered && !shouldReduceMotion
              ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }
              : {}
          }
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E] transition-colors group-hover:bg-teal-100/90"
        >
          <Icon className="h-3.5 w-3.5" />
        </motion.span>
        <span className="text-xs font-semibold text-slate-800 tracking-tight leading-snug truncate">
          {title}
        </span>
      </div>

      {/* Micro-indicador de verificación animado */}
      <div className="relative z-10 shrink-0">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
            isHovered
              ? 'bg-[#0F766E] text-white shadow-2xs scale-100'
              : 'bg-slate-100 text-slate-300 scale-90'
          }`}
        >
          <Check className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      </div>
    </motion.div>
  );
}
