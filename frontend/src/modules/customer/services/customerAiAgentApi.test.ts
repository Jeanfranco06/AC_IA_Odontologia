import { afterEach, describe, expect, it, vi } from 'vitest';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { customerAiAgentApi } from './customerAiAgentApi';

const session: StaffSession = {
  id_usuario: 8,
  nombres: 'Odontóloga',
  apellidos: 'Autorizada',
  email: 'odontologa@example.test',
  rol: 'ODONTOLOGO',
  agentRole: 'ODONTOLOGO',
  accessToken: 'signed-test-token',
  idProfesional: 14,
  initials: 'OA',
  loginAt: new Date(0).toISOString(),
};

afterEach(() => {
  staffAuthService.logout();
  vi.unstubAllGlobals();
});

describe('customerAiAgentApi', () => {
  it('envía Bearer token institucional en las consultas al copiloto', async () => {
    staffAuthService.saveSession(session);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [], meta: { source: 'NexoSaludDB', correlationId: 'test' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await customerAiAgentApi.alerts();

    expect(result.data).toEqual([]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer signed-test-token' });
  });

  it('no hace peticiones si no hay sesión/token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(customerAiAgentApi.alerts()).rejects.toThrow('Tu sesión no está disponible');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expone el mensaje controlado del backend para conflictos y permisos', async () => {
    staffAuthService.saveSession(session);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Atención fuera del ámbito.' } }), { status: 403 })));

    await expect(customerAiAgentApi.alerts()).rejects.toThrow('Atención fuera del ámbito.');
  });
});
