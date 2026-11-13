import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CustomerPatientPortalPage from './CustomerPatientPortalPage';
const { api } = vi.hoisted(() => ({ api: {
  patientTreatments: vi.fn(), patientUpcoming: vi.fn(), rescheduleRequests: vi.fn(), patientAttentions: vi.fn(), treatmentSessions: vi.fn(), treatmentProgress: vi.fn(), chat: vi.fn(), prepareReschedule: vi.fn(), confirmReschedule: vi.fn()
} }));
vi.mock('../components/CustomerCompletionPanel', () => ({ default: () => null }));
vi.mock('../services/customerAiAgentApi', () => ({ customerAiAgentApi: api }));
vi.mock('@/shared/services/patientAuthService', () => ({ patientAuthApi: { getSession: () => ({ id_persona: 10, nombres: 'Paciente', apellidos: 'Simulada', dni: '99000000' }), getAccessToken: () => 'test-token' } }));
vi.mock('@/shared/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); sessionStorage.setItem('nexosalud_patient_portal_tab', 'assistant');
  api.patientTreatments.mockResolvedValue({ data: [{ treatmentId: 30, serviceName: 'Restauración', status: 'Activado' }] });
  api.patientUpcoming.mockResolvedValue({ data: [] }); api.rescheduleRequests.mockResolvedValue({ data: [] }); api.patientAttentions.mockResolvedValue({ data: [] });
  api.treatmentSessions.mockResolvedValue({ data: { items: [{ sessionId: 42, number: 2, date: '2099-11-18T20:00:00Z', careStatus: 'Pendiente', schedulingStatus: 'Programada', professional: 'A B' }] } });
  api.treatmentProgress.mockResolvedValue({ data: null });
  api.chat.mockResolvedValue({ message: 'Revisa las alternativas.', limitations: [], rescheduleDraft: { sessionId: 42, sessionNumber: 2, treatmentId: 30, originalDate: '2099-11-18T20:00:00Z', preferredDate: null, preferredSlot: null, reason: 'Conflicto de agenda', alternatives: [{date:'2099-11-20T20:00:00Z',professionalName:'A B',branchName:'Centro'}] } });
});
afterEach(cleanup);
it('lleva el borrador al formulario y permite elegir sin registrar ni confirmar automáticamente', async () => {
  render(<CustomerPatientPortalPage />);
  await waitFor(() => expect(api.treatmentSessions).toHaveBeenCalledWith(30));
  const question = await screen.findByLabelText('Tu consulta');
  fireEvent.change(question, { target: { value: 'Reprogramar segunda sesión' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar propuesta en Reprogramar' }));
  const session = await screen.findByLabelText('Sesión que quieres mover');
  expect(session).toHaveValue('42');
  expect(screen.getByLabelText('Fecha preferida')).toHaveValue('');
  expect(screen.getByLabelText('Motivo del cambio')).toHaveValue('Conflicto de agenda');
  fireEvent.click(screen.getByRole('button', { name: /A B · Centro/ }));
  expect(screen.getByLabelText('Fecha preferida')).toHaveValue('2099-11-20');
  expect(screen.getByLabelText('Franja horaria')).toHaveValue('15:00');
  expect(api.prepareReschedule).not.toHaveBeenCalled();
  expect(api.confirmReschedule).not.toHaveBeenCalled();
});
