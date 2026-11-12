import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { issueAiAgentToken } from '../src/modules/customer/ai-agent/authContext';

describe('FORMATOS OPERACIONALES DE ORIGEN DE MEDIDAS (F01–F05)', () => {
  let adminToken: string;
  let odontologoToken: string;
  let testTreatmentId: number;
  let testSessionId: number;
  let testAttentionId: number;

  beforeAll(async () => {
    adminToken = issueAiAgentToken({
      role: 'ADMIN',
      idUsuario: 1,
      email: 'admin@nexosalud.pe'
    });

    odontologoToken = issueAiAgentToken({
      role: 'ODONTOLOGO',
      idUsuario: 2,
      idProfesional: 1,
      email: 'valeria.mendoza@nexosalud.pe'
    });
  });

  it('CATALOG: Consulta de catálogo para selectores de reportes operacionales', async () => {
    const res = await request(app)
      .get('/api/customer/operational-reports/catalog')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('treatments');
    expect(res.body).toHaveProperty('sessions');
    expect(res.body).toHaveProperty('attentions');
    expect(Array.isArray(res.body.treatments)).toBe(true);
    expect(res.body.treatments.length).toBeGreaterThan(0);

    testTreatmentId = res.body.treatments[0].id;
    testSessionId = res.body.sessions[0]?.id || 1;
    testAttentionId = res.body.attentions[0]?.id || 220;
  });

  it('F01: Estructura documental de Alta y Seguimiento del Tratamiento', async () => {
    const res = await request(app)
      .get(`/api/customer/operational-reports/f01/${testTreatmentId}`)
      .set('Authorization', `Bearer ${odontologoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.header.formatCode).toBe('F01');
    expect(res.body.header.formatName).toBe('Alta y Seguimiento del Tratamiento Odontológico');
    expect(res.body.generalInfo.patient).toBeDefined();
    expect(res.body.generalInfo.treatment).toBeDefined();
    expect(res.body.generalInfo.plan).toBeDefined();
    expect(res.body.operationalDetail.sessions).toBeDefined();
    expect(res.body.summary.progressPercent).toBeTypeOf('number');
    expect(res.body.traceability.documentHash).toBeDefined();
    expect(res.body.traceability.originDatabase).toBe('NexoSaludDB (OLTP)');
  });

  it('F02: Estructura documental de Registro de Sesión Programada', async () => {
    const res = await request(app)
      .get(`/api/customer/operational-reports/f02/${testSessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.header.formatCode).toBe('F02');
    expect(res.body.header.formatName).toBe('Registro y Trazabilidad de Sesión Odontológica Programada');
    expect(res.body.generalInfo.patient).toBeDefined();
    expect(res.body.generalInfo.sessionInfo).toBeDefined();
    expect(res.body.operationalDetail.events).toBeDefined();
    expect(res.body.traceability.documentHash).toBeDefined();
  });

  it('F03: Estructura documental de Ficha Documental de la Atención Odontológica', async () => {
    const res = await request(app)
      .get(`/api/customer/operational-reports/f03/${testAttentionId}`)
      .set('Authorization', `Bearer ${odontologoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.header.formatCode).toBe('F03');
    expect(res.body.header.formatName).toBe('Ficha Documental de la Atención Odontológica');
    expect(res.body.generalInfo.patient).toBeDefined();
    expect(res.body.generalInfo.consultation).toBeDefined();
    expect(res.body.generalInfo.diagnosis).toBeDefined();
    expect(res.body.operationalDetail.procedures).toBeDefined();
    expect(res.body.resultsAndIndications).toBeDefined();
    expect(res.body.traceability.documentHash).toBeDefined();
  });

  it('F04: Estructura documental de Bitácora de Interacción y Supervisión de IA', async () => {
    const res = await request(app)
      .get('/api/customer/operational-reports/f04/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.header.formatCode).toBe('F04');
    expect(res.body.header.formatName).toBe('Bitácora de Interacción y Supervisión del Copiloto IA');
    expect(res.body.generalInfo.system.autonomousPrescriptionBlocked).toContain('100%');
    expect(res.body.operationalDetail.interactions).toBeDefined();
    expect(res.body.operationalDetail.alertsSection).toBeDefined();
    expect(res.body.traceability.auditHash).toBeDefined();
  });

  it('F05: Estructura documental de Acta de Cierre de Tratamiento y Continuidad', async () => {
    const res = await request(app)
      .get(`/api/customer/operational-reports/f05/${testTreatmentId}`)
      .set('Authorization', `Bearer ${odontologoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.header.formatCode).toBe('F05');
    expect(res.body.header.formatName).toBe('Acta de Cierre de Tratamiento y Continuidad Asistencial');
    expect(res.body.generalInfo.patient).toBeDefined();
    expect(res.body.generalInfo.treatmentSummary).toBeDefined();
    expect(res.body.closureChecklist.items).toBeDefined();
    expect(res.body.continuityPlan).toBeDefined();
    expect(res.body.traceability.documentHash).toBeDefined();
  });

  it('Seguridad: Rechazo HTTP 403 a roles no autorizados', async () => {
    const patientToken = issueAiAgentToken({
      role: 'PACIENTE',
      idPersona: 315,
      email: 'adriana.alayo@gmail.com'
    });

    const res = await request(app)
      .get('/api/customer/operational-reports/catalog')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });
});
