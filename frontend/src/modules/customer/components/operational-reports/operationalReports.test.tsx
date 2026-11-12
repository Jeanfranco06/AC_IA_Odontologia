import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { F01TreatmentFollowupView } from './F01TreatmentFollowupView';
import { F02SessionScheduleView } from './F02SessionScheduleView';
import { F03ClinicalAttentionView } from './F03ClinicalAttentionView';
import { F04AiAuditLogView } from './F04AiAuditLogView';
import { F05TreatmentClosureView } from './F05TreatmentClosureView';

describe('FORMATOS OPERACIONALES F01–F05 FRONTEND COMPONENTS', () => {
  it('F01: Renderiza Alta y Seguimiento del Tratamiento con estructura documental', () => {
    const mockF01: any = {
      header: {
        formatCode: 'F01',
        formatName: 'Alta y Seguimiento del Tratamiento Odontológico',
        documentId: 'DOC-F01-00001',
        issueDate: '2026-11-12T10:00:00Z',
        status: 'En ejecución',
        scope: 'Fase CUSTOMER · Trazabilidad de Tratamientos',
      },
      generalInfo: {
        patient: {
          fullName: 'Javier Terrones',
          documentType: 'DNI',
          documentNumber: '40000002',
          phone: '910000002',
          email: 'javier@gmail.com',
          zone: 'Trujillo Centro',
        },
        treatment: {
          treatmentId: 2,
          serviceName: 'Ortodoncia Inicial',
          serviceDescription: 'Ortodoncia fija correctiva',
          responsibleProfessional: 'Dra. Valeria Mendoza',
          copNumber: 'COP-TRU-1001',
          specialty: 'Ortodoncia y Ortopedia Maxilar',
          branch: 'Sede Centro Histórico',
          agreedPrice: '1500.00',
          contractDate: '2026-10-15T09:00:00Z',
          activationDate: '2026-10-16T10:00:00Z',
          realStartDate: '2026-11-04T15:00:00Z',
          realCloseDate: null,
          suspensionReason: null,
        },
        plan: {
          planId: 2,
          version: 1,
          plannedSessions: 3,
          estimatedDurationMin: 45,
          clinicalObjectives: 'Alineación y nivelación de arcadas',
          approvalDate: '2026-10-16T10:00:00Z',
          planStatus: 'Aprobado',
        },
      },
      operationalDetail: {
        title: 'Cronograma y Estado de Sesiones',
        sessions: [
          {
            sessionNumber: 1,
            sessionId: 2,
            scheduledDate: '2026-11-04T15:00:00Z',
            durationMin: 45,
            professional: 'Dra. Valeria Mendoza',
            branch: 'Sede Centro Histórico',
            programmingStatus: 'Programada',
            assistanceStatus: 'Realizada',
            closureStatus: 'Cerrada',
            patientConfirmation: 'Confirmada',
            attentionId: 1524,
            attentionServiceState: 'Finalizado',
            documentClosureState: 'Cerrada',
          },
        ],
      },
      summary: {
        totalPlannedSessions: 3,
        completedSessions: 1,
        pendingSessions: 2,
        progressPercent: 33,
        isCompleted: false,
        clinicalObservations: 'Evolución inicial satisfactoria',
      },
      traceability: {
        originDatabase: 'NexoSaludDB (OLTP)',
        martFactReference: 'Fact_TratamientoCustomer',
        documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verifiedBy: 'Dra. Valeria Mendoza',
        validationTimestamp: '2026-11-12T10:00:00Z',
      },
    };

    render(<F01TreatmentFollowupView data={mockF01} />);
    expect(screen.getByText('Alta y Seguimiento del Tratamiento Odontológico')).toBeInTheDocument();
    expect(screen.getByText('DOC-F01-00001')).toBeInTheDocument();
    expect(screen.getByText('Javier Terrones')).toBeInTheDocument();
    expect(screen.getByText('Ortodoncia Inicial')).toBeInTheDocument();
  });

  it('F02: Renderiza Registro de Sesión Programada', () => {
    const mockF02: any = {
      header: {
        formatCode: 'F02',
        formatName: 'Registro y Trazabilidad de Sesión Odontológica Programada',
        documentId: 'DOC-F02-00002',
        issueDate: '2026-11-12T10:00:00Z',
        status: 'Programada · Realizada',
        scope: 'Fase CUSTOMER · Trazabilidad de Agenda y Sesión',
      },
      generalInfo: {
        patient: {
          fullName: 'Javier Terrones',
          documentType: 'DNI',
          documentNumber: '40000002',
          phone: '910000002',
          email: 'javier@gmail.com',
        },
        sessionInfo: {
          sessionId: 2,
          treatmentId: 2,
          sessionNumber: 1,
          serviceName: 'Ortodoncia Inicial',
          responsibleProfessional: 'Dra. Valeria Mendoza',
          copNumber: 'COP-TRU-1001',
          specialty: 'Ortodoncia',
          branch: 'Sede Centro Histórico',
          scheduledDate: '2026-11-04T15:00:00Z',
          durationMin: 45,
          programmingStatus: 'Programada',
          assistanceStatus: 'Realizada',
          closureStatus: 'Cerrada',
        },
        timestamps: {
          patientConfirmation: 'Confirmada',
          confirmationDate: '2026-11-03T15:00:00Z',
          arrivalTime: '2026-11-04T14:55:00Z',
          attentionStartTime: '2026-11-04T15:05:00Z',
          sessionCloseTime: '2026-11-04T15:50:00Z',
          noShowReason: null,
        },
      },
      operationalDetail: {
        title: 'Bitácora de Modificaciones y Eventos de la Sesión',
        events: [],
      },
      reschedulingRequests: [],
      linkedAttention: null,
      summary: {
        onTimeArrival: 'En sala puntual',
        effectiveSillónMinutes: 45,
        operationalObservations: 'Conforme',
      },
      traceability: {
        originDatabase: 'NexoSaludDB (OLTP)',
        martFactReference: 'Fact_SesionCustomer',
        documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verifiedBy: 'Dra. Valeria Mendoza',
        validationTimestamp: '2026-11-12T10:00:00Z',
      },
    };

    render(<F02SessionScheduleView data={mockF02} />);
    expect(screen.getByText('Registro y Trazabilidad de Sesión Odontológica Programada')).toBeInTheDocument();
    expect(screen.getByText('DOC-F02-00002')).toBeInTheDocument();
  });
});
