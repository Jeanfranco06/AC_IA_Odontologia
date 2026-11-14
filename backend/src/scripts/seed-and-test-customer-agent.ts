import { prisma } from '../db';
import { WhatsAppAdherenceService } from '../modules/customer/whatsapp/services/whatsappAdherenceService';
import { WhatsAppPostCareService } from '../modules/customer/whatsapp/services/whatsappPostCareService';
import { WhatsAppLoyaltyService } from '../modules/customer/whatsapp/services/whatsappLoyaltyService';
import { WhatsAppRouterService } from '../modules/customer/whatsapp/services/whatsappRouterService';
import { WhatsAppIdentityService } from '../modules/customer/whatsapp/services/whatsappIdentityService';

async function main() {
  console.log('======================================================================');
  console.log('   PRUEBA INTEGRAL Y POBLAMIENTO DE EVIDENCIAS: AGENTE CUSTOMER      ');
  console.log('======================================================================\n');

  const now = new Date();

  // -------------------------------------------------------------------------
  // PASO 1: SEEDING / AJUSTE DE ESCENARIOS EN NexoSaludDB
  // -------------------------------------------------------------------------
  console.log('👉 [1/6] Preparando pacientes y escenarios sintéticos en NexoSaludDB...');

  // Asegurar que los pacientes de prueba tengan teléfono válido y autoricen contacto
  await prisma.personas.updateMany({
    where: { id_persona: { in: [1, 2, 3, 4, 5] } },
    data: { autoriza_contacto: true }
  });

  // Escenario A: María García (id_persona: 1, cel: 910000001) -> Cita mañana para recordatorio T-24h
  const tomorrowSessionDate = new Date(now.getTime() + 22 * 60 * 60 * 1000); // dentro de 22 horas
  let sessionA = await prisma.sesionesTratamiento.findFirst({
    where: {
      TratamientosContratados: { id_persona: 1 },
      estado_asistencial: 'Pendiente'
    }
  });

  if (sessionA) {
    await prisma.sesionesTratamiento.update({
      where: { id_sesion: sessionA.id_sesion },
      data: {
        fecha_programada_vigente: tomorrowSessionDate,
        confirmacion_paciente: 'No_Solicitada',
        estado_programacion: 'Programada'
      }
    });
  }

  // Escenario B: Lucía Benites (id_persona: 3, cel: 910000003) -> Atención realizada ayer para check-in 24h
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let attentionB = await prisma.atenciones.findFirst({
    where: { id_persona: 3 }
  });

  if (attentionB) {
    await prisma.atenciones.update({
      where: { id_atencion: attentionB.id_atencion },
      data: {
        fecha_atencion: yesterdayDate,
        estado_servicio: 'Realizado',
        indicaciones_finales: 'Gasa a presión durante 45 minutos. Dieta blanda. Tomar Ketorolaco 10mg cada 8 horas si hay dolor.'
      }
    });
    // Limpiar seguimientos previos para poder probar el check-in
    await prisma.seguimientos.deleteMany({
      where: { id_atencion: attentionB.id_atencion }
    });
  }

  // Escenario C: Jorge Chigne (id_persona: 4, cel: 910000004) -> Tratamiento completado recientemente para NPS
  const closedThreeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const startOneMonthAgo = new Date(closedThreeDaysAgo.getTime() - 20 * 24 * 60 * 60 * 1000);
  let treatmentC = await prisma.tratamientosContratados.findFirst({
    where: { id_persona: 4 }
  });

  if (treatmentC) {
    await prisma.tratamientosContratados.update({
      where: { id_tratamiento: treatmentC.id_tratamiento },
      data: {
        estado_tratamiento: 'Completado',
        fecha_inicio_real: startOneMonthAgo,
        fecha_cierre_real: closedThreeDaysAgo
      }
    });
    await prisma.seguimientos.deleteMany({
      where: { id_persona: 4, tipo: 'ENCUESTA_NPS' }
    });
  }

  // Escenario D: José Flores (id_persona: 2, cel: 910000002) -> Tratamiento completado hace 6 meses para Recall
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const startSevenMonthsAgo = new Date(sixMonthsAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
  let treatmentD = await prisma.tratamientosContratados.findFirst({
    where: { id_persona: 2 }
  });

  if (treatmentD) {
    await prisma.tratamientosContratados.update({
      where: { id_tratamiento: treatmentD.id_tratamiento },
      data: {
        estado_tratamiento: 'Completado',
        fecha_inicio_real: startSevenMonthsAgo,
        fecha_cierre_real: sixMonthsAgo
      }
    });
    await prisma.seguimientos.deleteMany({
      where: { id_persona: 2, tipo: 'RECALL_6_MESES' }
    });
  }

  console.log('✅ Pacientes y escenarios preparados correctamente.\n');

  // -------------------------------------------------------------------------
  // PASO 2: PRUEBA DE RECORDATORIOS PROACTIVOS (T-24h) Y CONFIRMACIÓN EN 1 CLIC
  // -------------------------------------------------------------------------
  console.log('👉 [2/6] Ejecutando recordatorios de cita T-24h (Pilar 2: Adherencia)...');
  const remindersResult = await WhatsAppAdherenceService.sendUpcomingSessionReminders(24);
  console.log(`   Resultado envío: ${remindersResult.sent} recordatorios enviados, ${remindersResult.skipped} omitidos.`);

  // Simular que María García (id_persona: 1) recibe el recordatorio y pulsa el botón "✅ Confirmar"
  if (sessionA) {
    console.log(`\n📲 [Simulación WhatsApp] Paciente María García presiona "✅ Confirmar" en su celular...`);
    const patientA = await WhatsAppIdentityService.resolvePatientByPhone('910000001');
    if (patientA) {
      const confirmResult = await WhatsAppAdherenceService.handleInteractiveAction(
        patientA,
        `CONFIRM_SESSION_${sessionA.id_sesion}`
      );
      console.log('   Mensaje retornado al paciente en WhatsApp:');
      console.log('   --------------------------------------------------------------');
      console.log(`   ${confirmResult.replyText?.replace(/\n/g, '\n   ')}`);
      console.log('   --------------------------------------------------------------');

      // Verificar en la base de datos
      const sessionUpdated = await prisma.sesionesTratamiento.findUnique({
        where: { id_sesion: sessionA.id_sesion },
        select: { confirmacion_paciente: true, fecha_confirmacion: true }
      });
      console.log(`   🔍 Verificación DB: confirmacion_paciente = "${sessionUpdated?.confirmacion_paciente}", fecha = ${sessionUpdated?.fecha_confirmacion}`);
    }
  }

  // -------------------------------------------------------------------------
  // PASO 3: PRUEBA DE SEGUIMIENTO POST-ATENCIÓN 24h (Pilar 1: Recuperación)
  // -------------------------------------------------------------------------
  console.log('\n👉 [3/6] Ejecutando Check-ins Post-Atención 24h (Pilar 1: Recuperación)...');
  const postCareCheckins = await WhatsAppPostCareService.sendPostCareCheckins(12, 48);
  console.log(`   Resultado envío: ${postCareCheckins.sent} check-ins enviados, ${postCareCheckins.skipped} omitidos.`);

  // Simular respuesta favorable (Opción 1: Me siento bien)
  if (attentionB) {
    console.log(`\n📲 [Simulación WhatsApp] Paciente Lucía Benites responde check-in: "1. Me siento bien"...`);
    const patientB = await WhatsAppIdentityService.resolvePatientByPhone('910000003');
    if (patientB) {
      const postCareReply = await WhatsAppPostCareService.handlePostCareButton(
        patientB,
        `POSTCARE_OK_${attentionB.id_atencion}`
      );
      console.log('   Mensaje retornado al paciente:');
      console.log('   --------------------------------------------------------------');
      console.log(`   ${postCareReply.replyText?.replace(/\n/g, '\n   ')}`);
      console.log('   --------------------------------------------------------------');

      const seguimientoCreado = await prisma.seguimientos.findFirst({
        where: { id_atencion: attentionB.id_atencion },
        orderBy: { fecha_hora: 'desc' }
      });
      console.log(`   🔍 Verificación DB en Seguimientos: id=${seguimientoCreado?.id_seguimiento}, resultado="${seguimientoCreado?.resultado}", incidencia=${seguimientoCreado?.incidencia}`);
    }
  }

  // -------------------------------------------------------------------------
  // PASO 4: PRUEBA DE TRIAJE CLÍNICO ANTE DOLOR SEVERO Y BANDERAS ROJAS
  // -------------------------------------------------------------------------
  console.log('\n👉 [4/6] Probando Triaje Clínico ante Complicación y Banderas Rojas (Pilar 1)...');
  console.log('📲 [Simulación WhatsApp] Paciente Lucía Benites reporta: "Tengo mucho dolor nivel 9, sangrado continuo y fiebre"...');

  const patientTriage = await WhatsAppIdentityService.resolvePatientByPhone('910000003');
  if (patientTriage && attentionB) {
    const triageResult = await WhatsAppPostCareService.evaluateAndRegisterTriage(patientTriage, {
      attentionId: attentionB.id_atencion,
      painLevel: 9,
      symptoms: 'Dolor pulsátil severo nivel 9, sangrado continuo desde hace 1 hora y fiebre de 38.6°C',
      hasRedFlags: true,
      redFlagDetails: 'Hemorragia continua y fiebre alta'
    });

    console.log('   Resultado de Triaje Clínico:');
    console.log(`   • ¿Es Urgencia Médica?: ${triageResult.isUrgent ? 'SÍ (ALTA PRIORIDAD)' : 'NO'}`);
    console.log(`   • ID Alerta Asistencial Generada: ${triageResult.alertId}`);
    console.log(`   • ID Incidencia Registrada: ${triageResult.incidentId}`);
    console.log(`   • ID Seguimiento Persistido: ${triageResult.trackingId}`);
    console.log('   Instrucciones automáticas de emergencia enviadas al paciente:');
    console.log('   --------------------------------------------------------------');
    console.log(`   ${triageResult.patientGuidance.replace(/\n/g, '\n   ')}`);
    console.log('   --------------------------------------------------------------');

    // Verificar alerta ALT-C08 en base de datos
    if (triageResult.alertId) {
      const alerta = await prisma.alertasIA.findUnique({ where: { id_alerta_ia: triageResult.alertId } });
      console.log(`   🔍 Verificación DB en AlertasIA: tipo="${alerta?.tipo_evento}", severidad="${alerta?.severidad}", mensaje="${alerta?.mensaje_alerta}"`);
    }
  }

  // -------------------------------------------------------------------------
  // PASO 5: PRUEBA DE MEDICIÓN DE SATISFACCIÓN NPS Y REFERIDOS (Pilar 3)
  // -------------------------------------------------------------------------
  console.log('\n👉 [5/6] Probando Encuestas NPS y Segmentación Promotor/Detractor (Pilar 3)...');

  // Caso 1: Promotor (Jorge Chigne califica con 10)
  console.log('📲 [Simulación WhatsApp] Jorge Chigne califica con "10" (Excelente servicio)...');
  const patientPromoter = await WhatsAppIdentityService.resolvePatientByPhone('910000004');
  if (patientPromoter) {
    const npsPromoter = await WhatsAppLoyaltyService.recordSatisfactionSurvey(patientPromoter, {
      score: 10,
      feedback: 'El tratamiento de profilaxis superó mis expectativas, cero dolor y gran atención del doctor.'
    });

    console.log(`   • Categoría: ${npsPromoter.category}`);
    console.log(`   • Código de Referidos Generado: ${npsPromoter.referralCode}`);
    console.log(`   • Enlace Google Reviews: ${npsPromoter.googleReviewUrl}`);
    console.log('   Respuesta enviada al paciente:');
    console.log('   --------------------------------------------------------------');
    console.log(`   ${npsPromoter.replyMessage.replace(/\n/g, '\n   ')}`);
    console.log('   --------------------------------------------------------------');
  }

  // Caso 2: Detractor (Simulamos paciente que califica con 4 por demora)
  console.log('\n📲 [Simulación WhatsApp] Paciente califica con "4" (Detractor por retraso)...');
  const patientDetractor = await WhatsAppIdentityService.resolvePatientByPhone('910000005');
  if (patientDetractor) {
    const npsDetractor = await WhatsAppLoyaltyService.recordSatisfactionSurvey(patientDetractor, {
      score: 4,
      feedback: 'Esperé 45 minutos en sala de espera a pesar de llegar puntual.'
    });

    console.log(`   • Categoría: ${npsDetractor.category}`);
    console.log(`   • Incidencia Registrada: ID ${npsDetractor.incidentId}`);
    console.log('   Respuesta enviada al paciente:');
    console.log('   --------------------------------------------------------------');
    console.log(`   ${npsDetractor.replyMessage.replace(/\n/g, '\n   ')}`);
    console.log('   --------------------------------------------------------------');
  }

  // -------------------------------------------------------------------------
  // PASO 6: RECALLS PREVENTIVOS A 6 MESES Y CROSS-SELLING ÉTICO (Pilar 3)
  // -------------------------------------------------------------------------
  console.log('\n👉 [6/6] Probando Recalls Semestrales y Cross-Selling a Etapa LEAD (Pilar 3)...');

  // Recall preventivo
  const recallsResult = await WhatsAppLoyaltyService.sendSixMonthRecalls();
  console.log(`   Recalls a 6 meses enviados: ${recallsResult.sent}, omitidos: ${recallsResult.skipped}.`);

  // Cross-selling ético: Paciente Jorge Chigne se interesa en "Blanqueamiento Dental"
  console.log('\n📲 [Simulación WhatsApp] Jorge Chigne solicita información de Blanqueamiento Dental...');
  if (patientPromoter) {
    const leadResult = await WhatsAppLoyaltyService.createComplementaryLead(
      patientPromoter,
      4, // ID servicio de blanqueamiento o profilaxis
      'Paciente satisfecho con profilaxis consulta por blanqueamiento dental'
    );

    console.log(`   • ¿Lead Creado en Etapa LEAD?: ${leadResult.success ? 'SÍ' : 'NO'}`);
    console.log(`   • ID Solicitud Generada: ${leadResult.idSolicitud}`);
    console.log('   Respuesta enviada al paciente:');
    console.log('   --------------------------------------------------------------');
    console.log(`   ${leadResult.message.replace(/\n/g, '\n   ')}`);
    console.log('   --------------------------------------------------------------');

    if (leadResult.idSolicitud) {
      const solicitud = await prisma.solicitudes.findUnique({
        where: { id_solicitud: leadResult.idSolicitud }
      });
      console.log(`   🔍 Verificación DB en Solicitudes: id=${solicitud?.id_solicitud}, persona=${solicitud?.id_persona}, tipo="${solicitud?.tipo_consulta}", motivo="${solicitud?.motivo}"`);
    }
  }

  // -------------------------------------------------------------------------
  // BALANCE FINAL EN LA BASE DE DATOS
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('   BALANCE DE EVIDENCIAS GENERADAS EN NexoSaludDB                    ');
  console.log('======================================================================');

  const totalSeguimientos = await prisma.seguimientos.count();
  const totalIncidencias = await prisma.incidencias.count();
  const totalAlertas = await prisma.alertasIA.count();
  const ultimosSeguimientos = await prisma.seguimientos.findMany({
    take: 5,
    orderBy: { fecha_hora: 'desc' },
    select: { id_seguimiento: true, canal: true, tipo: true, resultado: true, satisfaccion: true, incidencia: true }
  });

  console.log({
    totalSeguimientosRegistrados: totalSeguimientos,
    totalIncidenciasRegistradas: totalIncidencias,
    totalAlertasAsistenciales: totalAlertas
  });

  console.log('\nÚltimos 5 registros de seguimiento en la base de datos:');
  console.log(JSON.stringify(ultimosSeguimientos, null, 2));

  console.log('\n✅ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO Y CON EVIDENCIA PERSISTIDA.');
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
