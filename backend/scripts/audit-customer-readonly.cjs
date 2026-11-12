/* Solo SELECT. No ejecuta ETL, migraciones, seeds ni pruebas de escritura. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const queries = {
  environment: `SELECT DB_NAME() AS databaseName, IS_SRVROLEMEMBER('sysadmin') AS isSysadmin`,
  objects: `SELECT name, type_desc FROM sys.objects WHERE name IN ('InteraccionesIA','AlertasIA','BorradoresIA','SesionesTratamiento','EventosSesion','PlanTratamiento','ValidacionesFicha','IndicacionesPostatencion','SolicitudesReprogramacionCustomer','usp_ProgramarSesionTratamiento','usp_ReprogramarSesionTratamiento','usp_CerrarSesionClinica') ORDER BY name`,
  iaTotals: `SELECT (SELECT COUNT(*) FROM dbo.InteraccionesIA) AS interactions, (SELECT COUNT(*) FROM dbo.AlertasIA) AS alerts, (SELECT COUNT(*) FROM dbo.BorradoresIA) AS draftVersions, (SELECT COUNT(DISTINCT COALESCE(id_borrador_raiz,id_borrador_ia)) FROM dbo.BorradoresIA) AS draftRoots`,
  clinicalTotals: `SELECT (SELECT COUNT(*) FROM dbo.TratamientosContratados) AS treatments, (SELECT COUNT(*) FROM dbo.PlanTratamiento WHERE es_vigente=1) AS currentPlans, (SELECT COUNT(*) FROM dbo.SesionesTratamiento) AS sessions, (SELECT COUNT(*) FROM dbo.SesionesTratamiento WHERE estado_asistencial='Realizada' AND estado_cierre='Cerrada') AS completedSessions`,
  clinicalMartTotals: `SELECT (SELECT SUM(tratamientos_iniciados) FROM NexoSalud_Mart.dbo.Fact_TratamientoCustomer) AS startedTreatments, (SELECT SUM(tratamientos_completados) FROM NexoSalud_Mart.dbo.Fact_TratamientoCustomer) AS completedTreatments, (SELECT SUM(sesiones_planificadas) FROM NexoSalud_Mart.dbo.Fact_TratamientoCustomer) AS plannedSessions, (SELECT SUM(sesiones_completadas) FROM NexoSalud_Mart.dbo.Fact_TratamientoCustomer) AS completedSessions, (SELECT SUM(sesiones_programadas) FROM NexoSalud_Mart.dbo.Fact_SesionCustomer) AS scheduledSessions, (SELECT SUM(sesiones_realizadas) FROM NexoSalud_Mart.dbo.Fact_SesionCustomer) AS performedSessions, (SELECT SUM(sesiones_inasistidas) FROM NexoSalud_Mart.dbo.Fact_SesionCustomer) AS noShowSessions, (SELECT SUM(reprogramaciones_acumuladas) FROM NexoSalud_Mart.dbo.Fact_SesionCustomer) AS reschedules, (SELECT SUM(atenciones_realizadas) FROM NexoSalud_Mart.dbo.Fact_AtencionCustomer_V2) AS performedAttentions, (SELECT SUM(fichas_completas) FROM NexoSalud_Mart.dbo.Fact_AtencionCustomer_V2) AS completeFiles, (SELECT SUM(indicaciones_emitidas) FROM NexoSalud_Mart.dbo.Fact_AtencionCustomer_V2) AS issuedInstructions`,
  stateCounts: `SELECT estado_programacion, estado_asistencial, estado_cierre, COUNT(*) AS quantity FROM dbo.SesionesTratamiento GROUP BY estado_programacion, estado_asistencial, estado_cierre`,
  uniqueIndexes: `SELECT OBJECT_NAME(i.object_id) AS tableName,i.name FROM sys.indexes i WHERE i.is_unique=1 AND OBJECT_NAME(i.object_id) IN ('AlertasIA','BorradoresIA','SolicitudesReprogramacionCustomer')`,
  alertTypes: `SELECT tipo_evento AS code, estado AS status, COUNT(*) AS quantity FROM dbo.AlertasIA GROUP BY tipo_evento, estado`,
  martTotals: `SELECT (SELECT SUM(interacciones_registradas) FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer) AS interactions, (SELECT SUM(alertas_generadas) FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer) AS alerts, (SELECT SUM(alertas_atendidas) FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer) AS attendedAlerts, (SELECT SUM(borradores_generados) FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer) AS generatedDrafts, (SELECT SUM(borradores_aprobados) FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer) AS approvedDrafts`,
  martTypeCoverage: `SELECT COUNT(*) AS unknownTypeFacts FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0`,
  martGrainDuplicates: `SELECT COUNT(*) AS duplicateGroups FROM (SELECT ClaseEventoIA,id_origen_ia FROM NexoSalud_Mart.dbo.Fact_InteraccionIACustomer GROUP BY ClaseEventoIA,id_origen_ia HAVING COUNT(*)>1) x`,
  deployedEtl: `SELECT CASE WHEN definition LIKE '%b.id_borrador_raiz IS NULL%' THEN 1 ELSE 0 END AS countsDraftRoots, CASE WHEN definition LIKE '%Resuelta%' THEN 1 ELSE 0 END AS handlesResolvedAlerts FROM NexoSalud_Mart.sys.sql_modules WHERE object_id=OBJECT_ID('NexoSalud_Mart.dbo.usp_ETL_SincronizarCustomerMart')`,
};
(async () => {
  const report = { mode: 'READ_ONLY_SELECT', timestamp: new Date().toISOString(), results: {} };
  try {
    for (const [key, sql] of Object.entries(queries)) {
      try { report.results[key] = await db.$queryRawUnsafe(sql); }
      catch (error) { report.results[key] = { unavailable: true, code: error.code || 'READ_FAILED' }; }
    }
    process.stdout.write(JSON.stringify(report, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
  } finally { await db.$disconnect(); }
})();
