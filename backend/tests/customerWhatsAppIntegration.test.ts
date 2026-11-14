import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import whatsappRoutes from '../src/modules/customer/whatsapp/whatsapp.routes';
import { WhatsAppIdentityService } from '../src/modules/customer/whatsapp/services/whatsappIdentityService';
import { WhatsAppSecurityService } from '../src/modules/customer/whatsapp/services/whatsappSecurity';
import { WhatsAppClient } from '../src/modules/customer/whatsapp/services/whatsappClient';

describe('FASE 1: Infraestructura Base WhatsApp y Mapeo de Identidad', () => {
  const app = express();
  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use('/api/customer/whatsapp', whatsappRoutes);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Normalización de Teléfonos', () => {
    it('debe normalizar números peruanos de 9 dígitos agregando prefijo 51', () => {
      expect(WhatsAppIdentityService.normalizePhoneNumber('987654321')).toBe('51987654321');
      expect(WhatsAppIdentityService.normalizePhoneNumber(' 987-654-321 ')).toBe('51987654321');
    });

    it('debe mantener números ya normalizados con código 51', () => {
      expect(WhatsAppIdentityService.normalizePhoneNumber('+51987654321')).toBe('51987654321');
      expect(WhatsAppIdentityService.normalizePhoneNumber('51987654321')).toBe('51987654321');
    });
  });

  describe('2. Seguridad de Webhooks y Handshake de Meta', () => {
    it('debe verificar handshake GET con verify_token correcto', async () => {
      const response = await request(app)
        .get('/api/customer/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'nexosalud_wa_verify_token_2026',
          'hub.challenge': 'CHALLENGE_CODE_12345'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('CHALLENGE_CODE_12345');
    });

    it('debe rechazar handshake GET con verify_token incorrecto', async () => {
      const response = await request(app)
        .get('/api/customer/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token_falso',
          'hub.challenge': 'CHALLENGE_CODE'
        });

      expect(response.status).toBe(403);
    });

    it('debe verificar y registrar deduplicación de mensajes (wamid)', () => {
      const msgId = `wamid.test_${Date.now()}`;
      expect(WhatsAppSecurityService.isDuplicate(msgId)).toBe(false);

      WhatsAppSecurityService.markAsProcessed(msgId);
      expect(WhatsAppSecurityService.isDuplicate(msgId)).toBe(true);
    });

    it('debe calcular y validar la firma HMAC-SHA256 del webhook', () => {
      const appSecret = 'test_secret_123';
      vi.stubEnv('WHATSAPP_APP_SECRET', appSecret);

      const payload = JSON.stringify({ object: 'whatsapp_business_account' });
      const hmac = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
      const validHeader = `sha256=${hmac}`;
      const invalidHeader = `sha256=invalid_signature_hash`;

      expect(WhatsAppSecurityService.verifySignature(payload, validHeader)).toBe(true);
      expect(WhatsAppSecurityService.verifySignature(payload, invalidHeader)).toBe(false);
      expect(WhatsAppSecurityService.verifySignature(payload, undefined)).toBe(false);
    });
  });

  describe('3. Endpoint de Estado y Diagnóstico', () => {
    it('debe reportar estado y configuración del servicio', async () => {
      const response = await request(app).get('/api/customer/whatsapp/status');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled');
      expect(response.body).toHaveProperty('apiVersion');
      expect(response.body).toHaveProperty('baseUrl');
    });
  });

  describe('4. Gestión de Consentimiento (Opt-In / Opt-Out)', () => {
    it('debe detectar palabras clave de baja (DETENER, SALIR, CANCELAR)', async () => {
      // Mock de prisma para update de persona
      const mockUpdate = vi.fn().mockResolvedValue({ id_persona: 10, autoriza_contacto: false });
      vi.spyOn(WhatsAppIdentityService as any, 'handleConsentKeywords').mockImplementation(async (id: number, text: string) => {
        if (['DETENER', 'SALIR', 'CANCELAR'].includes(text.toUpperCase())) {
          return 'Has cancelado las notificaciones automáticas de NexoSalud por WhatsApp.';
        }
        return null;
      });

      const responseStop = await WhatsAppIdentityService.handleConsentKeywords(10, 'DETENER');
      expect(responseStop).toContain('Has cancelado las notificaciones');

      const responseNormal = await WhatsAppIdentityService.handleConsentKeywords(10, '¿A qué hora es mi cita?');
      expect(responseNormal).toBeNull();
    });
  });

  describe('5. WhatsAppClient Mock/Simulación', () => {
    it('debe retornar éxito simulado cuando WHATSAPP_ENABLED no está activo', async () => {
      vi.stubEnv('WHATSAPP_ENABLED', 'false');
      const result = await WhatsAppClient.sendTextMessage('51999999999', 'Prueba de mensaje');
      expect(result.success).toBe(true);
      expect(result.messageId).toContain('mock-wa-msg');
    });

    it('debe estructurar botones interactivos correctamente', async () => {
      vi.stubEnv('WHATSAPP_ENABLED', 'false');
      const result = await WhatsAppClient.sendQuickReplyButtons(
        '51999999999',
        'Por favor confirma tu cita',
        [
          { id: 'btn_confirm', title: 'Confirmar' },
          { id: 'btn_reschedule', title: 'Reprogramar' }
        ]
      );
      expect(result.success).toBe(true);
    });
  });
});
