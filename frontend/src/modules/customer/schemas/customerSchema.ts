import { z } from 'zod';

export const dentalAttentionSchema = z.object({
  reasonForConsultation: z.string().optional(),
  relevantBackground: z.string().optional(),
  allergies: z.string().optional(),
  evaluation: z.string().optional(),
  procedure: z.string().optional(),
  instructions: z.string().optional(),
  observations: z.string().optional(),
});

export type DentalAttentionFormValues = z.infer<typeof dentalAttentionSchema>;

export const customerIncidentSchema = z.object({
  reason: z.string().min(10, 'El motivo debe ser detallado (al menos 10 caracteres)'),
});

export type CustomerIncidentFormValues = z.infer<typeof customerIncidentSchema>;
