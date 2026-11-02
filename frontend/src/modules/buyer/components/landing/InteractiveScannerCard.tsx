import React, { useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from 'motion/react';
import {
  ScanLine,
  Sparkles,
  Layers,
  ShieldCheck,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export function InteractiveScannerCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Modo interactivo: 'scan' (malla óptica 3D) o 'clinic' (alta resolución clínica)
  const [activeMode, setActiveMode] = useState<'scan' | 'clinic'>('scan');
  const [isHovered, setIsHovered] = useState(false);

  // Motion values para tilt 3D (normalizados de -0.5 a 0.5)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Posición del haz láser en porcentaje (0 a 100)
  const laserPos = useMotionValue(45);

  // Configuración de resorte elástico premium
  const springConfig = { damping: 20, stiffness: 180, mass: 0.1 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Rotaciones 3D proporcionales
  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);

  // Posición del reflejo especular en el cristal
  const glareX = useTransform(smoothMouseX, [-0.5, 0.5], [20, 80]);
  const glareY = useTransform(smoothMouseY, [-0.5, 0.5], [20, 80]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const relativeX = (e.clientX - rect.left) / rect.width - 0.5;
      const relativeY = (e.clientY - rect.top) / rect.height - 0.5;

      mouseX.set(relativeX);
      mouseY.set(relativeY);

      // El láser se acopla suavemente a la posición X del cursor
      const percentX = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      laserPos.set(percentX);
    },
    [shouldReduceMotion, mouseX, mouseY, laserPos]
  );

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      style={{ perspective: '1100px' }}
      className="relative w-full max-w-xl select-none"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: shouldReduceMotion ? 0 : rotateX,
          rotateY: shouldReduceMotion ? 0 : rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 shadow-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-teal-950/20"
      >
        {/* Imagen de fondo / Instalaciones con escáner */}
        <div className="relative h-56 sm:h-64 w-full overflow-hidden">
          <img
            src="/Fondo_NexoSalud_2.jpg"
            alt="Tecnología de escaneo digital intraoral 3D NexoSalud Trujillo"
            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            loading="eager"
          />

          {/* Gradiente cinemático de contraste */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"
            aria-hidden
          />

          {/* Malla digital 3D / Overlay holográfico interactivo en modo 'scan' */}
          <AnimatePresence>
            {activeMode === 'scan' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(#2DD4BF_1px,transparent_1px)] [background-size:16px_16px] opacity-25 mix-blend-screen"
                aria-hidden
              />
            )}
          </AnimatePresence>

          {/* Haz láser del escáner óptico 3D */}
          {!shouldReduceMotion && activeMode === 'scan' && (
            <motion.div
              style={{
                left: isHovered ? `${laserPos.get()}%` : undefined,
              }}
              animate={
                !isHovered
                  ? {
                      left: ['10%', '90%', '10%'],
                    }
                  : undefined
              }
              transition={{
                repeat: Infinity,
                duration: 3.2,
                ease: 'easeInOut',
              }}
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] -translate-x-1/2 bg-gradient-to-b from-teal-400 via-emerald-300 to-teal-400 shadow-[0_0_12px_3px_rgba(45,212,191,0.65)]"
              aria-hidden
            >
              {/* Foco de emisión superior e inferior */}
              <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-teal-300 shadow-[0_0_8px_#2dd4bf]" />
              <div className="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full bg-teal-300 shadow-[0_0_8px_#2dd4bf]" />
              {/* Etiqueta flotante del sensor óptico */}
              <div className="absolute top-1/2 -left-20 -translate-y-1/2 rounded bg-slate-950/90 px-1.5 py-0.5 font-mono text-[9px] text-teal-300 backdrop-blur-md border border-teal-500/30 shadow-md">
                12µm Precision
              </div>
            </motion.div>
          )}

          {/* Reflejo especular en el cristal (Glare / Sheen) */}
          {!shouldReduceMotion && (
            <motion.div
              style={{
                background: `radial-gradient(circle at ${glareX.get()}% ${glareY.get()}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)`,
              }}
              className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
              aria-hidden
            />
          )}

          {/* Badges superiores de telemetría médica */}
          <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md border border-white/10 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] text-emerald-300">ESCÁNER 3D ACTIVO</span>
            </div>

            {/* Selector de modo interactivo */}
            <div className="flex items-center rounded-lg bg-slate-950/80 p-0.5 backdrop-blur-md border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setActiveMode('scan')}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                  activeMode === 'scan'
                    ? 'bg-teal-700/80 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ScanLine className="h-3 w-3" />
                <span>Malla 3D</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('clinic')}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 transition-all cursor-pointer ${
                  activeMode === 'clinic'
                    ? 'bg-teal-700/80 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>Sonrisa HD</span>
              </button>
            </div>
          </div>

          {/* Dock inferior de vidrio con telemetría en tiempo real */}
          <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between rounded-xl bg-slate-950/85 px-3 py-2 text-white/95 backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <Activity className="h-4 w-4 animate-pulse" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {activeMode === 'scan'
                    ? 'Mapeo digital sin siliconas ni arcadas'
                    : 'Planificación estética milimétrica'}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>FOV: 140°</span>
                  <span>·</span>
                  <span className="text-emerald-400">0 dolor reportado</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/70 px-2 py-1 rounded-md border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              <span>3 sedes RNE</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
