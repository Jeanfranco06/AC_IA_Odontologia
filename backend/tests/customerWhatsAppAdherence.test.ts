import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import whatsappRoutes from '../src/modules/customer/whatsapp/whatsapp.routes';
import { WhatsAppAdherenceService } from '../src/modules/customer/whatsapp/services/whatsappAdherenceService';
import { CustomerCompletionService } from '../src/modules/customer/ai-agent/services/customerCompletionService';
import { executeTool } from '../src/modules/customer/ai-agent/llm/toolRegistry';
import { prisma } from '../src/db';

describe('FASE 2: Adherencia y Agenda (Recordatorios T-24h y Confirmación en 1 Clic)', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/customer/whatsapp', whatsappRoutes);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Manejo de Acciones Interactivas de Botones', () => {
    const mockPatient = {
      idPersona: 45,
      nombres: 'María',
      apellidos: 'López',
      numero: '51987654321',
      dni: '12345678',
      autorizaContacto: true
    };

    it('debe confirmar la sesión en 1 clic al presionar CONFIRM_SESSION', async () => {
      vi.spyOn(CustomerCompletionService, 'confirmSession').mockResolvedValue({
        id_sesion: 101,
        confirmacion_paciente: 'Confirmada'
      } as any);

      vi.spyOn(prisma.sesionesTratamiento, 'findUnique').mockResolvedValue({
        id_sesion: 101,
        Sedes: { nombre: 'San Isidro', direccion: 'Av. Javier Prado 1234' }
      } as any);

      const result = await WhatsAppAdherenceService.handleInteractiveAction(
        mockPatient,
        'CONFIRM_SESSION_101'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Tu asistencia ha sido confirmada con éxito');
      expect(result.replyText).toContain('San Isidro');
      expect(CustomerCompletionService.confirmSession).toHaveBeenCalledWith(
        { role: 'PACIENTE', idPersona: 45 },
        101,
        true
      );
    });

    it('debe iniciar el flujo guiado al presionar RESCHEDULE_SESSION', async () => {
      const result = await WhatsAppAdherenceService.handleInteractiveAction(
        mockPatient,
        'RESCHEDULE_SESSION_101'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Para coordinar el cambio de tu sesión');
      expect(result.replyText).toContain('¿Qué fecha preferirías?');
    });

    it('debe ofrecer contención y opción de reprogramar al presionar CANCEL_SESSION', async () => {
      const result = await WhatsAppAdherenceService.handleInteractiveAction(
        mockPatient,
        'CANCEL_SESSION_101'
      );

      expect(result.handled).toBe(true);
      expect(result.replyText).toContain('Las cancelaciones definitivas de cita requieren coordinación');
    });
  });

  describe('2. Confirmación de Cita por Texto Libre', () => {
    const mockPatient = {
      idPersona: 45,
      nombres: 'María',
      apellidos: 'López',
      numero: '51987654321',
      dni: '12345678',
      autorizaContacto: true
    };

    it('debe confirmar si el paciente escribe "confirmo asistencia"', async () => {
      vi.spyOn(prisma.sesionesTratamiento, 'findFirst').mockResolvedValue({
        id_sesion: 102,
        fecha_programada_vigente: new Date(Date.now() + 20 * 3600 * 1000),
        Sedes: { nombre: 'Miraflores' },
        TratamientosContratados: {
          Servicios: { nombre: 'Endodoncia' }
        }
      } as any);

      vi.spyOn(CustomerCompletionService, 'confirmSession').mockResolvedValue({} as any);

      const reply = await WhatsAppAdherenceService.tryConfirmPendingSessionByText(
        mockPatient,
        'confirmo asistencia'
      );

      expect(reply).not.toBeNull();
      expect(reply).toContain('He confirmado tu asistencia');
      expect(reply).toContain('Endodoncia');
    });

    it('debe retornar null para consultas que no son confirmaciones para que las atienda el LLM', async () => {
      const reply = await WhatsAppAdherenceService.tryConfirmPendingSessionByText(
        mockPatient,
        '¿Cuánto dura la limpieza dental?'
      );

      expect(reply).toBeNull();
    });
  });

  describe('3. Herramienta confirmSessionAttendance del Agente IA', () => {
    it('debe ejecutar confirmSessionAttendance correctamente', async () => {
      vi.spyOn(CustomerCompletionService, 'confirmSession').mockResolvedValue({} as any);

      const result = await executeTool(
        { role: 'PACIENTE', idPersona: 45 },
        'confirmSessionAttendance',
        { sessionId: 105 }
      );

      expect(result.name).toBe('confirmSessionAttendance');
      expect(result.result).toMatchObject({
        success: true,
        sessionId: 105,
        status: 'Confirmada'
      });
    });
  });

  describe('4. Endpoints de Ejecución de Recordatorios', () => {
    it('debe ejecutar POST /reminders/run y retornar resumen', async () => {
      vi.spyOn(WhatsAppAdherenceService, 'sendUpcomingSessionReminders').mockResolvedValue({
        sent: 3,
        skipped: 1
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/reminders/run')
        .send({ hoursAhead: 24 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sentReminders).toBe(3);
      expect(response.body.skipped).toBe(1);
    });

    it('debe ejecutar POST /reminders/unscheduled-plans/run y retornar conteo', async () => {
      vi.spyOn(WhatsAppAdherenceService, 'sendUnscheduledPlanReminders').mockResolvedValue({
        sent: 2
      });

      const response = await request(app)
        .post('/api/customer/whatsapp/reminders/unscheduled-plans/run');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sentReminders).toBe(2);
    });
  });
});
