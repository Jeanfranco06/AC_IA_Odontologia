import { prisma } from '../../../../db';
import { WhatsAppClient } from './whatsappClient';
import { WhatsAppPatientContext } from '../types';

export interface SurveyInput {
  score: number; // 0 a 10
  feedback?: string;
  surveyType?: 'POST_ATTENTION' | 'TREATMENT_COMPLETION' | 'RECALL';
  attentionId?: number;
  treatmentId?: number;
}

export interface SurveyResult {
  category: 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';
  score: number;
  trackingId?: number;
  incidentId?: number;
  replyMessage: string;
  referralCode?: string;
  googleReviewUrl?: string;
}

export class WhatsAppLoyaltyService {
  /**
   * Envía micro-encuestas NPS a pacientes con tratamientos completados recientemente (72h después del cierre).
   */
  static async sendCompletionNpsSurveys(minHoursAgo = 48, maxHoursAgo = 96): Promise<{ sent: number; skipped: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - maxHoursAgo * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - minHoursAgo * 60 * 60 * 1000);

    const completedTreatments = await prisma.tratamientosContratados.findMany({
      where: {
        estado_tratamiento: 'Completado',
        fecha_cierre_real: {
          gte: windowStart,
          lte: windowEnd
        },
        Personas: {
          autoriza_contacto: true,
          numero: { not: null }
        }
      },
      include: {
        Personas: true,
        Servicios: true,
        Atenciones: { orderBy: { fecha_atencion: 'desc' }, take: 1 }
      },
      take: 50
    });

    let sent = 0;
    let skipped = 0;

    for (const t of completedTreatments) {
      const phone = t.Personas.numero;
      const lastAttention = t.Atenciones[0];
      if (!phone || !lastAttention) {
        skipped++;
        continue;
      }

      // Verificar si ya respondió encuesta de fin de tratamiento
      const existingSurvey = await prisma.seguimientos.findFirst({
        where: {
          id_persona: t.Personas.id_persona,
          tipo: 'ENCUESTA_NPS'
        }
      });

      if (existingSurvey) {
        skipped++;
        continue;
      }

      const serviceName = t.Servicios?.nombre || 'tratamiento odontológico';
      const bodyText = [
        `🦷 *NEXOSALUD ODONTOLOGÍA · EVALUACIÓN DE EXPERIENCIA*`,
        `¡Hola *${t.Personas.nombres}*! Felicitaciones por completar tu *${serviceName}*. 🎉✨`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `Tu salud y tranquilidad son nuestro principal objetivo. Nos ayudaría mucho conocer tu sincera opinión:`,
        ``,
        `👉 *Del 0 al 10, ¿con qué probabilidad recomendarías NexoSalud a tus familiares o amigos?*`,
        `_(Donde 0 es "Nada probable" y 10 es "Totalmente seguro")_`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `💡 *Solo responde con el número de tu calificación* (ejemplo: *10*).`
      ].join('\n');

      const result = await WhatsAppClient.sendTextMessage(phone, bodyText);
      if (result.success) {
        sent++;
      } else {
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Envía la micro-encuesta NPS de satisfacción para una atención clínica puntual.
   */
  static async sendAttentionNpsSurvey(attentionId: number): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const attention = await prisma.atenciones.findUnique({
      where: { id_atencion: attentionId },
      include: { Persona: true, Servicio: true, Profesional: true }
    });
    if (!attention || !attention.Persona?.numero) {
      return { success: false, error: 'Atención no encontrada o paciente sin teléfono registrado' };
    }
    const serviceName = attention.Servicio?.nombre || 'consulta odontológica';
    const doctorName = attention.Profesional ? `la Dra. ${attention.Profesional.nombres} ${attention.Profesional.apellidos}` : 'nuestro equipo profesional';
    const bodyText = [
      `🦷 *NEXOSALUD ODONTOLOGÍA · EVALUACIÓN DE ATENCIÓN*`,
      `¡Hola *${attention.Persona.nombres}*! Esperamos que tu recuperación sea excelente tras tu atención de *${serviceName}* con ${doctorName}. 🎉✨`,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `Tu opinión es fundamental para nosotros y nos ayuda a mantener los más altos estándares clínicos:`,
      ``,
      `👉 *Del 0 al 10, ¿con qué probabilidad recomendarías la atención de NexoSalud a tus familiares o amigos?*`,
      `_(Donde 0 es "Nada probable" y 10 es "Totalmente seguro")_`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `💡 *Por favor responde directamente a este mensaje indicando tu calificación (por ejemplo: 10).*`
    ].join('\n');

    return WhatsAppClient.sendTextMessage(attention.Persona.numero, bodyText);
  }

  /**
   * Procesa la calificación de satisfacción / NPS y aplica segmentación inteligente.
   */
  static async recordSatisfactionSurvey(
    patient: WhatsAppPatientContext,
    input: SurveyInput
  ): Promise<SurveyResult> {
    const score = Math.max(0, Math.min(10, Math.round(input.score)));
    let category: 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';

    if (score >= 9) {
      category = 'PROMOTER';
    } else if (score >= 7) {
      category = 'PASSIVE';
    } else {
      category = 'DETRACTOR';
    }

    // Resolver atención de referencia
    let attentionId = input.attentionId;
    if (!attentionId) {
      const lastAttention = await prisma.atenciones.findFirst({
        where: { id_persona: patient.idPersona },
        orderBy: { fecha_atencion: 'desc' }
      });
      attentionId = lastAttention?.id_atencion;
    }

    let trackingId: number | undefined;
    let incidentId: number | undefined;

    // Mapeo seguro al rango 1-5 permitido por la restricción física de la base de datos (CK_Seguimientos_Satisfaccion)
    const dbRating = Math.max(1, Math.min(5, Math.round(score / 2) || 1));

    // 1. Persistir en tabla Seguimientos
    const tracking = await prisma.seguimientos.create({
      data: {
        id_persona: patient.idPersona,
        id_atencion: attentionId || 1,
        canal: 'WHATSAPP',
        tipo: 'ENCUESTA_NPS',
        satisfaccion: dbRating,
        resultado: `NPS: ${score}/10 (${category})`,
        incidencia: category === 'DETRACTOR',
        observaciones: input.feedback?.slice(0, 500) || `Calificación NPS original: ${score}/10 registrada vía WhatsApp`
      }
    }).catch(() => null);

    if (tracking) trackingId = tracking.id_seguimiento;

    // 2. Si es Detractor (0-6): Abrir incidencia prioritaria para contacto de recuperación
    if (category === 'DETRACTOR') {
      const incident = await prisma.incidencias.create({
        data: {
          id_persona: patient.idPersona,
          id_atencion: attentionId,
          tipo: 'DETRACTOR_NPS',
          prioridad: 'Alta',
          estado: 'Abierta',
          descripcion: `Paciente califica con ${score}/10 en WhatsApp. Comentarios: ${input.feedback || 'Sin comentarios adicionales'}. Contactar para resolución en <24h.`,
          motivo_tipificado: 'INSATISFACCION_CLIENTE'
        }
      }).catch(() => null);

      if (incident) incidentId = incident.id_incidencia;

      const replyMessage = [
        `🤝 *NEXOSALUD TE ESCUCHA*`,
        `Lamentamos mucho que tu experiencia no haya sido la esperada, ${patient.nombres}.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `Tu opinión es prioritaria para nosotros. Hemos generado un ticket de atención con la *Coordinación de Calidad y Dirección Médica* para revisar tu caso a detalle.`,
        ``,
        `Un responsable de la clínica se comunicará contigo para brindarte una solución oportuna.`,
        `━━━━━━━━━━━━━━━━━━━`,
        `_Gracias por ayudarnos a ser mejores cada día._`
      ].join('\n');

      return {
        category,
        score,
        trackingId,
        incidentId,
        replyMessage
      };
    }

    // 3. Si es Pasivo (7-8): Agradecimiento y pregunta de mejora
    if (category === 'PASSIVE') {
      const replyMessage = [
        `✨ *¡Muchas gracias por tu calificación de ${score}/10, ${patient.nombres}!*`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `Queremos que cada una de tus visitas sea perfecta.`,
        `👉 *¿Hay algún detalle específico en el que consideras que podríamos mejorar para alcanzar un 10 en tu próxima atención?*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `_Tus comentarios nos ayudan a perfeccionar continuamente nuestros protocolos clínicos y de atención._`
      ].join('\n');

      return {
        category,
        score,
        trackingId,
        replyMessage
      };
    }

    // 4. Si es Promotor (9-10): Reseña en Google Reviews + Código familiar de referidos
    const referralCode = `SONRISA-${patient.nombres.split(' ')[0].toUpperCase()}-${patient.idPersona}`;
    const googleReviewUrl = 'https://search.google.com/local/writereview?placeid=nexosalud';

    const replyMessage = [
      `🎉 *¡Muchísimas gracias por tu maravillosa calificación de ${score}/10, ${patient.nombres}!* ⭐⭐⭐⭐⭐`,
      ``,
      `Nos alegra enormemente saber que tu experiencia fue excelente. Tu sonrisa es nuestro mayor orgullo.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `🎁 *Tu Beneficio Exclusivo para Familia y Amigos:*`,
      `Código: \`${referralCode}\``,
      `_(Compártelo para que reciban 20% de descuento en su primera Consulta y Limpieza Preventiva en NexoSalud)_.`,
      ``,
      `🌟 *¿Nos regalarías 30 segundos en Google Maps?*`,
      `Tu recomendación ayuda a más personas a sonreír con tranquilidad:`,
      `👉 ${googleReviewUrl}`,
      `━━━━━━━━━━━━━━━━━━━`,
      `¡Siempre serás bienvenido en NexoSalud! 🦷✨`
    ].join('\n');

    return {
      category,
      score,
      trackingId,
      referralCode,
      googleReviewUrl,
      replyMessage
    };
  }

  /**
   * Envía recordatorios de control semestral preventivo (Recalls a 6 meses / Puente Customer -> Turned).
   */
  static async sendSixMonthRecalls(): Promise<{ sent: number; skipped: number }> {
    const now = new Date();
    // Ventana alrededor de 180 días (entre 175 y 190 días atrás)
    const start180 = new Date(now.getTime() - 190 * 24 * 60 * 60 * 1000);
    const end180 = new Date(now.getTime() - 175 * 24 * 60 * 60 * 1000);

    const candidates = await prisma.tratamientosContratados.findMany({
      where: {
        estado_tratamiento: 'Completado',
        fecha_cierre_real: {
          gte: start180,
          lte: end180
        },
        Personas: {
          autoriza_contacto: true,
          numero: { not: null }
        }
      },
      include: {
        Personas: true,
        Servicios: true
      },
      take: 50
    });

    let sent = 0;
    let skipped = 0;

    for (const c of candidates) {
      const phone = c.Personas.numero;
      if (!phone) {
        skipped++;
        continue;
      }

      // Evitar enviar si ya tiene un recall registrado recientemente
      const recentRecall = await prisma.seguimientos.findFirst({
        where: {
          id_persona: c.Personas.id_persona,
          tipo: 'RECALL_6_MESES',
          fecha_hora: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
        }
      });

      if (recentRecall) {
        skipped++;
        continue;
      }

      const bodyText = [
        `🦷 *NEXOSALUD ODONTOLOGÍA · CONTROL PREVENTIVO SEMESTRAL*`,
        `¡Hola *${c.Personas.nombres}*! Ya pasaron 6 meses desde que finalizaste tu tratamiento de *${c.Servicios?.nombre || 'Odontología'}*. 🦷✨`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `🩺 *¿Por qué es tiempo de tu control?*`,
        `Para proteger la inversión en tu sonrisa y prevenir cualquier formación de placa o caries, la pauta odontológica recomienda una profilaxis y revisión semestral.`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👉 *¿Te gustaría agendar tu control para esta semana o la próxima?*`,
        `Responde con un *"SÍ"* o indícanos tus días preferidos para reservar tu cita.`
      ].join('\n');

      const result = await WhatsAppClient.sendTextMessage(phone, bodyText);
      if (result.success) {
        await prisma.seguimientos.create({
          data: {
            id_persona: c.Personas.id_persona,
            id_atencion: 1,
            canal: 'WHATSAPP',
            tipo: 'RECALL_6_MESES',
            resultado: 'Invitación a control preventivo enviada por WhatsApp',
            incidencia: false,
            observaciones: 'Recall semestral automatizado'
          }
        }).catch(() => null);
        sent++;
      } else {
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Registra una oportunidad comercial (Lead) para un tratamiento complementario manteniendo el id_persona.
   */
  static async createComplementaryLead(
    patient: WhatsAppPatientContext,
    serviceId: number,
    notes?: string
  ): Promise<{ success: boolean; idSolicitud?: number; message: string }> {
    const service = await prisma.servicios.findUnique({
      where: { id_servicio: serviceId }
    });

    if (!service) {
      return { success: false, message: 'El servicio complementario indicado no existe en el catálogo.' };
    }

    // Crear solicitud en etapa LEAD preservando el id_persona
    const leadStage = await prisma.etapas.findFirst({
      where: { nombre: { in: ['LEAD', 'Lead'] } }
    });

    const newRequest = await prisma.solicitudes.create({
      data: {
        id_persona: patient.idPersona,
        id_servicio: serviceId,
        estado: 'Abierta',
        fecha_solicitud: new Date(),
        tipo_consulta: 'TRATAMIENTO_COMPLEMENTARIO_WHATSAPP',
        motivo: notes ? `Tratamiento complementario: ${notes}` : `Interés en tratamiento complementario: ${service.nombre}`
      }
    });

    return {
      success: true,
      idSolicitud: newRequest.id_solicitud,
      message: `¡Excelente, ${patient.nombres}! Hemos registrado tu interés en el servicio de *${service.nombre}*. Un asesor de coordinación se pondrá en contacto contigo para presentarte las opciones y beneficios exclusivos para pacientes de la clínica.`
    };
  }
}
