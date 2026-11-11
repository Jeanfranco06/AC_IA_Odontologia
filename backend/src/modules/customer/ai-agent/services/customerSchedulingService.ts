import { Prisma } from '@prisma/client';
import { AiAgentError } from '../types';

/** Thin CUSTOMER adapter over the existing, authoritative SQL Server scheduling procedure. */
export class CustomerSchedulingService {
  static async reprogramTreatmentSession(tx: Prisma.TransactionClient, input: {
    sessionId: number;
    originalDate: Date;
    newDate: Date;
    reason: string;
    userId: number;
    availabilityId: number;
  }) {
    const result = await tx.$queryRaw<Array<{ id_sesion: number; fecha_anterior: Date; fecha_nueva: Date }>>`
      EXEC dbo.usp_ReprogramarSesionTratamiento
        @id_sesion = ${input.sessionId},
        @nueva_fecha_programada = ${input.newDate},
        @motivo_reprogramacion = ${input.reason},
        @id_nuevo_profesional = NULL,
        @id_nueva_sede = NULL,
        @id_usuario_responsable = ${input.userId}
    `;
    const event = result[0];
    if (!event || event.id_sesion !== input.sessionId || event.fecha_anterior.getTime() !== input.originalDate.getTime() || event.fecha_nueva.getTime() !== input.newDate.getTime()) {
      throw new AiAgentError('CONFLICT', 'La sesión cambió antes de aplicar la reprogramación.');
    }
    const linked = await tx.sesionesTratamiento.updateMany({
      where: { id_sesion: input.sessionId, fecha_programada_vigente: input.newDate, estado_programacion: 'Reprogramada' },
      data: { id_disponibilidad: input.availabilityId },
    });
    if (linked.count !== 1) throw new AiAgentError('CONFLICT', 'No fue posible vincular el horario oficial a la sesión.');
    return event;
  }
}
