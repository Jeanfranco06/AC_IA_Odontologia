import { getWhatsAppConfig } from '../modules/customer/whatsapp/config';

async function main() {
  const cfg = getWhatsAppConfig();
  const url = `${cfg.baseUrl}/${cfg.apiVersion}/${cfg.phoneNumberId}`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` }
  });
  const data: any = await res.json();
  console.log('Datos del número de WhatsApp en Meta:');
  console.log(JSON.stringify(data, null, 2));

  if (data?.display_phone_number) {
    const rawDigits = data.display_phone_number.replace(/\D/g, '');
    console.log(`\n👉 ENLACE DIRECTO DE WHATSAPP: https://wa.me/${rawDigits}`);
  }
}

main().catch(console.error);
