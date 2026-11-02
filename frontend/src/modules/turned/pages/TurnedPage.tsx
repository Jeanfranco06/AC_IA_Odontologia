import { useState, useMemo } from 'react';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BaseTable } from '@/shared/components/data-display/BaseTable';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useTurneds } from '../hooks/useTurnedQueries';
import { TurnedState } from '@/domain/enums';
import { Search, Eye, X, RotateCcw } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TurnedWithDetails } from '@/application/use-cases/turned';
import { calculateT1, calculateT2, calculateT3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { TurnedDetailModal } from '../components/TurnedDetailModal';

export default function TurnedPage() {
  const { data: turneds, isLoading, isError } = useTurneds();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [selectedTurnedId, setSelectedTurnedId] = useState<string | null>(null);

  const filteredTurneds = useMemo(() => {
    return turneds?.filter((t: TurnedWithDetails) => {
      const term = searchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (term) {
        const firstName = t.person?.firstName || '';
        const lastName = t.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (t.person?.documentNumber || '').toLowerCase();
        const email = (t.person?.email || '').toLowerCase();
        const phone = (t.person?.phone || '').toLowerCase();
        const service = (t.lead?.requestedServiceId || '').toLowerCase();
        const professional = (t.reservation?.professionalId || '').toLowerCase();
        const branch = (t.reservation?.branchId || '').toLowerCase();
        const result = (t.finalResult || '').toLowerCase();
        const comment = (t.customerComment || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        const state = (t.state || '').toLowerCase();

        matchSearch = 
          fullName.includes(term) ||
          firstName.toLowerCase().includes(term) ||
          lastName.toLowerCase().includes(term) ||
          doc.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          service.includes(term) ||
          professional.includes(term) ||
          branch.includes(term) ||
          result.includes(term) ||
          comment.includes(term) ||
          id.includes(term) ||
          state.includes(term);
      }

      const matchStatus = statusFilter === 'ALL' || t.state === statusFilter;
      
      let matchDate = true;
      if (startDate && t.createdAt) {
        const start = startOfDay(parseISO(t.createdAt));
        matchDate = matchDate && !isBefore(parseISO(t.createdAt), start);
      }
      if (endDate && t.createdAt) {
        const end = endOfDay(parseISO(endDate));
        matchDate = matchDate && !isAfter(parseISO(t.createdAt), end);
      }
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [turneds, searchTerm, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL' || startDate || endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const indicators = useMemo(() => {
    return [
      calculateT1(filteredTurneds),
      calculateT2(filteredTurneds),
      calculateT3(filteredTurneds)
    ];
  }, [filteredTurneds]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (t: TurnedWithDetails) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{t.person.firstName} {t.person.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.person.documentNumber || 'Sin Doc'}</p>
        </div>
      )
    },
    { 
      header: 'Servicio Finalizado', 
      cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{t.lead.requestedServiceId}</span>
    },
      { 
        header: 'Fecha Atención', 
        cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{t.reservation?.date ? format(new Date(t.reservation.date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}</span>
      },
    { 
      header: 'Próximo Seguimiento', 
      cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{t.nextContactDate ? format(new Date(t.nextContactDate), 'dd MMM yyyy', { locale: es }) : 'No agendado'}</span>
    },
    { 
      header: 'Resultado / Satis.', 
      cell: (t: TurnedWithDetails) => (
        <div>
          <p className="text-slate-900 dark:text-slate-200">{t.finalResult || '-'}</p>
          {t.satisfaction && <p className="text-xs text-slate-500 dark:text-slate-400">{t.satisfaction} / 5</p>}
        </div>
      )
    },
    { 
      header: 'Estado', 
      cell: (t: TurnedWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (t.state === TurnedState.CLOSED) variant = 'success';
        if (t.state === TurnedState.NEW_REQUEST) variant = 'success';
        if (t.state === TurnedState.FOLLOW_UP_PENDING) variant = 'error';
        if (t.state === TurnedState.IN_FOLLOW_UP) variant = 'warning';
        return <StatusBadge status={t.state} variant={variant} />;
      }
    },
    { 
      header: 'Acciones', 
      cell: (t: TurnedWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedTurnedId(t.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
          <Eye className="w-4 h-4 mr-2" />
          Revisar
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo TURNED" 
        description="Gestión de postventa, fidelización y reenganche de clientes atendidos."
      />

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Búsqueda en Tiempo Real</span>
              <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                {filteredTurneds.length} {filteredTurneds.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por persona, servicio, profesional, resultado, comentarios, ID..."
                className="pl-8 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Borrar búsqueda"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-[170px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value={TurnedState.FOLLOW_UP_PENDING}>Seguimiento Pendiente</SelectItem>
                <SelectItem value={TurnedState.IN_FOLLOW_UP}>En Seguimiento</SelectItem>
                <SelectItem value={TurnedState.CLOSED}>Cerrado</SelectItem>
                <SelectItem value={TurnedState.NEW_REQUEST}>Nueva Solicitud Creada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Desde</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 text-xs h-9 font-medium cursor-pointer" />
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Hasta</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 text-xs h-9 font-medium cursor-pointer" />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="Restablecer todos los filtros"
              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-3 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} indicator={ind} period={startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico Completo'} />
        ))}
      </div>

      {filteredTurneds.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron registros de postventa." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredTurneds} 
          keyExtractor={(item) => item.id} 
        />
      )}

      {/* Modal Detalle de Postventa y Seguimiento */}
      <TurnedDetailModal 
        turnedId={selectedTurnedId} 
        isOpen={!!selectedTurnedId} 
        onClose={() => setSelectedTurnedId(null)} 
      />
    </div>
  );
}
