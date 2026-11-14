import { prisma } from '../src/db';

async function main() {
  const admin = await prisma.usuarios.findFirst({ where: { activo: true, Rol: { nombre: { in: ['Administrador', 'ADMIN', 'Admin'] } } } });
  const dentist = await prisma.profesionales.findFirst({ where: { activo: true } });
  const services = await prisma.servicios.findMany({ where: { activo: true } });

  if (!admin || !dentist) {
    throw new Error('Admin o Dentista no encontrado');
  }

  console.log('Admin:', admin.id_usuario, 'Dentist:', dentist.id_profesional, 'Services count:', services.length);

  // 1. Politicas de DOCUMENTACION para cada servicio
  let docVersion = 0;
  for (const s of services) {
    const existing = await prisma.politicasCustomerIA.findFirst({
      where: { codigo: 'DOCUMENTACION', id_servicio: s.id_servicio }
    });
    if (!existing) {
      docVersion++;
      const config = {
        sourceReference: 'Protocolo Institucional NexoSalud - Estándar Clínico Odontológico 2026',
        requiredFields: ['motivo_consulta', 'evaluacion', 'procedimiento'],
        requiresProcedure: true,
        requiresInstructions: false
      };
      await prisma.politicasCustomerIA.create({
        data: {
          codigo: 'DOCUMENTACION',
          version: docVersion,
          id_servicio: s.id_servicio,
          estado: 'Publicada',
          configuracion: JSON.stringify(config),
          id_usuario_creador: admin.id_usuario,
          id_profesional_revisor: dentist.id_profesional,
          fecha_revision: new Date(),
          fecha_publicacion: new Date()
        }
      });
      console.log(`Creada politica DOCUMENTACION v${docVersion} para servicio ${s.id_servicio} (${s.nombre})`);
    } else {
      console.log(`Politica DOCUMENTACION ya existe para servicio ${s.id_servicio}`);
    }
  }

  // 2. Politica CONFIRMACION
  const confExisting = await prisma.politicasCustomerIA.findFirst({ where: { codigo: 'CONFIRMACION' } });
  if (!confExisting) {
    await prisma.politicasCustomerIA.create({
      data: {
        codigo: 'CONFIRMACION',
        version: 1,
        estado: 'Publicada',
        configuracion: JSON.stringify({
          sourceReference: 'Reglamento de Confirmación de Citas NexoSalud',
          windowMinutes: 43200
        }),
        id_usuario_creador: admin.id_usuario,
        id_profesional_revisor: dentist.id_profesional,
        fecha_revision: new Date(),
        fecha_publicacion: new Date()
      }
    });
    console.log('Creada politica CONFIRMACION v1');
  }

  // 3. Politica DERIVACION
  const derivExisting = await prisma.politicasCustomerIA.findFirst({ where: { codigo: 'DERIVACION' } });
  if (!derivExisting) {
    await prisma.politicasCustomerIA.create({
      data: {
        codigo: 'DERIVACION',
        version: 1,
        estado: 'Publicada',
        configuracion: JSON.stringify({
          sourceReference: 'Protocolo de Derivación Asistida NexoSalud',
          prioritization: 'REVISION_HUMANA',
          triggers: ['urgencia', 'dolor severo', 'reclamo', 'emergencia']
        }),
        id_usuario_creador: admin.id_usuario,
        id_profesional_revisor: dentist.id_profesional,
        fecha_revision: new Date(),
        fecha_publicacion: new Date()
      }
    });
    console.log('Creada politica DERIVACION v1');
  }

  console.log('Políticas institucionales inicializadas y publicadas correctamente.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
