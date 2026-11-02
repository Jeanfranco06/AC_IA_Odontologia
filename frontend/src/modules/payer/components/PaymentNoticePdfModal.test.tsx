import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PayerState } from '@/domain/enums';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { PaymentNoticePdfModal } from './PaymentNoticePdfModal';

const payer = (state: typeof PayerState[keyof typeof PayerState]): PayerWithDetails => ({
  id: '12',
  state,
  amountToPay: 212.5,
  person: {
    firstName: 'Alexis',
    lastName: 'Vigo',
    email: 'alexis@example.com',
    phone: '970292710',
    documentNumber: '12345678',
  },
  reservation: { date: '2026-09-30', time: '14:00', branchId: 'Sede California' },
}) as PayerWithDetails;

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-pdf') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('documentos PDF de PAYER', () => {
  it('muestra solo la orden mientras el pago está pendiente', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PaymentNoticePdfModal payer={payer(PayerState.PENDING)} isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Enviar Orden de Pago' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Constancia de Pago' })).not.toBeInTheDocument();
    expect(screen.getByTitle(`Visor de PDF - ORD-00012-${new Date().getFullYear()}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Orden de Pago' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.isValidated).toBe(false);
    expect(payload.filename).toMatch(/^Orden_de_Pago_/);
  });

  it('abre la constancia tras validar y permite consultar la orden anterior', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    render(<PaymentNoticePdfModal payer={payer(PayerState.VALIDATED)} isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Enviar Constancia' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Constancia de Pago' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Constancia' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.isValidated).toBe(true);
    expect(payload.filename).toMatch(/^Constancia_Pago_/);

    fireEvent.click(screen.getByRole('tab', { name: 'Orden de Pago' }));
    expect(screen.getByRole('tab', { name: 'Orden de Pago' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Enviar Orden de Pago' })).not.toBeInTheDocument();
  });

  it('permite consultar una orden vencida sin ofrecer su envío', async () => {
    render(<PaymentNoticePdfModal payer={payer(PayerState.REJECTED)} isOpen onClose={vi.fn()} />);

    expect(await screen.findByTitle(`Visor de PDF - ORD-00012-${new Date().getFullYear()}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar Orden de Pago' })).not.toBeInTheDocument();
  });
});
