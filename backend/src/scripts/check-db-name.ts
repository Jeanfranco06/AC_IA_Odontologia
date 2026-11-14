import { prisma } from '../db';

async function checkDb() {
  const result: any = await prisma.$queryRawUnsafe(`
    SELECT DB_NAME() AS CurrentDB, USER_NAME() AS CurrentUser, SCHEMA_NAME() AS CurrentSchema;
  `);
  console.log(result);
}

checkDb().catch(console.error).finally(() => prisma.$disconnect());
