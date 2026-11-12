import React from 'react';
import { ReportShell } from './ReportShell';
import { GeneralInfoGrid } from './GeneralInfoGrid';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ReportObservations } from './ReportObservations';
import { ReportTraceabilityStamp } from './ReportTraceabilityStamp';

interface F02Data {
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
    };
    sessionInfo: {
      sessionId: number;
      treatmentId: number;
      sessionNumber: number;
      serviceName: string;
      responsibleProfessional: string;
      copNumber: string;
      specialty: string;
      branch: string;
      scheduledDate: string;
      durationMin: number;
      programmingStatus: string;
      assistanceStatus: string;
      closureStatus: string;
    };
    timestamps: {
      patientConfirmation: string;
      confirmationDate: string | null;
      arrivalTime: string | null;
      attentionStartTime: string | null;
      sessionCloseTime: string | null;
      noShowReason: string | null;
    };
  };
  operationalDetail: {
    title: string;
    events: Array<{
      eventId: number;
      changeType: string;
      previousDate: string;
      newDate: string;
      previousState: string;
      newState: string;
      reason: string;
      registeredBy: string;
      operationDate: string;
    }>;
  };
  reschedulingRequests: Array<{
    requestId: number;
    status: string;
    originalDate: string;
    preferredDate: string | null;
    reason: string | null;
    resolutionReason: string | null;
    createdAt: string;
  }>;
  linkedAttention: {
    attentionId: number;
    serviceState: string;
    assistance: string;
    diagnosis: string | null;
    procedure: string | null;
    documentClosure: string;
    proceduresRecorded: number;
    isValidated: boolean;
  } | null;
  summary: {
    onTimeArrival: string;
    effectiveSillónMinutes: number;
    operationalObservations: string;
  };
  traceability: {
    originDatabase: string;
    martFactReference: string;
    documentHash: string;
    verifiedBy: string;
    validationTimestamp: string;
  };
}

export const F02SessionScheduleView: React.FC<{ data: F02Data; onPrint?: () => void }> = ({
  data,
  onPrint,
}) => {
  const { header, generalInfo, operationalDetail, reschedulingRequests, linkedAttention, summary, traceability } = data;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr === '—') return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const eventColumns: ColumnDef<typeof operationalDetail.events[0]>[] = [
    {
      header: 'ID',
      cell: (e) => <span className="font-mono font-bold">#{e.eventId}</span>,
      align: 'center',
      className: 'w-12',
    },
    {
      header: 'Tipo de Evento',
      cell: (e) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--pt-sunken)] border border-[var(--pt-line)]">
          {e.changeType}
        </span>
      ),
    },
    {
      header: 'Fecha Previa → Nueva',
      cell: (e) => (
        <div className="font-mono text-[11px]">
          <span className="text-[var(--pt-muted)]">{formatDate(e.previousDate)}</span>
          {e.newDate !== '—' && (
            <span className="text-[var(--pt-accent)] block font-semibold">→ {formatDate(e.newDate)}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Estado Previo → Posterior',
      cell: (e) => (
        <span className="text-xs">
          <span className="text-[var(--pt-muted)]">{e.previousState}</span>
          <span className="font-semibold text-[var(--pt-ink)]"> → {e.newState}</span>
        </span>
      ),
    },
    {
      header: 'Motivo y Justificación',
      cell: (e) => <span className="text-xs text-[var(--pt-ink)] leading-snug">{e.reason}</span>,
    },
    {
      header: 'Registrado Por',
      cell: (e) => (
        <div className="text-[11px]">
          <span className="font-medium text-[var(--pt-ink)] block">{e.registeredBy}</span>
          <span className="text-[10px] text-[var(--pt-muted)] font-mono">{formatDate(e.operationDate)}</span>
        </div>
      ),
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
            title: '1. Filiación del Paciente y Cita Agendada',
            fields: [
              { label: 'Paciente', value: generalInfo.patient.fullName, highlight: true },
              { label: 'Documento', value: `${generalInfo.patient.documentType} ${generalInfo.patient.documentNumber}`, isMono: true },
              { label: 'Teléfono Móvil', value: generalInfo.patient.phone, isMono: true },
              { label: 'Correo', value: generalInfo.patient.email },
              { label: 'Tratamiento Origen', value: `#${generalInfo.sessionInfo.treatmentId} · ${generalInfo.sessionInfo.serviceName}`, isMono: true },
              { label: 'Ordinal de Sesión', value: `Sesión N° ${generalInfo.sessionInfo.sessionNumber}`, highlight: true, isMono: true },
            ],
          },
          {
            title: '2. Asignación Profesional, Sede y Horarios de Agenda',
            fields: [
              { label: 'Especialista a Cargo', value: generalInfo.sessionInfo.responsibleProfessional },
              { label: 'Colegiatura / Especialidad', value: `${generalInfo.sessionInfo.copNumber} · ${generalInfo.sessionInfo.specialty}` },
              { label: 'Sede Clínica y Box', value: `${generalInfo.sessionInfo.branch} (Box Asistencial)` },
              { label: 'Fecha y Hora Programada', value: formatDate(generalInfo.sessionInfo.scheduledDate), isMono: true, highlight: true },
              { label: 'Duración Estimada', value: `${generalInfo.sessionInfo.durationMin} minutos de sillón`, isMono: true },
              { label: 'Estado Programación', value: `${generalInfo.sessionInfo.programmingStatus} · ${generalInfo.sessionInfo.assistanceStatus}` },
            ],
          },
          {
            title: '3. Hitos de Asistencia y Trazabilidad de Box',
            fields: [
              { label: 'Confirmación del Paciente', value: `${generalInfo.timestamps.patientConfirmation} (${formatDate(generalInfo.timestamps.confirmationDate)})` },
              { label: 'Hora Arribo a Sala de Espera', value: formatDate(generalInfo.timestamps.arrivalTime), isMono: true },
              { label: 'Hora Entrada a Sillón Dental', value: formatDate(generalInfo.timestamps.attentionStartTime), isMono: true },
              { label: 'Hora Cierre de Sesión', value: formatDate(generalInfo.timestamps.sessionCloseTime), isMono: true },
              { label: 'Cierre Asistencial', value: generalInfo.sessionInfo.closureStatus },
              { label: 'Atención Asociada', value: linkedAttention ? `#${linkedAttention.attentionId} (${linkedAttention.serviceState})` : 'Sin atención abierta', isMono: true },
            ],
          },
        ]}
      />

      {/* ── TABLA DE DETALLE OPERACIONAL: EVENTOS DE SESIÓN ── */}
      <ReportTable
        title={operationalDetail.title}
        subtitle="Registro inmutable de trazabilidad de cambios de agenda (EventosSesion)"
        columns={eventColumns}
        data={operationalDetail.events}
      />

      {/* ── SOLICITUDES DE REPROGRAMACIÓN ASOCIADAS (SI EXISTEN) ── */}
      {reschedulingRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--pt-ink)] font-mono border-b border-[var(--pt-line)] pb-1.5">
            Solicitudes de Reprogramación Asociadas a la Sesión (SolicitudesReprogramacionCustomer)
          </h2>
          <div className="grid gap-2">
            {reschedulingRequests.map((r) => (
              <div key={r.requestId} className="rounded-xl border border-[var(--pt-line)] bg-[var(--pt-paper)] p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[var(--pt-ink)]">Solicitud #{r.requestId} · {r.status}</span>
                  <span className="font-mono text-[var(--pt-muted)] text-[11px]">{formatDate(r.createdAt)}</span>
                </div>
                <p className="text-[var(--pt-ink)]"><strong>Motivo del paciente:</strong> {r.reason || 'Sin motivo especificado'}</p>
                {r.resolutionReason && (
                  <p className="text-[var(--pt-muted)]"><strong>Dictamen administrativo:</strong> {r.resolutionReason}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── RESULTADOS Y OBSERVACIONES ── */}
      <ReportObservations
        title="Resultados de Ejecución y Tiempos en Box"
        metrics={[
          {
            label: 'Puntualidad de Ingreso',
            value: generalInfo.timestamps.arrivalTime ? 'En Sala' : 'Pendiente',
            hint: summary.onTimeArrival,
          },
          {
            label: 'Tiempo en Sillón Dental',
            value: `${summary.effectiveSillónMinutes} min`,
            hint: 'Duración efectiva de atención',
          },
          {
            label: 'Procedimientos en Ficha',
            value: linkedAttention ? `${linkedAttention.proceduresRecorded} items` : '0',
            hint: linkedAttention?.documentClosure === 'Cerrada' ? 'Ficha cerrada' : 'Sin cierre formal',
          },
          {
            label: 'Estado Final Sesión',
            value: generalInfo.sessionInfo.assistanceStatus,
            badge: generalInfo.sessionInfo.closureStatus,
          },
        ]}
        observations={summary.operationalObservations}
        notesTitle="Observaciones Operacionales de Recepción y Box"
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
