import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { CustomerAiActionService } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { AiAgentError, AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';

describe('Customer AI supervised actions', () => {
  const patient: AiAgentPrincipal = { role: 'PACIENTE', idPersona: 315 };
  const dentist: AiAgentPrincipal = { role: 'ODONTOLOGO', idPersona: 315, idUsuario: 1, idProfesional: 2 };

  beforeEach(() => { process.env.AI_AGENT_SESSION_SECRET = 'test-secret-with-sufficient-entropy'; });
  afterEach(() => { delete process.env.AI_AGENT_SESSION_SECRET; });

  it('does not allow a patient to create a clinical document draft', async () => {
    await expect(CustomerAiActionService.prepareDocumentationDraft(patient, 220)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not allow a dentist to read the institutional reschedule queue', async () => {
    await expect(CustomerAiActionService.getRescheduleRequests(dentist)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects malformed confirmation and review inputs before any mutation', async () => {
    await expect(CustomerAiActionService.confirmRescheduleRequest(patient, 'invalid')).rejects.toBeInstanceOf(AiAgentError);
    await expect(CustomerAiActionService.prepareRescheduleRequest(patient, { sessionId: 1, preferredDate: 'not-a-date' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(CustomerAiActionService.reviewRescheduleRequest({ role: 'RECEPCION', idUsuario: 1 }, 1, 'Aplicada')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('requires evidence and a supported state when reviewing alerts', async () => {
    await expect(CustomerAiActionService.reviewAlert({ role: 'RECEPCION', idUsuario: 1 }, 1, 'Atendida', '')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(CustomerAiActionService.reviewAlert({ role: 'RECEPCION', idUsuario: 1 }, 1, 'Aplicada', 'done')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
