import { prisma } from '../../src/db';
import { assertIsolatedSqlServer } from './isolatedSqlServer';
export async function syncCertificationMart() {
  await assertIsolatedSqlServer();
  // Las suites históricas eliminan fixtures. Se retiran exclusivamente sus hechos huérfanos
  // en el mart Test, sin alterar hechos de una base operativa ni redefinir medidas.
  return prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe(`DELETE f FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer f WHERE (ClaseEventoIA='INTERACCION' AND NOT EXISTS(SELECT 1 FROM dbo.InteraccionesIA i WHERE i.id_interaccion_ia=f.id_origen_ia)) OR (ClaseEventoIA='ALERTA' AND NOT EXISTS(SELECT 1 FROM dbo.AlertasIA a WHERE a.id_alerta_ia=f.id_origen_ia)) OR (ClaseEventoIA='BORRADOR' AND NOT EXISTS(SELECT 1 FROM dbo.BorradoresIA b WHERE b.id_borrador_ia=f.id_origen_ia))`);
    await tx.$executeRawUnsafe(`DELETE f FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2 f WHERE NOT EXISTS(SELECT 1 FROM dbo.Atenciones a WHERE a.id_atencion=f.id_atencion)`);
    await tx.$executeRawUnsafe(`DELETE f FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer f WHERE NOT EXISTS(SELECT 1 FROM dbo.SesionesTratamiento s WHERE s.id_sesion=f.id_sesion)`);
    await tx.$executeRawUnsafe(`DELETE f FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer f WHERE NOT EXISTS(SELECT 1 FROM dbo.TratamientosContratados t WHERE t.id_tratamiento=f.id_tratamiento)`);
    await tx.$executeRawUnsafe('EXEC NexoSalud_Mart_Test.dbo.usp_ETL_SincronizarCustomerMart');
  },{isolationLevel:'Serializable',timeout:60000});
}
