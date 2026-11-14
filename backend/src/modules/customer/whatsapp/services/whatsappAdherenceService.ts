import { prisma } from '../../../../db';
import { CustomerCompletionService } from '../../ai-agent/services/customerCompletionService';
import { CustomerAiQueryService } from '../../ai-agent/services/customerAiQueryService';
import { WhatsAppClient } from './whatsappClient';
import { WhatsAppPatientContext } from '../types';

function formatLimaDateTime(date: Date): { fechaStr: string; horaStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';

    const capitalWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return {
      fechaStr: `${capitalWeekday} ${day} de ${month}`,
      horaStr: `${hour}:${minute} ${dayPeriod}`.trim()
    };
  } catch {
    return {
      fechaStr: date.toISOString().slice(0, 10),
      horaStr: date.toISOString().slice(11, 16)
    };
  }
}

export class WhatsAppAdherenceService {
  /**
   * Envía recordatorios interactivos (T-24h) a pacientes con citas próximas sin confirmar.
   */
  static async sendUpcomingSessionReminders(hoursAhead: number = 24): Promise<{ sent: number; skipped: number }> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    // Buscar sesiones dentro de la ventana que aún no tengan confirmación
    const sessions = await prisma.sesionesTratamiento.findMany({
      where: {
        fecha_programada_vigente: {
          gt: now,
          lte: windowEnd
        },
        estado_asistencial: 'Pendiente',
        confirmacion_paciente: {
          in: ['No_Solicitada', 'Solicitada', 'Sin_Respuesta']
        },
        estado_programacion: {
          in: ['Programada', 'Reprogramada']
        },
        TratamientosContratados: {
          Personas: {
            autoriza_contacto: true,
            numero: { not: null }
          }
        }
      },
      include: {
        Sedes: true,
        Profesionales: true,
        TratamientosContratados: {
          include: {
            Servicios: true,
            Personas: true
          }
        }
      },
      orderBy: { fecha_programada_vigente: 'asc' }
    });

    let sent = 0;
    let skipped = 0;

    for (const session of sessions) {
      const patient = session.TratamientosContratados?.Personas;
      const phone = patient?.numero;
      if (!phone || !patient) {
        skipped++;
        continue;
      }

      const { fechaStr, horaStr } = formatLimaDateTime(session.fecha_programada_vigente);
      const doctorName = session.Profesionales
        ? `Dr(a). ${session.Profesionales.nombres} ${session.Profesionales.apellidos}`
        : 'Especialista asignado';
      const serviceName = session.TratamientosContratados?.Servicios?.nombre || 'Consulta Odontológica';
      const branchName = session.Sedes?.nombre || 'Sede Principal';
      const branchAddress = session.Sedes?.direccion || '';

      const bodyText = [
        `🦷 *NEXOSALUD ODONTOLOGÍA*`,
        `¡Hola *${patient.nombres}*! Te recordamos tu próxima cita médica:`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `📋 *Tratamiento:* ${serviceName}`,
        `🔢 *Sesión:* ${session.numero_sesion}`,
        `📅 *Fecha:* ${fechaStr}`,
        `⏰ *Hora:* ${horaStr}`,
        `📍 *Sede:* ${branchName}${branchAddress ? `\n    _(${branchAddress})_` : ''}`,
        `👨‍⚕️ *Especialista:* ${doctorName}`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👉 *¿Nos confirmas tu asistencia?*`,
        `_Tu confirmación nos permite preparar el sillón y tus materiales con anticipación._`
      ].join('\n');

      const buttons = [
        { id: `CONFIRM_SESSION_${session.id_sesion}`, title: '✅ Confirmar' },
        { id: `RESCHEDULE_SESSION_${session.id_sesion}`, title: '🔄 Reprogramar' },
        { id: `CANCEL_SESSION_${session.id_sesion}`, title: '❌ Cancelar' }
      ];

      const result = await WhatsAppClient.sendQuickReplyButtons(
        phone,
        bodyText,
        buttons,
        '📅 Recordatorio de Cita',
        'NexoSalud · Cuidado Continuo'
      );

      if (result.success) {
        // Marcamos la sesión como Solicitada para no reenviar en cada ejecución
        await prisma.sesionesTratamiento.update({
          where: { id_sesion: session.id_sesion },
          data: { confirmacion_paciente: 'Solicitada' }
        });
        sent++;
      } else {
        skipped++;
      }
    }

    return { sent, skipped };
  }

  /**
   * Envía de forma inmediata y bajo demanda el recordatorio interactivo de WhatsApp
   * para una sesión específica o para el paciente indicado, sin requerir esperar las 24 horas.
   */
  static async sendImmediateSessionReminder(params: { sessionId?: number; personId?: number }): Promise<{ success: boolean; message: string; details?: any }> {
    const session = await prisma.sesionesTratamiento.findFirst({
      where: {
        ...(params.sessionId ? { id_sesion: params.sessionId } : {}),
        ...(params.personId ? { TratamientosContratados: { id_persona: params.personId } } : {}),
        estado_asistencial: 'Pendiente',
        estado_programacion: { in: ['Programada', 'Reprogramada', 'Confirmada'] }
      },
      include: {
        Sedes: true,
        Profesionales: true,
        TratamientosContratados: {
          include: {
            Servicios: true,
            Personas: true
          }
        }
      },
      orderBy: { fecha_programada_vigente: 'asc' }
    });

    if (!session) {
      return { success: false, message: 'No se encontró una sesión médica pendiente de atención para este paciente.' };
    }

    const patient = session.TratamientosContratados?.Personas;
    const phone = patient?.numero;
    if (!phone || !patient) {
      return { success: false, message: 'El paciente no cuenta con número de WhatsApp registrado o contacto autorizado.' };
    }

    const { fechaStr, horaStr } = formatLimaDateTime(session.fecha_programada_vigente);
    const doctorName = session.Profesionales
      ? `Dr(a). ${session.Profesionales.nombres} ${session.Profesionales.apellidos}`
      : 'Especialista asignado';
    const serviceName = session.TratamientosContratados?.Servicios?.nombre || 'Consulta Odontológica';
    const branchName = session.Sedes?.nombre || 'Sede Principal';
    const branchAddress = session.Sedes?.direccion || '';

    const bodyText = [
      `🦷 *NEXOSALUD ODONTOLOGÍA*`,
      `¡Hola *${patient.nombres}*! Te recordamos tu próxima cita médica:`,
      ``,
      `━━━━━━━━━━━━━━━━━━━`,
      `📋 *Tratamiento:* ${serviceName}`,
      `🔢 *Sesión:* ${session.numero_sesion}`,
      `📅 *Fecha:* ${fechaStr}`,
      `⏰ *Hora:* ${horaStr}`,
      `📍 *Sede:* ${branchName}${branchAddress ? `\n    _(${branchAddress})_` : ''}`,
      `👨‍⚕️ *Especialista:* ${doctorName}`,
      `━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👉 *¿Nos confirmas tu asistencia?*`,
      `_Tu confirmación nos permite preparar el sillón y tus materiales con anticipación._`
    ].join('\n');

    const buttons = [
      { id: `CONFIRM_SESSION_${session.id_sesion}`, title: '✅ Confirmar' },
      { id: `RESCHEDULE_SESSION_${session.id_sesion}`, title: '🔄 Reprogramar' },
      { id: `CANCEL_SESSION_${session.id_sesion}`, title: '❌ Cancelar' }
    ];

    const result = await WhatsAppClient.sendQuickReplyButtons(
      phone,
      bodyText,
      buttons,
      '📅 Recordatorio de Cita',
      'NexoSalud · Cuidado Continuo'
    );

    if (result.success) {
      await prisma.sesionesTratamiento.update({
        where: { id_sesion: session.id_sesion },
        data: { confirmacion_paciente: 'Solicitada' }
      });
      return {
        success: true,
        message: `Recordatorio interactivo enviado a ${patient.nombres} (${phone}) para la sesión #${session.numero_sesion}.`,
        details: { sessionId: session.id_sesion, phone, fecha: fechaStr, hora: horaStr }
      };
    }

    return {
      success: false,
      message: result.error || 'No fue posible despachar el mensaje interactivo a Meta WhatsApp Cloud API.'
    };
  }

  /**
   * Maneja acciones de botones interactivos de WhatsApp (Confirmar, Reprogramar, Cancelar).
   */
  static async handleInteractiveAction(
    patient: WhatsAppPatientContext,
    actionId: string
  ): Promise<{ handled: boolean; replyText?: string }> {
    if (actionId.startsWith('CONFIRM_SESSION_')) {
      const sessionId = Number(actionId.replace('CONFIRM_SESSION_', ''));
      if (!Number.isInteger(sessionId) || sessionId <= 0) return { handled: false };

      try {
        const principal = { role: 'PACIENTE' as const, idPersona: patient.idPersona };
        await CustomerCompletionService.confirmSession(principal, sessionId, true);

        const session = await prisma.sesionesTratamiento.findUnique({
          where: { id_sesion: sessionId },
          include: { Sedes: true }
        });

        const branchInfo = session?.Sedes?.nombre
          ? `\n📍 *Sede:* ${session.Sedes.nombre}${session.Sedes.direccion ? ` _(${session.Sedes.direccion})_` : ''}`
          : '';

        return {
          handled: true,
          replyText: [
            `✨ *¡Asistencia Confirmada con Éxito!* ✅`,
            ``,
            `¡Muchas gracias, *${patient.nombres}*! Tu asistencia ha sido confirmada con éxito en nuestro sistema.`,
            `${branchInfo}`,
            `⏰ *Recomendación:* Te sugerimos llegar 10 minutos antes de tu hora programada.`,
            ``,
            `━━━━━━━━━━━━━━━━━━━`,
            `💡 _Si necesitas alguna indicación previa o tienes dudas, no dudes en escribirnos por este chat._`
          ].join('\n')
        };
      } catch (err: any) {
        return {
          handled: true,
          replyText: `Tu cita ya se encontraba confirmada o no pudo actualizarse en este momento (${err.message || 'Error'}). Si tienes dudas, estamos para ayudarte.`
        };
      }
    }

    if (actionId.startsWith('RESCHEDULE_SESSION_')) {
      return {
        handled: true,
        replyText: [
          `🔄 *Coordinación de Reprogramación*`,
          ``,
          `Entendido, *${patient.nombres}*. Para coordinar el cambio de tu sesión, por favor indícame:`,
          ``,
          `1️⃣ *¿Qué fecha preferirías?* _(ej: "este viernes", "el 20 de noviembre")_`,
          `2️⃣ *¿En qué franja horaria?* _(Mañana o Tarde)_`,
          ``,
          `Con esos datos buscaré de inmediato los cupos oficiales disponibles en tu sede.`
        ].join('\n')
      };
    }

    if (actionId.startsWith('CANCEL_SESSION_')) {
      return {
        handled: true,
        replyText: [
          `⚠️ *Cancelación de Cita*`,
          ``,
          `Lamentamos que no puedas asistir, *${patient.nombres}*. Las cancelaciones definitivas de cita requieren coordinación con recepción para no afectar la continuidad de tu plan de tratamiento.`,
          ``,
          `¿Prefieres que busquemos una nueva fecha para reprogramarla en lugar de cancelarla?`,
          `👉 *Responde con tu preferencia o escribe REPROGRAMAR.*`
        ].join('\n')
      };
    }

    return { handled: false };
  }

  /**
   * Detecta y procesa respuestas textuales de confirmación ("confirmo", "confirmo asistencia", "sí").
   */
  static async tryConfirmPendingSessionByText(
    patient: WhatsAppPatientContext,
    text: string
  ): Promise<string | null> {
    const clean = text.trim().toLowerCase().replace(/[,.!?]/g, '');
    const isConfirmationText = [
      'confirmo',
      'confirmar',
      'confirmo asistencia',
      'confirmo mi cita',
      'si confirmo',
      'sí confirmo',
      'si confirmo mi asistencia',
      'sí confirmo mi asistencia',
      'si confirmo asistencia',
      'sí confirmo asistencia',
      '1',
      'asistiré',
      'asistire'
    ].includes(clean) || clean.includes('confirmo mi asistencia') || clean.includes('confirmo asistencia') || clean.includes('confirmo mi cita');

    if (!isConfirmationText) return null;

    // Buscar si el paciente tiene una sesión próxima
    let upcoming = await prisma.sesionesTratamiento.findFirst({
      where: {
        TratamientosContratados: {
          id_persona: patient.idPersona,
          estado_tratamiento: { in: ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso', 'En ejecución'] }
        },
        estado_asistencial: 'Pendiente',
        confirmacion_paciente: { in: ['No_Solicitada', 'Solicitada', 'Sin_Respuesta'] },
        fecha_programada_vigente: { gt: new Date() }
      },
      include: {
        Sedes: true,
        TratamientosContratados: { include: { Servicios: true } }
      },
      orderBy: { fecha_programada_vigente: 'asc' }
    });

    let alreadyConfirmed = false;

    if (!upcoming) {
      upcoming = await prisma.sesionesTratamiento.findFirst({
        where: {
          TratamientosContratados: {
            id_persona: patient.idPersona,
            estado_tratamiento: { in: ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso', 'En ejecución'] }
          },
          estado_asistencial: 'Pendiente',
          confirmacion_paciente: 'Confirmada',
          fecha_programada_vigente: { gt: new Date() }
        },
        include: {
          Sedes: true,
          TratamientosContratados: { include: { Servicios: true } }
        },
        orderBy: { fecha_programada_vigente: 'asc' }
      });
      if (upcoming) alreadyConfirmed = true;
    }

    if (!upcoming) return null;

    try {
      if (!alreadyConfirmed) {
        const principal = { role: 'PACIENTE' as const, idPersona: patient.idPersona };
        await CustomerCompletionService.confirmSession(principal, upcoming.id_sesion, true);
      }

      const { fechaStr, horaStr } = formatLimaDateTime(upcoming.fecha_programada_vigente);
      return [
        `✨ *¡Cita Confirmada con Éxito!* ✅`,
        ``,
        `¡Listo, *${patient.nombres}*! He confirmado tu asistencia en el sistema asistencial:`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `🦷 *Tratamiento:* ${upcoming.TratamientosContratados.Servicios?.nombre || 'Consulta Odontológica'}`,
        `📅 *Fecha:* ${fechaStr}`,
        `⏰ *Hora:* ${horaStr}`,
        `📍 *Sede:* ${upcoming.Sedes?.nombre || 'Sede Principal'}`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Te esperamos con gusto. ¡Que tengas un gran día!`
      ].join('\n');
    } catch {
      return null;
    }
  }

  /**
   * Recordatorio de reactivación para pacientes con sesiones pendientes de programar (ALT-C03).
   */
  static async sendUnscheduledPlanReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Tratamientos activos con plan vigente
    const activeTreatments = await prisma.tratamientosContratados.findMany({
      where: {
        estado_tratamiento: { in: ['Activado', 'En ejecución', 'Activo', 'En_Curso', 'En curso'] },
        Personas: {
          autoriza_contacto: true,
          numero: { not: null }
        }
      },
      include: {
        Personas: true,
        Servicios: true,
        PlanTratamiento: { where: { es_vigente: true }, take: 1 },
        SesionesTratamiento: {
          orderBy: { fecha_programada_vigente: 'desc' }
        }
      }
    });

    let sent = 0;

    for (const t of activeTreatments) {
      const plan = t.PlanTratamiento[0];
      if (!plan || t.SesionesTratamiento.length >= plan.sesiones_planificadas) continue;

      // Verificar si no tiene ninguna cita futura programada
      const hasFutureSession = t.SesionesTratamiento.some(s => s.fecha_programada_vigente > now && ['Programada', 'Confirmada'].includes(s.estado_programacion));
      if (hasFutureSession) continue;

      // Verificar si la última sesión fue hace más de 7 días
      const lastSession = t.SesionesTratamiento[0];
      if (lastSession && lastSession.fecha_programada_vigente > sevenDaysAgo) continue;

      const phone = t.Personas.numero;
      if (!phone) continue;

      const nextSessionNumber = t.SesionesTratamiento.length + 1;
      const message = [
        `🦷 *NEXOSALUD ODONTOLOGÍA · CONTINUIDAD DE TRATAMIENTO*`,
        `¡Hola *${t.Personas.nombres}*! Te saluda tu asistente dental de *NexoSalud*.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `Notamos que aún no has agendado la *Sesión ${nextSessionNumber}* de tu plan de *${t.Servicios?.nombre || 'Tratamiento Odontológico'}*.`,
        ``,
        `🩺 *¿Por qué es importante?*`,
        `Para consolidar la evolución clínica y evitar retrocesos en tu salud bucal, es fundamental mantener la frecuencia recomendada por tu especialista.`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `👉 *¿Deseas programar tu fecha ahora?*`,
        `Responde indicándome qué día y turno te acomoda mejor (ej. *"este sábado por la mañana"*) o ingresa a tu Portal del Paciente.`
      ].join('\n');

      const result = await WhatsAppClient.sendTextMessage(phone, message);
      if (result.success) sent++;
    }

    return { sent };
  }

  /**
   * Notifica al paciente por WhatsApp cuando Recepción aprueba y aplica su reprogramación en la agenda oficial.
   */
  static async notifyRescheduleApplied(params: {
    personId: number;
    sessionId: number;
    requestId: number;
    newDate: Date;
    reason?: string;
  }): Promise<void> {
    try {
      const person = await prisma.personas.findUnique({ where: { id_persona: params.personId } });
      if (!person?.numero) return;

      const session = await prisma.sesionesTratamiento.findUnique({
        where: { id_sesion: params.sessionId },
        include: {
          Profesionales: true,
          Sedes: true,
          TratamientosContratados: { include: { Servicios: true } }
        }
      });

      const { fechaStr, horaStr } = formatLimaDateTime(params.newDate);
      const doctorName = session?.Profesionales ? `Dr(a). ${session.Profesionales.nombres} ${session.Profesionales.apellidos}` : 'Especialista asignado';
      const serviceName = session?.TratamientosContratados?.Servicios?.nombre || 'Tratamiento Odontológico';
      const branchName = session?.Sedes?.nombre || 'Sede Principal';

      const message = [
        `🦷 *NEXOSALUD ODONTOLOGÍA · CITA CONFIRMADA*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `¡Hola *${person.nombres}*! Tu solicitud de reprogramación (#${params.requestId}) ha sido *aprobada y agendada oficialmente* por nuestro equipo de Recepción.`,
        ``,
        `📋 *Detalles de tu nueva cita:*`,
        `🦷 *Tratamiento:* ${serviceName} (Sesión #${session?.numero_sesion || 1})`,
        `📅 *Nueva Fecha:* ${fechaStr}`,
        `⏰ *Hora:* ${horaStr}`,
        `👨‍⚕️ *Profesional:* ${doctorName}`,
        `📍 *Sede:* ${branchName}`,
        `━━━━━━━━━━━━━━━━━━━`,
        ``,
        `✨ *Recomendación:* Por favor llega 10 minutos antes. ¡Te esperamos para continuar con el cuidado de tu sonrisa!`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `✨ _NexoSalud · Tu sonrisa en las mejores manos_`
      ].join('\n');

      await WhatsAppClient.sendTextMessage(person.numero, message);
      console.log(`[WhatsApp Adherence] Notificación de reprogramación aplicada despachada a ${person.numero}`);
    } catch (err) {
      console.error('[WhatsApp Adherence] Error enviando notificación de reprogramación aplicada:', err);
    }
  }

  /**
   * Notifica al paciente por WhatsApp cuando Recepción rechaza o cancela su solicitud de reprogramación,
   * permitiéndole continuar la conversación para coordinar otro horario.
   */
  static async notifyRescheduleRejected(params: {
    personId: number;
    sessionId: number;
    requestId: number;
    reason: string;
    originalDate: Date;
  }): Promise<void> {
    try {
      const person = await prisma.personas.findUnique({ where: { id_persona: params.personId } });
      if (!person?.numero) return;

      const session = await prisma.sesionesTratamiento.findUnique({
        where: { id_sesion: params.sessionId },
        include: {
          Profesionales: true,
          Sedes: true,
          TratamientosContratados: { include: { Servicios: true } }
        }
      });

      const { fechaStr, horaStr } = formatLimaDateTime(params.originalDate);
      const serviceName = session?.TratamientosContratados?.Servicios?.nombre || 'Tratamiento Odontológico';
      const doctorName = session?.Profesionales ? `Dr(a). ${session.Profesionales.nombres} ${session.Profesionales.apellidos}` : 'Especialista asignado';
      const branchName = session?.Sedes?.nombre || 'Sede Principal';

      const message = [
        `🦷 *NEXOSALUD ODONTOLOGÍA · SOLICITUD DE CITA*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `Hola *${person.nombres}*, te informamos sobre tu solicitud de reprogramación (#${params.requestId}) para la Sesión #${session?.numero_sesion || 1} de ${serviceName}:`,
        ``,
        `❌ *No fue posible aplicar el cambio solicitado.*`,
        `📝 *Motivo indicado por Recepción:* ${params.reason}`,
        ``,
        `ℹ️ *Tu cita actual se mantiene vigente:*`,
        `📅 ${fechaStr} a las ${horaStr}`,
        `👨‍⚕️ ${doctorName} · ${branchName}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `💡 *¿Deseas evaluar otro horario?*`,
        `Podemos buscar otra fecha u horario que se adapte mejor a tu agenda dentro de los turnos de atención. Por favor, indícame qué otro día te acomoda o responde a este mensaje para coordinar una nueva fecha.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━`,
        `✨ _NexoSalud · Tu sonrisa en las mejores manos_`
      ].join('\n');

      await WhatsAppClient.sendTextMessage(person.numero, message);
      console.log(`[WhatsApp Adherence] Notificación de reprogramación rechazada despachada a ${person.numero}`);
    } catch (err) {
      console.error('[WhatsApp Adherence] Error enviando notificación de reprogramación rechazada:', err);
    }
  }
}

export function startCustomerAdherenceScheduler(options: { runImmediately?: boolean } = {}) {
  if (process.env.WHATSAPP_ADHERENCE_SCHEDULER_ENABLED !== 'true') return;

  const intervalMs = Math.max(60000, Number(process.env.WHATSAPP_ADHERENCE_INTERVAL_MS) || 60 * 60 * 1000);
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await WhatsAppAdherenceService.sendUpcomingSessionReminders(24);
      await WhatsAppAdherenceService.sendUnscheduledPlanReminders();
    } catch (err) {
      console.error('[WhatsApp Adherence Scheduler] Error en ciclo:', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  if (options.runImmediately !== false) void tick();

  return { runNow: tick, stop: () => clearInterval(timer) };
}
