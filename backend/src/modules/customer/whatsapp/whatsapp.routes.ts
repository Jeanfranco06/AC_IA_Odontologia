import { Router, Request, Response } from 'express';
import { getWhatsAppConfig } from './config';
import { WhatsAppSecurityService } from './services/whatsappSecurity';
import { WhatsAppRouterService } from './services/whatsappRouterService';
import { WhatsAppAdherenceService } from './services/whatsappAdherenceService';
import { WhatsAppPostCareService } from './services/whatsappPostCareService';
import { WhatsAppLoyaltyService } from './services/whatsappLoyaltyService';
import { WhatsAppInboundWebhook, WhatsAppRawMessage } from './types';

const router = Router();

/**
 * GET /api/customer/whatsapp/webhook
 * Handshake de verificación obligatorio de Meta Cloud API.
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  if (WhatsAppSecurityService.verifyWebhookToken(mode, token)) {
    console.log('[WhatsApp Webhook] Handshake verificado con éxito por Meta.');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Handshake rechazado: token o modo inválido.');
  return res.status(403).json({ error: 'Token de verificación inválido' });
});

/**
 * POST /api/customer/whatsapp/webhook
 * Recepción de eventos y mensajes entrantes de Meta.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // 1. Verificación de firma criptográfica
  if (!WhatsAppSecurityService.verifySignature(rawBody, signature)) {
    console.warn('[WhatsApp Webhook] Firma HMAC inválida o ausente.');
    return res.status(401).json({ error: 'Firma de webhook inválida' });
  }

  // Responder 200 OK inmediatamente a Meta para evitar timeouts y reintentos innecesarios
  res.status(200).send('EVENT_RECEIVED');

  // 2. Procesar el payload en segundo plano de manera segura
  try {
    const payload = req.body as WhatsAppInboundWebhook;
    if (payload.object !== 'whatsapp_business_account' || !payload.entry) {
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        if (value.statuses) {
          for (const st of value.statuses) {
            console.log(`[WhatsApp Webhook Status] Mensaje ${st.id} -> estado: ${st.status}`, st.errors || '');
          }
        }

        if (!value.messages) continue;

        for (const message of value.messages) {
          // Despachar cada mensaje entrante al router
          await WhatsAppRouterService.handleIncomingMessage(message);
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
  }
});

/**
 * GET /api/customer/whatsapp/status
 * Diagnóstico de estado del canal WhatsApp.
 */
router.get('/status', (_req: Request, res: Response) => {
  const config = getWhatsAppConfig();
  res.json({
    enabled: config.enabled,
    hasPhoneNumberId: Boolean(config.phoneNumberId),
    hasAccessToken: Boolean(config.accessToken),
    hasAppSecret: Boolean(config.appSecret),
    apiVersion: config.apiVersion,
    baseUrl: config.baseUrl
  });
});

/**
 * POST /api/customer/whatsapp/reminders/run
 * Dispara el envío de recordatorios proactivos T-24h para sesiones próximas sin confirmar.
 */
router.post('/reminders/run', async (req: Request, res: Response) => {
  try {
    const hoursAhead = req.body?.hoursAhead ? Number(req.body.hoursAhead) : 24;
    const result = await WhatsAppAdherenceService.sendUpcomingSessionReminders(hoursAhead);
    res.json({
      success: true,
      sentReminders: result.sent,
      skipped: result.skipped,
      message: `Proceso de recordatorios completado: ${result.sent} enviados, ${result.skipped} omitidos.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error ejecutando recordatorios de citas' });
  }
});

/**
 * POST /api/customer/whatsapp/reminders/send-immediate
 * Envía bajo demanda el recordatorio interactivo para una sesión o paciente específico.
 */
router.post('/reminders/send-immediate', async (req: Request, res: Response) => {
  try {
    const sessionId = req.body?.sessionId ? Number(req.body.sessionId) : undefined;
    const personId = req.body?.personId ? Number(req.body.personId) : undefined;
    if (!sessionId && !personId) {
      return res.status(400).json({ error: 'Debes indicar el sessionId o personId para el envío directo.' });
    }
    const result = await WhatsAppAdherenceService.sendImmediateSessionReminder({ sessionId, personId });
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error enviando recordatorio inmediato' });
  }
});

/**
 * POST /api/customer/whatsapp/reminders/unscheduled-plans/run
 * Dispara el envío de recordatorios para tratamientos con sesiones sin programar (ALT-C03).
 */
router.post('/reminders/unscheduled-plans/run', async (_req: Request, res: Response) => {
  try {
    const result = await WhatsAppAdherenceService.sendUnscheduledPlanReminders();
    res.json({
      success: true,
      sentReminders: result.sent,
      message: `Recordatorios de continuidad de plan enviados: ${result.sent}.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error ejecutando recordatorios de planes' });
  }
});

/**
 * POST /api/customer/whatsapp/postcare/run-checkins
 * Dispara el envío de encuestas de check-in post-operatorio (24h después de atenciones).
 */
router.post('/postcare/run-checkins', async (req: Request, res: Response) => {
  try {
    const minHours = req.body?.minHoursAgo ? Number(req.body.minHoursAgo) : 20;
    const maxHours = req.body?.maxHoursAgo ? Number(req.body.maxHoursAgo) : 36;
    const result = await WhatsAppPostCareService.sendPostCareCheckins(minHours, maxHours);
    res.json({
      success: true,
      sentCheckins: result.sent,
      skipped: result.skipped,
      message: `Proceso de check-in postatención completado: ${result.sent} enviados, ${result.skipped} omitidos.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error ejecutando check-ins postoperatorios' });
  }
});

/**
 * POST /api/customer/whatsapp/postcare/triage
 * Evaluación y registro de triaje de síntomas con activación de alerta ALT-C08.
 */
router.post('/postcare/triage', async (req: Request, res: Response) => {
  try {
    const { personId, painLevel, symptoms, hasRedFlags, redFlagDetails, attentionId } = req.body || {};
    if (!personId || painLevel === undefined || !symptoms) {
      return res.status(400).json({ error: 'Campos personId, painLevel y symptoms son requeridos.' });
    }

    const mockPatient = {
      idPersona: Number(personId),
      nombres: 'Paciente',
      apellidos: '',
      numero: '',
      dni: null,
      autorizaContacto: true
    };

    const result = await WhatsAppPostCareService.evaluateAndRegisterTriage(mockPatient, {
      painLevel: Number(painLevel),
      symptoms: String(symptoms),
      hasRedFlags: Boolean(hasRedFlags),
      redFlagDetails: redFlagDetails ? String(redFlagDetails) : undefined,
      attentionId: attentionId ? Number(attentionId) : undefined
    });

    res.json({ success: true, triage: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error procesando triaje' });
  }
});

/**
 * POST /api/customer/whatsapp/loyalty/run-surveys
 * Dispara el envío de encuestas de satisfacción NPS a pacientes con tratamientos completados.
 */
router.post('/loyalty/run-surveys', async (req: Request, res: Response) => {
  try {
    const minHours = req.body?.minHoursAgo ? Number(req.body.minHoursAgo) : 48;
    const maxHours = req.body?.maxHoursAgo ? Number(req.body.maxHoursAgo) : 96;
    const result = await WhatsAppLoyaltyService.sendCompletionNpsSurveys(minHours, maxHours);
    res.json({
      success: true,
      sentSurveys: result.sent,
      skipped: result.skipped,
      message: `Encuestas NPS enviadas: ${result.sent}, omitidas: ${result.skipped}.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error ejecutando encuestas NPS' });
  }
});

/**
 * POST /api/customer/whatsapp/loyalty/run-recalls
 * Dispara el envío de recordatorios de control semestral preventivo (Recalls a 6 meses).
 */
router.post('/loyalty/run-recalls', async (_req: Request, res: Response) => {
  try {
    const result = await WhatsAppLoyaltyService.sendSixMonthRecalls();
    res.json({
      success: true,
      sentRecalls: result.sent,
      skipped: result.skipped,
      message: `Invitaciones a control preventivo de 6 meses enviadas: ${result.sent}.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error ejecutando recalls de 6 meses' });
  }
});

/**
 * POST /api/customer/whatsapp/loyalty/survey
 * Registra una respuesta a encuesta de satisfacción NPS.
 */
router.post('/loyalty/survey', async (req: Request, res: Response) => {
  try {
    const { personId, score, feedback } = req.body || {};
    if (!personId || score === undefined) {
      return res.status(400).json({ error: 'Campos personId y score son requeridos.' });
    }

    const mockPatient = {
      idPersona: Number(personId),
      nombres: 'Paciente',
      apellidos: '',
      numero: '',
      dni: null,
      autorizaContacto: true
    };

    const result = await WhatsAppLoyaltyService.recordSatisfactionSurvey(mockPatient, {
      score: Number(score),
      feedback: feedback ? String(feedback) : undefined
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error registrando encuesta de satisfacción' });
  }
});

/**
 * POST /api/customer/whatsapp/test-simulate
 * Endpoint de pruebas para simular un mensaje entrante de WhatsApp desde el número de un paciente.
 */
router.post('/test-simulate', async (req: Request, res: Response) => {
  try {
    const { from, text } = req.body || {};
    if (!from || !text) {
      return res.status(400).json({ error: 'Campos "from" y "text" son requeridos.' });
    }

    const simulatedMessage: WhatsAppRawMessage = {
      from: String(from),
      id: `sim-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      text: { body: String(text) }
    };

    await WhatsAppRouterService.handleIncomingMessage(simulatedMessage);

    res.json({
      success: true,
      simulatedMessageId: simulatedMessage.id,
      message: 'Mensaje simulado procesado correctamente.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error simulando mensaje' });
  }
});

export default router;
