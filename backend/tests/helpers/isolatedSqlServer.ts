import { prisma } from '../../src/db';

/** Read-only attestation BEFORE any suite creates, deletes, resets or invokes ETL. */
export async function assertIsolatedSqlServer() {
  const expected = process.env.AI_AGENT_TEST_SQLSERVER_INSTANCE?.trim();
  if (!expected) throw new Error('Integración bloqueada: falta instancia aislada autorizada.');
  const [row] = await prisma.$queryRaw<Array<{ databaseName: string; serverName: string; isSysadmin: number }>>`SELECT DB_NAME() AS databaseName, CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) AS serverName, IS_SRVROLEMEMBER('sysadmin') AS isSysadmin`;
  if (row?.databaseName !== 'NexoSaludDB_Test' || row.serverName?.toLowerCase() !== expected.toLowerCase() || Number(row.isSysadmin) !== 0) {
    throw new Error('Integración bloqueada: requiere NexoSaludDB_Test, instancia autorizada y credencial sin sysadmin.');
  }
  const [permissions]=await prisma.$queryRaw<Array<{operationalAccess:number;martAccess:number;ddl:number;trustworthy:number;chaining:number;viewDefinition:number}>>`SELECT HAS_DBACCESS('NexoSaludDB') AS operationalAccess,HAS_DBACCESS('NexoSalud_Mart') AS martAccess,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS ddl,CAST(is_trustworthy_on AS int) AS trustworthy,CAST(is_db_chaining_on AS int) AS chaining,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') AS viewDefinition FROM sys.databases WHERE name=DB_NAME()`;
  if(permissions.operationalAccess!==0||permissions.martAccess!==0||permissions.ddl!==0||permissions.trustworthy!==0||permissions.chaining!==0||permissions.viewDefinition!==1)throw new Error('Aislamiento insuficiente: acceso operativo, DDL, confianza o metadatos no verificables.');
}
