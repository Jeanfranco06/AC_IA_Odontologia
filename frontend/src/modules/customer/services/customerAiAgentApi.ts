import { patientAuthApi } from '@/shared/services/patientAuthService';
import { staffAuthService } from '@/shared/services/staffAuthService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BASE = `${API_URL}/customer/ai-agent`;

export interface ToolResponse<T> {
  success: true;
  data: T;
  meta: { source: string; correlationId: string };
}

async function request<T>(path: string, options: RequestInit = {}, audience: 'patient' | 'staff' = 'staff'): Promise<T> {
  const token = audience === 'patient' ? patientAuthApi.getAccessToken() : staffAuthService.getAccessToken();
  if (!token) throw new Error('Tu sesión no está disponible. Vuelve a iniciar sesión.');
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result ? result.error?.message : undefined;
    throw new Error(message || `La solicitud no pudo completarse (${response.status}).`);
  }
  return result as T;
}

function post<T = unknown>(path: string, body?: unknown, audience: 'patient' | 'staff' = 'staff'): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, audience);
}

export const customerAiAgentApi = {
  patientTreatments: () => request<ToolResponse<PatientTreatment[]>>('/me/treatments', {}, 'patient'),
  patientUpcoming: () => request<ToolResponse<UpcomingSession[]>>('/me/upcoming-sessions', {}, 'patient'),
  async patientAttentions(): Promise<{ data: PatientAttentionItem[]; meta?: unknown }> {
    const res = await request<any>('/me/attentions', {}, 'patient');
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const normalized: PatientAttentionItem[] = rawList.map((a: any) => ({
      id_atencion: Number(a.id_atencion ?? a.attentionId),
      id_tratamiento: a.id_tratamiento ?? a.treatmentId ?? null,
      fecha_hora: String(a.fecha_hora ?? a.date ?? ''),
      estado: String(a.estado ?? a.serviceStatus ?? 'Realizado'),
      servicio: String(a.servicio ?? a.serviceName ?? 'Consulta Odontológica'),
      profesional: String(a.profesional ?? a.professionalName ?? ''),
      sede: String(a.sede ?? a.branchName ?? 'Sede Principal'),
      indicaciones_aprobadas_count: a.indicaciones_aprobadas_count ?? (a.hasApprovedInstructions ? 1 : 0),
    }));
    return { ...res, data: normalized };
  },
  async patientPostCareInstructions(attentionId: number): Promise<{ data: PostCareInstructionItem[]; meta?: unknown }> {
    const res = await request<any>(`/attentions/${attentionId}/approved-instructions`, {}, 'patient');
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const normalized: PostCareInstructionItem[] = rawList.map((i: any) => ({
      id_indicacion: Number(i.id_indicacion ?? i.instructionId),
      id_atencion: Number(i.id_atencion ?? attentionId),
      estado: String(i.estado ?? i.status ?? 'Documento emitido'),
      contenido: String(i.contenido ?? i.content ?? ''),
      version: Number(i.version ?? 1),
      emitido_en: i.emitido_en ?? i.issuedAt ?? null,
    }));
    return { ...res, data: normalized };
  },
  async staffAttentions() {
    const res = await request<any>('/staff/attentions', {}, 'staff');
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const normalized: StaffAttentionItem[] = rawList.map((a: any) => ({
      id_atencion: Number(a.id_atencion ?? a.attentionId),
      id_tratamiento: a.id_tratamiento ?? a.treatmentId ?? null,
      id_persona: Number(a.id_persona ?? a.patientId ?? 0),
      paciente: String(a.paciente ?? a.patientName ?? 'Paciente'),
      fecha_hora: String(a.fecha_hora ?? a.date ?? ''),
      estado: String(a.estado ?? a.serviceStatus ?? a.asistencia ?? 'Programado'),
      servicio: String(a.servicio ?? a.serviceName ?? 'Consulta Odontológica'),
      profesional: String(a.profesional ?? a.professionalName ?? ''),
      sede: String(a.sede ?? a.branchName ?? 'Sede Principal'),
      validaciones_count: Number(a.validaciones_count ?? 0),
      indicaciones_count: Number(a.indicaciones_count ?? 0),
    }));
    return { ...res, data: normalized };
  },
  async availableSlots(sedeId?: number, profesionalId?: number) {
    const params = new URLSearchParams();
    if (sedeId) params.append('idSede', String(sedeId));
    if (profesionalId) params.append('idProfesional', String(profesionalId));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<any>(`/availability/slots${qs}`, {}, 'staff');
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    const normalized: AvailableSlotItem[] = rawList.map((s: any) => ({
      id_disponibilidad: Number(s.id_disponibilidad ?? s.slotId),
      id_sede: Number(s.id_sede ?? s.branchId ?? 1),
      sede: String(s.sede ?? s.branchName ?? 'Sede Principal'),
      id_profesional: Number(s.id_profesional ?? s.professionalId ?? 0),
      profesional: String(s.profesional ?? s.professionalName ?? 'Profesional'),
      fecha: String(s.fecha ?? s.date ?? ''),
      hora_inicio: String(s.hora_inicio ?? s.startTime ?? ''),
      hora_fin: String(s.hora_fin ?? s.endTime ?? ''),
    }));
    return { ...res, data: normalized };
  },
  treatmentSessions: (id: number) => request<ToolResponse<SessionPage>>(`/treatments/${id}/sessions?page=1&pageSize=100`, {}, 'patient'),
  treatmentProgress: (id: number) => request<ToolResponse<TreatmentProgress>>(`/treatments/${id}/progress`, {}, 'patient'),
  rescheduleRequests: (audience: 'patient' | 'staff') => request<ToolResponse<RescheduleRequest[]>>('/reschedule-requests', {}, audience),
  prepareReschedule: (body: { sessionId: number; preferredDate?: string; preferredSlot?: string; reason?: string; idempotencyKey: string }) => post('/actions/prepare', { action: 'REQUEST_RESCHEDULE', ...body }, 'patient'),
  confirmReschedule: (confirmationToken: string) => post('/actions/confirm', { confirmationToken }, 'patient'),
  reviewReschedule: (id: number, status: string, reason: string) => post(`/reschedule-requests/${id}/review`, { status, reason }),
  applyReschedule: (id: number, availabilityId: number, reason: string) => post(`/reschedule-requests/${id}/apply`, { availabilityId, reason }),
  alerts: () => request<ToolResponse<AgentAlert[]>>('/alerts'),
  reviewAlert: (id: number, status: string, result: string) => post(`/alerts/${id}/review`, { status, result }),
  chat: (message: string, audience: 'patient' | 'staff' = 'patient', context?:{treatmentId?:number;attentionId?:number}) => post<ChatAnswer>('/chat', { message, ...context }, audience),
  clinicalContext: (attentionId: number) => request<ToolResponse<ClinicalContext>>(`/clinical/${attentionId}/context`),
  documentationStatus: (attentionId: number) => request<ToolResponse<DocumentationStatus>>(`/attentions/${attentionId}/documentation-status`),
  detectAlerts: (attentionId: number) => post('/alerts/detect', { attentionId }),
  prepareDraft: (attentionId: number, idempotencyKey: string) => post('/document-drafts', { attentionId, idempotencyKey }),
  knowledgeDocuments: () => request<ToolResponse<KnowledgeDocumentItem[]>>('/knowledge/documents'),
  getKnowledgeDocument: (code: string) => request<ToolResponse<StoredDocumentDetail>>(`/knowledge/documents/${encodeURIComponent(code)}`),
  registerKnowledgeDocument: (body: { code: string; title: string; category: string }) => post('/knowledge/documents', body),
  submitKnowledgeVersion: (code: string, body: { version: number; format?: string; base64Buffer?: string; textContent?: string; allowedRoles?: string[]; declaredNoPersonalData: boolean; validFrom?: string }) => post(`/knowledge/documents/${encodeURIComponent(code)}/versions`, body),
  approveKnowledgeVersion: (code: string, version: number) => post(`/knowledge/documents/${encodeURIComponent(code)}/versions/${version}/approve`),
  publishKnowledgeVersion: (code: string, version: number) => post(`/knowledge/documents/${encodeURIComponent(code)}/versions/${version}/publish`),
  revokeKnowledgeVersion: (code: string, version: number, reason: string) => post(`/knowledge/documents/${encodeURIComponent(code)}/versions/${version}/revoke`, { reason }),
  deleteKnowledgeDocument: (code: string) => request(`/knowledge/documents/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  async downloadKnowledgeDocx(code: string, version?: number): Promise<void> {
    const token = staffAuthService.getAccessToken();
    const url = `${BASE}/knowledge/documents/${encodeURIComponent(code)}/download${version ? `?version=${version}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No fue posible descargar el documento DOCX.');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${code}_v${version || 1}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
  attentionDrafts: (attentionId: number) => request<ToolResponse<Array<{ draftId: number; rootId: number; version: number; status: string; createdAt: string; isIssued: boolean }>>>(`/attentions/${attentionId}/document-drafts`),
  async getDraft(id: number) {
    const result = await request<ToolResponse<Record<string, unknown>>>(`/document-drafts/${id}`);
    const row = result.data;
    return {
      ...result,
      data: {
        draftId: Number(row.draftId ?? row.id_borrador_ia),
        rootId: Number(row.rootId ?? row.id_borrador_raiz ?? row.draftId ?? row.id_borrador_ia),
        version: Number(row.version ?? row.version_borrador),
        status: String(row.status ?? row.estado ?? ''),
        requiresHumanReview: row.requiresHumanReview !== false,
        content: String(row.content ?? row.contenido_sugerido ?? ''),
        isIssued: Boolean(row.isIssued),
        idempotent: false,
      } satisfies DocumentDraft,
    };
  },
  reviseDraft: (id: number, content: string) => post(`/document-drafts/${id}/revisions`, { content }),
  approveDraft: (id: number, corrected = false) => post(`/document-drafts/${id}/approve`, { corrected }),
  issueDraft: (id: number) => post(`/document-drafts/${id}/issue`),
  rejectDraft: (id: number, reason: string) => post(`/document-drafts/${id}/reject`, { reason }),
};

export interface PatientAttentionItem {
  id_atencion: number;
  id_tratamiento: number | null;
  fecha_hora: string;
  estado: string;
  servicio: string;
  profesional: string;
  sede: string;
  indicaciones_aprobadas_count: number;
}

export interface StaffAttentionItem {
  id_atencion: number;
  id_tratamiento: number | null;
  id_persona: number;
  paciente: string;
  fecha_hora: string;
  estado: string;
  servicio: string;
  profesional: string;
  sede: string;
  validaciones_count: number;
  indicaciones_count: number;
}

export interface AvailableSlotItem {
  id_disponibilidad: number;
  id_sede: number;
  sede: string;
  id_profesional: number;
  profesional: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

export interface PostCareInstructionItem {
  id_indicacion: number;
  id_atencion: number;
  estado: string;
  contenido: string;
  version: number;
  emitido_en: string | null;
}

export interface PatientTreatment {
  treatmentId: number; serviceName: string; status: string; realStartDate: string | null;
  responsibleProfessional: string | null; nextSessionDate: string | null; plannedSessions: number; completedSessions: number;
}
export interface UpcomingSession { treatmentId: number; serviceName: string; date: string; professional: string; branch: string; status: string; }
export interface TreatmentSession { sessionId: number; number: number; date: string; schedulingStatus: string; careStatus: string; closureStatus: string; professional: string; branch: string; }
export interface SessionPage { items: TreatmentSession[]; page: number; pageSize: number; total: number; }
export interface TreatmentProgress { plannedSessions: number | null; completedSessions: number; pendingSessions: number | null; noShows: number; lastAttention: string | null; currentStatus: string; operationalProgressPercent: number | null; progressMeaning: string; }
export interface RescheduleRequest {
  requestId: number;
  sessionId: number;
  sessionNumber?: number;
  treatmentId: number;
  serviceName?: string;
  patientId?: number;
  patientName?: string;
  patientDni?: string;
  professionalId?: number;
  professionalName?: string;
  branchId?: number;
  branchName?: string;
  originalDate: string;
  preferredDate: string | null;
  preferredSlot: string | null;
  reason?: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  resolutionReason: string | null;
}
export interface AgentAlert { alertId: number; type: string; message: string; severity: string; status: string; patientId: number; treatmentId: number | null; sessionId: number | null; attentionId: number | null; createdAt: string; }
export interface ChatAnswer { message: string; toolsUsed: string[]; limitations: string[]; correlationId: string; }
export interface ClosureChecklist { treatmentId: number; formalTreatmentStatus: string; plannedSessions: number | null; completedSessions: number; pending: string[]; readOnly: boolean; requiresProfessionalConfirmation: boolean; disclaimer: string; }

export interface ClinicalContext { closureChecklist?: ClosureChecklist | null; currentTreatment: unknown; currentAttention: Record<string, unknown>; relevantBackground: Array<Record<string, unknown>>; previousAttentions: Array<Record<string, unknown>>; clinicalDisclaimer: string; currentPlan?:{planId:number;version:number;plannedSessions:number}|null; currentSession?:{sessionId:number;number:number;date:string;careStatus:string;closureStatus:string}|null; registeredProcedures?:Array<{id_detalle_procedimiento:number;procedimiento_realizado:string}>; relatedAlerts?:Array<{id_alerta_ia:number;tipo_evento:string;mensaje_alerta:string;estado:string}>; provenance?:{attentionId:number;clinicalRevision:number;source:string;retrievedAt:string}; }
export interface DocumentationStatus { attentionId: number; hasClinicalFile: boolean; firstValidation: unknown; lastValidation: { result: string; date: string; pendingFields: string | null } | null; closureStatus: string | null; pendingInstructions: Array<{ id_indicacion: number; estado: string }>; }
export interface KnowledgeDocumentItem {
  code: string;
  title: string;
  category: string;
  latestVersion: number;
  status: string;
  format: string;
}

export interface DocumentDraft { draftId: number; rootId: number; version: number; status: string; requiresHumanReview: boolean; content: string; idempotent: boolean; reason?: string | null; isIssued?: boolean; indicationId?: number | null; }

export interface StoredDocumentVersion {
  version: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'REVOKED';
  content: string;
  format: 'MD' | 'TXT' | 'DOCX' | 'PDF';
  contentHash: string;
  allowedRoles: string[];
  validFrom: string;
  validUntil?: string;
  createdById: number;
  reviewedById?: number;
  approvedById?: number;
  approvedAt?: string;
  publishedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
}

export interface StoredDocumentDetail {
  code: string;
  title: string;
  category: string;
  active: boolean;
  createdAt: string;
  versions: StoredDocumentVersion[];
}
