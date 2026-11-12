import React from 'react';
import { ReportShell } from './ReportShell';
import { GeneralInfoGrid } from './GeneralInfoGrid';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ReportObservations } from './ReportObservations';
import { ReportTraceabilityStamp } from './ReportTraceabilityStamp';
import { CheckCircle2, XCircle } from 'lucide-react';

interface F05Data {
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
    treatmentSummary: {
      treatmentId: number;
      serviceName: string;
      closingProfessional: string;
      copNumber: string;
      specialty: string;
      branch: string;
      startDate: string;
      closeDate: string;
      totalDaysDuration: number;
      totalSessionsExecuted: number;
      totalSessionsPlanned: number;
    };
  };
  closureChecklist: {
    title: string;
    items: Array<{
      requirement: string;
      isSatisfied: boolean;
      detail: string;
    }>;
  };
  operationalDetail: {
    title: string;
    sessionsSummary: Array<{
      sessionNumber: number;
      date: string;
      professional: string;
      status: string;
      attentionId: number | null;
      proceduresPerformed: string;
      documentationStatus: string;
    }>;
  };
  continuityPlan: {
    title: string;
    dentalPrognosis: string;
    maintenanceFrequency: string;
    recommendedNextVisitDate: string;
    patientSatisfaction: string;
    continuationAction: string;
  };
  traceability: {
    originDatabase: string;
    martFactReference: string;
    documentHash: string;
    certifiedBy: string;
    certificationTimestamp: string;
  };
}

export const F05TreatmentClosureView: React.FC<{ data: F05Data; onPrint?: () => void }> = ({
  data,
  onPrint,
}) => {
  if (!data?.generalInfo?.treatmentSummary) return null;
  const { header, generalInfo, closureChecklist, operationalDetail, continuityPlan, traceability } = data;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const sessionColumns: ColumnDef<typeof operationalDetail.sessionsSummary[0]>[] = [
    {
      header: 'N° Sesión',
      cell: (s) => <span className="font-mono font-bold text-center block">Sesión #{s.sessionNumber}</span>,
      align: 'center',
      className: 'w-24',
    },
    {
      header: 'Fecha de Ejecución',
      cell: (s) => <span className="font-mono text-xs">{formatDate(s.date)}</span>,
    },
    {
      header: 'Especialista',
      cell: (s) => <span className="text-xs font-medium text-[var(--pt-ink)]">{s.professional}</span>,
    },
    {
      header: 'Procedimientos Clínicos Realizados',
      cell: (s) => (
        <span className="text-xs text-[var(--pt-ink)] line-clamp-2 leading-relaxed">
          {s.proceduresPerformed}
        </span>
      ),
    },
    {
      header: 'Cierre Documental',
      cell: (s) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            s.documentationStatus === 'Cerrada'
              ? 'bg-[var(--pt-ok-soft)] text-[var(--pt-ok)]'
              : 'bg-[var(--pt-warn-soft)] text-[var(--pt-warn)]'
          }`}
        >
          {s.documentationStatus}
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
            title: '1. Filiación del Paciente',
            fields: [
              { label: 'Paciente', value: generalInfo.patient.fullName, highlight: true },
              { label: 'Documento de Identidad', value: `${generalInfo.patient.documentType} ${generalInfo.patient.documentNumber}`, isMono: true },
              { label: 'Contacto Telefónico', value: generalInfo.patient.phone, isMono: true },
              { label: 'Correo Electrónico', value: generalInfo.patient.email },
              { label: 'Zona Geográfica', value: generalInfo.patient.zone },
              { label: 'Código Tratamiento', value: `#${generalInfo?.treatmentSummary?.treatmentId ?? '—'}`, isMono: true },
            ],
          },
          {
            title: '2. Resumen del Tratamiento Culminado',
            fields: [
              { label: 'Servicio Clínico Realizado', value: generalInfo.treatmentSummary.serviceName, highlight: true },
              { label: 'Especialista que Autoriza el Cierre', value: generalInfo.treatmentSummary.closingProfessional },
              { label: 'Colegiatura / Especialidad', value: `${generalInfo.treatmentSummary.copNumber} · ${generalInfo.treatmentSummary.specialty}` },
              { label: 'Sede de Ejecución', value: generalInfo.treatmentSummary.branch },
              { label: 'Fecha Inicio → Cierre Definitivo', value: `${formatDate(generalInfo.treatmentSummary.startDate)} → ${formatDate(generalInfo.treatmentSummary.closeDate)}`, isMono: true },
              { label: 'Duración Total del Tratamiento', value: `${generalInfo.treatmentSummary.totalDaysDuration} días calendario (${generalInfo.treatmentSummary.totalSessionsExecuted}/${generalInfo.treatmentSummary.totalSessionsPlanned} sesiones)`, isMono: true, highlight: true },
            ],
          },
        ]}
      />

      {/* ── CHECKLIST DE REQUISITOS DE AUDITORÍA Y CIERRE ── */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--pt-ink)] font-mono border-b border-[var(--pt-line)] pb-1.5">
          {closureChecklist.title}
        </h2>
        <div className="grid gap-2">
          {closureChecklist.items.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                item.isSatisfied
                  ? 'bg-[var(--pt-paper)] border-[var(--pt-line)] text-[var(--pt-ink)]'
                  : 'bg-[var(--pt-warn-soft)]/40 border-[var(--pt-warn)] text-[var(--pt-warn)]'
              }`}
            >
              {item.isSatisfied ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--pt-ok)] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-[var(--pt-warn)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-0.5 text-xs">
                <span className="font-bold block text-[13px]">{item.requirement}</span>
                <p className="text-[var(--pt-muted)]">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TABLA DE DETALLE OPERACIONAL: SESIONES EJECUTADAS ── */}
      <ReportTable
        title={operationalDetail.title}
        subtitle="Evidencia documental de todas las atenciones que fundamentan el cierre formal"
        columns={sessionColumns}
        data={operationalDetail.sessionsSummary}
      />

      {/* ── PLAN DE CONTINUIDAD Y RECOMENDACIONES DE MANTENIMIENTO (TURNED) ── */}
      <ReportObservations
        title="Plan de Continuidad Asistencial y Transición a Fase TURNED"
        metrics={[
          {
            label: 'Cumplimiento Sesiones',
            value: `${generalInfo.treatmentSummary.totalSessionsExecuted} / ${generalInfo.treatmentSummary.totalSessionsPlanned}`,
            badge: '100% Completado',
          },
          {
            label: 'Frecuencia Control',
            value: continuityPlan.maintenanceFrequency,
            hint: 'Control periódico recomendado',
          },
          {
            label: 'Próxima Cita Sugerida',
            value: formatDate(continuityPlan.recommendedNextVisitDate),
            hint: 'Fase TURNED preventiva',
          },
          {
            label: 'Estado Administrativo',
            value: header.status,
            hint: 'Cierre formalizado',
          },
        ]}
        observations={
          <div className="space-y-2 text-xs">
            <div>
              <strong className="text-[var(--pt-ink)] block">Pronóstico Odontológico:</strong>
              <p>{continuityPlan.dentalPrognosis}</p>
            </div>
            <div>
              <strong className="text-[var(--pt-ink)] block">Declaración de Conformidad del Paciente:</strong>
              <p>{continuityPlan.patientSatisfaction}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--pt-accent-soft)] border border-[var(--pt-line-strong)] text-[var(--pt-accent)] font-medium">
              <strong>Acción de Continuidad:</strong> {continuityPlan.continuationAction}
            </div>
          </div>
        }
        notesTitle="Directivas Clínicas para el Programa de Mantenimiento y Fidelización Preventiva"
      />

      {/* ── TRAZABILIDAD Y VALIDACIÓN ── */}
      <ReportTraceabilityStamp
        originDatabase={traceability.originDatabase}
        martFactReference={traceability.martFactReference}
        documentHash={traceability.documentHash}
        verifiedBy={traceability.certifiedBy}
        validationTimestamp={traceability.certificationTimestamp}
        certificationTitle="Certificación y Acta de Cierre Clínico Odontológico Definitivo"
      />
    </ReportShell>
  );
};
