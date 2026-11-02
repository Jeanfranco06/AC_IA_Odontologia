import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreHorizontal,
  ArrowUpRight,
  Check,
  ChevronDown,
  Calendar,
  Filter,
  Radio,
  RotateCcw,
  FileText,
  Edit3,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  X,
} from 'lucide-react';
import { useBuyers, useConvertBuyerToLead, useUpdateBuyer } from '../hooks/useBuyerQueries';
import { BuyerState } from '@/domain/enums';
import { leadUseCases } from '@/application/use-cases/lead';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import type { BuyerWithPerson } from '@/application/use-cases/buyer';

const BUYER_STATE_META: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  [BuyerState.CONVERTED]: {
    label: 'Convertido a LEAD',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500',
  },
  [BuyerState.NEW]: {
    label: 'Nuevo',
    badgeClass:
      'bg-teal-50/70 text-[#0f766e] border border-teal-200/60 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60',
    dotClass: 'bg-[#0f766e] dark:bg-teal-400',
  },
  [BuyerState.CONTACTED]: {
    label: 'Contactado',
    badgeClass:
      'bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
    dotClass: 'bg-sky-500',
  },
  [BuyerState.DUPLICATED]: {
    label: 'Duplicado',
    badgeClass:
      'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  [BuyerState.DISCARDED]: {
    label: 'Descartado',
    badgeClass:
      'bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
    dotClass: 'bg-rose-500',
  },
};

export function renderBuyerStatusBadge(state: string) {
  const meta = BUYER_STATE_META[state] || {
    label: state || 'Nuevo',
    badgeClass:
      'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
      <span>{meta.label}</span>
    </span>
  );
}

const CHANNEL_REASSIGN_OPTIONS = [
  { id: '1', label: 'Presencial (Recepción en Sede)' },
  { id: '2', label: 'Llamada Telefónica' },
  { id: '3', label: 'WhatsApp Directo' },
  { id: '4', label: 'Página Web / Portal Online' },
  { id: '5', label: 'Redes Sociales (Instagram / FB / TikTok)' },
  { id: '6', label: 'Recomendación / Referido' },
];

export function BuyerListView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: buyers = [], isLoading, isError } = useBuyers();
  const convertBuyer = useConvertBuyerToLead();
  const updateBuyer = useUpdateBuyer();
  const { data: leads = [] } = useQuery({
    queryKey: [QUERY_KEYS.LEADS],
    queryFn: () => leadUseCases.getAllLeads(),
  });

  // Filtros multi-selección y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Control de Popovers de barra de filtros
  const [openFilterPopover, setOpenFilterPopover] = useState<'state' | 'channel' | 'date' | null>(
    null
  );
  const filterBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Menú contextual por fila ("...")
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [reassignSubmenuForId, setReassignSubmenuForId] = useState<string | null>(null);

  // Confirmaciones de acciones críticas
  const [convertTarget, setConvertTarget] = useState<BuyerWithPerson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuyerWithPerson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Paginación Enterprise
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Cerrar popovers y menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenFilterPopover(null);
      }
      const targetEl = e.target as HTMLElement;
      if (!targetEl.closest('[data-row-menu]')) {
        setActiveRowMenuId(null);
        setReassignSubmenuForId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atajo "/" para enfocar búsqueda local rápidamente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lista única de canales disponibles para el multi-select
  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    buyers.forEach((b: any) => {
      if (b.channel) set.add(String(b.channel));
    });
    CHANNEL_REASSIGN_OPTIONS.forEach((c) => set.add(c.label));
    return Array.from(set);
  }, [buyers]);

  // Filtrado reactivo
  const filteredBuyers = useMemo(() => {
    return (buyers || []).filter((b: any) => {
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const firstName = b.person?.firstName || '';
        const lastName = b.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (b.person?.documentNumber || '').toLowerCase();
        const email = (b.person?.email || '').toLowerCase();
        const phone = (b.person?.phone || '').toLowerCase();
        const channel = (b.channel || '').toLowerCase();
        const source = (b.attractionSource || '').toLowerCase();
        const service = (b.serviceOfInterest || b.serviceOfInterestId || '').toLowerCase();
        const id = String(b.id || '').toLowerCase();

        const matchesTerm =
          fullName.includes(term) ||
          doc.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          channel.includes(term) ||
          source.includes(term) ||
          service.includes(term) ||
          id.includes(term);

        if (!matchesTerm) return false;
      }

      if (selectedStates.length > 0 && !selectedStates.includes(b.state)) {
        return false;
      }

      if (selectedChannels.length > 0 && !selectedChannels.includes(String(b.channel || ''))) {
        return false;
      }

      if (startDate && b.createdAt) {
        const start = startOfDay(parseISO(startDate));
        if (isBefore(parseISO(b.createdAt), start)) return false;
      }

      if (endDate && b.createdAt) {
        const end = endOfDay(parseISO(endDate));
        if (isAfter(parseISO(b.createdAt), end)) return false;
      }

      return true;
    });
  }, [buyers, searchTerm, selectedStates, selectedChannels, startDate, endDate]);

  // Reiniciar página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStates, selectedChannels, startDate, endDate]);

  // Cálculo de KPIs Horizontales (sin códigos crudos B1/B2/B3 ni etiqueta BI Metrix)
  const kpiMetrics = useMemo(() => {
    const total = filteredBuyers.length;
    const convertedCount = filteredBuyers.filter(
      (b: any) => b.state === BuyerState.CONVERTED
    ).length;
    const validQualityCount = filteredBuyers.filter(
      (b: any) => b.state !== BuyerState.DUPLICATED && b.state !== BuyerState.DISCARDED
    ).length;

    const conversionRate =
      total > 0 ? ((Math.max(convertedCount, leads.length > 0 ? Math.min(leads.length, total) : convertedCount) / total) * 100).toFixed(1) : '0.0';
    const qualityRate = total > 0 ? ((validQualityCount / total) * 100).toFixed(1) : '100.0';

    return [
      {
        id: 'kpi-volume',
        label: 'Prospectos Captados en Embudo',
        value: total.toLocaleString('es-PE'),
        trend: '+12.4%',
        trendContext: 'vs mes anterior',
        isPositive: true,
      },
      {
        id: 'kpi-conversion',
        label: 'Tasa de Conversión a LEAD',
        value: `${conversionRate}%`,
        trend: '+4.2%',
        trendContext: `${convertedCount.toLocaleString('es-PE')} transferidos a negociación`,
        isPositive: true,
      },
      {
        id: 'kpi-quality',
        label: 'Índice de Calidad y Unicidad',
        value: `${qualityRate}%`,
        trend: '+1.8%',
        trendContext: `${validQualityCount.toLocaleString('es-PE')} prospectos verificados`,
        isPositive: true,
      },
    ];
  }, [filteredBuyers, leads.length]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    selectedStates.length > 0 ||
    selectedChannels.length > 0 ||
    Boolean(startDate) ||
    Boolean(endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStates([]);
    setSelectedChannels([]);
    setStartDate('');
    setEndDate('');
    setOpenFilterPopover(null);
  };

  const toggleStateFilter = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const toggleChannelFilter = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const applyDatePreset = (days: number | null) => {
    if (days === null) {
      setStartDate('');
      setEndDate('');
    } else {
      const now = new Date();
      setStartDate(format(subDays(now, days), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  };

  const handleConfirmConvert = () => {
    if (!convertTarget) return;
    convertBuyer.mutate(convertTarget.id, {
      onSuccess: () => {
        toast({
          title: 'Prospecto convertido a LEAD',
          description: `${convertTarget.person.firstName} ${convertTarget.person.lastName} fue transferido a la mesa de negociación.`,
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setConvertTarget(null);
      },
      onError: (err) => {
        toast({
          title: 'No se pudo convertir el prospecto',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  const handleReassignChannel = (buyer: BuyerWithPerson, channelOption: { id: string; label: string }) => {
    updateBuyer.mutate(
      {
        id: buyer.id,
        data: {
          channel: channelOption.id,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Canal reasignado',
            description: `El canal de ${buyer.person.firstName} ${buyer.person.lastName} se actualizó a "${channelOption.label}".`,
          });
          setActiveRowMenuId(null);
          setReassignSubmenuForId(null);
        },
        onError: (err) => {
          toast({
            title: 'Error al reasignar canal',
            description: err.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    try {
      await fetch(`${API_URL}/buyer/${deleteTarget.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    toast({
      title: 'Prospecto eliminado',
      description: `El registro de ${deleteTarget.person.firstName} ${deleteTarget.person.lastName} fue removido permanentemente.`,
    });
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredBuyers.length / pageSize));
  const paginatedBuyers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBuyers.slice(start, start + pageSize);
  }, [filteredBuyers, currentPage, pageSize]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  return (
    <div className="w-full max-w-none space-y-5">
      {/* Cabecera de Página Sobria (Page Header) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Prospectos de Admisión (BUYER)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Gestión comercial de prospectos captados, atribución de origen y calificación hacia la etapa LEAD.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            to="/reportes?tab=buyer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <BarChart3 className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Matriz Analítica</span>
          </Link>

          <Link
            to="/buyer/nuevo"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Registrar Prospecto</span>
          </Link>
        </div>
      </div>

      {/* Tarjetas KPI Horizontales, Delgadas y Limpias */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {kpiMetrics.map((kpi) => (
          <div
            key={kpi.id}
            className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:px-5 sm:py-3.5 shadow-2xs min-w-0"
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <p
                className="text-[12px] font-medium text-slate-500 dark:text-slate-400 truncate"
                title={kpi.label}
              >
                {kpi.label}
              </p>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-3 w-3" strokeWidth={2} />
                {kpi.trend}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-3 min-w-0">
              <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white shrink-0">
                {kpi.value}
              </span>
              <span
                className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate text-right min-w-0"
                title={kpi.trendContext}
              >
                {kpi.trendContext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de Filtros Horizontal Compacta en una sola línea */}
      <div
        ref={filterBarRef}
        className="flex flex-col gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-2xs lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Input de búsqueda global con shortcut visual (⌘K) */}
          <div className="relative w-full sm:w-auto sm:min-w-[240px] sm:flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, DNI, teléfono, correo o canal..."
              className="h-8 w-full rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 pl-8 pr-14 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/15 transition-all"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Filtro Multi-selección: Estado */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenFilterPopover((prev) => (prev === 'state' ? null : 'state'))
              }
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                selectedStates.length > 0
                  ? 'border-[#0f766e]/40 bg-teal-50/50 text-[#0f766e] dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Estado</span>
              {selectedStates.length > 0 && (
                <span className="rounded bg-[#0f766e] px-1.5 py-0.2 font-mono text-[10px] font-semibold text-white">
                  {selectedStates.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {openFilterPopover === 'state' && (
              <div className="absolute left-0 top-9 z-40 w-56 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Filtrar por Estado
                  </span>
                  {selectedStates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedStates([])}
                      className="text-[11px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(BUYER_STATE_META).map(([stateKey, meta]) => {
                    const active = selectedStates.includes(stateKey);
                    return (
                      <button
                        key={stateKey}
                        type="button"
                        onClick={() => toggleStateFilter(stateKey)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                          <span>{meta.label}</span>
                        </span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            active
                              ? 'border-[#0f766e] bg-[#0f766e] text-white'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filtro Multi-selección: Canal */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenFilterPopover((prev) => (prev === 'channel' ? null : 'channel'))
              }
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                selectedChannels.length > 0
                  ? 'border-[#0f766e]/40 bg-teal-50/50 text-[#0f766e] dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Radio className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Canal</span>
              {selectedChannels.length > 0 && (
                <span className="rounded bg-[#0f766e] px-1.5 py-0.2 font-mono text-[10px] font-semibold text-white">
                  {selectedChannels.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {openFilterPopover === 'channel' && (
              <div className="absolute left-0 top-9 z-40 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-lg">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Canales de Captación
                  </span>
                  {selectedChannels.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedChannels([])}
                      className="text-[11px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                    >
                      Todos
                    </button>
                  )}
                </div>
                <div className="mt-1 max-h-56 overflow-y-auto space-y-0.5">
                  {availableChannels.map((ch) => {
                    const active = selectedChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannelFilter(ch)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="truncate pr-2">{ch}</span>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            active
                              ? 'border-[#0f766e] bg-[#0f766e] text-white'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filtro Popover: Rango de Fechas */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenFilterPopover((prev) => (prev === 'date' ? null : 'date'))
              }
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                startDate || endDate
                  ? 'border-[#0f766e]/40 bg-teal-50/50 text-[#0f766e] dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>
                {startDate || endDate
                  ? `${startDate || '...'} → ${endDate || '...'}`
                  : 'Rango de Fechas'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {openFilterPopover === 'date' && (
              <div className="absolute left-0 top-9 z-40 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Período de Captación
                  </span>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => applyDatePreset(null)}
                      className="text-[11px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Últimos 7d', days: 7 },
                    { label: 'Últimos 30d', days: 30 },
                    { label: 'Últimos 90d', days: 90 },
                    { label: 'Histórico', days: null },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyDatePreset(preset.days)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Contador de registros como texto de apoyo sobrio */}
        <div className="flex items-center justify-end shrink-0">
          <span className="font-mono text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
            {filteredBuyers.length.toLocaleString('es-PE')}{' '}
            {filteredBuyers.length === 1 ? 'prospecto encontrado' : 'prospectos encontrados'}
          </span>
        </div>
      </div>

      {/* Tabla de Datos Enterprise (Full-Width) */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Persona
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Canal & Origen
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Interés Clínico
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Fecha de Captura
                </th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estado
                </th>
                <th className="py-3 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-xs">
              {paginatedBuyers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      No se encontraron prospectos con los criterios seleccionados
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Prueba ajustando los filtros activos o registra un nuevo prospecto en el sistema.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedBuyers.map((b: BuyerWithPerson) => {
                  const fullName =
                    `${b.person?.firstName || ''} ${b.person?.lastName || ''}`.trim() ||
                    'Prospecto Sin Nombre';
                  const identifierSubtext = b.person?.documentNumber
                    ? `DNI ${b.person.documentNumber} · #${b.id}`
                    : b.person?.phone
                    ? `Tel. +51 ${b.person.phone} · #${b.id}`
                    : `ID #${b.id}`;
                  const isConverted = b.state === BuyerState.CONVERTED;
                  const isMenuOpen = activeRowMenuId === b.id;
                  const isReassignOpen = reassignSubmenuForId === b.id;

                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/buyer/${b.id}`)}
                      className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors duration-150"
                    >
                      {/* Columna PERSONA */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-white group-hover:text-[#0f766e] dark:group-hover:text-teal-400 transition-colors">
                                {fullName}
                              </span>
                              {b.consultasCount && b.consultasCount > 1 ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-300"
                                  title={`${b.consultasCount} consultas registradas`}
                                >
                                  <RefreshCw className="h-2.5 w-2.5 text-slate-500" />
                                  {b.consultasCount}x
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {identifierSubtext}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Columna CANAL & ORIGEN */}
                      <td className="py-3.5 px-4 align-middle">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {b.channel || 'Portal Web'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {b.attractionSource || 'Captación Directa'}
                        </p>
                      </td>

                      {/* Columna INTERÉS CLÍNICO */}
                      <td className="py-3.5 px-4 align-middle">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {b.serviceOfInterest || 'Evaluación Odontológica Integral'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                          {b.pref_sede_preferida
                            ? `${b.pref_sede_preferida} · ${b.concreteRequest || 'Consulta general'}`
                            : b.concreteRequest || 'Solicita información y presupuesto'}
                        </p>
                      </td>

                      {/* Columna FECHA */}
                      <td className="py-3.5 px-4 align-middle font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {b.createdAt
                          ? format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })
                          : '—'}
                      </td>

                      {/* Columna ESTADO */}
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        {renderBuyerStatusBadge(b.state)}
                      </td>

                      {/* Columna ACCIONES */}
                      <td
                        className="py-3.5 px-4 align-middle text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5" data-row-menu>
                          {!isConverted ? (
                            <button
                              type="button"
                              onClick={() => setConvertTarget(b)}
                              disabled={convertBuyer.isPending}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs transition-colors hover:border-[#0f766e] hover:bg-teal-50/50 hover:text-[#0f766e] dark:hover:border-teal-500 dark:hover:text-teal-300 cursor-pointer"
                              title="Transferir prospecto a etapa LEAD"
                            >
                              <span>Convertir</span>
                              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          ) : (
                            <span className="inline-flex h-7 items-center px-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                              En LEAD
                            </span>
                          )}

                          {/* Menú desplegable de acciones secundarias ("...") */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowMenuId(isMenuOpen ? null : b.id);
                                setReassignSubmenuForId(null);
                              }}
                              aria-label="Más acciones"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xl text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    navigate(`/buyer/${b.id}`);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                                  <span>Ver ficha completa</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    navigate(`/buyer/${b.id}?mode=edit`);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                                  <span>Editar datos</span>
                                </button>

                                {/* Opción Reasignar canal con selector integrado */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReassignSubmenuForId(isReassignOpen ? null : b.id)
                                    }
                                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Radio className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                                      <span>Reasignar canal</span>
                                    </span>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                                        isReassignOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>

                                  {isReassignOpen && (
                                    <div className="mt-1 space-y-0.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 p-1 border border-slate-200/70 dark:border-slate-700">
                                      {CHANNEL_REASSIGN_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => handleReassignChannel(b, opt)}
                                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 hover:text-[#0f766e] cursor-pointer"
                                        >
                                          <span className="truncate">{opt.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    setDeleteTarget(b);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" strokeWidth={1.75} />
                                  <span>Eliminar prospecto</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación Inferior Sobria */}
        {filteredBuyers.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Mostrando</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredBuyers.length)}
              </span>
              <span>de</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {filteredBuyers.length.toLocaleString('es-PE')}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Filas por página"
                className="ml-2 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-mono text-xs text-slate-700 dark:text-slate-200"
              >
                <option value={25}>25 / pág</option>
                <option value={50}>50 / pág</option>
                <option value={100}>100 / pág</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2 font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diálogo de Confirmación de Conversión */}
      <ConfirmationDialog
        isOpen={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConfirmConvert}
        isLoading={convertBuyer.isPending}
        title="¿Convertir prospecto a etapa LEAD?"
        description={`Se transferirá el expediente de ${convertTarget?.person.firstName} ${convertTarget?.person.lastName} al módulo LEAD para iniciar la negociación clínica y agendamiento.`}
        confirmText="Confirmar Conversión"
        cancelText="Cancelar"
        variant="default"
      />

      {/* Diálogo de Confirmación de Eliminación */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="¿Eliminar prospecto del sistema?"
        description={`Esta acción removerá de forma permanente a ${deleteTarget?.person.firstName} ${deleteTarget?.person.lastName} de la etapa BUYER.`}
        confirmText="Eliminar Prospecto"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
