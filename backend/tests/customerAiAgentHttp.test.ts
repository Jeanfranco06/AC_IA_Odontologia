import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

describe('Customer AI Agent HTTP boundary', () => {
  it('rejects an unauthenticated patient request before touching the database', async () => {
    const response = await request(app).get('/api/customer/ai-agent/me/treatments');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects malformed staff credentials with a controlled error', async () => {
    const response = await request(app).post('/api/staff-auth/login').send({ email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });

  it('does not accept a patient token for clinical context', async () => {
    process.env.AI_AGENT_SESSION_SECRET = 'http-test-secret';
    const { issueAiAgentToken } = await import('../src/modules/customer/ai-agent/authContext');
    const token = issueAiAgentToken({ role: 'PACIENTE', idPersona: 1 });
    const response = await request(app).get('/api/customer/ai-agent/clinical/1/context').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    delete process.env.AI_AGENT_SESSION_SECRET;
  });
});
