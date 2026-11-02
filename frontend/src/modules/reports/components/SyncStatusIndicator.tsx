import { memo, useEffect, useState } from 'react';
import { Database, Info } from 'lucide-react';
import type { MartStatus } from '@/shared/services/report.service';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/utils/index';
import { formatDateTime, relativeTime } from '../lib/format';

const STALE_AFTER_MS = 15 * 60 * 1000;
const TICK_MS = 30 * 1000;

interface SyncStatusIndicatorProps {
  lastSyncedAt: number | null;
  isFetching: boolean;
  hasError: boolean;
  status?: MartStatus;
}

/**
 * Indicador discreto de frescura de datos. Los detalles técnicos de la fuente
 * (motor, base, tablas de hechos) sólo se exponen dentro del popover.
 * Aislado como componente propio: su reloj interno no re-renderiza la página.
 */
export const SyncStatusIndicator = memo(function SyncStatusIndicator({
  lastSyncedAt,
  isFetching,
  hasError,
  status,
}: SyncStatusIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const isStale = lastSyncedAt !== null && now - lastSyncedAt > STALE_AFTER_MS;
  const tone: 'ok' | 'warn' | 'idle' = hasError || isStale ? 'warn' : lastSyncedAt ? 'ok' : 'idle';

  const label = isFetching
    ? 'Sincronizando…'
    : hasError
      ? 'Fuente no disponible'
      : lastSyncedAt
        ? `Última sincronización: ${relativeTime(lastSyncedAt, now)}`
        : 'Conectando con la fuente…';

  const totalRecords = status?.tables.reduce((acc, t) => acc + Number(t.registros || 0), 0) ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'group inline-flex items-center gap-2 rounded-md py-1 pl-1.5 pr-2 text-xs text-slate-500 transition-colors',
          'hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40',
          'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        )}
        aria-label={`${label}. Ver información de la fuente de datos`}
      >
        <StatusDot tone={tone} pulsing={isFetching} />
        <span aria-live="polite">{label}</span>
        <Info className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </PopoverTrigger>

      <PopoverContent className="w-[22rem] p-0">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <Database className="h-4 w-4 text-slate-400" aria-hidden />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Info de la fuente</p>
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium',
              hasError
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            )}
          >
            {hasError ? 'Sin conexión' : 'En línea'}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3 text-xs">
          <dt className="text-slate-400">Origen</dt>
          <dd className="text-right text-slate-700 dark:text-slate-300">Data mart dimensional</dd>
          <dt className="text-slate-400">Base de datos</dt>
          <dd className="text-right font-mono text-slate-700 dark:text-slate-300">{status?.database ?? '—'}</dd>
          <dt className="text-slate-400">Motor</dt>
          <dd className="text-right font-mono text-slate-700 dark:text-slate-300">
            {status?.driver ?? '—'}
            {status?.serverVersion ? ` ${status.serverVersion}` : ''}
          </dd>
          <dt className="text-slate-400">Última consulta</dt>
          <dd className="text-right tabular-nums text-slate-700 dark:text-slate-300">
            {lastSyncedAt ? formatDateTime(lastSyncedAt) : '—'}
          </dd>
          <dt className="text-slate-400">Datos hasta</dt>
          <dd className="text-right tabular-nums text-slate-700 dark:text-slate-300">
            {status?.latestDataDate ? formatDateTime(`${status.latestDataDate}T00:00:00`).split(',')[0] : '—'}
          </dd>
        </dl>

        {status && status.tables.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tablas de hechos</p>
            <ul className="space-y-1.5">
              {status.tables.map((t) => (
                <li key={t.tabla} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-slate-500 dark:text-slate-400">{t.tabla}</span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {Number(t.registros).toLocaleString('es-PE')}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-1.5 text-xs dark:border-slate-700">
                <span className="text-slate-500">Total de registros</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {totalRecords.toLocaleString('es-PE')}
                </span>
              </li>
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

function StatusDot({ tone, pulsing }: { tone: 'ok' | 'warn' | 'idle'; pulsing: boolean }) {
  const color = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-slate-300';
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      {pulsing && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping', color)} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  );
}
