import { getWhatsAppConfig } from '../config';
import { WhatsAppOutgoingMessageResult } from '../types';

export class WhatsAppClient {
  private static async request(endpoint: string, body: Record<string, unknown>): Promise<WhatsAppOutgoingMessageResult> {
    const config = getWhatsAppConfig();

    if (!config.enabled || process.env.NODE_ENV === 'test') {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[WhatsApp Client (Simulado)] Envío a ${endpoint}:`, JSON.stringify(body, null, 2));
      }
      return { success: true, messageId: `mock-wa-msg-${Date.now()}` };
    }

    if (!config.phoneNumberId || !config.accessToken) {
      console.warn('[WhatsApp Client] Falta WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN.');
      return { success: false, error: 'Credenciales de WhatsApp incompletas.' };
    }

    const url = `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json() as any;

      if (!response.ok) {
        if (data?.error?.code === 190) {
          console.error('⚠️ [WhatsApp Auth Error] El token de Meta (WHATSAPP_ACCESS_TOKEN) ha expirado (OAuthException Code 190). Renuévalo en developers.facebook.com -> WhatsApp -> API Setup.');
        } else {
          console.error('[WhatsApp Client Error]', data);
        }
        return {
          success: false,
          error: data?.error?.message || `Error HTTP ${response.status} de Meta WhatsApp API`
        };
      }

      const messageId = data?.messages?.[0]?.id;
      const recipient = (body as any)?.to || endpoint;
      console.log(`[WhatsApp Client] Mensaje enviado a Meta (${recipient}) exitosamente. ID: ${messageId}`);
      return { success: true, messageId };
    } catch (error: any) {
      console.error('[WhatsApp Client Exception]', error);
      return { success: false, error: error.message || 'Error de red con WhatsApp API' };
    }
  }

  static normalizePhoneNumber(to: string): string {
    let clean = (to || '').replace(/\D/g, '');
    if (!clean) return '';
    // En Perú, los móviles tienen 9 dígitos y empiezan con 9. Anteponer 51 si falta.
    if (clean.length === 9 && clean.startsWith('9')) {
      clean = `51${clean}`;
    }
    return clean;
  }

  /**
   * Envía un mensaje de texto simple.
   */
  static async sendTextMessage(to: string, text: string): Promise<WhatsAppOutgoingMessageResult> {
    const cleanTo = this.normalizePhoneNumber(to);
    if (!cleanTo) {
      console.warn('[WhatsApp Client] Teléfono destinatario ausente o inválido:', to);
      return { success: false, error: 'Teléfono destinatario inválido' };
    }
    return this.request('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { preview_url: false, body: text }
    });
  }

  /**
   * Envía un mensaje interactivo con botones de respuesta rápida (máximo 3 botones).
   */
  static async sendQuickReplyButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<WhatsAppOutgoingMessageResult> {
    const cleanTo = this.normalizePhoneNumber(to);
    if (!cleanTo) {
      console.warn('[WhatsApp Client] Teléfono destinatario ausente o inválido:', to);
      return { success: false, error: 'Teléfono destinatario inválido' };
    }
    const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
      type: 'reply',
      reply: {
        id: btn.id || `btn_${index}`,
        title: btn.title.slice(0, 20) // Meta limita títulos a 20 caracteres
      }
    }));

    const interactivePayload: any = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: formattedButtons }
    };

    if (headerText) {
      interactivePayload.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactivePayload.footer = { text: footerText };
    }

    return this.request('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: interactivePayload
    });
  }

  /**
   * Sube un archivo multimedia a Meta Graph API y devuelve el ID de media generado.
   */
  static async uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    const config = getWhatsAppConfig();
    if (!config.enabled || !config.phoneNumberId || !config.accessToken) {
      return null;
    }

    try {
      const url = `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}/media`;
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append('file', blob, filename);
      formData.append('type', mimeType);
      formData.append('messaging_product', 'whatsapp');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        },
        body: formData
      });

      const data = await response.json() as any;
      if (!response.ok) {
        console.error('[WhatsApp Client Media Upload Error]', data);
        return null;
      }

      console.log(`[WhatsApp Client] Media subida exitosamente a Meta. ID: ${data?.id}`);
      return data?.id || null;
    } catch (err) {
      console.error('[WhatsApp Client Media Upload Exception]', err);
      return null;
    }
  }

  /**
   * Envía una imagen por URL pública o por ID de media de Meta.
   */
  static async sendImageMessage(
    to: string,
    imageSource: { link?: string; id?: string },
    caption?: string
  ): Promise<WhatsAppOutgoingMessageResult> {
    const cleanTo = this.normalizePhoneNumber(to);
    if (!cleanTo) {
      console.warn('[WhatsApp Client] Teléfono destinatario ausente o inválido:', to);
      return { success: false, error: 'Teléfono destinatario inválido' };
    }

    const imagePayload: any = {};
    if (imageSource.id) {
      imagePayload.id = imageSource.id;
    } else if (imageSource.link) {
      imagePayload.link = imageSource.link;
    } else {
      return { success: false, error: 'Debe especificarse link o id de la imagen' };
    }

    if (caption) {
      imagePayload.caption = caption;
    }

    return this.request('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'image',
      image: imagePayload
    });
  }

  /**
   * Sube un buffer y envía directamente la imagen a WhatsApp. Si falla la subida por buffer y hay link opcional, intenta con link.
   */
  static async sendImageBuffer(
    to: string,
    buffer: Buffer,
    filename: string,
    mimeType = 'image/png',
    caption?: string,
    fallbackUrl?: string
  ): Promise<WhatsAppOutgoingMessageResult> {
    const mediaId = await this.uploadMedia(buffer, mimeType, filename);
    if (mediaId) {
      return this.sendImageMessage(to, { id: mediaId }, caption);
    }
    if (fallbackUrl) {
      console.log('[WhatsApp Client] Fallback a envío de imagen por link público:', fallbackUrl);
      return this.sendImageMessage(to, { link: fallbackUrl }, caption);
    }
    return { success: false, error: 'No se pudo subir la imagen a Meta WhatsApp' };
  }

  /**
   * Marca un mensaje entrante como leído en WhatsApp.
   */
  static async markAsRead(messageId: string): Promise<void> {
    const config = getWhatsAppConfig();
    if (!config.enabled || !config.phoneNumberId || !config.accessToken) return;

    try {
      await fetch(`${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        })
      });
    } catch (err) {
      console.warn('[WhatsApp Client] No se pudo marcar mensaje como leído:', err);
    }
  }
}
