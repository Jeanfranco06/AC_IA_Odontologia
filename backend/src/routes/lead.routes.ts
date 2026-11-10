import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { leadCommercialRouter } from './leadCommercial.routes';
import { prisma, withRetry } from '../db';
import { NegotiatorAgentService } from '../services/negotiatorAgentService';
import { getServicioCommercialInfo } from './config.routes';

const router = Router();
router.use('/commercial', leadCommercialRouter);

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class LeadConflict extends Error {}

function leadError(error: unknown, res: import('express').Response) {
  if (error instanceof LeadConflict) return res.status(409).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: 'No se pudo completar la operación LEAD' });
}


// @db.Date conserva el día del calendario; el mediodía UTC evita cambios de día
// cuando la fecha se convierte posteriormente entre zonas horarias.
function parseCalendarDate(fecha: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha debe tener el formato YYYY-MM-DD');
  }
  const date = new Date(`${fecha}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) {
    throw new Error('Fecha inválida');
  }
  return date;
}

// ── Catálogos para el formulario de alternativas ─────────────────────────────
router.get('/options/availability', async (req, res) => {
  try {
    const data = await withRetry(async () => {
      const profesionales = await prisma.profesionales.findMany({ where: { activo: true } });
      const sedes = await prisma.sedes.findMany({ where: { activo: true } });
      const servicios = await prisma.servicios.findMany({
        where: { activo: true },
        include: {
          Tarifas: {
            where: { activo: true },
            orderBy: { fecha_inicio: 'desc' },
            take: 1,
          }
        }
      });
      const disponibilidades = await prisma.disponibilidad.findMany({
        where: { estado: 'Disponible' },
        include: { Profesional: true, Sede: true },
        orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
      });
      return { profesionales, sedes, servicios, disponibilidades };
    });

    res.json(data);
  } catch (error) {
    console.error('Error al obtener disponibilidad:', error);
    res.status(500).json({ error: 'Error al obtener disponibilidad' });
  }
});

// ── Eliminar alternativa (options antes de :id para no colisionar) ────────────
router.put('/options/:id_opcion', async (req, res) => {
  const id_opcion = Number(req.params.id_opcion);
  const { precio_ofrecido, id_sede, id_profesional, fecha, ofr_turno_lead, motivo_cambio } = req.body;
  try {
    const updated = await prisma.$transaction(async tx => {
      const option = await tx.opciones.findUnique({
        where: { id_opcion }, include: { Disponibilidad: true, Reservas: true, Solicitud: true },
      });
      if (!option || option.archivada_lead_en || option.Solicitud.archivada_lead_en ||
          option.Reservas.length || (option.estado_respuesta && option.estado_respuesta !== 'Pendiente')) {
        throw new LeadConflict('La alternativa no se puede modificar en negociación.');
      }
      const current = option.Disponibilidad;
      const slot = id_sede || id_profesional || fecha ? await tx.disponibilidad.findFirst({
        where: {
          id_sede: id_sede ? Number(id_sede) : current.id_sede,
          id_profesional: id_profesional ? Number(id_profesional) : current.id_profesional,
          fecha: fecha ? parseCalendarDate(fecha) : current.fecha,
          hora_inicio: current.hora_inicio, hora_fin: current.hora_fin, estado: 'Disponible',
        },
      }) : current;
      if (!slot || slot.estado !== 'Disponible') throw new LeadConflict('Selecciona un horario disponible.');
      const price = precio_ofrecido === undefined ? option.precio_ofrecido : new Prisma.Decimal(precio_ofrecido);
      if (!price.isFinite() || price.lt(0) || price.gte(100000000) || price.decimalPlaces() > 2) {
        throw new LeadConflict('El precio debe tener hasta dos decimales y estar entre 0 y 99999999.99.');
      }
      if (option.id_propuesta_lead && !price.eq(option.precio_ofrecido)) {
        throw new LeadConflict('Crea una nueva versión de la propuesta antes de cambiar el precio.');
      }
      const prior = await tx.cambiosOpcionLead.findFirst({ where: { id_opcion }, orderBy: { id_cambio: 'desc' } });
      const result = await tx.opciones.update({
        where: { id_opcion },
        data: { id_disponibilidad: slot.id_disponibilidad, precio_ofrecido: price, ofr_turno_lead },
        include: { Disponibilidad: { include: { Profesional: true, Sede: true } } },
      });
      if (typeof motivo_cambio === 'string' && motivo_cambio.trim()) {
        await tx.cambiosOpcionLead.updateMany({
          where: { id_opcion, id_cambio: { gt: prior?.id_cambio ?? 0 } },
          data: { motivo_cambio: motivo_cambio.trim().slice(0, 300) },
        });
      }
      return result;
    }, serializable);
    res.json({ message: 'Alternativa actualizada', data: updated });
  } catch (error) {
    return leadError(error, res);
  }
});

router.delete('/options/:id_opcion', async (req, res) => {
  try {
    const id_opcion = Number(req.params.id_opcion);
    const result = await prisma.opciones.updateMany({
      where: { id_opcion, archivada_lead_en: null, seleccionada: false, Reservas: { none: {} } },
      data: { archivada_lead_en: new Date() },
    });
    if (!result.count) throw new LeadConflict('La alternativa ya está archivada, está seleccionada o tiene una reserva.');
    res.json({ message: 'Alternativa archivada' });
  } catch (error) {
    return leadError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id) || Number(id.replace(/\D/g, ''));
  if (isNaN(numId) || !numId) {
    return res.status(400).json({ error: 'ID de LEAD inválido' });
  }

  try {
    const lead = await withRetry(() => prisma.personas.findUnique({
      where: { id_persona: numId },
      include: {
        Etapa: true,
        CanalOrigen: true,
        Preferencias: {
          include: {
            Canal: true,
            Horario: true,
            Modalidad: true,
            ServicioInteres: true,
          }
        },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
        Interacciones: {
          include: { Canal: true, Fuente: true },
          orderBy: { fecha_hora: 'desc' },
          take: 5,
        },
        Solicitudes: {
          where: { archivada_lead_en: null },
          include: {
            Servicio: true,
            Opciones: {
                where: { archivada_lead_en: null },
              include: {
                Disponibilidad: {
                  include: { Profesional: true, Sede: true }
                }
              }
            }
          },
          orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
        },
      }
    }));

    if (!lead) return res.status(404).json({ error: 'LEAD no encontrado' });
    res.json(lead);
  } catch (error) {
    console.error('Error al obtener datos del LEAD:', error);
    res.status(500).json({ error: 'Error al obtener datos del LEAD' });
  }
});

// ── Reserva y conversión a PAYER ──────────────────────────────────────────────
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;
  const { id_solicitud, id_opcion } = req.body;

  try {
    let etapaPayer = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'PAYER' } }));
    if (!etapaPayer) etapaPayer = await withRetry(() => prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pago inicial validado' } }));

    const etapaLead = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'LEAD' } }));

    const result = await withRetry(() => prisma.$transaction(async (tx) => {
      const eligible = await tx.opciones.findFirst({
        where: {
          id_opcion: Number(id_opcion), id_solicitud: Number(id_solicitud), archivada_lead_en: null,
          OR: [{ estado_respuesta: null }, { estado_respuesta: { not: 'Rechazada' } }],
          Solicitud: { id_persona: Number(id), archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } } },
          Disponibilidad: { estado: 'Disponible' }, Reservas: { none: {} },
        },
      });
      if (!eligible) throw new LeadConflict('La alternativa no está disponible para esta negociación.');
      const opcion = await tx.opciones.update({
        where: { id_opcion: Number(id_opcion) },
        data: {
          seleccionada: true,
          ...(eligible.estado_respuesta !== 'Aceptada' && { estado_respuesta: 'Aceptada', fecha_respuesta: new Date() }),
        }
      });

      const reserva = await tx.reservas.create({
        data: {
          id_persona: Number(id),
          id_solicitud: Number(id_solicitud),
          id_opcion: opcion.id_opcion,
          estado: 'Pendiente',
        }
      });

      await tx.personas.update({
        where: { id_persona: Number(id) },
        data: { id_etapa_actual: etapaPayer!.id_etapa }
      });

      await tx.eventosEtapa.create({
        data: {
          id_persona: Number(id),
          etapa_origen: etapaLead?.id_etapa,
          etapa_destino: etapaPayer!.id_etapa,
          motivo: 'Reserva confirmada en negociación'
        }
      });

      await tx.disponibilidad.update({
        where: { id_disponibilidad: opcion.id_disponibilidad },
        data: { estado: 'Ocupado' }
      });

      return { reserva, opcion };
    }, serializable));

    res.status(201).json({ message: 'Reserva creada. Estado convertido a PAYER.', data: result });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Lista de LEADS ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const personas = await withRetry(() => prisma.personas.findMany({
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        Preferencias: true,
        Solicitudes: {
          where: { archivada_lead_en: null },
          orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
          include: { 
            Servicio: true, 
            Reservas: { include: { Pagos: true } },
            Opciones: true 
          } 
        },
        EventosEtapa: {
          orderBy: { fecha_hora: 'desc' },
          take: 1
        }
      }
    }));

    const leads = personas
      .filter(p => (p.Etapa?.nombre === 'LEAD' && p.Solicitudes.length > 0) || p.Etapa?.nombre === 'PAYER')
      .map(p => {
        const sol = p.Solicitudes.length > 0 ? p.Solicitudes[0] : null;
        const lastEvento = p.EventosEtapa.length > 0 ? p.EventosEtapa[0] : null;

        let state = 'IN_NEGOTIATION';
        let estado_negociacion = 'En negociación';
        let resultado_final: string | undefined = undefined;
        let motivo_cierre = sol?.motivo || undefined;
        let fecha_cierre = sol?.fecha_cierre ? sol.fecha_cierre.toISOString() : undefined;
        if (p.Etapa?.nombre === 'PAYER') state = 'PAYMENT_REQUESTED';

        if (p.Etapa.nombre === 'PAYER' || sol?.estado === 'Convertida') {
          state = 'PAYMENT_REQUESTED';
          estado_negociacion = 'Cerrada';
          resultado_final = 'Convertido';
        } else if (
          sol?.estado === 'Abandonada' ||
          sol?.estado === 'Perdida' ||
          sol?.estado === 'Cancelada' ||
          p.estado_calidad === 'Descartado' ||
          p.estado_calidad === 'Rechazado'
        ) {
          state = 'LOST';
          estado_negociacion = 'Cerrada';
          resultado_final = 'Abandonado';
          motivo_cierre = lastEvento?.motivo || sol?.motivo || 'Negociación abandonada por el prospecto';
        } else if (sol?.Opciones && sol.Opciones.some(o => o.seleccionada)) {
          state = 'ALTERNATIVE_SELECTED';
        }

        const servicio = sol && sol.Servicio ? sol.Servicio.nombre : 'General';
        const reserva = sol && sol.Reservas.length > 0 ? sol.Reservas[0].id_reserva.toString() : undefined;
        const preferencias = p.Preferencias.length > 0 ? p.Preferencias[0].sede_preferida || '' : '';

        const consultasCount = Math.max(p.Solicitudes.length, 1);

        return {
          id: p.id_persona.toString(),
          buyerId: p.id_persona.toString(),
          requestedServiceId: servicio,
          state,
          createdAt: p.fecha_registro,
          reservationId: reserva,
          buyer: { preferences: preferencias, consultasCount },
          id_negociacion: sol?.id_solicitud || p.id_persona,
          estado_negociacion,
          resultado_final,
          fecha_cierre,
          motivo_cierre,
          fecha_hora_solicitud: sol?.fecha_solicitud ? sol.fecha_solicitud.toISOString() : p.fecha_registro.toISOString(),
          fecha_hora_primera_respuesta_util: sol?.fecha_primera_respuesta ? sol.fecha_primera_respuesta.toISOString() : undefined,
          firstResponseDate: sol?.fecha_primera_respuesta ? sol.fecha_primera_respuesta.toISOString() : undefined,
          person: {
            firstName: p.nombres,
            lastName: p.apellidos,
            documentNumber: p.dni,
            phone: p.numero,
            email: p.email,
          }
        };
      });

    res.json(leads);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// ── Marcar LEAD como Abandonado / Perdido ──────────────────────────────────
router.post('/:id/abandon', async (req, res) => {
  try {
    const reason = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!reason || reason.length > 400) return res.status(400).json({ error: 'Indica el motivo real del cierre (máximo 400 caracteres).' });
    const id_persona = Number(req.params.id);
    const id_solicitud = req.body.id_solicitud === undefined ? undefined : Number(req.body.id_solicitud);
    const now = new Date();
    await prisma.$transaction(async tx => {
      const request = await tx.solicitudes.findFirst({
        where: { id_solicitud, id_persona, archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } } },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
      });
      if (!request || (request.resultado_comercial_lead && request.resultado_comercial_lead !== 'PENDIENTE')) {
        throw new LeadConflict('No hay una negociación abierta para cerrar.');
      }
      await tx.solicitudes.update({
        where: { id_solicitud: request.id_solicitud },
        data: {
          estado: 'Abandonada', fecha_cierre: now, fecha_decision_comercial_lead: now,
          resultado_comercial_lead: 'CERRADA_SIN_ACUERDO', motivo_cierre_lead: reason,
        },
      });
    }, serializable);
    res.json({ message: 'Negociación cerrada sin acuerdo' });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Actualizar un LEAD y su Perfil de Negociación ───────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id) || Number(id.replace(/\D/g, ''));
  if (isNaN(numId) || !numId) {
    return res.status(400).json({ error: 'ID de LEAD inválido' });
  }

  const {
    person,
    nombres, apellidos, email, numero, phone, dni, documentNumber,
    pref_sede_preferida, sede_preferida, pref_id_horario, id_horario, pref_id_modalidad, id_modalidad, pref_profesional_preferido, profesional_preferido,
    estudianteAplica, aplica_estudiante, universidad, carrera, ciclo,
    laboralAplica, aplica_laboral, ocupacion, empresa, modalidadLaboral, modalidad_laboral, disponibilidadLaboral, disponibilidad_laboral,
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial, motivo_consulta,
    serviceOfInterestId, id_servicio, concreteRequest, motivo
  } = req.body;

  try {
    const updatePersonData: any = {};
    const finalNombres = nombres || person?.firstName;
    const finalApellidos = apellidos || person?.lastName;
    const finalEmail = email !== undefined ? email : person?.email;
    const finalNumero = numero || phone || person?.phone;
    const finalDni = dni || documentNumber || person?.documentNumber;

    if (finalNombres) updatePersonData.nombres = String(finalNombres).trim();
    if (finalApellidos) updatePersonData.apellidos = String(finalApellidos).trim();
    if (finalEmail !== undefined) updatePersonData.email = finalEmail ? String(finalEmail).trim() : null;
    if (finalNumero !== undefined) updatePersonData.numero = finalNumero ? String(finalNumero).trim() : null;
    if (finalDni !== undefined) updatePersonData.dni = finalDni ? String(finalDni).trim() : null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updatePersonData).length > 0) {
        await tx.personas.update({
          where: { id_persona: numId },
          data: updatePersonData
        });
      }

      // 1. Preferencias de Atención
      const finalSede = pref_sede_preferida || sede_preferida;
      const finalHorarioId = Number(pref_id_horario || id_horario) || null;
      const finalModalidadId = Number(pref_id_modalidad || id_modalidad) || null;
      const finalProfesional = pref_profesional_preferido || profesional_preferido;

      if (finalSede || finalHorarioId || finalModalidadId || finalProfesional) {
        await tx.personaPreferencias.deleteMany({ where: { id_persona: numId } });
        await tx.personaPreferencias.create({
          data: {
            id_persona: numId,
            sede_preferida: finalSede ? String(finalSede).trim() : null,
            id_horario: finalHorarioId,
            id_modalidad: finalModalidadId,
            profesional_preferido: finalProfesional ? String(finalProfesional).trim() : null,
          }
        });
      }

      // 2. Salud Odontológica
      if (
        ultima_visita_odontologica !== undefined ||
        motivo_consulta !== undefined ||
        tratamiento_previo !== undefined ||
        nivel_dolor !== undefined ||
        presenta_sensibilidad !== undefined ||
        sangrado_o_inflamacion !== undefined ||
        usa_aparato_o_protesis !== undefined ||
        condicion_atencion_especial !== undefined
      ) {
        await tx.personaSaludOdontologica.deleteMany({ where: { id_persona: numId } });
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: numId,
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: motivo_consulta || motivo || null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || 'Ninguno',
            presenta_sensibilidad: presenta_sensibilidad || 'No',
            sangrado_o_inflamacion: sangrado_o_inflamacion || 'Ninguno',
            usa_aparato_o_protesis: usa_aparato_o_protesis || 'Ninguno',
            condicion_atencion_especial: condicion_atencion_especial || 'Ninguna',
          }
        });
      }

      // 3. Datos Académicos (Convenio Estudiantil)
      if (estudianteAplica !== undefined || aplica_estudiante !== undefined || universidad !== undefined || carrera !== undefined) {
        const shouldApply = estudianteAplica ?? aplica_estudiante ?? Boolean(universidad || carrera);
        await tx.datosAcademicos.deleteMany({ where: { id_persona: numId } });
        if (shouldApply && (universidad || carrera)) {
          await tx.datosAcademicos.create({
            data: {
              id_persona: numId,
              aplica: true,
              universidad: universidad ? String(universidad).trim() : null,
              carrera: carrera ? String(carrera).trim() : null,
              ciclo: ciclo ? String(ciclo).trim() : null,
            }
          });
        }
      }

      // 4. Datos Laborales
      if (laboralAplica !== undefined || aplica_laboral !== undefined || ocupacion !== undefined || empresa !== undefined) {
        const shouldApply = laboralAplica ?? aplica_laboral ?? Boolean(ocupacion || empresa);
        await tx.datosLaborales.deleteMany({ where: { id_persona: numId } });
        if (shouldApply && (ocupacion || empresa)) {
          await tx.datosLaborales.create({
            data: {
              id_persona: numId,
              aplica: true,
              ocupacion: ocupacion ? String(ocupacion).trim() : null,
              empresa: empresa ? String(empresa).trim() : null,
              modalidad: (modalidadLaboral || modalidad_laboral) ? String(modalidadLaboral || modalidad_laboral).trim() : null,
              disponibilidad: (disponibilidadLaboral || disponibilidad_laboral) ? String(disponibilidadLaboral || disponibilidad_laboral).trim() : null,
            }
          });
        }
      }

      // 5. Solicitud
      const finalMotivo = concreteRequest || motivo;
      const finalServicioId = Number(serviceOfInterestId || id_servicio) || null;
      if (finalMotivo !== undefined || finalServicioId) {
        const sol = await tx.solicitudes.findFirst({ where: { id_persona: numId }, orderBy: { id_solicitud: 'desc' } });
        if (sol) {
          await tx.solicitudes.update({
            where: { id_solicitud: sol.id_solicitud },
            data: {
              motivo: finalMotivo !== undefined ? String(finalMotivo).trim() : sol.motivo,
              ...(finalServicioId ? { id_servicio: finalServicioId } : {})
            }
          });
        } else if (finalMotivo || finalServicioId) {
          await tx.solicitudes.create({
            data: {
              id_persona: numId,
              motivo: finalMotivo || 'Evaluación odontológica',
              id_servicio: finalServicioId || 1
            }
          });
        }
      }
    });

    const updatedLead = await prisma.personas.findUnique({
      where: { id_persona: numId },
      include: {
        Etapa: true,
        CanalOrigen: true,
        Preferencias: {
          include: {
            Canal: true,
            Horario: true,
            Modalidad: true,
            ServicioInteres: true,
          }
        },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
        Interacciones: {
          include: { Canal: true, Fuente: true },
          orderBy: { fecha_hora: 'desc' },
          take: 5,
        },
        Solicitudes: {
          include: {
            Servicio: true,
            Opciones: {
                where: { archivada_lead_en: null },
              include: {
                Disponibilidad: {
                  include: { Profesional: true, Sede: true }
                }
              }
            }
          },
          orderBy: { fecha_solicitud: 'desc' },
        },
      }
    });

    res.json({ message: 'Lead actualizado con éxito', data: updatedLead });
  } catch (error: any) {
    console.error('Error al actualizar LEAD:', error);
    res.status(500).json({ error: error.message || 'Error al actualizar LEAD' });
  }
});

// ── Añadir alternativa a la mesa de negociación ────────────────────────────
router.post('/:id/alternative', async (req, res) => {
  const id_persona = Number(req.params.id);
  const { id_solicitud, id_disponibilidad, precio_ofrecido, id_propuesta_lead,
    id_preferencia_lead, pref_fecha_lead, pref_dia_semana_lead, pref_turno_lead,
    pref_hora_inicio_lead, pref_hora_fin_lead, ofr_turno_lead } = req.body;
  try {
    const price = new Prisma.Decimal(precio_ofrecido);
    if (!price.isFinite() || price.lt(0) || price.gte(100000000) || price.decimalPlaces() > 2) {
      throw new LeadConflict('Indica un precio válido.');
    }
    const time = (value?: string) => {
      if (value == null) return null;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new LeadConflict('Hora inválida.');
      return new Date('1970-01-01T' + value + ':00Z');
    };
    const result = await prisma.$transaction(async tx => {
      const request = await tx.solicitudes.findFirst({
        where: {
          id_persona, id_solicitud: id_solicitud == null ? undefined : Number(id_solicitud),
          archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } },
        },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
      });
      if (!request || request.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO') {
        throw new LeadConflict('No hay una oportunidad abierta para esta persona.');
      }
      const slot = await tx.disponibilidad.findFirst({
        where: {
          id_disponibilidad: Number(id_disponibilidad), estado: 'Disponible',
          Profesional: { activo: true }, Sede: { activo: true },
        },
      });
      if (!slot || slot.fecha.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) {
        throw new LeadConflict('Selecciona una disponibilidad vigente.');
      }
      const preference = id_preferencia_lead == null ? null : await tx.personaPreferencias.findFirst({
        where: { id_persona, id_preferencia: Number(id_preferencia_lead) }, include: { Horario: true },
      });
      if (id_preferencia_lead != null && !preference) throw new LeadConflict('La preferencia no corresponde al paciente.');
      const proposal = id_propuesta_lead == null ? null : await tx.propuestasEconomicasLead.findFirst({
        where: { id_propuesta: Number(id_propuesta_lead), id_solicitud: request.id_solicitud, precio_cotizado: price },
      });
      if (id_propuesta_lead != null && !proposal) throw new LeadConflict('La propuesta y su precio deben corresponder a la oportunidad.');
      return tx.opciones.create({
        data: {
          id_solicitud: request.id_solicitud, id_disponibilidad: slot.id_disponibilidad,
          precio_ofrecido: price, estado_respuesta: 'Pendiente',
          id_propuesta_lead: proposal?.id_propuesta, id_preferencia_lead: preference?.id_preferencia,
          pref_fecha_lead: pref_fecha_lead ? parseCalendarDate(pref_fecha_lead) : null,
          pref_dia_semana_lead: pref_dia_semana_lead ?? preference?.Horario?.dia_semana,
          pref_turno_lead, ofr_turno_lead,
          pref_hora_inicio_lead: time(pref_hora_inicio_lead) ?? preference?.Horario?.hora_inicio,
          pref_hora_fin_lead: time(pref_hora_fin_lead) ?? preference?.Horario?.hora_fin,
        },
        include: { Disponibilidad: { include: { Profesional: true, Sede: true } } },
      });
    }, serializable);
    res.status(201).json({ message: 'Alternativa registrada en el tablero', data: result });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Eliminar un LEAD ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id_persona = Number(req.params.id);
    await prisma.$transaction(async tx => {
      const person = await tx.personas.findUnique({ where: { id_persona }, include: { Etapa: true } });
      if (person?.Etapa?.nombre !== 'LEAD') throw new LeadConflict('Solo se puede archivar una negociación en LEAD.');
      const opportunity = await tx.solicitudes.findFirst({
        where: { id_persona, archivada_lead_en: null },
        orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }], include: { Reservas: true },
      });
      if (!opportunity || opportunity.Reservas.length) throw new LeadConflict('La negociación tiene una reserva o ya está archivada.');
      await tx.solicitudes.update({
        where: { id_solicitud: opportunity.id_solicitud }, data: { archivada_lead_en: new Date() },
      });
    }, serializable);
    res.json({ message: 'Negociación archivada' });
  } catch (error) {
    return leadError(error, res);
  }
});

// ── Generar Flyer Publicitario con Canva Connect API ──────────────────────────
router.post('/:id/canva-flyer', async (req, res) => {
  const { id } = req.params;
  const {
    serviceName,
    sedeName,
    doctorName,
    offeredPrice,
    originalPrice,
    discountPct,
    expirationDate,
    fechaLimite,
    diasFaltantes,
    horarioTexto,
    tituloFlyer,
    conditions,
    sendEmail,
    leadEmail,
    leadPhone,
  } = req.body;

  try {
    const lead = await withRetry(() =>
      prisma.personas.findUnique({
        where: { id_persona: Number(id) },
        include: {
          Solicitudes: {
            include: {
              Servicio: true,
            },
          },
        },
      })
    );

    const leadName = lead ? `${lead.nombres} ${lead.apellidos}` : 'Paciente';
    const finalEmail = leadEmail || lead?.email || undefined;
    const finalPhone = leadPhone || lead?.numero || undefined;

    const numOffered = Number(offeredPrice) || 150;
    const numOriginal = Number(originalPrice) || 180;
    let computedDiscount = Number(discountPct);
    if (isNaN(computedDiscount) || computedDiscount <= 0) {
      if (numOriginal > numOffered) {
        computedDiscount = Math.round(((numOriginal - numOffered) / numOriginal) * 100);
      } else {
        computedDiscount = 20;
      }
    }

    let resolvedSede = (sedeName || '').trim();
    if (!resolvedSede || (!resolvedSede.includes('-') && !resolvedSede.includes(','))) {
      const matchSede = await prisma.sedes.findFirst({
        where: {
          OR: [
            { nombre: { contains: resolvedSede || 'California' } },
            { id_sede: isNaN(Number(resolvedSede)) ? -1 : Number(resolvedSede) }
          ],
          activo: true
        }
      });
      if (matchSede) {
        resolvedSede = `${matchSede.nombre} - ${matchSede.direccion}`;
      } else {
        resolvedSede = 'Sede California - Av. Larco 820, Urb. California, Trujillo';
      }
    }

    const result = await NegotiatorAgentService.processAndDispatch({
      leadId: Number(id),
      leadName,
      leadEmail: finalEmail,
      leadPhone: finalPhone,
      serviceName: serviceName || lead?.Solicitudes?.[0]?.Servicio?.nombre || 'Consulta Odontológica',
      sedeName: resolvedSede,
      offeredPrice: numOffered,
      originalPrice: numOriginal,
      discountPct: computedDiscount,
      expirationDate: expirationDate || 'Vigente por 7 días',
      fechaLimite: fechaLimite || expirationDate,
      diasFaltantes,
      horarioTexto,
      tituloFlyer,
      conditions: conditions || 'Garantía clínica y reserva asegurada.',
      canvaTemplateId: process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo',
      sendEmail: Boolean(sendEmail),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error al generar flyer en Canva:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el flyer con Canva' });
  }
});

// ── Enviar Correo de Oferta en Modo Simulación (al correo personal/prueba) ─────
router.post(['/send-offer-email', '/:id/send-email'], async (req, res) => {
  const id = req.params.id || req.body.leadId;
  const {
    serviceName,
    sedeName,
    offeredPrice,
    originalPrice,
    discountPct,
    expirationDate,
    conditions,
    leadEmail,
    leadPhone,
    canvaFlyerUrl,
    canvaDesignUrl,
  } = req.body;

  try {
    const lead = id
      ? await withRetry(() =>
          prisma.personas.findUnique({
            where: { id_persona: Number(id) },
            include: {
              Solicitudes: {
                include: {
                  Servicio: true,
                },
              },
            },
          })
        )
      : null;

    const leadName = lead ? `${lead.nombres} ${lead.apellidos}` : 'Paciente';
    const finalEmail = leadEmail || lead?.email || undefined;
    const finalPhone = leadPhone || lead?.numero || undefined;

    const numOffered = Number(offeredPrice) || 150;
    const numOriginal = Number(originalPrice) || 180;
    let computedDiscount = Number(discountPct);
    if (isNaN(computedDiscount) || computedDiscount <= 0) {
      if (numOriginal > numOffered) {
        computedDiscount = Math.round(((numOriginal - numOffered) / numOriginal) * 100);
      } else {
        computedDiscount = 20;
      }
    }

    const result = await NegotiatorAgentService.sendSimulationOfferEmail({
      leadId: Number(id),
      leadName,
      leadEmail: finalEmail,
      leadPhone: finalPhone,
      serviceName: serviceName || lead?.Solicitudes?.[0]?.Servicio?.nombre || 'Consulta Odontológica',
      sedeName: sedeName || 'Sede Miraflores - Av. Larco 123',
      offeredPrice: numOffered,
      originalPrice: numOriginal,
      discountPct: computedDiscount,
      expirationDate: expirationDate || 'Vigente por 7 días',
      conditions: conditions || 'Garantía clínica y reserva asegurada.',
      canvaFlyerUrl: canvaFlyerUrl || undefined,
      canvaDesignUrl: canvaDesignUrl || undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error al enviar correo de simulación:', error);
    res.status(500).json({ error: error.message || 'Error al enviar correo' });
  }
});


// ── Obtener datos públicos de la oferta para pre-reserva online ──────────────
router.get('/public/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    const lead = await withRetry(() =>
      prisma.personas.findUnique({
        where: { id_persona: numId },
        include: {
          Solicitudes: {
            where: { archivada_lead_en: null },
            orderBy: { fecha_solicitud: 'desc' },
            take: 1,
            include: {
              Servicio: {
                include: { Tarifas: { where: { activo: true }, take: 1 } }
              },
              Opciones: {
                where: { archivada_lead_en: null },
                include: {
                  Disponibilidad: {
                    include: { Sede: true, Profesional: true }
                  }
                },
                orderBy: { id_opcion: 'desc' }
              }
            }
          },
          SaludOdontologica: {
            orderBy: { id_salud_odonto: 'desc' },
            take: 1
          },
          Preferencias: true
        }
      })
    );

    if (!lead) {
      return res.status(404).json({ error: 'No se encontró la propuesta comercial para este paciente.' });
    }

    const sol = lead.Solicitudes?.[0];
    const opciones = sol?.Opciones || [];
    const activeOpt = opciones.find(o => o.seleccionada) || (opciones.length > 0 ? opciones[0] : null);

    const sedesList = await withRetry(() => prisma.sedes.findMany({ where: { activo: true } }));

    const serviceName = sol?.Servicio?.nombre || 'Consulta Odontológica';
    const originalPrice = Number(sol?.Servicio?.Tarifas?.[0]?.precio || 180);
    const offeredPrice = activeOpt ? Number(activeOpt.precio_ofrecido) : 150;
    const discountPct = originalPrice > 0 && offeredPrice < originalPrice
      ? Math.round(((originalPrice - offeredPrice) / originalPrice) * 100)
      : 20;

    const rawFecha = activeOpt?.Disponibilidad?.fecha ? activeOpt.Disponibilidad.fecha.toISOString().split('T')[0] : '';
    const rawHora = activeOpt?.Disponibilidad?.hora_inicio ? activeOpt.Disponibilidad.hora_inicio.toISOString().split('T')[1].substring(0, 5) : '10:00';

    // Obtener servicios relacionados con tarifa comercial preferente
    const commercialInfo = await getServicioCommercialInfo(sol?.Servicio?.id_servicio || serviceName);
    let rawRelated = commercialInfo.serviciosRelacionados || [];
    if (rawRelated.length === 0) {
      const currentId = sol?.Servicio?.id_servicio || 1;
      const otherServices = await withRetry(() =>
        prisma.servicios.findMany({
          where: { id_servicio: { not: currentId }, activo: true },
          take: 2,
          include: {
            Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
          },
        })
      );
      rawRelated = otherServices.map((r: any) => ({
        id_servicio: r.id_servicio,
        nombre: r.nombre,
        descripcion: r.descripcion || '',
        precio: r.Tarifas?.[0] ? Number(r.Tarifas[0].precio) : 120,
        imgUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
      }));
    }

    const relatedServices = rawRelated.map((rel: any) => {
      const orig = Number(rel.precio || 120);
      const disc = discountPct > 0 ? discountPct : (commercialInfo.descuentosPermitidos?.[0] || 15);
      const off = Math.round(orig * (1 - disc / 100));
      return {
        id_servicio: rel.id_servicio,
        nombre: rel.nombre,
        descripcion: rel.descripcion,
        originalPrice: orig,
        offeredPrice: off,
        discountPct: disc,
        imgUrl: rel.imgUrl || 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
      };
    });

    // Catálogo completo de servicios activos de la clínica (por si el paciente busca otro tratamiento)
    const allServicesList = await withRetry(() =>
      prisma.servicios.findMany({
        where: { activo: true },
        include: {
          Tarifas: { where: { activo: true }, take: 1, orderBy: { fecha_inicio: 'desc' } },
        },
        orderBy: { nombre: 'asc' },
      })
    );

    const catalogServices = allServicesList.map((srv: any) => {
      const pRegular = srv.Tarifas?.[0] ? Number(srv.Tarifas[0].precio) : 150;
      const disc = discountPct > 0 ? discountPct : 15;
      const pOffered = Math.round(pRegular * (1 - disc / 100));
      return {
        id_servicio: srv.id_servicio,
        nombre: srv.nombre,
        descripcion: srv.descripcion || 'Tratamiento odontológico profesional NexoSalud.',
        originalPrice: pRegular,
        offeredPrice: pOffered,
        discountPct: disc,
      };
    });

    res.json({
      id_persona: lead.id_persona,
      patientName: `${lead.nombres} ${lead.apellidos}`.trim(),
      firstName: lead.nombres,
      lastName: lead.apellidos,
      dni: lead.dni || '',
      phone: lead.numero || '',
      email: lead.email || '',
      id_servicio: sol?.Servicio?.id_servicio || 1,
      serviceName,
      serviceDescription: sol?.Servicio?.descripcion || 'Atención odontológica integral con evaluación clínica completa.',
      originalPrice,
      offeredPrice,
      discountPct,
      relatedServices,
      catalogServices,
      expirationDate: rawFecha,
      sede: activeOpt?.Disponibilidad?.Sede
        ? `${activeOpt.Disponibilidad.Sede.nombre}${activeOpt.Disponibilidad.Sede.direccion ? ' - ' + activeOpt.Disponibilidad.Sede.direccion : ''}`
        : (sedesList[0] ? `${sedesList[0].nombre}${sedesList[0].direccion ? ' - ' + sedesList[0].direccion : ''}` : 'Sede California - Av. Larco 820, Urb. California, Trujillo'),
      sedeId: activeOpt?.Disponibilidad?.Sede?.id_sede || sedesList[0]?.id_sede || 1,
      doctor: activeOpt?.Disponibilidad?.Profesional?.apellidos ? `Esp. ${activeOpt.Disponibilidad.Profesional.nombres} ${activeOpt.Disponibilidad.Profesional.apellidos}` : 'Especialistas Colegiados',
      id_solicitud: sol?.id_solicitud,
      id_opcion: activeOpt?.id_opcion,
      id_disponibilidad: activeOpt?.id_disponibilidad,
      horaSugerida: rawHora,
      nivelDolor: lead.SaludOdontologica?.[0]?.nivel_dolor || 'Ninguno',
      alergias: lead.SaludOdontologica?.[0]?.condicion_atencion_especial || '',
      sedes: sedesList,
    });
  } catch (error: any) {
    console.error('Error al obtener oferta pública:', error);
    res.status(500).json({ error: error.message || 'Error al obtener oferta pública' });
  }
});

// ── Procesar Pre-Reserva Oficial desde la conversación / formulario web ───────
router.post('/public/:id/pre-reserve', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  if (isNaN(numId)) return res.status(400).json({ error: 'ID de paciente inválido' });

  const {
    dni,
    nombres,
    apellidos,
    numero,
    email,
    id_servicio_seleccionado,
    selectedServiceName,
    esParaFamiliar,
    nombreFamiliar,
    parentesco,
    id_opcion,
    id_solicitud,
    id_sede,
    fecha,
    hora,
    nivelDolor,
    alergias,
    canal_pago,
    dudaOComentario,
  } = req.body;

  let fechaCita: Date;
  let inicioTurno: Date;
  let finTurno: Date;
  try {
    fechaCita = parseCalendarDate(fecha);
    const turno = /^([01]\d|2[0-3]):([0-5]\d) - ([01]\d|2[0-3]):([0-5]\d)/.exec(hora || '');
    if (!turno) throw new Error('Turno inválido');
    inicioTurno = new Date(`1970-01-01T${turno[1]}:${turno[2]}:00.000Z`);
    finTurno = new Date(`1970-01-01T${turno[3]}:${turno[4]}:00.000Z`);
    if (finTurno <= inicioTurno) throw new Error('Turno inválido');
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  try {
    let etapaPayer = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'PAYER' } }));
    if (!etapaPayer) etapaPayer = await withRetry(() => prisma.etapas.create({ data: { nombre: 'PAYER', descripcion: 'Pre-reserva y pago coordinado' } }));

    const etapaLead = await withRetry(() => prisma.etapas.findFirst({ where: { nombre: 'LEAD' } }));

    const result = await withRetry(() =>
      prisma.$transaction(async (tx) => {
        const request = await tx.solicitudes.findFirst({
          where: {
            id_persona: numId, id_solicitud: id_solicitud == null ? undefined : Number(id_solicitud),
            archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } },
          },
          orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud: 'desc' }],
        });
        if (!request || (id_servicio_seleccionado && request.id_servicio !== Number(id_servicio_seleccionado))) {
          throw new LeadConflict('El tratamiento debe corresponder a una oferta vigente.');
        }
        const solId = request.id_solicitud;
        let opcionActiva = await tx.opciones.findFirst({
          where: {
            id_solicitud: solId, id_opcion: id_opcion == null ? undefined : Number(id_opcion),
            archivada_lead_en: null, Reservas: { none: {} },
            OR: [{ estado_respuesta: null }, { estado_respuesta: { not: 'Rechazada' } }],
            Disponibilidad: {
              estado: 'Disponible', fecha: fechaCita, hora_inicio: inicioTurno, hora_fin: finTurno,
              id_sede: id_sede == null ? undefined : Number(id_sede),
            },
          },
          include: { Disponibilidad: { include: { Sede: true, Profesional: true } } },
        });
        if (!opcionActiva && id_opcion) {
          const original = await tx.opciones.findFirst({
            where: {
              id_opcion: Number(id_opcion), id_solicitud: solId, archivada_lead_en: null,
              Reservas: { none: {} }, OR: [{ estado_respuesta: null }, { estado_respuesta: 'Pendiente' }],
            },
            include: { Disponibilidad: true },
          });
          const offered = original && await tx.disponibilidad.findFirst({
            where: {
              estado: 'Disponible', fecha: fechaCita, hora_inicio: inicioTurno, hora_fin: finTurno,
              id_sede: id_sede == null ? original.Disponibilidad.id_sede : Number(id_sede),
              id_profesional: original.Disponibilidad.id_profesional,
            },
          });
          if (original && offered) {
            opcionActiva = await tx.opciones.update({
              where: { id_opcion: original.id_opcion },
              data: { id_disponibilidad: offered.id_disponibilidad, ofr_turno_lead: null },
              include: { Disponibilidad: { include: { Sede: true, Profesional: true } } },
            });
          }
        }
        if (!opcionActiva) throw new LeadConflict('El horario elegido debe corresponder a una disponibilidad vigente.');

        // 1. Actualizar Persona con DNI, teléfono y autorización legal
        const updatedPersona = await tx.personas.update({
          where: { id_persona: numId },
          data: {
            dni: dni ? String(dni).substring(0, 8) : undefined,
            nombres: nombres || undefined,
            apellidos: apellidos || undefined,
            numero: numero || undefined,
            email: email || undefined,
            autoriza_contacto: true,
            fecha_autorizacion: new Date(),
            id_etapa_actual: etapaPayer!.id_etapa,
            fecha_actualizacion: new Date(),
          },
        });

        // 2. Si la atención es para un familiar, actualizar el motivo en Solicitudes
        const detalleAtencion = esParaFamiliar && nombreFamiliar
          ? `[Atención para ${parentesco || 'Familiar'}: ${nombreFamiliar}] ${dudaOComentario || ''}`.trim()
          : (dudaOComentario ? `[Comentario: ${dudaOComentario}]` : undefined);

        const updateSolData: any = { estado: 'Convertida' };
        if (detalleAtencion) {
          updateSolData.motivo = detalleAtencion;
        }

        await tx.solicitudes.update({
          where: { id_solicitud: solId },
          data: updateSolData,
        });

        // 3. Registrar o actualizar antecedentes médicos en PersonaSaludOdontologica
        const existingSalud = await tx.personaSaludOdontologica.findFirst({ where: { id_persona: numId } });
        if (existingSalud) {
          await tx.personaSaludOdontologica.update({
            where: { id_salud_odonto: existingSalud.id_salud_odonto },
            data: {
              nivel_dolor: nivelDolor || existingSalud.nivel_dolor,
              condicion_atencion_especial: alergias || existingSalud.condicion_atencion_especial,
            },
          });
        } else if (nivelDolor || alergias) {
          await tx.personaSaludOdontologica.create({
            data: {
              id_persona: numId,
              nivel_dolor: nivelDolor || 'Ninguno',
              condicion_atencion_especial: alergias || 'Ninguna',
            },
          });
        }

        // 4. Seleccionar la opción en Opciones
        await tx.opciones.update({
          where: { id_opcion: opcionActiva.id_opcion },
          data: {
            seleccionada: true,
            ...(opcionActiva.estado_respuesta !== 'Aceptada' && { estado_respuesta: 'Aceptada', fecha_respuesta: new Date() }),
          },
        });

        // 5. Crear la Reserva con código y bloqueo de 48 horas
        const fechaBloqueo = new Date(Date.now() + 48 * 3600 * 1000);
        const reserva = await tx.reservas.create({
          data: {
            id_persona: numId,
            id_solicitud: solId,
            id_opcion: opcionActiva.id_opcion,
            estado: 'Pre-reservada',
            fecha_reserva: new Date(),
            fecha_vencimiento_bloqueo: fechaBloqueo,
            confirmacion_explicita: true,
            fecha_confirmacion: new Date(),
          },
        });

        // 6. Generar Pago en estado Pendiente con la modalidad seleccionada
        const refPago = `PR-${reserva.id_reserva.toString().padStart(5, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const pago = await tx.pagos.create({
          data: {
            id_persona: numId,
            id_reserva: reserva.id_reserva,
            importe: opcionActiva.precio_ofrecido,
            canal_pago: canal_pago || 'Efectivo en clínica',
            referencia_pago: refPago,
            estado: 'Pendiente',
            observaciones: 'Pre-reserva online acordada con el Agente Negociador.',
          },
        });

        // 7. Evento de Etapa: LEAD -> PAYER
        await tx.eventosEtapa.create({
          data: {
            id_persona: numId,
            etapa_origen: etapaLead?.id_etapa || 2,
            etapa_destino: etapaPayer!.id_etapa,
            motivo: 'Pre-reserva online confirmada por el paciente',
            evidencia: `Código de Pre-Reserva: NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
          },
        });

        await tx.disponibilidad.update({
          where: { id_disponibilidad: opcionActiva.id_disponibilidad }, data: { estado: 'Ocupado' },
        });

        // 9. Registrar interacción en la bitácora
        await tx.interacciones.create({
          data: {
            id_persona: numId,
            id_solicitud: solId,
            tipo: 'Portal Web Pre-Reserva',
            mensaje: `Pre-reserva emitida por el paciente. Tratamiento: ${selectedServiceName || 'Odontología'}. Modalidad: ${canal_pago || 'En clínica'}. Código: NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
            resultado: 'Pre-reserva formalizada exitosamente',
            es_respuesta_util: true,
          },
        });

        return {
          reservaId: reserva.id_reserva,
          codigoReserva: `NEXO-${reserva.id_reserva.toString().padStart(5, '0')}`,
          persona: updatedPersona,
          pago,
          opcion: opcionActiva,
        };
      }, serializable)
    );

    res.json({
      success: true,
      message: '¡Pre-reserva completada exitosamente!',
      data: result,
    });
  } catch (error: any) {
    return leadError(error, res);
  }
});

export default router;

