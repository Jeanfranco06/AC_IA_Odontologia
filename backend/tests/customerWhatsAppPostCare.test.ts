import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import whatsappRoutes from '../src/modules/customer/whatsapp/whatsapp.routes';
import { WhatsAppPostCareService } from '../src/modules/customer/whatsapp/services/whatsappPostCareService';
import { executeTool } from '../src/modules/customer/ai-agent/llm/toolRegistry';
import { prisma } from '../src/db';

describe('FASE 3: Seguimiento Post-Procedimiento y Triaje de Urgencias', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/customer/whatsapp', whatsappRoutes);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockPatient = {
    idPersona: 20,
    nombres: 'Daniel',
    apellidos: 'Vargas',
    numero: '51999888777',
    dni: '87654321',
    autorizaContacto: true,
    activeTreatment: {
      idTratamiento: 10,
      servicioNombre: 'Extracción Simple',
      estadoTratamiento: 'En ejecución',
      idProfesionalResponsable: 5
    }
  };

  describe('1. Botones de Check-in Post-Atención 24h', () => {
    it('debe registrar evolución favorable al presionar POSTCARE_OK', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({
        id_seguimiento: 1,
        id_persona: 20,
        resultado: 'Evolución favorable'
      } as any);

      const result = await WhatsAppPostCareService.handlePostCareButton(
        mockPatient,
        'POSTCARE_OK_50'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Nos alegra mucho saber que te sientes bien');
      expect(prisma.seguimientos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_persona: 20,
            id_atencion: 50,
            tipo: 'POST_OPERATORIO',
            incidencia: false
          })
        })
      );
    });

    it('debe registrar molestia leve y dar pautas antiinflamatorias al presionar POSTCARE_MILD', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.atenciones, 'findUnique').mockResolvedValue({
        id_atencion: 50,
        indicaciones_finales: 'Tomar Ibuprofeno 400mg c/8h'
      } as any);

      const result = await WhatsAppPostCareService.handlePostCareButton(
        mockPatient,
        'POSTCARE_MILD_50'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Pautas de alivio');
      expect(result.replyText).toContain('Tomar Ibuprofeno 400mg c/8h');
    });

    it('debe activar preguntas de triaje prioritario al presionar POSTCARE_ALERT', async () => {
      const result = await WhatsAppPostCareService.handlePostCareButton(
        mockPatient,
        'POSTCARE_ALERT_50'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Atención Médica Prioritaria');
      expect(result.replyText).toContain('¿Del 1 al 10 qué nivel de dolor sientes?');
    });
  });

  describe('2. Motor de Triaje y Despistaje de Banderas Rojas', () => {
    it('debe detectar urgencia cuando el dolor es severo (EVA >= 8) y generar alerta ALT-C08', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 77 } as any);
      vi.spyOn(prisma.incidencias, 'create').mockResolvedValue({ id_incidencia: 88 } as any);
      vi.spyOn(prisma.alertasIA, 'create').mockResolvedValue({ id_alerta_ia: 99 } as any);

      const result = await WhatsAppPostCareService.evaluateAndRegisterTriage(mockPatient, {
        painLevel: 9,
        symptoms: 'Dolor punzante e insoportable que no cede',
        hasRedFlags: false,
        attentionId: 50
      });

      expect(result.isUrgent).toBe(true);
      expect(result.alertId).toBe(99);
      expect(result.incidentId).toBe(88);
      expect(result.patientGuidance).toContain('Urgencia Médica Registrada');
      expect(result.patientGuidance).toContain('Central de Urgencias Odontológicas');

      expect(prisma.incidencias.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prioridad: 'Alta',
            tipo: 'COMPLICACION_POSTOPERATORIA'
          })
        })
      );

      expect(prisma.alertasIA.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo_evento: 'ALT-C08',
            severidad: 'Alta'
          })
        })
      );
    });

    it('debe detectar urgencia cuando hay palabras clave de banderas rojas (hemorragia/fiebre)', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 78 } as any);
      vi.spyOn(prisma.incidencias, 'create').mockResolvedValue({ id_incidencia: 89 } as any);
      vi.spyOn(prisma.alertasIA, 'create').mockResolvedValue({ id_alerta_ia: 100 } as any);

      const result = await WhatsAppPostCareService.evaluateAndRegisterTriage(mockPatient, {
        painLevel: 5,
        symptoms: 'Tengo sangrado continuo y fiebre desde anoche',
        hasRedFlags: true
      });

      expect(result.isUrgent).toBe(true);
      expect(result.patientGuidance).toContain('gasa limpia seca sobre la zona y muérdela con presión firme');
    });

    it('debe clasificar como molestia moderada si el dolor es leve y no hay banderas rojas', async () => {
      vi.spyOn(prisma.seguimientos, 'create').mockResolvedValue({ id_seguimiento: 79 } as any);

      const result = await WhatsAppPostCareService.evaluateAndRegisterTriage(mockPatient, {
        painLevel: 3,
        symptoms: 'Ligera molestia al masticar',
        hasRedFlags: false
      });

      expect(result.isUrgent).toBe(false);
      expect(result.patientGuidance).toContain('Evaluación de Molestias');
      expect(result.patientGuidance).toContain('proceso inflamatorio habitual');
    });
  });

  describe('3. Consulta de Indicaciones Oficiales por WhatsApp', () => {
    it('debe estructurar indicaciones emitidas con formato limpio para WhatsApp', async () => {
      vi.spyOn(prisma.atenciones, 'findFirst').mockResolvedValue({
        id_atencion: 50,
        fecha_atencion: new Date('2026-11-13'),
        indicaciones_finales: '1. No escupir.\n2. Dieta blanda.',
        Servicio: { nombre: 'Extracción Simple' },
        Profesional: { nombres: 'Andrea', apellidos: 'Castro' },
        IndicacionesPostatencion: [
          { contenido_indicaciones: 'Pautas: Gasa 45 min y reposo' }
        ]
      } as any);

      const text = await WhatsAppPostCareService.formatInstructionsForWhatsApp(20, 50);

      expect(text).toContain('Indicaciones Médicas Post-Atención');
      expect(text).toContain('Extracción Simple');
      expect(text).toContain('Dr(a). Andrea Castro');
      expect(text).toContain('Pautas: Gasa 45 min y reposo');
    });
  });

  describe('4. Herramienta registerPatientSymptomTriage del Agente IA', () => {
    it('debe ejecutarse desde toolRegistry y activar triaje', async () => {
      vi.spyOn(WhatsAppPostCareService, 'evaluateAndRegisterTriage').mockResolvedValue({
        isUrgent: true,
        alertId: 101,
        patientGuidance: 'Guía de urgencia médica'
      });

      const result = await executeTool(
        { role: 'PACIENTE', idPersona: 20 },
        'registerPatientSymptomTriage',
        {
          painLevel: 8,
          symptoms: 'Mucho dolor en la encía',
          hasRedFlags: true
        }
      );

      expect(result.name).toBe('registerPatientSymptomTriage');
      expect(result.result).toMatchObject({
        isUrgent: true,
        alertGenerated: true,
        guidance: 'Guía de urgencia médica'
      });
    });
  });

  describe('5. Endpoints HTTP de Post-Atención', () => {
    it('debe ejecutar POST /postcare/run-checkins y retornar conteo', async () => {
      vi.spyOn(WhatsAppPostCareService, 'sendPostCareCheckins').mockResolvedValue({
        sent: 4,
        skipped: 0
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/postcare/run-checkins')
        .send({ minHoursAgo: 20, maxHoursAgo: 36 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sentCheckins).toBe(4);
    });

    it('debe ejecutar POST /postcare/triage y retornar resultado de triaje', async () => {
      vi.spyOn(WhatsAppPostCareService, 'evaluateAndRegisterTriage').mockResolvedValue({
        isUrgent: false,
        patientGuidance: 'Guía normal'
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/postcare/triage')
        .send({
          personId: 20,
          painLevel: 2,
          symptoms: 'Molestia leve'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.triage.isUrgent).toBe(false);
    });
  });
});
