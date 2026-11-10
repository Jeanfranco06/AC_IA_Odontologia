import { Router } from 'express';
import { prisma } from '../db';
import nodemailer from 'nodemailer';
import { createPaymentDocumentPdf } from '../pdf/paymentDocument';
import { readFileSync } from 'fs';
import path from 'path';
import { runDunningCycle, getLastExecutionStats } from '../services/dunningScheduler';

const router = Router();
const paymentLogoDataUrl = `data:image/png;base64,${readFileSync(path.resolve(__dirname, '../../assets/Logo_NexoSalud.png')).toString('base64')}`;

// Ejecutar manualmente el ciclo de cobranza en 3 etapas (Dunning Cron)
router.post('/run-dunning-cycle', async (req, res) => {
  try {
    const stats = await runDunningCycle();
    res.json({
      success: true,
      message: 'Ciclo de cobranza en 3 etapas ejecutado exitosamente.',
      stats
    });
  } catch (error: any) {
    console.error('Error ejecutando ciclo de dunning manual:', error);
    res.status(500).json({ error: error.message || 'Error al ejecutar ciclo de cobranza' });
  }
});

// Obtener estadísticas y políticas del ciclo de cobranza
router.get('/dunning-stats', (req, res) => {
  const stats = getLastExecutionStats();
  res.json({
    activePolicy: 'CADENCIA_3_ETAPAS',
    stage1Timing: 'T - 48h (Recordatorio Preventivo + PDF)',
    stage2Timing: 'T - 24h (Urgencia Clínica + Advertencia a medianoche)',
    stage3Timing: 'T = 00:00 hrs del día de la cita (Cancelación & Liberación de Sillón)',
    minimumBookingAdvance: '72 horas mínimas requeridas',
    lastExecution: stats
  });
});

// Limpiar todos los PAYERS / Reservas de prueba
router.post('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    await prisma.opciones.deleteMany({});
    res.json({ message: 'Todos los Payers han sido eliminados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

router.delete('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    await prisma.opciones.deleteMany({});
    res.json({ message: 'Todos los Payers han sido eliminados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

// Obtener todos los PAYERS mapeados
router.get('/', async (req, res) => {
  try {
    const reservas = await prisma.reservas.findMany({
      orderBy: { id_reserva: 'desc' },
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

    const payers = reservas.map(r => {
      const pago = r.Pagos.length > 0 ? r.Pagos[0] : null;
      let state = 'PENDIENTE';
      if (r.estado === 'Vencida' || r.estado === 'Cancelada') {
        state = 'RECHAZADO';
      } else if (pago) {
        if (pago.estado === 'Validado' || pago.estado === 'Confirmado' || pago.estado === 'VALIDADO' || pago.estado === 'VALIDATED') {
          state = 'VALIDADO';
        } else if (pago.estado === 'Rechazado' || pago.estado === 'Fallido' || pago.estado === 'RECHAZADO' || pago.estado === 'REJECTED') {
          state = 'RECHAZADO';
        } else if (pago.estado === 'En_Revision' || pago.estado === 'En revisión' || pago.estado === 'EN_REVISION' || pago.estado === 'IN_REVIEW') {
          state = 'EN_REVISION';
        } else {
          state = 'PENDIENTE';
        }
      }

      const isPendingPayment = !pago || pago.estado === 'Pendiente';
      const isInternalRef = pago?.referencia_pago?.startsWith('PR-');

      return {
        id: r.id_reserva.toString(),
        leadId: r.id_persona.toString(),
        reservationId: r.id_reserva.toString(),
        amountToPay: Number(r.Opcion?.precio_ofrecido || 1.00),
        originalPrice: r.Solicitud?.Servicio?.Tarifas[0] ? Number(r.Solicitud.Servicio.Tarifas[0].precio) : undefined,
        serviceName: r.Solicitud?.Servicio?.nombre,
        currency: 'PEN',
        state,
        createdAt: r.fecha_reserva ? r.fecha_reserva.toISOString() : new Date().toISOString(),
        paymentId: pago ? pago.id_pago.toString() : undefined,
        payment: pago ? {
          id: pago.id_pago.toString(),
          payerId: r.id_reserva.toString(),
          amount: Number(pago.importe),
          currency: 'PEN',
          channel: pago.canal_pago || 'En clínica',
          operationNumber: (!isPendingPayment && !isInternalRef) ? pago.referencia_pago : undefined,
          preReservationCode: isInternalRef ? pago.referencia_pago : `PR-${r.id_reserva.toString().padStart(5, '0')}`,
          operationDate: pago.fecha_registro ? pago.fecha_registro.toISOString().split('T')[0] : (r.fecha_reserva ? r.fecha_reserva.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
          validationDate: pago.fecha_validacion ? pago.fecha_validacion.toISOString() : undefined,
          observations: pago.observaciones || (isPendingPayment ? 'Pre-reserva online pendiente de pago.' : 'Pago verificado')
        } : undefined,
        person: {
          firstName: r.Persona.nombres,
          lastName: r.Persona.apellidos,
          email: r.Persona.email,
          phone: r.Persona.numero,
          documentNumber: r.Persona.dni
        },
        reservation: {
          id: r.id_reserva.toString(),
          date: r.Opcion?.Disponibilidad?.fecha ? r.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : '2026-09-17',
          time: r.Opcion?.Disponibilidad?.hora_inicio ? r.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '15:00',
          branchId: r.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Norte',
          professionalId: `Dr. ${r.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Perez'}`
        },
        incidents: r.Incidencias ? r.Incidencias.map(inc => ({
          id: inc.id_incidencia.toString(),
          payerId: r.id_reserva.toString(),
          reason: inc.descripcion || inc.tipo || 'Incidencia de cobro',
          status: inc.estado || 'OPEN',
          createdAt: inc.fecha_registro ? inc.fecha_registro.toISOString() : new Date().toISOString()
        })) : []
      };
    });

    res.json(payers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener payers' });
  }
});

// Obtener un PAYER por ID (o ID de persona/reserva)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    let reserva = null;

    if (!isNaN(numId)) {
      reserva = await prisma.reservas.findFirst({
        where: {
          OR: [
            { id_reserva: numId },
            { id_persona: numId }
          ]
        },
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
    }

    if (!reserva) {
      reserva = await prisma.reservas.findFirst({
        orderBy: { id_reserva: 'desc' },
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
    }

    if (!reserva) {
      return res.status(404).json({ error: 'Payer no encontrado' });
    }

    const pago = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
    let state = 'PENDIENTE';
    if (reserva.estado === 'Vencida' || reserva.estado === 'Cancelada') {
      state = 'RECHAZADO';
    } else if (pago) {
      if (pago.estado === 'Validado' || pago.estado === 'Confirmado' || pago.estado === 'VALIDADO' || pago.estado === 'VALIDATED') {
        state = 'VALIDADO';
      } else if (pago.estado === 'Rechazado' || pago.estado === 'Fallido' || pago.estado === 'RECHAZADO' || pago.estado === 'REJECTED') {
        state = 'RECHAZADO';
      } else if (pago.estado === 'En_Revision' || pago.estado === 'En revisión' || pago.estado === 'EN_REVISION' || pago.estado === 'IN_REVIEW') {
        state = 'EN_REVISION';
      } else {
        state = 'PENDIENTE';
      }
    }

    const isPendingPayment = !pago || pago.estado === 'Pendiente';
    const isInternalRef = pago?.referencia_pago?.startsWith('PR-');

    // Obtener todas las pre-reservas históricas del paciente para trazabilidad completa
    const todasLasReservas = await prisma.reservas.findMany({
      where: { id_persona: reserva.id_persona },
      orderBy: { id_reserva: 'desc' },
      include: {
        Solicitud: { include: { Servicio: true } },
        Opcion: { include: { Disponibilidad: { include: { Sede: true, Profesional: true } } } },
        Pagos: true,
        Incidencias: true
      }
    });

    const reservationHistory = todasLasReservas.map(histRes => {
      const histPago = histRes.Pagos.length > 0 ? histRes.Pagos[0] : null;
      let histState = 'PENDIENTE';
      if (histRes.estado === 'Vencida' || histRes.estado === 'Cancelada') {
        histState = 'RECHAZADO';
      } else if (histPago) {
        if (histPago.estado === 'Validado' || histPago.estado === 'Confirmado' || histPago.estado === 'VALIDADO' || histPago.estado === 'VALIDATED') histState = 'VALIDADO';
        else if (histPago.estado === 'Rechazado' || histPago.estado === 'Fallido' || histPago.estado === 'RECHAZADO' || histPago.estado === 'REJECTED') histState = 'RECHAZADO';
        else if (histPago.estado === 'En_Revision' || histPago.estado === 'En revisión' || histPago.estado === 'EN_REVISION' || histPago.estado === 'IN_REVIEW') histState = 'EN_REVISION';
        else histState = 'PENDIENTE';
      }
      return {
        id: histRes.id_reserva.toString(),
        reservationId: histRes.id_reserva.toString(),
        isCurrent: histRes.id_reserva === reserva.id_reserva,
        serviceName: histRes.Solicitud?.Servicio?.nombre || 'Consulta Odontológica',
        amount: Number(histRes.Opcion?.precio_ofrecido || histPago?.importe || 1.00),
        channel: histPago?.canal_pago || 'En clínica',
        state: histState,
        statusRaw: histRes.estado,
        createdAt: histRes.fecha_reserva ? histRes.fecha_reserva.toISOString() : undefined,
        appointmentDate: histRes.Opcion?.Disponibilidad?.fecha ? histRes.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : undefined,
        appointmentTime: histRes.Opcion?.Disponibilidad?.hora_inicio ? histRes.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : undefined,
        sede: histRes.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal',
        cancellationReason: histRes.Incidencias?.[0]?.descripcion || (histRes.estado === 'Cancelada' ? 'Cancelado por expiración de plazo de pago (Dunning)' : undefined)
      };
    });

    const payerDetails = {
      id: reserva.id_reserva.toString(),
      leadId: reserva.id_persona.toString(),
      reservationId: reserva.id_reserva.toString(),
      amountToPay: Number(reserva.Opcion?.precio_ofrecido || 1.00),
      originalPrice: reserva.Solicitud?.Servicio?.Tarifas[0] ? Number(reserva.Solicitud.Servicio.Tarifas[0].precio) : undefined,
      serviceName: reserva.Solicitud?.Servicio?.nombre,
      currency: 'PEN',
      state,
      createdAt: reserva.fecha_reserva ? reserva.fecha_reserva.toISOString() : new Date().toISOString(),
      paymentId: pago ? pago.id_pago.toString() : undefined,
      payment: pago ? {
        id: pago.id_pago.toString(),
        payerId: reserva.id_reserva.toString(),
        amount: Number(pago.importe),
        currency: 'PEN',
        channel: pago.canal_pago || 'En clínica',
        operationNumber: (!isPendingPayment && !isInternalRef) ? pago.referencia_pago : undefined,
        preReservationCode: isInternalRef ? pago.referencia_pago : `PR-${reserva.id_reserva.toString().padStart(5, '0')}`,
        operationDate: pago.fecha_registro ? pago.fecha_registro.toISOString().split('T')[0] : (reserva.fecha_reserva ? reserva.fecha_reserva.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        validationDate: pago.fecha_validacion ? pago.fecha_validacion.toISOString() : undefined,
        observations: pago.observaciones || (isPendingPayment ? 'Pre-reserva online pendiente de pago.' : 'Pago verificado')
      } : undefined,
      person: {
        firstName: reserva.Persona.nombres,
        lastName: reserva.Persona.apellidos,
        email: reserva.Persona.email,
        phone: reserva.Persona.numero,
        documentNumber: reserva.Persona.dni
      },
      reservation: {
        id: reserva.id_reserva.toString(),
        date: reserva.Opcion?.Disponibilidad?.fecha ? reserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : '2026-09-17',
        time: reserva.Opcion?.Disponibilidad?.hora_inicio ? reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '15:00',
        branchId: reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Norte',
        professionalId: `Dr. ${reserva.Opcion?.Disponibilidad?.Profesional?.apellidos || 'Perez'}`
      },
      reservationHistory,
      incidents: reserva.Incidencias ? reserva.Incidencias.map(inc => ({
        id: inc.id_incidencia.toString(),
        payerId: reserva.id_reserva.toString(),
        reason: inc.descripcion || inc.tipo || 'Incidencia de cobro',
        status: inc.estado || 'OPEN',
        createdAt: inc.fecha_registro ? inc.fecha_registro.toISOString() : new Date().toISOString()
      })) : []
    };

    res.json(payerDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener detalle del payer' });
  }
});

// Registrar comprobante manual de pago (voucher, transferencia bancaria o pago en caja)
router.post('/:id/payment', async (req, res) => {
  const { id } = req.params;
  const { channel, operationNumber, operationDate, observations, receiptMetadata } = req.body;
  const numId = Number(id);

  try {
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: isNaN(numId) ? -1 : numId },
          { id_persona: isNaN(numId) ? -1 : numId }
        ]
      },
      include: { Pagos: true, Opcion: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const obsReceipt = receiptMetadata?.name ? ` [Adjunto: ${receiptMetadata.name}]` : '';
    const fullObservations = `${observations || 'Comprobante registrado para verificación bancaria'}${obsReceipt}`.trim();

    let pago = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
    if (pago) {
      pago = await prisma.pagos.update({
        where: { id_pago: pago.id_pago },
        data: {
          canal_pago: channel || pago.canal_pago,
          referencia_pago: operationNumber || `VCH-${Date.now()}`,
          fecha_pago: operationDate ? new Date(operationDate) : new Date(),
          observaciones: fullObservations,
          estado: 'En_Revision' // Pasa a revisión administrativa para que el cajero/auditor lo valide
        }
      });
    } else {
      pago = await prisma.pagos.create({
        data: {
          id_persona: reserva.id_persona,
          id_reserva: reserva.id_reserva,
          importe: reserva.Opcion?.precio_ofrecido || 150.00,
          canal_pago: channel || 'Transferencia con comprobante',
          referencia_pago: operationNumber || `VCH-${Date.now()}`,
          fecha_pago: operationDate ? new Date(operationDate) : new Date(),
          observaciones: fullObservations,
          estado: 'En_Revision'
        }
      });
    }

    // Registrar interacción en auditoría
    await prisma.interacciones.create({
      data: {
        id_persona: reserva.id_persona,
        tipo: 'Portal PAYER - Carga de Comprobante',
        mensaje: `Comprobante registrado: ${channel}. Operación: ${operationNumber || 'N/A'}.`,
        resultado: 'En espera de validación administrativa',
        es_respuesta_util: true
      }
    });

    res.json({ message: 'Comprobante registrado exitosamente', pago });
  } catch (error: any) {
    console.error('Error al registrar pago manual:', error);
    res.status(500).json({ error: error.message || 'Error al registrar comprobante' });
  }
});

// Validar pago de una reserva en SQL Server y transferir automáticamente a CUSTOMER
router.post('/:id/validate', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: isNaN(numId) ? -1 : numId },
          { id_persona: isNaN(numId) ? -1 : numId }
        ]
      },
      include: {
        Persona: true,
        Opcion: {
          include: {
            Disponibilidad: {
              include: {
                Sede: true,
                Profesional: true
              }
            }
          }
        },
        Solicitud: {
          include: {
            Servicio: { include: { Tarifas: { where: { activo: true }, orderBy: { fecha_inicio: 'desc' }, take: 1 } } }
          }
        },
        Pagos: true
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // H03 / R01-R04: Transición atómica e idempotente PAYER -> CUSTOMER
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) {
      etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atención' } });
    }
    const defaultProf = await prisma.profesionales.findFirst();
    const defaultSede = await prisma.sedes.findFirst();
    const etapaOrigenId = reserva.Persona.id_etapa_actual;

    const { pago, persona } = await prisma.$transaction(async (tx) => {
      // 1. Confirmar Reserva
      await tx.reservas.update({
        where: { id_reserva: reserva.id_reserva },
        data: { estado: 'Confirmada', confirmacion_explicita: true, fecha_confirmacion: new Date() },
      });

      // 2. Validar o Crear Pago
      let pagoTx = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
      if (pagoTx) {
        pagoTx = await tx.pagos.update({
          where: { id_pago: pagoTx.id_pago },
          data: {
            estado: 'Validado',
            fecha_validacion: new Date(),
            referencia_pago: pagoTx.referencia_pago || `YAPE-${Date.now()}`,
          },
        });
      } else {
        pagoTx = await tx.pagos.create({
          data: {
            id_persona: reserva.id_persona,
            id_reserva: reserva.id_reserva,
            importe: reserva.Opcion?.precio_ofrecido || 1.00,
            canal_pago: 'YAPE',
            referencia_pago: `YAPE-${Date.now()}`,
            estado: 'Validado',
            fecha_validacion: new Date(),
          },
        });
      }

      // 3. Promover automáticamente la persona a etapa CUSTOMER y registrar EventosEtapa
      const personaTx = await tx.personas.update({
        where: { id_persona: reserva.id_persona },
        data: { id_etapa_actual: etapaCustomer!.id_etapa, fecha_actualizacion: new Date() },
      });

      if (etapaOrigenId !== etapaCustomer!.id_etapa) {
        await tx.eventosEtapa.create({
          data: {
            id_persona: reserva.id_persona,
            etapa_origen: etapaOrigenId,
            etapa_destino: etapaCustomer!.id_etapa,
            motivo: 'Transición atómica PAYER -> CUSTOMER con pago validado',
            evidencia: `Pago #${pagoTx.id_pago} | Ref: ${pagoTx.referencia_pago || 'CONCILIADO'}`,
          },
        });
      }

      // 4. Crear registro en la tabla Atenciones para la historia clínica si no existe
      const existingAtencion = await tx.atenciones.findFirst({ where: { id_reserva: reserva.id_reserva } });
      if (!existingAtencion) {
        await tx.atenciones.create({
          data: {
            id_persona: personaTx.id_persona,
            id_reserva: reserva.id_reserva,
            id_servicio: reserva.Solicitud?.id_servicio || 1,
            id_profesional: reserva.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
            id_sede: reserva.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
            fecha_atencion: reserva.Opcion?.Disponibilidad?.fecha || new Date(),
            estado_servicio: 'Programado',
            asistencia: 'Pendiente',
          },
        });
      }

      return { pago: pagoTx, persona: personaTx };
    });

    // Activar TratamientoContratado, PlanTratamiento v1 y Sesion #1 si el procedimiento OLTP está instalado
    try {
      await prisma.$executeRawUnsafe(
        `IF OBJECT_ID('dbo.usp_ActivarTratamientoDesdePayer', 'P') IS NOT NULL EXEC dbo.usp_ActivarTratamientoDesdePayer @id_reserva = ${Number(reserva.id_reserva)};`
      );
    } catch (procErr) {
      console.warn('[PAYER->CUSTOMER] Aviso al invocar usp_ActivarTratamientoDesdePayer:', procErr);
    }

    // 5. Enviar automáticamente constancia oficial de pago por correo al paciente
    const patientEmail = reserva.Persona?.email || persona.email;
    if (patientEmail) {
      const patientFullName = `${reserva.Persona?.nombres || persona.nombres || ''} ${reserva.Persona?.apellidos || persona.apellidos || ''}`.trim();
      const serviceName = reserva.Solicitud?.Servicio?.nombre || 'Consulta Odontológica Especializada';
      const reservationDate = reserva.Opcion?.Disponibilidad?.fecha ? reserva.Opcion.Disponibilidad.fecha.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const reservationTime = reserva.Opcion?.Disponibilidad?.hora_inicio ? reserva.Opcion.Disponibilidad.hora_inicio.toISOString().substring(11, 16) : '10:00';
      const branchName = reserva.Opcion?.Disponibilidad?.Sede?.nombre || 'Sede Principal';
      const profName = reserva.Opcion?.Disponibilidad?.Profesional ? `Dr. ${reserva.Opcion.Disponibilidad.Profesional.nombres || ''} ${reserva.Opcion.Disponibilidad.Profesional.apellidos || ''}`.trim() : 'Dr. Especialista';
      const amountVal = Number(pago.importe || reserva.Opcion?.precio_ofrecido || 1.00);

      sendPaymentNoticeOrConfirmation({
        toEmail: patientEmail,
        patientName: patientFullName,
        documentNumber: reserva.Persona?.dni || persona.dni,
        phone: reserva.Persona?.numero || persona.numero,
        subject: `✅ Constancia Oficial de Pago y Confirmación de Cita - NexoSalud #${reserva.id_reserva}`,
        amount: amountVal,
        originalPrice: reserva.Solicitud?.Servicio?.Tarifas[0] ? Number(reserva.Solicitud.Servicio.Tarifas[0].precio) : undefined,
        channel: pago.canal_pago || 'YAPE',
        operationNumber: pago.referencia_pago || `REF-${reserva.id_reserva}`,
        serviceName,
        reservationDate,
        reservationTime,
        branch: branchName,
        professional: profName,
        filename: `Constancia_Pago_${reserva.id_reserva}`,
        code: `CONST-${String(reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`,
        isValidated: true
      }).then(resEmail => {
        console.log(`[AUTO-EMAIL] Constancia de pago enviada automáticamente a ${patientEmail}:`, resEmail);
      }).catch(err => {
        console.error('[AUTO-EMAIL ERROR] No se pudo enviar la constancia automática por correo:', err);
      });
    }

    res.json({
      message: 'Pago validado exitosamente, paciente transferido a CUSTOMER y constancia enviada al correo',
      pago,
      personaId: persona.id_persona,
      emailSentTo: patientEmail || null
    });
  } catch (error) {
    console.error('Error al validar pago en backend:', error);
    res.status(500).json({ error: 'Error al validar pago en backend' });
  }
});

// Eliminar un PAYER individual (Reserva, atenciones, incidencias y pagos asociados en SQL Server)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const numId = Number(id);

  try {
    if (isNaN(numId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // 1. Buscar la reserva objetivo
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: numId },
          { id_persona: numId }
        ]
      },
      include: {
        Pagos: true,
        Atenciones: true,
        Incidencias: true
      }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Registro de cobro no encontrado' });
    }

    const reservaId = reserva.id_reserva;
    const personaId = reserva.id_persona;
    const atencionIds = reserva.Atenciones.map(a => a.id_atencion);
    const pagoIds = reserva.Pagos.map(p => p.id_pago);

    await prisma.$transaction(async (tx) => {
      // a. Eliminar Seguimientos asociados a las atenciones
      if (atencionIds.length > 0) {
        await tx.seguimientos.deleteMany({
          where: { id_atencion: { in: atencionIds } }
        });
      }

      // b. Eliminar Incidencias asociadas a reservas, pagos o atenciones
      await tx.incidencias.deleteMany({
        where: {
          OR: [
            { id_reserva: reservaId },
            ...(pagoIds.length > 0 ? [{ id_pago: { in: pagoIds } }] : []),
            ...(atencionIds.length > 0 ? [{ id_atencion: { in: atencionIds } }] : [])
          ]
        }
      });

      // c. Eliminar Atenciones
      if (atencionIds.length > 0) {
        await tx.atenciones.deleteMany({
          where: { id_atencion: { in: atencionIds } }
        });
      }

      // d. Eliminar Pagos
      await tx.pagos.deleteMany({
        where: { id_reserva: reservaId }
      });

      // e. Eliminar la Reserva
      await tx.reservas.deleteMany({
        where: { id_reserva: reservaId }
      });

      // f. Revertir etapa de la persona a LEAD si no tiene otras reservas
      const otherReservas = await tx.reservas.count({ where: { id_persona: personaId } });
      if (otherReservas === 0) {
        const etapaLead = await tx.etapas.findFirst({ where: { nombre: 'LEAD' } });
        if (etapaLead) {
          await tx.personas.update({
            where: { id_persona: personaId },
            data: { id_etapa_actual: etapaLead.id_etapa }
          });
        }
      }
    });

    res.json({ message: 'Payer y registros asociados eliminados exitosamente en SQL Server' });
  } catch (error: any) {
    console.error('Error al eliminar Payer en backend:', error);
    res.status(500).json({ error: error.message || 'Error al eliminar payer en base de datos' });
  }
});

// Limpiar todos los Payers (Reservas y Pagos en SQL Server)
router.post('/clear-all', async (req, res) => {
  try {
    await prisma.pagos.deleteMany({});
    await prisma.reservas.deleteMany({});
    const etapaLead = await prisma.etapas.findFirst({ where: { nombre: 'LEAD' } });
    if (etapaLead) {
      await prisma.personas.updateMany({
        where: { id_etapa_actual: { not: 1 } },
        data: { id_etapa_actual: etapaLead.id_etapa }
      });
    }
    res.json({ message: 'Todos los Payers han sido eliminados de SQL Server' });
  } catch (error) {
    console.error('Error limpiando payers:', error);
    res.status(500).json({ error: 'Error al limpiar payers' });
  }
});

router.post('/:id/convert-customer', async (req, res) => {
  const { id } = req.params;
  try {
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atencion' } });

    const reserva = await prisma.reservas.findUnique({
      where: { id_reserva: Number(id) },
      include: { Opcion: { include: { Disponibilidad: true } }, Solicitud: true, Pagos: true }
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const precioPactado = Number(reserva.Opcion?.precio_ofrecido || 0);
    const importeValidado = reserva.Pagos
      .filter(pago => pago.estado === 'Validado' || pago.estado === 'VALIDADO' || pago.estado === 'VALIDATED')
      .reduce((acc, p) => acc + Number(p.importe || 0), 0);

    if (importeValidado <= 0 || importeValidado < Math.round(precioPactado * 0.30 * 100) / 100) {
      return res.status(409).json({
        error: 'GUARDIÁN FINANCIERO (R01/R02): El pago debe estar en estado oficial Validado y cubrir al menos el 30% del acuerdo comercial antes de pasar a CUSTOMER',
      });
    }

    const defaultProf = await prisma.profesionales.findFirst();
    const defaultSede = await prisma.sedes.findFirst();

    await prisma.$transaction(async (tx) => {
      await tx.reservas.update({
        where: { id_reserva: reserva.id_reserva },
        data: { estado: 'Confirmada', confirmacion_explicita: true, fecha_confirmacion: reserva.fecha_confirmacion || new Date() },
      });

      const persona = await tx.personas.update({
        where: { id_persona: reserva.id_persona },
        data: { id_etapa_actual: etapaCustomer!.id_etapa, fecha_actualizacion: new Date() },
      });

      const existingAtencion = await tx.atenciones.findFirst({ where: { id_reserva: reserva.id_reserva } });
      if (!existingAtencion) {
        await tx.atenciones.create({
          data: {
            id_persona: persona.id_persona,
            id_reserva: reserva.id_reserva,
            id_servicio: reserva.Solicitud?.id_servicio || 1,
            id_profesional: reserva.Opcion?.Disponibilidad?.id_profesional || defaultProf?.id_profesional || 1,
            id_sede: reserva.Opcion?.Disponibilidad?.id_sede || defaultSede?.id_sede || 1,
            fecha_atencion: reserva.Opcion?.Disponibilidad?.fecha || new Date(),
            estado_servicio: 'Programado',
            asistencia: 'Pendiente',
          },
        });
      }
    });

    try {
      await prisma.$executeRawUnsafe(
        `IF OBJECT_ID('dbo.usp_ActivarTratamientoDesdePayer', 'P') IS NOT NULL EXEC dbo.usp_ActivarTratamientoDesdePayer @id_reserva = ${Number(reserva.id_reserva)};`
      );
    } catch (procErr) {
      console.warn('[PAYER->CUSTOMER] Aviso al invocar usp_ActivarTratamientoDesdePayer:', procErr);
    }

    res.json({ message: 'Convertido a CUSTOMER' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al convertir a CUSTOMER' });
  }
});

// Generador de PDF oficial en Backend con jsPDF
export function generateBackendPdfBase64(params: {
  isValidated?: boolean | null;
  patientName?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  serviceName?: string | null;
  reservationDate?: string | null;
  reservationTime?: string | null;
  branch?: string | null;
  professional?: string | null;
  amount?: number | string | null;
  originalPrice?: number | string | null;
  channel?: string | null;
  operationNumber?: string | null;
  code?: string | null;
}): string {
  const isReceipt = !!params.isValidated;
  const doc = createPaymentDocumentPdf({
    type: isReceipt ? 'RECEIPT' : 'ORDER',
    code: params.code || `${isReceipt ? 'CONST' : 'ORD'}-${Date.now()}`,
    patientName: params.patientName || 'Paciente registrado',
    documentNumber: params.documentNumber || undefined,
    phone: params.phone || undefined,
    email: params.email || undefined,
    branch: params.branch || undefined,
    professional: params.professional || undefined,
    appointmentDate: params.reservationDate || undefined,
    appointmentTime: params.reservationTime || undefined,
    serviceName: params.serviceName || 'Consulta odontológica especializada',
    amount: Number(params.amount || 0),
    originalPrice: params.originalPrice == null ? undefined : Number(params.originalPrice),
    paymentChannel: params.channel || undefined,
    operationNumber: isReceipt ? params.operationNumber || undefined : undefined,
  }, paymentLogoDataUrl);
  const outputDataUri = doc.output('datauristring');
  return outputDataUri.split('base64,')[1] || outputDataUri;
}
// Función reutilizable para envío de Avisos de Cobro y Constancias de Pago
export async function sendPaymentNoticeOrConfirmation(params: {
  toEmail: string;
  patientName?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  subject?: string | null;
  message?: string | null;
  amount?: number | string | null;
  originalPrice?: number | string | null;
  channel?: string | null;
  operationNumber?: string | null;
  serviceName?: string | null;
  reservationDate?: string | null;
  reservationTime?: string | null;
  branch?: string | null;
  professional?: string | null;
  filename?: string | null;
  code?: string | null;
  pdfBase64?: string | null;
  isValidated?: boolean | null;
  includePdf?: boolean;
  customHtml?: string | null;
}) {
  const {
    toEmail,
    patientName,
    documentNumber,
    phone,
    subject,
    message,
    amount,
    originalPrice,
    channel,
    operationNumber,
    serviceName,
    reservationDate,
    reservationTime,
    branch,
    professional,
    filename,
    code,
    pdfBase64,
    isValidated,
    includePdf = true,
    customHtml
  } = params;

  if (!toEmail) {
    return { success: false, error: 'El correo electrónico es obligatorio.' };
  }

  const formattedAmount = Number(amount || 0).toFixed(2);
  const emailSubject = subject || (isValidated
    ? `Constancia Oficial de Pago y Confirmación de Cita - Clínica NexoSalud`
    : `Orden de Pago de su Pre-Reserva - Clínica NexoSalud`);

  const titleHeader = isValidated ? 'Constancia de Pago y Cita' : (includePdf ? 'Orden de Pago de Pre-Reserva' : 'Aviso de Cita');
  const defaultBody = isValidated
    ? `Nos complace confirmarle que su pago por un importe de S/ ${formattedAmount} ha sido validado exitosamente. Su cita odontológica se encuentra confirmada y programada en nuestra agenda.`
    : (message ? message.replace(/\n/g, '<br/>') : 'Le recordamos que mantiene un importe pendiente de regularización correspondiente a su atención odontológica programada.');

  const htmlBody = customHtml || `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, ${isValidated ? '#059669 0%, #10b981 100%' : '#0f766e 0%, #0d9488 100%'}); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 28px 24px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .message-box { background-color: #f8fafc; border-left: 4px solid ${isValidated ? '#10b981' : '#0d9488'}; padding: 14px 18px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
        .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${isValidated ? '#059669' : '#0d9488'}; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.5px; }
        .grid { display: table; width: 100%; }
        .grid-row { display: table-row; }
        .grid-col { display: table-cell; padding-bottom: 8px; font-size: 13px; }
        .col-label { color: #64748b; font-weight: 600; width: 40%; }
        .col-val { color: #0f172a; font-weight: 700; width: 60%; }
        .total-banner { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
        .total-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f766e; }
        .total-amount { font-size: 28px; font-weight: 800; color: #0f766e; margin: 4px 0 0 0; font-family: monospace; }
        .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Clínica Odontológica NexoSalud</h1>
          <p>${titleHeader}</p>
        </div>
        <div class="content">
          <div class="greeting">Estimado(a) ${patientName || 'Paciente'},</div>
          
          <div class="message-box">
            ${defaultBody}
          </div>

          <div class="card">
            <div class="card-title">Detalle de la Cita Médica</div>
            <div class="grid">
              <div class="grid-row"><div class="grid-col col-label">Servicio / Tratamiento:</div><div class="grid-col col-val">${serviceName || 'Tratamiento Odontológico Especializado'}</div></div>
              <div class="grid-row"><div class="grid-col col-label">Fecha Programada:</div><div class="grid-col col-val">${reservationDate || 'Próximo turno'} a las ${reservationTime || '15:00'} hrs</div></div>
              <div class="grid-row"><div class="grid-col col-label">Sede de Atención:</div><div class="grid-col col-val">${branch || 'Sede Principal'}</div></div>
              <div class="grid-row"><div class="grid-col col-label">Especialista Asignado:</div><div class="grid-col col-val">${professional || 'Especialista de Turno'}</div></div>
            </div>
          </div>

          <div class="total-banner">
            <div class="total-label">${isValidated ? 'Monto Abonado y Conciliado' : 'Monto Total a Abonar'}</div>
            <div class="total-amount">S/ ${formattedAmount}</div>
          </div>

          ${includePdf ? `<p style="font-size: 12px; color: #64748b; margin-top: 20px; text-align: center;"><em>📎 ${isValidated ? 'Adjuntamos su Constancia de Pago en PDF.' : 'Adjuntamos su Orden de Pago en PDF.'}</em></p>` : ''}
        </div>
        <div class="footer">
          <p>Clínica Odontológica NexoSalud S.A.C. | RUC: 20608945123</p>
          <p>Este es un correo automático generado por el Sistema de Recaudación Inteligente de NexoSalud.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Limpiar rigurosamente cualquier prefijo de Data URI o generar PDF si no se proporcionó
  let cleanBase64 = '';
  if (pdfBase64 && typeof pdfBase64 === 'string') {
    if (pdfBase64.includes('base64,')) {
      cleanBase64 = pdfBase64.split('base64,')[1].trim();
    } else {
      cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '').trim();
    }
    cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, '');
  }

  // Si no se proveyó PDF pre-generado, crearlo automáticamente con jsPDF
  if (includePdf && !cleanBase64) {
    try {
      cleanBase64 = generateBackendPdfBase64({
        isValidated,
        patientName,
        documentNumber,
        phone,
        email: toEmail,
        serviceName,
        reservationDate,
        reservationTime,
        branch,
        professional,
        amount,
        originalPrice,
        channel,
        operationNumber,
        code
      });
      console.log(`[PDF GENERATOR] PDF ${isValidated ? 'Constancia' : 'Orden de Pago'} generado automáticamente para ${toEmail}`);
    } catch (pdfErr) {
      console.error('[PDF GENERATOR ERROR] Error generando PDF en backend:', pdfErr);
    }
  }

  const patientFileSlug = (patientName || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
  const pdfFileName = filename
    ? (filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
    : (isValidated ? `Constancia_Pago_${patientFileSlug}.pdf` : `Orden_de_Pago_${patientFileSlug}.pdf`);

  // 1. MÉTODO 100% GARANTIZADO EN RENDER (HTTPS Port 443): Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    console.log(`[EMAIL DISPATCHER] Despachando correo vía RESEND HTTPS API a: ${toEmail} (Adjunto: ${pdfFileName})`);
    const resendPayload: any = {
      from: process.env.RESEND_FROM || 'Clínica NexoSalud <onboarding@resend.dev>',
      to: [toEmail],
      subject: emailSubject,
      html: htmlBody,
    };

    if (cleanBase64) {
      resendPayload.attachments = [
        {
          filename: pdfFileName,
          content: cleanBase64
        }
      ];
    }

    let resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    });

    let resendData: any = await resendRes.json();

    // Si Resend rechaza por estar en cuenta Sandbox de prueba sin dominio propio
    if (!resendRes.ok && (resendData.message?.includes('only send testing emails') || resendData.name === 'validation_error')) {
      const fallbackTestEmail = process.env.TEST_RECEIVER_EMAIL || 'benkr7@gmail.com';
      console.warn(`[RESEND SANDBOX] Redirigiendo correo de prueba de (${toEmail}) hacia (${fallbackTestEmail})`);

      const sandboxPayload = {
        ...resendPayload,
        to: [fallbackTestEmail],
        subject: `[Simulación Paciente: ${toEmail}] ${emailSubject}`
      };

      resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sandboxPayload)
      });
      resendData = await resendRes.json();
    }

    if (!resendRes.ok) {
      console.error('[RESEND API ERROR]', resendData);
      throw new Error(resendData.message || 'Error al enviar correo mediante Resend API.');
    }

    return {
      success: true,
      provider: 'resend',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: !!cleanBase64
    };
  }

  // 2. MÉTODO 2: Brevo HTTPS API (Port 443)
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    console.log(`[EMAIL DISPATCHER] Despachando correo vía BREVO HTTPS API a: ${toEmail}`);
    const brevoPayload: any = {
      sender: { name: 'Clínica NexoSalud', email: process.env.BREVO_SENDER_EMAIL || 'notificaciones@nexosalud.com' },
      to: [{ email: toEmail, name: patientName || 'Paciente' }],
      subject: emailSubject,
      htmlContent: htmlBody,
    };

    if (cleanBase64) {
      brevoPayload.attachment = [
        {
          name: pdfFileName,
          content: cleanBase64
        }
      ];
    }

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(brevoPayload)
    });

    const brevoData: any = await brevoRes.json();
    if (!brevoRes.ok) {
      console.error('[BREVO API ERROR]', brevoData);
      throw new Error(brevoData.message || 'Error al enviar correo mediante Brevo API.');
    }

    return {
      success: true,
      provider: 'brevo',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: !!cleanBase64
    };
  }

  // 3. MÉTODO 3: SMTP Directo (Nodemailer / Gmail)
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (smtpUser && smtpPass) {
    const cleanPass = smtpPass.replace(/\s+/g, '');
    const isGmail = smtpHost.toLowerCase().includes('gmail');

    const transporter = nodemailer.createTransport({
      ...(isGmail ? { service: 'gmail' } : { host: smtpHost, port: smtpPort, secure: smtpPort === 465 }),
      auth: {
        user: smtpUser,
        pass: cleanPass
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });

    const attachments: any[] = [];
    if (cleanBase64) {
      attachments.push({
        filename: pdfFileName,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    await transporter.sendMail({
      from: `"Clínica NexoSalud" <${smtpUser}>`,
      to: toEmail,
      subject: emailSubject,
      html: htmlBody,
      attachments
    });

    return {
      success: true,
      provider: 'smtp',
      message: `Documento enviado con éxito al correo ${toEmail}.`,
      toEmail,
      hasAttachment: attachments.length > 0
    };
  }

  // 4. MODO SIMULACIÓN (si no hay credenciales configuradas)
  console.log(`[EMAIL DISPATCHER] Enviando correo simulado a: ${toEmail} | Asunto: ${emailSubject}`);
  return {
    success: true,
    simulated: true,
    message: `Documento enviado correctamente a ${toEmail}.`,
    toEmail,
    hasAttachment: !!cleanBase64
  };
}

// Endpoint para enviar aviso o constancia PDF por correo
router.post('/send-notice-email', async (req, res) => {
  const {
    payerId,
    toEmail,
    patientName,
    subject,
    message,
    amount,
    serviceName,
    reservationDate,
    reservationTime,
    branch,
    professional,
    filename,
    pdfBase64,
    isValidated
  } = req.body;

  if (!toEmail) {
    return res.status(400).json({ error: 'El correo electrónico del paciente es obligatorio.' });
  }

  try {
    const reservationId = Number(payerId);
    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
      return res.status(400).json({ error: 'La reserva es obligatoria para enviar el documento.' });
    }
    const reserva = await prisma.reservas.findUnique({
      where: { id_reserva: reservationId },
      include: { Pagos: true }
    });
    if (!reserva) {
      return res.status(404).json({ error: 'No se encontró la reserva.' });
    }
    const paymentValidated = reserva.Pagos.some(pago => pago.estado === 'Validado');
    if (Boolean(isValidated) !== paymentValidated) {
      return res.status(409).json({
        error: paymentValidated
          ? 'El pago ya está validado. Solo puede enviarse la Constancia de Pago.'
          : 'La Constancia de Pago solo puede enviarse después de validar el pago.'
      });
    }
    if (!paymentValidated && ['Vencida', 'Cancelada'].includes(reserva.estado || '')) {
      return res.status(409).json({ error: 'La pre-reserva venció o fue cancelada; no puede enviarse la Orden de Pago.' });
    }

    const result = await sendPaymentNoticeOrConfirmation({
      toEmail,
      patientName,
      subject,
      message,
      amount,
      serviceName,
      reservationDate,
      reservationTime,
      branch,
      professional,
      filename,
      pdfBase64,
      isValidated
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error al enviar correo en backend:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el envío del correo.' });
  }
});

export default router;
