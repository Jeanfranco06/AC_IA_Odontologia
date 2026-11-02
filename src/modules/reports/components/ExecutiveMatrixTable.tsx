import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Download,
  Hash,
  Percent,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { ExecutiveReportData, ReportPeriodOption } from '@/shared/services/report.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/index';
import {
  STAGE_BY_ID,
  UNIT_LABEL,
  getMeasure,
  type MeasureOption,
  type StageConfig,
} from '../config/stages';
import { columnLabel, formatDateTime, formatNumber, formatPercent } from '../lib/format';
import { buildMatrixRows, grandTotalRow, toPercent, type DisplayMode } from '../lib/matrix';
import { btnSecondary } from './buttonStyles';
import { ExportMenu } from './ExportMenu';
import { SegmentedControl } from './SegmentedControl';

export interface ExecutiveMatrixTableProps {
  data: ExecutiveReportData;
  containerId?: string;
  stage?: StageConfig;
  measure?: string;
  onMeasureChange?: (measure: string) => void;
  period?: string;
  periods?: ReportPeriodOption[];
  onPeriodChange?: (period: string) => void;
  displayMode?: DisplayMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
  isFetching?: boolean;
}

export const ExecutiveMatrixTable: React.FC<ExecutiveMatrixTableProps> = ({
  data,
  containerId,
  stage: stageProp,
  measure: measureProp,
  onMeasureChange,
  period,
  periods,
  onPeriodChange,
  displayMode: controlledMode,
  onDisplayModeChange,
  isFetching = false,
}) => {
  const stageKey = data.stage.toLowerCase() as keyof typeof STAGE_BY_ID;
  const stage = stageProp ?? STAGE_BY_ID[stageKey];
  const activeMeasure: MeasureOption = useMemo(
    () =>
      measureProp
        ? getMeasure(stage.id, measureProp)
        : stage.measures.find((m) => data.metric.toLowerCase().includes(m.label.toLowerCase())) ?? stage.measures[0],
    [stage, measureProp, data.metric]
  );

  const [localMode, setLocalMode] = useState<DisplayMode>('absolute');
  const rawMode = controlledMode ?? localMode;
  const setMode = onDisplayModeChange ?? setLocalMode;

  const canShowPercent = activeMeasure.aggregation === 'sum' && (data.grandTotal ?? 0) > 0;
  const effectiveMode: DisplayMode = canShowPercent ? rawMode : 'absolute';

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => buildMatrixRows(data, searchQuery), [data, searchQuery]);
  const totalRow = useMemo(() => grandTotalRow(data), [data]);

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }));
  };

  const formatCell = (val: number | null) => {
    if (effectiveMode === 'percent') {
      return formatPercent(toPercent(val, data));
    }
    return formatNumber(val, activeMeasure.unit);
  };

  const visibleItemsCount = useMemo(
    () => rows.filter((r) => r.kind === 'item').length,
    [rows]
  );

  const id = containerId ?? `report-matrix-${stage.id}`;

  return (
    <div
      id={id}
      className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Barra de progreso sutil durante recargas en segundo plano */}
      {isFetching && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-teal-500/15" aria-hidden>
          <div className="ns-progress-bar h-full w-1/2 bg-teal-700 dark:bg-teal-400" />
        </div>
      )}

      {/* Encabezado de sección y barra de herramientas contextual integrada */}
      <div className="border-b border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {stage.index} · {stage.role}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {stage.label}
              </h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {UNIT_LABEL[activeMeasure.unit]}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stage.description} Corte por <span className="font-medium text-slate-700 dark:text-slate-300">{data.rowHeader.toLowerCase()}</span> y{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.superHeader.toLowerCase()}</span>.
            </p>
          </div>

          {/* Selector de indicador (KPI de la etapa) */}
          {onMeasureChange && (
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <label
                htmlFor={`measure-${stage.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                <span>Indicador</span>
              </label>
              <Select value={activeMeasure.value} onValueChange={onMeasureChange}>
                <SelectTrigger
                  id={`measure-${stage.id}`}
                  className="h-8 w-[260px] rounded-lg border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-800 shadow-none hover:bg-slate-100/70 focus:ring-teal-600/40 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                >
                  <SelectValue placeholder="Seleccione indicador" />
                </SelectTrigger>
                <SelectContent>
                  {stage.measures.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Fila de controles contextuales de tabla: búsqueda, switch Abs/%, cohorte y descarga rápida */}
        <div className="mt-3.5 flex flex-col gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800/80 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {/* Buscador rápido de canales / sedes / servicios */}
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filtrar ${data.rowHeader.toLowerCase()}…`}
              aria-label={`Filtrar ${data.rowHeader}`}
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar filtro"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Switch Valores Absolutos vs % */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SegmentedControl<DisplayMode>
                    size="sm"
                    semantics="radio"
                    ariaLabel="Modo de visualización de valores"
                    value={effectiveMode}
                    onChange={setMode}
                    options={[
                      {
                        value: 'absolute',
                        ariaLabel: 'Valores absolutos',
                        label: (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3 w-3 text-slate-400" aria-hidden />
                            <span>Absolutos</span>
                          </span>
                        ),
                      },
                      {
                        value: 'percent',
                        ariaLabel: 'Participación porcentual',
                        disabled: !canShowPercent,
                        label: (
                          <span className="inline-flex items-center gap-1">
                            <Percent className="h-3 w-3 text-slate-400" aria-hidden />
                            <span>Participación</span>
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              </TooltipTrigger>
              {!canShowPercent && (
                <TooltipContent>
                  La distribución porcentual sólo está disponible en métricas aditivas.
                </TooltipContent>
              )}
            </Tooltip>

            {/* Selector contextual de cohorte / período */}
            {periods && periods.length > 0 && onPeriodChange && period && (
              <Select value={period} onValueChange={onPeriodChange}>
                <SelectTrigger
                  aria-label="Período o cohorte de la tabla"
                  className="h-8 w-[168px] rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-none hover:bg-slate-50 focus:ring-teal-600/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <div className="flex min-w-0 items-center gap-1.5 [&>span]:truncate">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <SelectValue placeholder="Cohorte" />
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
            )}

            {/* Descarga rápida contextual (CSV / PDF ejecutivo de esta etapa) */}
            <ExportMenu
              getSections={() => [{ stage, measure: activeMeasure, report: data }]}
              mode={effectiveMode}
              label="Descargar"
              scopeLabel={`${stage.label} · ${activeMeasure.label}`}
              triggerClassName={cn(btnSecondary, 'h-8 px-2.5 text-xs')}
              icon={<Download className="h-3.5 w-3.5 text-slate-500" aria-hidden />}
            />
          </div>
        </div>
      </div>

      {/* Grilla analítica de corte matricial */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            {/* Fila superior: dimensión de filas + super-header de columnas + total */}
            <tr className="border-b border-slate-200/80 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-800/50">
              <th
                scope="col"
                rowSpan={2}
                className="w-[34%] min-w-[220px] border-r border-slate-200/80 px-5 py-3 align-bottom text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                {data.rowHeader}
              </th>
              <th
                scope="colgroup"
                colSpan={Math.max(data.columns.length, 1)}
                className="border-b border-r border-slate-200/80 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400"
              >
                {data.superHeader}
              </th>
              <th
                scope="col"
                rowSpan={2}
                className="min-w-[132px] bg-slate-100/70 px-5 py-3 text-right align-bottom text-xs font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
              >
                {effectiveMode === 'percent' ? '% Total' : data.totalColumnName}
              </th>
            </tr>

            {/* Sub-header con las columnas de la dimensión */}
            <tr className="border-b border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40">
              {data.columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="min-w-[116px] border-r border-slate-200/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:text-slate-300"
                >
                  {columnLabel(col)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.columns.length + 2}
                  className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {searchQuery ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        Sin coincidencias para «{searchQuery}»
                      </p>
                      <p className="text-xs text-slate-400">
                        Prueba con otro término o limpia el filtro para ver todas las dimensiones.
                      </p>
                    </div>
                  ) : (
                    'No hay registros disponibles para el período seleccionado.'
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                if (row.kind === 'category') {
                  const isCollapsed = Boolean(collapsedCategories[row.label]);
                  return (
                    <tr
                      key={row.key}
                      className="bg-slate-50/70 dark:bg-slate-800/30"
                    >
                      <td
                        colSpan={data.columns.length + 2}
                        className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCategory(row.label)}
                          aria-expanded={!isCollapsed}
                          className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:hover:bg-slate-700/50"
                        >
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 text-slate-400 transition-transform duration-150',
                              !isCollapsed && 'rotate-90'
                            )}
                            aria-hidden
                          />
                          <span>{row.label}</span>
                          <span className="ml-1 rounded bg-slate-200/70 px-1.5 py-0.2 font-mono text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {row.itemCount}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                }

                if (row.kind === 'item') {
                  if (collapsedCategories[row.category]) return null;
                  const sharePct = canShowPercent ? toPercent(row.total, data) : 0;

                  return (
                    <tr
                      key={row.key}
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="border-r border-slate-200/60 py-2.5 pl-9 pr-4 text-slate-700 dark:border-slate-800/70 dark:text-slate-300">
                        {row.label}
                      </td>
                      {data.columns.map((col) => {
                        const val = row.values[col] === undefined ? 0 : row.values[col];
                        return (
                          <td
                            key={col}
                            className={cn(
                              'border-r border-slate-200/60 px-4 py-2.5 text-right font-mono tabular-nums dark:border-slate-800/70',
                              val === 0
                                ? 'text-slate-300 dark:text-slate-600'
                                : 'text-slate-700 dark:text-slate-200'
                            )}
                          >
                            {formatCell(val)}
                          </td>
                        );
                      })}
                      <td className="relative bg-slate-50/40 px-5 py-2.5 text-right font-mono font-medium tabular-nums text-slate-900 dark:bg-slate-800/20 dark:text-white">
                        {canShowPercent && sharePct > 0 && (
                          <span
                            className="pointer-events-none absolute inset-y-1.5 right-2 rounded-sm bg-teal-600/[0.08] dark:bg-teal-400/[0.12]"
                            style={{ width: `${Math.min(sharePct, 100) * 0.88}%` }}
                            aria-hidden
                          />
                        )}
                        <span className="relative">{formatCell(row.total)}</span>
                      </td>
                    </tr>
                  );
                }

                if (row.kind === 'subtotal') {
                  return (
                    <tr
                      key={row.key}
                      className="bg-slate-50 font-semibold text-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
                    >
                      <td className="border-r border-slate-200/80 px-5 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        {row.label}
                      </td>
                      {data.columns.map((col) => (
                        <td
                          key={col}
                          className="border-r border-slate-200/80 px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-800 dark:border-slate-800 dark:text-slate-100"
                        >
                          {formatCell(row.values[col] === undefined ? 0 : row.values[col])}
                        </td>
                      ))}
                      <td className="bg-slate-100/70 px-5 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:bg-slate-800 dark:text-white">
                        {formatCell(row.total)}
                      </td>
                    </tr>
                  );
                }

                return null;
              })
            )}
          </tbody>

          {/* Fila de Total General con jerarquía clara sin asteriscos */}
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <th
                scope="row"
                className="border-r border-slate-200/80 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                {totalRow.label}
              </th>
              {data.columns.map((col) => (
                <td
                  key={col}
                  className="border-r border-slate-200/80 px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:text-white"
                >
                  {formatCell(totalRow.values[col] === undefined ? 0 : totalRow.values[col])}
                </td>
              ))}
              <td className="bg-teal-700/[0.08] px-5 py-3 text-right font-mono text-sm font-semibold tabular-nums text-teal-900 dark:bg-teal-500/15 dark:text-teal-200">
                {data.isCurrency && effectiveMode === 'absolute' ? 'S/ ' : ''}
                {formatCell(totalRow.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pie de tabla discreto con resumen de filas y marca de tiempo */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span>
          {data.categories.length} {data.categories.length === 1 ? 'categoría' : 'categorías'} · {visibleItemsCount}{' '}
          {visibleItemsCount === 1 ? 'fila' : 'filas'}
          {searchQuery && ` (filtrado por «${searchQuery}»)`}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          Período: {data.period} · Actualizado {formatDateTime(data.generatedAt)}
        </span>
      </div>
    </div>
  );
};

export default ExecutiveMatrixTable;
