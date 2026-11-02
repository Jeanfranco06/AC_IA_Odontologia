import { z } from 'zod';

export const buyerSchema = z.object({
  firstName: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)'),
  lastName: z.string().min(2, 'El apellido es obligatorio (mínimo 2 caracteres)'),
  email: z
    .string()
    .email('Ingresa un correo electrónico válido (ej: usuario@correo.com)')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .min(1, 'El número de teléfono / WhatsApp es obligatorio')
    .regex(/^[0-9]{9}$|^(\+?51)?[0-9]{9}$/, 'Debe ingresar un número de 9 dígitos válido (Perú)'),
  channel: z.string().min(1, 'Selecciona un canal de origen'),
  attractionSource: z.string().min(1, 'Selecciona una fuente de atracción'),
  serviceOfInterestId: z.string().optional().or(z.literal('')),
  pref_sede_preferida: z.string().optional().or(z.literal('')),
  pref_id_horario: z.string().optional().or(z.literal('')),
  concreteRequest: z.string().min(3, 'Indica el motivo de consulta o necesidad'),
  contactAuthorization: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar la autorización de contacto y protección de datos',
  }),

  // Campos opcionales para compatibilidad
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  pref_id_canal: z.string().optional(),
  pref_id_modalidad: z.string().optional(),
  pref_profesional_preferido: z.string().optional(),
  estudianteAplica: z.boolean().optional(),
  universidad: z.string().optional(),
  carrera: z.string().optional(),
  ciclo: z.string().optional(),
  laboralAplica: z.boolean().optional(),
  ocupacion: z.string().optional(),
  empresa: z.string().optional(),
  modalidadLaboral: z.string().optional(),
  disponibilidadLaboral: z.string().optional(),
  ultima_visita_odontologica: z.string().optional(),
  tratamiento_previo: z.string().optional(),
  nivel_dolor: z.string().optional(),
  presenta_sensibilidad: z.string().optional(),
  sangrado_o_inflamacion: z.string().optional(),
  usa_aparato_o_protesis: z.string().optional(),
  condicion_atencion_especial: z.string().optional(),
});

export type BuyerFormValues = z.infer<typeof buyerSchema>;
