import { Router, Request, Response, NextFunction } from 'express';
import { aiAgentAuth, principalOf } from '../modules/customer/ai-agent/authContext';
import { AiAgentError } from '../modules/customer/ai-agent/types';
import { Prisma, type Atenciones, type Reservas } from '@prisma/client';
import { prisma } from '../db';
import { patientAuthService } from '../services/patientAuthService';

const router = Router();
router.use(aiAgentAuth);
router.use((req, res, next) => {
  if (req.method !== 'GET' && /\/(close|finish-attention|convert-turned|state)$/.test(req.path)) {
    res.status(409).json({ error: 'Use el flujo clínico delimitado con validación de política y confirmación profesional.' }); return;
  }
  next();
});
// Estas respuestas históricas incluyen el expediente completo, no una proyección operativa.
// Mantenerlas restringidas hasta disponer de contratos con alcance por recurso y rol.
router.use((req, _res, next) => {
  if (principalOf(req).role !== 'ADMIN') return next(new AiAgentError('FORBIDDEN', 'El expediente histórico completo requiere administración; utilice el espacio autorizado del agente.'));
  next();
});

const customerInclude = Prisma.validator<Prisma.PersonasInclude>()({
  Etapa: true,
  SaludOdontologica: true,
  Reservas: {
    orderBy: { id_reserva: 'desc' as const },
    take: 1,
    include: {
      Solicitud: { include: { Servicio: true } },
      Opcion: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } },
    },
  },
  Atenciones: { 
    orderBy: { id_atencion: 'desc' as const },
    include: {
      IndicacionesPostatencion: { orderBy: { fecha_emision: 'desc' as const } }
    }
  },
  Incidencias: { orderBy: { fecha_registro: 'desc' as const } },
  TratamientosContratados: {
    orderBy: { id_tratamiento: 'desc' as const },
    take: 1,
    include: {
      Servicios: true,
      Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: true,
      Sedes: true,
      PlanTratamiento: {
        where: { es_vigente: true },
        include: {
          Profesionales: true,
        }
      },
      SesionesTratamiento: {
        orderBy: { numero_sesion: 'asc' as const },
        include: {
          Profesionales: true,
          Sedes: true,
          Atenciones: {
            include: {
              IndicacionesPostatencion: { orderBy: { fecha_emision: 'desc' as const } }
            }
          }
        }
      }
    }
  }
});

type CustomerPerson = Prisma.PersonasGetPayload<{ include: typeof customerInclude }>;

function parseLegacyObservations(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return { observations: value };
  }
}

function clinicalState(attention?: Atenciones | null, reservation?: Reservas | null) {
  if (attention?.estado_servicio === 'Cancelado' || reservation?.estado === 'Cancelada') return 'CANCELED';
  if (attention?.asistencia === 'No asiste') return 'NO_SHOW';
  if (attention?.estado_servicio === 'Finalizado') return 'ATTENDED';
  if (attention?.estado_servicio === 'En curso') return 'IN_ATTENTION';
  if (attention?.asistencia === 'Confirmada') return 'ATTENDANCE_CONFIRMED';
  return 'SCHEDULED';
}

function serializeCustomer(person: CustomerPerson) {
  const reservation = person.Reservas[0] || null;
  const attention = person.Atenciones[0] || null;
  const availability = reservation?.Opcion?.Disponibilidad;
  const legacy = parseLegacyObservations(attention?.observaciones);
  const currentPhase = person.Etapa?.nombre === 'TURNED' ? 'TURNED' : 'CUSTOMER';
  const dentalHealth = person.SaludOdontologica?.[0] || null;

  const activeTreatment = person.TratamientosContratados?.[0] || null;
  const activePlan = activeTreatment?.PlanTratamiento?.[0] || null;
  const totalSessions = activePlan?.sesiones_planificadas || activeTreatment?.SesionesTratamiento?.length || (reservation ? 1 : 0);
  const completedSessions = activeTreatment?.SesionesTratamiento?.filter(s => s.estado_asistencial === 'Realizada' && s.estado_cierre === 'Cerrada').length || (attention?.estado_servicio === 'Finalizado' ? 1 : 0);
  const progressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const isReadyForTurned = totalSessions > 0 && completedSessions >= totalSessions;

  const treatment = activeTreatment ? {
    id: activeTreatment.id_tratamiento,
    serviceName: activeTreatment.Servicios?.nombre || reservation?.Solicitud?.Servicio?.nombre || 'Consulta Odontológica',
    status: activeTreatment.estado_tratamiento,
    professional: activeTreatment.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales 
      ? `Dr(a). ${activeTreatment.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.nombres} ${activeTreatment.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.apellidos}`.trim() 
      : (availability?.Profesional ? `Dr(a). ${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim() : 'Especialista'),
    branch: activeTreatment.Sedes?.nombre || availability?.Sede?.nombre || 'Sede California',
    planVersion: activePlan?.version_plan || 1,
    clinicalObjectives: activePlan?.motivo_modificacion || 'Plan de tratamiento activo',
    totalSessions,
    completedSessions,
    progressPercent,
    isReadyForTurned,
    sessions: activeTreatment.SesionesTratamiento.map(s => {
      const sessionAttention = s.Atenciones?.[0] || null;
      return {
        id: s.id_sesion,
        sessionNumber: s.numero_sesion,
        scheduledDate: s.fecha_programada_vigente ? s.fecha_programada_vigente.toISOString() : '',
        durationMin: s.duracion_programada_min,
        statusProg: s.estado_programacion,
        statusAssist: s.estado_asistencial,
        statusClosure: s.estado_cierre,
        professional: s.Profesionales ? `Dr(a). ${s.Profesionales.nombres} ${s.Profesionales.apellidos}`.trim() : '',
        branch: s.Sedes?.nombre || '',
        attention: sessionAttention ? {
          id: sessionAttention.id_atencion,
          diagnosis: sessionAttention.motivo_consulta || '',
          evaluation: sessionAttention.evaluacion || '',
          procedure: sessionAttention.procedimiento || sessionAttention.resultado || '',
          instructions: sessionAttention.indicaciones_finales || '',
          observations: sessionAttention.observaciones || '',
          serviceState: sessionAttention.estado_servicio,
          startTime: sessionAttention.fecha_inicio?.toISOString(),
          endTime: sessionAttention.fecha_fin?.toISOString(),
          aftercareList: (sessionAttention.IndicacionesPostatencion || []).map(ind => ({
            id: ind.id_indicacion,
            code: `DOC-IND-${ind.id_indicacion}`,
            status: ind.estado,
            content: ind.contenido_indicaciones,
            issuedAt: ind.fecha_emision ? ind.fecha_emision.toISOString() : ind.fecha_creacion.toISOString(),
          }))
        } : null
      };
    })
  } : (reservation ? {
    id: 0,
    serviceName: reservation?.Solicitud?.Servicio?.nombre || 'Consulta Odontológica',
    status: 'Programado',
    professional: availability?.Profesional ? `Dr(a). ${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim() : 'Especialista',
    branch: availability?.Sede?.nombre || 'Sede Principal',
    planVersion: 1,
    clinicalObjectives: 'Atención odontológica integral',
    totalSessions: 1,
    completedSessions: attention?.estado_servicio === 'Finalizado' ? 1 : 0,
    progressPercent: attention?.estado_servicio === 'Finalizado' ? 100 : 0,
    isReadyForTurned: attention?.estado_servicio === 'Finalizado',
    sessions: [
      {
        id: 0,
        sessionNumber: 1,
        scheduledDate: availability?.fecha ? availability.fecha.toISOString() : reservation.fecha_reserva.toISOString(),
        durationMin: 45,
        statusProg: reservation.estado === 'Cancelada' ? 'Cancelada' : 'Programada',
        statusAssist: attention?.asistencia || 'Pendiente',
        statusClosure: attention?.estado_servicio === 'Finalizado' ? 'Cerrada' : 'Pendiente',
        professional: availability?.Profesional ? `Dr(a). ${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim() : '',
        branch: availability?.Sede?.nombre || '',
        attention: attention ? {
          id: attention.id_atencion,
          diagnosis: attention.motivo_consulta || '',
          evaluation: attention.evaluacion || '',
          procedure: attention.procedimiento || attention.resultado || '',
          instructions: attention.indicaciones_finales || '',
          observations: attention.observaciones || '',
          serviceState: attention.estado_servicio,
          startTime: attention.fecha_inicio?.toISOString(),
          endTime: attention.fecha_fin?.toISOString(),
          aftercareList: (attention.IndicacionesPostatencion || []).map(ind => ({
            id: ind.id_indicacion,
            code: `DOC-IND-${ind.id_indicacion}`,
            status: ind.estado,
            content: ind.contenido_indicaciones,
            issuedAt: ind.fecha_emision ? ind.fecha_emision.toISOString() : ind.fecha_creacion.toISOString(),
          }))
        } : null
      }
    ]
  } : null);

  return {
    id: person.id_persona.toString(),
    payerId: reservation?.id_reserva?.toString() || person.id_persona.toString(),
    reservationId: reservation?.id_reserva?.toString() || '',
    state: clinicalState(attention, reservation),
    currentPhase,
    isTurned: currentPhase === 'TURNED',
    createdAt: person.fecha_registro.toISOString(),
    attentionId: attention?.id_atencion?.toString(),
    treatment,
    person: {
      id: person.id_persona.toString(), firstName: person.nombres, lastName: person.apellidos,
      documentNumber: person.dni, email: person.email, phone: person.numero,
    },
    lead: { requestedServiceId: reservation?.Solicitud?.Servicio?.nombre || '' },
    serviceName: reservation?.Solicitud?.Servicio?.nombre || 'Consulta Odontológica',
    standardDurationMinutes: 45,
    saludOdontologica: dentalHealth ? {
      nivelDolor: dentalHealth.nivel_dolor,
      sensibilidad: dentalHealth.presenta_sensibilidad,
      sangradoOInflamacion: dentalHealth.sangrado_o_inflamacion,
      protesis: dentalHealth.usa_aparato_o_protesis,
      condicionEspecial: dentalHealth.condicion_atencion_especial,
      ultimaVisita: dentalHealth.ultima_visita_odontologica,
      motivoConsulta: dentalHealth.motivo_consulta,
      tratamientoPrevio: dentalHealth.tratamiento_previo,
    } : null,
    reservation: reservation ? {
      id: reservation.id_reserva.toString(), leadId: person.id_persona.toString(),
      date: availability?.fecha ? availability.fecha.toISOString().split('T')[0] : reservation.fecha_reserva.toISOString().split('T')[0],
      time: availability?.hora_inicio ? availability.hora_inicio.toISOString().slice(11, 16) : '',
      professionalId: availability?.Profesional
        ? `${availability.Profesional.nombres} ${availability.Profesional.apellidos}`.trim() : 'Sin asignar',
      branchId: availability?.Sede?.nombre || 'Sin sede',
      status: reservation.estado === 'Cancelada' ? 'CANCELED' : reservation.estado === 'Confirmada' ? 'CONFIRMED' : 'PENDING',
    } : null,
    attention: attention ? {
      id: attention.id_atencion.toString(), customerId: person.id_persona.toString(),
      reasonForConsultation: attention.motivo_consulta || legacy.reasonForConsultation || '',
      relevantBackground: attention.antecedentes || legacy.relevantBackground || '',
      allergies: attention.alergias || legacy.allergies || '',
      evaluation: attention.evaluacion || legacy.evaluation || '',
      observations: legacy.observations || '',
      procedure: attention.procedimiento || legacy.procedure || attention.resultado || '',
      instructions: attention.indicaciones_finales || '',
      startTime: attention.fecha_inicio?.toISOString() || legacy.startTime,
      endTime: attention.fecha_fin?.toISOString() || legacy.endTime,
    } : undefined,
    incidents: person.Incidencias.map(incident => ({
      id: incident.id_incidencia.toString(), customerId: person.id_persona.toString(),
      reason: incident.descripcion, status: incident.estado === 'Resuelta' ? 'RESOLVED' : 'OPEN',
      createdAt: incident.fecha_registro.toISOString(),
    })),
  };
}

async function findCustomerPerson(id: number) {
  return prisma.personas.findFirst({
    where: { id_persona: id, Etapa: { nombre: { in: ['CUSTOMER', 'TURNED'] } } },
    include: customerInclude,
  });
}

router.get('/', async (_req, res) => {
  try {
    const people = await prisma.personas.findMany({
      where: { Etapa: { nombre: { in: ['CUSTOMER', 'TURNED'] } } }, include: customerInclude,
      orderBy: { fecha_registro: 'desc' },
    });
    res.json(people.filter(person => person.Reservas.length > 0).map(serializeCustomer));
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Error al obtener customers' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    res.json(serializeCustomer(person));
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Error al obtener customer' });
  }
});

router.put('/:id/state', async (req, res) => {
  const requestedState = String(req.body?.state || '');
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'El paciente ya se encuentra en TURNED' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    const currentState = clinicalState(attention, reservation);

    if (requestedState === 'ATTENDANCE_CONFIRMED' && currentState === 'SCHEDULED') {
      await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { asistencia: 'Confirmada' } });
    } else if (requestedState === 'NO_SHOW' && ['SCHEDULED', 'ATTENDANCE_CONFIRMED'].includes(currentState)) {
      await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { asistencia: 'No asiste' } });
    } else if (requestedState === 'CANCELED' && ['SCHEDULED', 'ATTENDANCE_CONFIRMED'].includes(currentState)) {
      await prisma.$transaction([
        prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { estado_servicio: 'Cancelado' } }),
        prisma.reservas.update({ where: { id_reserva: reservation.id_reserva }, data: { estado: 'Cancelada' } }),
      ]);
    } else {
      return res.status(409).json({ error: `Transición no permitida desde ${currentState} hacia ${requestedState}` });
    }
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error changing customer state:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.post('/:id/start-attention', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'El paciente ya se encuentra en TURNED' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    if (clinicalState(attention, reservation) !== 'ATTENDANCE_CONFIRMED') return res.status(409).json({ error: 'Primero debe confirmarse la asistencia' });

    // 4.4 / R02: Re-verificar guardián financiero antes de iniciar la atención clínica
    const pagosReserva = await prisma.pagos.findMany({ where: { id_reserva: reservation.id_reserva } });
    const tienePagoHabilitado = pagosReserva.some(
      p => ['Validado', 'VALIDADO', 'VALIDATED', 'Confirmado'].includes(p.estado) && Number(p.importe) > 0
    );
    const tieneReversionActiva = pagosReserva.length > 0 && pagosReserva.every(p => ['Revertido', 'REVERTED', 'Rechazado', 'Fallido'].includes(p.estado));
    if (!tienePagoHabilitado || tieneReversionActiva) {
      return res.status(409).json({
        error: 'GUARDIÁN FINANCIERO (R02): No se puede iniciar la atención clínica sin pago validado vigente o ante reversión financiera activa.',
      });
    }

    await prisma.atenciones.update({
      where: { id_atencion: attention.id_atencion },
      data: { estado_servicio: 'En curso', asistencia: 'Asiste', fecha_inicio: new Date() },
    });
    res.json({ message: 'Atención iniciada' });
  } catch (error) {
    console.error('Error starting attention:', error);
    res.status(500).json({ error: 'Error al iniciar atención' });
  }
});

router.post('/:id/finish-attention', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    const attention = person.Atenciones[0];
    const reservation = person.Reservas[0];
    if (!attention || !reservation) return res.status(404).json({ error: 'No existe una atención asociada' });
    if (clinicalState(attention, reservation) !== 'IN_ATTENTION') return res.status(409).json({ error: 'La atención debe estar en curso para finalizarla' });
    await prisma.atenciones.update({ where: { id_atencion: attention.id_atencion }, data: { estado_servicio: 'Finalizado', fecha_fin: new Date() } });
    res.json({ message: 'Atención finalizada' });
  } catch (error) {
    console.error('Error finishing attention:', error);
    res.status(500).json({ error: 'Error al finalizar atención' });
  }
});

router.put('/:id/attention-details', async (req, res) => {
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    if (person.Etapa.nombre !== 'CUSTOMER') return res.status(409).json({ error: 'La atención de un paciente TURNED es de solo lectura' });
    let attention = person.Atenciones[0];
    const data = req.body || {};
    
    if (!attention) {
      const reservation = person.Reservas[0];
      const defaultProf = await prisma.profesionales.findFirst();
      const defaultSede = await prisma.sedes.findFirst();
      attention = await prisma.atenciones.create({
        data: {
          id_persona: person.id_persona,
          id_reserva: reservation?.id_reserva,
          id_servicio: reservation?.Solicitud?.id_servicio || 1,
          id_profesional: reservation?.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
          id_sede: reservation?.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
          fecha_atencion: reservation?.Opcion?.Disponibilidad?.fecha || new Date(),
          estado_servicio: 'En curso',
          asistencia: 'Confirmada',
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        },
        include: { IndicacionesPostatencion: true },
      });
    } else {
      await prisma.atenciones.update({
        where: { id_atencion: attention.id_atencion },
        data: {
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        },
        include: { IndicacionesPostatencion: true },
      });
    }
    res.json({ message: 'Detalles guardados' });
  } catch (error) {
    console.error('Error saving attention:', error);
    res.status(500).json({ error: 'Error al registrar detalles' });
  }
});

router.put('/:id/sessions/:sessionId/attention', async (req, res) => {
  try {
    const personId = Number(req.params.id);
    const sessionId = Number(req.params.sessionId);
    const data = req.body || {};

    const person = await findCustomerPerson(personId);
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });

    const sesion = await prisma.sesionesTratamiento.findUnique({
      where: { id_sesion: sessionId },
      include: { Atenciones: true }
    });
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    let attention = sesion.Atenciones[0];
    if (!attention) {
      attention = await prisma.atenciones.create({
        data: {
          id_persona: personId,
          id_reserva: person.Reservas[0]?.id_reserva || 1,
          id_sesion: sessionId,
          id_tratamiento: sesion.id_tratamiento,
          id_servicio: 1,
          id_profesional: sesion.id_profesional,
          id_sede: sesion.id_sede,
          fecha_atencion: sesion.fecha_programada_vigente,
          estado_servicio: 'En curso',
          asistencia: 'Asiste',
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        }
      });
    } else {
      await prisma.atenciones.update({
        where: { id_atencion: attention.id_atencion },
        data: {
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: data.procedure || null,
          observaciones: data.observations || null,
          indicaciones_finales: data.instructions || null,
        }
      });
    }

    res.json({ message: 'Detalles de la sesión guardados correctamente' });
  } catch (error: any) {
    console.error('Error saving session attention:', error);
    res.status(500).json({ error: error.message || 'Error al guardar detalles de la sesión' });
  }
});

router.post('/:id/sessions/:sessionId/close', async (req, res) => {
  try {
    const personId = Number(req.params.id);
    const sessionId = Number(req.params.sessionId);
    const data = req.body || {};

    const person = await findCustomerPerson(personId);
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });

    const sesion = await prisma.sesionesTratamiento.findUnique({
      where: { id_sesion: sessionId },
      include: { Atenciones: true }
    });
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    let attention = sesion.Atenciones[0];
    const procedure = data.procedure || attention?.procedimiento;
    const instructions = data.instructions || attention?.indicaciones_finales;

    if (!procedure || !String(procedure).trim()) {
      return res.status(400).json({ error: 'Debe ingresar el procedimiento clínico ejecutado en la sesión' });
    }

    const now = new Date();

    if (!attention) {
      attention = await prisma.atenciones.create({
        data: {
          id_persona: personId,
          id_reserva: person.Reservas[0]?.id_reserva || 1,
          id_sesion: sessionId,
          id_tratamiento: sesion.id_tratamiento,
          id_servicio: 1,
          id_profesional: sesion.id_profesional,
          id_sede: sesion.id_sede,
          fecha_atencion: sesion.fecha_programada_vigente,
          estado_servicio: 'Finalizado',
          asistencia: 'Asiste',
          fecha_inicio: sesion.fecha_inicio_atencion || now,
          fecha_fin: now,
          motivo_consulta: data.reasonForConsultation || null,
          antecedentes: data.relevantBackground || null,
          alergias: data.allergies || null,
          evaluacion: data.evaluation || null,
          procedimiento: procedure,
          observaciones: data.observations || null,
          indicaciones_finales: instructions || null,
        }
      });
    } else {
      await prisma.atenciones.update({
        where: { id_atencion: attention.id_atencion },
        data: {
          estado_servicio: 'Finalizado',
          asistencia: 'Asiste',
          fecha_fin: now,
          motivo_consulta: data.reasonForConsultation || attention.motivo_consulta,
          antecedentes: data.relevantBackground || attention.antecedentes,
          alergias: data.allergies || attention.alergias,
          evaluacion: data.evaluation || attention.evaluacion,
          procedimiento: procedure,
          observaciones: data.observations || attention.observaciones,
          indicaciones_finales: instructions || attention.indicaciones_finales,
        }
      });
    }

    // Cerrar sesión clínica satisfaciendo restricciones SQL de integridad
    await prisma.sesionesTratamiento.update({
      where: { id_sesion: sessionId },
      data: {
        estado_asistencial: 'Realizada',
        estado_cierre: 'Cerrada',
        fecha_cierre_sesion: now,
        fecha_inicio_atencion: sesion.fecha_inicio_atencion || now,
      }
    });

    res.json({ message: `Sesión #${sesion.numero_sesion} cerrada con éxito documental.` });
  } catch (error: any) {
    console.error('Error closing session:', error);
    res.status(500).json({ error: error.message || 'Error al cerrar sesión clínica' });
  }
});

router.post('/:id/incident', async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10) return res.status(400).json({ error: 'El motivo debe tener al menos 10 caracteres' });
  try {
    const person = await findCustomerPerson(Number(req.params.id));
    if (!person) return res.status(404).json({ error: 'Customer no encontrado' });
    const incident = await prisma.incidencias.create({
      data: { id_persona: person.id_persona, descripcion: reason, tipo: 'CUSTOMER', estado: 'Abierta' },
    });
    res.status(201).json({
      id: incident.id_incidencia.toString(), customerId: person.id_persona.toString(), reason,
      status: 'OPEN', createdAt: incident.fecha_registro.toISOString(),
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Error al registrar incidencia' });
  }
});

router.post('/:id/convert-turned', async (req, res) => {
  try {
    const personId = Number(req.params.id);
    const [customerStage, turnedStage] = await Promise.all([
      prisma.etapas.findUnique({ where: { nombre: 'CUSTOMER' } }),
      prisma.etapas.upsert({ where: { nombre: 'TURNED' }, update: {}, create: { nombre: 'TURNED', descripcion: 'Fidelización' } }),
    ]);
    if (!customerStage) return res.status(500).json({ error: 'La etapa CUSTOMER no está configurada' });

    const bodyData = req.body || {};
    const result = await prisma.$transaction(async tx => {
      const person = await tx.personas.findUnique({
        where: { id_persona: personId },
        include: { Etapa: true, Atenciones: { orderBy: { id_atencion: 'desc' }, take: 1 } },
      });
      if (!person) return { status: 404, error: 'Customer no encontrado' };
      if (person.id_etapa_actual === turnedStage.id_etapa) return { status: 200, alreadyConverted: true };
      if (person.id_etapa_actual !== customerStage.id_etapa) return { status: 409, error: 'La persona no se encuentra en etapa CUSTOMER' };
      
      let attention = person.Atenciones[0];
      if (!attention) return { status: 404, error: 'No se encontró la atención médica asociada' };

      // Actualizar datos clínicos si fueron provistos en el body
      const updateData: any = {};
      if (bodyData.reasonForConsultation) updateData.motivo_consulta = bodyData.reasonForConsultation;
      if (bodyData.relevantBackground) updateData.antecedentes = bodyData.relevantBackground;
      if (bodyData.allergies) updateData.alergias = bodyData.allergies;
      if (bodyData.evaluation) updateData.evaluacion = bodyData.evaluation;
      if (bodyData.procedure) updateData.procedimiento = bodyData.procedure;
      if (bodyData.instructions) updateData.indicaciones_finales = bodyData.instructions;
      if (bodyData.observations) updateData.observaciones = bodyData.observations;

      if (attention.estado_servicio !== 'Finalizado') {
        updateData.estado_servicio = 'Finalizado';
        updateData.fecha_fin = attention.fecha_fin || new Date();
      }

      if (Object.keys(updateData).length > 0) {
        attention = await tx.atenciones.update({
          where: { id_atencion: attention.id_atencion },
          data: updateData,
        });
      }

      const legacy = parseLegacyObservations(attention?.observaciones);
      const procedure = attention?.procedimiento || legacy.procedure || attention?.resultado;
      if (!String(procedure || '').trim()) return { status: 409, error: 'Debe registrar el procedimiento realizado' };
      if (!String(attention.indicaciones_finales || '').trim()) return { status: 409, error: 'Debe registrar las indicaciones finales' };

      // R11, R12, R13: Verificar si existe un TratamientoContratado con sesiones pendientes antes de pasar a TURNED
      try {
        const pendientesRows = await tx.$queryRawUnsafe<Array<{ sesiones_pendientes: number }>>(`
          IF OBJECT_ID('dbo.TratamientosContratados', 'U') IS NOT NULL
          BEGIN
            SELECT
              ISNULL(SUM(CASE
                WHEN ISNULL(pt.sesiones_planificadas, 1) > ISNULL(sc.sesiones_cerradas, 0) THEN 1
                ELSE 0
              END), 0) AS sesiones_pendientes
            FROM dbo.TratamientosContratados t
            LEFT JOIN dbo.PlanTratamiento pt ON pt.id_tratamiento = t.id_tratamiento AND pt.es_vigente = 1
            LEFT JOIN (
              SELECT id_tratamiento, SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Cerrada' THEN 1 ELSE 0 END) AS sesiones_cerradas
              FROM dbo.SesionesTratamiento
              GROUP BY id_tratamiento
            ) sc ON sc.id_tratamiento = t.id_tratamiento
            WHERE t.id_persona = ${Number(personId)}
              AND t.estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución')
              AND ISNULL(pt.sesiones_planificadas, 1) > 1;
          END
          ELSE
          BEGIN
            SELECT 0 AS sesiones_pendientes;
          END
        `);
        if (pendientesRows?.[0]?.sesiones_pendientes && Number(pendientesRows[0].sesiones_pendientes) > 0) {
          return {
            status: 409,
            error: 'BLOQUEO DE TRANSICIÓN A TURNED (R11/R12): El tratamiento contratado aún tiene sesiones planificadas pendientes de realización o cierre documental.',
          };
        }

        await tx.$executeRawUnsafe(`
          IF OBJECT_ID('dbo.TratamientosContratados', 'U') IS NOT NULL
          BEGIN
            UPDATE dbo.TratamientosContratados
            SET estado_tratamiento = 'Completado',
                fecha_cierre_real = ISNULL(fecha_cierre_real, SYSDATETIME()),
                id_profesional_cierre = ISNULL(id_profesional_cierre, id_profesional_responsable),
                fecha_actualizacion = SYSDATETIME()
            WHERE id_persona = ${Number(personId)}
              AND estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución');
          END
        `);
      } catch (tratCheckErr) {
        console.warn('[CUSTOMER->TURNED] Verificación de TratamientosContratados:', tratCheckErr);
      }

      await tx.personas.update({ where: { id_persona: personId }, data: { id_etapa_actual: turnedStage.id_etapa, fecha_actualizacion: new Date() } });
      await tx.eventosEtapa.create({
        data: { id_persona: personId, etapa_origen: customerStage.id_etapa, etapa_destino: turnedStage.id_etapa, motivo: 'Tratamiento odontológico completado y cerrado' },
      });
      return { status: 200, alreadyConverted: false };
    });

    if ('error' in result) return res.status(result.status).json({ error: result.error });

    if (!result.alreadyConverted) {
      // Disparar correo de agradecimiento post-consulta con resumen de atención y enlace único de activación del Portal del Paciente
      try {
        const fullPerson = await prisma.personas.findUnique({
          where: { id_persona: personId },
          include: {
            Atenciones: {
              orderBy: { id_atencion: 'desc' },
              take: 1,
              include: {
                Servicio: true,
                Profesional: true,
                Sede: true,
              }
            },
            Reservas: {
              orderBy: { id_reserva: 'desc' },
              take: 1,
              include: {
                Solicitud: { include: { Servicio: true } },
                Opcion: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } }
              }
            }
          }
        });

        if (fullPerson && fullPerson.dni && fullPerson.email) {
          const latestAttention = fullPerson.Atenciones[0];
          const latestReserva = fullPerson.Reservas[0];
          const serviceName = latestAttention?.Servicio?.nombre || latestReserva?.Solicitud?.Servicio?.nombre || 'Consulta Odontológica Especializada';
          const doctorName = latestAttention?.Profesional ? `Dr(a). ${latestAttention.Profesional.nombres} ${latestAttention.Profesional.apellidos}`.trim() : (latestReserva?.Opcion?.Disponibilidad?.Profesional ? `Dr(a). ${latestReserva.Opcion.Disponibilidad.Profesional.nombres} ${latestReserva.Opcion.Disponibilidad.Profesional.apellidos}`.trim() : undefined);
          const branchName = latestAttention?.Sede?.nombre || latestReserva?.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal';

          const token = await patientAuthService.generateActivationTokenForCustomer(fullPerson.id_persona, fullPerson.dni);
          await patientAuthService.sendPostConsultationActivationEmail({
            email: fullPerson.email,
            nombres: fullPerson.nombres,
            apellidos: fullPerson.apellidos,
            dni: fullPerson.dni,
            token,
            serviceName,
            doctorName,
            branchName,
            procedure: latestAttention?.procedimiento || undefined,
            instructions: latestAttention?.indicaciones_finales || undefined,
          });
        }
      } catch (errEmail) {
        console.error('[TURNED] Error al enviar correo de activación post-consulta:', errEmail);
      }
    }

    res.json({ message: result.alreadyConverted ? 'El paciente ya estaba en TURNED' : 'Convertido a TURNED', currentPhase: 'TURNED' });
  } catch (error) {
    console.error('Error converting customer to TURNED:', error);
    res.status(500).json({ error: 'Error al convertir a TURNED' });
  }
});

// ── Endpoints de Tratamientos, Planes, Sesiones, Calidad Documental y Copiloto IA (Sección 6) ──
router.get('/:id/treatments', async (req, res) => {
  try {
    const personId = Number(req.params.id);
    if (isNaN(personId)) return res.status(400).json({ error: 'ID inválido' });

    const [tratamientos, planes, sesiones, antecedentes, interaccionesIA, alertasIA, borradoresIA] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM dbo.TratamientosContratados WHERE id_persona = ${personId} ORDER BY id_tratamiento DESC`),
      prisma.$queryRawUnsafe(`SELECT pt.* FROM dbo.PlanTratamiento pt INNER JOIN dbo.TratamientosContratados t ON t.id_tratamiento = pt.id_tratamiento WHERE t.id_persona = ${personId} ORDER BY pt.version_plan DESC`),
      prisma.$queryRawUnsafe(`SELECT s.* FROM dbo.SesionesTratamiento s INNER JOIN dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento WHERE t.id_persona = ${personId} ORDER BY s.id_tratamiento DESC, s.numero_sesion ASC`),
      prisma.$queryRawUnsafe(`SELECT * FROM dbo.AntecedentesClinicos WHERE id_persona = ${personId} ORDER BY id_antecedente DESC`),
      prisma.$queryRawUnsafe(`SELECT * FROM dbo.InteraccionesIA WHERE id_persona = ${personId} ORDER BY fecha_hora DESC`),
      prisma.$queryRawUnsafe(`SELECT * FROM dbo.AlertasIA WHERE id_persona = ${personId} ORDER BY fecha_hora DESC`),
      prisma.$queryRawUnsafe(`SELECT * FROM dbo.BorradoresIA WHERE id_persona = ${personId} ORDER BY fecha_hora DESC`),
    ]);

    res.json({
      tratamientos,
      planes,
      sesiones,
      antecedentes,
      copilotoIA: {
        interacciones: interaccionesIA,
        alertas: alertasIA,
        borradores: borradoresIA,
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo tratamientos del paciente:', error);
    res.status(500).json({ error: error.message || 'Error al obtener tratamientos de CUSTOMER' });
  }
});

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = error instanceof AiAgentError ? error : new AiAgentError('INTERNAL_ERROR', 'No fue posible completar la operación.');
  res.status(e.status).json({ error: e.message });
});

export default router;
