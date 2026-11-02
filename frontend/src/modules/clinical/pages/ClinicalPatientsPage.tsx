import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useBuyers } from '@/modules/buyer/hooks/useBuyerQueries';
import { useLeads } from '@/modules/lead/hooks/useLeadQueries';
import { usePayers } from '@/modules/payer/hooks/usePayerQueries';
import { useCustomers } from '@/modules/customer/hooks/useCustomerQueries';
import { useTurnedList } from '@/modules/turned/hooks/useTurnedQueries';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useSidebar } from '@/shared/context/SidebarContext';

export interface UnifiedPatientRecord {
  id: string;
  personId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
  email: string;
  currentStage: 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER' | 'TURNED';
  stageLabel: string;
  statusLabel: string;
  serviceName: string;
  branchName: string;
  professionalName: string;
  lastDate: string;
  detailUrl: string;
  customerId?: string;
}

const STAGE_STYLE: Record<
  UnifiedPatientRecord['currentStage'],
  { badgeBg: string; badgeText: string; dot: string; order: number }
> = {
  TURNED: {
    badgeBg: 'bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/50 dark:border-emerald-800/60',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    order: 5,
  },
  CUSTOMER: {
    badgeBg: 'bg-teal-50 border-teal-200/80 dark:bg-teal-950/50 dark:border-teal-800/60',
    badgeText: 'text-[#0f766e] dark:text-teal-300',
    dot: 'bg-[#0f766e]',
    order: 4,
  },
  PAYER: {
    badgeBg: 'bg-sky-50 border-sky-200/80 dark:bg-sky-950/50 dark:border-sky-800/60',
    badgeText: 'text-sky-800 dark:text-sky-300',
    dot: 'bg-sky-500',
    order: 3,
  },
  LEAD: {
    badgeBg: 'bg-amber-50 border-amber-200/80 dark:bg-amber-950/50 dark:border-amber-800/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    order: 2,
  },
  BUYER: {
    badgeBg: 'bg-slate-100 border-slate-200/80 dark:bg-slate-800 dark:border-slate-700',
    badgeText: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
    order: 1,
  },
};

export default function ClinicalPatientsPage() {
  const navigate = useNavigate();
  const { activeBranch } = useSidebar();

  const { data: buyers = [], isLoading: loadingBuyers } = useBuyers();
  const { data: leads = [], isLoading: loadingLeads } = useLeads();
  const { data: payers = [], isLoading: loadingPayers } = usePayers();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: turnedList = [], isLoading: loadingTurned } = useTurnedList();

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | UnifiedPatientRecord['currentStage']>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [selectedPatient, setSelectedPatient] = useState<UnifiedPatientRecord | null>(null);

  const isLoading =
    loadingBuyers && loadingLeads && loadingPayers && loadingCustomers && loadingTurned;

  // Consolida el directorio único de pacientes priorizando la etapa más avanzada alcanzada
  const unifiedPatients = useMemo<UnifiedPatientRecord[]>(() => {
    const map = new Map<string, UnifiedPatientRecord>();

    const upsert = (rec: UnifiedPatientRecord) => {
      const key =
        rec.dni && rec.dni !== 'Sin DNI'
          ? `dni:${rec.dni}`
          : rec.phone && rec.phone !== 'Sin teléfono'
            ? `phone:${rec.phone}`
            : `name:${rec.fullName.toLowerCase()}`;

      const existing = map.get(key);
      if (!existing || STAGE_STYLE[rec.currentStage].order >= STAGE_STYLE[existing.currentStage].order) {
        map.set(key, {
          ...existing,
          ...rec,
          customerId: rec.customerId || existing?.customerId,
        });
      }
    };

    for (const b of buyers as any[]) {
      const firstName = b.person?.firstName || 'Paciente';
      const lastName = b.person?.lastName || '';
      upsert({
        id: `B-${b.id}`,
        personId: String(b.person?.id || b.id),
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dni: b.person?.documentNumber || 'Sin DNI',
        phone: b.person?.phone || 'Sin teléfono',
        email: b.person?.email || 'No registrado',
        currentStage: 'BUYER',
        stageLabel: 'Prospecto (Buyer)',
        statusLabel: String(b.state || 'Nuevo'),
        serviceName: b.serviceOfInterest || b.serviceOfInterestId || 'Evaluación Odontológica',
        branchName: b.preferredBranch || 'Sede California',
        professionalName: 'Admisión Clínica',
        lastDate: b.createdAt ? String(b.createdAt).split('T')[0] : '2026-10-15',
        detailUrl: `/buyer/${b.id}`,
      });
    }

    for (const l of leads as any[]) {
      const firstName = l.person?.firstName || 'Paciente';
      const lastName = l.person?.lastName || '';
      upsert({
        id: `L-${l.id}`,
        personId: String(l.person?.id || l.id),
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dni: l.person?.documentNumber || 'Sin DNI',
        phone: l.person?.phone || 'Sin teléfono',
        email: l.person?.email || 'No registrado',
        currentStage: 'LEAD',
        stageLabel: 'En Negociación (Lead)',
        statusLabel: String(l.state || 'En negociación'),
        serviceName: l.requestedServiceId || 'Evaluación Integral',
        branchName: l.reservation?.branchId || 'Sede California',
        professionalName: l.reservation?.professionalId || 'Mesa de Admisión',
        lastDate: l.createdAt ? String(l.createdAt).split('T')[0] : '2026-10-16',
        detailUrl: `/lead/${l.id}`,
      });
    }

    for (const p of payers as any[]) {
      const firstName = p.person?.firstName || 'Paciente';
      const lastName = p.person?.lastName || '';
      upsert({
        id: `P-${p.id}`,
        personId: String(p.person?.id || p.id),
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dni: p.person?.documentNumber || 'Sin DNI',
        phone: p.person?.phone || 'Sin teléfono',
        email: p.person?.email || 'No registrado',
        currentStage: 'PAYER',
        stageLabel: 'Validación de Pago (Payer)',
        statusLabel: String(p.state || 'Pendiente'),
        serviceName: p.lead?.requestedServiceId || 'Tratamiento Programado',
        branchName: p.reservation?.branchId || 'Sede California',
        professionalName: p.reservation?.professionalId || 'Caja Clínica',
        lastDate: p.createdAt ? String(p.createdAt).split('T')[0] : '2026-10-18',
        detailUrl: `/payer/${p.id}`,
      });
    }

    for (const c of customers as any[]) {
      const firstName = c.person?.firstName || 'Paciente';
      const lastName = c.person?.lastName || '';
      upsert({
        id: `C-${c.id}`,
        personId: String(c.person?.id || c.id),
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dni: c.person?.documentNumber || 'Sin DNI',
        phone: c.person?.phone || 'Sin teléfono',
        email: c.person?.email || 'No registrado',
        currentStage: 'CUSTOMER',
        stageLabel: 'En Tratamiento (Customer)',
        statusLabel: String(c.state || 'Atendido'),
        serviceName: c.lead?.requestedServiceId || 'Atención Clínica',
        branchName: c.reservation?.branchId || 'Sede California',
        professionalName: c.reservation?.professionalId || 'Dr. Especialista',
        lastDate: c.reservation?.date ? String(c.reservation.date).split('T')[0] : '2026-10-20',
        detailUrl: `/customer/${c.id}`,
        customerId: String(c.id),
      });
    }

    for (const t of turnedList as any[]) {
      const firstName = t.person?.firstName || 'Paciente';
      const lastName = t.person?.lastName || '';
      upsert({
        id: `T-${t.id}`,
        personId: String(t.person?.id || t.id),
        fullName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        dni: t.person?.documentNumber || 'Sin DNI',
        phone: t.person?.phone || 'Sin teléfono',
        email: t.person?.email || 'No registrado',
        currentStage: 'TURNED',
        stageLabel: 'Fidelizado (Turned)',
        statusLabel: String(t.state || 'Fidelizado'),
        serviceName: t.lead?.requestedServiceId || 'Control y Mantenimiento',
        branchName: t.reservation?.branchId || 'Sede California',
        professionalName: t.reservation?.professionalId || 'Dr. Especialista',
        lastDate: t.createdAt ? String(t.createdAt).split('T')[0] : '2026-10-21',
        detailUrl: `/turned/${t.id}`,
        customerId: t.customerId ? String(t.customerId) : undefined,
      });
    }

    return Array.from(map.values()).sort(
      (a, b) => STAGE_STYLE[b.currentStage].order - STAGE_STYLE[a.currentStage].order
    );
  }, [buyers, leads, payers, customers, turnedList]);

  const filteredPatients = useMemo(() => {
    return unifiedPatients.filter((p) => {
      if (stageFilter !== 'ALL' && p.currentStage !== stageFilter) return false;
      if (
        branchFilter !== 'ALL' &&
        !p.branchName.toLowerCase().includes(branchFilter.toLowerCase().replace('sede ', ''))
      ) {
        return false;
      }
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        p.fullName.toLowerCase().includes(term) ||
        p.dni.toLowerCase().includes(term) ||
        p.phone.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.serviceName.toLowerCase().includes(term) ||
        p.professionalName.toLowerCase().includes(term)
      );
    });
  }, [unifiedPatients, stageFilter, branchFilter, searchTerm]);

  const kpis = useMemo(() => {
    const total = unifiedPatients.length;
    const activeClinical = unifiedPatients.filter(
      (p) => p.currentStage === 'CUSTOMER' || p.currentStage === 'TURNED'
    ).length;
    const turnedCount = unifiedPatients.filter((p) => p.currentStage === 'TURNED').length;
    const inAdmission = unifiedPatients.filter(
      (p) => p.currentStage === 'BUYER' || p.currentStage === 'LEAD' || p.currentStage === 'PAYER'
    ).length;
    return { total, activeClinical, turnedCount, inAdmission };
  }, [unifiedPatients]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Directorio Maestro de Pacientes
            </h1>
            <span className="rounded-full bg-[#ECFDF5] dark:bg-teal-950/60 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#065F46] dark:text-teal-300">
              {unifiedPatients.length} expedientes
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Vista unificada 360° de historias clínicas, tratamientos en curso y trazabilidad del embudo ({activeBranch}).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/clinica/odontogramas"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ScanLine className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
            <span>Abrir Odontogramas</span>
          </Link>
          <Link
            to="/clinica/citas"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#115e59]"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Ver Agenda Clínica</span>
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards Enterprise */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Padrón Clínico Total</span>
            <Users className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" strokeWidth={1.75} />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {kpis.total}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Pacientes únicos deduplicados por DNI/WhatsApp">
            Pacientes únicos deduplicados por DNI/WhatsApp
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Con Historia Clínica Activa</span>
            <Stethoscope className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" strokeWidth={1.75} />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {kpis.activeClinical}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate" title="Atendidos en sillón (Customer & Turned)">
            Atendidos en sillón (Customer &amp; Turned)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">Pacientes Fidelizados</span>
            <CheckCircle2 className="h-4 w-4 text-[#0f766e] shrink-0 ml-1" strokeWidth={1.75} />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {kpis.turnedCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Con alta clínica y controles recurrentes">
            Con alta clínica y controles recurrentes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 min-w-0">
            <span className="truncate">En Flujo de Admisión</span>
            <Activity className="h-4 w-4 text-amber-600 shrink-0 ml-1" strokeWidth={1.75} />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">
            {kpis.inAdmission}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate" title="Etapas previas (Buyer, Lead y Payer)">
            Etapas previas (Buyer, Lead y Payer)
          </p>
        </div>
      </div>

      {/* Barra de Herramientas y Filtros */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          {/* Segmented Control de Etapa */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'CUSTOMER', label: 'En Tratamiento' },
                { id: 'TURNED', label: 'Fidelizados' },
                { id: 'PAYER', label: 'Por Validar Pago' },
                { id: 'LEAD', label: 'En Negociación' },
                { id: 'BUYER', label: 'Prospectos' },
              ] as const
            ).map((tab) => {
              const active = stageFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStageFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Buscador + Selector de Sede */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64 sm:min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, DNI, teléfono o doctor…"
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 pl-8 pr-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:bg-white focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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

            {(searchTerm || stageFilter !== 'ALL' || branchFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStageFilter('ALL');
                  setBranchFilter('ALL');
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabla Enterprise de Expedientes */}
        <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-4">Documento / Contacto</th>
                <th className="py-3 px-4">Etapa Clínica</th>
                <th className="py-3 px-4">Tratamiento / Especialidad</th>
                <th className="py-3 px-4">Sede y Responsable</th>
                <th className="py-3 px-4 text-right">Última Actividad</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No se encontraron expedientes clínicos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const style = STAGE_STYLE[patient.currentStage];
                  return (
                    <tr
                      key={patient.id}
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(patient)}
                          className="text-left font-semibold text-slate-900 dark:text-white group-hover:text-[#0f766e] dark:group-hover:text-teal-400 cursor-pointer"
                        >
                          {patient.fullName}
                        </button>
                        <p className="font-mono text-[10.5px] text-slate-400">
                          Exp. #{patient.personId}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          DNI: {patient.dni}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">{patient.phone}</p>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${style.badgeBg} ${style.badgeText}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {patient.stageLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {patient.serviceName}
                        </p>
                        <p className="text-[11px] text-slate-400">Estado: {patient.statusLabel}</p>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {patient.branchName}
                        </p>
                        <p className="text-[11px] text-slate-500">{patient.professionalName}</p>
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {patient.lastDate}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPatient(patient)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                          >
                            <FileText className="h-3 w-3 text-[#0f766e]" />
                            <span>Ficha 360°</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/clinica/odontogramas?patientName=${encodeURIComponent(
                                  patient.fullName
                                )}`
                              )
                            }
                            title="Abrir Odontograma Digital"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-teal-50/80 dark:bg-teal-950/50 px-2 text-[11px] font-semibold text-[#0f766e] dark:text-teal-300 hover:bg-teal-100/80 cursor-pointer"
                          >
                            <ScanLine className="h-3 w-3" />
                            <span>Odontograma</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Ficha Integral 360° del Paciente */}
      <Dialog open={Boolean(selectedPatient)} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
          {selectedPatient && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0f766e]" />
                    Expediente Clínico Unificado #{selectedPatient.personId}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {selectedPatient.lastDate}
                  </span>
                </div>
                <DialogTitle className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedPatient.fullName}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-3 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3.5">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Documento (DNI)</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {selectedPatient.dni}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">WhatsApp / Teléfono</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-[#0f766e]" />
                      {selectedPatient.phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Correo electrónico</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 truncate max-w-full">
                      <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedPatient.email}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Sede asignada</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-[#0f766e]" />
                      {selectedPatient.branchName}
                    </span>
                  </div>
                </div>

                {/* Línea de progreso del paciente en las 5 etapas */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Trazabilidad en el Embudo Clínico
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['BUYER', 'LEAD', 'PAYER', 'CUSTOMER', 'TURNED'] as const).map((st) => {
                      const reached =
                        STAGE_STYLE[selectedPatient.currentStage].order >= STAGE_STYLE[st].order;
                      const isCurrent = selectedPatient.currentStage === st;
                      return (
                        <div
                          key={st}
                          className={`rounded-lg border p-2 text-center ${
                            isCurrent
                              ? 'border-[#0f766e] bg-[#ECFDF5] text-[#065F46] font-semibold'
                              : reached
                                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                                : 'border-slate-200/70 bg-slate-50 text-slate-400'
                          }`}
                        >
                          <span className="block font-mono text-[10px]">{st}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tratamiento principal</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedPatient.serviceName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Responsable / Doctor</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedPatient.professionalName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Estado operativo</span>
                    <span className="font-mono font-semibold text-[#0f766e]">
                      {selectedPatient.statusLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const name = selectedPatient.fullName;
                      setSelectedPatient(null);
                      navigate(`/clinica/odontogramas?patientName=${encodeURIComponent(name)}`);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0f766e]/30 bg-[#ECFDF5] px-3.5 text-xs font-semibold text-[#065F46] hover:bg-emerald-100/80 cursor-pointer"
                  >
                    <ScanLine className="h-3.5 w-3.5 text-[#0f766e]" />
                    <span>Ver Odontograma 3D</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = selectedPatient.detailUrl;
                      setSelectedPatient(null);
                      navigate(url);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-[#115e59] cursor-pointer"
                  >
                    <span>Ir a su etapa ({selectedPatient.currentStage})</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
