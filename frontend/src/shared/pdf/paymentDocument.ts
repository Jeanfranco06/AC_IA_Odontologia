import jsPDF from 'jspdf';
import { regularFont, boldFont } from './paymentFonts';

export interface PaymentDocumentData {
  type: 'ORDER' | 'RECEIPT';
  code: string;
  issuedAt?: string | Date;
  patientName: string;
  documentNumber?: string;
  phone?: string;
  email?: string;
  branch?: string;
  professional?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  serviceName: string;
  amount: number;
  originalPrice?: number;
  discountPercent?: number;
  paymentChannel?: string;
  operationNumber?: string;
  familyPatient?: string;
}

type Color = [number, number, number];
const NAVY: Color = [7, 39, 70];
const BLUE: Color = [0, 105, 161];
const CYAN: Color = [0, 177, 213];
const INK: Color = [36, 46, 56];
const MUTED: Color = [100, 116, 130];
const RULE: Color = [167, 185, 201];
const PALE: Color = [245, 248, 251];
const WHITE: Color = [255, 255, 255];

function dateLabel(value?: string | Date): string {
  if (!value) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
}

export function formatAppointmentTime(value?: string): string {
  if (!value?.trim()) return 'Por coordinar';
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?(?:\s*-\s*(\d{1,2}):([0-5]\d)(?::[0-5]\d)?)?$/);
  if (!match) return value;
  const convert = (hours: string, minutes: string) => {
    const hour = Number(hours);
    if (hour > 23) return `${hours}:${minutes}`;
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'p. m.' : 'a. m.'}`;
  };
  const start = convert(match[1], match[2]);
  return match[3] ? `${start} - ${convert(match[3], match[4])}` : start;
}

export function createPaymentDocumentPdf(data: PaymentDocumentData, logoDataUrl: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const paid = data.type === 'RECEIPT';
  doc.addFileToVFS('OpenSans-Regular.ttf', regularFont);
  doc.addFileToVFS('OpenSans-Bold.ttf', boldFont);
  doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
  doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
  doc.setProperties({
    title: `${paid ? 'Constancia de pago' : 'Orden de pago'} - ${data.code}`,
    subject: 'NexoSalud - Documento de reserva y pago',
    author: 'NexoSalud',
  });

  const safe = (value?: string) => value?.trim() || 'No registrado';
  const font = (size: number, bold = false, color: Color = INK) => {
    doc.setFont('OpenSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const text = (value: string, x: number, y: number, size = 9, bold = false, color: Color = INK) => {
    font(size, bold, color);
    doc.text(value, x, y);
  };
  const right = (value: string, x: number, y: number, size = 9, bold = false, color: Color = INK) => {
    font(size, bold, color);
    doc.text(value, x, y, { align: 'right' });
  };
  const center = (value: string, x: number, y: number, size = 9, bold = false, color: Color = INK) => {
    font(size, bold, color);
    doc.text(value, x, y, { align: 'center' });
  };
  const box = (x: number, y: number, width: number, height: number, fill?: Color) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.23);
    if (fill) doc.setFillColor(...fill);
    doc.rect(x, y, width, height, fill ? 'FD' : 'S');
  };
  const polygon = (points: Array<[number, number]>, color: Color) => {
    doc.setFillColor(...color);
    doc.lines(points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]), points[0][0], points[0][1], [1, 1], 'F', true);
  };
  const section = (title: string, y: number) => {
    text(title, 18, y, 8.7, true, NAVY);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.23);
    doc.line(18, y + 2.4, 192, y + 2.4);
  };
  const field = (title: string, value: string, y: number) => {
    text(title, 18, y + 5.2, 8.5, true, NAVY);
    box(62, y, 130, 7.2);
    let size = 9.1;
    font(size);
    while (doc.getTextWidth(value) > 123 && size > 7) {
      size -= 0.2;
      font(size);
    }
    const lines = doc.splitTextToSize(value, 123) as string[];
    doc.text(lines, 65, y + (lines.length > 1 ? 2.8 : 5.1), { lineHeightFactor: 1.05 });
  };

  // Geometría inspirada en la referencia, con la identidad original de NexoSalud.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 14, 'F');
  polygon([[116, 14], [142, 14], [126, 39]], BLUE);
  polygon([[146, 0], [210, 0], [210, 39], [126, 39]], CYAN);
  center(paid ? 'CONSTANCIA' : 'ORDEN', 171, 20, paid ? 16.5 : 19, true, NAVY);
  center('DE PAGO', 171, 29, 17, true, NAVY);

  doc.addImage(logoDataUrl, 'PNG', 18, 23, 36, 20.3, undefined, 'FAST');
  text('ODONTOLOGÍA', 62, 29.8, 10, true, NAVY);
  text('ESPECIALIZADA', 62, 36, 10, true, NAVY);
  text('RUC 20608945123  |  Perú', 62, 43, 7.8, false, MUTED);
  right(paid ? 'PAGO VALIDADO' : 'PRE-RESERVA / PAGO PENDIENTE', 192, 47, 7.2, true, NAVY);

  box(18, 54, 174, 16, PALE);
  text(paid ? 'NÚMERO DE CONSTANCIA' : 'REFERENCIA DE RESERVA', 22, 59.8, 7, true, MUTED);
  text(data.code, 22, 66, 10.5, true, NAVY);
  text('FECHA DE EMISIÓN', 136, 59.8, 7, true, MUTED);
  text(dateLabel(data.issuedAt), 136, 66, 9.4, false, NAVY);

  section('DATOS DEL PACIENTE', 77);
  field('Nombre completo', data.patientName, 82);
  field('Documento', safe(data.documentNumber), 90.2);
  field('Teléfono', safe(data.phone), 98.4);
  field('Correo electrónico', safe(data.email), 106.6);
  field('Atención para', data.familyPatient || 'Titular de la reserva', 114.8);

  section('DETALLE DE LA CITA', 132);
  field('Sede', safe(data.branch), 137);
  field('Especialista', safe(data.professional), 145.2);
  field('Fecha de la cita', data.appointmentDate ? dateLabel(data.appointmentDate) : 'Por coordinar', 153.4);
  field('Hora de atención', formatAppointmentTime(data.appointmentTime), 161.6);

  const hasDiscount = Number.isFinite(data.originalPrice) && (data.originalPrice ?? 0) > data.amount + 0.005;
  const regularPrice = hasDiscount ? data.originalPrice! : data.amount;
  doc.setFillColor(...NAVY);
  doc.rect(18, 179, 174, 10, 'F');
  text('SERVICIO / CONCEPTO', 22, 185.7, 8.6, true, WHITE);
  right('IMPORTE', 188, 185.7, 8.6, true, WHITE);
  box(18, 189, 174, 17);
  font(9.1);
  const serviceLines = doc.splitTextToSize(data.serviceName, 131) as string[];
  doc.text(serviceLines, 22, serviceLines.length > 1 ? 195.5 : 199, { lineHeightFactor: 1.2 });
  right(`S/ ${regularPrice.toFixed(2)}`, 188, 199, 9.4);

  text(paid ? 'Pago verificado' : 'Confirmación de la reserva', 18, 217, 8.7, true, NAVY);
  font(8, false, MUTED);
  doc.text(doc.splitTextToSize(paid
    ? 'El abono fue validado y su cita se encuentra confirmada.'
    : 'La cita se confirma una vez que el pago haya sido validado.', 88), 18, 223, { lineHeightFactor: 1.4 });
  text('Importes expresados en soles (PEN).', 18, 237, 7.1, false, MUTED);

  text('Subtotal', 123, 214, 8.6);
  right(`S/ ${regularPrice.toFixed(2)}`, 188, 214, 8.6);
  if (hasDiscount) {
    text('Descuento aplicado', 123, 222, 8.3, false, BLUE);
    right(`- S/ ${(regularPrice - data.amount).toFixed(2)}`, 188, 222, 8.6, true, BLUE);
  }
  doc.setFillColor(...NAVY);
  doc.rect(119, 227, 73, 12, 'F');
  text(paid ? 'TOTAL PAGADO' : 'TOTAL A PAGAR', 123, 234.6, 8.1, true, WHITE);
  right(`S/ ${data.amount.toFixed(2)}`, 188, 235, 12.5, true, WHITE);

  doc.setFillColor(...NAVY);
  doc.rect(18, 246, 174, 8, 'F');
  text(paid ? 'INFORMACIÓN DEL PAGO REALIZADO' : 'MÉTODOS DE PAGO DISPONIBLES', 22, 251.4, 8, true, WHITE);
  box(18, 254, 174, 20);
  if (paid) {
    text('MÉTODO UTILIZADO', 22, 260, 6.9, true, MUTED);
    text('NÚMERO DE OPERACIÓN', 109, 260, 6.9, true, MUTED);
    font(8.5, true, NAVY);
    doc.text(doc.splitTextToSize(safe(data.paymentChannel), 78), 22, 266, { lineHeightFactor: 1.15 });
    font(8.5, false, NAVY);
    doc.text(doc.splitTextToSize(safe(data.operationNumber), 78), 109, 266, { lineHeightFactor: 1.15 });
    doc.setDrawColor(...RULE);
    doc.line(105, 254, 105, 274);
  } else {
    const methods = [
      ['Yape / Plin', 'Billeteras digitales'],
      ['Tarjeta', 'Crédito / débito'],
      ['Transferencia', 'Transferencia bancaria'],
      ['Efectivo', 'Pago en clínica'],
    ];
    methods.forEach(([name, description], index) => {
      const x = 18 + index * 43.5;
      if (index > 0) {
        doc.setDrawColor(...RULE);
        doc.line(x, 254, x, 274);
      }
      center(name, x + 21.75, 262.7, 8.8, true, NAVY);
      center(description, x + 21.75, 268.5, 6.8, false, MUTED);
    });
  }

  font(7.1, false, MUTED);
  doc.text(doc.splitTextToSize(paid
    ? 'Constancia administrativa emitida después de validar el pago.'
    : 'Esta orden no acredita un pago realizado ni confirma la cita.', 108), 82, 282, { lineHeightFactor: 1.3 });
  right('1 / 1', 192, 290, 6.5, false, MUTED);
  doc.setFillColor(...NAVY);
  doc.rect(0, 293, 210, 4, 'F');
  polygon([[0, 283], [65, 283], [73, 297], [0, 297]], BLUE);
  polygon([[0, 283], [65, 283], [57, 297], [0, 297]], CYAN);
  return doc;
}
