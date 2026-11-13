export type AiAgentRole = 'PACIENTE' | 'ODONTOLOGO' | 'RECEPCION' | 'ADMIN';

export interface AiAgentPrincipal {
  role: AiAgentRole;
  idPersona?: number;
  idUsuario?: number;
  idProfesional?: number;
}

export interface ToolMeta { source: 'NexoSaludDB'; correlationId: string; availabilityReason?: 'ATTENTION_NOT_CLOSED' | 'NO_CLOSED_ATTENTION' | 'NO_ISSUED_INSTRUCTIONS'; }
export interface ToolResponse<T> { success: true; data: T; meta: ToolMeta; }

export class AiAgentError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'CONFLICT' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR', message: string, public readonly status = code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'INVALID_INPUT' ? 400 : code === 'CONFLICT' ? 409 : code === 'SERVICE_UNAVAILABLE' ? 503 : 500) { super(message); }
}

export interface SessionQuery { page?: number; pageSize?: number; from?: Date; to?: Date; }
