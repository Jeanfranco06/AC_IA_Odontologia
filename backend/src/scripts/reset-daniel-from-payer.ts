import { prisma } from '../db';

async function resetDanielFromPayer() {
  console.log('🔄 INICIANDO RESET COMPLETO DE DANIEL GARCÍA (ID 1) A ESTADO RECIÉN LLEGADO DE PAYER...');

  const now = new Date();
  // Cita para la Sesión 1: Lunes 16 de Noviembre a las 10:30 AM Lima (UTC-5 -> 15:30 UTC)
  // Como hoy en la prueba es Sábado 14 de Noviembre, la cita hábil más cercana es el Lunes 16 (las clínicas no abren domingos).
  const session1Date = new Date('2026-11-16T15:30:00.000Z');

  // Cita para la Sesión 2: Sábado 21 de Noviembre a las 11:00 AM Lima (UTC-5 -> 16:00 UTC)
  const session2Date = new Date('2026-11-21T16:00:00.000Z');

  // 1. Limpiar solicitudes de reprogramación previas
  const delReprog = await prisma.solicitudesReprogramacionCustomer.deleteMany({
    where: { id_persona: 1 }
  });
  console.log(`🧹 Reprogramaciones previas eliminadas: ${delReprog.count}`);

  // 2. Limpiar alertas de IA previas
  const delAlerts = await prisma.alertasIA.deleteMany({
    where: { id_persona: 1 }
  });
  console.log(`🧹 Alertas IA previas eliminadas: ${delAlerts.count}`);

  // 3. Limpiar incidencias previas
  try {
    const delInc = await prisma.incidencias.deleteMany({
      where: { id_persona: 1 }
    });
    console.log(`🧹 Incidencias previas eliminadas: ${delInc.count}`);
  } catch (e) {
    console.warn('Nota sobre incidencias:', (e as any).message);
  }

  // 4a. Limpiar borradores IA de Daniel primero (FK hacia IndicacionesPostatencion)
  try {
    const delDrafts = await prisma.borradoresIA.deleteMany({
      where: { id_persona: 1 }
    });
    console.log(`🧹 Borradores IA eliminados: ${delDrafts.count}`);
  } catch (e) {
    console.warn('Nota borradores IA:', (e as any).message);
  }

  // 4b. Limpiar indicaciones postatención previas
  const delInd = await prisma.indicacionesPostatencion.deleteMany({
    where: { Atenciones: { id_persona: 1 } }
  });
  console.log(`🧹 Indicaciones postatención eliminadas: ${delInd.count}`);

  // 5. Limpiar interacciones conversacionales de IA previas
  const delInter = await prisma.interaccionesIA.deleteMany({
    where: { id_persona: 1 }
  });
  console.log(`🧹 Interacciones IA previas eliminadas: ${delInter.count}`);

  // 6. Restablecer datos de Persona (Daniel García)
  const persona = await prisma.personas.update({
    where: { id_persona: 1 },
    data: {
      nombres: 'Daniel',
      apellidos: 'García',
      numero: '902455346',
      dni: '40000001',
      email: 'daniel.garcia@gmail.com',
      autoriza_contacto: true,
      fecha_autorizacion: now,
      Etapa: { connect: { id_etapa: 4 } } // CUSTOMER
    }
  });
  console.log(`✅ Persona verificada: ${persona.nombres} ${persona.apellidos} (Tel: ${persona.numero}, Etapa: CUSTOMER)`);

  // 7. Restablecer Reserva y Pago en PAYER (Guardian Financiero Satisfecho)
  await prisma.reservas.updateMany({
    where: { id_persona: 1 },
    data: {
      estado: 'Confirmada',
      confirmacion_explicita: true,
      fecha_confirmacion: now
    }
  });

  await prisma.pagos.updateMany({
    where: { id_persona: 1 },
    data: {
      estado: 'Validado',
      fecha_validacion: now,
      observaciones: 'Pago de anticipo validado conforme en PAYER'
    }
  });
  console.log('✅ Reserva y Pago en PAYER confirmados (Guardián Financiero OK)');

  // 8. Restablecer Tratamiento Contratado (Tratamiento #3 - Restauración Estética)
  const tratamiento = await prisma.tratamientosContratados.update({
    where: { id_tratamiento: 3 },
    data: {
      estado_tratamiento: 'Activado',
      id_profesional_responsable: 1, // Dra. Valeria Mendoza
      id_sede: 1,
      fecha_activacion: now,
      fecha_inicio_real: null,
      fecha_cierre_real: null,
      id_profesional_cierre: null
    }
  });
  console.log(`✅ Tratamiento #${tratamiento.id_tratamiento} en estado: ${tratamiento.estado_tratamiento}`);

  // 9. Restablecer Sesión 1 (id: 7) - Pendiente / Por atender
  const ses1 = await prisma.sesionesTratamiento.update({
    where: { id_sesion: 7 },
    data: {
      numero_sesion: 1,
      fecha_programada_vigente: session1Date,
      duracion_programada_min: 45,
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente',
      confirmacion_paciente: 'No_Solicitada',
      fecha_confirmacion: null,
      id_profesional: 1, // Dra. Valeria Mendoza (ai.odontologo.test@nexosalud.local)
      id_sede: 1 // Sede Centro Histórico
    }
  });
  console.log(`✅ Sesión 1 (ID ${ses1.id_sesion}): Programada para ${session1Date.toLocaleString('es-PE', { timeZone: 'America/Lima' })} - Pendiente`);

  // 10. Restablecer Sesión 2 (id: 8) - Pendiente / Por atender
  const ses2 = await prisma.sesionesTratamiento.update({
    where: { id_sesion: 8 },
    data: {
      numero_sesion: 2,
      fecha_programada_vigente: session2Date,
      duracion_programada_min: 45,
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente',
      confirmacion_paciente: 'No_Solicitada',
      fecha_confirmacion: null,
      id_profesional: 1, // Dra. Valeria Mendoza
      id_sede: 1
    }
  });
  console.log(`✅ Sesión 2 (ID ${ses2.id_sesion}): Programada para ${session2Date.toLocaleString('es-PE', { timeZone: 'America/Lima' })} - Pendiente`);

  // 11. Limpiar validaciones de ficha previas
  try {
    const delVal = await prisma.validacionesFicha.deleteMany({
      where: { Atenciones: { id_persona: 1 } }
    });
    console.log(`🧹 Validaciones de ficha eliminadas: ${delVal.count}`);
  } catch (e) {
    console.warn('Nota sobre validacionesFicha:', (e as any).message);
  }

  // 12. Limpiar seguimientos de encuestas previas
  try {
    const delSeg = await prisma.seguimientos.deleteMany({
      where: { id_persona: 1 }
    });
    console.log(`🧹 Seguimientos de fidelización eliminados: ${delSeg.count}`);
  } catch (e) {
    console.warn('Nota sobre seguimientos:', (e as any).message);
  }

  // 13. Restablecer atenciones de Daniel (Atención #50)
  await prisma.atenciones.updateMany({
    where: { id_persona: 1 },
    data: {
      estado_servicio: 'Programado',
      estado_cierre_documental: 'Pendiente',
      procedimiento: null,
      procedimiento_realizado: null,
      evaluacion: null,
      alergias: null,
      antecedentes: null,
      observaciones: null,
      diagnostico_basico: null,
      indicaciones_finales: null,
      asistencia: 'Pendiente',
      motivo_consulta: 'Restauración estética de pieza anterior'
    }
  });
  console.log('✅ Atenciones restablecidas a estado inicial de consulta.');

  console.log('\n🎯 RESET CULMINADO CON ÉXITO: Daniel García está en estado idéntico a recién ingresado de PAYER a CUSTOMER.');
}

resetDanielFromPayer()
  .catch((e) => {
    console.error('❌ Error en el reset:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
