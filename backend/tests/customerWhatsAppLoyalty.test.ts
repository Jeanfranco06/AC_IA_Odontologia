import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import whatsappRoutes from '../src/modules/customer/whatsapp/whatsapp.routes';
import { WhatsAppLoyaltyService } from '../src/modules/customer/whatsapp/services/whatsappLoyaltyService';
import { executeTool } from '../src/modules/customer/ai-agent/llm/toolRegistry';
import { prisma } from '../src/db';

describe('FASE 4: Fidelización, Medición de Calidad (NPS), Referidos y Recalls Preventivos', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/customer/whatsapp', whatsappRoutes);

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!prisma.atenciones.findFirst) {
      (prisma.atenciones as any).findFirst = vi.fn();
    }
    vi.spyOn(prisma.atenciones, 'findFirst').mockResolvedValue({ id_atencion: 80 } as any);
  });

  const mockPatient = {
    idPersona: 35,
    nombres: 'Claudia',
    apellidos: 'Ríos',
    numero: '51911223344',
    dni: '44556677',
    autorizaContacto: true
  };

  describe('1. Medición de Satisfacción NPS y Segmentación Inteligente', () => {
    it('debe categorizar 10 como PROMOTOR, emitir código de referidos y link de Google Reviews', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 201 } as any);
      vi.spyOn(prisma.atenciones, 'findFirst').mockResolvedValue({ id_atencion: 80 } as any);

      const result = await WhatsAppLoyaltyService.recordSatisfactionSurvey(mockPatient, {
        score: 10,
        feedback: 'Excelente atención de todo el equipo'
      });

      expect(result.category).toBe('PROMOTER');
      expect(result.score).toBe(10);
      expect(result.referralCode).toBe('SONRISA-CLAUDIA-35');
      expect(result.googleReviewUrl).toContain('google');
      expect(result.replyMessage).toContain('SONRISA-CLAUDIA-35');
      expect(result.replyMessage).toContain('20% de descuento');

      expect(prisma.seguimientos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_persona: 35,
            satisfaccion: 5,
            tipo: 'ENCUESTA_NPS',
            incidencia: false
          })
        })
      );
    });

    it('debe categorizar 7 como PASIVO y solicitar sugerencias constructivas de mejora', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 202 } as any);

      const result = await WhatsAppLoyaltyService.recordSatisfactionSurvey(mockPatient, {
        score: 7
      });

      expect(result.category).toBe('PASSIVE');
      expect(result.score).toBe(7);
      expect(result.replyMessage).toContain('¿Hay algún detalle específico en el que consideras que podríamos mejorar');
    });

    it('debe categorizar 4 como DETRACTOR y abrir incidencia prioritaria de recuperación', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 203 } as any);
      vi.spyOn(prisma.incidencias, 'create').mockResolvedValue({ id_incidencia: 301 } as any);

      const result = await WhatsAppLoyaltyService.recordSatisfactionSurvey(mockPatient, {
        score: 4,
        feedback: 'Hubo retraso de 40 minutos en el inicio de mi atención'
      });

      expect(result.category).toBe('DETRACTOR');
      expect(result.score).toBe(4);
      expect(result.incidentId).toBe(301);
      expect(result.replyMessage).toContain('Lamentamos mucho que tu experiencia no haya sido la esperada');
      expect(result.replyMessage).toContain('Coordinación de Calidad');

      expect(prisma.incidencias.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_persona: 35,
            prioridad: 'Alta',
            tipo: 'DETRACTOR_NPS'
          })
        })
      );
    });
  });

  describe('2. Recalls Semestrales (Puente Customer -> Turned)', () => {
    it('debe detectar candidatos de hace 6 meses y enviar invitaciones preventivas', async () => {
      vi.spyOn(prisma.tratamientosContratados, 'findMany').mockResolvedValue([
        {
          id_tratamiento: 15,
          fecha_cierre_real: new Date(Date.now() - 180 * 24 * 3600 * 1000),
          Personas: {
            id_persona: 35,
            nombres: 'Claudia',
            numero: '51911223344'
          },
          Servicios: {
            nombre: 'Ortodoncia'
          }
        }
      ] as any);

      vi.spyOn(prisma.seguimientos, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({} as any);

      const result = await WhatsAppLoyaltyService.sendSixMonthRecalls();

      expect(result.sent).toBe(1);
      expect(prisma.seguimientos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'RECALL_6_MESES'
          })
        })
      );
    });
  });

  describe('3. Registro de Leads Complementarios (Cross-Selling Ético)', () => {
    it('debe crear una nueva Solicitud en etapa LEAD asociada al mismo id_persona', async () => {
      vi.spyOn(prisma.servicios, 'findUnique').mockResolvedValue({
        id_servicio: 8,
        nombre: 'Blanqueamiento Dental'
      } as any);

      vi.spyOn(prisma.solicitudes, 'create').mockResolvedValue({
        id_solicitud: 550,
        id_persona: 35
      } as any);

      const result = await WhatsAppLoyaltyService.createComplementaryLead(
        mockPatient,
        8,
        'Interés post-ortodoncia'
      );

      expect(result.success).toBe(true);
      expect(result.idSolicitud).toBe(550);
      expect(result.message).toContain('Blanqueamiento Dental');

      expect(prisma.solicitudes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_persona: 35,
            id_servicio: 8,
            tipo_consulta: 'TRATAMIENTO_COMPLEMENTARIO_WHATSAPP'
          })
        })
      );
    });
  });

  describe('4. Herramientas del Agente IA en toolRegistry', () => {
    it('debe ejecutar recordPatientSatisfactionSurvey vía executeTool', async () => {
      vi.spyOn(WhatsAppLoyaltyService, 'recordSatisfactionSurvey').mockResolvedValue({
        category: 'PROMOTER',
        score: 10,
        referralCode: 'SONRISA-TEST',
        replyMessage: 'Agradecimiento'
      });

      const result = await executeTool(
        { role: 'PACIENTE', idPersona: 35 },
        'recordPatientSatisfactionSurvey',
        { score: 10, feedback: 'Excelente' }
      );

      expect(result.name).toBe('recordPatientSatisfactionSurvey');
      expect(result.result).toMatchObject({
        category: 'PROMOTER',
        score: 10,
        referralCode: 'SONRISA-TEST'
      });
    });

    it('debe ejecutar createComplementaryTreatmentLead vía executeTool', async () => {
      vi.spyOn(WhatsAppLoyaltyService, 'createComplementaryLead').mockResolvedValue({
        success: true,
        idSolicitud: 551,
        message: 'Lead registrado'
      });

      const result = await executeTool(
        { role: 'PACIENTE', idPersona: 35 },
        'createComplementaryTreatmentLead',
        { serviceId: 8, notes: 'Férula nocturna' }
      );

      expect(result.name).toBe('createComplementaryTreatmentLead');
      expect(result.result).toMatchObject({
        success: true,
        idSolicitud: 551
      });
    });
  });

  describe('5. Endpoints HTTP de Fidelización y Lealtad', () => {
    it('debe ejecutar POST /loyalty/run-surveys y retornar resumen', async () => {
      vi.spyOn(WhatsAppLoyaltyService, 'sendCompletionNpsSurveys').mockResolvedValue({
        sent: 5,
        skipped: 2
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/loyalty/run-surveys')
        .send({ minHoursAgo: 48, maxHoursAgo: 96 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sentSurveys).toBe(5);
    });

    it('debe ejecutar POST /loyalty/run-recalls y retornar resumen', async () => {
      vi.spyOn(WhatsAppLoyaltyService, 'sendSixMonthRecalls').mockResolvedValue({
        sent: 3,
        skipped: 0
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/loyalty/run-recalls');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sentRecalls).toBe(3);
    });

    it('debe ejecutar POST /loyalty/survey y retornar resultado', async () => {
      vi.spyOn(WhatsAppLoyaltyService, 'recordSatisfactionSurvey').mockResolvedValue({
        category: 'PROMOTER',
        score: 9,
        replyMessage: 'Gracias'
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/loyalty/survey')
        .send({ personId: 35, score: 9 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.category).toBe('PROMOTER');
    });
  });
});
