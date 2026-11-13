
const knowledgeStatusLabel = (status: string): string => ({
  DRAFT: 'Borrador', IN_REVIEW: 'En revisión', APPROVED: 'Aprobado',
  PUBLISHED: 'Publicado', SUPERSEDED: 'Sustituido', REVOKED: 'Revocado', NO_VERSIONS: 'Sin versiones'
}[status] || 'Estado no disponible');

function formatAlertTitle(type: string): string {
  const map: Record<string, string> = {
    'AL-C01': 'Validación de Ficha Requerida',
    'AL-C02': 'Atención sin Cierre Documental',
    'AL-C03': 'Indicaciones pendientes de aprobación',
    'AL-C04': 'Reprogramación Pendiente de Gestión',
    'AL-C05': 'Inconsistencia en Registro Asistencial',
    'ALT-C01': 'Recordatorio de Cita Próxima',
    'ALT-C02': 'Horario vencido sin desenlace registrado',
    'ALT-C03': 'Sesiones del plan sin programar',
    'ALT-C04': 'Antecedentes o alergias para revisión',
    'ALT-C05': 'Pendientes documentales de cierre',
    'ALT-C06': 'Borrador postatención pendiente de aprobación',
    'ALT-C07': 'Decisión formal de cierre pendiente',
    'ALT-C08': 'Solicitud de revisión humana pendiente',
  };
  return map[type] || type.replace(/[_-]/g, ' ');
}
import CustomerCompletionPanel from '../components/CustomerCompletionPanel';
// CustomerAnalyticsPanel movido a /customer/analytics
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { motion } from 'motion/react';
import { AttentionCombobox } from '../components/AttentionCombobox';
import { 
  AlertTriangle, 
  BarChart3, 
  BookOpen, 
  Calendar, 
  Check, 
  CheckCircle2, 
  Clock, 
  FileText, 
  LoaderCircle, 
  LogOut, 
  MessageCircle, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  Stethoscope, 
  User, 
  XCircle,
  FileCheck2,
  Send,
  AlertCircle,
  CalendarCheck,
  ChevronRight,
  Info,
  Download,
  Upload,
  Plus,
  Search,
  Trash2,
  History,
  Tag,
  Eye,
  Filter
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { 
  customerAiAgentApi, 
  type AgentAlert, 
  type AvailableSlotItem, 
  type ClinicalContext, 
  type DocumentationStatus, 
  type DocumentDraft, 
  type KnowledgeDocumentItem,
  type RescheduleRequest, 
  type StaffAttentionItem,
  type PendingSessionContext,
  type StoredDocumentDetail,
  type StoredDocumentVersion
} from '../services/customerAiAgentApi';

export default function CustomerAiStaffWorkspacePage() {
  const navigate = useNavigate();
  const session = staffAuthService.getSession();
  const role = session?.agentRole;
  const hasSession = Boolean(session?.accessToken);
  const isDentist = role === 'ODONTOLOGO' || role === 'ADMIN';
  const isReception = role === 'RECEPCION' || role === 'ADMIN';

  const [section, setSection] = useState('workspace');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attentionId, setAttentionId] = useState('');
  const [preparationSessionId, setPreparationSessionId] = useState<number | null>(null);
  const [pendingSessionContexts, setPendingSessionContexts] = useState<PendingSessionContext[]>([]);
  const [attentionSearchId, setAttentionSearchId] = useState('');
  const attentionLoadVersion = useRef(0);
  const selectedAttentionRef = useRef<number | null>(null);
  const [context, setContext] = useState<ClinicalContext | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationStatus | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  
  // Drafts
  const [draftId, setDraftId] = useState('');
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [autoIssueToPatient, setAutoIssueToPatient] = useState(false);
  const [attentionDraftsList, setAttentionDraftsList] = useState<Array<{ draftId: number; rootId: number; version: number; status: string; createdAt: string; isIssued: boolean }>>([]);

  // Staff lists
  const [staffAttentionsList, setStaffAttentionsList] = useState<StaffAttentionItem[]>([]);
  const [availableSlotsList, setAvailableSlotsList] = useState<AvailableSlotItem[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocumentItem[]>([]);
  
  // Knowledge Governance & RAG State
  const [selectedDocCode, setSelectedDocCode] = useState<string>('');
  const [selectedDocDetail, setSelectedDocDetail] = useState<StoredDocumentDetail | null>(null);
  const [selectedDocVersion, setSelectedDocVersion] = useState<number>(1);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('TODOS');

  // Modals for Knowledge Governance
  const [showRegisterDocModal, setShowRegisterDocModal] = useState(false);
  const [newDocCode, setNewDocCode] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('CLINICO');

  const [showSubmitVersionModal, setShowSubmitVersionModal] = useState(false);
  const [newVerNumber, setNewVerNumber] = useState<number>(2);
  const [newVerFormat, setNewVerFormat] = useState<'DOCX' | 'TXT' | 'MD'>('DOCX');
  const [newVerText, setNewVerText] = useState('');
  const [newVerBase64, setNewVerBase64] = useState('');
  const [newVerFileName, setNewVerFileName] = useState('');
  const [newVerDeclared, setNewVerDeclared] = useState(false);
  const [newVerRoles, setNewVerRoles] = useState<string[]>(['ODONTOLOGO', 'ADMIN', 'PACIENTE']);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  // In-App Action Modals
  const [applyModalRequest, setApplyModalRequest] = useState<RescheduleRequest | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [applyReason, setApplyReason] = useState('');

  const [alertReviewModal, setAlertReviewModal] = useState<{ alert: AgentAlert; nextStatus: string } | null>(null);
  const [alertEvidenceText, setAlertEvidenceText] = useState('');

  const [requestReviewModal, setRequestReviewModal] = useState<{ request: RescheduleRequest; nextStatus: string } | null>(null);
  const [requestReviewReason, setRequestReviewReason] = useState('');

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string; references?: string[] }>>([]);

  async function loadAlerts() {
    const result = await customerAiAgentApi.alerts(); 
    setAlerts(result.data);
  }

  async function loadRequests() {
    const result = await customerAiAgentApi.rescheduleRequests('staff'); 
    setRequests(result.data);
  }

  async function loadStaffAttentions() {
    if (!isDentist) return;
    try {
      const [res, upcoming] = await Promise.all([customerAiAgentApi.staffAttentions(), customerAiAgentApi.staffPendingSessions()]);
      setStaffAttentionsList(res.data);
      setPendingSessionContexts(upcoming.data);
    } catch {
      setStaffAttentionsList([]);
      setPendingSessionContexts([]);
      throw new Error('No fue posible cargar las atenciones y sesiones asignadas. Vuelve a sincronizar.');
    }
  }

  async function loadKnowledgeDocuments(preserveSelected = true) {
    try {
      const res = await customerAiAgentApi.knowledgeDocuments();
      setKnowledgeDocs(res.data);
      if (res.data.length > 0) {
        if (!preserveSelected || !selectedDocCode) {
          void loadDocumentDetail(res.data[0].code);
        }
      }
    } catch {
      setKnowledgeDocs([]);
    }
  }

  async function loadDocumentDetail(code: string, preferredVersion?: number) {
    try {
      setBusy(true);
      setError('');
      const res = await customerAiAgentApi.getKnowledgeDocument(code);
      setSelectedDocDetail(res.data);
      setSelectedDocCode(code);
      const sorted = [...res.data.versions].sort((a, b) => b.version - a.version);
      if (preferredVersion && res.data.versions.some(v => v.version === preferredVersion)) {
        setSelectedDocVersion(preferredVersion);
      } else if (sorted.length > 0) {
        setSelectedDocVersion(sorted[0].version);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al cargar detalle del documento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterDocument(e: FormEvent) {
    e.preventDefault();
    if (!newDocCode.trim() || !newDocTitle.trim()) {
      setError('Debes ingresar el código y título del documento.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.registerKnowledgeDocument({
        code: newDocCode.trim().toUpperCase(),
        title: newDocTitle.trim(),
        category: newDocCategory
      });
      const createdCode = newDocCode.trim().toUpperCase();
      setShowRegisterDocModal(false);
      setNewDocCode('');
      setNewDocTitle('');
      await loadKnowledgeDocuments(true);
      await loadDocumentDetail(createdCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al registrar documento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitVersion(e: FormEvent) {
    e.preventDefault();
    if (!selectedDocCode) return;
    if (!newVerDeclared) {
      setError('Debes declarar bajo fe de juramento la ausencia de datos personales.');
      return;
    }
    if (newVerFormat === 'DOCX' && !newVerBase64) {
      setError('Debes adjuntar el archivo DOCX.');
      return;
    }
    if ((newVerFormat === 'TXT' || newVerFormat === 'MD') && !newVerText.trim()) {
      setError('Debes ingresar el contenido de texto del documento.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.submitKnowledgeVersion(selectedDocCode, {
        version: newVerNumber,
        format: newVerFormat,
        base64Buffer: newVerBase64 || undefined,
        textContent: newVerText || undefined,
        allowedRoles: newVerRoles,
        declaredNoPersonalData: newVerDeclared
      });
      setShowSubmitVersionModal(false);
      setNewVerBase64('');
      setNewVerText('');
      setNewVerFileName('');
      setNewVerDeclared(false);
      await loadDocumentDetail(selectedDocCode, newVerNumber);
      await loadKnowledgeDocuments(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al cargar nueva versión.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveVersion(version: number) {
    if (!selectedDocCode) return;
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.approveKnowledgeVersion(selectedDocCode, version);
      await loadDocumentDetail(selectedDocCode, version);
      await loadKnowledgeDocuments(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al aprobar versión.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishVersion(version: number) {
    if (!selectedDocCode) return;
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.publishKnowledgeVersion(selectedDocCode, version);
      await loadDocumentDetail(selectedDocCode, version);
      await loadKnowledgeDocuments(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al publicar versión en el RAG.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeVersionConfirmed() {
    if (!selectedDocCode || !revokeReason.trim()) return;
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.revokeKnowledgeVersion(selectedDocCode, selectedDocVersion, revokeReason.trim());
      setShowRevokeModal(false);
      setRevokeReason('');
      await loadDocumentDetail(selectedDocCode, selectedDocVersion);
      await loadKnowledgeDocuments(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al revocar versión.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDocument(code: string) {
    if (!confirm(`¿Estás seguro de archivar y desindexar el documento ${code}? Ya no estará disponible para consultas RAG.`)) return;
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.deleteKnowledgeDocument(code);
      setSelectedDocCode('');
      setSelectedDocDetail(null);
      await loadKnowledgeDocuments(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al archivar documento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDocx(code: string, version?: number) {
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.downloadKnowledgeDocx(code, version);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al descargar archivo DOCX.');
    } finally {
      setBusy(false);
    }
  }

  function handleDocxFileSelected(file: File) {
    setNewVerFileName(file.name);
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      setNewVerFormat(file.name.endsWith('.md') ? 'MD' : 'TXT');
      const textReader = new FileReader();
      textReader.onload = () => {
        setNewVerText(String(textReader.result || ''));
      };
      textReader.readAsText(file);
    } else {
      setNewVerFormat('DOCX');
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setNewVerBase64(btoa(binary));
      };
      reader.readAsArrayBuffer(file);
    }
  }

  useEffect(() => {
    if (!hasSession || !role) return;
    setBusy(true);
    Promise.all([
      isReception ? loadRequests() : Promise.resolve(),
      loadAlerts(),
      loadStaffAttentions(),
      loadKnowledgeDocuments(),
    ])
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar la información inicial.'))
      .finally(() => setBusy(false));
  }, [role, hasSession]);

  if (!session) return <Navigate to="/" replace state={{ message: 'Inicia sesión con tu cuenta institucional.' }} />;

  async function refreshDocumentation() {
    const id = selectedAttentionRef.current;
    if (!id) return;
    try {
      const result = await customerAiAgentApi.documentationStatus(id);
      if (selectedAttentionRef.current === id) setDocumentation(result.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la comprobación documental.'); }
  }

  async function fetchAttentionData(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) { 
      setError('Ingresa un identificador de atención válido.'); 
      return; 
    }
    const version = ++attentionLoadVersion.current;
    selectedAttentionRef.current = id;
    setPreparationSessionId(null);
    setAttentionId(String(id));
    setAttentionSearchId(String(id));
    setBusy(true); setError(''); setContext(null); setDocumentation(null);
    setDraft(null); setDraftId(''); setDraftContent(''); setAttentionDraftsList([]);
    try {
      const [contextResult, documentationResult] = await Promise.all([
        customerAiAgentApi.clinicalContext(id),
        customerAiAgentApi.documentationStatus(id),
      ]);
      if (version !== attentionLoadVersion.current) return;
      setContext(contextResult.data);
      setDocumentation(documentationResult.data);
      setAttentionId(String(id));
      void loadAttentionDrafts(id);
    } catch (cause) {
      if (version !== attentionLoadVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar esta atención. Verifica que pertenezca a tu ámbito asistencial.');
    } finally {
      if (version === attentionLoadVersion.current) setBusy(false);
    }
  }

  async function fetchSessionPreparation(sessionId: number) {
    const version = ++attentionLoadVersion.current;
    selectedAttentionRef.current = null;
    setPreparationSessionId(sessionId);
    setAttentionId(''); setAttentionSearchId('');
    setBusy(true); setError(''); setContext(null); setDocumentation(null);
    setDraft(null); setDraftId(''); setDraftContent(''); setAttentionDraftsList([]);
    try {
      const result = await customerAiAgentApi.clinicalSessionContext(sessionId);
      if (version === attentionLoadVersion.current) setContext(result.data);
    } catch (cause) {
      if (version === attentionLoadVersion.current) setError(cause instanceof Error ? cause.message : 'No se pudo preparar el contexto de la sesión.');
    } finally {
      if (version === attentionLoadVersion.current) setBusy(false);
    }
  }

  async function loadAttentionDrafts(id: number) {
    if (!id || id <= 0) return;
    try {
      const res = await customerAiAgentApi.attentionDrafts(id);
      if (selectedAttentionRef.current !== id) return;
      setAttentionDraftsList(res.data);
      if (res.data.length > 0 && !draft) {
        setDraftId(String(res.data[0].draftId));
      }
    } catch {
      if (selectedAttentionRef.current === id) setAttentionDraftsList([]);
    }
  }

  async function loadAttention(event: FormEvent) {
    event.preventDefault();
    await fetchAttentionData(Number(attentionSearchId));
  }

  async function openApplyModal(request: RescheduleRequest) {
    setBusy(true); setError('');
    try {
      const res = await customerAiAgentApi.availableSlots(request.branchId, request.professionalId);
      const slots = res.data.length > 0 ? res.data : (await customerAiAgentApi.availableSlots()).data;
      setAvailableSlotsList(slots);
      setApplyModalRequest(request);
      setSelectedSlotId(slots[0]?.id_disponibilidad ?? null);
      setApplyReason(`Aplicación de reprogramación aprobada para solicitud #${request.requestId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la disponibilidad de agenda.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmApplyReschedule() {
    if (!applyModalRequest || !selectedSlotId) return;
    if (!applyReason.trim()) { setError('Ingresa el motivo o justificación de la aplicación.'); return; }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.applyReschedule(applyModalRequest.requestId, selectedSlotId, applyReason.trim());
      setApplyModalRequest(null);
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aplicar la reprogramación.');
    } finally {
      setBusy(false);
    }
  }

  async function detectAlerts() {
    setBusy(true); setError('');
    try { 
      await customerAiAgentApi.detectAlerts(Number(attentionId)); 
      await loadAlerts(); 
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron detectar alertas.'); }
    finally { setBusy(false); }
  }

  async function loadDraftById(idToLoad: number) {
    if (!idToLoad || idToLoad <= 0) return;
    setBusy(true); setError('');
    try {
      const result = await customerAiAgentApi.getDraft(idToLoad);
      setDraft(result.data);
      setDraftContent(result.data.content);
      setDraftId(String(result.data.draftId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Borrador no disponible o fuera de tu ámbito asistencial.');
    } finally {
      setBusy(false);
    }
  }

  async function loadDraft(event: FormEvent) {
    event.preventDefault();
    await loadDraftById(Number(draftId));
  }

  async function prepareDraft() {
    setBusy(true); setError('');
    try { 
      const result = await customerAiAgentApi.prepareDraft(Number(attentionId), crypto.randomUUID()) as { success: boolean; data: DocumentDraft }; 
      setDraft(result.data); 
      setDraftContent(result.data.content); 
      setDraftId(String(result.data.draftId)); 
      setSection('drafts');
      void loadAttentionDrafts(Number(attentionId));
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar el borrador con IA.'); }
    finally { setBusy(false); }
  }

  async function handleApproveDraftConfirmed(andIssue = autoIssueToPatient) {
    if (!draft) return;
    if (draftContent !== draft.content) { setError('Guarda y revisa la versión corregida antes de aprobar.'); return; }
    setShowApproveConfirmModal(false);
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.approveDraft(draft.draftId, draft.version > 1);
      if (andIssue) {
        await customerAiAgentApi.issueDraft(draft.draftId);
      }
      const result = await customerAiAgentApi.getDraft(draft.draftId);
      setDraft(result.data);
      if (attentionId) void loadAttentionDrafts(Number(attentionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aprobar y emitir el borrador.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectDraftConfirmed() {
    if (!draft) return;
    if (!draftReason.trim()) {
      setError('Debes especificar el motivo clínico del rechazo.');
      return;
    }
    setShowRejectModal(false);
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.rejectDraft(draft.draftId, draftReason.trim());
      const result = await customerAiAgentApi.getDraft(draft.draftId);
      setDraft(result.data);
      setDraftReason('');
      if (attentionId) void loadAttentionDrafts(Number(attentionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo rechazar el borrador.');
    } finally {
      setBusy(false);
    }
  }

  async function updateDraft(action: 'revise' | 'approve' | 'issue' | 'reject') {
    if (!draft) return;
    if (action === 'reject') { 
      setShowRejectModal(true);
      return; 
    }
    if (action === 'approve') {
      if (draftContent !== draft.content) { setError('Hay cambios sin guardar. Guarda la nueva versión y revísala antes de aprobar.'); return; }
      setAutoIssueToPatient(false);
      setShowApproveConfirmModal(true);
      return;
    }
    if (action === 'issue' && draftContent !== draft.content) { setError('Solo puede emitirse el contenido aprobado y guardado.'); return; }
    setBusy(true); setError('');
    try {
      if (action === 'revise') {
        const result = await customerAiAgentApi.reviseDraft(draft.draftId, draftContent) as { data: { draftId: number } };
        const refreshed = await customerAiAgentApi.getDraft(result.data.draftId);
        setDraft(refreshed.data); setDraftContent(refreshed.data.content); setDraftId(String(refreshed.data.draftId));
        if (attentionId) void loadAttentionDrafts(Number(attentionId));
      }
      if (action === 'issue') { 
        await customerAiAgentApi.issueDraft(draft.draftId); 
        const result = await customerAiAgentApi.getDraft(draft.draftId); 
        setDraft(result.data); 
        if (attentionId) void loadAttentionDrafts(Number(attentionId));
      }
    } catch (cause) { 
      setError(cause instanceof Error ? cause.message : 'El borrador cambió de estado o no pudo actualizarse. Recarga la versión.'); 
    } finally { 
      setBusy(false); 
    }
  }

  function openReviewAlertModal(alert: AgentAlert, nextStatus: string) {
    setAlertReviewModal({ alert, nextStatus });
    setAlertEvidenceText('');
  }

  async function confirmReviewAlert() {
    if (!alertReviewModal) return;
    if (!alertEvidenceText.trim()) {
      setError('Registra la evidencia o motivo de la revisión clínica.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.reviewAlert(alertReviewModal.alert.alertId, alertReviewModal.nextStatus, alertEvidenceText.trim());
      setAlertReviewModal(null);
      await loadAlerts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado de la alerta.');
    } finally {
      setBusy(false);
    }
  }

  function openReviewRequestModal(request: RescheduleRequest, nextStatus: string) {
    setRequestReviewModal({ request, nextStatus });
    setRequestReviewReason(nextStatus === 'Aprobada' ? 'Aprobada tras validación de disponibilidad y continuidad.' : '');
  }

  async function confirmReviewRequest() {
    if (!requestReviewModal) return;
    if (requestReviewModal.nextStatus === 'Rechazada' && !requestReviewReason.trim()) {
      setError('Debes ingresar el motivo del rechazo.');
      return;
    }
    setBusy(true); setError('');
    try {
      await customerAiAgentApi.reviewReschedule(requestReviewModal.request.requestId, requestReviewModal.nextStatus, requestReviewReason.trim());
      setRequestReviewModal(null);
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(event?: FormEvent, presetText?: string) {
    if (event) event.preventDefault();
    const text = (presetText || chatInput).trim(); 
    if (!text) return;
    setChatInput(''); 
    setChatMessages((items) => [...items, { role: 'Tú', content: text }]); 
    setBusy(true); setError('');
    try {
      const result = await customerAiAgentApi.chat(text, 'staff', {attentionId:attentionId?Number(attentionId):undefined,sessionId:preparationSessionId??undefined});
      const docMatches = result.message.match(/\[Documento:\s*([A-Z0-9._-]+)(?:\s+v\d+)?(?:,\s*Sección:[^\]]+)?\]/gi) || [];
      const cleanMessage = result.message
        .replace(/\[Documento:[^\]]+\]/gi, '')
        .replace(/\n\s*\.\s*\n/g, '\n\n')
        .replace(/\n\s*\.\s*$/g, '')
        .replace(/\s+\./g, '.')
        .trim();
      setChatMessages((items) => [
        ...items,
        {
          role: 'Copiloto NexoSalud',
          content: `${cleanMessage}\n\n${result.limitations.join(' ')}`,
          references: docMatches.map((m) => m.replace(/^\[|\]$/g, '').trim()),
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El asistente clínico no está disponible.');
    } finally {
      setBusy(false);
    }
  }

  const sections = [

    ...(isDentist ? [
      { id: 'workspace', label: 'Atención & Documentación', icon: Stethoscope },
      { id: 'drafts', label: 'Borradores Clínicos', icon: FileText }
    ] : []),
    ...(isReception ? [
      { id: 'requests', label: 'Reprogramaciones', icon: Calendar, badge: requests.filter(r => r.status === 'Pendiente' || r.status === 'En_Revision').length }
    ] : []),
    { id: 'alerts', label: 'Alertas Asistenciales', icon: AlertTriangle, badge: alerts.filter(a => a.status === 'Generada' || a.status === 'En_Revision').length },
    { id: 'assistant', label: 'Copiloto Normativo IA', icon: MessageCircle },
    ...(isDentist ? [
      { id: 'knowledge', label: 'Gobernanza RAG & Documentos', icon: BookOpen }
    ] : [])
  ];

  const pendingAlertsCount = alerts.filter(a => a.status === 'Generada' || a.status === 'En_Revision').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'Pendiente' || r.status === 'En_Revision').length;

  return (
    <div className="pt pt-embed w-full">
        {/* Cabecera editorial */}
        <header className="grid gap-8 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="pt-rise" style={{ '--i': 0 } as CSSProperties}>
            <p className="pt-eyebrow inline-flex items-center gap-2">
              <span className="pt-dot pt-dot-ok pt-live" aria-hidden="true" />
              Estación clínica · Customer
            </p>
            <h1 className="mt-4 text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.08]">
              Copiloto asistencial <em style={{ fontStyle: 'italic' }} className="pt-accent-text">y documental</em>
            </h1>
            <p className="pt-muted mt-3 text-sm">
              {session.nombres} {session.apellidos} · <span className="font-semibold pt-ink2">{role}</span> · sedes autorizadas
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                Promise.all([
                  isReception ? loadRequests() : Promise.resolve(),
                  loadAlerts(),
                  loadStaffAttentions()
                ])
                  .catch((cause) => setError(cause instanceof Error ? cause.message : 'Error al actualizar'))
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
              title="Actualizar datos"
              className="pt-btn"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              Sincronizar
            </button>
            <button type="button" onClick={() => { staffAuthService.logout(); navigate('/'); }} className="pt-btn pt-btn-danger">
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Indicadores: separados por línea, sin tarjetas */}
        <dl className="pt-metrics pt-rise" style={{ '--i': 2 } as CSSProperties}>
          {[
            ['Alertas activas', <span key="a" className="pt-display text-4xl pt-num">{pendingAlertsCount}</span>],
            ['Reprogramaciones', <span key="r" className="pt-display text-4xl pt-num">{pendingRequestsCount}</span>],
            ['Atenciones asignadas', <span key="s" className="pt-display text-4xl pt-num">{staffAttentionsList.length}</span>],
            ['Gobernanza médica', <span key="g" className="inline-flex items-center gap-2 font-medium pt-accent-text"><ShieldCheck className="h-5 w-5" strokeWidth={1.5} />Supervisión humana</span>],
          ].map(([label, value]) => (
            <div key={String(label)} className="pt-metric">
              <dt className="pt-eyebrow">{label}</dt>
              <dd className="mt-2">{value}</dd>
            </div>
          ))}
        </dl>


        {/* Secciones */}
        <nav aria-label="Secciones del copiloto" className="pt-tabs mt-10 mb-8">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                aria-current={active ? 'page' : undefined}
                className="pt-tab"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && <span className="pt-count">{item.badge}</span>}
                {active && <motion.span layoutId="pt-staff-tab" className="pt-tab-bar" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              </button>
            );
          })}
        </nav>

        {/* Mensaje de error */}
        {error && (
          <div role="alert" className="pt-alert mb-6">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
            <button type="button" onClick={() => setError('')} className="font-bold px-1 cursor-pointer" aria-label="Cerrar aviso">✕</button>
          </div>
        )}


        {/* SECCIÓN 1: ATENCIÓN Y DOCUMENTACIÓN */}
        {section === 'workspace' && isDentist && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            {/* Panel Izquierdo: Selección de Atención */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-[color:var(--pt-ink)] flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-[color:var(--pt-accent)]" />
                  Expediente de Atención
                </h2>
                <p className="mt-1 text-xs text-[color:var(--pt-muted)]">
                  Selecciona a tu paciente programado en agenda o busca directamente por número de atención.
                </p>
              </div>

              {staffAttentionsList.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label id="staff-attention-label" className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                      Atenciones asignadas
                    </label>
                    <span className="text-[10px] font-mono text-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] px-2 py-0.5 rounded-full border border-[color:var(--pt-line-strong)]">
                      {staffAttentionsList.length} en lista
                    </span>
                  </div>
                  <p className="pt-help">Incluye atenciones pasadas y futuras. Consultar una cita próxima no registra asistencia ni inicia la atención.</p>
                  <AttentionCombobox items={staffAttentionsList} value={attentionId} disabled={busy} labelledBy="staff-attention-label" onSelect={(id) => void fetchAttentionData(id)} />
                </div>
              ) : (
                <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-xs text-[color:var(--pt-muted)] space-y-1">
                  <p className="font-semibold text-[color:var(--pt-ink-2)]">Sin atenciones asignadas recuperadas</p>
                  <p className="text-[11px]">
                    Puedes ingresar el ID de atención directamente abajo (ej. 153, 220) o seleccionarla desde la tabla del Módulo CUSTOMER.
                  </p>
                </div>
              )}

              {pendingSessionContexts.length > 0 && <div className="pt-field border-t border-[color:var(--pt-line)] pt-3">
                <label className="pt-label" htmlFor="staff-session-preparation">Próximas sesiones sin atención abierta</label>
                <p className="pt-help">Puedes preparar su contexto antes del día de la cita. Esta consulta es de solo lectura.</p>
                <select id="staff-session-preparation" className="pt-input" disabled={busy} value={preparationSessionId ?? ''} onChange={e => { if (e.target.value) void fetchSessionPreparation(Number(e.target.value)); }}>
                  <option value="">Selecciona una sesión para preparar…</option>
                  {pendingSessionContexts.map(s => <option key={s.sessionId} value={s.sessionId}>{s.patientName} · Sesión {s.number} · {new Intl.DateTimeFormat('es-PE', {timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.date))} (Lima) · {s.careStatus} · {s.serviceName}</option>)}
                </select>
              </div>}

              <form onSubmit={loadAttention} className="space-y-2 pt-2 border-t border-[color:var(--pt-line)]">
                <label htmlFor="staff-attention-search" className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  O buscar por ID de Atención Directo
                </label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)] font-mono" 
                    inputMode="numeric" 
                    placeholder="Ej. 153, 220..."
                    id="staff-attention-search"
                    value={attentionSearchId}
                    onChange={(event) => setAttentionSearchId(event.target.value)}
                    required 
                  />
                  <button 
                    disabled={busy} 
                    className="rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                  >
                    Cargar
                  </button>
                </div>
              </form>

              {context && attentionId && (
                <div className="pt-3 border-t border-[color:var(--pt-line)] space-y-2">
                  <p className="text-[11px] font-semibold text-[color:var(--pt-muted)] uppercase tracking-wider">Acciones del Copiloto</p>
                  <button 
                    disabled={busy} 
                    onClick={() => void detectAlerts()} 
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-warn-soft)] px-3 py-2.5 text-xs font-semibold text-[color:var(--pt-warn)] hover:bg-[var(--pt-warn-soft)] transition-all"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--pt-warn)]" />
                    Detectar Alertas Documentales
                  </button>
                  {role === 'ODONTOLOGO' && (
                    <button 
                      disabled={busy} 
                      onClick={() => void prepareDraft()} 
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-accent-soft)] px-3 py-2.5 text-xs font-semibold text-[color:var(--pt-accent)] hover:bg-[var(--pt-accent-soft)] transition-all"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[color:var(--pt-accent)]" />
                      Preparar indicaciones desde plantilla
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Panel Derecho: Contexto Clínico y Estado Documental */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[color:var(--pt-line)]">
                <h2 className="font-bold text-[color:var(--pt-ink)] flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-[color:var(--pt-accent)]" />
                  Contexto Clínico & Validador Documental
                </h2>
                {attentionId && (
                  <span className="font-mono text-xs font-bold text-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] px-2 py-0.5 rounded-md border border-[color:var(--pt-line-strong)]">
                    Atención #{attentionId}
                  </span>
                )}
              </div>

              {context ? (
                <div className="space-y-4">
                  {/* Disclaimer Clínico */}
                  <div className="flex items-start gap-3 rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-warn-soft)] p-3 text-xs text-[color:var(--pt-warn)]">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[color:var(--pt-warn)] mt-0.5" />
                    <p className="leading-relaxed">{context.clinicalDisclaimer}</p>
                  </div>

                  {/* Resumen de Tratamiento y Atención */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-accent)]">Tratamiento Vinculado</span>
                      <p className="text-xs font-semibold text-[color:var(--pt-ink)]">
                        {renderTreatmentSummary(context.currentTreatment)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-accent)]">Detalles de la Cita</span>
                      <div className="text-xs text-[color:var(--pt-ink-2)] space-y-0.5">
                        {context.preparationOnly ? <p>Atención aún no abierta. Estado de la sesión: {context.currentSession?.careStatus}. Consultar no confirma asistencia ni inicia atención.</p> : renderAttentionSummary(context.currentAttention)}
                      </div>
                    </div>
                  </div>

                  {context.closureChecklist && (
                    <section className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-4 space-y-2" aria-label="Preparación del cierre del tratamiento">
                      <h3 className="text-xs font-bold">Checklist consultivo de cierre - Tratamiento #{context.closureChecklist?.treatmentId ?? '—'}</h3>
                      <p className="text-xs">Estado formal: {context.closureChecklist.formalTreatmentStatus} · Sesiones realizadas y cerradas: {context.closureChecklist.completedSessions}/{context.closureChecklist.plannedSessions ?? 'Sin plan'}</p>
                      <p className="text-xs">{context.closureChecklist.disclaimer}</p>
                      {context.closureChecklist.pending.length ? (
                        <ul className="list-disc pl-4 text-xs space-y-1">{context.closureChecklist.pending.map((pending, index) => <li key={index}>{pending}</li>)}</ul>
                      ) : <p className="text-xs">Sin pendientes detectados por estas reglas. Requiere confirmación profesional; no acredita cierre clínico.</p>}
                    </section>
                  )}

                  <section className="rounded-xl border border-[color:var(--pt-line)] p-3 space-y-2 text-xs" aria-label="Procedencia y contexto de sesión">
                    <h3 className="font-bold">Contexto registrado y procedencia</h3>
                    {context.preparationSummary && <p className="whitespace-pre-line">{context.preparationSummary}</p>}
                    <p className="font-semibold text-[color:var(--pt-accent)]">Confirma el motivo de consulta, antecedentes, alergias y cambios recientes con el paciente antes de atender.</p>
                    {context.contextWarnings?.map(warning => <p key={warning} className="pt-note">{warning}</p>)}
                    <p>{context.provenance?.source} · {context.provenance?.attentionId ? `Atención #${context.provenance.attentionId} · Revisión ${context.provenance.clinicalRevision}` : 'Preparación de sesión; sin atención abierta'}</p>
                    <p>{context.currentPlan ? `Plan #${context.currentPlan.planId}, versión ${context.currentPlan.version}: ${context.currentPlan.plannedSessions} sesiones previstas.` : 'Plan vigente no disponible.'}</p>
                    <p>{context.currentSession ? `Sesión ${context.currentSession.number} · ${context.currentSession.careStatus} · Cierre ${context.currentSession.closureStatus}` : 'Sesión vinculada no disponible.'}</p>
                    <p>Procedimientos registrados: {context.registeredProcedures?.map(p=>`#${p.id_detalle_procedimiento}: ${p.procedimiento_realizado}`).join('; ') || 'Sin registros recuperables.'}</p>
                    <p>Atenciones anteriores (hasta 10): {context.previousAttentions?.map(a=>`#${a.id_atencion}: ${a.procedimiento || 'Procedimiento sin documentar'}`).join('; ') || 'Sin registros recuperables.'}</p>
                    {context.relatedAlerts?.map(a=><p key={a.id_alerta_ia}>Alerta #{a.id_alerta_ia} · {a.tipo_evento} · {a.estado}: {a.mensaje_alerta}</p>)}
                  </section>
                  {/* Antecedentes Registrados */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--pt-muted)]">Antecedentes Clínicos del Paciente</h3>
                    {context.relevantBackground && context.relevantBackground.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {context.relevantBackground.map((item, index) => (
                          <div key={index} className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 text-xs shadow-2xs">
                            <span className="font-semibold text-[color:var(--pt-ink)] block">{String(item.category || 'Antecedente')}</span>
                            <p className="text-[color:var(--pt-ink-2)] mt-0.5">{String(item.description || 'Sin detalle')}</p>
                            <span className="mt-1.5 inline-block text-[10px] font-mono font-medium text-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] px-1.5 py-0.5 rounded">
                              Verificación: {String(item.verificationStatus || 'Registrado')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-[color:var(--pt-line-strong)] p-3 text-xs text-[color:var(--pt-muted)]">
                        No hay antecedentes recuperables registrados en esta consulta; esto no confirma su ausencia clínica.
                      </p>
                    )}
                  </div>

                  {/* Estado de Cierre Documental */}
                  {documentation && (
                    <div className="rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-accent-soft)] p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[color:var(--pt-accent)] flex items-center gap-1.5">
                          <FileCheck2 className="w-4 h-4 text-[color:var(--pt-accent)]" />
                          Cierre Documental: {documentation.closureStatus || 'En Proceso'}
                        </span>
                        <span className="text-[11px] font-mono text-[color:var(--pt-muted)]">
                          Indicaciones por aprobar: {documentation.pendingInstructions.length}
                        </span>
                      </div>
                      <p className="text-xs text-[color:var(--pt-ink-2)]">
                        Última validación técnica: <span className="font-medium text-[color:var(--pt-ink)]">{documentation.lastValidation?.result || 'Sin registrar'}</span>
                        {documentation.lastValidation?.pendingFields ? ` · Pendientes: ${documentation.lastValidation.pendingFields}` : ''}
                      </p>
                      {documentation.lastValidation && documentation.lastValidation.matchesCurrentRecords === false && <p className="font-semibold">La última validación es histórica o quedó desactualizada; no acredita los registros actuales.</p>}
                      {documentation.currentCheck && <div aria-label="Comprobación documental vigente" className="space-y-1">
                        <p className="font-semibold">{documentation.currentCheck.blocked?'Comprobación actual bloqueada':documentation.currentCheck.pending.length?'Pendientes actuales':'Sin pendientes entre los requisitos documentales evaluados'}</p>
                        <ul>{documentation.currentCheck.pending.map(item=><li key={item}>{({motivo_consulta:'Motivo de consulta',antecedentes:'Antecedentes registrados',alergias:'Registro de alergias',evaluacion:'Evaluación registrada',procedimiento:'Procedimiento registrado',observaciones:'Observaciones',indicaciones_finales:'Indicaciones finales',procedimiento_confirmado:'Procedimiento confirmado',indicaciones_emitidas:'Indicaciones vigentes, aprobadas y emitidas'} as Record<string,string>)[item]||item}</li>)}</ul>
                        <p>{documentation.currentCheck.limitation}</p>
                      </div>}
                    </div>
                  )}

                  {/* Panel de Continuidad y Revisión Supervisada Integrado en Atención */}
                  {!preparationSessionId && (
                    <div className="mt-5 pt-4 border-t border-[color:var(--pt-line)]">
                      <CustomerCompletionPanel
                        audience="staff"
                        role={role}
                        attentionId={attentionId ? Number(attentionId) : undefined}
                        treatmentId={(context?.currentTreatment as { treatmentId?: number })?.treatmentId}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-[color:var(--pt-ink-2)]">Ninguna atención seleccionada</p>
                  <p className="text-xs text-[color:var(--pt-muted)] max-w-sm mx-auto">
                    Selecciona una atención asignada de la lista o escribe su identificador numérico en el panel izquierdo para recuperar su contexto clínico seguro.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 2: BORRADORES CLÍNICOS */}
        {section === 'drafts' && isDentist && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-[color:var(--pt-ink)] flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-[color:var(--pt-accent)]" />
                  Borradores Clínicos
                </h2>
                <p className="mt-1 text-xs text-[color:var(--pt-muted)]">
                  Historial de versiones y generación de indicaciones asistidas por IA.
                </p>
              </div>

              {attentionId && (
                <div className="rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-accent-soft)] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-accent)]">
                      Atención Activa: #{attentionId}
                    </span>
                    <span className="text-[10px] font-medium text-[color:var(--pt-muted)]">
                      {attentionDraftsList.length} {attentionDraftsList.length === 1 ? 'versión' : 'versiones'}
                    </span>
                  </div>

                  <button
                    disabled={busy}
                    onClick={() => void prepareDraft()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-3 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Preparar nuevo borrador desde plantilla
                  </button>

                  {/* Listado automático de versiones para esta atención */}
                  {attentionDraftsList.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-[color:var(--pt-line)]">
                      <label className="block text-[11px] font-semibold text-[color:var(--pt-ink-2)]">
                        Versiones disponibles en esta atención:
                      </label>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {attentionDraftsList.map((item) => {
                          const isSelected = draft?.draftId === item.draftId;
                          return (
                            <button
                              key={item.draftId}
                              type="button"
                              onClick={() => void loadDraftById(item.draftId)}
                              className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--pt-surface)] border-[color:var(--pt-accent)] shadow-xs font-semibold text-[color:var(--pt-accent)]'
                                  : 'bg-[var(--pt-surface)]/60 border-[color:var(--pt-line)] hover:border-[color:var(--pt-line-strong)] text-[color:var(--pt-ink)]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span>Borrador #{item.draftId} <span className="text-[11px] font-mono text-[color:var(--pt-muted)]">(v{item.version})</span></span>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                item.isIssued || item.status === 'Emitido'
                                  ? 'bg-[var(--pt-ok-soft)] text-[color:var(--pt-ok)] border-[color:var(--pt-line-strong)]'
                                  : item.status.includes('Aprobado')
                                  ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border-[color:var(--pt-line-strong)]'
                                  : item.status === 'Rechazado'
                                  ? 'bg-[var(--pt-danger-soft)] text-[color:var(--pt-danger)] border-[color:var(--pt-danger)]'
                                  : 'bg-[var(--pt-warn-soft)] text-[color:var(--pt-warn)] border-[color:var(--pt-line-strong)]'
                              }`}>
                                {item.isIssued || item.status === 'Emitido' ? 'Emitido' : item.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[color:var(--pt-muted)] italic">
                      No hay borradores previos en esta atención.
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={loadDraft} className="space-y-2 pt-2 border-t border-[color:var(--pt-line)]">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Cargar otro Borrador por ID directo
                </label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs font-mono text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" 
                    inputMode="numeric" 
                    value={draftId} 
                    onChange={(event) => setDraftId(event.target.value)} 
                    placeholder="Ej. 46, 52..." 
                    required 
                  />
                  <button className="rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-sunken)] px-3 py-2 text-xs font-semibold hover:bg-[var(--pt-line)] transition-all cursor-pointer">
                    Cargar
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-[11px] text-[color:var(--pt-ink-2)] space-y-1.5">
                <p className="font-semibold text-[color:var(--pt-ink)] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" /> Gobernanza del Borrador
                </p>
                <p>• Los borradores se originan desde una atención clínica autorizada.</p>
                <p>• El borrador usa una plantilla institucional publicada y el procedimiento confirmado.</p>
                <p>• El odontólogo es el único facultado para aprobar y emitir al paciente.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[color:var(--pt-line)]">
                <h2 className="font-bold text-[color:var(--pt-ink)] text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[color:var(--pt-accent)]" />
                  Estudio de Revisión Humana y Emisión
                </h2>
                {draft && (() => {
                  const isIssued = draft.status === 'Emitido' || Boolean(draft.isIssued) || Boolean(draft.indicationId);
                  const displayStatus = isIssued ? 'Emitido' : draft.status;
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isIssued ? 'bg-[var(--pt-ok-soft)] text-[color:var(--pt-ok)] border-[color:var(--pt-line-strong)]' :
                      displayStatus.includes('Aprobado') ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border-[color:var(--pt-line-strong)]' :
                      displayStatus === 'Rechazado' ? 'bg-[var(--pt-danger-soft)] text-[color:var(--pt-danger)] border-[color:var(--pt-danger)]' :
                      'bg-[var(--pt-warn-soft)] text-[color:var(--pt-warn)] border-[color:var(--pt-line-strong)]'
                    }`}>
                      {displayStatus} · Versión {draft.version}
                    </span>
                  );
                })()}
              </div>

              {draft ? (() => {
                const isIssued = draft.status === 'Emitido' || Boolean(draft.isIssued) || Boolean(draft.indicationId);
                const isRejected = draft.status === 'Rechazado';
                const isApproved = ['Aprobado', 'Corregido_Y_Aprobado'].includes(draft.status);
                return (
                  <div className="space-y-4">
                    <div className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                      isIssued
                        ? 'bg-[var(--pt-ok-soft)] border-[color:var(--pt-line-strong)] text-[color:var(--pt-ok)]'
                        : isRejected
                        ? 'bg-[var(--pt-danger-soft)] border-[color:var(--pt-danger)] text-[color:var(--pt-danger)]'
                        : draft.status.includes('Aprobado')
                        ? 'bg-[var(--pt-accent-soft)] border-[color:var(--pt-line-strong)] text-[color:var(--pt-accent)]'
                        : 'bg-[var(--pt-warn-soft)] border-[color:var(--pt-line-strong)] text-[color:var(--pt-warn)]'
                    }`}>
                      <span className="font-semibold">Borrador #{draft.draftId} (Raíz #{draft.rootId})</span>
                      <span className="text-[11px] font-medium">
                        {isIssued
                          ? '✓ Documento emitido formalmente al portal del paciente'
                          : isRejected
                          ? `Descartado clínicamente: ${draft.reason || 'Sin justificación'}`
                          : draft.status.includes('Aprobado')
                          ? 'Aprobado clínicamente · Listo para emisión'
                          : 'Borrador interno no emitido al paciente'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                          Contenido Clínico del Documento
                        </label>
                        {!isIssued && !isRejected && !isApproved && (
                          <span className="text-[11px] text-[color:var(--pt-muted)]">
                            Puedes editar el texto antes de aprobar
                          </span>
                        )}
                      </div>
                      {draftContent !== draft.content && <p role="status" className="pt-note">Hay correcciones sin guardar. Guarda la nueva versión antes de aprobar o emitir.</p>}
                      <textarea 
                        className="w-full min-h-60 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 text-xs leading-relaxed text-[color:var(--pt-ink)] font-mono outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" 
                        aria-label="Contenido de indicaciones postatención"
                        value={draftContent} 
                        onChange={(event) => setDraftContent(event.target.value)} 
                        disabled={busy || isIssued || isRejected || isApproved}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[color:var(--pt-line)]">
                      {!isIssued && !isRejected && (
                        <>
                          <button 
                            disabled={busy} 
                            onClick={() => void updateDraft('revise')} 
                            className="rounded-xl border border-[color:var(--pt-line-strong)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--pt-sunken)] transition-all cursor-pointer"
                          >
                            Guardar como Nueva Versión
                          </button>
                          <button 
                            disabled={busy} 
                            onClick={() => void updateDraft('approve')} 
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all shadow-sm cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Revisar y aprobar indicaciones
                          </button>
                          <button 
                            disabled={busy} 
                            onClick={() => void updateDraft('reject')} 
                            className="rounded-xl border border-[color:var(--pt-danger)] px-3 py-2 text-xs font-semibold text-[color:var(--pt-danger)] hover:bg-[var(--pt-danger-soft)] transition-all cursor-pointer"
                          >
                            Rechazar Borrador
                          </button>
                        </>
                      )}

                      {isApproved && !isIssued && <button type="button" className="pt-btn pt-btn-primary" disabled={busy || draftContent !== draft.content} onClick={() => void updateDraft('issue')}>Emitir versión aprobada al portal del paciente</button>}

                      {isIssued && (
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--pt-ok)] bg-[var(--pt-ok-soft)] px-3.5 py-2 rounded-xl border border-[color:var(--pt-line-strong)]">
                          <CheckCircle2 className="w-4 h-4 text-[color:var(--pt-ok)]" />
                          Documento emitido y visible para el paciente en su portal
                        </div>
                      )}

                      {isRejected && (
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--pt-danger)] bg-[var(--pt-danger-soft)] px-3.5 py-2 rounded-xl border border-[color:var(--pt-danger)]">
                          <AlertTriangle className="w-4 h-4 text-[color:var(--pt-danger)]" />
                          Borrador archivado y descartado
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="py-14 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--pt-ink)]">Ningún borrador activo en el visor</p>
                    <p className="mt-1 text-xs text-[color:var(--pt-muted)] max-w-md mx-auto">
                      Para redactar indicaciones con IA, selecciona a tu paciente en <span className="font-semibold text-[color:var(--pt-accent)]">"Atención & Documentación"</span> y haz clic en <span className="font-semibold text-[color:var(--pt-accent)]">"Preparar indicaciones desde plantilla"</span>. Se abrirá automáticamente aquí.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSection('workspace')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all cursor-pointer shadow-sm"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      Ir a Selección de Atención
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 3: SOLICITUDES DE REPROGRAMACIÓN (RECEPCIÓN & ADMIN) */}
        {section === 'requests' && isReception && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-[color:var(--pt-ink)] text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[color:var(--pt-accent)]" />
                    Bandeja de Reprogramaciones Solicitadas
                  </h2>
                  <p className="mt-0.5 text-xs text-[color:var(--pt-muted)]">
                    Aprobar una solicitud registra la conformidad. La reasignación de horario se realiza mediante la selección de un cupo real en agenda.
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] px-2.5 py-1 rounded-full border border-[color:var(--pt-line-strong)]">
                  {requests.length} Solicitud(es)
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {requests.map((item) => (
                <article key={item.requestId} className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-[color:var(--pt-ink)]">
                        Solicitud #{item.requestId} · {item.patientName || `Paciente #${item.patientId}`}
                      </span>
                      {item.patientDni && (
                        <span className="font-mono text-[10.5px] px-1.5 py-0.2 rounded bg-[var(--pt-sunken)] text-[color:var(--pt-muted)] border border-[color:var(--pt-line)]">
                          DNI {item.patientDni}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'Aprobada' ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border-[color:var(--pt-line-strong)]' :
                        item.status === 'Rechazada' ? 'bg-[var(--pt-danger-soft)] text-[color:var(--pt-danger)] border-[color:var(--pt-danger)]' :
                        item.status === 'Aplicada' ? 'bg-[var(--pt-ok-soft)] text-[color:var(--pt-ok)] border-[color:var(--pt-line-strong)]' :
                        'bg-[var(--pt-warn-soft)] text-[color:var(--pt-warn)] border-[color:var(--pt-line-strong)]'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs text-[color:var(--pt-ink-2)]">
                      <span className="font-semibold text-[color:var(--pt-ink)]">{item.serviceName || 'Tratamiento'}</span> (Sesión #{item.sessionNumber || item.sessionId}) · {item.professionalName} · {item.branchName}
                    </p>

                    <p className="text-xs text-[color:var(--pt-ink-2)]">
                      Fecha programada: <span className="font-medium text-[color:var(--pt-ink)]">{dateLabel(item.originalDate)}</span> → Preferencia solicitada: <span className="font-medium text-[color:var(--pt-accent)]">{item.preferredDate ? dateLabel(item.preferredDate) : 'A coordinar'} {item.preferredSlot ? `(${item.preferredSlot})` : ''}</span>
                    </p>

                    {item.reason && (
                      <p className="text-[11px] text-[color:var(--pt-ink-2)] bg-[var(--pt-sunken)] p-2 rounded-lg border border-[color:var(--pt-line)] leading-relaxed">
                        <strong className="text-[color:var(--pt-muted)]">Motivo del paciente:</strong> {item.reason}
                      </p>
                    )}

                    {item.resolutionReason && (
                      <p className="text-[11px] text-[color:var(--pt-muted)] italic">Nota de resolución: {item.resolutionReason}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.status === 'Pendiente' && (
                      <>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'En_Revision')} 
                          className="rounded-xl border border-[color:var(--pt-line-strong)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pt-sunken)] transition-all cursor-pointer"
                        >
                          Iniciar Revisión
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Aprobada')} 
                          className="rounded-xl bg-[var(--pt-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all cursor-pointer shadow-xs"
                        >
                          Aprobar
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Rechazada')} 
                          className="rounded-xl border border-[color:var(--pt-danger)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-danger)] hover:bg-[var(--pt-danger-soft)] transition-all cursor-pointer"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {item.status === 'En_Revision' && (
                      <>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Aprobada')} 
                          className="rounded-xl bg-[var(--pt-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all cursor-pointer shadow-xs"
                        >
                          Aprobar
                        </button>
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewRequestModal(item, 'Rechazada')} 
                          className="rounded-xl border border-[color:var(--pt-danger)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-danger)] hover:bg-[var(--pt-danger-soft)] transition-all cursor-pointer"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {item.status === 'Aprobada' && (
                      <button 
                        disabled={busy} 
                        onClick={() => void openApplyModal(item)} 
                        className="rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-accent)] hover:bg-[var(--pt-accent-soft)] transition-all cursor-pointer shadow-xs"
                      >
                        Aplicar en Agenda Oficial
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {!requests.length && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-[color:var(--pt-line-strong)] p-6 text-xs text-[color:var(--pt-muted)]">
                  No hay solicitudes de reprogramación en esta bandeja.
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 4: BANDEJA DE ALERTAS ASISTENCIALES */}
        {section === 'alerts' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[var(--pt-warn-soft)] flex items-center justify-center text-[color:var(--pt-warn)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-[color:var(--pt-ink)] text-sm">Bandeja de Alertas Clínicas y Asistenciales</h2>
                  <p className="text-xs text-[color:var(--pt-muted)]">
                    Reglas sobre registros. La prioridad corresponde a su revisión; no mide gravedad clínica. Revisar o atender una alerta no autoriza procedimientos ni confirma su seguridad.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[color:var(--pt-warn)] bg-[var(--pt-warn-soft)] px-2.5 py-1 rounded-full border border-[color:var(--pt-line-strong)]">
                {alerts.length} alertas mostradas
              </span>
            </div>

            <div className="grid gap-3">
              {alerts.map((alert) => {
                const isHighReviewPriority = ['CRITICA', 'ALTA'].includes(alert.severity.toUpperCase());
                return (
                  <article key={alert.alertId} className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
 isHighReviewPriority ? 'bg-[var(--pt-danger-soft)] text-[color:var(--pt-danger)] border-[color:var(--pt-danger)] ' :
 'bg-[var(--pt-warn-soft)] text-[color:var(--pt-warn)] border-[color:var(--pt-line-strong)] '
 }`}>
                          {formatAlertTitle(alert.type)} · Prioridad de revisión: {alert.severity}
                        </span>
                        <span className="text-xs font-semibold text-[color:var(--pt-muted)]">{alert.status}</span>
                      </div>
                      <p className="text-xs font-medium text-[color:var(--pt-ink)]">{alert.message}</p>
                      <p className="text-[11px] text-[color:var(--pt-muted)]">Regla: {alert.type} · Versión: {alert.ruleVersion || 'No registrada'} · Fuente: {alert.source || 'NexoSaludDB'}</p>
                      <p className="text-[11px] text-[color:var(--pt-muted)] font-mono">
                        Atención: #{alert.attentionId ?? '—'} · Tratamiento: #{alert.treatmentId ?? '—'} · {dateLabel(alert.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'Generada' && (
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewAlertModal(alert, 'En_Revision')} 
                          className="rounded-xl border border-[color:var(--pt-line-strong)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--pt-sunken)] transition-all"
                        >
                          Revisar
                        </button>
                      )}
                      {['Generada', 'En_Revision'].includes(alert.status) && (
                        <button 
                          disabled={busy} 
                          onClick={() => openReviewAlertModal(alert, 'Atendida')} 
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar Atendida
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {!alerts.length && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-[color:var(--pt-line-strong)] p-6 text-xs text-[color:var(--pt-muted)]">
                  No hay alertas abiertas recuperadas para este perfil. Su ausencia no acredita seguridad clínica ni sustituye la revisión profesional.
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN 5: ASISTENTE COPILOTO IA STAFF (FULL WIDTH WORKSPACE) */}
        {section === 'assistant' && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            {/* Panel Izquierdo: Guías Clínicas & Acceso Rápido */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-[color:var(--pt-ink)] flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-[color:var(--pt-accent)]" />
                  Biblioteca Normativa & Guías
                </h2>
                <p className="mt-1 text-xs text-[color:var(--pt-muted)]">
                  Protocolos clínicos, directivas MINSA y normativas institucionales de NexoSalud indexadas en el motor RAG.
                </p>
              </div>

              {/* Catálogo de Documentos Oficiales en Word (.docx) */}
              <div className="space-y-2 pt-2 border-t border-[color:var(--pt-line)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block">
                    Documentos Oficiales Indexados
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border border-[color:var(--pt-line-strong)]">
                    {knowledgeDocs.length} DOCX
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {knowledgeDocs.length > 0 ? (
                    knowledgeDocs.map((doc) => (
                      <button
                        key={doc.code}
                        type="button"
                        onClick={() => {
                          void loadDocumentDetail(doc.code);
                          setSection('knowledge');
                        }}
                        className="w-full text-left p-2 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)]/60 hover:bg-[var(--pt-sunken)] hover:border-[color:var(--pt-line-strong)] text-xs space-y-1 transition-all cursor-pointer group"
                        title="Ver y gestionar en Gobernanza RAG"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10.5px] font-bold text-[color:var(--pt-accent)] group-hover:underline">
                            {doc.code}
                          </span>
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[var(--pt-ok-soft)] text-[color:var(--pt-ok)] border border-[color:var(--pt-line-strong)]">
                            {doc.format} v{doc.latestVersion}
                          </span>
                        </div>
                        <p className="text-[11px] text-[color:var(--pt-ink)] leading-snug line-clamp-2">
                          {doc.title}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="text-[11px] text-[color:var(--pt-muted)] italic">
                      Cargando catálogo documental...
                    </p>
                  )}
                </div>
              </div>

              {/* Consultas Frecuentes por Categoría */}
              <div className="space-y-3 pt-2 border-t border-[color:var(--pt-line)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block">
                  Consultas Rápidas Sugeridas
                </span>
                <div className="space-y-1.5">
                  {[
                    '¿Cuáles son los requisitos de cierre documental de una atención?',
                    '¿Qué campos mínimos debe contener la ficha de evolución clínica?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendChat(undefined, chip)}
                      className="w-full text-left text-xs p-2.5 rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] hover:bg-[var(--pt-accent-soft)] hover:border-[color:var(--pt-line-strong)] transition-all cursor-pointer font-medium leading-relaxed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block pt-2">
                  Protocolos Odontológicos
                </span>
                <div className="space-y-1.5">
                  {[
                    '¿Cuál es el protocolo postoperatorio para exodoncia quirúrgica?',
                    '¿Cómo opera la política institucional de reprogramación de citas?',
                    '¿Qué criterios definen la transición de CUSTOMER a TURNED?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendChat(undefined, chip)}
                      className="w-full text-left text-xs p-2.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] transition-all cursor-pointer font-medium leading-relaxed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sello de Gobernanza RAG */}
              <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-[11px] text-[color:var(--pt-ink-2)] space-y-1.5">
                <p className="font-semibold text-[color:var(--pt-ink)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" /> Motor RAG Lexical Activo
                </p>
                <p>
                  Las respuestas se fundamentan en documentos institucionales auditados mediante concordancia léxica BM25 y function calling autorizados.
                </p>
              </div>
            </div>

            {/* Panel Derecho: Área de Conversación Panorámica a Todo el Ancho */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm flex flex-col justify-between space-y-4 min-h-[580px]">
              {/* Encabezado del Chat */}
              <div className="flex items-center justify-between pb-3 border-b border-[color:var(--pt-line)]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[color:var(--pt-ink)] text-sm">
                      Copiloto Normativo & Documental
                    </h2>
                    <p className="text-xs text-[color:var(--pt-muted)]">
                      Asistencia inteligente fundamentada en guías clínicas oficiales y políticas institucionales
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] px-2.5 py-1 rounded-full border border-[color:var(--pt-line-strong)]">
                    {chatMessages.length} {chatMessages.length === 1 ? 'mensaje' : 'mensajes'}
                  </span>
                  {chatMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setChatMessages([])}
                      className="text-xs text-[color:var(--pt-muted)] hover:text-[color:var(--pt-ink-2)] px-2 py-1 rounded-lg hover:bg-[var(--pt-sunken)] transition-all cursor-pointer"
                      title="Limpiar conversación actual"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Flujo de Mensajes a Ancho Completo */}
              <div aria-live="polite" className="flex-1 space-y-3.5 overflow-y-auto max-h-[500px] pr-2">
                {chatMessages.map((item, index) => (
                  <div 
                    key={index} 
                    className={`rounded-2xl p-4 text-xs leading-relaxed transition-all ${
 item.role === 'Tú' 
 ? 'ml-12 md:ml-32 bg-[var(--pt-accent)] text-[color:var(--pt-accent-ink)] shadow-sm' 
 : 'mr-6 md:mr-16 bg-[var(--pt-sunken)] border border-[color:var(--pt-line)] text-[color:var(--pt-ink)] shadow-2xs'
 }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 border-b border-black/10 pb-1">
                      <span className="font-bold text-[11px] opacity-85">{item.role}</span>
                      {item.role !== 'Tú' && (
                        <span className="text-[10px] font-mono opacity-60">Respuesta Oficial Asistida</span>
                      )}
                    </div>
                    
                    <FormattedMessage text={item.content} />
                    
                    {item.references && item.references.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-surface)] p-3 text-[11px] text-[color:var(--pt-ink)] shadow-2xs">
                        <p className="flex items-center gap-1.5 font-bold text-[color:var(--pt-accent)]">
                          <BookOpen className="h-3.5 w-3.5" /> Referencias Institucionales Verificadas:
                        </p>
                        <ul className="mt-1.5 list-disc list-inside space-y-1 text-[color:var(--pt-ink-2)]">
                          {item.references.map((ref, idx) => {
                            const codeMatch = ref.match(/(DOC-[A-Z0-9_-]+|PILOT-[A-Z0-9_-]+|KB-\d+)/i);
                            const refCode = codeMatch ? codeMatch[1] : null;
                            return (
                              <li key={idx} className="font-mono text-[10.5px] bg-[var(--pt-sunken)] px-1.5 py-0.5 rounded inline-block mr-1">
                                {ref}
                                {refCode && isDentist && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void loadDocumentDetail(refCode);
                                      setSection('knowledge');
                                    }}
                                    className="ml-2 text-[10.5px] font-sans font-semibold text-[color:var(--pt-accent)] hover:underline cursor-pointer"
                                  >
                                    [ Ver / Descargar .docx ]
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {!chatMessages.length && (
                  <div className="py-16 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--pt-ink)]">
                        Copiloto Normativo Listo
                      </p>
                      <p className="text-xs text-[color:var(--pt-muted)] max-w-md mx-auto mt-1">
                        Escribe una consulta en la barra inferior o selecciona una de las preguntas sugeridas en el panel izquierdo para consultar reglamentos, protocolos y directivas clínicas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Entrada del Chat Full-Width */}
              <form onSubmit={sendChat} className="pt-3 border-t border-[color:var(--pt-line)] flex gap-2 w-full">
                <input 
                  className="flex-1 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-4 py-2.5 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)] shadow-inner" 
                  value={chatInput} 
                  onChange={(event) => setChatInput(event.target.value)} 
                  maxLength={2000} 
                  placeholder="Pregunta sobre reglamentos de atención, guías de práctica clínica o requisitos documentales..." 
                />
                <button 
                  disabled={busy || !chatInput.trim()} 
                  className="rounded-xl bg-[var(--pt-accent)] px-5 py-2.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </section>
        )}

        {/* SECCIÓN 6: GOBERNANZA RAG & DOCUMENTOS OFICIALES (.DOCX) */}
        {section === 'knowledge' && isDentist && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] w-full">
            {/* Panel Izquierdo: Catálogo de Documentos Oficiales Indexados */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-[color:var(--pt-ink)] flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-[color:var(--pt-accent)]" />
                    Biblioteca & Gobernanza RAG
                  </h2>
                  <p className="mt-1 text-xs text-[color:var(--pt-muted)]">
                    Documentos normativos y clínicos en formato Word (.docx) indexados en el motor RAG.
                  </p>
                </div>
              </div>

              {/* Botón Registrar (ADMIN) */}
              {role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setShowRegisterDocModal(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Nuevo Documento</span>
                </button>
              )}

              {/* Filtro de Búsqueda */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[color:var(--pt-muted)]" />
                <input
                  type="text"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder="Buscar por código o título..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                />
              </div>

              {/* Filtros por Categoría */}
              <div className="flex flex-wrap gap-1.5">
                {['TODOS', 'CLINICO', 'OPERATIVO', 'NORMATIVA', 'PRIVACIDAD'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDocCategoryFilter(cat)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-all cursor-pointer ${
                      docCategoryFilter === cat
                        ? 'bg-[var(--pt-accent)] text-[color:var(--pt-accent-ink)] font-semibold shadow-2xs'
                        : 'border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)] hover:text-[color:var(--pt-ink)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Lista de Documentos Oficiales */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {knowledgeDocs
                  .filter((doc) => {
                    const matchQ = !docSearchQuery.trim() ||
                      doc.code.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
                      doc.title.toLowerCase().includes(docSearchQuery.toLowerCase());
                    const matchC = docCategoryFilter === 'TODOS' || doc.category === docCategoryFilter;
                    return matchQ && matchC;
                  })
                  .map((doc) => {
                    const isSelected = selectedDocCode === doc.code;
                    return (
                      <button
                        key={doc.code}
                        type="button"
                        onClick={() => void loadDocumentDetail(doc.code)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'border-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)]/30 shadow-2xs'
                            : 'border-[color:var(--pt-line)] bg-[var(--pt-sunken)]/60 hover:bg-[var(--pt-sunken)] hover:border-[color:var(--pt-line-strong)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[color:var(--pt-accent)]">
                            {doc.code}
                          </span>
                          <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full border ${
                            doc.status === 'PUBLISHED'
                              ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border-[color:var(--pt-accent)]'
                              : doc.status === 'APPROVED'
                              ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                              : doc.status === 'REVOKED'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {knowledgeStatusLabel(doc.status)}
                          </span>
                        </div>
                        <p className="text-xs text-[color:var(--pt-ink)] font-medium leading-snug line-clamp-2">
                          {doc.title}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-[color:var(--pt-line)] text-[10px] text-[color:var(--pt-muted)] font-mono">
                          <span>{doc.format} v{doc.latestVersion}</span>
                          <span className="px-1.5 py-0.2 rounded bg-[var(--pt-surface)] border border-[color:var(--pt-line)]">
                            {doc.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Guía de Gobernanza Documental */}
              <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3.5 text-[11px] text-[color:var(--pt-ink-2)] space-y-2">
                <p className="font-bold text-[color:var(--pt-ink)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                  Gobernanza Institucional de 4 Fases
                </p>
                <ol className="space-y-1 list-decimal list-inside text-[color:var(--pt-ink-2)] text-[10.5px] leading-relaxed">
                  <li><strong className="text-[color:var(--pt-ink)]">Registro:</strong> Código y categoría por ADMIN.</li>
                  <li><strong className="text-[color:var(--pt-ink)]">Versión (.docx):</strong> Carga por ODONTÓLOGO o ADMIN con declaración anti-datos personales.</li>
                  <li><strong className="text-[color:var(--pt-ink)]">Aprobación:</strong> Validación médica por ODONTÓLOGO o ADMIN.</li>
                  <li><strong className="text-[color:var(--pt-ink)]">Publicación:</strong> Ingesta en el índice RAG por ADMIN.</li>
                </ol>
              </div>
            </div>

            {/* Panel Derecho: Estudio de Gobernanza y Visor DOCX */}
            <div className="rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-6 shadow-sm flex flex-col justify-between space-y-5 min-h-[580px]">
              {selectedDocDetail ? (() => {
                const currentVer = selectedDocDetail.versions.find((v) => v.version === selectedDocVersion) || selectedDocDetail.versions[0];
                return (
                  <div className="space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Cabecera del Documento Seleccionado */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[color:var(--pt-line)]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border border-[color:var(--pt-line-strong)]">
                              {selectedDocDetail.code}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)] border border-[color:var(--pt-line)]">
                              {selectedDocDetail.category}
                            </span>
                          </div>
                          <h2 className="mt-1.5 text-base font-bold text-[color:var(--pt-ink)] leading-snug">
                            {selectedDocDetail.title}
                          </h2>
                          <p className="text-xs text-[color:var(--pt-muted)] mt-0.5">
                            Registrado el {dateLabel(selectedDocDetail.createdAt)} · {selectedDocDetail.versions.length} {selectedDocDetail.versions.length === 1 ? 'versión' : 'versiones'} en historial
                          </p>
                        </div>

                        {/* Botones de Acción de Documento */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDownloadDocx(selectedDocDetail.code, currentVer?.version)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-ink)] hover:bg-[var(--pt-sunken)] transition-all cursor-pointer shadow-2xs"
                            title="Descargar documento completo en formato Word (.docx)"
                          >
                            <Download className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                            <span>Descargar .docx</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const maxV = selectedDocDetail.versions.reduce((max, v) => Math.max(max, v.version), 0);
                              setNewVerNumber(maxV + 1);
                              setShowSubmitVersionModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] transition-all cursor-pointer shadow-xs"
                            title="Subir una nueva versión documental en .docx"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Nueva Versión</span>
                          </button>

                          {role === 'ADMIN' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteDocument(selectedDocDetail.code)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                              title="Archivar y retirar documento de la biblioteca"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Archivar</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Selector de Versiones */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block">
                          Historial de Versiones
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {selectedDocDetail.versions.map((ver) => {
                            const isVerActive = (currentVer?.version ?? 1) === ver.version;
                            return (
                              <button
                                key={ver.version}
                                type="button"
                                onClick={() => setSelectedDocVersion(ver.version)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                                  isVerActive
                                    ? 'bg-[var(--pt-accent)] text-[color:var(--pt-accent-ink)] shadow-xs'
                                    : 'border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)] hover:text-[color:var(--pt-ink)]'
                                }`}
                              >
                                <span>v{ver.version} ({ver.format})</span>
                                <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  ver.status === 'PUBLISHED'
                                    ? isVerActive ? 'bg-black/10 text-[color:var(--pt-accent-ink)]' : 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)]'
                                    : ver.status === 'APPROVED'
                                    ? isVerActive ? 'bg-white/20 text-white' : 'bg-teal-500/20 text-teal-300'
                                    : ver.status === 'REVOKED'
                                    ? isVerActive ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-300'
                                    : isVerActive ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {knowledgeStatusLabel(ver.status)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Barra de Estado y Metadatos de la Versión Activa */}
                      {currentVer && (
                        <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[color:var(--pt-ink)]">Versión {currentVer.version}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                currentVer.status === 'PUBLISHED'
                                  ? 'bg-[var(--pt-accent-soft)] text-[color:var(--pt-accent)] border-[color:var(--pt-accent)]'
                                  : currentVer.status === 'APPROVED'
                                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                  : currentVer.status === 'REVOKED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {knowledgeStatusLabel(currentVer.status)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-[color:var(--pt-muted)] font-mono">
                              <span>SHA256: {currentVer.contentHash.slice(0, 10)}…</span>
                              <span>Vigencia: {dateLabel(currentVer.validFrom)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-2 border-t border-[color:var(--pt-line)]">
                            <span className="text-[color:var(--pt-muted)] font-medium">Audiencia Autorizada:</span>
                            {currentVer.allowedRoles.map((roleTag) => (
                              <span key={roleTag} className="px-2 py-0.5 rounded bg-[var(--pt-surface)] border border-[color:var(--pt-line)] font-mono text-[10px] text-[color:var(--pt-ink-2)]">
                                {roleTag}
                              </span>
                            ))}
                          </div>

                          {/* Acciones Contextuales de Gobernanza */}
                          {(currentVer.status === 'DRAFT' || currentVer.status === 'IN_REVIEW') && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs mt-2">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                <div>
                                  <span className="font-semibold text-amber-300">Borrador pendiente de Aprobación Clínica</span>
                                  <p className="text-[11px] text-amber-200/80">Requiere revisión humana por un Odontólogo o Administrador médico colegiado.</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleApproveVersion(currentVer.version)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs cursor-pointer shrink-0"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Aprobar Clínicamente</span>
                              </button>
                            </div>
                          )}

                          {currentVer.status === 'APPROVED' && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-teal-500/30 bg-teal-500/10 text-xs mt-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                                <div>
                                  <span className="font-semibold text-teal-300">Versión Aprobada · Lista para Publicación RAG</span>
                                  <p className="text-[11px] text-teal-200/80">Aprobada clínicamente. Solo un Administrador puede publicarla e indexarla en el motor IA.</p>
                                </div>
                              </div>
                              {role === 'ADMIN' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handlePublishVersion(currentVer.version)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] hover:bg-[var(--pt-accent-hover)] px-3.5 py-1.5 text-xs font-semibold text-[color:var(--pt-accent-ink)] shadow-xs cursor-pointer shrink-0"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Publicar Oficialmente en RAG</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-mono text-[color:var(--pt-muted)] italic">Esperando publicación por Administración</span>
                              )}
                            </div>
                          )}

                          {currentVer.status === 'PUBLISHED' && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-[color:var(--pt-accent)] bg-[var(--pt-accent-soft)] text-xs mt-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[color:var(--pt-accent)] shrink-0" />
                                <div>
                                  <span className="font-semibold text-[color:var(--pt-ink)]">Versión publicada e indexada en el RAG</span>
                                  <p className="text-xs text-[color:var(--pt-ink-2)]">Disponible para responder consultas con fuentes verificables y citas documentales.</p>
                                </div>
                              </div>
                              {role === 'ADMIN' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setShowRevokeModal(true)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Revocar del RAG</span>
                                </button>
                              )}
                            </div>
                          )}

                          {currentVer.status === 'REVOKED' && (
                            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs space-y-1 mt-2">
                              <div className="flex items-center gap-2 text-rose-400 font-semibold">
                                <XCircle className="w-4 h-4" />
                                <span>Versión Revocada del Motor RAG</span>
                              </div>
                              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                                Motivo consignado: <span className="italic font-medium">{currentVer.revocationReason || 'No especificado'}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Visor de Contenido Extraído de DOCX */}
                      {currentVer && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--pt-ink-2)]">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                              Contenido Extraído del Documento DOCX (v{currentVer.version})
                            </span>
                            <span className="font-mono text-[11px] text-[color:var(--pt-muted)]">
                              {currentVer.content.length} caracteres
                            </span>
                          </div>
                          <div className="rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-4 max-h-[420px] overflow-y-auto text-xs leading-relaxed font-sans text-[color:var(--pt-ink)] whitespace-pre-wrap select-text shadow-inner">
                            {currentVer.content}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="py-24 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--pt-accent-soft)] flex items-center justify-center text-[color:var(--pt-accent)]">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--pt-ink)]">
                      Selecciona un Documento Oficial
                    </p>
                    <p className="text-xs text-[color:var(--pt-muted)] max-w-md mx-auto mt-1">
                      Elige un documento de la biblioteca en el panel izquierdo para inspeccionar su contenido, descargar el archivo .docx o auditar su ciclo de vida y versiones en el RAG.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* MODAL: APLICAR REPROGRAMACIÓN EN AGENDA */}
        {applyModalRequest && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="apply-reschedule-title" className="w-full max-w-lg rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
                <CheckCircle2 className="h-5 w-5" />
                <h2 id="apply-reschedule-title" className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Aplicar Reprogramación a la Agenda Oficial
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)]">
                Solicitud #{applyModalRequest.requestId} (Sesión #{applyModalRequest.sessionId}). Fecha original: <span className="font-semibold">{dateLabel(applyModalRequest.originalDate)}</span>.
              </p>
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Cupo Disponible en Agenda
                  {availableSlotsList.length > 0 ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                      value={selectedSlotId ?? ''}
                      onChange={(e) => setSelectedSlotId(Number(e.target.value))}
                    >
                      {availableSlotsList.map((slot) => (
                        <option key={slot.id_disponibilidad} value={slot.id_disponibilidad}>
                          {slot.fecha} · {slot.hora_inicio} - {slot.hora_fin} ({slot.sede} · {slot.profesional})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 rounded-xl border border-dashed border-[color:var(--pt-line-strong)] bg-[var(--pt-danger-soft)] p-2 text-xs text-[color:var(--pt-danger)]">
                      No hay slots libres en este momento.
                    </p>
                  )}
                </label>
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Motivo o Justificación de la Aplicación
                  <textarea
                    className="mt-1 w-full min-h-20 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2.5 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    maxLength={300}
                    required
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button type="button" onClick={() => setApplyModalRequest(null)} className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !selectedSlotId || !applyReason.trim()}
                  onClick={() => void confirmApplyReschedule()}
                  className="rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all"
                >
                  Confirmar Cambio en Agenda
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: REVISAR ALERTA CON EVIDENCIA */}
        {alertReviewModal && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-warn)]">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Registrar Revisión de Alerta #{alertReviewModal.alert.alertId}
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)]">
                Esta revisión no autoriza procedimientos ni certifica seguridad clínica. Transición solicitada a estado: <span className="font-bold text-[color:var(--pt-accent)]">{alertReviewModal.nextStatus}</span>.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Evidencia o Motivo Clínico (Obligatorio, máx. 200 caracteres)
                </label>
                <textarea 
                  className="w-full min-h-20 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2.5 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" 
                  value={alertEvidenceText} 
                  onChange={(e) => setAlertEvidenceText(e.target.value)} 
                  maxLength={200} 
                  placeholder="Ej. Se verificó con el paciente y se agendó sesión de control..." 
                  required 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button type="button" onClick={() => setAlertReviewModal(null)} className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !alertEvidenceText.trim()}
                  onClick={() => void confirmReviewAlert()}
                  className="rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all"
                >
                  Guardar Revisión
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: REVISAR SOLICITUD DE REPROGRAMACIÓN */}
        {requestReviewModal && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
                <CalendarCheck className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Revisión de Solicitud #{requestReviewModal.request.requestId}
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)]">
                Cambio a: <span className="font-bold">{requestReviewModal.nextStatus}</span>.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  {requestReviewModal.nextStatus === 'Rechazada' ? 'Motivo del Rechazo (Obligatorio)' : 'Nota de Revisión (Opcional)'}
                </label>
                <textarea 
                  className="w-full min-h-20 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2.5 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]" 
                  value={requestReviewReason} 
                  onChange={(e) => setRequestReviewReason(e.target.value)} 
                  maxLength={300} 
                  placeholder="Detalles de la resolución..." 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button type="button" onClick={() => setRequestReviewModal(null)} className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || (requestReviewModal.nextStatus === 'Rechazada' && !requestReviewReason.trim())}
                  onClick={() => void confirmReviewRequest()}
                  className="rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all"
                >
                  Confirmar Estado
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN DE APROBACIÓN DE BORRADOR */}
        {showApproveConfirmModal && draft && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Revisión y aprobación de indicaciones
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)] leading-relaxed">
                ¿Confirmas la aprobación clínica de la <span className="font-bold">versión {draft.version}</span> del borrador #{draft.draftId}? 
                Esta acción audita y certifica que el contenido ha sido revisado por ti como odontólogo responsable.
              </p>

              <label className="flex items-start gap-2.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={autoIssueToPatient} 
                  onChange={(e) => setAutoIssueToPatient(e.target.checked)} 
                  className="mt-0.5 rounded border-[color:var(--pt-line-strong)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)] cursor-pointer" 
                />
                <div className="text-xs">
                  <span className="font-semibold text-[color:var(--pt-ink)]">Emitir inmediatamente al portal del paciente</span>
                  <p className="text-[11px] text-[color:var(--pt-muted)] mt-0.5">
                    El paciente podrá visualizar y descargar sus indicaciones clínicas en su portal de forma inmediata.
                  </p>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button type="button" onClick={() => setShowApproveConfirmModal(false)} className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleApproveDraftConfirmed()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {autoIssueToPatient ? 'Aprobar y Emitir' : 'Solo Aprobar'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN DE RECHAZO DE BORRADOR */}
        {showRejectModal && draft && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-danger)]">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Descartar / Rechazar Borrador Clínico
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)] leading-relaxed">
                Estás a punto de descartar el borrador #{draft.draftId} (v{draft.version}). Ingresa la justificación médica para que quede asentada en la auditoría asistencial:
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Motivo clínico del rechazo (Obligatorio)
                </label>
                <textarea 
                  className="w-full min-h-24 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-danger)]" 
                  value={draftReason} 
                  onChange={(e) => setDraftReason(e.target.value)} 
                  maxLength={300} 
                  placeholder="Ej. Procedimiento reprogramado, requiere rectificación de pauta farmacológica, etc." 
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button type="button" onClick={() => setShowRejectModal(false)} className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !draftReason.trim()}
                  onClick={() => void handleRejectDraftConfirmed()}
                  className="rounded-xl bg-[var(--pt-danger)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </section>
          </div>
        )}

        {/* MODAL: REGISTRAR NUEVO DOCUMENTO (ADMIN) */}
        {showRegisterDocModal && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
                <BookOpen className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Registrar Documento Oficial en Biblioteca
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)] leading-relaxed">
                Asigna un código institucional normalizado y categoría para comenzar el ciclo de gobernanza RAG.
              </p>
              <form onSubmit={handleRegisterDocument} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Código Institucional (Ej. DOC-CLIN-03, MINSA-GUI-01)
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocCode}
                    onChange={(e) => setNewDocCode(e.target.value.toUpperCase())}
                    placeholder="DOC-CLIN-03"
                    className="mt-1 w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs font-mono text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Título Oficial del Documento
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="Guía Clínica de Odontopediatría y Prevención"
                    className="mt-1 w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Categoría Normativa
                  </label>
                  <select
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                  >
                    <option value="CLINICO">CLINICO (Guías de Práctica y Bioseguridad)</option>
                    <option value="OPERATIVO">OPERATIVO (Reprogramación, Citas y Funnel)</option>
                    <option value="NORMATIVA">NORMATIVA (MINSA NTS y Resoluciones)</option>
                    <option value="PRIVACIDAD">PRIVACIDAD (Protección de Datos y Consentimientos)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--pt-line)]">
                  <button
                    type="button"
                    onClick={() => setShowRegisterDocModal(false)}
                    className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !newDocCode.trim() || !newDocTitle.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Documento</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* MODAL: SUBIR NUEVA VERSIÓN DOCX */}
        {showSubmitVersionModal && selectedDocDetail && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-accent)]">
                <Upload className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Subir Versión v{newVerNumber} para {selectedDocDetail.code}
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)] leading-relaxed">
                Carga el archivo oficial en formato Word (<strong className="font-bold">.docx</strong>). El backend extraerá y validará el texto de forma segura y certificada.
              </p>
              <form onSubmit={handleSubmitVersion} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Número de Versión
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newVerNumber}
                    onChange={(e) => setNewVerNumber(Number(e.target.value))}
                    className="mt-1 w-28 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 py-2 text-xs font-mono text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    Archivo Word (.docx) o Texto
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[color:var(--pt-line-strong)] bg-[var(--pt-sunken)] hover:bg-[var(--pt-surface)] text-xs font-semibold text-[color:var(--pt-ink)] cursor-pointer transition-all shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-[color:var(--pt-accent)]" />
                      <span>{newVerFileName ? 'Cambiar archivo' : 'Seleccionar archivo .docx'}</span>
                      <input
                        type="file"
                        accept=".docx,.txt,.md"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleDocxFileSelected(f);
                        }}
                      />
                    </label>
                    <span className="text-xs font-mono text-[color:var(--pt-muted)] truncate max-w-xs">
                      {newVerFileName || 'Ningún archivo seleccionado'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                    O editar/pegar texto directamente (opcional si ya subió .docx)
                  </label>
                  <textarea
                    rows={4}
                    value={newVerText}
                    onChange={(e) => {
                      setNewVerText(e.target.value);
                      if (!newVerFileName) setNewVerFormat('TXT');
                    }}
                    placeholder="Contenido estructurado del documento institucional..."
                    className="mt-1 w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-xs font-sans text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)] mb-1">
                    Audiencia con Acceso al Documento
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    {['ODONTOLOGO', 'ADMIN', 'PACIENTE'].map((r) => (
                      <label key={r} className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newVerRoles.includes(r)}
                          onChange={(e) => {
                            if (e.target.checked) setNewVerRoles([...newVerRoles, r]);
                            else setNewVerRoles(newVerRoles.filter((x) => x !== r));
                          }}
                          className="rounded text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)]"
                        />
                        <span className="font-mono text-[11px] text-[color:var(--pt-ink-2)]">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={newVerDeclared}
                    onChange={(e) => setNewVerDeclared(e.target.checked)}
                    className="mt-0.5 rounded border-[color:var(--pt-line-strong)] text-[color:var(--pt-accent)] focus:ring-[color:var(--pt-accent)] cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-[color:var(--pt-ink)]">
                      Declaración de Anonimización y Ausencia de Datos Personales
                    </span>
                    <p className="text-[11px] text-[color:var(--pt-muted)] mt-0.5 leading-relaxed">
                      Declaro formalmente bajo fe de juramento que este documento normativo/clínico no contiene datos personales ni protegidos de pacientes (Ley 29733 de Protección de Datos Personales).
                    </p>
                  </div>
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--pt-line)]">
                  <button
                    type="button"
                    onClick={() => setShowSubmitVersionModal(false)}
                    className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !newVerDeclared || (!newVerBase64 && !newVerText.trim())}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pt-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--pt-accent-ink)] hover:bg-[var(--pt-accent-hover)] disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Versión para Revisión</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* MODAL: REVOCACIÓN DE VERSIÓN RAG (ADMIN) */}
        {showRevokeModal && selectedDocDetail && (
          <div className="pt-overlay" role="presentation">
            <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-[var(--pt-surface)] border border-[color:var(--pt-line)] p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-[color:var(--pt-danger)]">
                <XCircle className="h-5 w-5" />
                <h2 className="font-bold text-sm text-[color:var(--pt-ink)]">
                  Revocar Versión v{selectedDocVersion} del RAG
                </h2>
              </div>
              <p className="text-xs text-[color:var(--pt-ink-2)] leading-relaxed">
                Estás a punto de retirar de forma inmediata la versión {selectedDocVersion} de <strong className="font-bold">{selectedDocDetail.code}</strong>. Dejará de ser consultable por el Copiloto IA de manera instantánea.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[color:var(--pt-ink-2)]">
                  Motivo de Revocación Institucional (Mínimo 5 caracteres)
                </label>
                <textarea
                  required
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Ej. Normativa derogada por resolución ministerial o actualización de protocolo."
                  className="w-full rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-3 text-xs text-[color:var(--pt-ink)] outline-none focus:ring-2 focus:ring-[color:var(--pt-danger)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--pt-line)]">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="rounded-xl border border-[color:var(--pt-line-strong)] px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || revokeReason.trim().length < 5}
                  onClick={() => void handleRevokeVersionConfirmed()}
                  className="rounded-xl bg-[var(--pt-danger)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  Confirmar Revocación
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Footer Institucional con Declaración de Seguridad */}
        <footer className="flex items-start gap-2.5 rounded-2xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-4 text-xs leading-relaxed text-[color:var(--pt-ink-2)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--pt-accent)]" />
          <span>
            Las decisiones de aprobación clínica, revisión de alertas y asignación de agenda son acciones humanas auditadas y registradas en el backend. Los modelos de IA actúan estrictamente como copilotos de apoyo documental.
          </span>
        </footer>

    </div>
  );
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'No disponible';
  try {
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderTreatmentSummary(treatment: unknown): string {
  if (!treatment) return 'Sin tratamiento vinculado';
  if (typeof treatment === 'string') return treatment;
  if (typeof treatment === 'object') {
    const t = treatment as Record<string, unknown>;
    const name = t.serviceName || t.nombre || t.servicio || t.tipo || 'Evaluación Odontológica';
    const state = t.status || t.estado || '';
    return `${name}${state ? ` (${state})` : ''}`;
  }
  return String(treatment);
}

function renderAttentionSummary(attention: Record<string, unknown> | null | undefined) {
  if (!attention || Object.keys(attention).length === 0) {
    return <p className="text-[color:var(--pt-muted)] text-xs">Sin datos registrados de la cita.</p>;
  }

  const attendance = String(attention.attendance || '');
  const isPending = ['Pendiente', 'Confirmada'].includes(attendance);
  const isNoShow = ['No asistió', 'No asiste'].includes(attendance);
  const isAttended = ['Asistió', 'Asiste'].includes(attendance);
  const isCancelled = attention.serviceStatus === 'Cancelado';
  const reason = String(attention.reason || attention.motivo_consulta || '');
  const procedure = String(attention.procedure || attention.procedimiento || '');
  const allergies = String(attention.allergies || attention.alergias || '');
  const allergiesStatus = String(attention.allergiesStatus || (allergies ? 'DOCUMENTADA' : 'NO_REGISTRADA'));
  const pending = Array.isArray(attention.pendingVerification) ? (attention.pendingVerification as string[]) : [];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-[color:var(--pt-line)]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)]">Estado Asistencial:</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isPending ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
          isNoShow ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
          isAttended ? 'bg-[var(--pt-ok-soft)] text-[color:var(--pt-ok)]' : 'bg-[var(--pt-sunken)] text-[color:var(--pt-ink-2)]'
        }`}>
          {isCancelled ? 'Atención cancelada' : isPending ? 'Cita programada (pendiente)' : isNoShow ? 'Inasistencia registrada' : isAttended ? 'Asistencia registrada' : 'Estado sin confirmar'}
        </span>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block">Motivo de Consulta:</span>
        <span className="font-medium text-[color:var(--pt-ink)] block leading-snug">
          {reason && reason !== 'null' ? reason : (isPending ? 'Motivo no registrado; confirmar con el paciente' : 'No especificado en admisión')}
        </span>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--pt-muted)] block">Procedimiento registrado:</span>
        <span className="font-medium text-[color:var(--pt-ink)] block leading-snug">
          {procedure && procedure !== 'null' 
            ? procedure 
            : (isPending ? 'Pendiente de ejecución clínica en consulta presencial' : isNoShow ? 'No realizado por inasistencia del paciente' : 'Pendiente de registrar por odontólogo')}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[color:var(--pt-line)]">
        <span className="text-[color:var(--pt-muted)]">Alergias Clínicas:</span>
        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
          allergies && allergies !== 'null' && allergies !== 'NO_REGISTRADA' && allergies !== 'Ninguna'
            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
            : 'bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] border border-[color:var(--pt-line)]'
        }`}>
          {allergies && allergies !== 'null' ? allergies : (allergiesStatus === 'NO_REGISTRADA' ? 'No registradas; confirmar' : 'Consultar el registro')}
        </span>
      </div>

      {pending.length > 0 && (
        <div className={`mt-1.5 p-2 rounded-lg text-[11px] flex items-start gap-1.5 leading-relaxed ${
          isPending 
            ? 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
            : isNoShow
              ? 'bg-slate-800/80 border border-slate-700 text-slate-300'
              : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
        }`}>
          <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isPending ? 'text-sky-400' : isNoShow ? 'text-slate-400' : 'text-amber-400'}`} />
          <span>{pending.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;
        if (trimmed === '.') return null;

        const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="font-semibold opacity-90 shrink-0">{numMatch[1]}</span>
              <span className="flex-1">{renderBoldSpans(numMatch[2])}</span>
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5">
              <span className="opacity-75 shrink-0">•</span>
              <span className="flex-1">{renderBoldSpans(bulletMatch[1])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap">
            {renderBoldSpans(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function renderBoldSpans(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold underline decoration-[var(--pt-accent)]/30 decoration-1 underline-offset-2">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
