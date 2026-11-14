export interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  apiVersion: string;
  baseUrl: string;
}

export interface WhatsAppInboundWebhook {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value?: {
        messaging_product: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id: string;
        }>;
        messages?: Array<WhatsAppRawMessage>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppRawMessage {
  from: string;
  id: string; // wamid.HBg...
  timestamp: string;
  type: 'text' | 'interactive' | 'button' | 'image' | 'audio' | 'document' | 'unsupported';
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    payload: string;
    text: string;
  };
}

export interface WhatsAppPatientContext {
  idPersona: number;
  nombres: string;
  apellidos: string;
  numero: string;
  dni: string | null;
  autorizaContacto: boolean;
  activeTreatment?: {
    idTratamiento: number;
    servicioNombre: string;
    estadoTratamiento: string;
    idProfesionalResponsable?: number | null;
  };
}

export interface WhatsAppOutgoingMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
