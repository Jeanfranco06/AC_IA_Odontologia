import {Prisma} from '@prisma/client';
import {readCustomerMart} from '../../../../db/customerMartRead';
import {expectedDatabases} from '../../../../databaseProfiles';
import {AiAgentError,AiAgentPrincipal} from '../types';
import {auditCustomer} from './customerCompletionService';

export const analyticsDefinitions={
 treatments:{code:'IA15',table:'Fact_TratamientoCustomer',date:'KeyTiempoContratacion',roles:['ADMIN','ODONTOLOGO','RECEPCION'],metrics:['tratamientos_iniciados','tratamientos_completados','sesiones_planificadas','sesiones_completadas','dias_duracion_real'],denominator:'tratamientos_completados',duration:'dias_duracion_real',meaning:'Cohorte por fecha de contratación; cumplimiento administrativo, sin interpretar evolución clínica.'},
 sessions:{code:'IA16',table:'Fact_SesionCustomer',date:'KeyTiempoProgramada',roles:['ADMIN','ODONTOLOGO','RECEPCION'],metrics:['sesiones_programadas','sesiones_realizadas','sesiones_inasistidas','reprogramaciones_acumuladas','minutos_espera'],denominator:'tiene_espera_medible',duration:'minutos_espera',meaning:'Cohorte por fecha programada vigente. Reprogramaciones acumuladas de esas sesiones, no eventos ocurridos necesariamente en ese período.'},
 documentation:{code:'IA17',table:'Fact_AtencionCustomer_V2',date:'KeyTiempoAtencion',roles:['ADMIN','ODONTOLOGO'],metrics:['atenciones_realizadas','minutos_consulta','fichas_completas','indicaciones_emitidas','procedimientos_registrados'],denominator:'tiene_duracion_medible',duration:'minutos_consulta',meaning:'Atenciones por fecha de atención. Ficha completa conserva la primera validación; no equivale a última validación vigente de cierre.'},
 ai:{code:'IA18',table:'Fact_InteraccionIACustomer',date:'KeyTiempoEvento',roles:['ADMIN','ODONTOLOGO'],metrics:['interacciones_registradas','alertas_generadas','alertas_atendidas','borradores_generados','borradores_aprobados'],denominator:null,duration:null,meaning:'Grano clase de evento e identidad de origen; interacciones incluye auditorías. Generaciones por raíz y aprobaciones por versión vigente; el período es la fecha del evento/documento, no la fecha de aprobación.'}
} as const;
export type AnalyticsKind=keyof typeof analyticsDefinitions;
export type AnalyticsFilter={startDate:string;endDate:string;groupBy?:'none'|'month'|'branch'|'service';branchId?:number;serviceId?:number};
function authorized(p:AiAgentPrincipal,kind?:AnalyticsKind){
 if(p.role==='PACIENTE'||!p.idUsuario||(p.role==='ODONTOLOGO'&&!p.idProfesional)||!['ADMIN','RECEPCION','ODONTOLOGO'].includes(p.role))throw new AiAgentError('FORBIDDEN','El perfil no está autorizado para análisis del Mart.');
 if(kind&&!(analyticsDefinitions[kind].roles as readonly string[]).includes(p.role))throw new AiAgentError('FORBIDDEN','Este análisis excede las responsabilidades del perfil.');
}
export function parseAnalyticsFilter(raw:unknown):AnalyticsFilter {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AiAgentError('INVALID_INPUT','Filtros analíticos inválidos.');
 const a=raw as Record<string,unknown>;if(Object.keys(a).some(k=>!['startDate','endDate','groupBy','branchId','serviceId'].includes(k)))throw new AiAgentError('INVALID_INPUT','Parámetro analítico no permitido.');
 for(const k of ['startDate','endDate'])if(typeof a[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a[k] as string)||!Number.isFinite(Date.parse(a[k]+'T00:00:00Z'))||new Date(a[k]+'T00:00:00Z').toISOString().slice(0,10)!==a[k])throw new AiAgentError('INVALID_INPUT','Use fechas válidas YYYY-MM-DD.');
 const days=(Date.parse(a.endDate as string)-Date.parse(a.startDate as string))/86400000;if(days<0||days>365)throw new AiAgentError('INVALID_INPUT','El período debe tener entre uno y 366 días inclusivos.');
 if(a.groupBy!==undefined&&!['none','month','branch','service'].includes(String(a.groupBy)))throw new AiAgentError('INVALID_INPUT','Agrupación no soportada.');
 for(const k of ['branchId','serviceId'])if(a[k]!==undefined&&(!Number.isSafeInteger(a[k])||Number(a[k])<1))throw new AiAgentError('INVALID_INPUT','Identificador dimensional inválido.');
 return {...a,groupBy:a.groupBy||'none'} as AnalyticsFilter;
}
const scope=(p:AiAgentPrincipal)=>p.role==='ODONTOLOGO'?Prisma.sql`AND f.KeyProfesional IN(SELECT KeyProfesional FROM dbo.Dim_Profesional WHERE id_profesional=${p.idProfesional!})`:Prisma.empty;
export class CustomerAnalyticsService {
 static async catalog(p:AiAgentPrincipal){
  authorized(p);const allowed=(Object.keys(analyticsDefinitions) as AnalyticsKind[]).filter(k=>(analyticsDefinitions[k].roles as readonly string[]).includes(p.role));
  const union=Prisma.join(allowed.map(k=>Prisma.sql`SELECT f.KeySede,f.KeyServicio FROM ${Prisma.raw('dbo.'+analyticsDefinitions[k].table)} f WHERE 1=1 ${scope(p)}`),' UNION ');
  const rows=await readCustomerMart<any>(Prisma.sql`WITH permitted AS(${union}) SELECT TOP(400) 'branch' kind,ds.id_sede id,ds.Sede label FROM dbo.Dim_Sede ds WHERE ds.KeySede>0 AND EXISTS(SELECT 1 FROM permitted f WHERE f.KeySede=ds.KeySede) UNION ALL SELECT TOP(400) 'service',s.id_servicio,s.ServicioOdontologico FROM dbo.Dim_Servicio s WHERE s.KeyServicio>0 AND EXISTS(SELECT 1 FROM permitted f WHERE f.KeyServicio=s.KeyServicio)`);
  const today=new Date().toISOString().slice(0,10);
  return {source:expectedDatabases().mart,defaultPeriod:{startDate:today.slice(0,4)+'-01-01',endDate:today},allowed:allowed.map(k=>({kind:k,...analyticsDefinitions[k]})),branches:rows.filter(r=>r.kind==='branch').map(({id,label})=>({id,label})),services:rows.filter(r=>r.kind==='service').map(({id,label})=>({id,label})),groupings:['none','month','branch','service'],maxPeriodDays:366,maxGroups:100,scope:p.role==='ODONTOLOGO'?'PROFESIONAL_PROPIO':'OPERACIONAL_AGREGADO',dimensionCatalogLimit:400};
 }
 static async query(p:AiAgentPrincipal,kind:AnalyticsKind,raw:unknown,options:{audit?:boolean}={}){
  if(!Object.hasOwn(analyticsDefinitions,kind))throw new AiAgentError('INVALID_INPUT','Actividad analítica desconocida.');authorized(p,kind);const filter=parseAnalyticsFilter(raw);const d=analyticsDefinitions[kind];
  const start=new Date(filter.startDate+'T00:00:00Z'),end=new Date(filter.endDate+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
  const grouping={none:"CAST(NULL AS nvarchar(200))",month:"CONVERT(varchar(7),dt.id_fecha,126)",branch:"COALESCE(ds.Sede,N'Desconocida')",service:"COALESCE(s.ServicioOdontologico,N'Desconocido')"}[filter.groupBy!];
  const metrics=Prisma.join(d.metrics.map(name=>Prisma.raw(`COALESCE(SUM(CAST(${name} AS bigint)),0) AS ${name}`)));
  const rate=kind==='treatments'?Prisma.raw('100.0*SUM(CAST(sesiones_completadas AS float))/NULLIF(SUM(CAST(sesiones_planificadas AS float)),0)'):kind==='sessions'?Prisma.raw('100.0*SUM(CAST(sesiones_realizadas AS float))/NULLIF(SUM(CAST(sesion_evaluable AS float)),0)'):kind==='documentation'?Prisma.raw('100.0*SUM(CAST(fichas_completas AS float))/NULLIF(SUM(CAST(atenciones_realizadas AS float)),0)'):Prisma.raw('CAST(NULL AS float)');
  const avg=d.duration?Prisma.raw(`SUM(CAST(${d.duration} AS float))/NULLIF(SUM(CAST(${d.denominator} AS float)),0)`):Prisma.raw('CAST(NULL AS float)');
  const grouped=filter.groupBy==='none'?Prisma.empty:Prisma.sql`UNION ALL SELECT 'GROUP',label,${metrics},${rate},${avg} FROM filtered GROUP BY label`;
  const rows=await readCustomerMart<any>(Prisma.sql`
   WITH filtered AS(SELECT f.*,${Prisma.raw(grouping)} label FROM ${Prisma.raw('dbo.'+d.table)} f JOIN dbo.Dim_Tiempo dt ON dt.KeyTiempo=f.${Prisma.raw(d.date)} LEFT JOIN dbo.Dim_Sede ds ON ds.KeySede=f.KeySede LEFT JOIN dbo.Dim_Servicio s ON s.KeyServicio=f.KeyServicio
    WHERE dt.id_fecha>=${start} AND dt.id_fecha<${end} ${scope(p)} ${filter.branchId?Prisma.sql`AND ds.id_sede=${filter.branchId}`:Prisma.empty} ${filter.serviceId?Prisma.sql`AND s.id_servicio=${filter.serviceId}`:Prisma.empty}),
   aggregated AS(SELECT 'TOTAL' rowKind,CAST(NULL AS nvarchar(200)) label,${metrics},${rate} ratePercent,${avg} averageDuration FROM filtered ${grouped})
   SELECT TOP(101) a.*,(SELECT CONVERT(varchar(33),MAX(fecha_fin),126) FROM dbo.ETL_EjecucionLog WHERE proceso='usp_ETL_SincronizarCustomerMart' AND estado='EXITOSO') lastSuccessfulSync,
    (SELECT TOP(1) estado FROM dbo.ETL_EjecucionLog WHERE proceso='usp_ETL_SincronizarCustomerMart' ORDER BY id_ejecucion DESC) latestLoadStatus
    FROM aggregated a ORDER BY CASE WHEN rowKind='TOTAL' THEN 0 ELSE 1 END,label`);
  const normalize=(row:any)=>({...Object.fromEntries(d.metrics.map(m=>[m,Number(row[m]??0)])),ratePercent:row.ratePercent===null?null:Number(row.ratePercent),averageDuration:row.averageDuration===null?null:Number(row.averageDuration)});
  const total=rows.find(r=>r.rowKind==='TOTAL');
  if(options.audit!==false)await auditCustomer(p,'CONSULTA_'+d.code,{},'Consulta agregada del Mart; sin identificadores de pacientes');
  return {activity:d.code,source:expectedDatabases().mart,fact:d.table,filter,scope:p.role==='ODONTOLOGO'?'PROFESIONAL_PROPIO':'AGREGADO_AUTORIZADO',totals:normalize(total||{}),groups:rows.filter(r=>r.rowKind==='GROUP').map(r=>({label:r.label,...normalize(r)})),groupLimit:100,possiblyTruncated:rows.length===101,
   freshness:{lastSuccessfulSync:total?.lastSuccessfulSync??null,latestLoadStatus:total?.latestLoadStatus??null,timeStandard:'SQL_SERVER_LOG_LEGACY_NO_OFFSET',state:total?.lastSuccessfulSync?'HISTORICAL_NON_REALTIME':'NO_SUCCESSFUL_LOAD',warning:'El Mart no es información en tiempo real. La fecha de carga histórica no incluye zona; no equivale a la fecha del evento.'},
   definition:d.meaning,calculation:'SQL_SERVER_FIXED_PARAMETERIZED_QUERY',readOnly:true};
 }
}
