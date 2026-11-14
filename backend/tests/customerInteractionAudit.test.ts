import {beforeEach,afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/db',()=>{
  const model=()=>({findUnique:vi.fn(),findFirst:vi.fn(),findMany:vi.fn(),create:vi.fn()});
  const prisma:any={interaccionesIA:model(),personas:model(),tratamientosContratados:model(),sesionesTratamiento:model(),atenciones:model(),alertasIA:model(),borradoresIA:model()};
  prisma.$transaction=vi.fn(async(fn:any)=>fn(prisma));
  return {prisma,withRetry:(fn:any)=>fn()};
});
import {prisma} from '../src/db';
import {persistCustomerInteraction} from '../src/services/customerInteractionAudit';
import {CustomerAiPersistenceService as P} from '../src/services/customerAiPersistenceService';
import {auditCustomer} from '../src/modules/customer/ai-agent/services/customerCompletionService';
import {CustomerAiOrchestrator} from '../src/modules/customer/ai-agent/llm/orchestrator';
import {CustomerAiQueryService as Q} from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import {durableKnowledgeService as kb} from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import {AiAgentError} from '../src/modules/customer/ai-agent/types';
const db=prisma as any;
const admin={role:'ADMIN' as const,idUsuario:1};
beforeEach(()=>{
  vi.resetAllMocks();db.$transaction.mockImplementation(async(fn:any)=>fn(db));
  db.interaccionesIA.create.mockImplementation(async({data}:any)=>({id_interaccion_ia:1,...data}));
  for(const model of ['interaccionesIA','alertasIA','borradoresIA','tratamientosContratados'])db[model].findMany.mockResolvedValue([]);
  db.personas.findUnique.mockResolvedValue({id_persona:10});
  vi.stubEnv('AI_AGENT_LLM_ENABLED','true');vi.stubEnv('AI_AGENT_LLM_PROVIDER','gemini');vi.stubEnv('AI_AGENT_EXTERNAL_DATA_AUTHORIZED','true');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

it('reintentar el mismo evento no duplica; otra acción supervisada conserva su identidad',async()=>{
  const rows:any[]=[];
  db.interaccionesIA.create.mockImplementation(async({data}:any)=>{const row={id_interaccion_ia:rows.length+1,...data};rows.push(row);return row;});
  db.interaccionesIA.findFirst.mockImplementation(async({where}:any)=>rows.find(r=>r.id_correlacion===where.id_correlacion&&r.tipo_evento===where.tipo_evento));
  const first=await auditCustomer(admin,'FICHA_VALIDADA',{attentionId:20,reviewed:true},'Completa','same-operation');
  const retry=await auditCustomer(admin,'FICHA_VALIDADA',{attentionId:20,reviewed:true},'Completa','same-operation');
  const closed=await auditCustomer(admin,'CIERRE_SESION_PROFESIONAL',{attentionId:20,reviewed:true},'Cerrada','same-operation');
  expect(retry).toEqual(first);expect(closed.id_interaccion_ia).not.toBe(first.id_interaccion_ia);expect(rows).toHaveLength(2);
});

it('recupera un conflicto transaccional sin cambiar la identidad del evento',async()=>{
  db.$transaction.mockRejectedValueOnce({code:'P2034'}).mockImplementation(async(fn:any)=>fn(db));
  const result=await persistCustomerInteraction({tipo_evento:'CONVERSACION_AGENTE',actor_orientado:'ADMIN',id_usuario_actor:1,id_correlacion:'operation-conflict'});
  expect(result.id_correlacion).toBe('operation-conflict');expect(db.interaccionesIA.create).toHaveBeenCalledOnce();
});

it('no copia el texto, síntomas, DNI o secretos de la consulta ni del resultado al evento',async()=>{
  const secret='DNI 99999999; síntoma privado; API_KEY=secreto';
  await P.registrarInteraccion({idPersona:10,actorOrientado:'PACIENTE',tipoEvento:'CONVERSACION_AGENTE',resumenConsulta:secret,resultado:secret,idCorrelacion:'privacy-test'});
  const data=db.interaccionesIA.create.mock.calls[0][0].data;
  expect(JSON.stringify(data)).not.toContain(secret);expect(data.id_persona).toBe(10);expect(data.id_correlacion).toBe('privacy-test');
});

it('rechaza metadatos de una sesión ajena aunque no se haya proporcionado tratamiento',async()=>{
  db.sesionesTratamiento.findUnique.mockResolvedValue({id_sesion:7,id_tratamiento:99,TratamientosContratados:{id_persona:99}});
  await expect(P.registrarInteraccion({idPersona:10,idSesion:7,actorOrientado:'PACIENTE',tipoEvento:'CONSULTA',resumenConsulta:'Consulta'})).rejects.toThrow('no pertenece');
  expect(db.interaccionesIA.create).not.toHaveBeenCalled();
});

it('una consulta no se registra como revisión humana y una validación explícita sí',async()=>{
  await auditCustomer(admin,'CONSULTA_ESTADO_DOCUMENTAL',{},'Completada');
  await auditCustomer({role:'ODONTOLOGO',idUsuario:3,idProfesional:2},'FICHA_VALIDADA',{attentionId:20,reviewed:true},'Completa');
  expect(db.interaccionesIA.create.mock.calls[0][0].data).toMatchObject({id_usuario_actor:1,id_usuario_revisor:null});
  expect(db.interaccionesIA.create.mock.calls[1][0].data).toMatchObject({id_usuario_actor:3,id_usuario_revisor:3});
});

it('respaldo RAG registra un desenlace recuperado y no una conversación fallida adicional',async()=>{
  vi.stubEnv('AI_AGENT_RAG_FALLBACK_ENABLED','true');
  vi.spyOn(kb,'search').mockResolvedValue({sufficientEvidence:false,results:[]} as any);
  const provider={complete:vi.fn().mockRejectedValue(new AiAgentError('SERVICE_UNAVAILABLE','Proveedor no disponible'))};
  const result=await new CustomerAiOrchestrator(()=>provider).answer(admin,'Consulta institucional simulada');
  expect(db.interaccionesIA.create).toHaveBeenCalledOnce();expect(db.interaccionesIA.create.mock.calls[0][0].data).toMatchObject({tipo_evento:'CONVERSACION_RAG_LOCAL',id_correlacion:result.correlationId,estado:'Completada'});
});

it('fuente revocada durante respaldo RAG solo registra fracaso, sin evento de éxito',async()=>{
  vi.stubEnv('AI_AGENT_RAG_FALLBACK_ENABLED','true');vi.spyOn(kb,'search').mockResolvedValue({sufficientEvidence:true,results:[{reference:{},excerpt:'Texto simulado'}]} as any);vi.spyOn(kb,'getReference').mockReturnValue(null);
  const provider={complete:vi.fn().mockRejectedValue(new AiAgentError('SERVICE_UNAVAILABLE','Proveedor no disponible'))};
  await expect(new CustomerAiOrchestrator(()=>provider).answer(admin,'Consulta simulada')).rejects.toMatchObject({code:'SERVICE_UNAVAILABLE'});
  expect(db.interaccionesIA.create).toHaveBeenCalledOnce();expect(db.interaccionesIA.create.mock.calls[0][0].data.tipo_evento).toBe('CONVERSACION_FALLIDA');
});

it('búsqueda interna operativa genera una conversación, sin una segunda auditoría de consulta',async()=>{
  const provider={complete:vi.fn().mockResolvedValueOnce({kind:'tool_call',callId:'c1',name:'getOperationalTreatments',arguments:'{"search":"Simulado"}'}).mockResolvedValueOnce({kind:'message',text:'No se encontraron tratamientos.'})};
  await new CustomerAiOrchestrator(()=>provider).answer(admin,'Busca el tratamiento simulado');
  expect(db.interaccionesIA.create).toHaveBeenCalledOnce();expect(db.interaccionesIA.create.mock.calls[0][0].data.tipo_evento).toBe('CONVERSACION_CON_HERRAMIENTAS');
});

it('agente deshabilitado registra rechazo sin conservar el mensaje',async()=>{
  vi.stubEnv('AI_AGENT_LLM_ENABLED','false');await expect(new CustomerAiOrchestrator().answer(admin,'Contenido privado')).rejects.toMatchObject({code:'SERVICE_UNAVAILABLE'});
  expect(db.interaccionesIA.create).toHaveBeenCalledOnce();expect(db.interaccionesIA.create.mock.calls[0][0].data.tipo_evento).toBe('CONVERSACION_RECHAZADA');expect(JSON.stringify(db.interaccionesIA.create.mock.calls)).not.toContain('Contenido privado');
});

it('conserva referencias verificadas del contexto sin atribuir revisión al actor de consulta',async()=>{
  db.atenciones.findUnique.mockResolvedValue({id_atencion:20,id_persona:10,id_tratamiento:30,id_sesion:7});
  const provider={complete:vi.fn().mockResolvedValue({kind:'message',text:'Respuesta administrativa simulada.'})};
  await new CustomerAiOrchestrator(()=>provider).answer(admin,'Consulta seleccionada',{attentionId:20});
  expect(db.interaccionesIA.create.mock.calls[0][0].data).toMatchObject({id_usuario_actor:1,id_usuario_revisor:null,id_persona:10,id_atencion:20,id_tratamiento:30,id_sesion:7});
});

it('auditoría pagina eventos sin texto clínico y no registra otra interacción al leer',async()=>{
  await Q.getAuthorizedAiRecords(admin,{page:2,pageSize:25});
  const args=db.interaccionesIA.findMany.mock.calls[0][0];expect(args).toMatchObject({skip:25,take:25,orderBy:{id_interaccion_ia:'desc'}});expect(args.select.resumen_consulta).toBeUndefined();expect(args.select.resultado).toBeUndefined();
  expect(db.interaccionesIA.create).not.toHaveBeenCalled();
  await expect(Q.getAuthorizedAiRecords({role:'RECEPCION'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await Q.getAuthorizedAiRecords({role:'RECEPCION',idUsuario:4});expect(db.interaccionesIA.findMany.mock.calls[1][0].where).toEqual({id_usuario_actor:4});
});
