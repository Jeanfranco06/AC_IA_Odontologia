import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update Nov 17 slot: hora_inicio 14:00 (which is 09:00 AM Lima time: 14:00 UTC)
  await prisma.$executeRawUnsafe(`
    UPDATE dbo.Disponibilidad 
    SET hora_inicio = CAST('14:00:00' AS TIME), hora_fin = CAST('18:00:00' AS TIME)
    WHERE id_profesional = 1 AND fecha = '2026-11-17';

    UPDATE dbo.Disponibilidad 
    SET hora_inicio = CAST('19:00:00' AS TIME), hora_fin = CAST('22:00:00' AS TIME)
    WHERE id_profesional = 1 AND fecha = '2026-11-19';
  `);

  // Delete all existing test solicitudes for Daniel
  await prisma.solicitudesReprogramacionCustomer.deleteMany({
    where: { id_persona: 1 },
  });

  console.log('Slots updated to proper Lima daytime and test solicitudes cleared.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
