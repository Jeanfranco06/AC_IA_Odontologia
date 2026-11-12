import { prisma } from '../src/db';
import { patientAuthService } from '../src/services/patientAuthService';

async function main() {
  await patientAuthService.ensureSchema();
  const patients = await prisma.personas.findMany({
    where: {
      id_etapa_actual: { gte: 4 },
      dni: { not: null }
    },
    select: { id_persona: true, dni: true, nombres: true, apellidos: true }
  });

  console.log(`Configurando credenciales para ${patients.length} pacientes...`);
  const { hash, salt } = patientAuthService.hashPassword('Paciente2026!');

  for (const p of patients) {
    if (!p.dni) continue;
    const cleanDni = p.dni.trim().replace(/\D/g, '');
    const existing: any[] = await prisma.$queryRaw<any[]>`SELECT id_persona FROM CredencialesPaciente WHERE id_persona = ${p.id_persona}`;
    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE CredencialesPaciente
        SET dni = ${cleanDni}, password_hash = ${hash}, password_salt = ${salt}
        WHERE id_persona = ${p.id_persona}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO CredencialesPaciente (id_persona, dni, password_hash, password_salt, fecha_creacion)
        VALUES (${p.id_persona}, ${cleanDni}, ${hash}, ${salt}, GETDATE())
      `;
    }
  }

  console.log('✅ Credenciales de prueba configuradas exitosamente: Contraseña "Paciente2026!"');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
