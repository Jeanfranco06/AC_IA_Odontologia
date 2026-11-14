import crypto from 'crypto';
import { prisma } from '../../../../db';
import { WhatsAppClient } from './whatsappClient';
import { WhatsAppPatientContext } from '../types';

const RED_FLAG_KEYWORDS = [
  'fiebre',
  'temperatura alta',
  'sangrado continuo',
  'mucha sangre',
  'hemorragia',
  'parestesia',
  'adormecido',
  'sin sensibilidad',
  'no puedo abrir la boca',
  'trismus',
  'dificultad para tragar',
  'dificultad para respirar',
  'pus',
  'infeccion',
  'hinchazon severa'
];

export interface TriageInput {
  attentionId?: number;
  painLevel: number; // 0 a 10
  symptoms: string;
  hasRedFlags: boolean;
  redFlagDetails?: string;
}

export interface TriageResult {
  isUrgent: boolean;
  alertId?: number;
  incidentId?: number;
  trackingId?: number;
  patientGuidance: string;
}

export class WhatsAppPostCareService {
  /**
   * Envía micro-encuestas de check-in post-operatorio a las 24h de atenciones clínicas.
   */
  static async sendPostCareCheckins(minHoursAgo = 20, maxHoursAgo = 36): Promise<{ sent: number; skipped: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - maxHoursAgo * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - minHoursAgo * 60 * 60 * 1000);

    // Atenciones realizadas en la ventana sin seguimiento previo
    const attentions = await prisma.atenciones.findMany({
      where: {
        fecha_atencion: {
          gte: windowStart,
          lte: windowEnd
        },
        estado_servicio: { in: ['Realizado', 'Finalizado'] },
        Persona: {
          autoriza_contacto: true,
          numero: { not: null }
        },
        Seguimientos: {
          none: { tipo: 'POST_OPERATORIO' }
        }
      },
      include: {
        Persona: true,
        Servicio: true,
        Profesional: true,
        Sede: true
      },
      orderBy: { fecha_atencion: 'desc' },
      take: 50
    });

    let sent = 0;
    let skipped = 0;

    for (const attention of attentions) {
      const phone = attention.Persona.numero;
      if (!phone) {
        skipped++;
        continue;
      }

      const doctorName = attention.Profesional
        ? `Dr(a). ${attention.Profesional.nombres} ${attention.Profesional.apellidos}`
        : 'tu odontólogo tratante';
      const serviceName = attention.Servicio?.nombre || 'tu atención odontológica';

      const bodyText = [
        `🩺 *NEXOSALUD · CUIDADO POST-ATENCIÓN*`,
        `¡Hola *${attention.Persona.nombres}*! Esperamos que estés descansando bien.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `Ayer tuviste tu cita de *${serviceName}* con ${doctorName}. Para acompañar tu recuperación:`,
        ``,
        `👉 *¿Cómo te has sentido en estas primeras 24 horas?*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `_Selecciona la opción que mejor describa tu estado actual:_`
      ].join('\n');

      const buttons = [
        { id: `POSTCARE_OK_${attention.id_atencion}`, title: '1. Me siento bien 😊' },
        { id: `POSTCARE_MILD_${attention.id_atencion}`, title: '2. Molestia leve 😐' },
        { id: `POSTCARE_ALERT_${attention.id_atencion}`, title: '3. Dolor / Alerta 🚨' }
      ];

      const result = await WhatsAppClient.sendQuickReplyButtons(
        phone,
        bodyText,
        buttons,
        '🩺 Seguimiento Clínico 24h',
        'NexoSalud Odontología'
      );

      if (result.success) {
        sent++;
      } else {
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Maneja las respuestas a los botones de check-in post-operatorio.
   */
  static async handlePostCareButton(
    patient: WhatsAppPatientContext,
    buttonId: string
  ): Promise<{ handled: boolean; replyText?: string }> {
    if (buttonId.startsWith('POSTCARE_OK_')) {
      const attentionId = Number(buttonId.replace('POSTCARE_OK_', ''));
      if (Number.isInteger(attentionId) && attentionId > 0) {
        await prisma.seguimientos.create({
          data: {
            id_persona: patient.idPersona,
            id_atencion: attentionId,
            canal: 'WHATSAPP',
            tipo: 'POST_OPERATORIO',
            resultado: 'Evolución favorable sin molestias reportadas',
            incidencia: false,
            observaciones: 'Paciente confirma bienestar en check-in 24h por WhatsApp'
          }
        }).catch(() => null);
      }

      return {
        handled: true,
        replyText: [
          `🌟 *¡Excelente noticia! Nos alegra mucho saber que te sientes bien, ${patient.nombres}!* 😊`,
          ``,
          `Tu evolución marcha favorablemente.`,
          ``,
          `📌 *Recomendaciones para mantener tu progreso:*`,
          `• Mantén tu cepillado dental con cerdas suaves en la zona tratada.`,
          `• Evita alimentos muy duros, tostados o crujientes por 48 horas.`,
          `• Si tu doctor te indicó medicamentos, complétalos según la receta.`,
          ``,
          `━━━━━━━━━━━━━━━━━━━`,
          `💡 _Escribe *mis indicaciones* en cualquier momento para consultar tu guía oficial._`,
          `¡Que tengas un excelente día!`
        ].join('\n')
      };
    }

    if (buttonId.startsWith('POSTCARE_MILD_')) {
      const attentionId = Number(buttonId.replace('POSTCARE_MILD_', ''));
      let instructionsText = '';

      if (Number.isInteger(attentionId) && attentionId > 0) {
        await prisma.seguimientos.create({
          data: {
            id_persona: patient.idPersona,
            id_atencion: attentionId,
            canal: 'WHATSAPP',
            tipo: 'POST_OPERATORIO',
            resultado: 'Molestia leve esperada en recuperación',
            incidencia: false,
            observaciones: 'Paciente reporta molestias leves controlables'
          }
        }).catch(() => null);

        // Consultar indicaciones emitidas
        const attention = await prisma.atenciones.findUnique({
          where: { id_atencion: attentionId },
          include: { IndicacionesPostatencion: { where: { estado: { in: ['Documento emitido', 'Documento aprobado', 'Emitido'] } }, take: 1 } }
        });

        if (attention?.indicaciones_finales) {
          instructionsText = `\n\n📋 *Tus indicaciones oficiales registradas:*\n${attention.indicaciones_finales}`;
        }
      }

      return {
        handled: true,
        replyText: [
          `🩺 *Evolución con Molestia Leve*`,
          ``,
          `Comprendemos, *${patient.nombres}*. Una ligera molestia o inflamación es parte natural del proceso reparativo en las primeras 24 a 48 horas.${instructionsText}`,
          ``,
          `💡 *Pautas de alivio inmediato:*`,
          `• Aplica compresas frías en la zona externa de la mejilla (15 min de frío, 15 min de descanso).`,
          `• Dieta blanda a temperatura ambiente (evita sopas calientes o comidas picantes).`,
          `• Toma tus analgésicos en el horario estricto pautado por tu especialista.`,
          ``,
          `━━━━━━━━━━━━━━━━━━━`,
          `⚠️ _Si la molestia aumenta en lugar de disminuir, avísame de inmediato para comunicárselo a tu doctor._`
        ].join('\n')
      };
    }

    if (buttonId.startsWith('POSTCARE_ALERT_')) {
      const attentionId = Number(buttonId.replace('POSTCARE_ALERT_', ''));

      return {
        handled: true,
        replyText: [
          `🚨 *Protocolo de Atención Médica Prioritaria*`,
          ``,
          `*${patient.nombres}*, sentimos mucho que estés experimentando dolor o molestias significativas. Queremos ayudarte de inmediato.`,
          ``,
          `Por favor responde con estos datos:`,
          `1️⃣ ¿Del 1 al 10 qué nivel de dolor sientes?`,
          `2️⃣ *Síntomas:* ¿Tienes sangrado que no para, fiebre, hinchazón notable o dificultad para abrir la boca?`,
          ``,
          `━━━━━━━━━━━━━━━━━━━`,
          `📞 _Central médica de urgencias: *(01) 234-5678 (Opción 1)*._`,
          `Escribe tus síntomas aquí para activar el triaje clínico en tu ficha.`
        ].join('\n')
      };
    }

    return { handled: false };
  }

  /**
   * Evalúa los síntomas del paciente y registra triaje clínico con activación de alerta ALT-C08 si aplica.
   */
  static async evaluateAndRegisterTriage(
    patient: WhatsAppPatientContext,
    input: TriageInput
  ): Promise<TriageResult> {
    const textLower = (input.symptoms + ' ' + (input.redFlagDetails || '')).toLowerCase();
    const detectedKeyword = RED_FLAG_KEYWORDS.find(kw => textLower.includes(kw));

    const isUrgent = input.hasRedFlags || input.painLevel >= 8 || Boolean(detectedKeyword);

    // Localizar atención asociada si no fue provista
    let resolvedAttentionId = input.attentionId;
    let doctorId = patient.activeTreatment?.idProfesionalResponsable;

    if (!resolvedAttentionId) {
      const lastAttention = await prisma.atenciones.findFirst({
        where: { id_persona: patient.idPersona },
        orderBy: { fecha_atencion: 'desc' }
      });
      if (lastAttention) {
        resolvedAttentionId = lastAttention.id_atencion;
        doctorId = doctorId || lastAttention.id_profesional;
      }
    }

    let alertId: number | undefined;
    let incidentId: number | undefined;
    let trackingId: number | undefined;

    // 1. Persistir en tabla Seguimientos
    const tracking = await prisma.seguimientos.create({
      data: {
        id_persona: patient.idPersona,
        id_atencion: resolvedAttentionId || 1, // Fallback si no hay atención previa
        canal: 'WHATSAPP',
        tipo: 'TRIAJE_SINTOMAS',
        resultado: isUrgent ? 'URGENCIA_COMPLICACION' : 'MOLESTIA_MODERADA',
        incidencia: isUrgent,
        observaciones: `EVA: ${input.painLevel}/10 | Síntomas: ${input.symptoms.slice(0, 300)} | Banderas Rojas: ${isUrgent ? 'SÍ' : 'NO'}`
      }
    }).catch(() => null);

    if (tracking) trackingId = tracking.id_seguimiento;

    if (isUrgent) {
      // 2. Crear Incidencia de Prioridad Alta
      const incident = await prisma.incidencias.create({
        data: {
          id_persona: patient.idPersona,
          id_atencion: resolvedAttentionId,
          tipo: 'COMPLICACION_POSTOPERATORIA',
          prioridad: 'Alta',
          estado: 'Abierta',
          descripcion: `Paciente reporta dolor severo (EVA ${input.painLevel}/10) y síntomas de alerta vía WhatsApp: ${input.symptoms.slice(0, 350)}`,
          motivo_tipificado: detectedKeyword || 'DOLOR_SEVERO_POSTOP'
        }
      }).catch(() => null);

      if (incident) incidentId = incident.id_incidencia;

      // 3. Crear Alerta Asistencial ALT-C08 en bandeja médica
      const dedupKey = crypto.createHash('sha256').update(`ALT-C08:${patient.idPersona}:${Date.now()}`).digest('hex');
      const alertRow = await prisma.alertasIA.create({
        data: {
          id_persona: patient.idPersona,
          id_profesional: doctorId,
          id_tratamiento: patient.activeTreatment?.idTratamiento,
          id_atencion: resolvedAttentionId,
          tipo_evento: 'ALT-C08',
          severidad: 'Alta',
          estado: 'Generada',
          requiere_revision_humana: true,
          mensaje_alerta: `URGENCIA POSTOPERATORIA (EVA ${input.painLevel}/10) en WhatsApp: ${input.symptoms.slice(0, 150)}. Revisar de inmediato.`,
          clave_deduplicacion: dedupKey,
          version_agente: 'CUSTOMER-WHATSAPP-v1'
        }
      }).catch(() => null);

      if (alertRow) alertId = alertRow.id_alerta_ia;

      const patientGuidance = [
        `🚨 *Urgencia Médica Registrada (Prioridad Alta)*`,
        '',
        `Estimado(a) ${patient.nombres}, hemos registrado tu reporte de síntomas y *hemos notificado de inmediato al equipo odontológico y a la central de recepción*.`,
        '',
        '⚠️ *Instrucciones inmediatas de seguridad:*',
        '1. Si presentas sangrado activo continuo, coloca una gasa limpia seca sobre la zona y muérdela con presión firme constante durante 30 minutos sin cambiarla.',
        '2. No tomes aspirina ni te enjuagues la boca bruscamente.',
        '3. Si el dolor es insoportable, la fiebre supera 38.5°C o tienes dificultad para deglutir o respirar, acude de inmediato al servicio de urgencias de nuestra sede o a la clínica más cercana.',
        '',
        '📞 *Central de Urgencias Odontológicas NexoSalud:* (01) 234-5678 anexo 1.',
        'Un miembro del equipo médico se comunicará contigo a la brevedad.'
      ].join('\n');

      return {
        isUrgent: true,
        alertId,
        incidentId,
        trackingId,
        patientGuidance
      };
    }

    // Caso Molestia Moderada (sin banderas rojas)
    const patientGuidance = [
      `📋 *Evaluación de Molestias (Nivel EVA ${input.painLevel}/10)*`,
      '',
      `Hola ${patient.nombres}, tu reporte ha sido registrado para el seguimiento de tu odontólogo. Los síntomas descritos corresponden a un proceso inflamatorio habitual, pero requieren monitoreo.`,
      '',
      '💡 *Recomendaciones:*',
      '• Continúa con los analgésicos o antiinflamatorios prescritos en tu receta oficial.',
      '• Evita esfuerzos físicos intensos y mantén reposo relativo.',
      '• Aplica compresas frías sobre la mejilla si hay inflamación externa.',
      '',
      'Si el dolor aumenta o no cede con la medicación en las próximas horas, escríbenos nuevamente para coordinar una revisión presencial prioritaria.'
    ].join('\n');

    return {
      isUrgent: false,
      trackingId,
      patientGuidance
    };
  }

  /**
   * Formatea las indicaciones oficiales emitidas para presentación clara en WhatsApp.
   */
  static async formatInstructionsForWhatsApp(patientId: number, attentionId?: number): Promise<string> {
    const where: any = { id_persona: patientId };
    if (attentionId) {
      where.id_atencion = attentionId;
    }

    const attention = await prisma.atenciones.findFirst({
      where,
      orderBy: { fecha_atencion: 'desc' },
      include: {
        Servicio: true,
        Profesional: true,
        Sede: true,
        IndicacionesPostatencion: {
          where: { estado: { in: ['Documento emitido', 'Documento aprobado', 'Emitido'] } },
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!attention) {
      return 'No encontramos atenciones médicas registradas para consultar indicaciones.';
    }

    const doc = attention.IndicacionesPostatencion?.[0];
    const text = doc?.contenido_indicaciones || attention.indicaciones_finales;

    if (!text) {
      return `Tu atención de *${attention.Servicio?.nombre || 'consulta'}* del día ${attention.fecha_atencion.toISOString().slice(0, 10)} no cuenta con indicaciones especiales registradas por el odontólogo. Si tienes dudas, puedes consultar a tu profesional tratante.`;
    }

    const doctorName = attention.Profesional
      ? `Dr(a). ${attention.Profesional.nombres} ${attention.Profesional.apellidos}`
      : 'Especialista tratante';

    return [
      `📋 *Indicaciones Médicas Post-Atención · NexoSalud*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `🦷 *Tratamiento:* ${attention.Servicio?.nombre || 'Procedimiento Odontológico'}`,
      `👨‍⚕️ *Especialista:* ${doctorName}`,
      `📅 *Fecha de Atención:* ${attention.fecha_atencion.toISOString().slice(0, 10)}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📌 *Pautas y Cuidados Oficiales:*`,
      text,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `💡 _Sigue cada indicación al pie de la letra para asegurar la duración y éxito de tu tratamiento._`,
      `📞 _Dudas o emergencias: (01) 234-5678._`
    ].join('\n');
  }
}
