import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Aligning Disponibilidad rows to local Lima clock time (09:00:00, 10:00:00, 14:00:00)...');
  
  // Clean duplicates first
  await prisma.$executeRawUnsafe(`
    DELETE FROM dbo.Disponibilidad 
    WHERE id_profesional = 1 AND fecha >= '2026-11-16';

    -- Lunes 16 de Noviembre: Turno Tarde 15:00 a 19:00
    INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
    VALUES (1, 1, '2026-11-16', CAST('15:00:00' AS TIME), CAST('19:00:00' AS TIME), 'Disponible');

    -- Martes 17 de Noviembre: Turno Mañana 09:00 a 13:00 (Para la cita solicitada a las 09:00)
    INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
    VALUES (1, 1, '2026-11-17', CAST('09:00:00' AS TIME), CAST('13:00:00' AS TIME), 'Disponible');

    -- Jueves 19 de Noviembre: Turno Tarde 14:00 a 18:00
    INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
    VALUES (1, 1, '2026-11-19', CAST('14:00:00' AS TIME), CAST('18:00:00' AS TIME), 'Disponible');
  `);

  console.log('Disponibilidad cleanly refreshed.');
}

main().finally(() => prisma.$disconnect());
