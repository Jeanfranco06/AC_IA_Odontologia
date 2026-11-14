import crypto from 'crypto';
import { getWhatsAppConfig } from '../config';

// Caché en memoria para deduplicación de mensajes (wamid) con TTL de 1 hora
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hora

function cleanupOldMessages() {
  const now = Date.now();
  for (const [id, timestamp] of processedMessages.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
}

// Limpieza periódica cada 15 minutos
setInterval(cleanupOldMessages, 15 * 60 * 1000).unref();

export class WhatsAppSecurityService {
  /**
   * Valida la firma criptográfica HMAC-SHA256 del webhook de Meta.
   * Header: X-Hub-Signature-256 = "sha256=abcdef..."
   */
  static verifySignature(rawBody: string | Buffer | undefined, signatureHeader: string | undefined): boolean {
    const config = getWhatsAppConfig();
    
    // Si se especifica omitir verificación de firma para pruebas de desarrollo local (nunca en test ni en producción)
    if (process.env.WHATSAPP_SKIP_SIGNATURE_VERIFY === 'true' && process.env.NODE_ENV !== 'test') {
      console.log('[WhatsApp Security] Omitiendo verificación de firma por WHATSAPP_SKIP_SIGNATURE_VERIFY=true');
      return true;
    }

    // Si no hay appSecret configurado en desarrollo, se permite solo si no estamos en producción
    if (!config.appSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[WhatsApp Security] WHATSAPP_APP_SECRET es obligatorio en producción.');
        return false;
      }
      return true;
    }

    if (!rawBody || !signatureHeader) {
      console.warn('[WhatsApp Security] rawBody o signatureHeader faltante.');
      return false;
    }

    const [scheme, signature] = signatureHeader.split('=');
    if (scheme !== 'sha256' || !signature) {
      console.warn('[WhatsApp Security] Formato de firma inválido (se esperaba sha256=...):', signatureHeader);
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', config.appSecret);
      if (Buffer.isBuffer(rawBody)) {
        hmac.update(rawBody);
      } else {
        hmac.update(Buffer.from(rawBody, 'utf8'));
      }
      const expectedSignature = hmac.digest('hex');
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        console.warn(`[WhatsApp Security] Longitud de firma HMAC distinta. Recibida: ${signatureBuffer.length}, Calculada: ${expectedBuffer.length}`);
        return false;
      }

      const match = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
      if (!match) {
        console.warn(`[WhatsApp Security] HMAC no coincide. Esperado: ${expectedSignature.substring(0, 10)}... Recibido: ${signature.substring(0, 10)}...`);
      }
      return match;
    } catch (error) {
      console.error('[WhatsApp Security] Error calculando HMAC:', error);
      return false;
    }
  }

  /**
   * Comprueba si un mensaje (wamid) ya fue procesado para evitar duplicados por reintentos de Meta.
   */
  static isDuplicate(messageId: string): boolean {
    if (!messageId) return false;
    return processedMessages.has(messageId);
  }

  /**
   * Registra un mensaje procesado con timestamp actual.
   */
  static markAsProcessed(messageId: string): void {
    if (!messageId) return;
    processedMessages.set(messageId, Date.now());
  }

  /**
   * Valida el token de verificación del handshake de Meta Webhooks (GET /webhook).
   */
  static verifyWebhookToken(mode: string | undefined, token: string | undefined): boolean {
    const config = getWhatsAppConfig();
    return mode === 'subscribe' && token === config.verifyToken;
  }
}
