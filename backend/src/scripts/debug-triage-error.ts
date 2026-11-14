import { WhatsAppRouterService } from '../modules/customer/whatsapp/services/whatsappRouterService';

async function main() {
  console.log('--- TEST ROUTER CON SÍNTOMAS ---');
  try {
    await WhatsAppRouterService.handleIncomingMessage({
      from: '51902455346',
      id: `test-triage-err-${Date.now()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      text: { body: 'Tengo un dolor muy fuerte y sangrado que no para' }
    });
  } catch (err: any) {
    console.error('ERROR ATRAPADO EN MAIN:', err);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
}

main();
