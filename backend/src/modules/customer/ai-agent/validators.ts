import { AiAgentError, SessionQuery } from './types';

export function positiveId(value: unknown, field: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AiAgentError('INVALID_INPUT', `${field} debe ser un entero positivo.`);
  return id;
}

export function pagination(query: Record<string, unknown>): SessionQuery {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 50 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new AiAgentError('INVALID_INPUT', 'La paginación no es válida.');
  return { page, pageSize };
}
