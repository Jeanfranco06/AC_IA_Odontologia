import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Associating Daniel treatment and sessions to Dra. Valeria Mendoza (id_profesional = 1)...');

  // 1. Update TratamientosContratados (ID: 3)
  const trat = await prisma.tratamientosContratados.update({
    where: { id_tratamiento: 3 },
    data: {
      id_profesional_responsable: 1,
      id_sede: 1,
    },
  });
  console.log('Updated Tratamiento 3. Profesional:', trat.id_profesional_responsable);

  // 2. Update SesionesTratamiento (7 & 8)
  await prisma.sesionesTratamiento.update({
    where: { id_sesion: 7 },
    data: {
      id_profesional: 1,
      id_sede: 1,
    },
  });
  await prisma.sesionesTratamiento.update({
    where: { id_sesion: 8 },
    data: {
      id_profesional: 1,
      id_sede: 1,
    },
  });
  console.log('Updated Sesiones 7 & 8 to id_profesional = 1');

  // 3. Update Attention 50
  await prisma.atenciones.update({
    where: { id_atencion: 50 },
    data: {
      id_profesional: 1,
      id_sede: 1,
      id_sesion: 7,
      id_tratamiento: 3,
      estado_servicio: 'Programado',
    },
  });
  console.log('Updated Atencion 50 to id_profesional = 1 and Sesion 7');

  // 4. Cancel other atenciones (100, 150)
  await prisma.atenciones.updateMany({
    where: {
      id_atencion: { in: [100, 150] },
    },
    data: {
      estado_servicio: 'Cancelado',
    },
  });
  console.log('Marked atenciones 100 & 150 as Cancelado');

  // 5. Raw SQL for Disponibilidad of Dra. Valeria Mendoza (1)
  // Note: disponible is a computed column, so we only insert (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
  const sql = `
    IF NOT EXISTS (SELECT 1 FROM dbo.Disponibilidad WHERE id_profesional = 1 AND fecha = '2026-11-16' AND CAST(hora_inicio AS VARCHAR) LIKE '15:00%')
    BEGIN
      INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
      VALUES (1, 1, '2026-11-16', CAST('15:00:00' AS TIME), CAST('19:00:00' AS TIME), 'Disponible');
    END;
    IF NOT EXISTS (SELECT 1 FROM dbo.Disponibilidad WHERE id_profesional = 1 AND fecha = '2026-11-17' AND CAST(hora_inicio AS VARCHAR) LIKE '09:00%')
    BEGIN
      INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
      VALUES (1, 1, '2026-11-17', CAST('09:00:00' AS TIME), CAST('13:00:00' AS TIME), 'Disponible');
    END;
    IF NOT EXISTS (SELECT 1 FROM dbo.Disponibilidad WHERE id_profesional = 1 AND fecha = '2026-11-19' AND CAST(hora_inicio AS VARCHAR) LIKE '14:00%')
    BEGIN
      INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
      VALUES (1, 1, '2026-11-19', CAST('14:00:00' AS TIME), CAST('18:00:00' AS TIME), 'Disponible');
    END;
  `;
  await prisma.$executeRawUnsafe(sql);
  console.log('Inserted availability slots for Dra. Valeria Mendoza successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
