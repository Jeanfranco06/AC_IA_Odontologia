import React from 'react';
import { ReportShell } from './ReportShell';
import { GeneralInfoGrid } from './GeneralInfoGrid';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ReportObservations } from './ReportObservations';
import { ReportTraceabilityStamp } from './ReportTraceabilityStamp';

interface F04Data {
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
    system: {
      agentVersion: string;
      llmModel: string;
      policyGovernance: string;
      autonomousPrescriptionBlocked: string;
      supervisedByRole: string;
    };
    metrics: {
      totalInteractionsRecorded: number;
      totalAlertsIssued: number;
      activeAlertsPending: number;
      attendedAlertsResolved: number;
      totalDraftsGenerated: number;
      approvedDrafts: number;
    };
  };
  operationalDetail: {
    title: string;
    interactions: Array<{
      interactionId: number;
      timestamp: string;
      eventType: string;
      channel: string;
      treatmentRef: string;
      sessionRef: string;
      attentionRef: string;
      supervisor: string;
      humanOverride: string;
      latencyMs: number;
      governanceStatus: string;
    }>;
    alertsSection: {
      title: string;
      alerts: Array<{
        alertId: number;
        eventType: string;
        severity: string;
        message: string;
        status: string;
        assignedTo: string;
        requiresHumanReview: string;
        createdAt: string;
        resolvedAt: string | null;
      }>;
    };
    draftsSection: {
      title: string;
      drafts: Array<{
        draftId: number;
        type: string;
        approvalStatus: string;
        contentSummary: string;
        attendingReviewer: string;
        generatedAt: string;
        reviewedAt: string | null;
      }>;
    };
  };
  summary: {
    complianceScore: string;
    governanceConclusion: string;
    openAlertsNote: string;
  };
  traceability: {
    originDatabase: string;
    martFactReference: string;
    auditHash: string;
    verifiedBy: string;
    validationTimestamp: string;
  };
}

export const F04AiAuditLogView: React.FC<{ data: F04Data; onPrint?: () => void }> = ({
  data,
  onPrint,
}) => {
  const { header, generalInfo, operationalDetail, summary, traceability } = data;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const interactionColumns: ColumnDef<typeof operationalDetail.interactions[0]>[] = [
    {
      header: 'ID',
      cell: (i) => <span className="font-mono font-bold text-center block">#{i.interactionId}</span>,
      align: 'center',
      className: 'w-12',
    },
    {
      header: 'Timestamp',
      cell: (i) => <span className="font-mono text-[11px] text-[var(--pt-muted)]">{formatDate(i.timestamp)}</span>,
    },
    {
      header: 'Evento / Actividad',
      cell: (i) => (
        <div>
          <span className="font-mono text-xs font-semibold text-[var(--pt-ink)] block">{i.eventType}</span>
          <span className="text-[10px] text-[var(--pt-muted)] font-mono">{i.channel}</span>
        </div>
      ),
    },
    {
      header: 'Entidad de Referencia',
      cell: (i) => (
        <span className="text-xs text-[var(--pt-ink)]">
          {i.treatmentRef} · {i.sessionRef}
        </span>
      ),
    },
    {
      header: 'Supervisor Profesional',
      cell: (i) => <span className="text-xs font-medium text-[var(--pt-ink)]">{i.supervisor}</span>,
    },
    {
      header: 'Gobernanza P24',
      cell: (i) => (
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--pt-ok-soft)] text-[var(--pt-ok)] border border-[var(--pt-line-strong)]">
          {i.governanceStatus}
        </span>
      ),
      align: 'center',
    },
  ];

  const alertColumns: ColumnDef<typeof operationalDetail.alertsSection.alerts[0]>[] = [
    {
      header: 'Alerta ID',
      cell: (al) => <span className="font-mono font-bold">#{al.alertId}</span>,
      align: 'center',
      className: 'w-16',
    },
    {
      header: 'Tipo y Severidad',
      cell: (al) => (
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            al.severity === 'Alta' || al.severity === 'CRITICA'
              ? 'bg-[var(--pt-danger-soft)] text-[var(--pt-danger)] border-[var(--pt-danger)]'
              : 'bg-[var(--pt-warn-soft)] text-[var(--pt-warn)] border-[var(--pt-line-strong)]'
          }`}>
            {al.severity}
          </span>
          <span className="font-mono text-xs font-semibold">{al.eventType}</span>
        </div>
      ),
    },
    {
      header: 'Mensaje Descriptivo',
      cell: (al) => <span className="text-xs leading-snug">{al.message}</span>,
    },
    {
      header: 'Estado Asistencial',
      cell: (al) => (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          al.status === 'Atendida' || al.status === 'Descartada'
            ? 'bg-[var(--pt-ok-soft)] text-[var(--pt-ok)]'
            : 'bg-[var(--pt-warn-soft)] text-[var(--pt-warn)]'
        }`}>
          {al.status}
        </span>
      ),
      align: 'center',
    },
    {
      header: 'Asignado / Resolución',
      cell: (al) => (
        <div className="text-[11px]">
          <span className="block font-medium text-[var(--pt-ink)]">{al.assignedTo}</span>
          <span className="text-[10px] text-[var(--pt-muted)] font-mono">{formatDate(al.createdAt)}</span>
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
            title: '1. Arquitectura de Gobernanza del Agente Inteligente',
            fields: [
              { label: 'Versión del Agente Copiloto', value: generalInfo.system.agentVersion, highlight: true },
              { label: 'Modelo de Lenguaje / Motor', value: generalInfo.system.llmModel },
              { label: 'Política Anti-Prescripción', value: generalInfo.system.policyGovernance },
              { label: 'Barrera SQL Server (P24)', value: generalInfo.system.autonomousPrescriptionBlocked, highlight: true },
              { label: 'Rol del Auditor Solicitante', value: generalInfo.system.supervisedByRole, isMono: true },
              { label: 'Ámbito de Trazabilidad', value: 'Interacciones en Ficha, Alertas y Borradores IA' },
            ],
          },
          {
            title: '2. Métricas Consolidadas de Auditoría y Desempeño',
            fields: [
              { label: 'Total de Interacciones en BD', value: `${generalInfo.metrics.totalInteractionsRecorded} eventos auditados`, isMono: true },
              { label: 'Alertas Asistenciales Emitidas', value: `${generalInfo.metrics.totalAlertsIssued} alertas operacionales`, isMono: true },
              { label: 'Alertas Atendidas por Personal', value: `${generalInfo.metrics.attendedAlertsResolved} resueltas conforme`, isMono: true },
              { label: 'Alertas Pendientes Activas', value: `${generalInfo.metrics.activeAlertsPending} pendientes de revisión`, isMono: true, highlight: generalInfo.metrics.activeAlertsPending > 0 },
              { label: 'Borradores Clínicos Emitidos', value: `${generalInfo.metrics.totalDraftsGenerated} fichas / indicaciones`, isMono: true },
              { label: 'Borradores Validados por Doctor', value: `${generalInfo.metrics.approvedDrafts} aprobados formalmente`, isMono: true },
            ],
          },
        ]}
      />

      {/* ── TABLA DE DETALLE: INTERACCIONES DEL COPILOTO ── */}
      <ReportTable
        title={operationalDetail.title}
        subtitle="Muestra cronológica de eventos registrados en InteraccionesIA con barrera anti-prescripción verificada"
        columns={interactionColumns}
        data={operationalDetail.interactions}
      />

      {/* ── TABLA DE DETALLE: ALERTAS DEL SISTEMA ── */}
      <ReportTable
        title={operationalDetail.alertsSection.title}
        subtitle="Registro de alertas asistenciales y documentales de supervisión clínica (AlertasIA)"
        columns={alertColumns}
        data={operationalDetail.alertsSection.alerts}
      />

      {/* ── RESULTADOS Y OBSERVACIONES ── */}
      <ReportObservations
        title="Evaluación de Cumplimiento de Gobernanza y Supervisión"
        metrics={[
          {
            label: 'Score de Cumplimiento',
            value: summary.complianceScore,
            badge: 'Acreditado',
          },
          {
            label: 'Alertas Asistenciales',
            value: `${generalInfo.metrics.attendedAlertsResolved}/${generalInfo.metrics.totalAlertsIssued}`,
            hint: 'Tasa de resolución humana',
          },
          {
            label: 'Borradores Transferidos',
            value: `${generalInfo.metrics.approvedDrafts}`,
            hint: 'Aprobados por especialista',
          },
          {
            label: 'Prescripción Autónoma',
            value: '0',
            hint: 'Bloqueado por CHECK constraint',
          },
        ]}
        observations={
          <div className="space-y-1.5">
            <p><strong>Dictamen de Auditoría:</strong> {summary.governanceConclusion}</p>
            <p className="text-[var(--pt-muted)]">{summary.openAlertsNote}</p>
          </div>
        }
        notesTitle="Conclusiones de la Bitácora de Supervisión del Agente"
      />

      {/* ── TRAZABILIDAD Y VALIDACIÓN ── */}
      <ReportTraceabilityStamp
        originDatabase={traceability.originDatabase}
        martFactReference={traceability.martFactReference}
        documentHash={traceability.auditHash}
        verifiedBy={traceability.verifiedBy}
        validationTimestamp={traceability.validationTimestamp}
        certificationTitle="Certificación de Bitácora y Gobernanza Tecnológica"
      />
    </ReportShell>
  );
};
