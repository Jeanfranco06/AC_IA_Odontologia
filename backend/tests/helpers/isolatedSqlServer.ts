import { prisma } from '../../src/db';

/** Read-only attestation BEFORE any suite creates, deletes, resets or invokes ETL. */
export async function assertIsolatedSqlServer() {
  const expected = process.env.AI_AGENT_TEST_SQLSERVER_INSTANCE?.trim();
  if (!expected) throw new Error('Integraci?n bloqueada: falta instancia aislada autorizada.');
  const [row] = await prisma.$queryRaw<Array<{ databaseName: string; serverName: string; isSysadmin: number }>>`SELECT DB_NAME() AS databaseName, CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS serverName, IS_SRVROLEMEMBER('sysadmin') AS isSysadmin`;
  if (row?.databaseName !== 'NexoSaludDB_Test' || row.serverName?.toLowerCase() !== expected.toLowerCase() || Number(row.isSysadmin) !== 0) {
    throw new Error('Integraci?n bloqueada: requiere NexoSaludDB_Test, instancia autorizada y credencial sin sysadmin.');
  }
}
