import { Router, Request, Response, NextFunction } from 'express';
import { aiAgentAuth, principalOf, requireRole } from './authContext';
import { CustomerAiQueryService } from './services/customerAiQueryService';
import { AiAgentError } from './types';
import { pagination, positiveId } from './validators';
import { customerAiOrchestrator } from './llm/orchestrator';
import { durableKnowledgeService } from '../knowledge-base/durableKnowledgeService';
import { CustomerAiActionService } from './services/customerAiActionService';
import completionRoutes from './completionRoutes';
import analyticsRoutes from './analyticsRoutes';
import { CustomerAlertLifecycleService } from './services/customerAlertLifecycleService';

const router = Router();
router.use(aiAgentAuth);
router.use('/completion', completionRoutes);
router.use('/analytics', analyticsRoutes);
// Eventos de los flujos existentes también actualizan la bandeja, sin depender del LLM.
router.use((req, res, next) => {
  if (req.method === 'POST' && !req.path.startsWith('/chat') && !req.path.startsWith('/alerts')) {
    res.on('finish', () => { if (res.statusCode < 300) void CustomerAlertLifecycleService.detect(principalOf(req)).catch(() => console.error('[CUSTOMER] Verificación de alertas pendiente de reintento.')); });
  }
  next();
});
const send = (promise: Promise<unknown>, res: Response, next: NextFunction) => promise.then(value => res.json(value)).catch(next);

router.post('/chat', (req, res, next) => send(customerAiOrchestrator.answer(principalOf(req), req.body?.message,{mode:req.body?.mode,treatmentId:req.body?.treatmentId?positiveId(String(req.body.treatmentId),'treatmentId'):undefined,attentionId:req.body?.attentionId?positiveId(String(req.body.attentionId),'attentionId'):undefined}), res, next));
router.post('/actions/prepare', (req, res, next) => {
  try {
    if (req.body?.action !== 'REQUEST_RESCHEDULE') throw new AiAgentError('INVALID_INPUT', 'La acción solicitada no está disponible.');
    const sessionId = req.body.sessionId ? positiveId(String(req.body.sessionId), 'sessionId') : undefined;
    const sessionNumber = req.body.sessionNumber ? positiveId(String(req.body.sessionNumber), 'sessionNumber') : undefined;
    if (!sessionId && !sessionNumber) throw new AiAgentError('INVALID_INPUT', 'Debe especificar sessionId o sessionNumber.');
    send(CustomerAiActionService.prepareRescheduleRequest(principalOf(req), { sessionId, sessionNumber, preferredDate: req.body.preferredDate, preferredSlot: req.body.preferredSlot, reason: req.body.reason, idempotencyKey: req.body.idempotencyKey }), res, next);
  } catch (error) { next(error); }
});
router.post('/actions/confirm', (req, res, next) => send(CustomerAiActionService.confirmRescheduleRequest(principalOf(req), String(req.body?.confirmationToken || '')), res, next));
router.get('/reschedule-requests', (req, res, next) => send(CustomerAiActionService.getRescheduleRequests(principalOf(req)), res, next));
router.post('/reschedule-requests/:requestId/review', (req, res, next) => send(CustomerAiActionService.reviewRescheduleRequest(principalOf(req), positiveId(req.params.requestId, 'requestId'), req.body?.status, req.body?.reason), res, next));
router.post('/reschedule-requests/:requestId/apply', (req, res, next) => send(CustomerAiActionService.applyRescheduleRequest(principalOf(req), positiveId(req.params.requestId, 'requestId'), positiveId(String(req.body?.availabilityId), 'availabilityId'), String(req.body?.reason || '')), res, next));
router.post('/alerts/detect', (req, res, next) => send(CustomerAiActionService.detectDocumentationIssues(principalOf(req), { attentionId: req.body?.attentionId ? positiveId(String(req.body.attentionId), 'attentionId') : undefined, treatmentId: req.body?.treatmentId ? positiveId(String(req.body.treatmentId), 'treatmentId') : undefined }), res, next));
router.get('/alerts', (req, res, next) => send(CustomerAiActionService.getPendingAlerts(principalOf(req)), res, next));
router.post('/alerts/:alertId/review', (req, res, next) => send(CustomerAiActionService.reviewAlert(principalOf(req), positiveId(req.params.alertId, 'alertId'), req.body?.status, String(req.body?.result || '')), res, next));
router.post('/document-drafts', (req, res, next) => send(CustomerAiActionService.prepareDocumentationDraft(principalOf(req), positiveId(String(req.body?.attentionId), 'attentionId'), req.body?.idempotencyKey), res, next));
router.get('/attentions/:attentionId/document-drafts', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => send(CustomerAiActionService.getDraftsForAttention(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/document-drafts/:draftId', (req, res, next) => send(CustomerAiActionService.getDocumentDraft(principalOf(req), positiveId(req.params.draftId, 'draftId')), res, next));
router.post('/document-drafts/:draftId/revisions', (req, res, next) => send(CustomerAiActionService.reviseDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), String(req.body?.content || '')), res, next));
router.post('/document-drafts/:draftId/approve', (req, res, next) => send(CustomerAiActionService.approveDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), Boolean(req.body?.corrected)), res, next));
router.post('/document-drafts/:draftId/issue', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => send(CustomerAiActionService.issueDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId')), res, next));
router.post('/document-drafts/:draftId/reject', (req, res, next) => send(CustomerAiActionService.rejectDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), String(req.body?.reason || '')), res, next));

router.get('/me/treatments', requireRole('PACIENTE'), (req, res, next) => send(CustomerAiQueryService.getPatientTreatments(principalOf(req)), res, next));
router.get('/me/attentions', requireRole('PACIENTE'), (req, res, next) => send(CustomerAiQueryService.getPatientAttentions(principalOf(req), pagination(req.query as Record<string, unknown>)), res, next));
router.get('/staff/attentions', requireRole('ODONTOLOGO', 'RECEPCION', 'ADMIN'), (req, res, next) => send(CustomerAiQueryService.getStaffAttentions(principalOf(req), pagination(req.query as Record<string, unknown>)), res, next));
router.get('/availability/slots', requireRole('RECEPCION', 'ODONTOLOGO', 'ADMIN'), (req, res, next) => {
  const query = {
    idSede: req.query.idSede ? Number(req.query.idSede) : undefined,
    idProfesional: req.query.idProfesional ? Number(req.query.idProfesional) : undefined,
    fechaDesde: req.query.fechaDesde ? String(req.query.fechaDesde) : undefined,
    fechaHasta: req.query.fechaHasta ? String(req.query.fechaHasta) : undefined
  };
  send(CustomerAiQueryService.getAvailableSchedulingSlots(principalOf(req), query), res, next);
});
router.get('/treatments/:treatmentId', (req, res, next) => send(CustomerAiQueryService.getTreatmentDetail(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId')), res, next));
router.get('/treatments/:treatmentId/sessions', (req, res, next) => send(CustomerAiQueryService.getTreatmentSessions(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId'), pagination(req.query as Record<string, unknown>)), res, next));
router.get('/me/upcoming-sessions', requireRole('PACIENTE'), (req, res, next) => send(CustomerAiQueryService.getUpcomingSessions(principalOf(req)), res, next));
router.get('/treatments/:treatmentId/closure-checklist', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => send(CustomerAiQueryService.getTreatmentClosureChecklist(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId')), res, next));
router.get('/treatments/:treatmentId/progress', (req, res, next) => send(CustomerAiQueryService.getTreatmentProgress(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId')), res, next));
router.get('/attentions/:attentionId/approved-instructions', (req, res, next) => send(CustomerAiQueryService.getApprovedAftercareInstructions(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/attentions/:attentionId/post-care-instructions', (req, res, next) => send(CustomerAiQueryService.getApprovedAftercareInstructions(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/clinical/:attentionId/context', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => send(CustomerAiQueryService.getAuthorizedClinicalContext(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/attentions/:attentionId/documentation-status', (req, res, next) => send(CustomerAiQueryService.getClinicalDocumentationStatus(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/records', (req, res, next) => send(CustomerAiQueryService.getAuthorizedAiRecords(principalOf(req), pagination(req.query as Record<string, unknown>)), res, next));
router.get('/knowledge/documents', (req, res, next) => {
  try {
    const list = durableKnowledgeService.listDocuments(principalOf(req));
    res.json({ success: true, data: list });
  } catch (error) { next(error); }
});

router.post('/knowledge/documents', requireRole('ADMIN'), (req, res, next) => {
  try {
    const doc = durableKnowledgeService.registerDocument(principalOf(req), {
      code: String(req.body?.code || ''),
      title: String(req.body?.title || ''),
      category: String(req.body?.category || 'CLINICO')
    });
    res.json({ success: true, data: doc });
  } catch (error) { next(error); }
});

router.get('/knowledge/documents/:code', (req, res, next) => {
  try {
    const doc = durableKnowledgeService.getDocumentDetails(principalOf(req), req.params.code);
    res.json({ success: true, data: doc });
  } catch (error) { next(error); }
});

router.delete('/knowledge/documents/:code', requireRole('ADMIN'), (req, res, next) => {
  try {
    durableKnowledgeService.deactivateDocument(principalOf(req), String(req.params.code));
    res.json({ success: true, message: `Documento ${String(req.params.code)} archivado correctamente.` });
  } catch (error) { next(error); }
});

router.get('/knowledge/documents/:code/download', (req, res, next) => {
  try {
    const versionNumber = req.query.version ? Number(req.query.version) : undefined;
    const download = durableKnowledgeService.generateDocxDownload(principalOf(req), String(req.params.code), versionNumber);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    res.send(download.buffer);
  } catch (error) { next(error); }
});

router.post('/knowledge/documents/:code/versions', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => {
  try {
    let rawBuffer: Buffer | undefined;
    if (req.body?.base64Buffer) {
      rawBuffer = Buffer.from(req.body.base64Buffer, 'base64');
    }
    const version = durableKnowledgeService.submitVersion(principalOf(req), {
      code: String(req.params.code),
      version: Number(req.body?.version),
      format: req.body?.format || 'DOCX',
      rawBuffer,
      textContent: req.body?.textContent,
      allowedRoles: Array.isArray(req.body?.allowedRoles) ? req.body.allowedRoles : ['ODONTOLOGO', 'ADMIN', 'PACIENTE'],
      validFrom: req.body?.validFrom,
      validUntil: req.body?.validUntil,
      declaredNoPersonalData: Boolean(req.body?.declaredNoPersonalData)
    });
    res.json({ success: true, data: version });
  } catch (error) { next(error); }
});

router.post('/knowledge/documents/:code/versions/:version/approve', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => {
  try {
    const version = durableKnowledgeService.approveVersion(principalOf(req), String(req.params.code), Number(req.params.version));
    res.json({ success: true, data: version });
  } catch (error) { next(error); }
});

router.post('/knowledge/documents/:code/versions/:version/publish', requireRole('ADMIN'), (req, res, next) => {
  try {
    const version = durableKnowledgeService.publishVersion(principalOf(req), String(req.params.code), Number(req.params.version));
    res.json({ success: true, data: version });
  } catch (error) { next(error); }
});

router.post('/knowledge/documents/:code/versions/:version/revoke', requireRole('ADMIN'), (req, res, next) => {
  try {
    const version = durableKnowledgeService.revokeVersion(principalOf(req), String(req.params.code), Number(req.params.version), String(req.body?.reason || ''));
    res.json({ success: true, data: version });
  } catch (error) { next(error); }
});

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = error instanceof AiAgentError ? error : new AiAgentError('INTERNAL_ERROR', 'No fue posible completar la consulta.');
  if (!(error instanceof AiAgentError)) console.error('[Customer AI Agent]', error);
  res.status(e.status).json({ success: false, error: { code: e.code, message: e.message } });
});

export default router;
