import express from 'express';
import { prisma } from '../db';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const etapasTurned = await prisma.etapas.findFirst({ where: { nombre: 'TURNED' } });
    if (!etapasTurned) return res.json([]);

    const personas = await prisma.personas.findMany({
      where: { id_etapa_actual: etapasTurned.id_etapa },
      orderBy: { fecha_registro: 'desc' },
      include: {
        Solicitudes: { include: { Servicio: true, Opciones: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } } } },
        Reservas: true,
        Atenciones: true,
        Interacciones: { include: { Canal: true } }
      }
    });

    const turneds = personas.map(p => {
      const solicitud = p.Solicitudes[p.Solicitudes.length - 1];
      const reserva = p.Reservas[p.Reservas.length - 1];
      const atencion = p.Atenciones[p.Atenciones.length - 1];
      const opcion = solicitud?.Opciones.find(o => o.seleccionada);
      const followUps = p.Interacciones.filter(i => i.tipo === 'POSTVENTA');

      let parsedObs: any = {};
      try {
        parsedObs = atencion?.observaciones ? JSON.parse(atencion.observaciones) : {};
      } catch (e) {
        parsedObs = {};
      }

      let state = 'FOLLOW_UP_PENDING';
      if (followUps.length > 0) state = 'IN_FOLLOW_UP';
      if (parsedObs.finalResult) state = 'CLOSED';
      if (parsedObs.newRequestCreated) state = 'NEW_REQUEST';

      return {
        id: p.id_persona.toString(),
        customerId: p.id_persona.toString(),
        state,
        createdAt: p.fecha_registro.toISOString(),
        finalResult: parsedObs.finalResult || undefined,
        satisfaction: parsedObs.satisfaction !== undefined ? parsedObs.satisfaction : undefined,
        customerComment: parsedObs.customerComment || '',
        endDate: parsedObs.endDate || undefined,
        nextContactDate: parsedObs.nextContactDate || undefined,
        person: {
          id: p.id_persona.toString(),
          firstName: p.nombres,
          lastName: p.apellidos,
          documentNumber: p.dni,
          email: p.email,
          phone: p.numero
        },
        lead: {
          requestedServiceId: solicitud?.Servicio?.nombre || ''
        },
        reservation: reserva ? {
          date: reserva.fecha_reserva ? reserva.fecha_reserva.toISOString() : new Date().toISOString(),
          professionalId: opcion?.Disponibilidad?.Profesional?.apellidos || 'Sin asignar',
          branchId: opcion?.Disponibilidad?.Sede?.nombre || 'Sin sede'
        } : null,
        attention: atencion ? {
          startTime: atencion.fecha_atencion.toISOString(),
          endTime: atencion.fecha_atencion.toISOString()
        } : null,
        followUps: followUps.map(f => ({
          id: f.id_interaccion.toString(),
          date: f.fecha_hora.toISOString(),
          channel: f.Canal?.nombre || '',
          contactResult: f.resultado,
          observations: f.mensaje || '',
          nextFollowUpDate: parsedObs.nextContactDate || ''
        }))
      };
    });

    res.json(turneds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar TURNED' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await prisma.personas.findUnique({
      where: { id_persona: Number(id) },
      include: {
        Solicitudes: { include: { Servicio: true, Opciones: { include: { Disponibilidad: { include: { Profesional: true, Sede: true } } } } } },
        Reservas: true,
        Atenciones: true,
        Interacciones: { include: { Canal: true } }
      }
    });

    if (!p) return res.status(404).json({ error: 'Not found' });

    const solicitud = p.Solicitudes[p.Solicitudes.length - 1];
    const reserva = p.Reservas[p.Reservas.length - 1];
    const atencion = p.Atenciones[p.Atenciones.length - 1];
    const opcion = solicitud?.Opciones.find(o => o.seleccionada);
    const followUps = p.Interacciones.filter(i => i.tipo === 'POSTVENTA');

    let parsedObs: any = {};
    try {
      parsedObs = atencion?.observaciones ? JSON.parse(atencion.observaciones) : {};
    } catch (e) {
      parsedObs = {};
    }

    let state = 'FOLLOW_UP_PENDING';
    if (followUps.length > 0) state = 'IN_FOLLOW_UP';
    if (parsedObs.finalResult) state = 'CLOSED';
    if (parsedObs.newRequestCreated) state = 'NEW_REQUEST';

    res.json({
      id: p.id_persona.toString(),
      customerId: p.id_persona.toString(),
      state,
      createdAt: p.fecha_registro.toISOString(),
      finalResult: parsedObs.finalResult || undefined,
      satisfaction: parsedObs.satisfaction !== undefined ? parsedObs.satisfaction : undefined,
      customerComment: parsedObs.customerComment || '',
      endDate: parsedObs.endDate || undefined,
      nextContactDate: parsedObs.nextContactDate || undefined,
      person: {
        id: p.id_persona.toString(),
        firstName: p.nombres,
        lastName: p.apellidos,
        documentNumber: p.dni,
        email: p.email,
        phone: p.numero
      },
      lead: {
        requestedServiceId: solicitud?.Servicio?.nombre || ''
      },
      reservation: reserva ? {
        date: reserva.fecha_reserva ? reserva.fecha_reserva.toISOString() : new Date().toISOString(),
        professionalId: opcion?.Disponibilidad?.Profesional?.apellidos || 'Sin asignar',
        branchId: opcion?.Disponibilidad?.Sede?.nombre || 'Sin sede'
      } : null,
      attention: atencion ? {
        startTime: atencion.fecha_atencion.toISOString(),
        endTime: atencion.fecha_atencion.toISOString()
      } : null,
      followUps: followUps.map(f => ({
        id: f.id_interaccion.toString(),
        date: f.fecha_hora.toISOString(),
        channel: f.Canal?.nombre || '',
        contactResult: f.resultado,
        observations: f.mensaje || '',
        nextFollowUpDate: parsedObs.nextContactDate || ''
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/:id/follow-up', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const p = await prisma.personas.findUnique({ where: { id_persona: Number(id) }});
    if (!p) return res.status(404).json({ error: 'Not found' });

    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });

    if (atencion) {
      let parsedObs: any = {};
      try { parsedObs = atencion.observaciones ? JSON.parse(atencion.observaciones) : {}; } catch (e) {}
      parsedObs.nextContactDate = data.nextFollowUpDate;
      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { observaciones: JSON.stringify(parsedObs).substring(0, 500) }
      });
    }

    const canal = data.channel
      ? await prisma.canales.findFirst({ where: { nombre: data.channel } })
      : null;
    const interaccion = await prisma.interacciones.create({
      data: {
        id_persona: Number(id),
        tipo: 'POSTVENTA',
        id_canal: canal?.id_canal,
        resultado: data.contactResult,
        mensaje: data.observations || '',
      }
    });

    res.json({ message: 'Follow-up created', id: interaccion.id_interaccion.toString() });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/:id/details', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    
    if (atencion) {
      let parsedObs: any = {};
      try { parsedObs = atencion.observaciones ? JSON.parse(atencion.observaciones) : {}; } catch (e) {}
      parsedObs.finalResult = data.finalResult;
      parsedObs.satisfaction = data.satisfaction;
      parsedObs.customerComment = data.customerComment;
      parsedObs.endDate = new Date().toISOString();

      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { observaciones: JSON.stringify(parsedObs).substring(0, 500) }
      });
    }

    res.json({ message: 'Details updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/:id/new-request', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const atencion = await prisma.atenciones.findFirst({
      where: { id_persona: Number(id) },
      orderBy: { id_atencion: 'desc' }
    });
    
    if (atencion) {
      let parsedObs: any = {};
      try { parsedObs = atencion.observaciones ? JSON.parse(atencion.observaciones) : {}; } catch (e) {}
      parsedObs.newRequestCreated = true;

      await prisma.atenciones.update({
        where: { id_atencion: atencion.id_atencion },
        data: { observaciones: JSON.stringify(parsedObs).substring(0, 500) }
      });
    }

    const personaOriginal = await prisma.personas.findUnique({ where: { id_persona: Number(id) } });
    if (personaOriginal) {
      let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
      if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Persona con intención administrativa concreta' } });

      // H10 / Contrato 4.1: No duplicar la identidad en Personas (UQ_Personas_DNI_NotNull);
      // reutilizar el id_persona existente y abrir una nueva Solicitud comercial vinculada.
      await prisma.personas.update({
        where: { id_persona: personaOriginal.id_persona },
        data: {
          autoriza_contacto: data.contactAuthorization ?? personaOriginal.autoriza_contacto,
          id_etapa_actual: etapaLead.id_etapa,
          fecha_actualizacion: new Date(),
        },
      });

      const servicio = data.serviceOfInterestId
        ? await prisma.servicios.findFirst({ where: { nombre: data.serviceOfInterestId } })
        : null;

      await prisma.solicitudes.create({
        data: {
          id_persona: personaOriginal.id_persona,
          id_servicio: servicio ? servicio.id_servicio : 1,
          motivo: data.concreteRequest || 'Reactivación postventa desde TURNED',
          tipo_consulta: 'Reactivación Postventa',
          prioridad: 'Media',
          estado: 'Abierta',
        },
      });
    }

    res.json({ message: 'New request created', newBuyerId: personaOriginal ? personaOriginal.id_persona.toString() : undefined });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
