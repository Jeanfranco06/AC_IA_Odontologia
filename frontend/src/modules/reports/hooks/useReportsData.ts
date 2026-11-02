import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { reportService, type ExecutiveReportData, type ReportStage } from '@/shared/services/report.service';
import { STAGES } from '../config/stages';

export const reportKeys = {
  all: ['reports'] as const,
  status: () => [...reportKeys.all, 'status'] as const,
  periods: () => [...reportKeys.all, 'periods'] as const,
  matrix: (stage: ReportStage, measure: string, period: string) =>
    [...reportKeys.all, 'matrix', stage, measure, period] as const,
};

const STALE_MS = 5 * 60 * 1000;

export function useReportsData(measures: Record<ReportStage, string>, period: string) {
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: reportKeys.status(),
    queryFn: reportService.getStatus,
    staleTime: STALE_MS,
    retry: 1,
  });

  const periods = useQuery({
    queryKey: reportKeys.periods(),
    queryFn: reportService.getPeriods,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const matrixQueries = useQueries({
    queries: STAGES.map((s) => ({
      queryKey: reportKeys.matrix(s.id, measures[s.id], period),
      queryFn: () => reportService.getExecutiveReport(s.id, measures[s.id], period),
      staleTime: STALE_MS,
      placeholderData: keepPreviousData,
      retry: 1,
    })),
  });

  const reports = useMemo(() => {
    const out: Partial<Record<ReportStage, ExecutiveReportData>> = {};
    STAGES.forEach((s, i) => {
      const d = matrixQueries[i].data;
      if (d) out[s.id] = d;
    });
    return out;
  }, [matrixQueries]);

  const fetchingByStage = useMemo(() => {
    const out = {} as Record<ReportStage, boolean>;
    STAGES.forEach((s, i) => (out[s.id] = matrixQueries[i].isFetching));
    return out;
  }, [matrixQueries]);

  const isInitialLoading = matrixQueries.some((q) => q.isPending);
  const isFetching = status.isFetching || matrixQueries.some((q) => q.isFetching);
  const error = (matrixQueries.find((q) => q.error)?.error ?? null) as Error | null;

  /** Momento de la última respuesta exitosa del data mart (ms epoch). */
  const lastSyncedAt = useMemo(() => {
    const stamps = matrixQueries.map((q) => q.dataUpdatedAt).filter((t) => t > 0);
    return stamps.length ? Math.max(...stamps) : null;
  }, [matrixQueries]);

  const refresh = useCallback(async () => {
    try {
      await reportService.sync();
    } catch (e) {
      console.warn('[Reports] Error al sincronizar:', e);
    }
    return queryClient.invalidateQueries({ queryKey: reportKeys.all });
  }, [queryClient]);

  return {
    reports,
    status: status.data,
    statusError: status.isError,
    periods: periods.data,
    isInitialLoading,
    isFetching,
    fetchingByStage,
    error,
    lastSyncedAt,
    refresh,
  };
}
