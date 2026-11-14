import { Router, Request } from 'express';
import { principalOf } from './authContext';
import { positiveId } from './validators';
import { CustomerCompletionService as C, auditCustomer } from './services/customerCompletionService';
import { CustomerAlertLifecycleService as Alerts } from './services/customerAlertLifecycleService';
import { prisma } from '../../../db';
import { attentionForPrincipal } from './policies';
import { AiAgentError, AiAgentPrincipal } from './types';
import { runtimeConfig } from './llm/provider';

import { AftercareSchedulerService } from './services/aftercareSchedulerService';
import { AftercareCardService } from './services/aftercareCardService';
import { WhatsAppLoyaltyService } from '../whatsapp/services/whatsappLoyaltyService';

const router = Router();
const id = (req: Request, name: string) => positiveId(String(req.params[name]), name);
const run = (fn: (p: AiAgentPrincipal, req: Request) => Promise<unknown>) => async (req: Request, res: any, next: any) => {
  const p = principalOf(req);
  try {
    const data = await fn(p, req);
    let alertVerification = 'NOT_REQUESTED';
    const readOnlyCheck = /^\/attentions\/\d+\/validate$/.test(req.path) && req.body?.confirmed !== true;
    if (req.method !== 'GET' && !req.path.startsWith('/alerts') && !readOnlyCheck) {
      try { await Alerts.detect(p); alertVerification = 'COMPLETED'; }
      catch { alertVerification = 'PENDING_RETRY'; await auditCustomer(p, 'DETECCION_ALERTAS_FALLIDA', {}, 'Fallida').catch(() => undefined); }
    }
    res.json({ success: true, data, alertVerification });
  } catch (error) {
    await auditCustomer(p, 'OPERACION_CUSTOMER_FALLIDA', {}, 'Fallida').catch(() => undefined); next(['P2034','P2002'].includes((error as any)?.code)?new AiAgentError('CONFLICT','La operación cambió concurrentemente; consulte el estado y reintente con la misma clave.'):error);
  }
};
router.get('/policies', run(p => C.policies(p)));
router.get('/capabilities', run(async()=>{const config=runtimeConfig();return {externalDraftingEnabled:config.enabled&&config.externalDataAuthorized&&Boolean(process.env.GEMINI_API_KEY)&&process.env.AI_AGENT_ALLOW_REAL_GEMINI!=='false',institutionalKnowledgeEnabled:process.env.CUSTOMER_INSTITUTIONAL_KNOWLEDGE_ENABLED==='true'};}));
router.get('/catalog', run(async p => { if (!['ADMIN','ODONTOLOGO'].includes(p.role)) throw new AiAgentError('FORBIDDEN','Catálogo institucional no autorizado.'); return prisma.servicios.findMany({where:{activo:true},select:{id_servicio:true,nombre:true}}); }));
router.post('/policies', run((p,r) => C.createPolicy(p,r.body)));
router.post('/policies/:policyId/review', run((p,r) => C.transitionPolicy(p,id(r,'policyId'),false)));
router.post('/policies/:policyId/publish', run((p,r) => C.transitionPolicy(p,id(r,'policyId'),true)));
router.get('/treatments/:treatmentId/pending-sessions', run((p,r) => C.pendingSessions(p,id(r,'treatmentId'))));
router.get('/treatments/:treatmentId/slots', run((p,r) => C.slots(p,id(r,'treatmentId'))));
router.post('/scheduling/prepare', run((p,r) => C.prepareScheduling(p,positiveId(String(r.body.treatmentId),'treatmentId'),positiveId(String(r.body.number),'number'),positiveId(String(r.body.slotId),'slotId'),r.body.idempotencyKey)));
router.post('/scheduling/confirm', run((p,r) => C.confirmScheduling(p,r.body.confirmationToken)));
router.get('/requests', run(p => C.requests(p)));
router.get('/confirmation-alerts', run(async p=>{
  if(p.role!=='PACIENTE'||!p.idPersona)throw new AiAgentError('FORBIDDEN','Consulta reservada al paciente autenticado.');
  return prisma.alertasIA.findMany({where:{id_persona:p.idPersona,tipo_evento:'ALT-C01',estado:{notIn:['Resuelta','Descartada_Justificada']}},select:{id_alerta_ia:true,id_sesion:true,mensaje_alerta:true,estado:true},take:50});
}));
router.post('/requests/:requestId/review', run((p,r) => C.reviewRequest(p,id(r,'requestId'),r.body.status,r.body.evidence)));
router.post('/requests/:requestId/apply', run((p,r) => C.applyScheduling(p,id(r,'requestId'))));
router.get('/attentions/:attentionId/clinical-drafts/latest', run(async (p,r) => {
  const attentionId = id(r, 'attentionId');
  const draft = await prisma.borradoresIA.findFirst({
    where: { id_atencion: attentionId, es_version_actual: true, tipo_evento: 'BORRADOR_FICHA_CLINICA' },
    orderBy: { id_borrador_ia: 'desc' }
  });
  if (!draft) return null;
  const history = await prisma.borradoresIA.findMany({
    where: { id_borrador_raiz: draft.id_borrador_raiz || draft.id_borrador_ia },
    select: { id_borrador_ia: true, version_borrador: true, estado: true, fecha_hora: true, fecha_transferencia_ficha: true },
    orderBy: { id_borrador_ia: 'desc' }
  });
  return { draft, history, content: JSON.parse(draft.contenido_sugerido) };
}));
router.post('/attentions/:attentionId/clinical-drafts', run((p,r) => r.body.useLlm===true?C.prepareClinicalDraftWithLlm(p,id(r,'attentionId'),r.body.notes,r.body.idempotencyKey):C.prepareClinicalDraft(p,id(r,'attentionId'),r.body.notes,r.body.idempotencyKey,r.body.proposedSections)));
router.get('/clinical-drafts/:draftId', run(async (p,r) => {
  const draft = await C.clinicalDraft(p,id(r,'draftId'));
  const history = await prisma.borradoresIA.findMany({ where: { id_borrador_raiz: draft.id_borrador_raiz || draft.id_borrador_ia }, select: { id_borrador_ia:true, version_borrador:true, estado:true, fecha_hora:true, fecha_transferencia_ficha:true }, orderBy: { version_borrador:'desc' } });
  return { draft, history, content: JSON.parse(draft.contenido_sugerido) };
}));
router.post('/clinical-drafts/:draftId/revisions', run((p,r) => C.reviseClinicalDraft(p,id(r,'draftId'),r.body.sections)));
router.post('/clinical-drafts/:draftId/transfer', run((p,r) => C.transferClinicalDraft(p,id(r,'draftId'),r.body.confirmed)));
router.post('/attentions/:attentionId/validate', run((p,r) => C.validateDocumentation(p,id(r,'attentionId'),r.body.confirmed === true)));
router.post('/attentions/:attentionId/close', run((p,r) => C.closeAttention(p,id(r,'attentionId'),r.body.confirmed)));
router.post('/treatments/:treatmentId/close', run((p,r) => C.closeTreatment(p,id(r,'treatmentId'),r.body.evidence,r.body.confirmed)));
router.post('/sessions/:sessionId/confirm', run((p,r) => C.confirmSession(p,id(r,'sessionId'),r.body.confirmed)));
router.post('/referrals', run((p,r) => C.refer(p,positiveId(String(r.body.treatmentId),'treatmentId'),r.body.reference,r.body.idempotencyKey)));
router.post('/alerts/evaluate', run((p,r) => Alerts.detect(p,r.body?.treatmentId ? positiveId(String(r.body.treatmentId),'treatmentId') : undefined)));
router.post('/attentions/:attentionId/outcome', run(async(p,r) => {
  await C.requireProfessional(p); const a = await attentionForPrincipal(id(r,'attentionId'),p);
  if (!a.id_sesion || !['FINALIZAR_ATENCION','CONFIRMAR_INASISTENCIA'].includes(r.body.action)) throw new AiAgentError('INVALID_INPUT','Acción asistencial inválida.');
  if (r.body.confirmed !== true) throw new AiAgentError('INVALID_INPUT','Requiere confirmación profesional.');
  if ((a.procedimiento?.length??0)>200) throw new AiAgentError('INVALID_INPUT','El procedimiento principal del evento admite 200 caracteres; revise profesionalmente el campo antes de registrar el desenlace.');
  return prisma.$transaction(async tx => {
    const result = await tx.$queryRaw`EXEC dbo.usp_RegistrarEventoAsistencialSesion @id_sesion=${a.id_sesion}, @accion=${r.body.action}, @procedimiento_principal=${a.procedimiento}, @evaluacion_clinica=${a.evaluacion}, @motivo_inasistencia=${String(r.body.reason || '').slice(0,300)}, @id_usuario_responsable=${p.idUsuario}`;
    await auditCustomer(p,'DESENLACE_ASISTENCIAL',{personId:a.id_persona,attentionId:a.id_atencion},r.body.action,undefined,tx); return result;
  },{isolationLevel:'Serializable'});
}));
const handleAftercareSend = run(async (p, r) => {
  await C.requireProfessional(p);
  const attentionId = id(r, 'attentionId');
  await attentionForPrincipal(attentionId, p);
  const immediate = r.body?.immediate !== false;
  const delayMinutes = typeof r.body?.delayMinutes === 'number' ? r.body.delayMinutes : undefined;
  if (immediate) {
    const result = await AftercareSchedulerService.dispatchNow(attentionId);
    return { ...result, immediate: true, attentionId };
  } else {
    const scheduled = AftercareSchedulerService.scheduleAftercareDelivery(attentionId, { delayMinutes });
    return { ...scheduled, attentionId };
  }
});
router.post('/attentions/:attentionId/aftercare-card/send', handleAftercareSend);
router.get('/attentions/:attentionId/aftercare-card/send', handleAftercareSend);

const handleNpsSend = run(async (p, r) => {
  await C.requireProfessional(p);
  const attentionId = id(r, 'attentionId');
  await attentionForPrincipal(attentionId, p);
  const result = await WhatsAppLoyaltyService.sendAttentionNpsSurvey(attentionId);
  return { ...result, attentionId };
});
router.post('/attentions/:attentionId/nps/send', handleNpsSend);
router.get('/attentions/:attentionId/nps/send', handleNpsSend);
router.get('/attentions/:attentionId/aftercare-card/preview', run(async (p, r) => {
  const attentionId = id(r, 'attentionId');
  await attentionForPrincipal(attentionId, p);
  const card = await AftercareCardService.generateCard(attentionId);
  return { attentionId, filename: card.filename, patientName: card.patientName, patientPhone: card.patientPhone };
}));
export default router;
