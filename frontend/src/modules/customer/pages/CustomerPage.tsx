import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BaseTable } from '@/shared/components/data-display/BaseTable';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useCustomers } from '../hooks/useCustomerQueries';
import { CustomerState } from '@/domain/enums';
import { Search, Eye, X, RotateCcw, BarChart3 } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CustomerWithDetails } from '@/application/use-cases/customer';
import type { DentalAttention } from '@/domain/entities';
import { calculateC1, calculateC2, calculateC3, calculateC4 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { CustomerDetailModal } from '../components/CustomerDetailModal';

export default function CustomerPage() {
  const { data: customers, isLoading, isError } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const parseCleanDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const clean = dateStr.split('T')[0];
    const [y, m, d] = clean.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : null;
  };

  const periodCustomers = useMemo(() => {
    return customers?.filter((c: CustomerWithDetails) => {
      const appointmentDate = parseCleanDate(c.reservation?.date);
      if (!appointmentDate || !isValid(appointmentDate)) return !startDate && !endDate;
      if (startDate && isBefore(appointmentDate, startOfDay(parseISO(startDate)))) return false;
      if (endDate && isAfter(appointmentDate, endOfDay(parseISO(endDate)))) return false;
      return true;
    }) || [];
  }, [customers, startDate, endDate]);

  const filteredCustomers = useMemo(() => {
    return periodCustomers.filter((c: CustomerWithDetails) => {
      const term = searchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (term) {
        const firstName = c.person?.firstName || '';
        const lastName = c.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (c.person?.documentNumber || '').toLowerCase();
        const email = (c.person?.email || '').toLowerCase();
        const phone = (c.person?.phone || '').toLowerCase();
        const service = (c.lead?.requestedServiceId || '').toLowerCase();
        const professional = (c.reservation?.professionalId || '').toLowerCase();
        const branch = (c.reservation?.branchId || '').toLowerCase();
        const resId = (c.reservation?.id || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const state = (c.state || '').toLowerCase();

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
          resId.includes(term) ||
          id.includes(term) ||
          state.includes(term);
      }

      const matchStatus = statusFilter === 'ALL' || c.state === statusFilter;
      const matchPhase = phaseFilter === 'ALL' || c.currentPhase === phaseFilter;
      return matchSearch && matchStatus && matchPhase;
    });
  }, [periodCustomers, searchTerm, statusFilter, phaseFilter]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL' || phaseFilter !== 'ALL' || startDate || endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPhaseFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const indicators = useMemo(() => {
    const attentions = periodCustomers.map(c => c.attention).filter(Boolean) as DentalAttention[];
    return [
      calculateC1(periodCustomers),
      calculateC2(periodCustomers),
      calculateC3(attentions),
      calculateC4(periodCustomers)
    ];
  }, [periodCustomers]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{c.person?.firstName} {c.person?.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{c.person?.documentNumber || 'Sin Doc'}</p>
        </div>
      )
    },
    { 
      header: 'Servicio / Reserva', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-200">{c.lead?.requestedServiceId || 'Consulta Odontológica'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">ID: {c.reservation?.id ? c.reservation.id.substring(0, 8) : '-'}</p>
        </div>
      )
    },
    { 
      header: 'Horario', 
      cell: (c: CustomerWithDetails) => {
        const d = parseCleanDate(c.reservation?.date);
        return (
          <div>
            <p className="text-slate-900 dark:text-slate-200">{d ? format(d, 'dd MMM yyyy', { locale: es }) : '-'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.reservation?.time || '-'}</p>
          </div>
        );
      }
    },
    { 
      header: 'Profesional / Sede', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p className="text-slate-900 dark:text-slate-200">{c.reservation?.professionalId || '-'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{c.reservation?.branchId || '-'}</p>
        </div>
      )
    },
    { 
      header: 'Estado clínico',
      cell: (c: CustomerWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (c.state === CustomerState.ATTENDED) variant = 'success';
        if (c.state === CustomerState.NO_SHOW || c.state === CustomerState.CANCELED) variant = 'error';
        if (c.state === CustomerState.SCHEDULED || c.state === CustomerState.IN_ATTENTION) variant = 'warning';
        const labels: Record<string, string> = {
          SCHEDULED: 'Programado', ATTENDANCE_CONFIRMED: 'Asistencia confirmada',
          IN_ATTENTION: 'En atención', ATTENDED: 'Atendido', NO_SHOW: 'No asistió', CANCELED: 'Cancelado'
        };
        return <StatusBadge status={labels[c.state] || c.state} variant={variant} />;
      }
    },
    {
      header: 'Etapa actual',
      cell: (c: CustomerWithDetails) => (
        <StatusBadge
          status={c.currentPhase || (c.isTurned ? 'TURNED' : 'CUSTOMER')}
          variant={c.currentPhase === 'TURNED' || c.isTurned ? 'primary' : 'neutral'}
        />
      )
    },
    { 
      header: 'Acciones', 
      cell: (c: CustomerWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedCustomerId(c.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
          <Eye className="w-4 h-4 mr-2" />
          Ver Cita
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo CUSTOMER" 
        description="Gestión de citas confirmadas y flujo de atención clínica básica."
        actions={
          <Link
            to="/reportes?tab=customer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Reporte DataMart
          </Link>
        }
      />

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Búsqueda en Tiempo Real</span>
              <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por paciente, documento, servicio, odontólogo, sede, ID..."
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
                <SelectItem value={CustomerState.SCHEDULED}>Programado</SelectItem>
                <SelectItem value={CustomerState.ATTENDANCE_CONFIRMED}>Asist. Confirmada</SelectItem>
                <SelectItem value={CustomerState.IN_ATTENTION}>En Atención</SelectItem>
                <SelectItem value={CustomerState.ATTENDED}>Atendido</SelectItem>
                <SelectItem value={CustomerState.NO_SHOW}>No Asistió</SelectItem>
                <SelectItem value={CustomerState.CANCELED}>Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Etapa</span>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectItem value="ALL">Todas las etapas</SelectItem>
                <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
                <SelectItem value="TURNED">TURNED</SelectItem>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} indicator={ind} period={startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico Completo'} />
        ))}
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron pacientes para la atención." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredCustomers} 
          keyExtractor={(item) => item.id} 
        />
      )}

      {/* Modal Detalle de Atención Odontológica */}
      <CustomerDetailModal 
        customerId={selectedCustomerId} 
        isOpen={!!selectedCustomerId} 
        onClose={() => setSelectedCustomerId(null)} 
      />
    </div>
  );
}
