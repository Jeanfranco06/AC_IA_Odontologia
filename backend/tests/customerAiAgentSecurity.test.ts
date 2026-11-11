import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { issueAiAgentToken, verifyAiAgentToken } from '../src/modules/customer/ai-agent/authContext';
import { AiAgentError } from '../src/modules/customer/ai-agent/types';
import { pagination, positiveId } from '../src/modules/customer/ai-agent/validators';

describe('Customer AI Agent security contracts', () => {
  beforeEach(() => { process.env.AI_AGENT_SESSION_SECRET = 'test-secret-with-sufficient-entropy'; });
  afterEach(() => { delete process.env.AI_AGENT_SESSION_SECRET; });

  it('issues and verifies a patient token without trusting a URL patient id', () => {
    const token = issueAiAgentToken({ role: 'PACIENTE', idPersona: 123 });
    expect(verifyAiAgentToken(token)).toEqual({ role: 'PACIENTE', idPersona: 123, exp: expect.any(Number) });
  });

  it('rejects tampered tokens', () => {
    const token = issueAiAgentToken({ role: 'PACIENTE', idPersona: 123 });
    expect(() => verifyAiAgentToken(`${token}tampered`)).toThrow(AiAgentError);
  });

  it('validates ids and bounded pagination', () => {
    expect(positiveId('5', 'treatmentId')).toBe(5);
    expect(pagination({ page: '2', pageSize: '20' })).toEqual({ page: 2, pageSize: 20 });
    expect(() => positiveId('0', 'treatmentId')).toThrow(AiAgentError);
    expect(() => pagination({ pageSize: '101' })).toThrow(AiAgentError);
  });
});
