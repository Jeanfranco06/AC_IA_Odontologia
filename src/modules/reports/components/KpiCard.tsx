import { useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ExecutiveReportData } from '@/shared/services/report.service';
import { cn } from '@/shared/utils/index';
import type { MeasureOption, StageConfig } from '../config/stages';
import { columnLabel, computeDelta, formatPercent, formatWithUnit } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';

interface KpiCardProps {
  stage: StageConfig;
  measure: MeasureOption;
  report?: ExecutiveReportData;
  active: boolean;
  onSelect: () => void;
}

// Tonos de la barra de composición: escala monocromática teal (un solo acento).
const SHARE_TONES = ['bg-teal-700', 'bg-teal-500', 'bg-teal-300', 'bg-slate-300', 'bg-slate-200'];

export function KpiCard({ stage, measure, report, active, onSelect }: KpiCardProps) {
  const Icon = stage.icon;
  const fmt = useCallback((n: number) => formatWithUnit(n, measure.unit), [measure.unit]);
  const delta = report ? computeDelta(report) : null;

  const shares =
    report && measure.aggregation === 'sum' && (report.grandTotal ?? 0) > 0
      ? report.columns
          .map((c) => ({ col: c, value: report.grandTotals[c] ?? 0 }))
          .filter((s) => s.value > 0)
          .map((s) => ({ ...s, pct: (s.value / report.grandTotal!) * 100 }))
      : [];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group relative flex w-full flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 min-w-0 overflow-hidden',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 active:scale-[0.99]',
        'dark:bg-slate-900',
        active
          ? 'border-teal-700/40 ring-1 ring-teal-700/15 dark:border-teal-500/40'
          : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      )}
    >
      {active && (
        <motion.span
          layoutId="kpi-active-indicator"
          className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-teal-700 dark:bg-teal-400"
          transition={{ type: 'spring', stiffness: 400, damping: 36 }}
          aria-hidden
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{stage.index}</span>
          {stage.label}
        </span>
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            active
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
              : 'bg-slate-50 text-slate-400 group-hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500'
          )}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>

      <p className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400" title={measure.label}>
        {measure.label}
      </p>

      <div className="mt-1 flex items-baseline gap-2 min-w-0">
        {report && report.grandTotal === null ? (
          <span className="text-2xl font-semibold">—</span>
        ) : report ? (
          <AnimatedNumber
            value={report.grandTotal ?? 0}
            format={fmt}
            className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white truncate"
          />
        ) : (
          <span className="ns-skeleton h-8 w-28" />
        )}
      </div>

      <div className="mt-2 flex min-h-[20px] items-center gap-1.5 text-xs min-w-0 overflow-hidden">
        <DeltaBadge delta={delta} polarity={measure.polarity} />
      </div>

      {shares.length > 1 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
            {shares.map((s, i) => (
              <motion.span
                key={s.col}
                className={cn('h-full origin-left', SHARE_TONES[i % SHARE_TONES.length])}
                style={{ width: `${s.pct}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {shares.slice(0, 3).map((s, i) => (
              <li key={s.col} className="flex min-w-0 items-center gap-1">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', SHARE_TONES[i % SHARE_TONES.length])} aria-hidden />
                <span className="truncate">{columnLabel(s.col)}</span>
                <span className="font-mono tabular-nums text-slate-400">{formatPercent(s.pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </button>
  );
}

function DeltaBadge({
  delta,
  polarity,
}: {
  delta: ReturnType<typeof computeDelta>;
  polarity: MeasureOption['polarity'];
}) {
  if (!delta) {
    return (
      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate" title="Sin período de comparación">
        Sin período de comparación
      </span>
    );
  }

  if (delta.pct === null) {
    return (
      <div className="flex items-center gap-1 min-w-0 overflow-hidden text-[11px]">
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Nuevo
        </span>
        <span className="truncate text-slate-400" title={`sin datos en ${delta.label}`}>
          sin datos en {delta.label}
        </span>
      </div>
    );
  }

  const favorable =
    delta.direction === 'flat' || polarity === 'neutral'
      ? null
      : (delta.direction === 'up') === (polarity === 'up');

  const Icon = delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus;
  const sign = delta.pct > 0 ? '+' : '';

  return (
    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-xs">
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 font-medium tabular-nums text-[11px]',
          favorable === true && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
          favorable === false && 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
          favorable === null && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        )}
      >
        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {sign}
        {delta.pct.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
      </span>
      <span className="truncate text-[11px] text-slate-400 dark:text-slate-500" title={`vs ${delta.label}`}>
        vs {delta.label}
      </span>
    </div>
  );
}
