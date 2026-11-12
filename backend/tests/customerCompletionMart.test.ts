import {beforeAll,describe,expect,it} from 'vitest';
import fs from 'fs';
import path from 'path';
import {prisma} from '../src/db';
import {syncCertificationMart} from './helpers/syncCertificationMart';

describe.skipIf(process.env.AI_AGENT_SQLSERVER_INTEGRATION!=='true')('Conciliación real CUSTOMER al mismo corte transaccional',()=>{
 beforeAll(()=>syncCertificationMart(),60000);
 it('Concilia medidas, claves naturales y reejecución idempotente',async()=>{
  const report=await prisma.$transaction(async tx=>{
   const sourceFinancial=()=>tx.$queryRawUnsafe('SELECT (SELECT COUNT(*) FROM dbo.Reservas) reservations,(SELECT SUM(precio_pactado) FROM dbo.TratamientosContratados) agreedPrice,(SELECT SUM(importe) FROM dbo.Pagos) payments,(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.Pagos) paymentStateChecksum');
   const financialBefore=await sourceFinancial();
   const queries:Array<[string,string,string]>=[
    ['tratamientos_iniciados',"SELECT COUNT(*) n FROM dbo.TratamientosContratados WHERE fecha_inicio_real IS NOT NULL OR estado_tratamiento IN(N'En ejecución','Completado')",'SELECT SUM(tratamientos_iniciados) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer'],
    ['tratamientos_completados',"SELECT COUNT(*) n FROM dbo.TratamientosContratados WHERE estado_tratamiento='Completado' AND fecha_inicio_real IS NOT NULL AND fecha_cierre_real>=fecha_inicio_real",'SELECT SUM(tratamientos_completados) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer'],
    ['sesiones_planificadas','SELECT SUM(sesiones_planificadas) n FROM (SELECT sesiones_planificadas,ROW_NUMBER() OVER(PARTITION BY id_tratamiento ORDER BY version_plan DESC) rn FROM dbo.PlanTratamiento WHERE es_vigente=1)x WHERE rn=1','SELECT SUM(sesiones_planificadas) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer'],
    ['sesiones_completadas',"SELECT COUNT(*) n FROM dbo.SesionesTratamiento WHERE estado_asistencial='Realizada' AND estado_cierre='Cerrada'",'SELECT SUM(sesiones_completadas) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer'],
    ['dias_duracion_real',"SELECT SUM(DATEDIFF(DAY,fecha_inicio_real,fecha_cierre_real)) n FROM dbo.TratamientosContratados WHERE estado_tratamiento='Completado' AND fecha_inicio_real IS NOT NULL AND fecha_cierre_real>=fecha_inicio_real",'SELECT SUM(dias_duracion_real) n FROM NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer'],
    ['sesiones_programadas',"SELECT COUNT(*) n FROM dbo.SesionesTratamiento WHERE estado_programacion IN('Programada','Reprogramada')",'SELECT SUM(sesiones_programadas) n FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer'],
    ['sesiones_realizadas',"SELECT COUNT(*) n FROM dbo.SesionesTratamiento WHERE estado_asistencial='Realizada'",'SELECT SUM(sesiones_realizadas) n FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer'],
    ['sesiones_inasistidas',"SELECT COUNT(*) n FROM dbo.SesionesTratamiento WHERE estado_asistencial='Inasistida'",'SELECT SUM(sesiones_inasistidas) n FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer'],
    ['reprogramaciones_acumuladas',"SELECT COUNT(*) n FROM dbo.EventosSesion WHERE tipo_cambio='REPROGRAMACION'",'SELECT SUM(reprogramaciones_acumuladas) n FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer'],
    ['minutos_espera','SELECT SUM(DATEDIFF(MINUTE,fecha_llegada,fecha_inicio_atencion)) n FROM dbo.SesionesTratamiento WHERE fecha_llegada IS NOT NULL AND fecha_inicio_atencion>=fecha_llegada','SELECT SUM(minutos_espera) n FROM NexoSalud_Mart_Test.dbo.Fact_SesionCustomer'],
    ['atenciones_realizadas',"SELECT COUNT(*) n FROM dbo.Atenciones WHERE asistencia IN(N'Asistió','Asiste') AND estado_servicio IN('Realizado','Finalizado')",'SELECT SUM(atenciones_realizadas) n FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2'],
    ['minutos_consulta',"SELECT SUM(DATEDIFF(MINUTE,fecha_inicio,fecha_fin)) n FROM dbo.Atenciones WHERE asistencia IN(N'Asistió','Asiste') AND estado_servicio IN('Realizado','Finalizado') AND fecha_inicio IS NOT NULL AND fecha_fin>fecha_inicio",'SELECT SUM(minutos_consulta) n FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2'],
    ['fichas_completas',"SELECT COUNT(*) n FROM dbo.Atenciones a JOIN dbo.ValidacionesFicha v ON v.id_atencion=a.id_atencion AND v.numero_revision=1 WHERE v.resultado_validacion='Completa' AND a.asistencia IN(N'Asistió','Asiste') AND a.estado_servicio IN('Realizado','Finalizado')",'SELECT SUM(fichas_completas) n FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2'],
    ['indicaciones_emitidas',"SELECT COUNT(*) n FROM dbo.IndicacionesPostatencion WHERE es_version_vigente=1 AND estado='Documento emitido'",'SELECT SUM(indicaciones_emitidas) n FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2'],
    ['procedimientos_registrados','SELECT COUNT(*) n FROM dbo.DetalleProcedimiento','SELECT SUM(procedimientos_registrados) n FROM NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2'],
    ['interacciones_registradas','SELECT COUNT(*) n FROM dbo.InteraccionesIA','SELECT SUM(interacciones_registradas) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer'],
    ['alertas_generadas','SELECT COUNT(*) n FROM dbo.AlertasIA','SELECT SUM(alertas_generadas) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer'],
    ['alertas_atendidas',"SELECT COUNT(*) n FROM dbo.AlertasIA WHERE estado IN('Atendida','Resuelta')",'SELECT SUM(alertas_atendidas) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer'],
    ['borradores_generados','SELECT COUNT(DISTINCT COALESCE(id_borrador_raiz,id_borrador_ia)) n FROM dbo.BorradoresIA','SELECT SUM(borradores_generados) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer'],
    ['borradores_aprobados',"SELECT COUNT(*) n FROM dbo.BorradoresIA WHERE es_version_actual=1 AND estado IN('Aprobado','Corregido_Y_Aprobado')",'SELECT SUM(borradores_aprobados) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer']
   ];
   const measures=[];
   for(const [name,source,mart]of queries){const a=await tx.$queryRawUnsafe<Array<{n:number|null}>>(source);const b=await tx.$queryRawUnsafe<Array<{n:number|null}>>(mart);measures.push({measure:name,oltp:Number(a[0].n??0),mart:Number(b[0].n??0),difference:Number(a[0].n??0)-Number(b[0].n??0)});}
   const [unknown]=await tx.$queryRawUnsafe<Array<{n:number}>>('SELECT COUNT(*) n FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0');
   const [duplicates]=await tx.$queryRawUnsafe<Array<{n:number}>>('SELECT COUNT(*) n FROM (SELECT ClaseEventoIA,id_origen_ia FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer GROUP BY ClaseEventoIA,id_origen_ia HAVING COUNT(*)>1)x');
   const entityQueries:Array<[string,string]>=[
    ['tratamiento',`SELECT COUNT(*) n FROM dbo.TratamientosContratados t FULL JOIN NexoSalud_Mart_Test.dbo.Fact_TratamientoCustomer f ON f.id_tratamiento=t.id_tratamiento OUTER APPLY(SELECT TOP(1) sesiones_planificadas n FROM dbo.PlanTratamiento WHERE id_tratamiento=t.id_tratamiento AND es_vigente=1 ORDER BY version_plan DESC)p OUTER APPLY(SELECT COUNT(*) n FROM dbo.SesionesTratamiento WHERE id_tratamiento=t.id_tratamiento AND estado_asistencial='Realizada' AND estado_cierre='Cerrada')s WHERE t.id_tratamiento IS NULL OR f.id_tratamiento IS NULL OR f.sesiones_planificadas<>ISNULL(p.n,0) OR f.sesiones_completadas<>s.n OR f.id_persona<>t.id_persona`],
    ['sesion_fecha_sede',`SELECT COUNT(*) n FROM dbo.SesionesTratamiento s FULL JOIN NexoSalud_Mart_Test.dbo.Fact_SesionCustomer f ON f.id_sesion=s.id_sesion LEFT JOIN NexoSalud_Mart_Test.dbo.Dim_Tiempo d ON d.KeyTiempo=f.KeyTiempoProgramada LEFT JOIN NexoSalud_Mart_Test.dbo.Dim_Sede sede ON sede.KeySede=f.KeySede WHERE s.id_sesion IS NULL OR f.id_sesion IS NULL OR f.sesiones_realizadas<>CASE WHEN s.estado_asistencial='Realizada' THEN 1 ELSE 0 END OR f.sesiones_inasistidas<>CASE WHEN s.estado_asistencial='Inasistida' THEN 1 ELSE 0 END OR ISNULL(CONVERT(varchar(10),d.id_fecha,23),'')<>CONVERT(varchar(10),s.fecha_programada_vigente,23) OR sede.id_sede<>s.id_sede`],
    ['atencion',`SELECT COUNT(*) n FROM dbo.Atenciones a FULL JOIN NexoSalud_Mart_Test.dbo.Fact_AtencionCustomer_V2 f ON f.id_atencion=a.id_atencion OUTER APPLY(SELECT COUNT(*) n FROM dbo.DetalleProcedimiento WHERE id_atencion=a.id_atencion)p OUTER APPLY(SELECT COUNT(*) n FROM dbo.IndicacionesPostatencion WHERE id_atencion=a.id_atencion AND es_version_vigente=1 AND estado='Documento emitido')i WHERE a.id_atencion IS NULL OR f.id_atencion IS NULL OR f.procedimientos_registrados<>p.n OR f.indicaciones_emitidas<>i.n`],
    ['evento_fecha_tipo',`WITH e AS(SELECT 'INTERACCION' c,id_interaccion_ia id,fecha_hora,tipo_evento FROM dbo.InteraccionesIA UNION ALL SELECT 'ALERTA',id_alerta_ia,fecha_hora,tipo_evento FROM dbo.AlertasIA UNION ALL SELECT 'BORRADOR',id_borrador_ia,fecha_hora,tipo_evento FROM dbo.BorradoresIA) SELECT COUNT(*) n FROM e FULL JOIN NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer f ON f.ClaseEventoIA=e.c AND f.id_origen_ia=e.id LEFT JOIN NexoSalud_Mart_Test.dbo.Dim_TipoInteraccionIA t ON t.KeyTipoInteraccionIA=f.KeyTipoInteraccionIA LEFT JOIN NexoSalud_Mart_Test.dbo.Dim_Tiempo d ON d.KeyTiempo=f.KeyTiempoEvento WHERE e.id IS NULL OR f.id_origen_ia IS NULL OR t.CodigoTipoInteraccionIA<>e.tipo_evento OR ISNULL(CONVERT(varchar(10),d.id_fecha,23),'')<>CONVERT(varchar(10),e.fecha_hora,23)`]
   ];
   const entityDifferences=[];for(const[grain,sql]of entityQueries){const [r]=await tx.$queryRawUnsafe<Array<{n:number}>>(sql);entityDifferences.push({grain,mismatchedRows:r.n});}
   const before=await tx.$queryRawUnsafe('SELECT COUNT(*) rows,SUM(interacciones_registradas) interactions,SUM(borradores_generados) drafts,SUM(alertas_atendidas) attended FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer');
   await tx.$executeRawUnsafe('EXEC NexoSalud_Mart_Test.dbo.usp_ETL_SincronizarCustomerMart');
   const after=await tx.$queryRawUnsafe('SELECT COUNT(*) rows,SUM(interacciones_registradas) interactions,SUM(borradores_generados) drafts,SUM(alertas_atendidas) attended FROM NexoSalud_Mart_Test.dbo.Fact_InteraccionIACustomer');
   const financial=await tx.$queryRawUnsafe('SELECT SUM(ReservasPreagendadas) reservations,SUM(ConversionesACustomer) customers FROM NexoSalud_Mart_Test.dbo.Fact_ConversionCobranzaPayer');
   const financialAfter=await sourceFinancial();
   return {timestamp:new Date().toISOString(),cut:'SERIALIZABLE_TRANSACTION',databases:['NexoSaludDB_Test','NexoSalud_Mart_Test'],measures,entityDifferences,unknownTypes:unknown.n,duplicateGroups:duplicates.n,before,after,financial,financialBefore,financialAfter};
  },{isolationLevel:'Serializable',timeout:60000});
  const directory=path.join(process.cwd(),'storage/certification');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'bi-reconciliation.json'),JSON.stringify(report,null,2));
  expect(report.measures.filter(m=>m.difference!==0)).toEqual([]);expect(report.unknownTypes).toBe(0);expect(report.duplicateGroups).toBe(0);expect(report.after).toEqual(report.before);expect(report.financialAfter).toEqual(report.financialBefore);
  expect(report.entityDifferences.filter(r=>r.mismatchedRows!==0)).toEqual([]);
 },60000);
});
