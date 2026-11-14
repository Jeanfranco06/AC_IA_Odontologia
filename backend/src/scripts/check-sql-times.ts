import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.$queryRawUnsafe(
    'SELECT TOP 5 id_disponibilidad, fecha, CAST(hora_inicio AS VARCHAR) as h_inicio, CAST(hora_fin AS VARCHAR) as h_fin FROM dbo.Disponibilidad WHERE id_disponibilidad IN (4598, 4599, 4600)'
  );
  console.log('SQL SERVER RAW TIME VALUES:', r);
}

main().finally(() => prisma.$disconnect());
