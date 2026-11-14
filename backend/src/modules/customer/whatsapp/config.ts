import { WhatsAppConfig } from './types';

export function getWhatsAppConfig(): WhatsAppConfig {
  const enabled = process.env.WHATSAPP_ENABLED === 'true';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexosalud_wa_verify_token_2026';
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const baseUrl = process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';

  return {
    enabled,
    phoneNumberId,
    accessToken,
    verifyToken,
    appSecret,
    apiVersion,
    baseUrl
  };
}
