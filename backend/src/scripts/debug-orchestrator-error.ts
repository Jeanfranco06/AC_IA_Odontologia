import { customerAiOrchestrator } from '../modules/customer/ai-agent/llm/orchestrator';
import { WhatsAppRouterService } from '../modules/customer/whatsapp/services/whatsappRouterService';

async function main() {
  console.log('--- TEST ROUTER CON: "Sí, confirmo mi asistencia" ---');
  try {
    await WhatsAppRouterService.handleIncomingMessage({
      from: '51902455346',
      id: `test-error-${Date.now()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      text: { body: 'Sí, confirmo mi asistencia' }
    });
  } catch (err: any) {
    console.error('ERROR ATRAPADO EN MAIN:', err);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
}

main();
