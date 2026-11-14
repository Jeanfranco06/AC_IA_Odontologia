import 'dotenv/config';
import { getWhatsAppConfig } from '../modules/customer/whatsapp/config';

async function main() {
  const config = getWhatsAppConfig();
  const url = `${config.baseUrl}/${config.apiVersion}/${config.phoneNumberId}/messages`;
  console.log('URL de envío:', url);

  const payload = {
    messaging_product: 'whatsapp',
    to: '51902455346',
    type: 'template',
    template: {
      name: 'hello_world',
      language: {
        code: 'en_US'
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log('Respuesta Meta Template:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
