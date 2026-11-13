/** Ejecutar con --apply para registrar propuestas en NexoSaludDB.
 * No revisa, publica ni emite; no cambia expedientes clínicos.
 */
import crypto from 'crypto';
import { prisma } from '../src/db';
import { AFTERCARE_TEMPLATE_SET, buildAftercareTemplate } from '../src/modules/customer/ai-agent/templates/aftercareTemplates';

async function main() {
  const [identity] = await prisma.$queryRaw<Array<{ name: string }>>`SELECT DB_NAME() AS name`;
  if (identity.name !== 'NexoSaludDB') throw Error('Destino distinto de NexoSaludDB; operación cancelada.');
  const services = await prisma.servicios.findMany({ where: { activo: true }, select: { id_servicio: true, nombre: true }, orderBy: { id_servicio: 'asc' } });
  if (!services.length) throw Error('No hay servicios activos.');
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'preview', database: identity.name, templates: services.map(buildAftercareTemplate) }));
    return;
  }
  const result = await prisma.$transaction(async tx => {
    // Autor administrativo de la carga técnica, sin atribuirle revisión clínica.
    const creator = await tx.usuarios.findFirstOrThrow({ where: { activo: true, Rol: { nombre: { in: ['Administrador', 'ADMIN', 'Admin'] } } }, orderBy: { id_usuario: 'asc' }, select: { id_usuario: true } });
    const existing = await tx.politicasCustomerIA.findMany({ where: { codigo: 'PLANTILLA_INDICACIONES' }, orderBy: { version: 'desc' } });
    let version = existing[0]?.version ?? 0;
    const rows: Array<{ id: number; service: string; version: number; status: string; created: boolean }> = [];
    for (const service of services) {
      const same = existing.find(row => {
        if (row.id_servicio !== service.id_servicio) return false;
        try { return JSON.parse(row.configuracion).templateSet === AFTERCARE_TEMPLATE_SET; } catch { return false; }
      });
      if (same) { rows.push({ id: same.id_politica, service: service.nombre, version: same.version, status: same.estado, created: false }); continue; }
      // UQ_PoliticaCustomer es (codigo, version): numeración global por código.
      const row = await tx.politicasCustomerIA.create({ data: { codigo: 'PLANTILLA_INDICACIONES', version: ++version, id_servicio: service.id_servicio, estado: 'Borrador', configuracion: JSON.stringify(buildAftercareTemplate(service)), id_usuario_creador: creator.id_usuario } });
      await tx.interaccionesIA.create({ data: { actor_orientado: 'ADMIN', id_usuario_actor: creator.id_usuario, tipo_evento: 'PLANTILLA_IA10_PREPARADA', resumen_consulta: 'Carga técnica por asistente a solicitud del usuario; sin revisión ni aprobación clínica.', resultado: `Propuesta ${row.id_politica} para servicio ${service.id_servicio}; requiere revisión profesional y publicación.`, version_agente: AFTERCARE_TEMPLATE_SET, estado: 'Completada', id_correlacion: crypto.randomUUID() } });
      rows.push({ id: row.id_politica, service: service.nombre, version: row.version, status: row.estado, created: true });
    }
    return rows;
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  console.log(JSON.stringify({ database: identity.name, templates: result, reviewedByAssistant: false, publishedByAssistant: false, indicationsIssued: 0 }));
}
main().catch(error => { console.error('Plantillas IA10:', error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
