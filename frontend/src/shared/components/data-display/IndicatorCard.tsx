import type { IndicatorResult } from '@/domain/indicators';
import { HelpCircle, Calendar } from 'lucide-react';

export function IndicatorCard({ indicator, period }: { indicator: IndicatorResult; period: string }) {
  let statusBadge = {
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    border: 'border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500',
    label: 'Óptimo',
  };

  if (indicator.status === 'amber') {
    statusBadge = {
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      border: 'border-amber-200/80 dark:border-amber-800/80',
      dot: 'bg-amber-500',
      label: 'En Alerta',
    };
  } else if (indicator.status === 'red') {
    statusBadge = {
      color: 'text-rose-700 dark:text-rose-300',
      bg: 'bg-rose-50 dark:bg-rose-950/60',
      border: 'border-rose-200/80 dark:border-rose-800/80',
      dot: 'bg-rose-500',
      label: 'Crítico',
    };
  } else if (indicator.status === 'none') {
    statusBadge = {
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-800',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
      label: 'Sin Evaluar',
    };
  }

  let displayValue = '';
  if (indicator.displayValueOverride) {
    displayValue = indicator.displayValueOverride;
  } else if (indicator.value === null || indicator.value === undefined) {
    displayValue = 'N/D';
  } else if (indicator.format === 'percentage') {
    displayValue = indicator.value.toFixed(1) + '%';
  } else if (indicator.format === 'number') {
    displayValue = indicator.value.toFixed(1) + ' ' + (indicator.unit || '');
  } else if (indicator.format === 'currency') {
    displayValue = 'S/ ' + indicator.value.toFixed(2);
  } else if (indicator.format === 'time') {
    displayValue = indicator.value.toFixed(0) + ' ' + (indicator.unit || 'días');
  }

  const tooltipText = [
    `【${indicator.id}】 ${indicator.name}`,
    indicator.description ? `Descripción: ${indicator.description}` : '',
    `Fórmula: ${indicator.formula}`,
    indicator.dataUsed ? `Datos utilizados: ${indicator.dataUsed}` : '',
    indicator.dbTables ? `Tablas BD: ${indicator.dbTables}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <div className="relative group bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 hover:border-teal-500/40 dark:hover:border-teal-500/50 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden min-w-0">
      {/* Top Bar: ID + Name + Status + Tooltip */}
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="shrink-0 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-800 text-teal-300 shadow-sm">
              {indicator.id}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.color} ${statusBadge.border} shrink-0`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot} ${
                  indicator.status !== 'none' ? 'animate-pulse' : ''
                }`}
              />
              <span className="truncate max-w-[85px] sm:max-w-none">{statusBadge.label}</span>
            </span>
          </div>
          <div
            title={tooltipText}
            className="cursor-help text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-0.5 shrink-0"
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
          </div>
        </div>

        <p
          className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug line-clamp-2 break-words"
          title={indicator.name}
        >
          {indicator.name}
        </p>
        {indicator.description && (
          <p
            className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5 font-normal break-words"
            title={indicator.description}
          >
            {indicator.description}
          </p>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-2 flex flex-col gap-1 min-w-0">
        <h3
          className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white truncate"
          title={displayValue}
        >
          {displayValue}
        </h3>

        {/* Base Measures Detail */}
        {indicator.baseMeasures?.detailText && (
          <p
            className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 break-words line-clamp-2 leading-snug"
            title={indicator.baseMeasures.detailText}
          >
            {indicator.baseMeasures.detailText}
          </p>
        )}
      </div>

      {/* Bottom Sub-info */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="truncate" title={period}>
            {period}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 font-medium transition-colors shrink-0">
          BI Metrix
        </span>
      </div>
    </div>
  );
}
