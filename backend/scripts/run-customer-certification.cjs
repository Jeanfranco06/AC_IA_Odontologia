const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../.env.customer-cert.local'),override:true,quiet:true});
process.env.CUSTOMER_CERT_ENV=path.join(__dirname,'../.env.customer-cert.local');
process.env.NODE_ENV='test';
process.env.AI_AGENT_LLM_ENABLED='true';process.env.AI_AGENT_EXTERNAL_DATA_AUTHORIZED='true';
process.env.AI_AGENT_ALLOW_REAL_GEMINI='false';process.env.GEMINI_API_KEY='';
process.env.CUSTOMER_KNOWLEDGE_STORAGE_DIR=path.join(__dirname,'../storage/certification/rag');
process.env.MART_CONNECTION_STRING='';process.env.OLTP_CONNECTION_STRING='';
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 try {
  const [row]=await db.$queryRawUnsafe("SELECT DB_NAME() AS db,CAST(SERVERPROPERTY('ServerName') AS NVARCHAR(128)) AS instance,IS_SRVROLEMEMBER('sysadmin') AS isAdmin,HAS_DBACCESS('NexoSaludDB') AS operationalOltpAccess,HAS_DBACCESS('NexoSalud_Mart') AS operationalMartAccess,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS canAlter");
  if(row.db!=='NexoSaludDB_Test'||row.instance.toLowerCase()!==process.env.AI_AGENT_TEST_SQLSERVER_INSTANCE.toLowerCase()||row.isAdmin!==0||row.operationalOltpAccess!==0||row.operationalMartAccess!==0||row.canAlter!==0)throw Error('Identidad de ejecución no aislada o con permisos excesivos.');
  const modules=await db.$queryRawUnsafe("SELECT definition FROM sys.sql_modules");
  if(modules.some(row=>/\bNexoSalud(?:DB|_Mart)\b/i.test(row.definition||'')))throw Error('Procedimientos con referencias operativas.');
  console.log('Entorno verificado: Test, cuenta sin sysadmin/DDL y sin acceso a ambas bases operativas.');
 } finally {await db.$disconnect();}
 const args=process.argv.slice(2);
 if(args[0]==='verify')return;
 const {spawnSync}=require('child_process');
 const result=spawnSync(process.execPath,[require.resolve('vitest/vitest.mjs'),'run','--fileParallelism=false',...args],{cwd:path.join(__dirname,'..'),env:process.env,stdio:'inherit'});
 process.exitCode=result.status??1;
})().catch(()=>{console.error('Certificación bloqueada: verifique la configuración aislada sin exponer secretos.');process.exitCode=1;});
