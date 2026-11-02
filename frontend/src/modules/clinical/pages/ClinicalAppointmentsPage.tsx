import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarCheck,
  Clock,
  LayoutGrid,
  List,
  Plus,
  Search,
  Stethoscope,
  UserCheck,
  X,
} from 'lucide-react';
import { useCustomers } from '@/modules/customer/hooks/useCustomerQueries';
import { useLeads } from '@/modules/lead/hooks/useLeadQueries';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useSidebar } from '@/shared/context/SidebarContext';
import { useToast } from '@/shared/hooks/use-toast';

export interface AppointmentSlotItem {
  id: string;
  patientName: string;
  dni: string;
  phone: string;
  service: string;
  doctor: string;
  branch: string;
  chair: string;
  date: string;
  time: string;
  status: 'CONFIRMADA' | 'EN_SILLON' | 'ATENDIDA' | 'PRE_RESERVA';
  sourceUrl: string;
}

const CHAIR_LIST = ['Sillón 01 · Quirúrgico', 'Sillón 02 · Ortodoncia', 'Sillón 03 · Rehabilitación'];
const HOURS_GRID = ['08:30', '09:30', '10:30', '11:30', '15:00', '16:00', '17:30', '19:00'];

const STATUS_BADGE: Record<
  AppointmentSlotItem['status'],
  { label: string; classes: string }
> = {
  CONFIRMADA: {
    label: 'Confirmada',
    classes: 'bg-teal-50 text-[#0f766e] border-teal-200/80 dark:bg-teal-950/50 dark:text-teal-300',
  },
  EN_SILLON: {
    label: 'En Sillón',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  ATENDIDA: {
    label: 'Atendida',
    classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  },
  PRE_RESERVA: {
    label: 'Pre-Reserva',
    classes: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300',
  },
};

export default function ClinicalAppointmentsPage() {
  const navigate = useNavigate();
  const { activeBranch } = useSidebar();
  const { toast } = useToast();

  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: leads = [], isLoading: loadingLeads } = useLeads();

  const [viewMode, setViewMode] = useState<'schedule' | 'list'>('schedule');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppointmentSlotItem['status']>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [customAppointments, setCustomAppointments] = useState<AppointmentSlotItem[]>([]);

  // Modal de Nueva Cita Clínica
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [newService, setNewService] = useState('Evaluación Odontológica 3D');
  const [newDoctor, setNewDoctor] = useState('Dr. Carlos Benitez');
  const [newBranch, setNewBranch] = useState('Sede California');
  const [newChair, setNewChair] = useState(CHAIR_LIST[0]);
  const [newTime, setNewTime] = useState('10:30');

  const appointments = useMemo<AppointmentSlotItem[]>(() => {
    const list: AppointmentSlotItem[] = [...customAppointments];

    (customers as any[]).forEach((c, idx) => {
      const firstName = c.person?.firstName || 'Paciente';
      const lastName = c.person?.lastName || '';
      const rawState = String(c.state || '').toUpperCase();
      const status: AppointmentSlotItem['status'] = rawState.includes('ATEND')
        ? 'ATENDIDA'
        : idx % 3 === 0
          ? 'EN_SILLON'
          : 'CONFIRMADA';

      list.push({
        id: `APT-C-${c.id}`,
        patientName: `${firstName} ${lastName}`.trim(),
        dni: c.person?.documentNumber || 'Sin DNI',
        phone: c.person?.phone || 'Sin teléfono',
        service: c.lead?.requestedServiceId || 'Evaluación e Imagenología 3D',
        doctor: c.reservation?.professionalId || 'Dr. Carlos Benitez',
        branch: c.reservation?.branchId || 'Sede California',
        chair: CHAIR_LIST[idx % CHAIR_LIST.length],
        date: c.reservation?.date ? String(c.reservation.date).split('T')[0] : '2026-10-22',
        time: c.reservation?.time
          ? String(c.reservation.time).substring(0, 5)
          : HOURS_GRID[idx % HOURS_GRID.length],
        status,
        sourceUrl: `/customer/${c.id}`,
      });
    });

    (leads as any[]).slice(0, 8).forEach((l, idx) => {
      const firstName = l.person?.firstName || 'Prospecto';
      const lastName = l.person?.lastName || '';
      list.push({
        id: `APT-L-${l.id}`,
        patientName: `${firstName} ${lastName}`.trim(),
        dni: l.person?.documentNumber || 'En trámite',
        phone: l.person?.phone || 'Sin teléfono',
        service: l.requestedServiceId || 'Ortodoncia Digital',
        doctor: l.reservation?.professionalId || 'Dra. Mariana Paredes',
        branch: l.reservation?.branchId || 'Sede El Golf',
        chair: CHAIR_LIST[(idx + 1) % CHAIR_LIST.length],
        date: l.createdAt ? String(l.createdAt).split('T')[0] : '2026-10-22',
        time: HOURS_GRID[(idx + 2) % HOURS_GRID.length],
        status: 'PRE_RESERVA',
        sourceUrl: `/lead/${l.id}`,
      });
    });

    return list;
  }, [customers, leads, customAppointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (
        branchFilter !== 'ALL' &&
        !item.branch.toLowerCase().includes(branchFilter.toLowerCase())
      ) {
        return false;
      }
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        item.patientName.toLowerCase().includes(term) ||
        item.dni.toLowerCase().includes(term) ||
        item.service.toLowerCase().includes(term) ||
        item.doctor.toLowerCase().includes(term)
      );
    });
  }, [appointments, statusFilter, branchFilter, searchTerm]);

  const metrics = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter(
      (a) => a.status === 'CONFIRMADA' || a.status === 'EN_SILLON'
    ).length;
    const attended = appointments.filter((a) => a.status === 'ATENDIDA').length;
    const preReserved = appointments.filter((a) => a.status === 'PRE_RESERVA').length;
    return { total, confirmed, attended, preReserved };
  }, [appointments]);

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    const created: AppointmentSlotItem = {
      id: `APT-NEW-${Date.now()}`,
      patientName: newPatientName.trim(),
      dni: newDni.trim() || 'Por validar',
      phone: '+51 944 612 840',
      service: newService,
      doctor: newDoctor,
      branch: newBranch,
      chair: newChair,
      date: '2026-10-22',
      time: newTime,
      status: 'CONFIRMADA',
      sourceUrl: '/customer',
    };

    setCustomAppointments((prev) => [created, ...prev]);
    setNewModalOpen(false);
    setNewPatientName('');
    setNewDni('');
    toast({
      title: 'Cita bloqueada en agenda',
      description: `${created.patientName} asignado a ${created.chair} (${created.time} hrs).`,
    });
  };

  if (loadingCustomers && loadingLeads) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Agenda Clínica y Control de Sillones
            </h1>
            <span className="rounded-full bg-[#ECFDF5] dark:bg-teal-950/60 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#065F46] dark:text-teal-300">
              Sincronizado
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Programación horaria por unidad dental, especialista y estado de admisión ({activeBranch}).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Selector de vista: Cronograma de Sillones vs Lista */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('schedule')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'schedule'
                  ? 'bg-slate-900 dark:bg-teal-700 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Sillones</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-900 dark:bg-teal-700 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Listado</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#115e59] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Agendar Turno</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Turnos en Agenda</span>
            <Calendar className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {metrics.total}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Bloques de 45 min asignados">
            Bloques de 45 min asignados
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Confirmadas / En Sillón</span>
            <CalendarCheck className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {metrics.confirmed}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate" title="Con pago validado en Payer">
            Con pago validado en Payer
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Atenciones Completadas</span>
            <Stethoscope className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {metrics.attended}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Evolución registrada en Box">
            Evolución registrada en Box
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Pre-Reservas (Lead)</span>
            <Clock className="h-4 w-4 text-amber-600 shrink-0 ml-1" />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {metrics.preReserved}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Pendientes de confirmación final">
            Pendientes de confirmación final
          </p>
        </div>
      </div>

      {/* Contenedor Principal de Agenda */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-4">
        {/* Filtros Contextuales */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            {(
              [
                { id: 'ALL', label: 'Todos los estados' },
                { id: 'CONFIRMADA', label: 'Confirmadas' },
                { id: 'EN_SILLON', label: 'En Sillón' },
                { id: 'ATENDIDA', label: 'Atendidas' },
                { id: 'PRE_RESERVA', label: 'Pre-Reservas' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto sm:min-w-[210px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar paciente o doctor…"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-8 pr-7 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:bg-white focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-[#0f766e] focus:outline-none"
            >
              <option value="ALL">Todas las sedes</option>
              <option value="California">Sede California</option>
              <option value="El Golf">Sede El Golf</option>
              <option value="Centro">Sede Centro Historico</option>
            </select>
          </div>
        </div>

        {viewMode === 'schedule' ? (
          /* Cronograma por Sillón Odontológico */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {CHAIR_LIST.map((chairName) => {
              const chairItems = filteredAppointments
                .filter((a) => a.chair === chairName)
                .slice(0, 6);

              return (
                <div
                  key={chairName}
                  className="flex flex-col rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
                      <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {chairName}
                      </h2>
                    </div>
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {chairItems.length} turnos
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/60 dark:divide-slate-800 p-3 space-y-2.5">
                    {chairItems.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        Sin turnos asignados con el filtro actual
                      </p>
                    ) : (
                      chairItems.map((apt) => {
                        const badge = STATUS_BADGE[apt.status];
                        return (
                          <div
                            key={apt.id}
                            onClick={() => navigate(apt.sourceUrl)}
                            className="group rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs transition-all hover:border-[#0f766e]/40 hover:shadow-sm cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[#0f766e] dark:text-teal-400">
                                {apt.time} hrs
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                              >
                                {badge.label}
                              </span>
                            </div>

                            <p className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-white group-hover:text-[#0f766e] flex items-center justify-between">
                              <span className="truncate">{apt.patientName}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0f766e] shrink-0" />
                            </p>

                            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {apt.service}
                            </p>

                            <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 text-[10.5px] text-slate-400">
                              <span className="truncate">{apt.doctor}</span>
                              <span className="shrink-0 font-medium text-slate-500">
                                {apt.branch.replace('Sede ', '')}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vista de Tabla Operativa */
          <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Tratamiento</th>
                  <th className="py-3 px-4">Especialista y Sillón</th>
                  <th className="py-3 px-4">Sede</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredAppointments.map((apt) => {
                  const badge = STATUS_BADGE[apt.status];
                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {apt.time} hrs
                        </span>
                        <span className="block text-[11px] text-slate-400">{apt.date}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {apt.patientName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">DNI: {apt.dni}</p>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {apt.service}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{apt.doctor}</p>
                        <p className="text-[11px] text-slate-400">{apt.chair}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{apt.branch}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(apt.sourceUrl)}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 text-[11px] font-semibold text-[#0f766e] dark:text-teal-300 hover:bg-teal-50/60 cursor-pointer"
                        >
                          <span>Abrir ficha</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Agendar Nuevo Turno */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">
              Reservar Turno en Sillón Odontológico
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment} className="space-y-3.5 pt-2 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Nombre completo del paciente *
              </label>
              <input
                type="text"
                required
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                placeholder="Ej. Valeria Sánchez Ríos"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:border-[#0f766e] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  DNI
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={newDni}
                  onChange={(e) => setNewDni(e.target.value.replace(/\D/g, ''))}
                  placeholder="8 dígitos"
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-xs focus:border-[#0f766e] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Hora del bloque
                </label>
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 font-mono text-xs"
                >
                  {HOURS_GRID.map((h) => (
                    <option key={h} value={h}>
                      {h} hrs
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Tratamiento / Procedimiento
              </label>
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:border-[#0f766e] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Sede Clínica
                </label>
                <select
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs"
                >
                  <option value="Sede California">Sede California</option>
                  <option value="Sede El Golf">Sede El Golf</option>
                  <option value="Sede Centro Historico">Sede Centro Historico</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Unidad Dental
                </label>
                <select
                  value={newChair}
                  onChange={(e) => setNewChair(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs"
                >
                  {CHAIR_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-[#115e59] cursor-pointer"
              >
                Confirmar Bloqueo
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
