import { Router, Request, Response, NextFunction } from 'express';
import { aiAgentAuth, principalOf, requireRole } from './authContext';
import { CustomerAiQueryService } from './services/customerAiQueryService';
import { AiAgentError } from './types';
import { pagination, positiveId } from './validators';
import { customerAiOrchestrator } from './llm/orchestrator';
import { CustomerAiActionService } from './services/customerAiActionService';

const router = Router();
router.use(aiAgentAuth);
const send = (promise: Promise<unknown>, res: Response, next: NextFunction) => promise.then(value => res.json(value)).catch(next);

router.post('/chat', (req, res, next) => send(customerAiOrchestrator.answer(principalOf(req), req.body?.message), res, next));
router.post('/actions/prepare', (req, res, next) => {
  try {
    if (req.body?.action !== 'REQUEST_RESCHEDULE') throw new AiAgentError('INVALID_INPUT', 'La acción solicitada no está disponible.');
    send(CustomerAiActionService.prepareRescheduleRequest(principalOf(req), { sessionId: positiveId(String(req.body.sessionId), 'sessionId'), preferredDate: req.body.preferredDate, preferredSlot: req.body.preferredSlot, reason: req.body.reason, idempotencyKey: req.body.idempotencyKey }), res, next);
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
router.get('/document-drafts/:draftId', (req, res, next) => send(CustomerAiActionService.getDocumentDraft(principalOf(req), positiveId(req.params.draftId, 'draftId')), res, next));
router.post('/document-drafts/:draftId/revisions', (req, res, next) => send(CustomerAiActionService.reviseDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), String(req.body?.content || '')), res, next));
router.post('/document-drafts/:draftId/approve', (req, res, next) => send(CustomerAiActionService.approveDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), Boolean(req.body?.corrected)), res, next));
router.post('/document-drafts/:draftId/reject', (req, res, next) => send(CustomerAiActionService.rejectDocumentationDraft(principalOf(req), positiveId(req.params.draftId, 'draftId'), String(req.body?.reason || '')), res, next));

router.get('/me/treatments', requireRole('PACIENTE'), (req, res, next) => send(CustomerAiQueryService.getPatientTreatments(principalOf(req)), res, next));
router.get('/treatments/:treatmentId', (req, res, next) => send(CustomerAiQueryService.getTreatmentDetail(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId')), res, next));
router.get('/treatments/:treatmentId/sessions', (req, res, next) => send(CustomerAiQueryService.getTreatmentSessions(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId'), pagination(req.query as Record<string, unknown>)), res, next));
router.get('/me/upcoming-sessions', requireRole('PACIENTE'), (req, res, next) => send(CustomerAiQueryService.getUpcomingSessions(principalOf(req)), res, next));
router.get('/treatments/:treatmentId/progress', (req, res, next) => send(CustomerAiQueryService.getTreatmentProgress(principalOf(req), positiveId(req.params.treatmentId, 'treatmentId')), res, next));
router.get('/attentions/:attentionId/approved-instructions', (req, res, next) => send(CustomerAiQueryService.getApprovedAftercareInstructions(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/clinical/:attentionId/context', requireRole('ODONTOLOGO', 'ADMIN'), (req, res, next) => send(CustomerAiQueryService.getAuthorizedClinicalContext(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/attentions/:attentionId/documentation-status', (req, res, next) => send(CustomerAiQueryService.getClinicalDocumentationStatus(principalOf(req), positiveId(req.params.attentionId, 'attentionId')), res, next));
router.get('/records', (req, res, next) => send(CustomerAiQueryService.getAuthorizedAiRecords(principalOf(req), pagination(req.query as Record<string, unknown>)), res, next));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = error instanceof AiAgentError ? error : new AiAgentError('INTERNAL_ERROR', 'No fue posible completar la consulta.');
  if (!(error instanceof AiAgentError)) console.error('[Customer AI Agent]', error);
  res.status(e.status).json({ success: false, error: { code: e.code, message: e.message } });
});

export default router;
