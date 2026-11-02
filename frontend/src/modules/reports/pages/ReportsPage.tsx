import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Layers, RotateCcw } from 'lucide-react';
import type { ReportPeriodOption, ReportStage } from '@/shared/services/report.service';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import {
  KPI_STAGES,
  STAGES,
  STAGE_BY_ID,
  VIEW_OPTIONS,
  getMeasure,
  type ReportView,
} from '../config/stages';
import { useReportsData } from '../hooks/useReportsData';
import type { ExportSection } from '../lib/export';
import type { DisplayMode } from '../lib/matrix';
import { ExecutiveMatrixTable } from '../components/ExecutiveMatrixTable';
import { KpiCard } from '../components/KpiCard';
import { ReportsPageHeader } from '../components/ReportsPageHeader';
import { ReportsSkeleton } from '../components/ReportsSkeleton';
import { SegmentedControl, type SegmentedOption } from '../components/SegmentedControl';
import { btnSecondary } from '../components/buttonStyles';

const DEFAULT_PERIODS: ReportPeriodOption[] = [
  { value: '2026-09', label: 'Septiembre 2026' },
  { value: '2026-10', label: 'Octubre 2026' },
  { value: 'all', label: 'Histórico completo' },
];

const VALID_VIEWS = new Set<ReportView>(['buyer', 'lead', 'payer', 'customer', 'turned', 'all']);

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') as ReportView | null;
  const activeView: ReportView = rawTab && VALID_VIEWS.has(rawTab) ? rawTab : 'buyer';
  const period = searchParams.get('period') || 'all';

  const [measures, setMeasures] = useState<Record<ReportStage, string>>({
    buyer: STAGE_BY_ID.buyer.defaultMeasure,
    lead: STAGE_BY_ID.lead.defaultMeasure,
    payer: STAGE_BY_ID.payer.defaultMeasure,
    customer: STAGE_BY_ID.customer.defaultMeasure,
    turned: STAGE_BY_ID.turned.defaultMeasure,
  });

  const [displayMode, setDisplayMode] = useState<DisplayMode>('absolute');

  const {
    reports,
    status,
    statusError,
    periods: apiPeriods,
    isInitialLoading,
    isFetching,
    fetchingByStage,
    error,
    lastSyncedAt,
    refresh,
  } = useReportsData(measures, period);

  const periodOptions = useMemo(() => {
    if (!apiPeriods || apiPeriods.length === 0) return DEFAULT_PERIODS;
    return apiPeriods;
  }, [apiPeriods]);

  const updateParams = useCallback(
    (next: { tab?: ReportView; period?: string }) => {
      const params = new URLSearchParams(searchParams);
      if (next.tab) params.set('tab', next.tab);
      if (next.period) params.set('period', next.period);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleViewChange = useCallback(
    (view: ReportView) => updateParams({ tab: view }),
    [updateParams]
  );

  const handlePeriodChange = useCallback(
    (nextPeriod: string) => updateParams({ period: nextPeriod }),
    [updateParams]
  );

  const handleMeasureChange = useCallback((stage: ReportStage, value: string) => {
    setMeasures((prev) => ({ ...prev, [stage]: value }));
  }, []);

  const visibleStages = useMemo(
    () => (activeView === 'all' ? STAGES : [STAGE_BY_ID[activeView]]),
    [activeView]
  );

  const getExportSections = useCallback((): ExportSection[] => {
    return visibleStages
      .map((stage) => {
        const rep = reports[stage.id];
        if (!rep) return null;
        return {
          stage,
          measure: getMeasure(stage.id, measures[stage.id]),
          report: rep,
        };
      })
      .filter((s): s is ExportSection => s !== null);
  }, [visibleStages, reports, measures]);

  const exportScopeLabel =
    activeView === 'all'
      ? 'Consolidado del embudo (4 etapas)'
      : `Etapa ${STAGE_BY_ID[activeView].index}: ${STAGE_BY_ID[activeView].label}`;

  const segmentedOptions = useMemo<SegmentedOption<ReportView>[]>(
    () =>
      VIEW_OPTIONS.map((opt) => {
        if (opt.id === 'all') {
          return {
            value: 'all',
            ariaLabel: 'Consolidado (todas las etapas)',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                <span>Consolidado</span>
              </span>
            ),
          };
        }
        const st = STAGE_BY_ID[opt.id];
        const Icon = st.icon;
        return {
          value: st.id,
          ariaLabel: `${st.index} ${st.label}`,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <span className="font-mono text-[11px] text-slate-400">{st.index}</span>
              <span>{st.label}</span>
            </span>
          ),
        };
      }),
    []
  );

  return (
    <TooltipProvider delayDuration={180}>
      <div className="space-y-6 pb-8">
        {/* Cabecera limpia de página con estado de sincronización y acciones primarias */}
        <ReportsPageHeader
          period={period}
          periods={periodOptions}
          onPeriodChange={handlePeriodChange}
          lastSyncedAt={lastSyncedAt}
          isFetching={isFetching}
          hasError={Boolean(error) || statusError}
          status={status}
          onRefresh={refresh}
          getExportSections={getExportSections}
          exportScopeLabel={exportScopeLabel}
          displayMode={displayMode}
        />

        {/* Alerta sobria en caso de fallo de conexión */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
              <span>No fue posible cargar los reportes del período seleccionado.</span>
            </div>
            <button
              type="button"
              onClick={refresh}
              className={btnSecondary}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              <span>Reintentar</span>
            </button>
          </div>
        )}

        {/* 4 Tarjetas KPI sobrias (borde 1px slate-200, fondo blanco, variación vs período anterior) */}
        <section aria-label="Indicadores clave por etapa del embudo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_STAGES.map((stage) => (
              <KpiCard
                key={stage.id}
                stage={stage}
                measure={getMeasure(stage.id, measures[stage.id])}
                report={reports[stage.id]}
                active={activeView === stage.id}
                onSelect={() => handleViewChange(stage.id)}
              />
            ))}
          </div>
        </section>

        {/* Sub-navbar segmental tipo píldora (Segmented Control) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="overflow-x-auto no-scrollbar">
            <SegmentedControl<ReportView>
              ariaLabel="Etapas del embudo de pacientes"
              controls="reports-stage-panel"
              value={activeView}
              onChange={handleViewChange}
              options={segmentedOptions}
            />
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            {activeView === 'all'
              ? 'Mostrando las 4 matrices del embudo en simultáneo'
              : `Vista detallada · Etapa ${STAGE_BY_ID[activeView].index} (${STAGE_BY_ID[activeView].label})`}
          </p>
        </div>

        {/* Panel de matrices analíticas */}
        <div id="reports-stage-panel" role="tabpanel">
          {isInitialLoading ? (
            <ReportsSkeleton />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {visibleStages.map((stage) => {
                  const data = reports[stage.id];
                  if (!data) return null;
                  return (
                    <ExecutiveMatrixTable
                      key={stage.id}
                      data={data}
                      stage={stage}
                      measure={measures[stage.id]}
                      onMeasureChange={(val) => handleMeasureChange(stage.id, val)}
                      period={period}
                      periods={periodOptions}
                      onPeriodChange={handlePeriodChange}
                      displayMode={displayMode}
                      onDisplayModeChange={setDisplayMode}
                      isFetching={fetchingByStage[stage.id]}
                      containerId={`report-matrix-${stage.id}`}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
