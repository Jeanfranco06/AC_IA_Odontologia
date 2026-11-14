import { prisma } from '../db';
import { patientAuthService } from '../services/patientAuthService';

async function main() {
  await patientAuthService.ensureSchema();

  // Daniel García (id_persona: 1, dni: '40000001')
  const persona = await prisma.personas.findUnique({
    where: { id_persona: 1 }
  });

  if (!persona) {
    console.error('No se encontró a Daniel García (ID 1)');
    process.exit(1);
  }

  // Asegurar que su etapa sea 4 (CUSTOMER)
  await prisma.personas.update({
    where: { id_persona: 1 },
    data: { id_etapa_actual: 4, dni: '40000001' }
  });

  // Hashear contraseña para el paciente: Paciente#2026!
  const { hash, salt } = patientAuthService.hashPassword('Paciente#2026!');

  // Insertar o actualizar en CredencialesPaciente
  const existing: any[] = await prisma.$queryRaw<any[]>`
    SELECT id_credencial FROM CredencialesPaciente WHERE id_persona = 1
  `;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE CredencialesPaciente
      SET password_hash = ${hash}, password_salt = ${salt}, dni = '40000001'
      WHERE id_persona = 1
    `;
    console.log('[AUTH PACIENTE] Credencial actualizada para Daniel García (DNI: 40000001, Pass: Paciente#2026!)');
  } else {
    await prisma.$executeRaw`
      INSERT INTO CredencialesPaciente (id_persona, dni, password_hash, password_salt, fecha_creacion)
      VALUES (1, '40000001', ${hash}, ${salt}, GETDATE())
    `;
    console.log('[AUTH PACIENTE] Credencial creada para Daniel García (DNI: 40000001, Pass: Paciente#2026!)');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
