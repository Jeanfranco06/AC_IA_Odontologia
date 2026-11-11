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
import { 
  Search, 
  Eye, 
  X, 
  RotateCcw, 
  BarChart3, 
  Bot, 
  ExternalLink, 
  Clock, 
  MapPin, 
  Stethoscope, 
  Filter,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
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

  const getInitials = (firstName?: string, lastName?: string) => {
    const f = (firstName || '').trim().charAt(0).toUpperCase();
    const l = (lastName || '').trim().charAt(0).toUpperCase();
    return `${f}${l}` || 'PX';
  };

  const columns = [
    { 
      header: 'Paciente', 
      cell: (c: CustomerWithDetails) => {
        const initials = getInitials(c.person?.firstName, c.person?.lastName);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 text-xs font-bold text-teal-800 dark:text-teal-300 shadow-sm">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {c.person?.firstName} {c.person?.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  DNI: {c.person?.documentNumber || '—'}
                </span>
                {c.person?.phone && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    · {c.person.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    { 
      header: 'Servicio Clínico', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-200">
            {c.lead?.requestedServiceId || 'Consulta Odontológica'}
          </p>
          <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Cód: {c.reservation?.id ? c.reservation.id.substring(0, 8) : `CUS-${c.id}`}
          </p>
        </div>
      )
    },
    { 
      header: 'Fecha & Horario', 
      cell: (c: CustomerWithDetails) => {
        const d = parseCleanDate(c.reservation?.date);
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-200 text-xs font-medium">
              <CalendarDays className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>{d ? format(d, 'dd MMM yyyy', { locale: es }) : 'Por coordinar'}</span>
            </div>
            {c.reservation?.time && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Clock className="h-3 w-3" />
                <span>{c.reservation.time}</span>
              </div>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Profesional & Sede', 
      cell: (c: CustomerWithDetails) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-200 text-xs">
            <Stethoscope className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="font-medium truncate max-w-[140px]">{c.reservation?.professionalId || 'Por asignar'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[140px]">{c.reservation?.branchId || 'Sede Principal'}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Estado Clínico',
      cell: (c: CustomerWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (c.state === CustomerState.ATTENDED) variant = 'success';
        if (c.state === CustomerState.NO_SHOW || c.state === CustomerState.CANCELED) variant = 'error';
        if (c.state === CustomerState.SCHEDULED || c.state === CustomerState.IN_ATTENTION) variant = 'warning';
        const labels: Record<string, string> = {
          SCHEDULED: 'Programado', ATTENDANCE_CONFIRMED: 'Asist. Confirmada',
          IN_ATTENTION: 'En Atención', ATTENDED: 'Atendido', NO_SHOW: 'No Asistió', CANCELED: 'Cancelado'
        };
        return <StatusBadge status={labels[c.state] || c.state} variant={variant} />;
      }
    },
    {
      header: 'Etapa Funnel',
      cell: (c: CustomerWithDetails) => (
        <StatusBadge
          status={c.currentPhase || (c.isTurned ? 'TURNED' : 'CUSTOMER')}
          variant={c.currentPhase === 'TURNED' || c.isTurned ? 'primary' : 'neutral'}
        />
      )
    },
    { 
      header: 'Acción', 
      cell: (c: CustomerWithDetails) => (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSelectedCustomerId(c.id)} 
          className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-300 dark:hover:border-teal-700 shadow-sm transition-all"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Ficha Cita
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo CUSTOMER" 
        description="Gestión integral de citas odontológicas, seguimiento de sesiones y control del flujo de atención clínica."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/customer/agent"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-800 dark:bg-teal-700 text-white text-xs font-semibold hover:bg-teal-900 dark:hover:bg-teal-800 transition-all shadow-sm shadow-teal-900/10"
            >
              <Bot className="w-3.5 h-3.5 text-teal-200" />
              Copiloto IA Staff
            </Link>
            <Link
              to="/portal-customer"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Portal Paciente
            </Link>
            <Link
              to="/reportes?tab=customer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reporte DataMart
            </Link>
          </div>
        }
      />

      {/* Barra de Filtros Clínicos y Búsqueda */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium">
            <Filter className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>Filtros y Búsqueda de Expedientes</span>
          </div>
          <span className="font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-2.5 py-0.5 rounded-full border border-teal-200/60 dark:border-teal-800/60">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'paciente coincidente' : 'pacientes coincidentes'}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Término de Búsqueda</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por nombre, DNI, teléfono, servicio, profesional, sede, código..."
                className="pl-9 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs h-9 focus-visible:ring-teal-700"
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
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Estado de Atención</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
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
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Etapa Funnel</span>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectItem value="ALL">Todas las etapas</SelectItem>
                <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
                <SelectItem value="TURNED">TURNED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[145px]">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Fecha Desde</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-2.5 text-xs h-9 font-medium" />
          </div>
          <div className="w-full sm:w-[145px]">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Fecha Hasta</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-2.5 text-xs h-9 font-medium" />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="Restablecer filtros"
              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-3 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 text-slate-400" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Métricas Clínicas CUSTOMER C1 - C4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} indicator={ind} period={startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico Total'} />
        ))}
      </div>

      {/* Tabla Principal */}
      {filteredCustomers.length === 0 ? (
        <EmptyState 
          title="Sin pacientes encontrados" 
          message="No se encontraron registros que coincidan con los filtros clínicos aplicados." 
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
