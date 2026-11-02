import { Calendar, Download, RefreshCw } from 'lucide-react';
import type { MartStatus, ReportPeriodOption } from '@/shared/services/report.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { cn } from '@/shared/utils/index';
import type { ExportSection } from '../lib/export';
import type { DisplayMode } from '../lib/matrix';
import { btnPrimary, btnSecondary } from './buttonStyles';
import { ExportMenu } from './ExportMenu';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface ReportsPageHeaderProps {
  period: string;
  periods: ReportPeriodOption[];
  onPeriodChange: (period: string) => void;
  lastSyncedAt: number | null;
  isFetching: boolean;
  hasError: boolean;
  status?: MartStatus;
  onRefresh: () => void;
  getExportSections: () => ExportSection[];
  exportScopeLabel: string;
  displayMode: DisplayMode;
}

export function ReportsPageHeader({
  period,
  periods,
  onPeriodChange,
  lastSyncedAt,
  isFetching,
  hasError,
  status,
  onRefresh,
  getExportSections,
  exportScopeLabel,
  displayMode,
}: ReportsPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Analítica clínica y comercial
          </span>
          <span className="hidden h-3 w-px bg-slate-200 dark:bg-slate-800 sm:inline-block" aria-hidden />
          <SyncStatusIndicator
            lastSyncedAt={lastSyncedAt}
            isFetching={isFetching}
            hasError={hasError}
            status={status}
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
          Reportes Matriciales del Embudo
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Análisis dimensional del recorrido del paciente desde la captación hasta la prestación clínica, desglosado por
          canal, sede, operador y servicio.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger
            aria-label="Seleccionar período"
            className="h-9 w-[195px] rounded-lg border-slate-200 bg-white text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-teal-600/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <div className="flex min-w-0 items-center gap-2 [&>span]:truncate">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <SelectValue placeholder="Período" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className={btnSecondary}
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', isFetching && 'animate-spin')} aria-hidden />
          <span>Actualizar datos</span>
        </button>

        <ExportMenu
          getSections={getExportSections}
          mode={displayMode}
          label="Exportar"
          scopeLabel={exportScopeLabel}
          triggerClassName={btnPrimary}
          icon={<Download className="h-3.5 w-3.5" aria-hidden />}
          disabled={getExportSections().length === 0}
        />
      </div>
    </header>
  );
}
