import { AftercareCardService } from './aftercareCardService';
import { WhatsAppClient } from '../../whatsapp/services/whatsappClient';

interface ScheduledJob {
  attentionId: number;
  scheduledFor: Date;
  timer: NodeJS.Timeout;
}

export class AftercareSchedulerService {
  private static scheduledJobs = new Map<number, ScheduledJob>();

  /**
   * Programa el envío de la tarjeta de cuidados post-atención para una atención clínica.
   * Por defecto se envía 1 hora (60 minutos) después de completada la atención,
   * o configurable vía AFTERCARE_DELAY_MINUTES.
   */
  static scheduleAftercareDelivery(
    attentionId: number,
    options?: { delayMinutes?: number; immediate?: boolean }
  ): { scheduled: boolean; scheduledFor: Date; delayMinutes: number } {
    const existing = this.scheduledJobs.get(attentionId);
    if (existing) {
      clearTimeout(existing.timer);
      this.scheduledJobs.delete(attentionId);
    }

    const defaultMinutes = parseInt(process.env.AFTERCARE_DELAY_MINUTES || '60', 10);
    const delayMinutes = options?.immediate ? 0 : (options?.delayMinutes ?? defaultMinutes);
    const delayMs = delayMinutes * 60 * 1000;
    const scheduledFor = new Date(Date.now() + delayMs);

    if (delayMs <= 0) {
      // Envío inmediato asíncrono
      void this.dispatchNow(attentionId);
      return { scheduled: true, scheduledFor: new Date(), delayMinutes: 0 };
    }

    console.log(`[Aftercare Scheduler] Atención #${attentionId} programada para envío de tarjeta gráfica en ${delayMinutes} minutos (${scheduledFor.toISOString()}).`);

    const timer = setTimeout(() => {
      this.scheduledJobs.delete(attentionId);
      void this.dispatchNow(attentionId);
    }, delayMs);

    // Evitar que el timer impida cerrar node si se apaga limpiamente
    if (timer.unref) {
      timer.unref();
    }

    this.scheduledJobs.set(attentionId, { attentionId, scheduledFor, timer });

    return { scheduled: true, scheduledFor, delayMinutes };
  }

  /**
   * Ejecuta el envío inmediato de la tarjeta post-atención a WhatsApp.
   */
  static async dispatchNow(attentionId: number): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Aftercare Scheduler] Generando tarjeta gráfica post-atención para #${attentionId}...`);
      const card = await AftercareCardService.generateCard(attentionId);

      if (!card.patientPhone) {
        console.warn(`[Aftercare Scheduler] Atención #${attentionId} no tiene teléfono del paciente; no se puede enviar por WhatsApp.`);
        return { success: false, error: 'Paciente sin teléfono registrado' };
      }

      const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://frisk-wriggle-duly.ngrok-free.dev';
      const fallbackUrl = `${publicBaseUrl}/api/customer/ai-agent/media/aftercare/${attentionId}.png`;

      const caption = `🦷 *Guía de Cuidados Post-Atención*\n\nHola ${card.patientName}, adjuntamos tu tarjeta gráfica oficial con las indicaciones aprobadas por ${card.doctorName} tras tu atención de *${card.procedure}* en *NexoSalud*.\n\nPor favor sigue estas recomendaciones para tu óptima recuperación. Ante cualquier molestia o duda, puedes escribirnos por este canal o llamarnos al *(01) 234-5678*. ¡Estamos para cuidarte!`;

      console.log(`[Aftercare Scheduler] Despachando imagen a WhatsApp (${card.patientPhone})...`);
      const result = await WhatsAppClient.sendImageBuffer(
        card.patientPhone,
        card.buffer,
        card.filename,
        'image/png',
        caption,
        fallbackUrl
      );

      if (result.success) {
        console.log(`✅ [Aftercare Scheduler] Tarjeta post-atención entregada exitosamente al paciente ${card.patientName} (${card.patientPhone}). Message ID: ${result.messageId}`);
      } else {
        console.error(`❌ [Aftercare Scheduler] Error al enviar tarjeta post-atención a WhatsApp:`, result.error);
      }

      return result;
    } catch (err: any) {
      console.error(`❌ [Aftercare Scheduler] Excepción durante el despacho de la atención #${attentionId}:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Retorna el estado de tareas programadas
   */
  static getPendingDeliveries() {
    return Array.from(this.scheduledJobs.values()).map(job => ({
      attentionId: job.attentionId,
      scheduledFor: job.scheduledFor
    }));
  }
}
