/** Estilos de botón del módulo de reportes (alineados con el sistema slate + teal-700). */
export const btnBase =
  'inline-flex h-9 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 focus-visible:ring-offset-1 active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

export const btnSecondary = `${btnBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`;

export const btnPrimary = `${btnBase} bg-teal-700 text-white shadow-sm hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500`;

export const btnGhost = `${btnBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800`;
