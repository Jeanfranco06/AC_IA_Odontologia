import { Router } from 'express';
import { createHash } from 'node:crypto';
import { Prisma, type Personas } from '@prisma/client';
import { prisma } from '../db';
import { MartSyncService } from '../services/martSyncService';

const router = Router();

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class BuyerInputError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

async function writeBuyer<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(action, serializable);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2002'].includes(error.code) || attempt === 3) throw error;
    }
  }
}

async function findBuyerIdentity(tx: Prisma.TransactionClient, dni: string | null, email: string | null, phone: string | null) {
  const conditions: Prisma.Sql[] = [];
  if (dni) conditions.push(Prisma.sql`dni=${dni}`);
  if (email) conditions.push(Prisma.sql`LOWER(LTRIM(RTRIM(email)))=${email}`);
  if (phone) conditions.push(Prisma.sql`RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(numero,' ',''),'-',''),'(',''),')',''),${phone.length})=${phone}`);
  if (!conditions.length) return null;
  const matches = await tx.$queryRaw<{ id_persona: number }[]>`
    SELECT TOP (2) id_persona FROM dbo.Personas WITH (UPDLOCK,HOLDLOCK)
    WHERE ${Prisma.join(conditions, ' OR ')} ORDER BY id_persona
  `;
  if (matches.length > 1) throw new BuyerInputError('Los datos de contacto coinciden con más de una persona.');
  return matches.length ? tx.personas.findUnique({ where: { id_persona: matches[0].id_persona } }) : null;
}

async function recordBuyerCapture(tx: Prisma.TransactionClient, person: Personas, input: {
  sourceId: number | null; serviceId: number | null; branchId: number | null; reason: string | null;
}) {
  await tx.$executeRaw`
    INSERT dbo.CaptacionesBuyer (id_persona,fecha_captacion,id_canal,id_fuente,id_campana,id_sede,
      id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
    SELECT p.id_persona,SYSDATETIME(),p.id_canal_origen,${input.sourceId},
      p.id_campana_origen,${input.branchId},${input.serviceId},${input.reason},
      p.estado_calidad,p.autoriza_contacto,p.fecha_autorizacion,'REGISTRO_DIRECTO'
    FROM dbo.Personas p WHERE p.id_persona=${person.id_persona}
      AND NOT EXISTS (SELECT 1 FROM dbo.CaptacionesBuyer WITH (UPDLOCK,HOLDLOCK) WHERE id_persona=p.id_persona)
  `;
}

async function captureBranch(tx: Prisma.TransactionClient, value: unknown) {
  if (value == null || value === '') return null;
  const branch = await tx.sedes.findFirst({ where: {
    activo: true,
    ...(/^\d+$/.test(String(value)) ? { id_sede: Number(value) } : { nombre: String(value) }),
  } });
  return branch?.id_sede ?? null;
}


// Helper functions to safely resolve foreign keys
async function getValidCanalId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.canales.findUnique({ where: { id_canal: Number(id) } });
    return item ? item.id_canal : null;
  } catch {
    return null;
  }
}

async function getValidFuenteId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.fuentes.findUnique({ where: { id_fuente: Number(id) } });
    return item ? item.id_fuente : null;
  } catch {
    return null;
  }
}

async function getValidServicioId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.servicios.findUnique({ where: { id_servicio: Number(id) } });
    return item ? item.id_servicio : null;
  } catch {
    return null;
  }
}

async function getValidCampanaId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.campanas.findUnique({ where: { id_campana: Number(id) } });
    return item ? item.id_campana : null;
  } catch {
    return null;
  }
}

async function getValidHorarioId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.horarios.findUnique({ where: { id_horario: Number(id) } });
    return item ? item.id_horario : null;
  } catch {
    return null;
  }
}

async function getValidModalidadId(tx: any, id: any): Promise<number | null> {
  if (!id || isNaN(Number(id))) return null;
  try {
    const item = await tx.modalidades.findUnique({ where: { id_modalidad: Number(id) } });
    if (item) return item.id_modalidad;
    const first = await tx.modalidades.findFirst();
    return first ? first.id_modalidad : null;
  } catch {
    return null;
  }
}

// Obtener catálogos para el formulario
router.get('/catalogs', async (req, res) => {
  try {
    const canales = await prisma.canales.findMany({ where: { activo: true } });
    const fuentes = await prisma.fuentes.findMany({ where: { activo: true } });
    const servicios = await prisma.servicios.findMany({ where: { activo: true } });
    const sedes = await prisma.sedes.findMany({ where: { activo: true } });
    
    // Asegurar modalidades si están vacías
    let modalidades = await prisma.modalidades.findMany();
    if (modalidades.length === 0) {
      try {
        await prisma.modalidades.createMany({
          data: [
            { nombre: 'Presencial' },
            { nombre: 'Virtual' },
            { nombre: 'Teleconsulta' },
            { nombre: 'Domiciliaria' }
          ]
        });
        modalidades = await prisma.modalidades.findMany();
      } catch (e) {
        console.warn('Could not auto-seed modalidades:', e);
      }
    }

    const horarios = await prisma.horarios.findMany();
    res.json({ canales, fuentes, servicios, sedes, modalidades, horarios });
  } catch (error) {
    console.error('Error al obtener catálogos:', error);
    res.status(500).json({ error: 'Error al obtener catálogos' });
  }
});

// Endpoint para verificar duplicidad en tiempo real (Client & Admin)
router.get('/check-duplicate', async (req, res) => {
  try {
    const { phone, email, dni, excludeId } = req.query;

    const rawPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const cleanPhone = rawPhone.length >= 9 ? rawPhone.slice(-9) : (rawPhone.length >= 7 ? rawPhone : null);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanDni = dni ? String(dni).trim() : null;

    if (!cleanPhone && !cleanEmail && !cleanDni) {
      return res.json({ isDuplicate: false });
    }

    const orConditions: any[] = [];
    if (cleanPhone) {
      orConditions.push({ numero: { contains: cleanPhone } });
    }
    if (cleanEmail && cleanEmail.includes('@')) {
      orConditions.push({ email: cleanEmail });
    }
    if (cleanDni && cleanDni.length >= 8) {
      orConditions.push({ dni: cleanDni });
    }

    if (orConditions.length === 0) {
      return res.json({ isDuplicate: false });
    }

    const whereClause: any = { OR: orConditions };
    if (excludeId && !isNaN(Number(excludeId))) {
      whereClause.id_persona = { not: Number(excludeId) };
    }

    const matchedPersons = await prisma.personas.findMany({
      where: whereClause,
      include: {
        Etapa: true,
      },
      take: 5
    });

    if (matchedPersons && matchedPersons.length > 0) {
      const matches = matchedPersons.map(p => {
        const phoneMatch = Boolean(cleanPhone && p.numero && p.numero.replace(/\D/g, '').includes(cleanPhone));
        const emailMatch = Boolean(cleanEmail && p.email && p.email.toLowerCase() === cleanEmail);
        const dniMatch = Boolean(cleanDni && p.dni && p.dni === cleanDni);

        const matchedFields: string[] = [];
        if (phoneMatch) matchedFields.push('Teléfono');
        if (emailMatch) matchedFields.push('Correo');
        if (dniMatch) matchedFields.push('DNI');

        let matchedByType = 'phone';
        if (phoneMatch && emailMatch) matchedByType = 'both';
        else if (emailMatch) matchedByType = 'email';
        else if (dniMatch) matchedByType = 'dni';

        return {
          id: p.id_persona,
          firstName: p.nombres,
          lastName: p.apellidos,
          fullName: `${p.nombres} ${p.apellidos}`.trim(),
          phone: p.numero,
          email: p.email,
          documentNumber: p.dni,
          etapa: p.Etapa?.nombre || 'BUYER',
          estadoCalidad: p.estado_calidad || 'Valido',
          matchedByType, // 'phone' | 'email' | 'both' | 'dni'
          matchedFieldsText: matchedFields.join(' y ') || 'Contacto',
        };
      });

      const hasPhoneMatch = matches.some(m => m.matchedByType === 'phone' || m.matchedByType === 'both');
      const hasEmailMatch = matches.some(m => m.matchedByType === 'email' || m.matchedByType === 'both');

      let overallMatchedBy: 'phone' | 'email' | 'both' | 'dni' = 'phone';
      if (hasPhoneMatch && hasEmailMatch) overallMatchedBy = 'both';
      else if (hasEmailMatch) overallMatchedBy = 'email';
      else if (hasPhoneMatch) overallMatchedBy = 'phone';
      else overallMatchedBy = 'dni';

      return res.json({
        isDuplicate: true,
        matchedBy: overallMatchedBy,
        matchesCount: matches.length,
        person: matches[0],
        matches,
      });
    }

    return res.json({ isDuplicate: false, matches: [] });
  } catch (error) {
    console.error('Error in check-duplicate:', error);
    res.status(500).json({ error: 'Error al verificar duplicados' });
  }
});

// Registrar BUYER e inmediatamente solicitar información (Convertir a LEAD si es único)
router.post('/register', async (req, res) => {
  const {
    nombres,
    apellidos,
    email,
    numero,
    autoriza_contacto,
    id_canal,
    id_fuente,
    id_servicio,
    sede_preferida,
    id_campana_origen,
    id_canal_origen,
    tipo_persona,
    estado_calidad,
    id_servicio_interes,
  } = req.body;

  try {
    const requestKey = req.get('Idempotency-Key')?.toLowerCase();
    if (requestKey && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestKey)) {
      throw new BuyerInputError('La clave de registro web debe ser un UUID.', 400);
    }
    const requestHash = requestKey ? createHash('sha256').update(JSON.stringify(
      Object.entries(req.body).sort(([a], [b]) => a.localeCompare(b)),
    )).digest('hex') : null;

    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) etapaBuyer = await prisma.etapas.create({ data: { nombre: 'BUYER', descripcion: 'Contacto inicial' } });

    let etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (!etapaLead) etapaLead = await prisma.etapas.create({ data: { nombre: 'LEAD', descripcion: 'Intención concreta' } });

    const rawNombres = (nombres || req.body.firstName || req.body.fullName || req.body.name || '').trim();
    const rawApellidos = (apellidos || req.body.lastName || '').trim();

    let resolvedNombres = rawNombres;
    let resolvedApellidos = rawApellidos;

    if (!resolvedApellidos && resolvedNombres.includes(' ')) {
      const parts = resolvedNombres.split(/\s+/);
      resolvedNombres = parts[0];
      resolvedApellidos = parts.slice(1).join(' ');
    }

    if (!resolvedNombres) resolvedNombres = 'Prospecto';
    if (!resolvedApellidos) resolvedApellidos = 'General';

    const rawDigits = numero ? String(numero).replace(/\D/g, '') : '';
    const cleanPhone = rawDigits.length >= 9 ? rawDigits.slice(-9) : (rawDigits.length >= 7 ? rawDigits : null);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    const result = await writeBuyer(async tx => {
      if (requestKey) {
        const [prior] = await tx.$queryRaw<{ id_solicitud: number; id_persona: number; request_hash: string }[]>`
          SELECT id_solicitud,id_persona,hash_registro_web_lead AS request_hash
          FROM dbo.Solicitudes WITH (UPDLOCK,HOLDLOCK) WHERE clave_registro_web_lead=${requestKey}
        `;
        if (prior) {
          if (prior.request_hash !== requestHash) throw new BuyerInputError('La clave ya se usó para otra solicitud.');
          const [persona, solicitud, totalConsultas] = await Promise.all([
            tx.personas.findUniqueOrThrow({ where: { id_persona: prior.id_persona } }),
            tx.solicitudes.findUniqueOrThrow({ where: { id_solicitud: prior.id_solicitud } }),
            tx.solicitudes.count({ where: { id_persona: prior.id_persona } }),
          ]);
          return { persona, solicitud, oportunidad: { id_oportunidad: solicitud.id_solicitud, id_persona: persona.id_persona },
            totalConsultas, isDuplicate: false, isNewPersonWithSharedContact: false, replayed: true };
        }
      }
      // 1. Detectar duplicado por teléfono o correo
      let isDuplicate = false;
      let existingPerson = null;
      const isNewPersonConfirmed = Boolean(req.body.isNewPersonConfirmed);

      if (!isNewPersonConfirmed) {
        existingPerson = await findBuyerIdentity(tx, null, cleanEmail, cleanPhone);
        isDuplicate = Boolean(existingPerson);
      }

      // 2. Canal Web y Fuente Web
      let webCanal = await tx.canales.findFirst({
        where: { nombre: { in: ['Página Web', 'Página Web / Portal Online'] }, activo: true },
        orderBy: { id_canal: 'asc' },
      });
      if (!webCanal) webCanal = await tx.canales.create({
        data: { nombre: 'Página Web / Portal Online', activo: true },
      });

      let webFuente = await tx.fuentes.findFirst({
        where: { nombre: { in: ['Formulario Web', 'Formulario Web - Portal NexoSalud'] }, activo: true },
        orderBy: { id_fuente: 'asc' },
      });
      if (!webFuente) webFuente = await tx.fuentes.create({
        data: { nombre: 'Formulario Web - Portal NexoSalud', activo: true },
      });

      const validCanal = (id_canal ? await getValidCanalId(tx, id_canal) : null) ?? webCanal.id_canal;
      const validCanalOrigen = (id_canal_origen ? await getValidCanalId(tx, id_canal_origen) : null) ?? validCanal;
      const validFuente = (id_fuente ? await getValidFuenteId(tx, id_fuente) : null) ?? webFuente.id_fuente;
      const validCampana = id_campana_origen ? await getValidCampanaId(tx, id_campana_origen) : null;
      const validServicio = await getValidServicioId(tx, id_servicio);
      const validServicioInteres = (await getValidServicioId(tx, id_servicio_interes)) || validServicio;

      let persona;
      let totalConsultas = 1;

      if (isDuplicate && existingPerson) {
        // ARQUITECTURA LIMPIA: No duplicamos la fila de persona. Anexamos la nueva consulta a su historial.
        const prevCount = await tx.solicitudes.count({ where: { id_persona: existingPerson.id_persona } });
        totalConsultas = prevCount + 1;

        persona = await tx.personas.update({
          where: { id_persona: existingPerson.id_persona },
          data: {
            email: email ? String(email).trim() : existingPerson.email,
            fecha_actualizacion: new Date(),
            // Al reiterar consulta, se reactiva y promueve a LEAD para negociación comercial
            id_etapa_actual: etapaLead.id_etapa,
            estado_calidad: 'Valido',
          }
        });

      } else {
        // Paciente nuevo: Creamos el registro único
        persona = await tx.personas.create({
          data: {
            nombres: resolvedNombres,
            apellidos: resolvedApellidos,
            email: email ? String(email).trim() : null,
            numero: numero ? String(numero).trim() : null,
            autoriza_contacto: autoriza_contacto || false,
            fecha_autorizacion: autoriza_contacto ? new Date() : null,
            id_campana_origen: validCampana,
            id_canal_origen: validCanalOrigen,
            tipo_persona: tipo_persona || 'Adulto General',
            estado_calidad: 'Valido',
            id_etapa_actual: etapaLead.id_etapa,
          }
        });

      }

      // Detalle de la duda o consulta específica ingresada por el paciente
      const prefix = isNewPersonConfirmed ? '[Contacto Compartido] ' : '';
      const rawInquiry = req.body.motivo_consulta || req.body.necesidad_declarada || req.body.duda_especifica;
      const motivoRaw = rawInquiry 
        ? `[Consulta #${totalConsultas}] ${rawInquiry}`
        : (req.body.concreteRequest || (isDuplicate ? `Consulta recurrente #${totalConsultas} desde portal web` : 'Solicitud de información desde formulario web'));
      const motivoConsulta = String(prefix + motivoRaw).slice(0, 195);

      let resolvedSede = sede_preferida || req.body.sede || null;
      if (!resolvedSede && req.body.id_sede) {
        const foundSede = await tx.sedes.findUnique({ where: { id_sede: Number(req.body.id_sede) } });
        if (foundSede) resolvedSede = foundSede.nombre;
      }

      // 1. Guardar la nueva Solicitud en su historial
      const solicitud = await tx.solicitudes.create({
        data: {
          id_persona: persona.id_persona,
          id_servicio: validServicio,
          motivo: motivoConsulta,
          fecha_ingreso_lead: new Date(),
          resultado_comercial_lead: 'PENDIENTE',
          id_canal_origen: validCanalOrigen,
        }
      });

      if (requestKey) {
        await tx.$executeRaw`UPDATE dbo.Solicitudes SET clave_registro_web_lead=${requestKey},
          hash_registro_web_lead=${requestHash} WHERE id_solicitud=${solicitud.id_solicitud}`;
      }

      if (!existingPerson || existingPerson.id_etapa_actual === etapaBuyer.id_etapa) {
        await recordBuyerCapture(tx, persona, {
          sourceId: validFuente, serviceId: validServicio ?? validServicioInteres,
          branchId: await captureBranch(tx, req.body.id_sede ?? resolvedSede), reason: motivoConsulta,
        });
        await tx.$executeRaw`
          INSERT dbo.EventosEtapa (id_persona,etapa_origen,etapa_destino,fecha_hora,motivo,
            id_captacion,id_solicitud,clave_operacion_buyer)
          SELECT id_persona,${etapaBuyer.id_etapa},${etapaLead.id_etapa},SYSDATETIME(),${motivoConsulta},
            id_captacion,${solicitud.id_solicitud},CONCAT('BUYER_LEAD:',id_captacion)
          FROM dbo.CaptacionesBuyer WHERE id_persona=${persona.id_persona}
        `;
      }

      // 2. Registrar la Interacción con trazabilidad de fecha y detalle
      await tx.interacciones.create({
        data: {
          id_persona: persona.id_persona,
          id_solicitud: solicitud.id_solicitud,
          id_canal: validCanal,
          id_fuente: validFuente,
          tipo: isDuplicate ? `Consulta Web Recurrente (#${totalConsultas})` : 'Registro y Solicitud de Info (Consulta #1)',
          mensaje: isDuplicate 
            ? `El usuario reiteró consulta vía web (Intento #${totalConsultas}). Duda/Motivo: ${motivoConsulta}. Sede preferida: ${resolvedSede || 'No especificada'}.`
            : `El usuario llenó el formulario público de solicitud de información. Duda/Motivo: ${motivoConsulta}.`
        }
      });

      // 3. Preferencias del paciente (Upsert)
      if (resolvedSede || validCanal || validServicioInteres) {
        const existingPref = await tx.personaPreferencias.findFirst({ where: { id_persona: persona.id_persona } });
        if (existingPref) {
          await tx.personaPreferencias.update({
            where: { id_preferencia: existingPref.id_preferencia },
            data: {
              id_canal: validCanal || existingPref.id_canal,
              id_servicio_interes: validServicioInteres || existingPref.id_servicio_interes,
              sede_preferida: resolvedSede || existingPref.sede_preferida,
            }
          });
        } else {
          await tx.personaPreferencias.create({
            data: {
              id_persona: persona.id_persona,
              id_canal: validCanal,
              id_servicio_interes: validServicioInteres,
              sede_preferida: resolvedSede || null,
            }
          });
        }
      }

      return { 
        persona, 
        solicitud, 
        oportunidad: { id_oportunidad: solicitud.id_solicitud, id_persona: persona.id_persona },
        isDuplicate, 
        existingPerson, 
        totalConsultas, 
        isNewPersonWithSharedContact: isNewPersonConfirmed 
      };
    });

    if ('replayed' in result) {
      return res.status(200).json({ success: true, consultationCount: result.totalConsultas, replayed: true, data: result });
    }
    if (result.isDuplicate) {
      return res.status(200).json({ 
        success: true, 
        isDuplicate: true, 
        isRecurring: true,
        consultationCount: result.totalConsultas,
        message: `¡Hola de nuevo! Anexamos tu nueva consulta a tu historial (Consulta #${result.totalConsultas}). Tu caso fue priorizado para atención en la etapa LEAD.`, 
        data: result 
      });
    }

    if (result.isNewPersonWithSharedContact) {
      return res.status(201).json({
        success: true,
        isDuplicate: false,
        isRecurring: false,
        isNewPersonWithSharedContact: true,
        consultationCount: 1,
        message: 'Registrado exitosamente como nuevo paciente independiente.',
        data: result
      });
    }

    MartSyncService.syncBuyer().catch(err => console.warn('[AutoSync] Error:', err.message));
    res.status(201).json({ 
      success: true, 
      isDuplicate: false, 
      isRecurring: false,
      consultationCount: 1,
      message: 'Solicitud registrada correctamente. Pasado a estado LEAD.', 
      data: result 
    });
  } catch (error: any) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    console.error('Error al registrar BUYER:', error);
    res.status(500).json({ 
      error: error?.message || 'Error al registrar al BUYER',
      details: error?.message
    });
  }
});

// Obtener la lista de BUYERS mapeada al formato que espera el frontend
router.get('/', async (req, res) => {
  try {
    const etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) return res.json([]);

    const personas = await prisma.personas.findMany({
      where: {
        OR: [
          { id_campana_origen: { not: null } },
          { id_canal_origen: { not: null } },
          { Etapa: { nombre: { in: ['BUYER', 'LEAD'] } } }
        ]
      },
      orderBy: { fecha_registro: 'desc' },
      include: {
        Etapa: true,
        CanalOrigen: true,
        CampanaOrigen: { include: { GastosCampana: true } },
        EventosEtapa: { include: { EtapaDestino: true }, orderBy: { fecha_hora: 'asc' } },
        Interacciones: { include: { Canal: true, Fuente: true }, orderBy: { fecha_hora: 'desc' } },
        Solicitudes: { include: { Servicio: true }, orderBy: { id_solicitud: 'desc' } },
        Preferencias: { include: { Canal: true } },
        DatosAcademicos: true,
        DatosLaborales: true,
        SaludOdontologica: true,
      }
    });

    // Precalcular frecuencias para identificar duplicados por teléfono (últimos 9 dígitos), DNI o correo
    const phoneCounts = new Map<string, number>();
    const dniCounts = new Map<string, number>();
    const emailCounts = new Map<string, number>();
    for (const p of personas) {
      const ph = (p.numero || '').replace(/\D/g, '').slice(-9);
      if (ph.length >= 8) {
        phoneCounts.set(ph, (phoneCounts.get(ph) || 0) + 1);
      }
      if (p.dni && p.dni.trim()) {
        const dn = p.dni.trim();
        dniCounts.set(dn, (dniCounts.get(dn) || 0) + 1);
      }
      if (p.email && p.email.trim() && p.email.includes('@')) {
        const em = p.email.trim().toLowerCase();
        emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
      }
    }

    // Mapeamos a BuyerWithPerson
    const buyers = personas.map(p => {
      const ph = (p.numero || '').replace(/\D/g, '').slice(-9);
      const em = p.email ? p.email.trim().toLowerCase() : '';
      const hasDuplicate = 
        (ph.length >= 8 && (phoneCounts.get(ph) || 0) > 1) ||
        (p.dni && (dniCounts.get(p.dni.trim()) || 0) > 1) ||
        (em && (emailCounts.get(em) || 0) > 1);

      const isDuplicate = hasDuplicate || p.estado_calidad === 'Duplicado';

      let state = 'NEW';
      if (p.estado_calidad === 'Rechazado') {
        state = 'DISCARDED';
      } else if (p.Etapa?.nombre === 'LEAD' || p.Etapa?.nombre === 'PAYER' || p.Etapa?.nombre === 'CUSTOMER' || p.Etapa?.nombre === 'TURNED') {
        state = 'CONVERTED';
      } else if (p.estado_calidad === 'Duplicado' || (isDuplicate && p.Etapa?.nombre === 'BUYER')) {
        state = 'DUPLICATED';
      }

      // Buscar fecha real de conversión a LEAD desde EventosEtapa
      const eventoConversion = p.EventosEtapa.find(e => e.EtapaDestino?.nombre === 'LEAD' || e.EtapaDestino?.nombre === 'PAYER' || e.EtapaDestino?.nombre === 'CUSTOMER');
      const convertedAt = eventoConversion 
        ? eventoConversion.fecha_hora.toISOString() 
        : (state === 'CONVERTED' ? (p.fecha_actualizacion || p.fecha_autorizacion || p.fecha_registro).toISOString() : undefined);

      const canalName = p.CanalOrigen?.nombre || 
        (p.Interacciones.length > 0 && p.Interacciones[0].Canal?.nombre) || 
        (p.Preferencias.length > 0 && p.Preferencias[0].Canal?.nombre) || 
        'Página Web / Portal Online';
      const canalId = p.id_canal_origen?.toString() || 
        (p.Interacciones.length > 0 && p.Interacciones[0].id_canal?.toString()) || 
        '';

      const fuenteName = (p.Interacciones.length > 0 && p.Interacciones[0].Fuente?.nombre) || 
        'Formulario Web - Portal NexoSalud';
      const fuenteId = (p.Interacciones.length > 0 && p.Interacciones[0].id_fuente?.toString()) || 
        '';

      const servicioName = p.Solicitudes.length > 0 && p.Solicitudes[0].Servicio
        ? p.Solicitudes[0].Servicio.nombre : undefined;
      const servicioId = p.Solicitudes.length > 0 && p.Solicitudes[0].id_servicio
        ? p.Solicitudes[0].id_servicio.toString() : undefined;

      const motivo = p.Solicitudes.length > 0 ? p.Solicitudes[0].motivo : undefined;

      const prefs = p.Preferencias.length > 0 ? p.Preferencias[0] : null;
      const aca = p.DatosAcademicos.length > 0 ? p.DatosAcademicos[0] : null;
      const lab = p.DatosLaborales.length > 0 ? p.DatosLaborales[0] : null;
      const sal = p.SaludOdontologica.length > 0 ? p.SaludOdontologica[0] : null;

      const campaignId = p.id_campana_origen?.toString();
      const campaignName = p.CampanaOrigen?.nombre;
      const campaignCost = p.CampanaOrigen?.GastosCampana?.reduce((sum, g) => sum + Number(g.importe), 0);

      const consultasCount = p.Solicitudes.length || 1;
      const solicitudesHistory = p.Solicitudes.map(s => ({
        id: s.id_solicitud.toString(),
        servicio: s.Servicio?.nombre || 'Consulta General',
        motivo: s.motivo || 'Sin detalle',
        fecha: s.fecha_solicitud ? s.fecha_solicitud.toISOString() : undefined,
      }));
      const interaccionesHistory = p.Interacciones.map(i => ({
        id: i.id_interaccion.toString(),
        tipo: i.tipo,
        mensaje: i.mensaje || '',
        canal: i.Canal?.nombre,
        fuente: i.Fuente?.nombre,
        fecha: i.fecha_hora.toISOString(),
      }));

      return {
        id: p.id_persona.toString(),
        personId: p.id_persona.toString(),
        person: {
          firstName: p.nombres,
          lastName: p.apellidos,
          documentNumber: p.dni,
          phone: p.numero,
          email: p.email,
        },
        channel: canalName,
        channelId: canalId,
        attractionSource: fuenteName,
        attractionSourceId: fuenteId,
        campaignId,
        campaignName,
        campaignCost,
        serviceOfInterest: servicioName,
        serviceOfInterestId: servicioId,
        contactAuthorization: p.autoriza_contacto,
        qualityStatus: isDuplicate ? 'Duplicado' : (p.estado_calidad || 'Valido'),
        concreteRequest: motivo,
        createdAt: p.fecha_registro.toISOString(),
        convertedAt,
        state,
        consultasCount,
        solicitudesHistory,
        interaccionesHistory,

        // Nuevos campos
        pref_id_canal: prefs?.id_canal?.toString() || '',
        pref_id_horario: prefs?.id_horario?.toString() || '',
        pref_id_modalidad: prefs?.id_modalidad?.toString() || '',
        pref_sede_preferida: prefs?.sede_preferida || '',
        pref_profesional_preferido: prefs?.profesional_preferido || '',

        estudianteAplica: aca?.aplica || false,
        universidad: aca?.universidad || '',
        carrera: aca?.carrera || '',
        ciclo: aca?.ciclo || '',

        laboralAplica: lab?.aplica || false,
        ocupacion: lab?.ocupacion || '',
        empresa: lab?.empresa || '',
        modalidadLaboral: lab?.modalidad || '',
        disponibilidadLaboral: lab?.disponibilidad || '',

        ultima_visita_odontologica: sal?.ultima_visita_odontologica || '',
        tratamiento_previo: sal?.tratamiento_previo || '',
        nivel_dolor: sal?.nivel_dolor || '',
        presenta_sensibilidad: sal?.presenta_sensibilidad || '',
        sangrado_o_inflamacion: sal?.sangrado_o_inflamacion || '',
        usa_aparato_o_protesis: sal?.usa_aparato_o_protesis || '',
        condicion_atencion_especial: sal?.condicion_atencion_especial || '',
      };
    });

    res.json(buyers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener buyers' });
  }
});

// Crear un BUYER (Dashboard)
router.post('/', async (req, res) => {
  const { 
    firstName, lastName, email, phone, documentNumber, channel, attractionSource, serviceOfInterestId, contactAuthorization, concreteRequest, id_campana_origen, id_canal_origen, tipo_persona, estado_calidad,
    pref_id_canal, pref_id_horario, pref_id_modalidad, pref_sede_preferida, pref_profesional_preferido,
    estudianteAplica, universidad, carrera, ciclo,
    laboralAplica, ocupacion, empresa, modalidadLaboral, disponibilidadLaboral,
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial
  } = req.body;
  try {
    let resolvedFirstName = (firstName || req.body.nombres || req.body.fullName || req.body.name || '').trim();
    let resolvedLastName = (lastName || req.body.apellidos || '').trim();

    if (!resolvedLastName && resolvedFirstName.includes(' ')) {
      const parts = resolvedFirstName.split(/\s+/);
      resolvedFirstName = parts[0];
      resolvedLastName = parts.slice(1).join(' ');
    }

    if (!resolvedFirstName) resolvedFirstName = 'Prospecto';
    if (!resolvedLastName) resolvedLastName = 'General';

    const rawDni = documentNumber || req.body.dni || '';
    const dniToSave = rawDni ? String(rawDni).trim() : null;
    if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });

    const rawPhone = phone || req.body.numero || '';
    const phoneToSave = rawPhone ? String(rawPhone).trim() : null;
    if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });

    const rawEmail = email || req.body.correo || null;
    const emailToSave = rawEmail ? String(rawEmail).trim().toLowerCase() : null;

    const authContact = contactAuthorization !== undefined 
      ? Boolean(contactAuthorization) 
      : (req.body.autoriza_contacto !== undefined ? Boolean(req.body.autoriza_contacto) : false);

    const rawCanalOrigen = id_canal_origen || channel || req.body.id_canal;
    const rawFuenteOrigen = attractionSource || req.body.id_fuente;
    const rawServicio = serviceOfInterestId || req.body.id_servicio || req.body.id_servicio_interes;
    const rawRequest = concreteRequest || req.body.duda_especifica || req.body.motivo;

    const result = await writeBuyer(async tx => {
      const etapaBuyer = await tx.etapas.findUniqueOrThrow({ where: { nombre: 'BUYER' } });
      const digits = phoneToSave?.replace(/\D/g, '') ?? '';
      const phone = digits.length >= 9 ? digits.slice(-9) : digits.length >= 7 ? digits : null;
      const existing = await findBuyerIdentity(tx, dniToSave, emailToSave, phone);
      if (existing) {
        if (dniToSave && existing.dni && existing.dni.trim() !== dniToSave) {
          throw new BuyerInputError('El contacto corresponde a una identidad distinta.');
        }
        const [capture] = await tx.$queryRaw<{ id_captacion: number }[]>`
          SELECT id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=${existing.id_persona}
        `;
        if (!capture) throw new BuyerInputError('El contacto histórico requiere validar su captación antes de convertirlo.');
        return { ...existing, id: existing.id_persona, isDuplicate: true };
      }

      const validCampana = await getValidCampanaId(tx, id_campana_origen);
      const validCanalOrigen = await getValidCanalId(tx, rawCanalOrigen);
      const validChannel = await getValidCanalId(tx, channel || req.body.id_canal);
      const validAttractionSource = await getValidFuenteId(tx, rawFuenteOrigen);
      const validService = await getValidServicioId(tx, rawServicio);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      const finalCalidad = estado_calidad || (emailToSave || phone ? 'Valido' : 'Incompleto');
      const captureReason = typeof rawRequest === 'string' ? rawRequest.trim().slice(0, 500) || null : null;

      const persona = await tx.personas.create({
        data: {
          nombres: resolvedFirstName,
          apellidos: resolvedLastName,
          email: emailToSave,
          numero: digits || null,
          dni: dniToSave,
          autoriza_contacto: authContact,
          fecha_autorizacion: authContact ? new Date() : null,
          id_campana_origen: validCampana,
          id_canal_origen: validCanalOrigen,
          tipo_persona: tipo_persona || 'Adulto General',
          estado_calidad: finalCalidad,
          id_etapa_actual: etapaBuyer.id_etapa,
        }
      });

      if (validChannel || validCanalOrigen || validAttractionSource) {
        await tx.interacciones.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validChannel || validCanalOrigen,
            id_fuente: validAttractionSource,
            tipo: 'Registro Inicial',
            mensaje: 'Creación de BUYER desde Dashboard'
          }
        });
      }

      if (rawRequest || validService) {
        await tx.solicitudes.create({
          data: {
            id_persona: persona.id_persona,
            id_servicio: validService,
            motivo: captureReason?.slice(0, 200) || 'Solicitud de información general'
          }
        });
      }

      // Gustos y Preferencias
      if (validPrefCanal || validPrefHorario || validPrefModalidad || pref_sede_preferida || pref_profesional_preferido) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: persona.id_persona,
            id_canal: validPrefCanal,
            id_horario: validPrefHorario,
            id_modalidad: validPrefModalidad,
            sede_preferida: pref_sede_preferida || null,
            profesional_preferido: pref_profesional_preferido || null,
          }
        });
      }

      // Datos Estudiante
      if (estudianteAplica) {
        await tx.datosAcademicos.create({
          data: {
            id_persona: persona.id_persona,
            aplica: true,
            universidad: universidad || null,
            carrera: carrera || null,
            ciclo: ciclo || null,
          }
        });
      }

      // Datos Laborales
      if (laboralAplica) {
        await tx.datosLaborales.create({
          data: {
            id_persona: persona.id_persona,
            aplica: true,
            ocupacion: ocupacion || null,
            empresa: empresa || null,
            modalidad: modalidadLaboral || null,
            disponibilidad: disponibilidadLaboral || null,
          }
        });
      }

      // Salud Odontológica
      if (ultima_visita_odontologica || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: persona.id_persona,
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || null,
            presenta_sensibilidad: presenta_sensibilidad || null,
            sangrado_o_inflamacion: sangrado_o_inflamacion || null,
            usa_aparato_o_protesis: usa_aparato_o_protesis || null,
            condicion_atencion_especial: condicion_atencion_especial || null,
          }
        });
      }

      await recordBuyerCapture(tx, persona, {
        sourceId: validAttractionSource, serviceId: validService,
        branchId: await captureBranch(tx, req.body.id_sede ?? pref_sede_preferida), reason: captureReason,
      });
      return { ...persona, id: persona.id_persona, isDuplicate: false };
    });

    if (!result.isDuplicate) MartSyncService.syncBuyer().catch(err => console.warn('[AutoSync] Error:', err.message));
    res.status(result.isDuplicate ? 200 : 201).json(result);
  } catch (error: any) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: error.message || 'Error al crear BUYER' });
  }
});

// Actualizar un BUYER
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    person, contactAuthorization, concreteRequest,
    channel, attractionSource, serviceOfInterestId,
    pref_id_canal, pref_id_horario, pref_id_modalidad, pref_sede_preferida, pref_profesional_preferido,
    estudianteAplica, universidad, carrera, ciclo,
    laboralAplica, ocupacion, empresa, modalidadLaboral, disponibilidadLaboral,
    ultima_visita_odontologica, tratamiento_previo, nivel_dolor, presenta_sensibilidad, sangrado_o_inflamacion, usa_aparato_o_protesis, condicion_atencion_especial,
    ...data 
  } = req.body;
  try {
    const updateData: any = {};
    if (person?.firstName) updateData.nombres = person.firstName;
    if (person?.lastName) updateData.apellidos = person.lastName;
    if (person?.email !== undefined) updateData.email = person.email || null;

    if (person?.phone !== undefined) {
      const phoneToSave = person.phone ? person.phone.trim() : null;
      if (phoneToSave && phoneToSave.length > 20) return res.status(400).json({ error: 'El teléfono no puede superar los 20 caracteres.' });
      updateData.numero = phoneToSave;
    }

    if (person?.documentNumber !== undefined) {
      const dniToSave = person.documentNumber ? person.documentNumber.trim() : null;
      if (dniToSave && dniToSave.length > 8) return res.status(400).json({ error: 'El DNI no puede superar los 8 caracteres.' });
      updateData.dni = dniToSave;
    }

    if (contactAuthorization !== undefined) {
      updateData.autoriza_contacto = contactAuthorization;
      if (contactAuthorization) updateData.fecha_autorizacion = new Date();
    }

    const result = await prisma.$transaction(async (tx) => {
      const persona = await tx.personas.update({
        where: { id_persona: Number(id) },
        data: updateData
      });

      const validService = await getValidServicioId(tx, serviceOfInterestId);
      const validChannel = await getValidCanalId(tx, channel);
      const validAttractionSource = await getValidFuenteId(tx, attractionSource);
      const validPrefCanal = await getValidCanalId(tx, pref_id_canal);
      const validPrefHorario = await getValidHorarioId(tx, pref_id_horario);
      const validPrefModalidad = await getValidModalidadId(tx, pref_id_modalidad);

      if (concreteRequest !== undefined || serviceOfInterestId !== undefined) {
        const solicitudExistente = await tx.solicitudes.findFirst({
          where: { id_persona: Number(id) }
        });

        if (solicitudExistente) {
          const dataToUpdate: any = {};
          if (concreteRequest !== undefined) dataToUpdate.motivo = concreteRequest;
          if (serviceOfInterestId !== undefined) dataToUpdate.id_servicio = validService;

          await tx.solicitudes.update({
            where: { id_solicitud: solicitudExistente.id_solicitud },
            data: dataToUpdate
          });
        } else if (concreteRequest || validService) {
          await tx.solicitudes.create({
            data: {
              id_persona: persona.id_persona,
              motivo: concreteRequest || 'Solicitud de información general',
              id_servicio: validService
            }
          });
        }
      }

      if (validChannel !== null || validAttractionSource !== null || channel || attractionSource) {
        const interaccionExistente = await tx.interacciones.findFirst({
          where: { id_persona: Number(id) },
          orderBy: { fecha_hora: 'asc' }
        });
        
        if (interaccionExistente) {
          await tx.interacciones.update({
            where: { id_interaccion: interaccionExistente.id_interaccion },
            data: {
              id_canal: validChannel,
              id_fuente: validAttractionSource,
            }
          });
        } else if (validChannel || validAttractionSource) {
          await tx.interacciones.create({
            data: {
              id_persona: Number(id),
              id_canal: validChannel,
              id_fuente: validAttractionSource,
              tipo: 'Actualización',
              mensaje: 'Actualizado desde Dashboard'
            }
          });
        }
      }

      // Reemplazar Gustos y Preferencias
      await tx.personaPreferencias.deleteMany({ where: { id_persona: Number(id) } });
      if (validPrefCanal || validPrefHorario || validPrefModalidad || pref_sede_preferida || pref_profesional_preferido) {
        await tx.personaPreferencias.create({
          data: {
            id_persona: Number(id),
            id_canal: validPrefCanal,
            id_horario: validPrefHorario,
            id_modalidad: validPrefModalidad,
            sede_preferida: pref_sede_preferida || null,
            profesional_preferido: pref_profesional_preferido || null,
          }
        });
      }

      // Reemplazar Datos Estudiante
      await tx.datosAcademicos.deleteMany({ where: { id_persona: Number(id) } });
      if (estudianteAplica) {
        await tx.datosAcademicos.create({
          data: {
            id_persona: Number(id),
            aplica: true,
            universidad: universidad || null,
            carrera: carrera || null,
            ciclo: ciclo || null,
          }
        });
      }

      // Reemplazar Datos Laborales
      await tx.datosLaborales.deleteMany({ where: { id_persona: Number(id) } });
      if (laboralAplica) {
        await tx.datosLaborales.create({
          data: {
            id_persona: Number(id),
            aplica: true,
            ocupacion: ocupacion || null,
            empresa: empresa || null,
            modalidad: modalidadLaboral || null,
            disponibilidad: disponibilidadLaboral || null,
          }
        });
      }

      // Reemplazar Salud Odontológica
      await tx.personaSaludOdontologica.deleteMany({ where: { id_persona: Number(id) } });
      if (ultima_visita_odontologica || tratamiento_previo || nivel_dolor || presenta_sensibilidad || sangrado_o_inflamacion || usa_aparato_o_protesis || condicion_atencion_especial) {
        await tx.personaSaludOdontologica.create({
          data: {
            id_persona: Number(id),
            ultima_visita_odontologica: ultima_visita_odontologica || null,
            motivo_consulta: null,
            tratamiento_previo: tratamiento_previo || null,
            nivel_dolor: nivel_dolor || null,
            presenta_sensibilidad: presenta_sensibilidad || null,
            sangrado_o_inflamacion: sangrado_o_inflamacion || null,
            usa_aparato_o_protesis: usa_aparato_o_protesis || null,
            condicion_atencion_especial: condicion_atencion_especial || null,
          }
        });
      }

      return persona;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar BUYER' });
  }
});

// Convertir BUYER a LEAD
router.post('/:id/convert', async (req, res) => {
  const personId = Number(req.params.id);
  if (!Number.isSafeInteger(personId) || personId < 1 || personId > 2147483647) {
    return res.status(400).json({ error: 'ID de persona inválido.' });
  }

  try {
    const [capture] = await prisma.$queryRaw<{ id_captacion: number; id_servicio: number | null; motivo_consulta: string | null }[]>`
      SELECT id_captacion,id_servicio,motivo_consulta FROM dbo.CaptacionesBuyer WHERE id_persona=${personId}
    `;
    if (!capture) throw new BuyerInputError('La persona requiere una captación documentada antes de convertirla.');
    const [prior] = await prisma.$queryRaw<{ id_solicitud: number | null }[]>`
      SELECT TOP (1) e.id_solicitud FROM dbo.EventosEtapa e
      JOIN dbo.Etapas o ON o.id_etapa=e.etapa_origen AND o.nombre='BUYER'
      JOIN dbo.Etapas d ON d.id_etapa=e.etapa_destino AND d.nombre='LEAD'
      WHERE e.id_captacion=${capture.id_captacion} ORDER BY e.id_evento_etapa
    `;
    if (prior?.id_solicitud) {
      return res.json({ message: 'Paciente transferido a LEAD', id_solicitud: prior.id_solicitud, ya_convertido: true });
    }
    const service = Number(req.body?.id_servicio ?? req.body?.serviceOfInterestId ?? capture.id_servicio);
    const reason = String(req.body?.motivo ?? req.body?.concreteRequest ?? capture.motivo_consulta?.slice(0, 200) ?? '').trim();
    if (!Number.isInteger(service) || service < 1 || service > 2147483647 || !reason || reason.length > 200) {
      return res.status(400).json({ error: 'Indica un tratamiento válido y un motivo concreto de hasta 200 caracteres.' });
    }
    const [result] = await prisma.$queryRaw<{ id_solicitud: number | null; ya_convertido: number }[]>`
      EXEC dbo.usp_ConvertirBuyerALead @id_captacion=${capture.id_captacion}, @id_servicio=${service}, @motivo=${reason}
    `;
    if (!result?.id_solicitud) throw new BuyerInputError('La conversión histórica no tiene una solicitud vinculada.');
    res.json({ message: 'Paciente transferido a LEAD', id_solicitud: result.id_solicitud, ya_convertido: Boolean(result.ya_convertido) });
  } catch (error) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' &&
        /^5100[1-8]$/.test(String(error.meta?.code))) {
      return res.status(409).json({ error: String(error.meta?.message ?? 'La captación no cumple las reglas de conversión.') });
    }
    console.error(error);
    res.status(500).json({ error: 'No se pudo convertir a LEAD.' });
  }
});

// Eliminar un BUYER
router.delete('/:id', async (req, res) => {
  const personId = Number(req.params.id);
  if (!Number.isInteger(personId) || personId < 1 || personId > 2147483647) {
    return res.status(400).json({ error: 'ID de persona inválido.' });
  }
  try {
    await writeBuyer(async tx => {
      const person = await tx.personas.findUnique({ where: { id_persona: personId }, include: { Etapa: true } });
      if (!person) throw new BuyerInputError('Persona inexistente.', 404);
      const [capture] = await tx.$queryRaw<{ id_captacion: number }[]>`
        SELECT id_captacion FROM dbo.CaptacionesBuyer WITH (UPDLOCK,HOLDLOCK) WHERE id_persona=${personId}
      `;
      const requests = await tx.solicitudes.findMany({ where: { id_persona: personId } });
      if (person.Etapa.nombre !== 'BUYER' || capture ||
          requests.some(request => request.fecha_ingreso_lead || request.resultado_comercial_lead) ||
          await tx.reservas.count({ where: { id_persona: personId } })) {
        throw new BuyerInputError('La persona tiene trazabilidad comercial o reservas y no admite borrado físico.');
      }
      for (const request of requests) {
        await tx.opciones.deleteMany({ where: { id_solicitud: request.id_solicitud } });
      }
      await tx.interacciones.deleteMany({ where: { id_persona: personId } });
      await tx.eventosEtapa.deleteMany({ where: { id_persona: personId } });
      await tx.solicitudes.deleteMany({ where: { id_persona: personId } });
      await tx.personaPreferencias.deleteMany({ where: { id_persona: personId } });
      await tx.personas.delete({ where: { id_persona: personId } });
    });
    res.json({ message: 'Buyer eliminado exitosamente' });
  } catch (error) {
    if (error instanceof BuyerInputError) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar el BUYER.' });
  }
});

export default router;
