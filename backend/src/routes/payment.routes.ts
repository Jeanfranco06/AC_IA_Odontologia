import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { sendPaymentNoticeOrConfirmation } from './payer.routes';

const router = Router();

// Función auxiliar para registrar el pago validado en SQL Server y transferir automáticamente a CUSTOMER
async function validateAndPromotePayer(payerId: number | string, channel: string, ref: string, amount?: number) {
  const numId = Number(payerId);
  if (isNaN(numId)) return null;

  try {
    const reserva = await prisma.reservas.findFirst({
      where: {
        OR: [
          { id_reserva: numId },
          { id_persona: numId }
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

    if (!reserva) return null;

    // H03 / R01-R04: Transición atómica e idempotente PAYER -> CUSTOMER
    let etapaCustomer = await prisma.etapas.findFirst({ where: { nombre: 'CUSTOMER' } });
    if (!etapaCustomer) {
      etapaCustomer = await prisma.etapas.create({ data: { nombre: 'CUSTOMER', descripcion: 'Atención' } });
    }
    const defaultProf = await prisma.profesionales.findFirst();
    const defaultSede = await prisma.sedes.findFirst();
    const etapaOrigenId = reserva.Persona.id_etapa_actual;

    const { pago, persona } = await prisma.$transaction(async (tx) => {
      // 1. Confirmar reserva en agenda
      await tx.reservas.update({
        where: { id_reserva: reserva.id_reserva },
        data: { estado: 'Confirmada', confirmacion_explicita: true, fecha_confirmacion: new Date() },
      });

      // 2. Registrar o validar pago
      let pagoTx = reserva.Pagos.length > 0 ? reserva.Pagos[0] : null;
      if (pagoTx) {
        pagoTx = await tx.pagos.update({
          where: { id_pago: pagoTx.id_pago },
          data: {
            estado: 'Validado',
            fecha_validacion: new Date(),
            canal_pago: channel,
            referencia_pago: ref,
          },
        });
      } else {
        pagoTx = await tx.pagos.create({
          data: {
            id_persona: reserva.id_persona,
            id_reserva: reserva.id_reserva,
            importe: amount || reserva.Opcion?.precio_ofrecido || 1.00,
            canal_pago: channel,
            referencia_pago: ref,
            estado: 'Validado',
            fecha_validacion: new Date(),
          },
        });
      }

      // 3. Promover a CUSTOMER y registrar EventosEtapa
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
            motivo: 'Transición atómica PAYER -> CUSTOMER desde pasarela',
            evidencia: `Pago #${pagoTx.id_pago} | Ref: ${ref}`,
          },
        });
      }

      // 4. Crear atención médica en agenda clínica si no existe
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

    try {
      await prisma.$executeRawUnsafe(
        `IF OBJECT_ID('dbo.usp_ActivarTratamientoDesdePayer', 'P') IS NOT NULL EXEC dbo.usp_ActivarTratamientoDesdePayer @id_reserva = ${Number(reserva.id_reserva)};`
      );
    } catch (procErr) {
      console.warn('[PAYMENT->CUSTOMER] Aviso al invocar usp_ActivarTratamientoDesdePayer:', procErr);
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
      const amountVal = Number(pago.importe || amount || reserva.Opcion?.precio_ofrecido || 1.00);

      sendPaymentNoticeOrConfirmation({
        toEmail: patientEmail,
        patientName: patientFullName,
        documentNumber: reserva.Persona?.dni || persona.dni,
        phone: reserva.Persona?.numero || persona.numero,
        subject: `✅ Constancia Oficial de Pago y Confirmación de Cita - NexoSalud #${reserva.id_reserva}`,
        amount: amountVal,
        originalPrice: reserva.Solicitud?.Servicio?.Tarifas[0] ? Number(reserva.Solicitud.Servicio.Tarifas[0].precio) : undefined,
        channel: channel || pago.canal_pago || 'YAPE',
        operationNumber: ref || pago.referencia_pago || `REF-${reserva.id_reserva}`,
        serviceName,
        reservationDate,
        reservationTime,
        branch: branchName,
        professional: profName,
        filename: `Constancia_Pago_${reserva.id_reserva}`,
        code: `CONST-${String(reserva.id_reserva).padStart(5, '0')}-${new Date().getFullYear()}`,
        isValidated: true
      }).then(resEmail => {
        console.log(`[AUTO-EMAIL PASARELA] Constancia enviada automáticamente a ${patientEmail}:`, resEmail);
      }).catch(err => {
        console.error('[AUTO-EMAIL ERROR] Error enviando correo desde pasarela:', err);
      });
    }

    return { reserva, pago, persona };
  } catch (err) {
    console.error('[validateAndPromotePayer] Error:', err);
    return null;
  }
}

/**
 * 0. Consultar medios de pago habilitados en la cuenta de Mercado Pago
 */
router.get('/payment-methods', async (req, res) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-4001730668702458-091700-e25cb8b7b1adb93aed667a28cfa96a3a-3595881654';
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al consultar medios de pago' });
  }
});

/**
 * 1. Procesar Pago Directo con YAPE (Flujo Oficial Mercado Pago)
 * Paso 1: Generar YAPE_TOKEN con teléfono + OTP usando requestId UUID
 * Paso 2: Crear el pago en /v1/payments con payment_method_id: 'yape', installments: 1
 */
router.post('/process-yape', async (req, res) => {
  const { payerId, amount, phone, otpCode, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-4001730668702458-091700-e25cb8b7b1adb93aed667a28cfa96a3a-3595881654';
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || 'APP_USR-21a7cc3a-0afb-4ac6-b41e-5d129a9022c5';

  const rawPhone = String(phone || '').replace(/\D/g, '');
  const rawOtp = String(otpCode || '').replace(/\D/g, '');
  const paymentAmount = Math.max(Number(amount) || 2, 2);

  // 1. Validar formato de teléfono y OTP
  if (!rawPhone || rawPhone.length !== 9 || !rawPhone.startsWith('9')) {
    return res.status(400).json({
      error: 'El número de celular de Yape debe tener 9 dígitos y empezar con 9 (ej. 987654321).'
    });
  }

  if (!rawOtp || rawOtp.length !== 6) {
    return res.status(400).json({
      error: 'El código de aprobación de Yape debe tener exactamente 6 dígitos.'
    });
  }

  try {
    const requestId = randomUUID();
    console.log(`[Yape] Solicitando token a Mercado Pago con requestId UUID: ${requestId}, celular: ${rawPhone}`);

    // Paso 1: Generar el token oficial en la API de Yape de Mercado Pago (todos los campos como string con requestId UUID)
    const tokenResponse = await fetch(`https://api.mercadopago.com/platforms/pci/yape/v1/payment?public_key=${publicKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: String(rawPhone),
        otp: String(rawOtp),
        requestId: requestId
      })
    });

    const tokenData = await tokenResponse.json();
    console.log('[Yape] Respuesta de tokenización Mercado Pago:', tokenData);

    if (!tokenResponse.ok || !tokenData || !tokenData.id) {
      const rawMsg = tokenData?.message || (tokenData?.cause && tokenData.cause[0]?.description) || '';
      const errorMsg = rawMsg === 'internal_error'
        ? 'El servicio de Yape (BCP) no pudo validar el código en este momento. Abre tu app Yape, pulsa en "Código de aprobación" y escribe el código de 6 dígitos activo.'
        : (rawMsg || 'Código de aprobación de Yape inválido o expirado. Genera uno nuevo en tu app Yape.');

      return res.status(400).json({
        error: errorMsg,
        details: tokenData
      });
    }

    const yapeTokenId = tokenData.id;
    console.log('[Yape] Token oficial generado con éxito:', yapeTokenId);

    // Paso 2: Crear el cobro en /v1/payments usando el token obtenido
    const paymentData = {
      token: yapeTokenId,
      transaction_amount: Number(paymentAmount.toFixed(2)),
      description: 'Reserva Odontológica NexoSalud - Yape',
      payment_method_id: 'yape',
      installments: 1,
      payer: {
        email: (email && email.includes('@')) ? email : 'paciente_yape@gmail.com',
      }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();
    console.log('[Yape] Respuesta de Mercado Pago /v1/payments:', data);

    if (response.ok && (data.status === 'approved' || data.status === 'in_process' || response.status === 201)) {
      // Registrar automáticamente en SQL Server y transferir a CUSTOMER
      if (payerId) {
        await validateAndPromotePayer(payerId, 'YAPE', `MP-${data.id}`, paymentAmount);
      }

      return res.json({
        status: data.status || 'approved',
        id: data.id,
        status_detail: data.status_detail
      });
    }

    // Si el pago no fue aprobado por Mercado Pago
    const causeMsg = data?.cause && Array.isArray(data.cause)
      ? data.cause.map((c: any) => c.description || c.code || JSON.stringify(c)).join(', ')
      : '';

    const detailMsg = causeMsg || data?.status_detail || data?.message || 'Error en pasarela de pago';

    let rejectionReason = detailMsg;
    if (detailMsg === 'cc_rejected_insufficient_amount') {
      rejectionReason = 'Saldo insuficiente en tu cuenta Yape.';
    } else if (detailMsg === 'internal_error' || data?.message === 'internal_error') {
      rejectionReason = 'Mercado Pago (internal_error): El servicio del banco BCP no pudo procesar la transacción en este instante. Verifica que tu saldo sea suficiente o genera un nuevo código de aprobación.';
    }

    return res.status(400).json({
      error: rejectionReason,
      status: data.status,
      status_detail: data.status_detail,
      details: data
    });

  } catch (error: any) {
    console.error('Error interno procesando Yape:', error);
    return res.status(500).json({ error: error.message || 'Error de conexión con la pasarela de Yape' });
  }
});

/**
 * 2. Generar Preferencia de Checkout Pro
 */
router.post('/create-preference', async (req, res) => {
  const { payerId, title, amount, personName, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en backend/.env' });
  }

  try {
    const preferenceData: any = {
      items: [
        {
          id: String(payerId || '1'),
          title: title || 'Reserva de Servicio Odontológico',
          quantity: 1,
          currency_id: 'PEN',
          unit_price: Number(amount) || 2.00,
        },
      ],
      payer: {
        name: personName || 'Paciente NexoSalud',
        email: (email && email.includes('@')) ? email : 'paciente_prueba@test.com',
      },
      back_urls: {
        success: `${(process.env.FRONTEND_URL || process.env.APP_URL || 'https://proyecto-in-odontologia.vercel.app').replace(/\/+$/, '')}/payer/${payerId}?status=approved`,
        failure: `${(process.env.FRONTEND_URL || process.env.APP_URL || 'https://proyecto-in-odontologia.vercel.app').replace(/\/+$/, '')}/payer/${payerId}?status=failure`,
        pending: `${(process.env.FRONTEND_URL || process.env.APP_URL || 'https://proyecto-in-odontologia.vercel.app').replace(/\/+$/, '')}/payer/${payerId}?status=pending`,
      },
      payment_methods: {
        excluded_payment_types: [],
        installments: 1
      }
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error desde la API de Mercado Pago:', data);
      return res.status(response.status).json({
        error: data.message || (data.cause && data.cause[0]?.description) || 'Error generando preferencia en Mercado Pago',
        details: data
      });
    }

    res.json({
      id: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
      isMock: false
    });
  } catch (error: any) {
    console.error('Error en servidor payment.routes:', error);
    res.status(500).json({ error: error.message || 'Error interno al procesar preferencia' });
  }
});

/**
 * 3. Procesar Pago vía Checkout API (Payment Brick)
 * Recibe el token y datos generados directamente en el frontend y valida estrictamente con Mercado Pago
 */
router.post('/process-checkout-api', async (req, res) => {
  const { payerId, formData, amount, email } = req.body;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en backend/.env' });
  }

  try {
    const rawAmount = formData?.transaction_amount ?? amount;
    const paymentAmount = Number(rawAmount) > 0 ? Number(rawAmount) : 2.00;

    const paymentBody: any = {
      ...formData,
      transaction_amount: paymentAmount,
      description: formData?.description || 'Reserva Odontológica NexoSalud',
      payer: {
        ...formData?.payer,
        email: (formData?.payer?.email && formData.payer.email.includes('@'))
          ? formData.payer.email
          : (email || 'paciente@nexosalud.com'),
      }
    };

    console.log('[Tarjeta] Enviando pago a Mercado Pago /v1/payments:', JSON.stringify(paymentBody, null, 2));

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': `checkout-api-${payerId}-${Date.now()}`
      },
      body: JSON.stringify(paymentBody)
    });

    const data = await response.json();
    console.log('[Tarjeta] Respuesta de Mercado Pago /v1/payments:', data);

    if (!response.ok) {
      const errorMsg = data.message ||
        (data.cause && data.cause[0]?.description) ||
        'Error al procesar el pago con la tarjeta. Verifica que los datos sean correctos (o usa una tarjeta de prueba de Mercado Pago válida).';

      return res.status(response.status).json({
        error: errorMsg,
        details: data
      });
    }

    if (data.status === 'rejected') {
      const rejectReason = data.status_detail === 'cc_rejected_bad_filled_other'
        ? 'Datos de la tarjeta incorrectos (número, fecha o código de seguridad).'
        : data.status_detail === 'cc_rejected_insufficient_amount'
        ? 'Fondos insuficientes en la tarjeta.'
        : data.status_detail === 'cc_rejected_other_reason'
        ? 'Tarjeta rechazada por la pasarela de pago.'
        : (data.message || 'El pago con tarjeta fue rechazado por el banco emisor.');

      return res.status(400).json({
        error: rejectReason,
        status: data.status,
        status_detail: data.status_detail,
        details: data
      });
    }

    if (data.status === 'approved' || data.status === 'in_process') {
      // Registrar automáticamente en SQL Server y transferir a CUSTOMER
      if (payerId) {
        await validateAndPromotePayer(payerId, 'TARJETA_MP', `MP-${data.id}`, paymentAmount);
      }
    }

    res.json({
      status: data.status,
      id: data.id,
      status_detail: data.status_detail
    });
  } catch (error: any) {
    console.error('Error interno procesando Checkout API:', error);
    res.status(500).json({ error: error.message || 'Error interno en Checkout API' });
  }
});

/**
 * 4. Webhook Oficial de Mercado Pago (IPN y Webhook events)
 * Procesa notificaciones automáticas en background cuando un pago es aprobado
 */
router.post('/webhook', async (req, res) => {
  const { type, data, action } = req.body;
  const paymentId = data?.id || req.query['data.id'] || req.query.id;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  console.log(`[Mercado Pago Webhook] Recibido evento: type=${type || action}, paymentId=${paymentId}`);

  // Responder 200 inmediatamente a Mercado Pago
  res.status(200).send('OK');

  if (!paymentId || !accessToken) return;

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!mpRes.ok) return;

    const mpPayment = await mpRes.json();
    console.log(`[Mercado Pago Webhook] Pago ${paymentId} status=${mpPayment.status}, external_reference=${mpPayment.external_reference}`);

    if (mpPayment.status === 'approved') {
      const payerId = mpPayment.external_reference || (mpPayment.additional_info?.items?.[0]?.id);
      if (payerId) {
        await validateAndPromotePayer(
          payerId,
          mpPayment.payment_method_id?.toUpperCase() || 'MERCADOPAGO',
          `MP-${mpPayment.id}`,
          mpPayment.transaction_amount
        );
        console.log(`[Mercado Pago Webhook] Payer ${payerId} validado y promovido a CUSTOMER exitosamente.`);
      }
    }
  } catch (err) {
    console.error('[Mercado Pago Webhook Error]:', err);
  }
});

export default router;
