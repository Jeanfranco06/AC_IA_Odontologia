import React from 'react';
import { ReportShell } from './ReportShell';
import { GeneralInfoGrid } from './GeneralInfoGrid';
import { ReportTable, type ColumnDef } from './ReportTable';
import { ReportObservations } from './ReportObservations';
import { ReportTraceabilityStamp } from './ReportTraceabilityStamp';

interface F03Data {
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
      allergies: string;
      antecedents: string;
      painLevel: number;
      sensitivity: string;
    };
    consultation: {
      attentionId: number;
      treatmentId: number | null;
      sessionId: number | null;
      serviceName: string;
      attendingProfessional: string;
      copNumber: string;
      specialty: string;
      branch: string;
      attentionDate: string;
      startTime: string | null;
      endTime: string | null;
      durationMinutes: number;
      assistance: string;
      serviceState: string;
    };
    diagnosis: {
      reasonForConsultation: string;
      clinicalEvaluation: string;
      basicDiagnosis: string;
      summaryProcedure: string;
    };
  };
  operationalDetail: {
    title: string;
    procedures: Array<{
      itemNumber: number;
      detailId: number;
      service: string;
      procedureName: string;
      professional: string;
      additionalCharge: string;
      observations: string;
      registeredAt: string;
    }>;
  };
  resultsAndIndications: {
    clinicalResult: string;
    generalObservations: string;
    finalInstructions: string;
    formalIndicationsDoc: {
      indicationId: number;
      version: number;
      status: string;
      content: string;
      approvingProfessional: string;
      issueDate: string;
    } | null;
  };
  traceability: {
    originDatabase: string;
    martFactReference: string;
    documentHash: string;
    documentClosureStatus: string;
    closingValidator: string;
    closureDate: string | null;
    validationHistory: Array<{
      revisionNumber: number;
      result: string;
      pendingFields: string;
      validator: string;
      reviewedAt: string;
      auditHash: string | null;
    }>;
  };
}

export const F03ClinicalAttentionView: React.FC<{ data: F03Data; onPrint?: () => void }> = ({
  data,
  onPrint,
}) => {
  if (!data?.generalInfo?.consultation) return null;
  const { header, generalInfo, operationalDetail, resultsAndIndications, traceability } = data;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const procedureColumns: ColumnDef<typeof operationalDetail.procedures[0]>[] = [
    {
      header: 'Ítem',
      cell: (p) => <span className="font-mono font-bold text-center block">{p.itemNumber}</span>,
      align: 'center',
      className: 'w-12',
    },
    {
      header: 'Procedimiento Clínico Realizado',
      cell: (p) => (
        <div>
          <span className="font-semibold text-[var(--pt-ink)] block text-xs">{p.procedureName}</span>
          <span className="text-[11px] text-[var(--pt-muted)]">{p.observations}</span>
        </div>
      ),
    },
    {
      header: 'Servicio / Especialidad',
      cell: (p) => <span className="text-xs text-[var(--pt-muted)] font-mono">{p.service}</span>,
    },
    {
      header: 'Profesional Ejecutor',
      cell: (p) => <span className="text-xs font-medium text-[var(--pt-ink)]">{p.professional}</span>,
    },
    {
      header: 'Régimen Arancelario',
      cell: (p) => (
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--pt-sunken)] border border-[var(--pt-line)] text-[var(--pt-muted)]">
          {p.additionalCharge}
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
            title: '1. Filiación del Paciente y Antecedentes de Seguridad',
            fields: [
              { label: 'Paciente', value: generalInfo.patient.fullName, highlight: true },
              { label: 'Documento DNI', value: generalInfo.patient.documentNumber, isMono: true },
              { label: 'Contacto Telefónico', value: generalInfo.patient.phone, isMono: true },
              { label: 'Alergias Conocidas', value: generalInfo.patient.allergies, highlight: generalInfo.patient.allergies !== 'Niega alergias medicamentosas conocidas' },
              { label: 'Antecedentes Médicos', value: generalInfo.patient.antecedents },
              { label: 'Dolor / Sensibilidad', value: `Dolor Escala ${generalInfo.patient.painLevel}/10 · ${generalInfo.patient.sensitivity}` },
            ],
          },
          {
            title: '2. Datos de la Atención, Box y Especialista Responsable',
            fields: [
              { label: 'Atención ID', value: `#${generalInfo.consultation.attentionId}`, isMono: true },
              { label: 'Servicio Clínico', value: generalInfo.consultation.serviceName, highlight: true },
              { label: 'Especialista Tratante', value: generalInfo.consultation.attendingProfessional },
              { label: 'Colegiatura / Especialidad', value: `${generalInfo.consultation.copNumber} · ${generalInfo.consultation.specialty}` },
              { label: 'Sede y Box', value: generalInfo.consultation.branch },
              { label: 'Fecha y Duración', value: `${formatDate(generalInfo.consultation.attentionDate)} (${generalInfo.consultation.durationMinutes} min)` },
            ],
          },
          {
            title: '3. Diagnóstico y Juicio Clínico',
            fields: [
              { label: 'Motivo de Consulta', value: generalInfo.diagnosis.reasonForConsultation },
              { label: 'Evaluación Clínica Dental', value: generalInfo.diagnosis.clinicalEvaluation },
              { label: 'Diagnóstico Definitivo', value: generalInfo.diagnosis.basicDiagnosis, highlight: true },
              { label: 'Estado Asistencial', value: `${generalInfo.consultation.assistance} · ${generalInfo.consultation.serviceState}` },
              { label: 'Tratamiento / Sesión Ref', value: generalInfo?.consultation?.treatmentId ? `Tratamiento #${generalInfo.consultation.treatmentId} / Sesión #${generalInfo.consultation.sessionId ?? '—'}` : 'Consulta Externa', isMono: true },
              { label: 'Cierre Documental', value: traceability.documentClosureStatus, isMono: true },
            ],
          },
        ]}
      />

      {/* ── TABLA DE DETALLE OPERACIONAL: PROCEDIMIENTOS CLÍNICOS REALIZADOS ── */}
      <ReportTable
        title={operationalDetail.title}
        subtitle={`${operationalDetail.procedures.length} procedimientos documentados con desglose técnico individual`}
        columns={procedureColumns}
        data={operationalDetail.procedures}
      />

      {/* ── RESULTADOS Y OBSERVACIONES / INDICACIONES FORMALES ── */}
      <ReportObservations
        title="Resultados Clínicos e Instrucciones Postoperatorias"
        metrics={[
          {
            label: 'Procedimientos Realizados',
            value: `${operationalDetail.procedures.length}`,
            hint: 'Actos clínicos registrados',
          },
          {
            label: 'Duración en Box',
            value: `${generalInfo.consultation.durationMinutes} min`,
            hint: 'Tiempo efectivo de atención',
          },
          {
            label: 'Validación de Ficha',
            value: traceability.documentClosureStatus,
            badge: traceability.validationHistory[0]?.result || 'Pendiente',
          },
          {
            label: 'Documento Indicaciones',
            value: resultsAndIndications.formalIndicationsDoc ? `DOC-IND-${resultsAndIndications.formalIndicationsDoc.indicationId}` : 'En ficha',
            hint: resultsAndIndications.formalIndicationsDoc?.status || 'Registrado',
          },
        ]}
        observations={
          <div className="space-y-2">
            <div>
              <strong className="text-[var(--pt-ink)] block">Resultado Inmediato de la Atención:</strong>
              <p>{resultsAndIndications.clinicalResult}</p>
            </div>
            <div>
              <strong className="text-[var(--pt-ink)] block">Indicaciones y Cuidados Postatención (IndicacionesPostatencion):</strong>
              <p className="bg-[var(--pt-surface)] border border-[var(--pt-line)] p-2.5 rounded-lg text-xs font-mono text-[var(--pt-ink)]">
                {resultsAndIndications.formalIndicationsDoc?.content || resultsAndIndications.finalInstructions}
              </p>
            </div>
          </div>
        }
        notesTitle="Evolución y Cuidados Prescritos"
      />

      {/* ── TRAZABILIDAD Y VALIDACIÓN CON HISTORIAL DE REVISIONES ── */}
      <ReportTraceabilityStamp
        originDatabase={traceability.originDatabase}
        martFactReference={traceability.martFactReference}
        documentHash={traceability.documentHash}
        verifiedBy={traceability.closingValidator}
        validationTimestamp={traceability.closureDate || generalInfo.consultation.attentionDate}
        certificationTitle="Certificación de Ficha Clínica y Control de Calidad Documental (ValidacionesFicha)"
        secondaryVerification={
          traceability.validationHistory.length > 0 ? (
            <div className="rounded-lg bg-[var(--pt-paper)] border border-[var(--pt-line)] p-2.5 text-[11px] font-mono space-y-1">
              <span className="font-bold text-[var(--pt-muted)] uppercase block tracking-wider">
                Auditorías Registradas:
              </span>
              {traceability.validationHistory.map((v, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[var(--pt-ink)] border-b border-[var(--pt-line)] last:border-0 py-0.5">
                  <span>Rev #{v.revisionNumber} · Dictamen: <strong>{v.result}</strong> ({v.pendingFields})</span>
                  <span className="text-[var(--pt-muted)]">Validador: {v.validator} · {formatDate(v.reviewedAt)}</span>
                </div>
              ))}
            </div>
          ) : null
        }
      />
    </ReportShell>
  );
};
