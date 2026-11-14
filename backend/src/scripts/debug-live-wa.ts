import { WhatsAppRouterService } from '../modules/customer/whatsapp/services/whatsappRouterService';

async function main() {
  console.log('--- TEST ROUTER CON: "Sí, confirmo mi asistencia" ---');
  await WhatsAppRouterService.handleIncomingMessage({
    from: '51902455346',
    id: `test-confirma-live-${Date.now()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'text',
    text: { body: 'Sí, confirmo mi asistencia' }
  });
  console.log('--- COMPLETADO ---');
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
