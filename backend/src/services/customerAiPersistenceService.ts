import { prisma, withRetry } from '../db';

export interface RegistrarInteraccionParams {
  idPersona: number;
  actorOrientado: 'PACIENTE' | 'ODONTOLOGO';
  tipoEvento: string;
  resumenConsulta: string;
  resultado?: string;
  idProfesional?: number | null;
  idTratamiento?: number | null;
  idSesion?: number | null;
  idAtencion?: number | null;
  idCorrelacion?: string | null;
  versionAgente?: string;
}

export interface RegistrarAlertaParams {
  idPersona: number;
  tipoEvento: string;
  mensajeAlerta: string;
  severidad?: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  idInteraccionOrigen?: number | null;
  idProfesional?: number | null;
  idTratamiento?: number | null;
  idSesion?: number | null;
  idAtencion?: number | null;
  versionAgente?: string;
}

export interface AtenderAlertaParams {
  idAlerta: number;
  idUsuarioRevisor?: number | null;
  idProfesionalRevisor?: number | null;
  resultado: string;
  estado?: 'Atendida' | 'Resuelta' | 'Descartada_Justificada' | 'En_Revision';
  estadoAnterior?: string;
}

export interface RegistrarBorradorParams {
  idPersona: number;
  idProfesional: number;
  idAtencion: number;
  contenidoSugerido: string;
  tipoEvento?: string;
  idInteraccionOrigen?: number | null;
  idTratamiento?: number | null;
  idSesion?: number | null;
  idBorradorRaiz?: number | null;
  versionBorrador?: number;
  versionAgente?: string;
  claveIdempotencia?: string | null;
  eventoAuditoria?: { actorOrientado: 'PACIENTE' | 'ODONTOLOGO'; idUsuario?: number | null; idCorrelacion: string; tipoEvento: string; resultado: string };
}

export interface AprobarBorradorParams {
  idBorrador: number;
  idProfesionalAprobador: number;
  idUsuarioRevisor?: number | null;
  resultado?: string;
  corregido?: boolean;
}

export interface RechazarBorradorParams {
  idBorrador: number;
  idProfesionalRevisor: number;
  motivoRechazo: string;
}

export class CustomerAiPersistenceService {
  /**
   * P02 & P03: Registra una interacción significativa del usuario con el agente
   * Valida integridad referencial estricta: persona, tratamiento, sesión y atención.
   */
  static async registrarInteraccion(params: RegistrarInteraccionParams) {
    return await withRetry(async () => {
      // 1. Validar que la persona existe
      const persona = await prisma.personas.findUnique({
        where: { id_persona: params.idPersona },
        select: { id_persona: true },
      });
      if (!persona) {
        throw new Error(`Referencia inválida: la persona ${params.idPersona} no existe.`);
      }

      // 2. Si se especifica tratamiento, validar existencia y coincidencia con la persona
      if (params.idTratamiento) {
        const tratamiento = await prisma.tratamientosContratados.findUnique({
          where: { id_tratamiento: params.idTratamiento },
          select: { id_tratamiento: true, id_persona: true },
        });
        if (!tratamiento) {
          throw new Error(`Referencia inválida: el tratamiento ${params.idTratamiento} no existe.`);
        }
        if (tratamiento.id_persona !== params.idPersona) {
          throw new Error(`Violación de seguridad: el tratamiento ${params.idTratamiento} no pertenece al paciente ${params.idPersona}.`);
        }
      }

      // 3. Si se especifica sesión, validar existencia y coherencia con el tratamiento
      if (params.idSesion) {
        const sesion = await prisma.sesionesTratamiento.findUnique({
          where: { id_sesion: params.idSesion },
          select: { id_sesion: true, id_tratamiento: true },
        });
        if (!sesion) {
          throw new Error(`Referencia inválida: la sesión ${params.idSesion} no existe.`);
        }
        if (params.idTratamiento && sesion.id_tratamiento !== params.idTratamiento) {
          throw new Error(`Inconsistencia clínica: la sesión ${params.idSesion} no pertenece al tratamiento ${params.idTratamiento}.`);
        }
      }

      // 4. Si se especifica atención, validar existencia y pertenencia
      if (params.idAtencion) {
        const atencion = await prisma.atenciones.findUnique({
          where: { id_atencion: params.idAtencion },
          select: { id_atencion: true, id_persona: true },
        });
        if (!atencion) {
          throw new Error(`Referencia inválida: la atención ${params.idAtencion} no existe.`);
        }
        if (atencion.id_persona !== params.idPersona) {
          throw new Error(`Violación de seguridad: la atención ${params.idAtencion} no pertenece al paciente ${params.idPersona}.`);
        }
      }

      // 5. Inserción auditada
      return await prisma.interaccionesIA.create({
        data: {
          id_persona: params.idPersona,
          actor_orientado: params.actorOrientado,
          tipo_evento: params.tipoEvento,
          resumen_consulta: params.resumenConsulta,
          resultado: params.resultado || 'Completada satisfactoriamente',
          id_profesional: params.idProfesional || null,
          id_tratamiento: params.idTratamiento || null,
          id_sesion: params.idSesion || null,
          id_atencion: params.idAtencion || null,
          id_correlacion: params.idCorrelacion || null,
          version_agente: params.versionAgente || 'CopilotoOdonto-v1.0',
          estado: 'Completada',
          requiere_revision_humana: false,
          es_diagnostico_o_prescripcion: false,
        },
      });
    });
  }

  /**
   * P04: Crea una alerta de IA asociada a una interacción o evento clínico
   */
  static async registrarAlerta(params: RegistrarAlertaParams) {
    return await withRetry(async () => {
      // 1. Validar que la persona existe
      const persona = await prisma.personas.findUnique({
        where: { id_persona: params.idPersona },
        select: { id_persona: true },
      });
      if (!persona) {
        throw new Error(`Referencia inválida: la persona ${params.idPersona} no existe.`);
      }

      // 2. Si hay interacción origen, verificar que existe
      if (params.idInteraccionOrigen) {
        const interaccion = await prisma.interaccionesIA.findUnique({
          where: { id_interaccion_ia: params.idInteraccionOrigen },
          select: { id_interaccion_ia: true },
        });
        if (!interaccion) {
          throw new Error(`Referencia inválida: la interacción de origen ${params.idInteraccionOrigen} no existe.`);
        }
      }

      return await prisma.alertasIA.create({
        data: {
          id_persona: params.idPersona,
          id_interaccion_origen: params.idInteraccionOrigen || null,
          tipo_evento: params.tipoEvento,
          mensaje_alerta: params.mensajeAlerta,
          severidad: params.severidad || 'Media',
          id_profesional: params.idProfesional || null,
          id_tratamiento: params.idTratamiento || null,
          id_sesion: params.idSesion || null,
          id_atencion: params.idAtencion || null,
          version_agente: params.versionAgente || 'CopilotoOdonto-v1.0',
          estado: 'Generada',
          requiere_revision_humana: true,
        },
      });
    });
  }

  /**
   * P05: Revisa o atiende una alerta sin marcarla automáticamente como resuelta a menos que se indique explícitamente.
   * Exige evidencia de un profesional u operador clínico con fecha.
   */
  static async atenderAlerta(params: AtenderAlertaParams) {
    return await withRetry(async () => {
      const nuevoEstado = params.estado || 'En_Revision';

      // Si el estado pasa a Atendida o Descartada_Justificada, SQL Server CK_AlertasIA_EvidenciaAtencion
      // exige id_profesional_revisor o id_usuario_revisor Y fecha_atencion_alerta
      const fechaAtencion = (nuevoEstado === 'Atendida' || nuevoEstado === 'Resuelta' || nuevoEstado === 'Descartada_Justificada')
        ? new Date()
        : null;

      if ((nuevoEstado === 'Atendida' || nuevoEstado === 'Resuelta' || nuevoEstado === 'Descartada_Justificada') && !params.idProfesionalRevisor && !params.idUsuarioRevisor) {
        throw new Error('Seguridad clínica: no se puede marcar una alerta como atendida o descartada sin evidencia del profesional o usuario revisor.');
      }

      return prisma.$transaction(async tx => {
        const alerta = await tx.alertasIA.findUnique({ where: { id_alerta_ia: params.idAlerta } });
        if (!alerta) throw new Error(`Alerta ${params.idAlerta} no encontrada.`);
        const previousState = params.estadoAnterior || alerta.estado;
        if (alerta.estado !== previousState) throw new Error('La alerta cambió durante la revisión.');
        const updated = await tx.alertasIA.updateMany({
          where: { id_alerta_ia: params.idAlerta, estado: previousState },
          data: {
            estado: nuevoEstado,
            resultado: params.resultado,
            id_usuario_revisor: params.idUsuarioRevisor || null,
            id_profesional_revisor: params.idProfesionalRevisor || null,
            fecha_atencion_alerta: fechaAtencion,
            ...(nuevoEstado === 'Resuelta' ? { clave_deduplicacion: null } : {}),
          },
        });
        if (updated.count !== 1) throw new Error('La alerta cambió durante la revisión.');
        await tx.interaccionesIA.create({ data: { id_persona: alerta.id_persona, id_profesional: params.idProfesionalRevisor || null, id_usuario_revisor: params.idUsuarioRevisor || null, id_tratamiento: alerta.id_tratamiento, id_sesion: alerta.id_sesion, id_atencion: alerta.id_atencion, actor_orientado: params.idProfesionalRevisor ? 'ODONTOLOGO' : 'PACIENTE', tipo_evento: `REVISION_${alerta.tipo_evento}`, resumen_consulta: `Alerta ${alerta.id_alerta_ia}: ${previousState} a ${nuevoEstado}`.slice(0, 300), resultado: params.resultado.slice(0, 200), id_correlacion: alerta.id_correlacion, version_agente: alerta.version_agente } });
        return tx.alertasIA.findUniqueOrThrow({ where: { id_alerta_ia: params.idAlerta } });
      }, { isolationLevel: 'Serializable' });
    });
  }

  /**
   * P06, P09: Registra una propuesta documental borrador generada por el agente
   * Si es una versión subsiguiente, vincula al id_borrador_raiz y marca la versión previa.
   */
  static async registrarBorrador(params: RegistrarBorradorParams) {
    return await withRetry(async () => prisma.$transaction(async tx => {
      // Validar atención obligatoria
      const atencion = await tx.atenciones.findUnique({
        where: { id_atencion: params.idAtencion },
        select: { id_atencion: true, id_persona: true, id_profesional: true },
      });
      if (!atencion) {
        throw new Error(`Referencia inválida: la atención ${params.idAtencion} no existe.`);
      }
      if (atencion.id_persona !== params.idPersona) throw new Error('La atención no pertenece al paciente indicado.');

      // Validar profesional existente
      const profesional = await tx.profesionales.findUnique({
        where: { id_profesional: params.idProfesional },
        select: { id_profesional: true, activo: true },
      });
      if (!profesional || !profesional.activo) {
        throw new Error(`Profesional inválido o inactivo: ${params.idProfesional}`);
      }

      const version = params.versionBorrador || 1;
      let raizId = params.idBorradorRaiz || null;

      if (params.eventoAuditoria) {
        const audit = await tx.interaccionesIA.create({ data: { id_persona: params.idPersona, id_profesional: params.idProfesional, id_usuario_revisor: params.eventoAuditoria.idUsuario || null, id_tratamiento: params.idTratamiento || null, id_sesion: params.idSesion || null, id_atencion: params.idAtencion, actor_orientado: params.eventoAuditoria.actorOrientado, tipo_evento: params.eventoAuditoria.tipoEvento, resumen_consulta: 'Acción documental supervisada', resultado: params.eventoAuditoria.resultado.slice(0, 200), id_correlacion: params.eventoAuditoria.idCorrelacion, version_agente: params.versionAgente || 'CopilotoOdonto-v1.0' } });
        params.idInteraccionOrigen = audit.id_interaccion_ia;
      }

      // Si se crea una nueva versión de una raíz existente, desmarcar versiones previas como actual
      if (raizId) {
        const current = await tx.borradoresIA.findFirst({ where: { OR: [{ id_borrador_ia: raizId }, { id_borrador_raiz: raizId }], es_version_actual: true }, orderBy: { version_borrador: 'desc' } });
        if (!current || ['Aprobado', 'Corregido_Y_Aprobado'].includes(current.estado) || version !== current.version_borrador + 1) throw new Error('La raíz cambió o ya no admite una revisión nueva.');
        const changed = await tx.borradoresIA.updateMany({
          where: {
            OR: [
              { id_borrador_ia: raizId },
              { id_borrador_raiz: raizId },
            ],
            es_version_actual: true,
          },
          data: { es_version_actual: false },
        });
        if (changed.count !== 1) throw new Error('La versión vigente cambió durante la revisión.');
      }

      const nuevoBorrador = await tx.borradoresIA.create({
        data: {
          id_persona: params.idPersona,
          id_profesional: params.idProfesional,
          id_atencion: params.idAtencion,
          id_interaccion_origen: params.idInteraccionOrigen || null,
          clave_idempotencia: params.claveIdempotencia || null,
          id_tratamiento: params.idTratamiento || null,
          id_sesion: params.idSesion || null,
          id_borrador_raiz: raizId,
          version_borrador: version,
          es_version_actual: true,
          tipo_evento: params.tipoEvento || 'BORRADOR_INDICACIONES_POSTATENCION',
          contenido_sugerido: params.contenidoSugerido,
          estado: 'Generado',
          requiere_revision_humana: true,
          version_agente: params.versionAgente || 'CopilotoOdonto-v1.0',
        },
      });

      // Si no tenía raíz (era versión 1), su propia ID se establece como raíz
      if (!raizId) {
        return await tx.borradoresIA.update({
          where: { id_borrador_ia: nuevoBorrador.id_borrador_ia },
          data: { id_borrador_raiz: nuevoBorrador.id_borrador_ia },
        });
      }

      return nuevoBorrador;
    }, { isolationLevel: 'Serializable' }));
  }

  /**
   * P06 & P07: Aprobación obligatoria por profesional colegiado activo.
   * Un usuario no profesional (ej. paciente o staff sin colegiatura) es rechazado.
   */
  static async aprobarBorrador(params: AprobarBorradorParams) {
    return await withRetry(async () => {
      // Validar que el profesional aprobador existe y está habilitado
      const profesional = await prisma.profesionales.findUnique({
        where: { id_profesional: params.idProfesionalAprobador },
        select: { id_profesional: true, activo: true, numero_colegiatura: true },
      });

      if (!profesional || !profesional.activo || !profesional.numero_colegiatura) {
        throw new Error(`Permiso denegado: el usuario no es un odontólogo colegiado activo (ID: ${params.idProfesionalAprobador}).`);
      }

      const borrador = await prisma.borradoresIA.findUnique({
        where: { id_borrador_ia: params.idBorrador },
      });

      if (!borrador) {
        throw new Error(`Borrador ${params.idBorrador} no encontrado.`);
      }

      if (borrador.estado === 'Aprobado' || borrador.estado === 'Corregido_Y_Aprobado') {
        throw new Error(`El borrador ${params.idBorrador} ya ha sido aprobado.`);
      }

      const estadoFinal = params.corregido ? 'Corregido_Y_Aprobado' : 'Aprobado';

      return await prisma.borradoresIA.update({
        where: { id_borrador_ia: params.idBorrador },
        data: {
          estado: estadoFinal,
          resultado: params.resultado || (params.corregido ? 'Aprobado con correcciones por odontólogo' : 'Aprobado formalmente por odontólogo tratante'),
          id_profesional_aprobador: params.idProfesionalAprobador,
          id_usuario_revisor: params.idUsuarioRevisor || null,
          fecha_aprobacion: new Date(),
        },
      });
    });
  }

  /**
   * Rechazo motivado de un borrador por odontólogo
   */
  static async rechazarBorrador(params: RechazarBorradorParams) {
    return await withRetry(async () => {
      const borrador = await prisma.borradoresIA.findUnique({
        where: { id_borrador_ia: params.idBorrador },
      });
      if (!borrador) {
        throw new Error(`Borrador ${params.idBorrador} no encontrado.`);
      }

      return await prisma.borradoresIA.update({
        where: { id_borrador_ia: params.idBorrador },
        data: {
          estado: 'Rechazado',
          resultado: `Rechazado: ${params.motivoRechazo}`,
          id_profesional_aprobador: params.idProfesionalRevisor,
          fecha_aprobacion: new Date(),
        },
      });
    });
  }

  /**
   * P08: Consulta segura y autorizada del expediente de un paciente.
   * Evita que un paciente consulte datos o tratamientos de otro paciente.
   */
  static async consultarHistorialPacienteAutorizado(solicitante: { rol: 'PACIENTE' | 'ODONTOLOGO' | 'ADMIN'; idPersona?: number }, targetPersonaId: number) {
    return await withRetry(async () => {
      // Si el solicitante es paciente, solo puede consultar su propia información
      if (solicitante.rol === 'PACIENTE' && solicitante.idPersona !== targetPersonaId) {
        throw new Error(`Acceso denegado: el paciente ${solicitante.idPersona} no está autorizado a ver información del paciente ${targetPersonaId}.`);
      }

      // Retorna tratamientos, sesiones y atenciones asociadas
      return await prisma.personas.findUnique({
        where: { id_persona: targetPersonaId },
        select: {
          id_persona: true,
          nombres: true,
          apellidos: true,
          TratamientosContratados: {
            select: {
              id_tratamiento: true,
              estado_tratamiento: true,
              fecha_contratacion: true,
              Servicios: { select: { nombre: true } },
              SesionesTratamiento: {
                select: {
                  id_sesion: true,
                  numero_sesion: true,
                  estado_programacion: true,
                  estado_asistencial: true,
                  estado_cierre: true,
                  fecha_programada_vigente: true,
                },
              },
            },
          },
          InteraccionesIA: {
            select: {
              id_interaccion_ia: true,
              tipo_evento: true,
              fecha_hora: true,
              resumen_consulta: true,
              estado: true,
            },
          },
        },
      });
    });
  }

  /**
   * P09: Métricas auditadas sin duplicaciones de borradores ni interacciones
   */
  static async obtenerMetricasIA() {
    return await withRetry(async () => {
      // 1. interacciones_registradas: total de interacciones significativas
      const interacciones_registradas = await prisma.interaccionesIA.count();

      // 2. alertas_generadas: total de alertas únicas creadas
      const alertas_generadas = await prisma.alertasIA.count();

      // 3. alertas_atendidas: alertas que recibieron revisión o gestión válida
      const alertas_atendidas = await prisma.alertasIA.count({
        where: {
          estado: { in: ['Atendida', 'Descartada_Justificada'] },
        },
      });

      // 4. borradores_generados: contamos borradores raíces únicos para evitar duplicar versiones
      // Un borrador raíz representa la propuesta documental única sin importar cuántas versiones tenga
      const borradores_generados_agrupados = await prisma.borradoresIA.groupBy({
        by: ['id_borrador_raiz'],
        where: {
          id_borrador_raiz: { not: null },
        },
      });
      const borradores_generados = borradores_generados_agrupados.length;

      // 5. borradores_aprobados: borradores raíces que alcanzaron aprobación en su versión actual
      const borradores_aprobados_agrupados = await prisma.borradoresIA.groupBy({
        by: ['id_borrador_raiz'],
        where: {
          id_borrador_raiz: { not: null },
          estado: { in: ['Aprobado', 'Corregido_Y_Aprobado'] },
        },
      });
      const borradores_aprobados = borradores_aprobados_agrupados.length;

      return {
        interacciones_registradas,
        alertas_generadas,
        alertas_atendidas,
        borradores_generados,
        borradores_aprobados,
      };
    });
  }
}
