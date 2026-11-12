import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BaseTable } from '@/shared/components/data-display/BaseTable';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
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
  CalendarDays,
  FileSpreadsheet
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CustomerWithDetails } from '@/application/use-cases/customer';
import type { DentalAttention } from '@/domain/entities';
import { calculateC1, calculateC2, calculateC3, calculateC4 } from '@/domain/indicators';
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pt-accent-soft)] border border-[color:var(--pt-line-strong)] text-xs font-bold text-[color:var(--pt-accent)] shadow-sm">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-[color:var(--pt-ink)] leading-tight">
                {c.person?.firstName} {c.person?.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[11px] text-[color:var(--pt-muted)] bg-[var(--pt-sunken)] px-1.5 py-0.5 rounded">
                  DNI: {c.person?.documentNumber || '—'}
                </span>
                {c.person?.phone && (
                  <span className="text-[11px] text-[color:var(--pt-muted)]">
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
      header: 'Tratamiento & Plan', 
      cell: (c: CustomerWithDetails) => {
        const tr = c.treatment;
        return (
          <div className="space-y-1">
            <p className="font-medium text-[color:var(--pt-ink)]">
              {tr?.serviceName || c.lead?.requestedServiceId || 'Consulta Odontológica'}
            </p>
            {tr ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {tr.completedSessions} de {tr.totalSessions} ses. ({tr.progressPercent}%)
                </span>
                {tr.isReadyForTurned && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                    Completado
                  </span>
                )}
              </div>
            ) : (
              <p className="font-mono text-[11px] text-[color:var(--pt-muted)]">
                Cód: {c.reservation?.id ? c.reservation.id.substring(0, 8) : `CUS-${c.id}`}
              </p>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Fecha & Horario', 
      cell: (c: CustomerWithDetails) => {
        const d = parseCleanDate(c.reservation?.date);
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[color:var(--pt-ink)] text-xs font-medium">
              <CalendarDays className="h-3.5 w-3.5 text-[color:var(--pt-accent)]" />
              <span>{d ? format(d, 'dd MMM yyyy', { locale: es }) : 'Por coordinar'}</span>
            </div>
            {c.reservation?.time && (
              <div className="flex items-center gap-1 text-[11px] text-[color:var(--pt-muted)]">
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
          <div className="flex items-center gap-1.5 text-[color:var(--pt-ink)] text-xs">
            <Stethoscope className="h-3.5 w-3.5 text-[color:var(--pt-accent)] shrink-0" />
            <span className="font-medium truncate max-w-[140px]">{c.reservation?.professionalId || 'Por asignar'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[color:var(--pt-muted)]">
            <MapPin className="h-3 w-3 text-[color:var(--pt-muted)] shrink-0" />
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
          className="rounded-xl border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] hover:text-[color:var(--pt-accent)] hover:border-[color:var(--pt-line-strong)] shadow-sm transition-all"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Ficha Clínica & Sesiones
        </Button>
      )
    },
  ];

  const periodLabel = startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico total';
  const fieldLabel = 'pt-eyebrow mb-1.5 block';

  return (
    <div className="pt pt-embed w-full">
      {/* Cabecera editorial */}
      <header className="grid gap-8 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="pt-rise" style={{ '--i': 0 } as CSSProperties}>
          <p className="pt-eyebrow">Módulo Customer · Agenda clínica</p>
          <h1 className="mt-4 text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.08]">
            Pacientes y <em style={{ fontStyle: 'italic' }} className="pt-accent-text">citas en curso</em>
          </h1>
          <p className="pt-muted mt-3 text-sm max-w-[62ch]">
            Seguimiento de citas odontológicas, sesiones y flujo de atención clínica en un solo registro.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-rise" style={{ '--i': 1 } as CSSProperties}>
          <Link to="/customer/agent" className="pt-btn pt-btn-primary">
            <Bot className="h-4 w-4" strokeWidth={1.75} />
            Copiloto IA
          </Link>
          <Link to="/customer/operational-reports" className="pt-btn">
            <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
            Formatos F01–F05
          </Link>
          <Link to="/customer/analytics" className="pt-btn">
            <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            Análisis BI
          </Link>
          <Link to="/portal-customer" target="_blank" rel="noreferrer" className="pt-btn">
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            Portal paciente
          </Link>
          <Link to="/reportes?tab=customer" className="pt-btn">
            <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            Reporte
          </Link>
        </div>
      </header>

      {/* Indicadores C1 a C4: franja con línea, sin tarjetas */}
      <dl className="pt-metrics pt-rise" style={{ '--i': 2 } as CSSProperties}>
        {indicators.map((ind) => {
          const dot = ind.status === 'none' ? '' : ind.status === 'amber' ? 'pt-dot-warn' : ind.status === 'red' ? 'pt-dot-danger' : 'pt-dot-ok';
          const statusLabel = ind.status === 'none' ? 'Sin evaluar' : ind.status === 'amber' ? 'En alerta' : ind.status === 'red' ? 'Crítico' : 'Óptimo';
          return (
            <div key={ind.id} className="pt-metric">
              <dt className="flex items-center justify-between gap-2">
                <span className="pt-eyebrow">{ind.id}</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] pt-muted"><span className={`pt-dot ${dot}`} />{statusLabel}</span>
              </dt>
              <dd className="mt-2 min-w-0">
                <span className="pt-display pt-num block text-[2rem] truncate" title={indicatorValue(ind)}>{indicatorValue(ind)}</span>
                <span className="block text-[13px] font-medium mt-1 line-clamp-2" title={ind.name}>{ind.name}</span>
                {ind.baseMeasures?.detailText && <span className="block text-[12px] pt-muted mt-0.5 line-clamp-2">{ind.baseMeasures.detailText}</span>}
                <span className="block text-[11px] pt-muted pt-num mt-2">{periodLabel}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Filtros */}
      <section aria-label="Filtros" className="mt-10 mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--pt-line)]">
          <p className="pt-eyebrow inline-flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Búsqueda y filtros</p>
          <span className="pt-tag pt-tag-accent" aria-live="polite">
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'paciente' : 'pacientes'}
          </span>
        </div>

        <div className="mt-5 flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="cust-search" className={fieldLabel}>Buscar</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--pt-muted)]" />
              <Input
                id="cust-search"
                placeholder="Nombre, DNI, teléfono, servicio, profesional, sede o código"
                className="pt-input !pl-11 !pr-9 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Borrar búsqueda"
                  aria-label="Borrar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--pt-muted)] hover:text-[color:var(--pt-ink)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-[180px]">
            <span className={fieldLabel}>Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="pt-input h-11"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent className="bg-[#fbf9f3] dark:bg-[#151c19] border border-[#d9d2c2] dark:border-[#26312c] text-[#1c2420] dark:text-[#e9e7df] shadow-2xl z-50">
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value={CustomerState.SCHEDULED}>Programado</SelectItem>
                <SelectItem value={CustomerState.ATTENDANCE_CONFIRMED}>Asist. confirmada</SelectItem>
                <SelectItem value={CustomerState.IN_ATTENTION}>En atención</SelectItem>
                <SelectItem value={CustomerState.ATTENDED}>Atendido</SelectItem>
                <SelectItem value={CustomerState.NO_SHOW}>No asistió</SelectItem>
                <SelectItem value={CustomerState.CANCELED}>Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[160px]">
            <span className={fieldLabel}>Etapa</span>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="pt-input h-11"><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent className="bg-[#fbf9f3] dark:bg-[#151c19] border border-[#d9d2c2] dark:border-[#26312c] text-[#1c2420] dark:text-[#e9e7df] shadow-2xl z-50">
                <SelectItem value="ALL">Todas las etapas</SelectItem>
                <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
                <SelectItem value="TURNED">TURNED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <label htmlFor="cust-from" className={fieldLabel}>Desde</label>
            <Input id="cust-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pt-input pt-num h-11" />
          </div>
          <div className="w-full sm:w-[150px]">
            <label htmlFor="cust-to" className={fieldLabel}>Hasta</label>
            <Input id="cust-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pt-input pt-num h-11" />
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={handleResetFilters} title="Restablecer filtros" className="pt-btn shrink-0 h-11">
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} /> Limpiar
            </button>
          )}
        </div>
      </section>

      {/* Tabla */}
      {filteredCustomers.length === 0 ? (
        <div className="pt-empty border border-dashed border-[color:var(--pt-line-strong)] rounded-md">
          <Search className="h-8 w-8 mx-auto pt-muted" strokeWidth={1.25} />
          <p className="pt-display mt-3 text-xl">Sin pacientes que coincidan</p>
          <p className="pt-muted text-sm mt-1">Ajusta o limpia los filtros para ver más registros.</p>
          {hasActiveFilters && (
            <button type="button" onClick={handleResetFilters} className="pt-btn mt-5"><RotateCcw className="h-4 w-4" /> Limpiar filtros</button>
          )}
        </div>
      ) : (
        <div className="pt-table-wrap pt-rise" style={{ '--i': 3 } as CSSProperties}>
          <BaseTable columns={columns} data={filteredCustomers} keyExtractor={(item) => item.id} />
        </div>
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

function indicatorValue(ind: ReturnType<typeof calculateC1>): string {
  if (ind.displayValueOverride) return ind.displayValueOverride;
  if (ind.value === null || ind.value === undefined) return 'N/D';
  if (ind.format === 'percentage') return `${ind.value.toFixed(1)}%`;
  if (ind.format === 'number') return `${ind.value.toFixed(1)} ${ind.unit || ''}`.trim();
  if (ind.format === 'currency') return `S/ ${ind.value.toFixed(2)}`;
  if (ind.format === 'time') return `${ind.value.toFixed(0)} ${ind.unit || 'días'}`;
  return String(ind.value);
}
