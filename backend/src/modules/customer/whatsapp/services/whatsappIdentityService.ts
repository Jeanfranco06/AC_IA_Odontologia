import { prisma } from '../../../../db';
import { WhatsAppPatientContext } from '../types';

const ACTIVE_TREATMENT_STATES = ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso', 'En ejecución'];
const OPTOUT_KEYWORDS = ['DETENER', 'SALIR', 'CANCELAR', 'BAJA', 'NO MAS', 'NO DESEO MENSAJES', 'STOP'];
const OPTIN_KEYWORDS = ['INICIAR', 'ACTIVAR', 'START', 'CONTINUAR', 'HOLA'];

export class WhatsAppIdentityService {
  /**
   * Normaliza un número telefónico extrayendo solo dígitos y asegurando el formato de Perú.
   * Ej: "+51 987 654 321" -> "51987654321"
   * "987654321" -> "51987654321"
   */
  static normalizePhoneNumber(rawPhone: string): string {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9')) {
      return `51${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('519')) {
      return digits;
    }
    return digits;
  }

  /**
   * Localiza una persona en la base de datos por su número telefónico.
   * Busca tanto con código de país 51 como sin él para máxima compatibilidad con los registros existentes.
   */
  static async resolvePatientByPhone(rawPhone: string): Promise<WhatsAppPatientContext | null> {
    const normalized = this.normalizePhoneNumber(rawPhone);
    const nationalDigits = normalized.startsWith('51') && normalized.length === 11
      ? normalized.slice(2)
      : normalized;

    const person = await prisma.personas.findFirst({
      where: {
        OR: [
          { numero: normalized },
          { numero: nationalDigits },
          { numero: `+${normalized}` },
          { numero: { contains: nationalDigits } }
        ]
      },
      include: {
        TratamientosContratados: {
          where: { estado_tratamiento: { in: ACTIVE_TREATMENT_STATES } },
          include: {
            Servicios: true
          },
          orderBy: { fecha_contratacion: 'desc' },
          take: 1
        }
      }
    });

    if (!person) {
      return null;
    }

    const activeTreatment = person.TratamientosContratados?.[0];

    return {
      idPersona: person.id_persona,
      nombres: person.nombres,
      apellidos: person.apellidos,
      numero: person.numero || normalized,
      dni: person.dni,
      autorizaContacto: Boolean(person.autoriza_contacto),
      activeTreatment: activeTreatment
        ? {
            idTratamiento: activeTreatment.id_tratamiento,
            servicioNombre: activeTreatment.Servicios?.nombre || 'Tratamiento Odontológico',
            estadoTratamiento: activeTreatment.estado_tratamiento,
            idProfesionalResponsable: activeTreatment.id_profesional_responsable
          }
        : undefined
    };
  }

  /**
   * Procesa solicitudes de baja voluntaria (Opt-Out) o reactivación (Opt-In).
   * Retorna mensaje de respuesta si fue un comando de consentimiento, o null si es un mensaje conversacional normal.
   */
  static async handleConsentKeywords(personId: number, messageText: string): Promise<string | null> {
    const upper = messageText.trim().toUpperCase();

    if (OPTOUT_KEYWORDS.some(kw => upper === kw || upper.startsWith(kw))) {
      await prisma.personas.update({
        where: { id_persona: personId },
        data: {
          autoriza_contacto: false,
          fecha_actualizacion: new Date()
        }
      });

      return [
        `🔒 *Comunicaciones Pausadas*`,
        ``,
        `Has desactivado las notificaciones automáticas de NexoSalud por WhatsApp.`,
        `Si en el futuro deseas reactivar la asistencia por este canal, solo responde *INICIAR*.`,
        ``,
        `Recuerda que tus citas e historial siempre permanecen disponibles en tu Portal del Paciente.`
      ].join('\n');
    }

    if (OPTIN_KEYWORDS.some(kw => upper === kw)) {
      await prisma.personas.update({
        where: { id_persona: personId },
        data: {
          autoriza_contacto: true,
          fecha_autorizacion: new Date(),
          fecha_actualizacion: new Date()
        }
      });

      return [
        `✨ *¡Bienvenido(a) nuevamente a NexoSalud!* 🦷`,
        ``,
        `Has reactivado la asistencia y recordatorios de tus tratamientos odontológicos por WhatsApp.`,
        ``,
        `¿En qué puedo orientarte hoy sobre tus citas o cuidados dentales?`
      ].join('\n');
    }

    return null;
  }
}
