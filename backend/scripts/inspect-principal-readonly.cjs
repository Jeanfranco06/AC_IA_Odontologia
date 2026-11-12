/* Exclusivamente SELECT y una transacción de lectura; nunca invoca un procedimiento. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');require('dotenv').config({path:path.join(root,'backend/.env'),quiet:true});
const {PrismaClient}=require('@prisma/client');const ts=require('../../frontend/node_modules/typescript');const db=new PrismaClient();
const databases=['NexoSaludDB','NexoSalud_Mart','NexoSaludDB_Test','NexoSalud_Mart_Test'];
function measureQueries(){
 const ast=ts.createSourceFile('measures.ts',fs.readFileSync(path.join(root,'backend/tests/customerCompletionMart.test.ts'),'utf8'),ts.ScriptTarget.Latest,true);
 let rows;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='queries'&&ts.isArrayLiteralExpression(node.initializer))rows=node.initializer.elements.map(row=>row.elements.map(item=>{if(!ts.isStringLiteral(item))throw Error('Solo literales SQL revisados.');return item.text.replace(/NexoSalud_Mart_Test/g,'NexoSalud_Mart');}));ts.forEachChild(node,walk);}walk(ast);if(rows?.length!==20)throw Error('No se encontraron las 20 medidas.');return rows;
}
(async()=>{try{
 const report=await db.$transaction(async tx=>{
  const [identity]=await tx.$queryRawUnsafe("SELECT @@SERVERNAME serverName,DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') isSysadmin");
  if(identity.databaseName!=='NexoSaludDB')throw Error('La inspección debe apuntar explícitamente a NexoSaludDB.');
  const schemas={};
  for(const database of databases){
   schemas[database]={};const meta=schemas[database];
   meta.columns=await tx.$queryRawUnsafe(`SELECT t.name tableName,c.name columnName,ty.name typeName,c.max_length maxLength,c.is_nullable nullable,c.is_computed computed FROM ${database}.sys.tables t JOIN ${database}.sys.columns c ON c.object_id=t.object_id JOIN ${database}.sys.types ty ON ty.user_type_id=c.user_type_id ORDER BY t.name,c.column_id`);
   meta.checks=await tx.$queryRawUnsafe(`SELECT t.name tableName,c.name, c.definition,c.is_disabled disabled,c.is_not_trusted untrusted FROM ${database}.sys.check_constraints c JOIN ${database}.sys.tables t ON t.object_id=c.parent_object_id`);
   meta.foreignKeys=await tx.$queryRawUnsafe(`SELECT t.name tableName,f.name,f.is_disabled disabled,f.is_not_trusted untrusted FROM ${database}.sys.foreign_keys f JOIN ${database}.sys.tables t ON t.object_id=f.parent_object_id`);
   meta.indexes=await tx.$queryRawUnsafe(`SELECT t.name tableName,i.name,i.is_unique isUnique,i.filter_definition filterDefinition,c.name columnName,ic.key_ordinal ordinal,ic.is_included_column included FROM ${database}.sys.indexes i JOIN ${database}.sys.tables t ON t.object_id=i.object_id JOIN ${database}.sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN ${database}.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id`);
   meta.modules=await tx.$queryRawUnsafe(`SELECT o.name,o.type_desc type,m.definition FROM ${database}.sys.sql_modules m JOIN ${database}.sys.objects o ON o.object_id=m.object_id`);
  }
  const measures=[];for(const[name,source,mart]of measureQueries()){const [a]=await tx.$queryRawUnsafe(source);const[b]=await tx.$queryRawUnsafe(mart);measures.push({measure:name,oltp:Number(a.n??0),mart:Number(b.n??0),difference:Number(a.n??0)-Number(b.n??0)});}
  const unknownTypes=await tx.$queryRawUnsafe(`WITH e AS(SELECT 'INTERACCION' class,id_interaccion_ia id,tipo_evento code FROM dbo.InteraccionesIA UNION ALL SELECT 'ALERTA',id_alerta_ia,tipo_evento FROM dbo.AlertasIA UNION ALL SELECT 'BORRADOR',id_borrador_ia,tipo_evento FROM dbo.BorradoresIA) SELECT f.ClaseEventoIA class,e.code,LEN(e.code) codeLength,COUNT(*) quantity,MAX(CASE WHEN d.KeyTipoInteraccionIA IS NOT NULL THEN 1 ELSE 0 END) dimensionExists FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer f LEFT JOIN e ON e.class=f.ClaseEventoIA AND e.id=f.id_origen_ia LEFT JOIN NexoSalud_Mart.dbo.Dim_TipoInteraccionIA d ON d.CodigoTipoInteraccionIA=e.code WHERE f.KeyTipoInteraccionIA=0 GROUP BY f.ClaseEventoIA,e.code`);
  const [duplicates]=await tx.$queryRawUnsafe('SELECT COUNT(*) n FROM(SELECT ClaseEventoIA,id_origen_ia FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer GROUP BY ClaseEventoIA,id_origen_ia HAVING COUNT(*)>1)x');
  const states={};for(const [table,column]of [['TratamientosContratados','estado_tratamiento'],['Atenciones','asistencia'],['SesionesTratamiento','estado_cierre'],['ValidacionesFicha','resultado_validacion'],['AlertasIA','estado'],['BorradoresIA','estado']])states[table+'.'+column]=await tx.$queryRawUnsafe(`SELECT ${column} state,COUNT(*) quantity FROM dbo.${table} GROUP BY ${column}`);
  const [sync]=await tx.$queryRawUnsafe("SELECT MAX(fecha_fin) lastCompletedAt FROM NexoSalud_Mart.dbo.ETL_EjecucionLog WHERE proceso LIKE '%Customer%' AND estado IN('Exitoso','Completado','OK','EXITOSO')");
  const deltas={};for(const [main,test]of [[databases[0],databases[2]],[databases[1],databases[3]]]){
   const signature=r=>JSON.stringify([r.typeName,r.maxLength,r.nullable,r.computed]);const old=new Map(schemas[main].columns.map(r=>[r.tableName+'.'+r.columnName,r]));
   deltas[main]={missingColumns:schemas[test].columns.filter(r=>!old.has(r.tableName+'.'+r.columnName)),changedColumns:schemas[test].columns.filter(r=>old.has(r.tableName+'.'+r.columnName)&&signature(old.get(r.tableName+'.'+r.columnName))!==signature(r)),changedModules:[]};
   for(const module of schemas[test].modules){const previous=schemas[main].modules.find(r=>r.name===module.name);const normalize=s=>(s||'').replace(/NexoSaludDB_Test/g,'NexoSaludDB').replace(/NexoSalud_Mart_Test/g,'NexoSalud_Mart').replace(/\r\n/g,'\n').trim();if(normalize(previous?.definition)!==normalize(module.definition))deltas[main].changedModules.push({name:module.name,installed:!!previous,mainHash:crypto.createHash('sha256').update(normalize(previous?.definition)).digest('hex'),testHash:crypto.createHash('sha256').update(normalize(module.definition)).digest('hex')});}
  }
  return {mode:'READ_ONLY_SELECT',cut:'SERIALIZABLE_TRANSACTION_SAME_INSTANCE',timestamp:new Date().toISOString(),identity,schemas,deltas,measures,unknownTypes,duplicateGroups:duplicates.n,lastSync:sync?.lastCompletedAt??null,states};
 },{isolationLevel:'Serializable',timeout:60000});
 const folder=path.join(root,'backend/storage/principal-integration');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'inspection.private.json'),JSON.stringify(report,(_,v)=>typeof v==='bigint'?v.toString():v,2));
 console.log(JSON.stringify({mode:report.mode,identity:report.identity,deltas:report.deltas,measures:report.measures,unknownTypes:report.unknownTypes,states:report.states,duplicateGroups:report.duplicateGroups},null,2));
 }finally{await db.$disconnect();}})().catch(error=>{console.error('Inspección fallida:',error.code||error.message);process.exitCode=1;});
