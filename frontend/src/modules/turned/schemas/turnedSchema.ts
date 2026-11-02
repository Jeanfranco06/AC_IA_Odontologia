import { z } from 'zod';

export const turnedDetailsSchema = z.object({
  finalResult: z.string().min(3, 'El resultado final es obligatorio (mín. 3 caracteres)'),
  satisfaction: z.coerce.number().min(1, 'La satisfacción debe ser entre 1 y 5').max(5, 'La satisfacción debe ser entre 1 y 5').optional(),
  customerComment: z.string().optional(),
  nextContactDate: z.string().optional(),
});

export type TurnedDetailsFormValues = z.infer<typeof turnedDetailsSchema>;

export const followUpSchema = z.object({
  channel: z.string().min(2, 'El canal de contacto es obligatorio'),
  contactResult: z.string().min(2, 'El resultado del contacto es obligatorio'),
  observations: z.string().min(3, 'Las observaciones son obligatorias (mín. 3 caracteres)'),
  nextFollowUpDate: z.string().optional(),
});

export type FollowUpFormValues = z.infer<typeof followUpSchema>;

export const newRequestSchema = z.object({
  serviceOfInterestId: z.string().min(2, 'El servicio de interés es obligatorio'),
  channel: z.string().min(2, 'El canal de contacto es obligatorio'),
  contactAuthorization: z.boolean().default(true),
  concreteRequest: z.string().min(5, 'El requerimiento o motivo debe tener al menos 5 caracteres'),
});

export type NewRequestFormValues = z.infer<typeof newRequestSchema>;
