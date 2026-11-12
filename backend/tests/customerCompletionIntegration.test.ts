import {beforeAll,describe,expect,it,vi} from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import {prisma} from '../src/db';
import {createCompletionFixture} from '../scripts/completion-fixture';
import {CustomerCompletionService as C} from '../src/modules/customer/ai-agent/services/customerCompletionService';
import {CustomerAlertLifecycleService as Alerts,startCustomerAlertScheduler} from '../src/modules/customer/ai-agent/services/customerAlertLifecycleService';
import {CustomerAiQueryService as Q} from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import {CustomerAiActionService as A} from '../src/modules/customer/ai-agent/services/customerAiActionService';
import {CustomerAiOrchestrator} from '../src/modules/customer/ai-agent/llm/orchestrator';
import {durableKnowledgeService as kb} from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import {issueAiAgentToken} from '../src/modules/customer/ai-agent/authContext';
import {verifyCitations,preserveIssuedInstructions} from '../src/modules/customer/ai-agent/llm/sourceIntegrity';
import app from '../src/index';
import {assertIsolatedSqlServer} from './helpers/isolatedSqlServer';

describe.skipIf(process.env.AI_AGENT_SQLSERVER_INTEGRATION!=='true')('Certificación real SQL/HTTP CUSTOMER, datos sintéticos y sin Gemini externo',()=>{
 let f:Awaited<ReturnType<typeof createCompletionFixture>>;let session2:number;let draftId:number;let documentDraft:number;let referral:number;
 const post=async(actor:string,url:string,body:any)=>request(app).post('/api/customer/ai-agent'+url).set('Authorization','Bearer '+issueAiAgentToken(f.principals[actor])).send(body);
 const get=async(actor:string,url:string)=>request(app).get('/api/customer/ai-agent'+url).set('Authorization','Bearer '+issueAiAgentToken(f.principals[actor]));
 const policy=async(code:string,configuration:any)=>{
  const last=await prisma.politicasCustomerIA.findFirst({where:{codigo:code},orderBy:{version:'desc'}});
  const p=await C.createPolicy(f.principals.admin,{code,version:(last?.version??0)+1,serviceId:f.service.id_servicio,configuration:{sourceReference:'fixture-sintetico-autorizado-solo-Test',...configuration}});
  await C.transitionPolicy(f.principals.dentist,p.id_politica,false);return C.transitionPolicy(f.principals.admin,p.id_politica,true);
 };
 beforeAll(async()=>{await assertIsolatedSqlServer();f=await createCompletionFixture();},30000);
 it('IA01: HTTP → servicio → SQL, estados reales y denegación de tratamiento ajeno',async()=>{
  const own=await get('patient',`/treatments/${f.treatment.id_tratamiento}/sessions`);expect(own.status).toBe(200);expect(own.body.data.items[0]).toMatchObject({number:1,careStatus:'Pendiente',closureStatus:'Pendiente'});
  expect((await get('other',`/treatments/${f.treatment.id_tratamiento}/sessions`)).status).toBe(404);
 });
 it('IA02: progreso canónico sin inferir realización de una cita',async()=>{
  const value:any=await Q.getTreatmentProgress(f.principals.patient,f.treatment.id_tratamiento);expect(value.data).toMatchObject({plannedSessions:3,completedSessions:0,pendingSessions:3});
 });
 it('IA03: preparación, doble confirmación, revisión y programación oficial idempotente',async()=>{
  expect((await C.pendingSessions(f.principals.patient,f.treatment.id_tratamiento)).pendingNumbers).toEqual([2,3]);
  await expect(C.prepareScheduling(f.principals.other,f.treatment.id_tratamiento,2,f.next.id_disponibilidad,'foreign')).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(C.prepareScheduling(f.principals.patient,f.treatment.id_tratamiento,4,f.next.id_disponibilidad,'outside')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(C.prepareScheduling(f.principals.patient,f.treatment.id_tratamiento,2,2147483000,'missing')).rejects.toMatchObject({code:'INVALID_INPUT'});
  const prepared=await C.prepareScheduling(f.principals.patient,f.treatment.id_tratamiento,2,f.next.id_disponibilidad,crypto.randomUUID());
  const row=await C.confirmScheduling(f.principals.patient,prepared.confirmationToken);expect((await C.confirmScheduling(f.principals.patient,prepared.confirmationToken)).id_solicitud).toBe(row.id_solicitud);
  await expect(C.applyScheduling(f.principals.patient,row.id_solicitud)).rejects.toMatchObject({code:'FORBIDDEN'});
  await C.reviewRequest(f.principals.reception,row.id_solicitud,'Aprobada','Disponibilidad verificada en fixture.');
  const applied=await C.applyScheduling(f.principals.reception,row.id_solicitud);session2=applied.sessionId;
  expect((await C.applyScheduling(f.principals.reception,row.id_solicitud)).idempotent).toBe(true);
  expect(await prisma.sesionesTratamiento.count({where:{id_tratamiento:f.treatment.id_tratamiento,numero_sesion:2}})).toBe(1);
  expect(await prisma.eventosSesion.count({where:{id_sesion:session2,tipo_cambio:'CREACION'}})).toBe(1);
 });
 it('IA04: reprogramación aplicada conserva identidad y un solo evento',async()=>{
  const prepared=await A.prepareRescheduleRequest(f.principals.patient,{sessionId:session2,idempotencyKey:crypto.randomUUID()});const recorded=await A.confirmRescheduleRequest(f.principals.patient,prepared.confirmationToken);
  await A.reviewRescheduleRequest(f.principals.reception,recorded.requestId,'Aprobada','Revisión sintética de cambio.');
  await A.applyRescheduleRequest(f.principals.reception,recorded.requestId,f.reschedule.id_disponibilidad,'Horario oficial verificado.');
  expect((await A.applyRescheduleRequest(f.principals.reception,recorded.requestId,f.reschedule.id_disponibilidad,'Reintento del mismo cambio.')).data.idempotent).toBe(true);
  expect(await prisma.eventosSesion.count({where:{id_sesion:session2,tipo_cambio:'REPROGRAMACION'}})).toBe(1);
  const appliedAudit=await prisma.interaccionesIA.findFirstOrThrow({where:{id_sesion:session2,tipo_evento:'SOLICITUD_REPROGRAMACION_APLICADA'}});expect(appliedAudit).toMatchObject({actor_orientado:'RECEPCION',id_usuario_actor:f.reception.id_usuario});
 });
 it('IA05: RAG publicado y fuente verificable; cita ajena rechazada',async()=>{
  const code='CERT-'+f.suffix.toUpperCase();kb.registerDocument(f.principals.admin,{code,title:'Documento sintético de flujo',category:'KB-02'});
  kb.submitVersion(f.principals.dentist,{code,version:1,format:'TXT',textContent:'# Solicitudes\nLas solicitudes documentales de prueba requieren revisión humana.',allowedRoles:['PACIENTE'],declaredNoPersonalData:true});
  kb.approveVersion(f.principals.dentist,code,1);kb.publishVersion(f.principals.admin,code,1);
  const found=await kb.search(f.principals.patient,'solicitudes documentales prueba revisión humana',{audit:false});expect(found.results.some(r=>r.reference.documentCode===code)).toBe(true);
  const ref=found.results.find(r=>r.reference.documentCode===code)!.reference;expect(kb.getReference(f.principals.patient,ref)).toBeDefined();
  expect(()=>verifyCitations('[Documento: INEXISTENTE v1, Sección: X]',[ref])).toThrow();
  kb.revokeVersion(f.principals.admin,code,1,'Revocación sintética verificada.');expect(kb.getReference(f.principals.patient,ref)).toBeUndefined();
 });
 it('IA06: indicación emitida propia y fidelidad verificable del contenido',async()=>{
  const text=f.attention.indicaciones_finales!;await prisma.indicacionesPostatencion.create({data:{id_atencion:f.attention.id_atencion,version:1,estado:'Documento emitido',contenido_indicaciones:text,id_profesional_aprobador:f.professional.id_profesional,fecha_aprobacion:new Date(),fecha_emision:new Date(),origen_documento:'PROFESIONAL'}});
  const result:any=await Q.getApprovedAftercareInstructions(f.principals.patient,f.attention.id_atencion);expect(result.data[0].content).toBe(text);
  expect(preserveIssuedInstructions(result.data)).toContain(text);expect(preserveIssuedInstructions(result.data)).toContain('2 y 3');
  await expect(Q.getApprovedAftercareInstructions(f.principals.other,f.attention.id_atencion)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('IA07: contexto SQL autorizado, estado de alergia y preparación de cierre',async()=>{
  const result:any=await Q.getAuthorizedClinicalContext(f.principals.dentist,f.attention.id_atencion);expect(result.data.closureChecklist.treatmentId).toBe(f.treatment.id_tratamiento);expect(result.data.currentAttention.allergiesStatus).toBe('NO_REGISTRADA');
  expect((await get('reception',`/clinical/${f.attention.id_atencion}/context`)).status).toBe(403);
 });
 it('IA08: detectores a demanda reales y permisos de paciente',async()=>{
  const response=await post('dentist','/completion/alerts/evaluate',{treatmentId:f.treatment.id_tratamiento});expect(response.status).toBe(200);expect(response.body.data.evaluated).toBe(1);
  expect((await post('patient','/alerts/detect',{attentionId:f.attention.id_atencion})).status).toBe(403);
 });
 it('IA09: notas → borrador específico → corrección versionada → transferencia humana',async()=>{
  const original=await prisma.atenciones.findUniqueOrThrow({where:{id_atencion:f.attention.id_atencion}});
  const notes='Motivo: Motivo declarado\nEvaluación: Evaluación documentada\nProcedimiento: Procedimiento confirmado';
  await expect(C.prepareClinicalDraft(f.principals.dentist,f.attention.id_atencion,notes,'invention',{evaluacion:'Hallazgo inventado'})).rejects.toMatchObject({code:'INVALID_INPUT'});
  const d=await C.prepareClinicalDraft(f.principals.dentist,f.attention.id_atencion,notes,crypto.randomUUID());draftId=d.id_borrador_ia;
  expect((await prisma.atenciones.findUniqueOrThrow({where:{id_atencion:f.attention.id_atencion}})).evaluacion).toBe(original.evaluacion);
  const revision=await C.reviseClinicalDraft(f.principals.dentist,draftId,{...JSON.parse(d.contenido_sugerido).sections,observaciones:'Corrección profesional declarada'});expect(revision.version_borrador).toBe(2);draftId=revision.id_borrador_ia;
  await expect(C.transferClinicalDraft(f.principals.dentist,draftId,false)).rejects.toMatchObject({code:'INVALID_INPUT'});
  await C.transferClinicalDraft(f.principals.dentist,draftId,true);expect((await C.transferClinicalDraft(f.principals.dentist,draftId,true)).idempotent).toBe(true);
  expect((await prisma.atenciones.findUniqueOrThrow({where:{id_atencion:f.attention.id_atencion}})).observaciones).toBe('Corrección profesional declarada');
 });
 it('IA10: borrador postatención no cambia asistencia ni cierre al emitir',async()=>{
  const d=await A.prepareDocumentationDraft(f.principals.dentist,f.attention.id_atencion,crypto.randomUUID());documentDraft=d.data.draftId;
  await A.approveDocumentationDraft(f.principals.dentist,documentDraft);const before=await prisma.sesionesTratamiento.findUniqueOrThrow({where:{id_sesion:f.session.id_sesion}});
  await A.issueDocumentationDraft(f.principals.dentist,documentDraft);const after=await prisma.sesionesTratamiento.findUniqueOrThrow({where:{id_sesion:f.session.id_sesion}});expect(after.estado_asistencial).toBe(before.estado_asistencial);expect(after.estado_cierre).toBe(before.estado_cierre);
 });
 it('IA11: política publicada, validación efectiva y bloqueo de bypass SQL',async()=>{
  expect((await C.validateDocumentation(f.principals.dentist,f.attention.id_atencion,false)).blocked).toBe(true);
  await expect(prisma.$queryRaw`EXEC dbo.usp_CerrarSesionClinica @id_sesion=${f.session.id_sesion},@id_profesional_validador=${f.professional.id_profesional},@id_usuario_responsable=${f.dentist.id_usuario}`).rejects.toThrow();
  await policy('DOCUMENTACION',{requiredFields:['motivo_consulta','evaluacion','procedimiento'],requiresProcedure:true,requiresInstructions:true});
  expect((await C.validateDocumentation(f.principals.dentist,f.attention.id_atencion,true)).pending).toEqual([]);
  await prisma.atenciones.update({where:{id_atencion:f.attention.id_atencion},data:{evaluacion:'Dato profesional modificado después de validar'}});
  await expect(C.closeAttention(f.principals.dentist,f.attention.id_atencion,true)).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('IA12: cambio oficial y nueva consulta muestran progreso actualizado sin alta automática',async()=>{
  await prisma.sesionesTratamiento.update({where:{id_sesion:f.session.id_sesion},data:{estado_asistencial:'Realizada',fecha_inicio_atencion:new Date()}});
  await C.validateDocumentation(f.principals.dentist,f.attention.id_atencion,true);await C.closeAttention(f.principals.dentist,f.attention.id_atencion,true);
  expect((await Q.getTreatmentProgress(f.principals.patient,f.treatment.id_tratamiento)).data).toMatchObject({completedSessions:1,pendingSessions:2});
  await expect(C.confirmSession(f.principals.patient,f.session.id_sesion,true)).rejects.toMatchObject({code:'CONFLICT'});
  expect((await prisma.tratamientosContratados.findUniqueOrThrow({where:{id_tratamiento:f.treatment.id_tratamiento}})).estado_tratamiento).toBe('En ejecución');
 });
 it('IA13: checklist agrupa evidencias y bloquea cierre formal con sesiones pendientes',async()=>{
  const result=await Q.getTreatmentClosureChecklist(f.principals.dentist,f.treatment.id_tratamiento);expect(result.data.pending.length).toBeGreaterThan(0);expect(result.data.sessions[0].attentions[0].issuedInstructionIds.length).toBeGreaterThan(0);
  await expect(C.closeTreatment(f.principals.dentist,f.treatment.id_tratamiento,'Revisión incompleta',true)).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('IA14: chat staff sin paciente conserva actor y correlación sin duplicación',async()=>{
  const engine=new CustomerAiOrchestrator(()=>({complete:async()=>({kind:'message',text:'Respuesta sintética de contrato.'})}));
  const result=await engine.answer(f.principals.reception,'Consulta administrativa de prueba');
  const rows=await prisma.interaccionesIA.findMany({where:{id_correlacion:result.correlationId}});expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({actor_orientado:'RECEPCION',id_persona:null,id_usuario_actor:f.reception.id_usuario});
  expect((await get('dentist','/records')).status).toBe(200);
 });
 it('ALT-C01: ventana aprobada, destinatario, confirmación y resolución sin inasistencia',async()=>{
  await policy('CONFIRMACION',{windowMinutes:43200});await Alerts.detect(f.principals.admin,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_sesion:session2,tipo_evento:'ALT-C01',estado:'Generada'}})).toBe(1);
  await C.confirmSession(f.principals.patient,session2,true);await Alerts.detect(f.principals.reception,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_sesion:session2,tipo_evento:'ALT-C01',estado:'Resuelta'}})).toBe(1);
  expect((await prisma.sesionesTratamiento.findUniqueOrThrow({where:{id_sesion:session2}})).estado_asistencial).toBe('Pendiente');
 });
 it('ALT-C02: vencimiento sin desenlace genera revisión, nunca inasistencia inferida',async()=>{
  const original=await prisma.sesionesTratamiento.findUniqueOrThrow({where:{id_sesion:session2}});await prisma.sesionesTratamiento.update({where:{id_sesion:session2},data:{fecha_programada_vigente:new Date(Date.now()-86400000)}});
  await Alerts.detect(f.principals.reception,f.treatment.id_tratamiento);expect(await prisma.alertasIA.count({where:{id_sesion:session2,tipo_evento:'ALT-C02'}})).toBe(1);
  expect((await prisma.sesionesTratamiento.findUniqueOrThrow({where:{id_sesion:session2}})).estado_asistencial).toBe('Pendiente');
  await prisma.sesionesTratamiento.update({where:{id_sesion:session2},data:{fecha_programada_vigente:original.fecha_programada_vigente}});
 });
 it('ALT-C03: brecha real del plan y deduplicación, sin sesiones ficticias',async()=>{
  const before=await prisma.sesionesTratamiento.count({where:{id_tratamiento:f.treatment.id_tratamiento}});await Alerts.detect(f.principals.reception,f.treatment.id_tratamiento);await Alerts.detect(f.principals.reception,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_tratamiento:f.treatment.id_tratamiento,tipo_evento:'ALT-C03'}})).toBe(1);expect(await prisma.sesionesTratamiento.count({where:{id_tratamiento:f.treatment.id_tratamiento}})).toBe(before);
 });
 it('ALT-C04: alergia documentada, revisión profesional, permisos y deduplicación',async()=>{
  await prisma.atenciones.update({where:{id_atencion:f.attention.id_atencion},data:{alergias:'Antecedente sintético declarado'}});await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
  const row=await prisma.alertasIA.findFirstOrThrow({where:{id_atencion:f.attention.id_atencion,tipo_evento:'ALT-C04'}});expect(row.mensaje_alerta).toContain('no determina contraindicaciones');
  await expect(A.reviewAlert(f.principals.reception,row.id_alerta_ia,'Atendida','Intento no autorizado')).rejects.toMatchObject({code:'FORBIDDEN'});
  await A.reviewAlert(f.principals.dentist,row.id_alerta_ia,'Atendida','Antecedente revisado por profesional.');await A.reviewAlert(f.principals.dentist,row.id_alerta_ia,'Resuelta','Revisión documental registrada.');await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_atencion:f.attention.id_atencion,tipo_evento:'ALT-C04'}})).toBe(1);
 });
 it('ALT-C05: campos efectivos según política y resolución al corregir',async()=>{
  const attention2=await prisma.atenciones.findFirstOrThrow({where:{id_sesion:session2}});await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_atencion:attention2.id_atencion,tipo_evento:'ALT-C05',estado:'Generada'}})).toBe(1);
  await prisma.atenciones.update({where:{id_atencion:attention2.id_atencion},data:{motivo_consulta:'Motivo de prueba',evaluacion:'Evaluación declarada',procedimiento:'Procedimiento confirmado'}});
  await prisma.indicacionesPostatencion.create({data:{id_atencion:attention2.id_atencion,version:1,estado:'Documento emitido',contenido_indicaciones:'Documento sintético',id_profesional_aprobador:f.professional.id_profesional,fecha_aprobacion:new Date(),fecha_emision:new Date()}});
  await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);expect(await prisma.alertasIA.count({where:{id_atencion:attention2.id_atencion,tipo_evento:'ALT-C05',estado:'Resuelta'}})).toBe(1);
 });
 it('ALT-C06: borrador actual pendiente y resolución tras aprobación sin emisión',async()=>{
  const d=await A.prepareDocumentationDraft(f.principals.dentist,f.attention.id_atencion,crypto.randomUUID());await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
  expect(await prisma.alertasIA.count({where:{id_atencion:f.attention.id_atencion,tipo_evento:'ALT-C06',estado:'Generada'}})).toBe(1);await A.approveDocumentationDraft(f.principals.dentist,d.data.draftId);await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
  expect((await prisma.borradoresIA.findUniqueOrThrow({where:{id_borrador_ia:d.data.draftId}})).id_indicacion_vinculada).toBeNull();expect(await prisma.alertasIA.count({where:{id_atencion:f.attention.id_atencion,tipo_evento:'ALT-C06',estado:'Resuelta'}})).toBe(1);
 });
 it('ALT-C07: sesiones gestionadas sin cierre formal, sin alta automática',async()=>{
  const prepared=await C.prepareScheduling(f.principals.patient,f.treatment.id_tratamiento,3,f.third.id_disponibilidad,crypto.randomUUID());const r=await C.confirmScheduling(f.principals.patient,prepared.confirmationToken);await C.reviewRequest(f.principals.reception,r.id_solicitud,'Aprobada','Continuidad sintética verificada.');await C.applyScheduling(f.principals.reception,r.id_solicitud);
  const sessions=await prisma.sesionesTratamiento.findMany({where:{id_tratamiento:f.treatment.id_tratamiento}});
  for(const s of sessions) {const a=await prisma.atenciones.findFirstOrThrow({where:{id_sesion:s.id_sesion}});if(s.estado_cierre==='Cerrada')continue;await prisma.atenciones.update({where:{id_atencion:a.id_atencion},data:{motivo_consulta:'Motivo declarado',evaluacion:'Evaluación documentada',procedimiento:'Procedimiento confirmado'}});await prisma.indicacionesPostatencion.create({data:{id_atencion:a.id_atencion,version:2,estado:'Documento emitido',contenido_indicaciones:'Documento sintético revisado',id_profesional_aprobador:f.professional.id_profesional,fecha_aprobacion:new Date(),fecha_emision:new Date()}});await prisma.sesionesTratamiento.update({where:{id_sesion:s.id_sesion},data:{estado_asistencial:'Realizada',fecha_inicio_atencion:new Date()}});await C.validateDocumentation(f.principals.dentist,a.id_atencion,true);await C.closeAttention(f.principals.dentist,a.id_atencion,true);}
  await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);expect(await prisma.alertasIA.count({where:{id_tratamiento:f.treatment.id_tratamiento,tipo_evento:'ALT-C07'}})).toBe(1);expect((await prisma.tratamientosContratados.findUniqueOrThrow({where:{id_tratamiento:f.treatment.id_tratamiento}})).estado_tratamiento).toBe('En ejecución');
 });
 it('ALT-C08: derivación efectiva a bandeja autorizada, revisión y resolución',async()=>{
  const row=await C.refer(f.principals.patient,f.treatment.id_tratamiento,crypto.randomUUID(),crypto.randomUUID());referral=row.id_solicitud;expect((await C.requests(f.principals.dentist)).some(r=>r.id_solicitud===referral)).toBe(true);expect((await C.requests(f.principals.reception)).some(r=>r.id_solicitud===referral)).toBe(false);
  await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);expect(await prisma.alertasIA.count({where:{id_tratamiento:f.treatment.id_tratamiento,tipo_evento:'ALT-C08'}})).toBe(1);await C.reviewRequest(f.principals.dentist,referral,'Atendida','Paciente identificado para revisión humana.');await C.reviewRequest(f.principals.dentist,referral,'Resuelta','Revisión humana completada sin decisión automática.');await Alerts.detect(f.principals.dentist,f.treatment.id_tratamiento);
 });
 it('Concurrencia: dos operadores no crean el mismo ordinal ni dos versiones vigentes',async()=>{
  const count=await prisma.sesionesTratamiento.count({where:{id_tratamiento:f.treatment.id_tratamiento}});expect(count).toBe(3);
  const a2=await prisma.atenciones.findFirstOrThrow({where:{id_sesion:session2}});const d=await C.prepareClinicalDraft(f.principals.dentist,a2.id_atencion,'Observaciones: Nota concurrente',crypto.randomUUID());
  const attempts=await Promise.allSettled([C.reviseClinicalDraft(f.principals.dentist,d.id_borrador_ia,{observaciones:'Primera revisión'}),C.reviseClinicalDraft(f.principals.dentist,d.id_borrador_ia,{observaciones:'Segunda revisión'})]);expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await prisma.borradoresIA.count({where:{id_borrador_raiz:d.id_borrador_ia,es_version_actual:true}})).toBe(1);
 });
 it('Autenticación HTTP real, revocación y aislamiento de credencial SQL',async()=>{
  process.env.AI_AGENT_SESSION_REVOCATION_REQUIRED='true';
  const login=await request(app).post('/api/staff-auth/login').send({email:f.dentist.email,password:f.password});expect(login.status).toBe(200);const token=login.body.accessToken;
  expect((await request(app).get('/api/customer/ai-agent/staff/attentions').set('Authorization','Bearer '+token)).status).toBe(200);
  const simultaneous=await Promise.all(Array.from({length:8},()=>request(app).get('/api/customer/ai-agent/staff/attentions').set('Authorization','Bearer '+token)));expect(simultaneous.every(r=>r.status===200)).toBe(true);
  await prisma.usuarios.update({where:{id_usuario:f.dentist.id_usuario},data:{activo:false}});
  expect((await request(app).get('/api/customer/ai-agent/staff/attentions').set('Authorization','Bearer '+token)).status).toBe(401);
  await prisma.usuarios.update({where:{id_usuario:f.dentist.id_usuario},data:{activo:true}});
  expect((await request(app).post('/api/staff-auth/logout').set('Authorization','Bearer '+token)).status).toBe(200);
  expect((await request(app).get('/api/customer/ai-agent/staff/attentions').set('Authorization','Bearer '+token+'.sufijo')).status).toBe(401);
  expect((await request(app).get('/api/customer/ai-agent/staff/attentions').set('Authorization','Bearer '+token)).status).toBe(401);delete process.env.AI_AGENT_SESSION_REVOCATION_REQUIRED;
  await expect(prisma.$queryRawUnsafe('SELECT TOP(1) id_persona FROM NexoSaludDB.dbo.Personas')).rejects.toThrow();
 });
 it('IA03: concurrencia real, cambio del plan y exclusión de la reserva inicial PAYER',async()=>{
  const x=await createCompletionFixture();const p=x.principals.patient;
  const proposals=await Promise.all([C.prepareScheduling(p,x.treatment.id_tratamiento,2,x.next.id_disponibilidad,crypto.randomUUID()),C.prepareScheduling(p,x.treatment.id_tratamiento,2,x.reschedule.id_disponibilidad,crypto.randomUUID())]);
  const attempts=await Promise.allSettled(proposals.map(v=>C.confirmScheduling(p,v.confirmationToken)));expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await prisma.solicitudesCustomerIA.count({where:{id_tratamiento:x.treatment.id_tratamiento,tipo:'AGENDAMIENTO'}})).toBe(1);
  const row=(attempts.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;await C.reviewRequest(x.principals.reception,row.id_solicitud,'Aprobada','Fixture concurrente revisado.');
  await prisma.planTratamiento.update({where:{id_plan:x.plan.id_plan},data:{es_vigente:false}});
  await expect(C.applyScheduling(x.principals.reception,row.id_solicitud)).rejects.toMatchObject({code:'CONFLICT'});
  expect(await prisma.sesionesTratamiento.count({where:{id_tratamiento:x.treatment.id_tratamiento}})).toBe(1);
  await expect(prisma.$queryRaw`EXEC dbo.usp_ProgramarSesionTratamiento @id_tratamiento=${x.treatment.id_tratamiento},@numero_sesion=${1},@id_profesional=${x.professional.id_profesional},@id_sede=${x.branch.id_sede},@fecha_programada=${x.next.fecha},@duracion_min=${45},@id_disponibilidad=${x.next.id_disponibilidad},@id_usuario_responsable=${x.reception.id_usuario}`).rejects.toThrow();
 });
 it('IA09: proveedor simulado organiza texto literal; invención y campos extensos no persisten',async()=>{
  const notes='Observaciones: Nota literal declarada';const before=await prisma.borradoresIA.count({where:{id_atencion:f.attention.id_atencion}});
  await expect(C.prepareClinicalDraftWithLlm(f.principals.dentist,f.attention.id_atencion,notes,crypto.randomUUID(),{complete:async()=>({kind:'message',text:JSON.stringify({evaluacion:'Diagnóstico inventado'})})})).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(C.prepareClinicalDraftWithLlm(f.principals.dentist,f.attention.id_atencion,notes,crypto.randomUUID(),{complete:async()=>({kind:'message',text:'null'})})).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(await prisma.borradoresIA.count({where:{id_atencion:f.attention.id_atencion}})).toBe(before);
  const d=await C.prepareClinicalDraftWithLlm(f.principals.dentist,f.attention.id_atencion,notes,crypto.randomUUID(),{complete:async()=>({kind:'message',text:JSON.stringify({observaciones:'Nota literal declarada'})})});expect(JSON.parse(d.contenido_sugerido).sections.observaciones).toBe('Nota literal declarada');
  await expect(C.reviseClinicalDraft(f.principals.dentist,d.id_borrador_ia,{alergias:'A'.repeat(301)})).rejects.toMatchObject({code:'INVALID_INPUT'});
 });
 it('IA13: cierre formal profesional real, TURNED e idempotencia con evidencia',async()=>{
  const attentions=await prisma.atenciones.findMany({where:{id_tratamiento:f.treatment.id_tratamiento}});
  for(const a of attentions)await C.validateDocumentation(f.principals.dentist,a.id_atencion,true);
  await expect(C.closeTreatment(f.principals.patient,f.treatment.id_tratamiento,'Intento paciente',true)).rejects.toMatchObject({code:'FORBIDDEN'});
  const row=await C.closeTreatment(f.principals.dentist,f.treatment.id_tratamiento,'Revisión profesional completa de fixture sintético.',true);expect(row.estado).toBe('Aplicada');
  expect((await C.closeTreatment(f.principals.dentist,f.treatment.id_tratamiento,'Reintento confirmado.',true)).id_solicitud).toBe(row.id_solicitud);
  const treatment=await prisma.tratamientosContratados.findUniqueOrThrow({where:{id_tratamiento:f.treatment.id_tratamiento}});expect(treatment.estado_tratamiento).toBe('Completado');expect(await prisma.solicitudesCustomerIA.count({where:{id_tratamiento:f.treatment.id_tratamiento,tipo:'CIERRE'}})).toBe(1);
 });
 it('Scheduler: lote real con identidad institucional y sin ejecución solapada',async()=>{
  process.env.CUSTOMER_ALERT_SCHEDULER_ENABLED='true';process.env.CUSTOMER_ALERT_SCHEDULER_USER_ID=String(f.admin.id_usuario);
  const observer=vi.spyOn(Alerts,'detect');const scheduler=startCustomerAlertScheduler({runImmediately:false})!;
  try{const first=scheduler.runNow();await scheduler.runNow();await first;expect(observer).toHaveBeenCalledTimes(1);expect(observer.mock.calls[0][0]).toMatchObject({role:'ADMIN',idUsuario:f.admin.id_usuario});const result=await observer.mock.results[0].value;expect(result.evaluated).toBeGreaterThan(0);expect(result.evaluated).toBeLessThanOrEqual(100);}finally{scheduler.stop();observer.mockRestore();delete process.env.CUSTOMER_ALERT_SCHEDULER_ENABLED;delete process.env.CUSTOMER_ALERT_SCHEDULER_USER_ID;}
 },30000);
});
