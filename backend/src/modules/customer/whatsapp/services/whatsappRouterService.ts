import { customerAiOrchestrator } from '../../ai-agent/llm/orchestrator';
import { WhatsAppClient } from './whatsappClient';
import { WhatsAppIdentityService } from './whatsappIdentityService';
import { WhatsAppSecurityService } from './whatsappSecurity';
import { WhatsAppAdherenceService } from './whatsappAdherenceService';
import { WhatsAppPostCareService } from './whatsappPostCareService';
import { WhatsAppLoyaltyService } from './whatsappLoyaltyService';
import { WhatsAppRawMessage } from '../types';

export class WhatsAppRouterService {
  /**
   * Procesa un mensaje individual recibido a través del Webhook de Meta.
   */
  static async handleIncomingMessage(rawMessage: WhatsAppRawMessage): Promise<void> {
    console.log('[WhatsApp Router] Mensaje recibido:', JSON.stringify(rawMessage));
    const messageId = rawMessage.id;
    const fromPhone = rawMessage.from;

    if (!fromPhone) {
      console.warn('[WhatsApp Router] Omitiendo mensaje sin remitente (from):', rawMessage);
      return;
    }

    // 1. Deduplicación e idempotencia
    if (WhatsAppSecurityService.isDuplicate(messageId)) {
      console.log(`[WhatsApp Router] Mensaje duplicado omitido: ${messageId}`);
      return;
    }
    WhatsAppSecurityService.markAsProcessed(messageId);

    // 2. Extraer texto del mensaje o botón interactivo
    let userText = '';
    const buttonId = rawMessage.interactive?.button_reply?.id;
    if (rawMessage.type === 'text' && rawMessage.text?.body) {
      userText = rawMessage.text.body.trim();
    } else if (rawMessage.type === 'interactive') {
      userText = rawMessage.interactive?.button_reply?.title || rawMessage.interactive?.list_reply?.title || '';
    } else if (rawMessage.type === 'button' && rawMessage.button?.text) {
      userText = rawMessage.button.text.trim();
    }

    if (!userText && !buttonId) {
      // Ignorar mensajes multimedia no soportados (stickers, ubicaciones) con un aviso cortés
      await WhatsAppClient.sendTextMessage(
        fromPhone,
        [
          `🦷 *NexoSalud Odontología*`,
          `¡Hola! Por el momento solo puedo procesar mensajes de texto y respuestas a opciones interactivas.`,
          ``,
          `¿En qué puedo ayudarte hoy con tus citas o cuidados dentales? Escríbeme tu consulta.`
        ].join('\n')
      );
      return;
    }

    // 3. Marcar mensaje como leído en WhatsApp
    void WhatsAppClient.markAsRead(messageId);

    // 4. Mapeo de identidad del paciente
    const patientContext = await WhatsAppIdentityService.resolvePatientByPhone(fromPhone);

    if (!patientContext) {
      // El número no coincide con ningún paciente registrado
      await WhatsAppClient.sendTextMessage(
        fromPhone,
        [
          `🦷 *NEXOSALUD ODONTOLOGÍA*`,
          `¡Hola! Te has comunicado con el *Asistente Inteligente de NexoSalud*.`,
          ``,
          `No encontramos este número asociado a un paciente activo en nuestro sistema.`,
          ``,
          `✨ *¿Cómo podemos ayudarte?*`,
          `• *Agendar una primera cita:* https://nexosalud.pe/citas`,
          `• *Recepción y Consultas:* 📞 *(01) 234-5678*`,
          ``,
          `_Si ya eres paciente de NexoSalud, por favor indícanos tu número de DNI para vincular tu ficha médica._`
        ].join('\n')
      );
      return;
    }

    // 5. Manejo de Consentimiento (Opt-In / Opt-Out)
    const consentResponse = await WhatsAppIdentityService.handleConsentKeywords(patientContext.idPersona, userText);
    if (consentResponse) {
      await WhatsAppClient.sendTextMessage(fromPhone, consentResponse);
      return;
    }

    if (!patientContext.autorizaContacto) {
      await WhatsAppClient.sendTextMessage(
        fromPhone,
        [
          `🔒 *Comunicaciones Desactivadas*`,
          ``,
          `Tienes los avisos automáticos de NexoSalud pausados en este número.`,
          `Para reactivar la atención y poder conversar conmigo, por favor responde *INICIAR*.`
        ].join('\n')
      );
      return;
    }

    // 6. Manejo de Botones Interactivos de Adherencia y Post-Cuidado
    if (buttonId) {
      const adherenceResult = await WhatsAppAdherenceService.handleInteractiveAction(patientContext, buttonId);
      if (adherenceResult.handled && adherenceResult.replyText) {
        await WhatsAppClient.sendTextMessage(fromPhone, adherenceResult.replyText);
        return;
      }

      const postCareResult = await WhatsAppPostCareService.handlePostCareButton(patientContext, buttonId);
      if (postCareResult.handled && postCareResult.replyText) {
        await WhatsAppClient.sendTextMessage(fromPhone, postCareResult.replyText);
        return;
      }
    }

    // 7. Detección rápida de confirmación de cita en texto libre
    const quickConfirmReply = await WhatsAppAdherenceService.tryConfirmPendingSessionByText(patientContext, userText);
    if (quickConfirmReply) {
      await WhatsAppClient.sendTextMessage(fromPhone, quickConfirmReply);
      return;
    }

    // 8. Detección de consulta rápida de indicaciones post-atención
    const normalizedText = userText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,]/g, '').trim();
    const isAftercareQuery = /cuidados?|indicacion|indicaciones|receta|post[- ]?atencion|que (debo|puedo|tengo que) (hacer|tener|tomar)/i.test(normalizedText);
    if (isAftercareQuery || ['mis indicaciones', 'indicaciones', 'que cuidados debo tener', 'mis cuidados', 'receta', 'que cuidados tener'].includes(normalizedText)) {
      const formatted = await WhatsAppPostCareService.formatInstructionsForWhatsApp(patientContext.idPersona);
      await WhatsAppClient.sendTextMessage(fromPhone, formatted);
      return;
    }

    // 9. Detección rápida de respuesta a encuesta NPS (número del 0 al 10)
    const isPureNumber = /^(10|[0-9])$/.test(userText.trim());
    if (isPureNumber) {
      const score = Number(userText.trim());
      const surveyResult = await WhatsAppLoyaltyService.recordSatisfactionSurvey(patientContext, { score });
      await WhatsAppClient.sendTextMessage(fromPhone, surveyResult.replyMessage);
      return;
    }

    // 10. Ejecutar Orquestador del Agente de Inteligencia Artificial
    try {
      const principal = {
        role: 'PACIENTE' as const,
        idPersona: patientContext.idPersona
      };

      const orchestratorContext: { treatmentId?: number } = {};
      if (patientContext.activeTreatment?.idTratamiento) {
        orchestratorContext.treatmentId = patientContext.activeTreatment.idTratamiento;
      }

      console.log(`[WhatsApp Router] Consultando CustomerAiOrchestrator para paciente ${patientContext.nombres}...`);
      const agentAnswer = await customerAiOrchestrator.answer(principal, userText, orchestratorContext);
      console.log(`[WhatsApp Router] Respuesta del Agente IA: "${agentAnswer.message}"`);

      // Si el agente preparó un borrador de reprogramación con alternativas, enviamos botones o texto enriquecido
      if (agentAnswer.rescheduleDraft && agentAnswer.rescheduleDraft.alternatives.length > 0) {
        const textWithNotice = [
          agentAnswer.message,
          ``,
          `━━━━━━━━━━━━━━━━━━━`,
          `💡 *Para confirmar tu cambio:*`,
          `Puedes responder con el número de la opción que prefieres o ingresar a tu Portal del Paciente.`
        ].join('\n');
        await WhatsAppClient.sendTextMessage(fromPhone, textWithNotice);
      } else {
        await WhatsAppClient.sendTextMessage(fromPhone, agentAnswer.message);
      }
    } catch (error: any) {
      console.error(`[WhatsApp Router] Error al responder al paciente ${patientContext.idPersona}:`, error);
      await WhatsAppClient.sendTextMessage(
        fromPhone,
        [
          `🦷 *NexoSalud Odontología*`,
          `Disculpa, en este momento hubo un breve retraso al consultar tu información médica en el sistema.`,
          ``,
          `Por favor intenta formular tu pregunta nuevamente en unos instantes o comunícate con recepción al *(01) 234-5678*.`
        ].join('\n')
      );
    }
  }
}
