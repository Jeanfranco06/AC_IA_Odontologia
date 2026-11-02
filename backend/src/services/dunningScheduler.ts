import { prisma } from '../db';
import { sendPaymentNoticeOrConfirmation, generateBackendPdfBase64 } from '../routes/payer.routes';
import { appointmentMidnightInLima } from './appointmentPolicy';

export interface DunningCycleResult {
  timestamp: string;
  evaluatedReservations: number;
  stage1RemindersSent: number;
  stage2UrgenciesSent: number;
  stage3CancellationsProcessed: number;
  freedSlots: number;
  logs: Array<{
    reservationId: number;
    patientName: string;
    stage: 'ETAPA_1_PREVENTIVO' | 'ETAPA_2_URGENCIA' | 'ETAPA_3_CANCELACION' | 'SIN_ACCION';
    details: string;
    emailSent: boolean;
    emailRecipient?: string;
    sentAt?: string;
  }>;
}

// Historial en memoria de última ejecución para el panel de BI
let lastExecutionStats: DunningCycleResult | null = null;

/**
 * Función principal que ejecuta el ciclo de cobranza en 3 etapas:
 * - Etapa 1 (T - 48h antes del día de la cita): Recordatorio Preventivo cordial por correo con PDF.
 * - Etapa 2 (T - 24h antes del día de la cita): Alerta de Urgencia Clínica (aviso de liberación a las 23:59).
 * - Etapa 3 (T = 00:00 hrs del día de la cita): Cancelación automática, liberación de sillón y correo formal de expiración.
 */
export async function runDunningCycle(): Promise<DunningCycleResult> {
  const now = new Date();
  const logs: DunningCycleResult['logs'] = [];
  let stage1Count = 0;
  let stage2Count = 0;
  let stage3Count = 0;
  let freedCount = 0;

  try {
    // Buscar todas las reservas que no estén ya validadas
    const reservas = await prisma.reservas.findMany({
      include: {
        Persona: true,
        Solicitud: { include: { Servicio: { include: { Tarifas: { where: { activo: true }, orderBy: { fecha_inicio: 'desc' }, take: 1 } } } } },
        Opcion: {
          include: {
            Disponibilidad: {
              include: { Sede: true, Profesional: true }
            }
          }
        },
        Pagos: true,
        Incidencias: true
      }
    });

    for (const r of reservas) {
      const pago = r.Pagos.length > 0 ? r.Pagos[0] : null;
      // Un comprobante en revisión ya fue presentado; el pendiente aún requiere avisos.
      if (pago && ['Validado', 'VALIDADO', 'En_Revision', 'En revisión', 'En Revisión', 'EN_REVISION', 'IN_REVIEW'].includes(pago.estado)) {
        continue;
      }

      // Si la reserva ya fue cancelada o marcada como vencida previamente
      if (r.estado === 'Cancelada' || r.estado === 'Vencida') {
        continue;
      }

      // La fecha de reserva es el día de la compra, nunca el día de la cita.
      const apptDate = r.Opcion?.Disponibilidad?.fecha;
      if (!apptDate || isNaN(apptDate.getTime())) {
        continue;
      }

      // Inicio del día de la cita en Perú, independiente de la zona del servidor.
      const appointmentDayStart = appointmentMidnightInLima(apptDate);
      const hoursUntilMidnightDeadline = (appointmentDayStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      const patientName = `${r.Persona.nombres} ${r.Persona.apellidos}`;
      const patientEmail = r.Persona.email || '';
      const serviceName = r.Solicitud?.Servicio?.nombre || 'Consulta Odontológica Especializada';
      const originalPrice = r.Solicitud?.Servicio?.Tarifas[0] ? Number(r.Solicitud.Servicio.Tarifas[0].precio) : undefined;
      const branchName = r.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal';
      const professionalName = `Esp. ${r.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Torres'}`;
      const reservationDateStr = apptDate.toISOString().split('T')[0];
      const orderCode = `ORD-${String(r.id_reserva).padStart(5, '0')}-${apptDate.getUTCFullYear()}`;
      const reservationTimeStr = r.Opcion?.Disponibilidad?.hora_inicio
        ? r.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16)
        : '15:00';
      const amountToPay = Number(r.Opcion?.precio_ofrecido || 150.00);

      // Revisar si ya se enviaron notificaciones previas en Incidencias/Interacciones
      const sentStage1 = r.Incidencias.some(inc => inc.descripcion?.includes('NOTIFICACION_ETAPA_1_PREVENTIVA'));
      const sentStage2 = r.Incidencias.some(inc => inc.descripcion?.includes('NOTIFICACION_ETAPA_2_URGENCIA'));

      // =========================================================================
      // ETAPA 3: LLEGÓ A LAS 00:00 HRS DEL DÍA DE LA CITA (O YA PASÓ) SIN PAGO
      // =========================================================================
      if (hoursUntilMidnightDeadline <= 0) {
        // 1. Marcar reserva como Vencida
        await prisma.reservas.update({
          where: { id_reserva: r.id_reserva },
          data: { estado: 'Vencida' }
        });

        // 2. Liberar el sillón (Disponibilidad -> Disponible)
        if (r.Opcion?.Disponibilidad?.id_disponibilidad) {
          await prisma.disponibilidad.update({
            where: { id_disponibilidad: r.Opcion.Disponibilidad.id_disponibilidad },
            data: { estado: 'Disponible' }
          });
          freedCount++;
        }

        // 3. Registrar incidencia de auditoría
        try {
          await prisma.incidencias.create({
            data: {
              id_persona: r.id_persona,
              id_reserva: r.id_reserva,
              tipo: 'AUTO_CANCELACION',
              descripcion: `ETAPA_3_CANCELACION: Plazo límite de abono expirado (00:00 hrs del ${reservationDateStr}). Sillón liberado automáticamente.`,
              estado: 'CLOSED'
            }
          });
        } catch (e) {
          console.warn('⚠️ No se pudo registrar incidencia de dunning:', e);
        }

        // 4. Enviar correo formal de cancelación
        let emailSent = false;
        if (patientEmail) {
          const cancelHtmlMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Le informamos que su cita programada para el día <strong>${reservationDateStr}</strong> a las <strong>${reservationTimeStr} hrs</strong> con el <strong>${professionalName}</strong> en nuestra <strong>${branchName}</strong> ha sido <strong>CANCELADA AUTOMÁTICAMENTE</strong> por nuestro sistema al no registrarse el abono correspondiente antes del plazo límite (00:00 hrs del día de hoy).<br/><br/>
            El sillón odontológico ha sido puesto a disposición de otros pacientes en lista de espera.<br/><br/>
            Si desea reagendar una nueva fecha de atención, por favor contáctenos a nuestra central de atención o ingrese a nuestro portal.
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `Aviso de Cancelación de Cita Odontológica - NexoSalud (${reservationDateStr})`,
            message: cancelHtmlMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            includePdf: false
          });
          emailSent = emailRes.success;
        }

        stage3Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_3_CANCELACION',
          details: `Cita cancelada a las 00:00 hrs. Sillón liberado para reasignación.`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // =========================================================================
      // ETAPA 2: FALTAN ENTRE 0h Y 24h PARA LAS 00:00 (DÍA ANTERIOR A LA CITA)
      // =========================================================================
      if (hoursUntilMidnightDeadline <= 24 && hoursUntilMidnightDeadline > 0 && !sentStage2) {
        let emailSent = false;
        if (patientEmail) {
          const urgencyMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Le informamos que el sillón odontológico para su cita de <strong>${serviceName}</strong> con el <strong>${professionalName}</strong> programada para mañana <strong>${reservationDateStr} (${reservationTimeStr} hrs)</strong> se encuentra en <strong>RESERVA TEMPORAL</strong>.<br/><br/>
            Para evitar que el sistema libere automáticamente su cupo a las <strong>00:00 horas</strong> a otro paciente en espera, por favor confirme su abono de <strong>S/ ${amountToPay.toFixed(2)}</strong> hoy mediante Yape o transferencia bancaria.<br/><br/>
            Adjunto encontrará su Orden de Pago con el importe pendiente.
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `⚠️ URGENTE: Confirmación Requerida para su Cita de Mañana - NexoSalud`,
            message: urgencyMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            code: orderCode
          });
          emailSent = emailRes.success;
        }

        await prisma.incidencias.create({
          data: {
            id_persona: r.id_persona,
            id_reserva: r.id_reserva,
            tipo: 'DUNNING_URGENCY',
            descripcion: `NOTIFICACION_ETAPA_2_URGENCIA: Alerta de vencimiento a medianoche enviada a ${patientEmail}.`,
            estado: 'OPEN'
          }
        });

        stage2Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_2_URGENCIA',
          details: `Alerta de urgencia (vencimiento hoy a las 23:59) enviada por correo.`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // =========================================================================
      // ETAPA 1: FALTAN ENTRE 24h Y 48h PARA LAS 00:00 (2 DÍAS ANTES DE LA CITA)
      // =========================================================================
      if (hoursUntilMidnightDeadline <= 48 && hoursUntilMidnightDeadline > 24 && !sentStage1) {
        let emailSent = false;
        if (patientEmail) {
          const friendlyMessage = `
            Estimado(a) <strong>${patientName}</strong>,<br/><br/>
            Esperamos que se encuentre muy bien. Le saludamos cordialmente de la Clínica Odontológica NexoSalud.<br/><br/>
            Le recordamos que tiene una cita programada de <strong>${serviceName}</strong> con el <strong>${professionalName}</strong> para el día <strong>${reservationDateStr}</strong> a las <strong>${reservationTimeStr} hrs</strong> en nuestra <strong>${branchName}</strong>.<br/><br/>
            Para garantizar la reserva de su horario y la preparación de los insumos clínicos, puede regularizar su abono de <strong>S/ ${amountToPay.toFixed(2)}</strong> a través de nuestros canales oficiales (Yape o Transferencia).<br/><br/>
            Adjunto encontrará su Orden de Pago en PDF. ¡Quedamos atentos para recibirle!
          `;

          const emailRes = await sendPaymentNoticeOrConfirmation({
            toEmail: patientEmail,
            patientName,
            documentNumber: r.Persona.dni,
            phone: r.Persona.numero,
            subject: `Recordatorio Preventivo de Cita Odontológica - NexoSalud (${reservationDateStr})`,
            message: friendlyMessage,
            amount: amountToPay,
            originalPrice,
            serviceName,
            reservationDate: reservationDateStr,
            reservationTime: reservationTimeStr,
            branch: branchName,
            professional: professionalName,
            isValidated: false,
            code: orderCode
          });
          emailSent = emailRes.success;
        }

        await prisma.incidencias.create({
          data: {
            id_persona: r.id_persona,
            id_reserva: r.id_reserva,
            tipo: 'DUNNING_REMINDER',
            descripcion: `NOTIFICACION_ETAPA_1_PREVENTIVA: Recordatorio cordial enviado a ${patientEmail}.`,
            estado: 'OPEN'
          }
        });

        stage1Count++;
        logs.push({
          reservationId: r.id_reserva,
          patientName,
          stage: 'ETAPA_1_PREVENTIVO',
          details: `Recordatorio preventivo (T-48h) enviado por correo.`,
          emailSent,
          emailRecipient: patientEmail,
          sentAt: now.toISOString()
        });
        continue;
      }

      // Sin acción requerida en este ciclo
      logs.push({
        reservationId: r.id_reserva,
        patientName,
        stage: 'SIN_ACCION',
        details: `Cita para ${reservationDateStr} (${hoursUntilMidnightDeadline.toFixed(1)}h restantes). Dentro del margen regular.`,
        emailSent: false,
        sentAt: now.toISOString()
      });
    }

    const result: DunningCycleResult = {
      timestamp: now.toISOString(),
      evaluatedReservations: reservas.length,
      stage1RemindersSent: stage1Count,
      stage2UrgenciesSent: stage2Count,
      stage3CancellationsProcessed: stage3Count,
      freedSlots: freedCount,
      logs
    };

    lastExecutionStats = result;
    return result;
  } catch (error: any) {
    console.error('Error ejecutando ciclo de dunning:', error);
    throw error;
  }
}

export function getLastExecutionStats(): DunningCycleResult | null {
  return lastExecutionStats;
}

/**
 * Inicia el cron de cobranza automática periódica (cada 15 minutos y a medianoche)
 */
export function startDunningScheduler() {
  if (process.env.DUNNING_ENABLED?.trim().toLowerCase() === 'false') {
    console.log('[Dunning Scheduler] Desactivado por configuracion local (DUNNING_ENABLED=false).');
    return;
  }

  console.log('⚡ [Dunning Scheduler] Inicializando motor de cobranza automática en 3 etapas...');

  // Ejecutar un ciclo inicial al arrancar el servidor
  runDunningCycle()
    .then(stats => {
      console.log(`✅ [Dunning Scheduler] Ciclo inicial completado: ${stats.evaluatedReservations} evaluadas, ${stats.stage1RemindersSent} preventivas, ${stats.stage2UrgenciesSent} urgencias, ${stats.stage3CancellationsProcessed} canceladas.`);
    })
    .catch(err => {
      console.error('❌ [Dunning Scheduler] Error en ciclo inicial:', err);
    });

  // Ejecutar cada 15 minutos (900,000 ms)
  const INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('⏰ [Dunning Scheduler] Ejecutando escaneo periódico de reservas y vencimientos...');
      const stats = await runDunningCycle();
      console.log(`✅ [Dunning Scheduler] Ciclo periódico finalizado: ${stats.stage3CancellationsProcessed} canceladas, ${stats.freedSlots} sillones liberados.`);
    } catch (err) {
      console.error('❌ [Dunning Scheduler] Error en ciclo periódico:', err);
    }
  }, INTERVAL_MS);
}

