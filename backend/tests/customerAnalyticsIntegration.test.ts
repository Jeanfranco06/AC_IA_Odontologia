import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import request from 'supertest';
import {Prisma} from '@prisma/client';
import {prisma} from '../src/db';
import {CustomerAnalyticsService as A,parseAnalyticsFilter} from '../src/modules/customer/ai-agent/services/customerAnalyticsService';
import {customerMartReader,verifyCustomerMartReader,closeCustomerMartReader} from '../src/db/customerMartRead';
import {assertDatabasePair} from '../src/databaseProfiles';
import {CustomerAiOrchestrator} from '../src/modules/customer/ai-agent/llm/orchestrator';
import {availableTools,executeTool} from '../src/modules/customer/ai-agent/llm/toolRegistry';
import {createCompletionFixture} from '../scripts/completion-fixture';
import {syncCertificationMart} from './helpers/syncCertificationMart';
import {assertIsolatedSqlServer} from './helpers/isolatedSqlServer';
import {issueAiAgentToken} from '../src/modules/customer/ai-agent/authContext';
import {CustomerCompletionService as C} from '../src/modules/customer/ai-agent/services/customerCompletionService';
import app from '../src/index';
import crypto from 'crypto';

describe.skipIf(process.env.AI_AGENT_SQLSERVER_INTEGRATION!=='true')('IA15–IA18: Mart SQL real, credencial de lectura y roles',()=>{
 let f:Awaited<ReturnType<typeof createCompletionFixture>>,other:typeof f;
 const filter={startDate:'2026-01-01',endDate:'2026-12-31',groupBy:'month'};
 beforeAll(async()=>{await assertIsolatedSqlServer();f=await createCompletionFixture();other=await createCompletionFixture();await prisma.atenciones.update({where:{id_atencion:f.attention.id_atencion},data:{asistencia:'Asistió',estado_servicio:'Realizado',fecha_inicio:new Date('2026-11-01T12:00:00Z'),fecha_fin:new Date('2026-11-01T12:10:00Z')}});await C.prepareClinicalDraft(f.principals.dentist,f.attention.id_atencion,'Observaciones: Nota sintética analítica',crypto.randomUUID());await syncCertificationMart();},60000);
 afterAll(closeCustomerMartReader);
 it('Credencial Mart: solo SELECT, sin DML, EXECUTE, DDL ni acceso principal',async()=>{
  expect(await verifyCustomerMartReader()).toEqual({databaseName:'NexoSalud_Mart_Test',readOnly:true});
  const [r]=await customerMartReader().$queryRaw<any[]>`SELECT HAS_DBACCESS('NexoSaludDB') oltp,HAS_DBACCESS('NexoSalud_Mart') mart`;expect(r).toEqual({oltp:0,mart:0});
  await expect(customerMartReader().$executeRaw`INSERT dbo.ETL_EjecucionLog(proceso,fecha_fin,estado) VALUES('NO_DEBE_INSERTARSE',SYSUTCDATETIME(),'TEST')`).rejects.toThrow();
  await expect(customerMartReader().$executeRaw`EXEC dbo.usp_ETL_SincronizarCustomerMart`).rejects.toThrow();
 });
 for(const kind of ['treatments','sessions','documentation','ai'] as const)it(`${kind}: agregado real y agrupación por fecha, sin identificadores de pacientes`,async()=>{
  const result=await A.query(f.principals.dentist,kind,filter,{audit:false});expect(result.source).toBe('NexoSalud_Mart_Test');expect(result.scope).toBe('PROFESIONAL_PROPIO');expect(result.freshness.state).toBe('HISTORICAL_NON_REALTIME');expect(result.groups.length).toBeGreaterThan(0);
  const raw=JSON.stringify(result);expect(raw).not.toContain(f.patient.dni);expect(raw).not.toContain(other.patient.dni);expect(raw).not.toContain('id_persona');
  const field=Object.keys(result.totals)[0];expect(result.totals[field]).toBeGreaterThan(0);
 });
 it('IA15: SQL del profesional coincide con el servicio y no agrega otro profesional',async()=>{
  const [source]=await prisma.$queryRaw<any[]>`SELECT SUM(f.tratamientos_iniciados) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer f JOIN NexoSalud_Mart_Test.dbo.Dim_Profesional d ON d.KeyProfesional=f.KeyProfesional WHERE d.id_profesional=${f.professional.id_profesional}`;
  expect((await A.query(f.principals.dentist,'treatments',filter,{audit:false})).totals.tratamientos_iniciados).toBe(Number(source.n));
  const foreign=await A.query(f.principals.dentist,'treatments',{...filter,serviceId:other.service.id_servicio},{audit:false});expect(foreign.totals.tratamientos_iniciados).toBe(0);
 });
 it('Catálogos, agrupación por sede/servicio y permisos de recepción',async()=>{
  const c=await A.catalog(f.principals.dentist);expect(c.services.some(s=>s.id===f.service.id_servicio)).toBe(true);expect(c.services.some(s=>s.id===other.service.id_servicio)).toBe(false);
  const recep=await A.catalog(f.principals.reception);expect(recep.allowed.map(v=>v.code)).toEqual(['IA15','IA16']);
  for(const groupBy of ['branch','service'])expect((await A.query(f.principals.dentist,'treatments',{...filter,groupBy},{audit:false})).groups.length).toBe(1);
  await expect(A.query(f.principals.reception,'documentation',filter)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(A.query(f.principals.patient,'treatments',filter)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('Parámetros cerrados: fecha inválida, intervalo excesivo, SQL libre e identificador inyectado',()=>{
  for(const value of [{...filter,startDate:'2026-02-30'},{...filter,endDate:'2028-01-01'},{...filter,sql:'DELETE FROM x'},{...filter,branchId:'1 OR 1=1'},{...filter,groupBy:'f.id_persona'}])expect(()=>parseAnalyticsFilter(value)).toThrow();
 });
 it('Período vacío no inventa denominador ni tendencias',async()=>{
  const r=await A.query(f.principals.dentist,'treatments',{startDate:'1901-01-01',endDate:'1901-01-02'},{audit:false});expect(r.totals.tratamientos_iniciados).toBe(0);expect(r.totals.ratePercent).toBeNull();expect(r.totals.averageDuration).toBeNull();
 });
 it('HTTP real autentica, autoriza y audita consulta agregada',async()=>{
  const endpoint='/api/customer/ai-agent/analytics/treatments';expect((await request(app).post(endpoint).send(filter)).status).toBe(401);
  expect((await request(app).post(endpoint).set('Authorization','Bearer '+issueAiAgentToken(f.principals.patient)).send(filter)).status).toBe(403);
  const r=await request(app).post(endpoint).set('Authorization','Bearer '+issueAiAgentToken(f.principals.dentist)).send(filter);expect(r.status).toBe(200);expect(r.body.data.activity).toBe('IA15');expect(await prisma.interaccionesIA.count({where:{id_usuario_actor:f.dentist.id_usuario,tipo_evento:'CONSULTA_IA15'}})).toBeGreaterThan(0);
 });
 it('Herramientas y orquestación simulada seleccionan BI sin inventar cifras',async()=>{
  expect(availableTools(f.principals.patient).some(t=>t.name==='getTreatmentAnalytics')).toBe(false);
  await expect(executeTool(f.principals.dentist,'getTreatmentAnalytics',{...filter,query:'SELECT *'})).rejects.toMatchObject({code:'INVALID_INPUT'});
  let n=0;const engine=new CustomerAiOrchestrator(()=>({complete:async()=>++n===1?{kind:'tool_call',name:'getTreatmentAnalytics',callId:'bi',arguments:JSON.stringify(filter)}:{kind:'message',text:'Invento 999999 tratamientos y recuperación clínica.'}}));
  const answer=await engine.answer(f.principals.dentist,'Explica indicadores de 2026',{mode:'analytics'});expect(answer.toolsUsed).toEqual(['getTreatmentAnalytics']);expect(answer.message).toContain('Fact_TratamientoCustomer');expect(answer.message).not.toContain('999999');expect(answer.message).toContain('no es información en tiempo real');
 });
 it('Modalidad BI impide que un proveedor invoque herramientas operacionales',async()=>{
  const engine=new CustomerAiOrchestrator(()=>({complete:async()=>({kind:'tool_call',callId:'bad',name:'getCustomerRequests',arguments:'{}'})}));await expect(engine.answer(f.principals.dentist,'Intento fuera de modalidad',{mode:'analytics'})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('Perfil rechaza mezclar principal/Test antes de abrir conexiones',()=>{
  expect(()=>assertDatabasePair('sqlserver://host;database=NexoSaludDB','sqlserver://host;database=NexoSalud_Mart_Test')).toThrow();
  expect(()=>assertDatabasePair(process.env.SQLSERVER_URL,process.env.MART_READ_URL)).not.toThrow();
 });
});
