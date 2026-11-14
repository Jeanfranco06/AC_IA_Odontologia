import { prisma } from '../db';

async function main() {
  const userPhone = '902455346';
  const fullPhone = '51902455346';
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(16, 30, 0, 0);

  console.log(`Configurando paciente de prueba para el número ${userPhone} (${fullPhone})...`);

  // Actualizamos o reutilizamos el paciente con id_persona = 1
  const persona = await prisma.personas.update({
    where: { id_persona: 1 },
    data: {
      nombres: 'Daniel',
      apellidos: 'García',
      numero: userPhone,
      autoriza_contacto: true,
      fecha_autorizacion: now
    }
  });

  console.log(`✅ Paciente actualizado: ${persona.nombres} ${persona.apellidos} (ID: ${persona.id_persona}, Tel: ${persona.numero})`);

  // Asegurar que tiene un tratamiento activo en CUSTOMER
  let tratamiento = await prisma.tratamientosContratados.findFirst({
    where: { id_persona: persona.id_persona },
    include: { Servicios: true, Sedes: true, Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: true }
  });

  if (tratamiento) {
    await prisma.tratamientosContratados.update({
      where: { id_tratamiento: tratamiento.id_tratamiento },
      data: {
        estado_tratamiento: 'En ejecución',
        fecha_activacion: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
        fecha_inicio_real: new Date(now.getTime() - 15 * 24 * 3600 * 1000)
      }
    });
  }

  // Asegurar que tiene una sesión programada para mañana a las 16:30
  let sesion = await prisma.sesionesTratamiento.findFirst({
    where: {
      id_tratamiento: tratamiento?.id_tratamiento,
      estado_asistencial: 'Pendiente'
    }
  });

  if (sesion) {
    await prisma.sesionesTratamiento.update({
      where: { id_sesion: sesion.id_sesion },
      data: {
        fecha_programada_vigente: tomorrow,
        estado_programacion: 'Programada',
        confirmacion_paciente: 'No_Solicitada'
      }
    });
    console.log(`✅ Sesión ${sesion.id_sesion} programada para mañana: ${tomorrow.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
  }

  // Asegurar una atención previa con indicaciones médicas oficiales
  let atencion = await prisma.atenciones.findFirst({
    where: { id_persona: persona.id_persona },
    orderBy: { fecha_atencion: 'desc' }
  });

  const indicacionesTexto = [
    '1. Evitar alimentos y bebidas muy calientes, pigmentadas o frías durante las primeras 24 horas.',
    '2. Mantener higiene cuidadosa con cepillo de cerdas suaves sin frotar con fuerza la encía tratada.',
    '3. Si presenta sensibilidad o dolor leve, tomar Paracetamol 500mg cada 8 horas según necesidad.',
    '4. Acudir a su sesión de control y retiro programada.'
  ].join('\n');

  if (atencion) {
    await prisma.atenciones.update({
      where: { id_atencion: atencion.id_atencion },
      data: {
        estado_servicio: 'Realizado',
        estado_cierre_documental: 'Cerrada',
        indicaciones_finales: indicacionesTexto
      }
    });

    // Crear o actualizar en IndicacionesPostatencion
    await prisma.indicacionesPostatencion.deleteMany({
      where: { id_atencion: atencion.id_atencion }
    });

    await prisma.indicacionesPostatencion.create({
      data: {
        id_atencion: atencion.id_atencion,
        version: 1,
        es_version_vigente: true,
        estado: 'Documento emitido',
        contenido_indicaciones: indicacionesTexto,
        id_profesional_aprobador: atencion.id_profesional,
        fecha_aprobacion: now,
        fecha_emision: now
      }
    });

    console.log(`✅ Atención ${atencion.id_atencion} configurada con indicaciones médicas vigentes.`);
  }

  console.log('\n=== LISTO PARA PRUEBAS DESDE TU WHATSAPP ===');
  console.log(`Número vinculado: ${userPhone}`);
  console.log(`Paciente asignado: ${persona.nombres} ${persona.apellidos}`);
  console.log(`Tratamiento: ${tratamiento?.Servicios?.nombre || 'Ortodoncia'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
