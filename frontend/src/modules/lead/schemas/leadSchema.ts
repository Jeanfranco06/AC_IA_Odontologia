import { z } from 'zod';

export const alternativeSchema = z.object({
  service: z.string().min(2, 'El servicio es obligatorio'),
  professional: z.string().min(2, 'El profesional es obligatorio'),
  branch: z.string().min(2, 'La sede es obligatoria'),
  date: z.string().min(1, 'La fecha es obligatoria'),
  time: z.string().min(1, 'La hora es obligatoria'),
  price: z.coerce.number().min(1, 'El precio debe ser mayor a 0'),
  conditions: z.string().optional(),
  observations: z.string().optional(),
});

export type AlternativeFormValues = z.infer<typeof alternativeSchema>;

export const leadUpdateSchema = z.object({
  receptionDate: z.string().optional(),
  firstResponseDate: z.string().optional(),
  followUpAuthorization: z.boolean().optional(),
  clinicalDerivationNeeded: z.boolean().optional(),
  clinicalObservation: z.string().optional(),
  declaredPreferences: z.string().optional(),
});

export type LeadUpdateFormValues = z.infer<typeof leadUpdateSchema>;
