import { prisma } from '../db';
import { hashStaffPassword } from '../services/staffAuthService';

async function main() {
  const defaultPass = hashStaffPassword('NexoSalud#2026!');

  const emails = [
    'ana.ramos@odontologia-trujillo.pe',
    'ai.odontologo.test@nexosalud.local',
    'recepcion.test@nexosalud.pe'
  ];

  for (const email of emails) {
    await prisma.usuarios.update({
      where: { email },
      data: { password_hash: defaultPass, activo: true }
    });
    console.log(`[AUTH] Contraseña configurada para: ${email} -> NexoSalud#2026!`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
