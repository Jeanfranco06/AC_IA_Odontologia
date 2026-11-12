const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING CUSTOMER COHERENT CLINICAL DATA ---');

  const profValeria = 1;
  const profDiego = 2;
  const profLucia = 3;
  const profRenzo = 4;

  const sedeCentro = 1;
  const sedeCalifornia = 2;
  const sedeGolf = 3;

  // 1. ADRIANA ALAYO (ID 315)
  console.log('Verifying Adriana Alayo (315)...');
  const tAdriana = await prisma.tratamientosContratados.findUnique({ where: { id_tratamiento: 1 } });
  const planAdriana = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: 1 } });
  
  // Ensure Sesion 2 & 3 for Adriana
  const ses2Adriana = await prisma.sesionesTratamiento.findFirst({
    where: { id_tratamiento: 1, numero_sesion: 2 }
  });
  if (!ses2Adriana) {
    await prisma.sesionesTratamiento.create({
      data: {
        id_tratamiento: 1,
        id_plan: planAdriana.id_plan,
        numero_sesion: 2,
        id_profesional: profDiego,
        id_sede: sedeCalifornia,
        fecha_programada_vigente: new Date('2026-11-18T20:00:00.000Z'),
        estado_programacion: 'Programada',
        estado_asistencial: 'Pendiente',
        estado_cierre: 'Pendiente'
      }
    });
  }

  const ses3Adriana = await prisma.sesionesTratamiento.findFirst({
    where: { id_tratamiento: 1, numero_sesion: 3 }
  });
  if (!ses3Adriana) {
    await prisma.sesionesTratamiento.create({
      data: {
        id_tratamiento: 1,
        id_plan: planAdriana.id_plan,
        numero_sesion: 3,
        id_profesional: profDiego,
        id_sede: sedeCalifornia,
        fecha_programada_vigente: new Date('2026-11-25T20:00:00.000Z'),
        estado_programacion: 'Programada',
        estado_asistencial: 'Pendiente',
        estado_cierre: 'Pendiente'
      }
    });
  }

  // 2. JAVIER TERRONES (ID 314)
  console.log('Verifying Javier Terrones (314)...');
  const tJavier = await prisma.tratamientosContratados.findUnique({ where: { id_tratamiento: 2 } });
  const planJavier = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: 2 } });

  // Sesión 2 Javier (Programada para el 14 Nov)
  const ses2Javier = await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: 2, numero_sesion: 2 } },
    update: {
      id_plan: planJavier.id_plan,
      id_profesional: profValeria,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-14T16:30:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    },
    create: {
      id_tratamiento: 2,
      id_plan: planJavier.id_plan,
      numero_sesion: 2,
      id_profesional: profValeria,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-14T16:30:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    }
  });

  // Sesión 3 Javier (Programada para el 28 Nov)
  await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: 2, numero_sesion: 3 } },
    update: {
      id_plan: planJavier.id_plan,
      id_profesional: profValeria,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-28T16:30:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    },
    create: {
      id_tratamiento: 2,
      id_plan: planJavier.id_plan,
      numero_sesion: 3,
      id_profesional: profValeria,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-28T16:30:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    }
  });

  // 3. MARÍA GARCÍA (ID 1)
  console.log('Verifying María García (1)...');
  const tMaria = await prisma.tratamientosContratados.findFirst({ where: { id_persona: 1 } });
  const planMaria = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: tMaria.id_tratamiento } });

  await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: tMaria.id_tratamiento, numero_sesion: 1 } },
    update: {
      id_plan: planMaria.id_plan,
      id_profesional: profLucia,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-06T15:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-11-06T15:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-11-06T15:45:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    },
    create: {
      id_tratamiento: tMaria.id_tratamiento,
      id_plan: planMaria.id_plan,
      numero_sesion: 1,
      id_profesional: profLucia,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-06T15:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-11-06T15:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-11-06T15:45:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    }
  });

  await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: tMaria.id_tratamiento, numero_sesion: 2 } },
    update: {
      id_plan: planMaria.id_plan,
      id_profesional: profLucia,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-13T15:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    },
    create: {
      id_tratamiento: tMaria.id_tratamiento,
      id_plan: planMaria.id_plan,
      numero_sesion: 2,
      id_profesional: profLucia,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-13T15:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Pendiente',
      estado_cierre: 'Pendiente'
    }
  });

  // 4. CAMILA ESPINOZA (ID 187)
  console.log('Verifying Camila Espinoza (187)...');
  const tCamila = await prisma.tratamientosContratados.findFirst({ where: { id_persona: 187 } });
  const planCamila = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: tCamila.id_tratamiento } });

  await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: tCamila.id_tratamiento, numero_sesion: 1 } },
    update: {
      id_plan: planCamila.id_plan,
      id_profesional: profDiego,
      id_sede: sedeCalifornia,
      fecha_programada_vigente: new Date('2026-11-11T21:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Confirmada',
      estado_cierre: 'Pendiente'
    },
    create: {
      id_tratamiento: tCamila.id_tratamiento,
      id_plan: planCamila.id_plan,
      numero_sesion: 1,
      id_profesional: profDiego,
      id_sede: sedeCalifornia,
      fecha_programada_vigente: new Date('2026-11-11T21:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Confirmada',
      estado_cierre: 'Pendiente'
    }
  });

  // 5. MILAGROS ACOSTA (ID 189) - Ready for TURNED
  console.log('Seeding Milagros Acosta (189) - Ready for TURNED...');
  const tMilagros = await prisma.tratamientosContratados.findFirst({ where: { id_persona: 189 } });
  const planMilagros = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: tMilagros.id_tratamiento } });

  // Sesión 1 Milagros (Realizada 28 Oct)
  await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: tMilagros.id_tratamiento, numero_sesion: 1 } },
    update: {
      id_plan: planMilagros.id_plan,
      id_profesional: profRenzo,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-10-28T09:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-10-28T09:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-10-28T09:50:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    },
    create: {
      id_tratamiento: tMilagros.id_tratamiento,
      id_plan: planMilagros.id_plan,
      numero_sesion: 1,
      id_profesional: profRenzo,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-10-28T09:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-10-28T09:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-10-28T09:50:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    }
  });

  // Sesión 2 Milagros (Realizada 08 Nov)
  const ses2Milagros = await prisma.sesionesTratamiento.upsert({
    where: { id_tratamiento_numero_sesion: { id_tratamiento: tMilagros.id_tratamiento, numero_sesion: 2 } },
    update: {
      id_plan: planMilagros.id_plan,
      id_profesional: profRenzo,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-08T09:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-11-08T09:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-11-08T10:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    },
    create: {
      id_tratamiento: tMilagros.id_tratamiento,
      id_plan: planMilagros.id_plan,
      numero_sesion: 2,
      id_profesional: profRenzo,
      id_sede: sedeCentro,
      fecha_programada_vigente: new Date('2026-11-08T09:00:00.000Z'),
      fecha_inicio_atencion: new Date('2026-11-08T09:05:00.000Z'),
      fecha_cierre_sesion: new Date('2026-11-08T10:00:00.000Z'),
      estado_programacion: 'Programada',
      estado_asistencial: 'Realizada',
      estado_cierre: 'Cerrada'
    }
  });

  // 6. SOLICITUD DE REPROGRAMACIÓN PARA JAVIER TERRONES
  console.log('Seeding Reschedule Request for Javier Terrones...');
  const existingReq = await prisma.solicitudesReprogramacionCustomer.findUnique({
    where: { clave_idempotencia: 'seed-req-javier-1' }
  });
  if (!existingReq) {
    await prisma.solicitudesReprogramacionCustomer.create({
      data: {
        id_sesion: ses2Javier.id_sesion,
        id_tratamiento: 2,
        id_persona: 314,
        fecha_programada_original: ses2Javier.fecha_programada_vigente,
        fecha_preferida: new Date('2026-11-17T15:00:00.000Z'),
        franja_preferida: 'Tarde (14:00 - 18:00)',
        motivo_solicitud: 'Cruce con reunión de trabajo impostergable. Solicito atención por la tarde.',
        estado_solicitud: 'Pendiente',
        clave_idempotencia: 'seed-req-javier-1',
        id_correlacion: 'seed-corr-javier-1'
      }
    });
  }

  // 7. ALERTAS IA
  console.log('Seeding Alertas IA...');
  await prisma.alertasIA.upsert({
    where: { id_alerta_ia: 1 },
    update: {
      id_persona: 314,
      tipo_evento: 'AL-C02',
      mensaje_alerta: 'Sesión 2 de ortodoncia con solicitud de cambio de horario pendiente de revisión en recepción.',
      severidad: 'Media',
      estado: 'Generada',
      requiere_revision_humana: true,
      id_profesional: profValeria,
      id_tratamiento: 2,
      id_sesion: ses2Javier.id_sesion,
      clave_deduplicacion: 'AL-C02-314-SES2'
    },
    create: {
      id_alerta_ia: 1,
      id_persona: 314,
      tipo_evento: 'AL-C02',
      mensaje_alerta: 'Sesión 2 de ortodoncia con solicitud de cambio de horario pendiente de revisión en recepción.',
      severidad: 'Media',
      estado: 'Generada',
      requiere_revision_humana: true,
      id_profesional: profValeria,
      id_tratamiento: 2,
      id_sesion: ses2Javier.id_sesion,
      clave_deduplicacion: 'AL-C02-314-SES2'
    }
  });

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Error seeding customer data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
