import { describe, expect, it, vi } from 'vitest';
import type jsPDF from 'jspdf';
import { createPaymentDocumentPdf, formatAppointmentTime } from './paymentDocument';
import logoDataUrl from './Logo_NexoSalud.png?inline';

// Capture the text drawn into real PDFs: embedded fonts encode glyphs in the stream.
vi.mock('jspdf', async (importOriginal) => {
  const { default: ActualPdf } = await importOriginal<typeof import('jspdf')>();
  return {
    default: class extends ActualPdf {
      constructor(options: import('jspdf').jsPDFOptions) {
        super(options);
        this.text = vi.fn(this.text);
      }
    },
  };
});

const drawnText = (pdf: jsPDF) => vi.mocked(pdf.text).mock.calls
  .map(([value]) => Array.isArray(value) ? value.join(' ') : value).join('\n');

describe('documentos de pago', () => {
  it('muestra la hora de la cita en formato de 12 horas', () => {
    expect(formatAppointmentTime('14:00')).toBe('2:00 p. m.');
    expect(formatAppointmentTime('00:15')).toBe('12:15 a. m.');
    expect(formatAppointmentTime('12:30')).toBe('12:30 p. m.');
  });

  it.each(['ORDER', 'RECEIPT'] as const)('incluye el descuento real en %s', (type) => {
    const pdf = createPaymentDocumentPdf({
      type, code: 'PR-123', patientName: 'Paciente de prueba', serviceName: 'Consulta',
      appointmentTime: '14:00', amount: 212.5, originalPrice: 250.75,
    }, logoDataUrl);
    const output = drawnText(pdf);
    expect(output).toContain('Descuento aplicado');
    expect(output).toContain('38.25');
    expect(output).toContain('2:00 p. m.');
  });

  it('omite el descuento cuando no hay precio regular mayor', () => {
    const pdf = createPaymentDocumentPdf({
      type: 'ORDER', code: 'PR-124', patientName: 'Paciente de prueba',
      serviceName: 'Consulta', amount: 212.5, originalPrice: 212.5,
    }, logoDataUrl);
    expect(drawnText(pdf)).not.toContain('Descuento aplicado');
  });

  it('ofrece los métodos disponibles en la orden y solo el usado en la constancia', () => {
    const base = {
      code: 'PR-124', patientName: 'Paciente de prueba', serviceName: 'Consulta',
      amount: 212.5, paymentChannel: 'Yape', operationNumber: 'OP-123456',
    };
    const order = drawnText(createPaymentDocumentPdf({ ...base, type: 'ORDER' }, logoDataUrl));
    const receipt = drawnText(createPaymentDocumentPdf({ ...base, type: 'RECEIPT' }, logoDataUrl));
    expect(order).toContain('MÉTODOS DE PAGO DISPONIBLES');
    for (const method of ['Yape / Plin', 'Tarjeta', 'Transferencia', 'Efectivo']) {
      expect(order).toContain(method);
    }
    expect(receipt).toContain('MÉTODO UTILIZADO');
    expect(receipt).toContain('Yape');
    expect(receipt).toContain('OP-123456');
    expect(receipt).not.toContain('MÉTODOS DE PAGO DISPONIBLES');
    expect(receipt).not.toContain('Transferencia');
    expect(receipt).not.toContain('Efectivo');
  });
});
