import { prisma } from '../db';

async function main() {
  const personas = await prisma.personas.count();
  const personasConNumero = await prisma.personas.count({ where: { numero: { not: null } } });
  const personasAutorizadas = await prisma.personas.count({ where: { autoriza_contacto: true } });
  const tratamientos = await prisma.tratamientosContratados.count();
  const tratamientosActivos = await prisma.tratamientosContratados.count({
    where: { estado_tratamiento: { in: ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso', 'En ejecución'] } }
  });
  const tratamientosCompletados = await prisma.tratamientosContratados.count({
    where: { estado_tratamiento: 'Completado' }
  });
  const sesiones = await prisma.sesionesTratamiento.count();
  const sesionesPendientes = await prisma.sesionesTratamiento.count({
    where: { estado_asistencial: 'Pendiente' }
  });
  const atenciones = await prisma.atenciones.count();
  const indicaciones = await prisma.indicacionesPostatencion.count();
  const seguimientos = await prisma.seguimientos.count();
  const incidencias = await prisma.incidencias.count();
  const alertas = await prisma.alertasIA.count();
  const solicitudes = await prisma.solicitudes.count();

  console.log('=== ESTADO ACTUAL DE NexoSaludDB (CUSTOMER) ===');
  console.log({
    personas,
    personasConNumero,
    personasAutorizadas,
    tratamientos,
    tratamientosActivos,
    tratamientosCompletados,
    sesiones,
    sesionesPendientes,
    atenciones,
    indicaciones,
    seguimientos,
    incidencias,
    alertas,
    solicitudes
  });

  // Mostrar algunos pacientes de muestra
  const muestraPacientes = await prisma.personas.findMany({
    take: 5,
    where: { numero: { not: null } },
    select: {
      id_persona: true,
      nombres: true,
      apellidos: true,
      numero: true,
      autoriza_contacto: true,
      TratamientosContratados: {
        select: {
          id_tratamiento: true,
          estado_tratamiento: true,
          Servicios: { select: { nombre: true } }
        }
      }
    }
  });

  console.log('Muestra de pacientes con número:');
  console.log(JSON.stringify(muestraPacientes, null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
