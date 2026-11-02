import React from 'react';
import { cn } from '@/shared/utils/index';

interface LoadingStateProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Nexo Salud Dental Loader
 * Diente odontológico de alta definición con volumen anatómico 3D, sombra interior y surcos de esmalte,
 * montado sobre un círculo plano en color Teal del Sidebar activo.
 * Totalmente centrado vertical y horizontalmente.
 */
export function DentalToothIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const circleSize = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-20 h-20' : 'w-16 h-16';
  const svgSize = size === 'sm' ? 26 : size === 'lg' ? 44 : 34;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* 1. Círculo sólido plano sin borde ni sombra en el tono Teal del Sidebar */}
      <div className={cn(
        "rounded-full bg-teal-600 dark:bg-teal-500 flex items-center justify-center shrink-0",
        circleSize
      )}>
        {/* 2. Diente Anatómico 3D con Sombra Interior y Relieve de Esmalte */}
        <div className="relative flex items-center justify-center">
          <svg
            width={svgSize}
            height={svgSize}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10"
          >
            <defs>
              {/* Degradado de Cuerpo: Blanco puro superior con suave sombreado interior en raíces */}
              <linearGradient id="toothBodyGrad" x1="24" y1="6" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#f8fafc" />
                <stop offset="85%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>

              {/* Degradado de Sombra Interior Oclusal y Radicular */}
              <linearGradient id="toothInnerShadow" x1="24" y1="14" x2="24" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.08" />
                <stop offset="70%" stopColor="#334155" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.32" />
              </linearGradient>

              {/* Reflejo Especular Superior */}
              <linearGradient id="toothGleamHighlight" x1="16" y1="8" x2="28" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Sombra de Contorno Anatómica */}
            <path
              d="M24 7 C16.5 7 9.5 10.5 9.5 18 C9.5 24.5 13 31.5 16.5 40.5 C17.8 43.8 20.8 43.8 21.8 39 C22.8 33.5 23.5 28.5 24 25 C24.5 28.5 25.2 33.5 26.2 39 C27.2 43.8 30.2 43.8 31.5 40.5 C35 31.5 38.5 24.5 38.5 18 C38.5 10.5 31.5 7 24 7 Z"
              fill="url(#toothBodyGrad)"
              stroke="#e2e8f0"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />

            {/* Capa de Sombra Interior y Profundidad de Raíces */}
            <path
              d="M24 25 C23.5 28.5 22.8 33.5 21.8 39 C20.8 43.8 17.8 43.8 16.5 40.5 C13 31.5 9.5 24.5 9.5 18 C9.5 14 12 11 15 9.5 C13 13 12 18 14 26 C15.5 32 17.5 38 18.5 40 C19.5 41 20.5 39 21 36 C22 30 23 26 24 25 Z"
              fill="url(#toothInnerShadow)"
            />

            {/* Sombra de Bifurcación Interradicular (Furcación Central) */}
            <path
              d="M24 25 C23.8 29.5 23 34.5 21.8 39 C22.8 37 23.8 33 24 28 C24.2 33 25.2 37 26.2 39 C25 34.5 24.2 29.5 24 25 Z"
              fill="#64748b"
              fillOpacity="0.3"
            />

            {/* Surcos Anatómicos Oclusales (Fisuras y Cúspides Dentales) */}
            <path
              d="M18 16.5 C21 19 23 19 24 17.5 C25 19 27 19 30 16.5"
              stroke="#94a3b8"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.6"
            />
            <path
              d="M24 17.5 L24 23.5"
              stroke="#94a3b8"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeOpacity="0.5"
            />

            {/* Reflejo Especular del Esmalte en la Corona (Cúspide Vestibular) */}
            <path
              d="M14 13 C14 13 17 9 24 9 C27 9 30 10.5 30 10.5 C26.5 11.5 21 13 17 18 C15.5 20.5 14.5 24 14.5 24 C14.5 24 13.5 19 14 13 Z"
              fill="url(#toothGleamHighlight)"
            />
          </svg>

          {/* 3. Destello Sutil en la Cúspide */}
          <div className="absolute -top-1 -right-0.5 z-20 text-white animate-dental-gleam pointer-events-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn(
      "w-full flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 my-auto text-center select-none animate-in fade-in duration-300",
      className
    )}>
      {/* Diente Blanco con Sombra Interior en Círculo Teal */}
      <DentalToothIcon size={size} />

      {/* 3 Puntos Animados con Salto Dinámico Arriba-Abajo */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        <span 
          className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-dental-dot-jump" 
          style={{ animationDelay: '0ms' }} 
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-dental-dot-jump" 
          style={{ animationDelay: '180ms' }} 
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-dental-dot-jump" 
          style={{ animationDelay: '360ms' }} 
        />
      </div>
    </div>
  );
}
