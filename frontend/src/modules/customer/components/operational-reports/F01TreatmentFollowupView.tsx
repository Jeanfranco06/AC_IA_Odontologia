import React from 'react';
import { ReportShell } from './ReportShell';
import { GeneralInfoGrid } from './GeneralInfoGrid';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ReportObservations } from './ReportObservations';
import { ReportTraceabilityStamp } from './ReportTraceabilityStamp';

interface F01Data {
  header: {
    clinicName: string;
    formatCode: string;
    formatName: string;
    documentId: string;
    issueDate: string;
    status: string;
    scope: string;
  };
  generalInfo: {
    patient: {
      fullName: string;
      documentType: string;
      documentNumber: string;
      phone: string;
      email: string;
      zone: string;
    };
    treatment: {
      treatmentId: number;
      serviceName: string;
      serviceDescription: string;
      responsibleProfessional: string;
      copNumber: string;
      specialty: string;
      branch: string;
      agreedPrice: string;
      contractDate: string;
      activationDate: string | null;
      realStartDate: string | null;
      realCloseDate: string | null;
      suspensionReason: string | null;
    };
    plan: {
      planId: number | null;
      version: number;
      plannedSessions: number;
      estimatedDurationMin: number;
      clinicalObjectives: string;
      approvalDate: string | null;
      planStatus: string;
    };
  };
  operationalDetail: {
    title: string;
    sessions: Array<{
      sessionNumber: number;
      sessionId: number;
      scheduledDate: string;
      durationMin: number;
      professional: string;
      branch: string;
      programmingStatus: string;
      assistanceStatus: string;
      closureStatus: string;
      patientConfirmation: string;
      attentionId: number | null;
      attentionServiceState: string;
      documentClosureState: string;
    }>;
  };
  summary: {
    totalPlannedSessions: number;
    completedSessions: number;
    pendingSessions: number;
    progressPercent: number;
    isCompleted: boolean;
    clinicalObservations: string;
  };
  traceability: {
    originDatabase: string;
    martFactReference: string;
    documentHash: string;
    verifiedBy: string;
    validationTimestamp: string;
  };
}

export const F01TreatmentFollowupView: React.FC<{ data: F01Data; onPrint?: () => void }> = ({
  data,
  onPrint,
}) => {
  const { header, generalInfo, operationalDetail, summary, traceability } = data;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const columns: ColumnDef<typeof operationalDetail.sessions[0]>[] = [
    {
      header: 'N°',
      cell: (s) => <span className="font-mono font-bold">{s.sessionNumber}</span>,
      align: 'center',
      className: 'w-12',
    },
    {
      header: 'Fecha Programada',
      cell: (s) => (
        <div className="font-mono">
          <span>{formatDate(s.scheduledDate)}</span>
          <span className="text-[10px] text-[var(--pt-muted)] block">
            {new Date(s.scheduledDate).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Duración',
      cell: (s) => <span className="font-mono">{s.durationMin} min</span>,
      align: 'center',
    },
    {
      header: 'Especialista / Sede',
      cell: (s) => (
        <div>
          <span className="font-medium text-[var(--pt-ink)] block">{s.professional}</span>
          <span className="text-[10px] text-[var(--pt-muted)]">{s.branch}</span>
        </div>
      ),
    },
    {
      header: 'Asistencia',
      cell: (s) => {
        const isAttended = s.assistanceStatus === 'Realizada' || s.assistanceStatus === 'Asistió';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isAttended
                ? 'bg-[var(--pt-ok-soft)] text-[var(--pt-ok)]'
                : 'bg-[var(--pt-sunken)] text-[var(--pt-muted)]'
            }`}
          >
            {s.assistanceStatus}
          </span>
        );
      },
      align: 'center',
    },
    {
      header: 'Cierre Documental',
      cell: (s) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            s.closureStatus === 'Cerrada'
              ? 'bg-[var(--pt-accent-soft)] text-[var(--pt-accent)]'
              : 'bg-[var(--pt-warn-soft)] text-[var(--pt-warn)]'
          }`}
        >
          {s.closureStatus}
        </span>
      ),
      align: 'center',
    },
    {
      header: 'Atención ID',
      cell: (s) => (
        <span className="font-mono text-[11px] text-[var(--pt-muted)]">
          {s.attentionId ? `#${s.attentionId}` : '—'}
        </span>
      ),
      align: 'center',
    },
  ];

  return (
    <ReportShell
      formatCode={header.formatCode}
      formatName={header.formatName}
      documentId={header.documentId}
      issueDate={header.issueDate}
      status={header.status}
      scope={header.scope}
      onPrint={onPrint}
    >
      {/* ── DATOS GENERALES EN VARIAS FILAS ── */}
      <GeneralInfoGrid
        sections={[
          {
            title: '1. Identificación del Paciente y Filiación',
            fields: [
              { label: 'Paciente', value: generalInfo.patient.fullName, highlight: true },
              { label: 'Documento de Identidad', value: `${generalInfo.patient.documentType} ${generalInfo.patient.documentNumber}`, isMono: true },
              { label: 'Teléfono Móvil', value: generalInfo.patient.phone, isMono: true },
              { label: 'Correo Electrónico', value: generalInfo.patient.email },
              { label: 'Zona Geográfica', value: generalInfo.patient.zone },
              { label: 'Código Tratamiento', value: `#${generalInfo.treatment.treatmentId}`, isMono: true },
            ],
          },
          {
            title: '2. Servicio Clínico y Asignación Profesional',
            fields: [
              { label: 'Servicio Contratado', value: generalInfo.treatment.serviceName, highlight: true },
              { label: 'Especialista Responsable', value: generalInfo.treatment.responsibleProfessional },
              { label: 'Colegiatura / Especialidad', value: `${generalInfo.treatment.copNumber} · ${generalInfo.treatment.specialty}` },
              { label: 'Sede de Atención', value: generalInfo.treatment.branch },
              { label: 'Precio Pactado', value: `S/. ${generalInfo.treatment.agreedPrice}`, isMono: true },
              { label: 'Fecha de Contratación', value: formatDate(generalInfo.treatment.contractDate), isMono: true },
            ],
          },
          {
            title: '3. Plan de Tratamiento y Fechas Operacionales',
            fields: [
              { label: 'Versión del Plan', value: `Plan v${generalInfo.plan.version} (${generalInfo.plan.planStatus})`, isMono: true },
              { label: 'Sesiones Planificadas', value: `${generalInfo.plan.plannedSessions} sesiones estándar`, isMono: true },
              { label: 'Duración Estimada Cita', value: `${generalInfo.plan.estimatedDurationMin} minutos por sesión`, isMono: true },
              { label: 'Fecha Inicio Real', value: formatDate(generalInfo.treatment.realStartDate), isMono: true },
              { label: 'Fecha Cierre Real', value: formatDate(generalInfo.treatment.realCloseDate), isMono: true },
              { label: 'Objetivos Clínicos', value: generalInfo.plan.clinicalObjectives },
            ],
          },
        ]}
      />

      {/* ── TABLA DE DETALLE OPERACIONAL ── */}
      <ReportTable
        title={operationalDetail.title}
        subtitle={`Total de ${operationalDetail.sessions.length} sesiones registradas en agenda clínica`}
        columns={columns}
        data={operationalDetail.sessions}
      />

      {/* ── RESULTADOS Y OBSERVACIONES ── */}
      <ReportObservations
        title="Resultados de Cumplimiento y Observaciones Clínicas"
        metrics={[
          {
            label: 'Avance del Tratamiento',
            value: `${summary.progressPercent}%`,
            badge: summary.isCompleted ? 'Completado' : 'En Curso',
          },
          {
            label: 'Sesiones Realizadas',
            value: `${summary.completedSessions} / ${summary.totalPlannedSessions}`,
            hint: 'Sesiones asistidas y cerradas',
          },
          {
            label: 'Sesiones Pendientes',
            value: `${summary.pendingSessions}`,
            hint: 'Por ejecutar en cronograma',
          },
          {
            label: 'Estado del Tratamiento',
            value: header.status,
            hint: summary.isCompleted ? 'Tratamiento culminado conforme' : 'Seguimiento activo',
          },
        ]}
        observations={summary.clinicalObservations}
        notesTitle="Observaciones de Dirección Médica y Seguimiento"
      />

      {/* ── TRAZABILIDAD Y VALIDACIÓN ── */}
      <ReportTraceabilityStamp
        originDatabase={traceability.originDatabase}
        martFactReference={traceability.martFactReference}
        documentHash={traceability.documentHash}
        verifiedBy={traceability.verifiedBy}
        validationTimestamp={traceability.validationTimestamp}
      />
    </ReportShell>
  );
};
