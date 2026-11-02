import { z } from 'zod';

export const receiptMetadataSchema = z.object({
  name: z.string(),
  size: z.number().max(5 * 1024 * 1024, 'El archivo no debe pesar más de 5MB'),
  type: z.string().regex(/^(image\/(jpeg|png)|application\/pdf)$/, 'Solo se permiten archivos JPG, PNG o PDF'),
});

export const paymentSchema = z.object({
  channel: z.enum([
    'Web',
    'Enlace de pago',
    'Transferencia con comprobante',
    'Asistencia por voz',
    'Efectivo en clínica',
    'Yape / Plin',
    'Tarjeta de Crédito / Débito'
  ], {
    errorMap: () => ({ message: 'Selecciona un canal válido' })
  }),
  operationNumber: z.string().min(3, 'El número de operación debe tener al menos 3 caracteres'),
  operationDate: z.string().min(1, 'La fecha de operación es obligatoria'),
  receiptMetadata: receiptMetadataSchema.optional(),
  observations: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const incidentSchema = z.object({
  reason: z.string().min(10, 'El motivo debe ser detallado (al menos 10 caracteres)'),
});

export type IncidentFormValues = z.infer<typeof incidentSchema>;
