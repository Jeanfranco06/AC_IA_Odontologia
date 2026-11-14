import { prisma } from '../db';
import { WhatsAppAdherenceService } from '../modules/customer/whatsapp/services/whatsappAdherenceService';

async function main() {
  const p = await prisma.personas.findUnique({
    where: { id_persona: 1 }
  });
  console.log('PERSONA_1:', p ? { id: p.id_persona, nombres: p.nombres, numero: p.numero } : 'NONE');
  await prisma.personas.update({
    where: { id_persona: 1 },
    data: { numero: '902455346' }
  });
  console.log('PERSONA_1 ACTUALIZADA A 902455346');
  const res = await WhatsAppAdherenceService.sendImmediateSessionReminder({ personId: 1 });
  console.log('RESULTADO_SEND_IMMEDIATE_DIRECT:', res);
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
