import { AiAgentRole } from '../types';

export interface LlmToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export type LlmInputItem = Record<string, unknown>;

export interface LlmRequest {
  instructions: string;
  input: LlmInputItem[];
  tools: LlmToolDefinition[];
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal: AbortSignal;
}

export type LlmResult =
  | { kind: 'message'; text: string }
  | { kind: 'tool_call'; callId: string; name: string; arguments: string };

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResult>;
}

export interface LlmRuntimeConfig {
  enabled: boolean;
  provider: string;
  model: string;
  maxIterations: number;
  maxToolCalls: number;
  maxInputChars: number;
  maxOutputChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxConcurrency: number;
  externalDataAuthorized: boolean;
}

export const roleName = (role: AiAgentRole) => role === 'PACIENTE' ? 'paciente' : role === 'ODONTOLOGO' ? 'odontólogo autorizado' : role === 'RECEPCION' ? 'personal de recepción autorizado' : 'administrador autorizado';

export function runtimeConfig(env = process.env): LlmRuntimeConfig {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key]);
    return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : fallback;
  };
  return {
    enabled: env.AI_AGENT_LLM_ENABLED === 'true',
    provider: env.AI_AGENT_LLM_PROVIDER || 'gemini',
    model: env.AI_AGENT_LLM_MODEL || 'gemini-2.5-flash',
    maxIterations: integer('AI_AGENT_MAX_ITERATIONS', 4, 1, 8),
    maxToolCalls: integer('AI_AGENT_MAX_TOOL_CALLS', 4, 1, 12),
    maxInputChars: integer('AI_AGENT_MAX_INPUT_CHARS', 2000, 100, 8000),
    maxOutputChars: integer('AI_AGENT_MAX_OUTPUT_CHARS', 4000, 200, 12000),
    maxOutputTokens: integer('AI_AGENT_MAX_OUTPUT_TOKENS', 1024, 64, 4096),
    timeoutMs: integer('AI_AGENT_TIMEOUT_MS', 15000, 1000, 60000),
    maxConcurrency: integer('AI_AGENT_MAX_CONCURRENCY', 8, 1, 32),
    externalDataAuthorized: env.AI_AGENT_EXTERNAL_DATA_AUTHORIZED === 'true',
  };
}
