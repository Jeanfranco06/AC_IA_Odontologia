import { afterEach, describe, expect, it, vi } from 'vitest';
import { appointmentMidnightInLima, calculatePayerRisk, type PayerContext } from './groqService';

const pendingPayer: PayerContext = {
  patientName: 'Paciente de prueba',
  state: 'PENDING',
  amountToPay: 212.5,
  reservationDate: '2026-09-30',
  reservationTime: '14:00',
  hasReceipt: false,
  incidentsCount: 0,
};

afterEach(() => vi.useRealTimers());

describe('plazo de la cita en Perú', () => {
  it('usa la medianoche de Lima para una fecha sin hora', () => {
    expect(appointmentMidnightInLima('2026-09-30')?.toISOString()).toBe('2026-09-30T05:00:00.000Z');
    expect(appointmentMidnightInLima('2026-02-30')).toBeNull();
  });

  it('mantiene activa la cita del 30 de setiembre durante el día 29', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T15:00:00.000Z')); // 10:00 en Lima
    expect(calculatePayerRisk(pendingPayer).score).toBeGreaterThan(0);
  });

  it('la considera vencida recién a las 00:00 del día de la cita en Lima', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T05:00:00.000Z'));
    expect(calculatePayerRisk(pendingPayer).score).toBe(0);
  });
});
