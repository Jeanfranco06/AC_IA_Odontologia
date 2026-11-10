:ON ERROR EXIT
-- Solo lectura. Ejecutar con -d NexoSaludDB.
IF @@SERVERNAME<>N'ANTHONY' OR DB_NAME()<>N'NexoSaludDB'
 THROW 54940,'Servidor u OLTP inesperados.',1;
SET NOCOUNT ON;
DECLARE @corte datetime2(7)=SYSUTCDATETIME();
SELECT @@SERVERNAME Servidor,SERVERPROPERTY('ProductVersion') Version,SYSDATETIMEOFFSET() Hora,@corte UTC,
 DATEPART(TZOFFSET,SYSDATETIME() AT TIME ZONE 'SA Pacific Standard Time') OffsetLima;
SELECT name,state_desc,user_access_desc,is_read_only,recovery_model_desc,collation_name FROM sys.databases
WHERE name IN('NexoSaludDB','NexoSalud_Mart','NexoSaludDB_LeadFactsQA','NexoSalud_Mart_LeadFactsQA','NexoSalud_Mart_LeadFactsRef');
SELECT servicename,status_desc FROM sys.dm_server_services;
SELECT s.session_id,s.program_name,s.status,DB_NAME(s.database_id) Base,s.open_transaction_count FROM sys.dm_exec_sessions s WHERE s.is_user_process=1 AND s.session_id<>@@SPID;
SELECT COUNT(*) AS BloqueosUsuario FROM sys.dm_tran_locks l JOIN sys.dm_exec_sessions s ON s.session_id=l.request_session_id
 WHERE s.is_user_process=1 AND s.session_id<>@@SPID AND l.resource_database_id IN(DB_ID('NexoSaludDB'),DB_ID('NexoSalud_Mart'));
SELECT COUNT(*) AS TrabajosActivos FROM msdb.dbo.sysjobactivity WHERE session_id=(SELECT MAX(session_id) FROM msdb.dbo.syssessions)
 AND start_execution_date IS NOT NULL AND stop_execution_date IS NULL;
SELECT name FROM NexoSalud_Mart.sys.procedures WHERE name LIKE '%ETL%' OR name LIKE '%Carga%' OR name LIKE '%Pobla%';
SELECT COUNT(*) Nuevos FROM NexoSalud_Mart.sys.tables WHERE name IN('fact_oportunidades_lead','fact_propuestas_aceptadas_lead','fact_propuestas_rechazadas_lead','fact_alternativas_aceptadas_lead','fact_alternativas_rechazadas_lead');
SELECT COUNT(*) FKs,SUM(CONVERT(int,is_disabled)) Deshabilitadas,SUM(CONVERT(int,is_not_trusted)) NoConfiables FROM NexoSalud_Mart.sys.foreign_keys;
SELECT t.name,c.name PK,ic.key_ordinal FROM NexoSalud_Mart.sys.tables t JOIN NexoSalud_Mart.sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1
 JOIN NexoSalud_Mart.sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=i.index_id
 JOIN NexoSalud_Mart.sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
 WHERE t.name IN('Dim_Tiempo','Dim_Servicio','Dim_Canal','Dim_Sede','Dim_Negociador','Dim_Profesional','Dim_Promocion','Dim_MotivoRechazo','Dim_Horario') ORDER BY t.name,ic.key_ordinal;
SELECT o.name,p.name Parametro,ty.name Tipo,p.scale,
 CASE WHEN CONVERT(varbinary(max),m.definition)=CONVERT(varbinary(max),qm.definition) THEN 1 ELSE 0 END CoincideQA
 FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id
 JOIN sys.parameters p ON p.object_id=o.object_id AND p.parameter_id>0 JOIN sys.types ty ON ty.user_type_id=p.user_type_id
 LEFT JOIN NexoSaludDB_LeadPreQA.sys.objects qo ON qo.name=o.name AND qo.type=o.type
 LEFT JOIN NexoSaludDB_LeadPreQA.sys.sql_modules qm ON qm.object_id=qo.object_id
 WHERE o.type='IF' AND o.name IN('fn_Lead_Oportunidades_Corte','fn_Lead_Propuestas_Corte','fn_Lead_Alternativas_Corte');
SELECT OBJECT_NAME(referencing_id) Funcion,referenced_entity_name Dependencia,
 CASE WHEN referenced_id IS NULL THEN 0 ELSE 1 END Resuelta
FROM sys.sql_expression_dependencies WHERE referencing_id IN(OBJECT_ID('dbo.fn_Lead_Oportunidades_Corte'),OBJECT_ID('dbo.fn_Lead_Propuestas_Corte'),OBJECT_ID('dbo.fn_Lead_Alternativas_Corte'));
SELECT APPLOCK_TEST('public','ETL_BUYER_SEMANA9','Exclusive','Session') RecursoBuyerLibre;
SELECT 'Solicitudes' Origen,COUNT_BIG(*) Filas,COUNT_BIG(CASE WHEN resultado_comercial_lead IN('ACEPTADA','CERRADA_SIN_ACUERDO') THEN 1 END) Resultados FROM dbo.Solicitudes
UNION ALL SELECT 'Propuestas',COUNT_BIG(*),COUNT_BIG(CASE WHEN estado IN('Aceptada','Rechazada') THEN 1 END) FROM dbo.PropuestasEconomicasLead
UNION ALL SELECT 'Opciones',COUNT_BIG(*),COUNT_BIG(CASE WHEN estado_respuesta IN('Aceptada','Rechazada') THEN 1 END) FROM dbo.Opciones
UNION ALL SELECT 'Oportunidad al corte',COUNT_BIG(*),COUNT_BIG(CASE WHEN resultado_comercial_lead IN('ACEPTADA','CERRADA_SIN_ACUERDO') THEN 1 END) FROM dbo.fn_Lead_Oportunidades_Corte(@corte)
UNION ALL SELECT 'Raiz al corte',COUNT_BIG(*),COUNT_BIG(CASE WHEN estado IN('Aceptada','Rechazada') THEN 1 END) FROM dbo.fn_Lead_Propuestas_Corte(@corte)
UNION ALL SELECT 'Opcion al corte',COUNT_BIG(*),COUNT_BIG(CASE WHEN estado_respuesta IN('Aceptada','Rechazada') THEN 1 END) FROM dbo.fn_Lead_Alternativas_Corte(@corte);
IF (SELECT COUNT(*) FROM sys.databases WHERE name IN('NexoSaludDB','NexoSalud_Mart')
 AND state_desc='ONLINE' AND user_access_desc='MULTI_USER' AND is_read_only=0
 AND recovery_model_desc='FULL' AND collation_name='Modern_Spanish_CI_AS')<>2
 OR DATEPART(TZOFFSET,SYSDATETIMEOFFSET())<>-300
 THROW 54941,'Estado de las bases o desplazamiento UTC distinto al ensayo.',1;
IF EXISTS (SELECT 1 FROM sys.dm_exec_sessions s WHERE s.is_user_process=1 AND s.session_id<>@@SPID
 AND (s.program_name<>N'SQLServerCEIP' OR s.database_id<>DB_ID('master') OR s.open_transaction_count<>0))
 OR EXISTS (SELECT 1 FROM sys.dm_server_services WHERE servicename LIKE 'SQL Server Agent%' AND status_desc='Running')
 OR APPLOCK_TEST('public','ETL_BUYER_SEMANA9','Exclusive','Session')<>1
 THROW 54942,'Hay una sesión o un proceso concurrente que requiere revisión.',1;
IF EXISTS(SELECT 1 FROM dbo.Solicitudes WHERE resultado_comercial_lead IN('ACEPTADA','CERRADA_SIN_ACUERDO'))
 OR EXISTS(SELECT 1 FROM dbo.PropuestasEconomicasLead WHERE estado IN('Aceptada','Rechazada'))
 OR EXISTS(SELECT 1 FROM dbo.Opciones WHERE estado_respuesta IN('Aceptada','Rechazada'))
 THROW 54943,'Hay resultados nuevos. Reconciliar su evidencia y repetir el ensayo actualizado.',1;
IF EXISTS (SELECT 1 FROM NexoSalud_Mart.sys.tables WHERE name IN('fact_oportunidades_lead',
 'fact_propuestas_aceptadas_lead','fact_propuestas_rechazadas_lead','fact_alternativas_aceptadas_lead','fact_alternativas_rechazadas_lead'))
 THROW 54944,'El Mart ya contiene hechos nuevos. Revisar el estado antes de instalar.',1;

IF EXISTS (
 SELECT d.Tabla,d.Clave FROM (VALUES ('Dim_Tiempo','KeyTiempo'),('Dim_Servicio','KeyServicio'),
  ('Dim_Canal','KeyCanal'),('Dim_Sede','KeySede'),('Dim_Negociador','KeyNegociador'),
  ('Dim_Profesional','KeyProfesional'),('Dim_Promocion','KeyPromocion'),
  ('Dim_MotivoRechazo','KeyMotivoRechazo'),('Dim_Horario','KeyHorario')) d(Tabla,Clave)
 EXCEPT
 SELECT t.name,MIN(c.name) FROM NexoSalud_Mart.sys.tables t
 JOIN NexoSalud_Mart.sys.schemas s ON s.schema_id=t.schema_id AND s.name='dbo'
 JOIN NexoSalud_Mart.sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1 AND i.is_disabled=0
 JOIN NexoSalud_Mart.sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0
 JOIN NexoSalud_Mart.sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
 GROUP BY t.name HAVING COUNT(*)=1)
 OR (SELECT COUNT(*) FROM NexoSalud_Mart.sys.foreign_keys WHERE is_disabled=0 AND is_not_trusted=0)<>31
 OR EXISTS (SELECT 1 FROM NexoSalud_Mart.sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 THROW 54945,'Cambió el contrato de claves del Mart.',1;

IF (SELECT COUNT(*) FROM sys.objects o
 JOIN sys.sql_modules m ON m.object_id=o.object_id
 JOIN sys.parameters p ON p.object_id=o.object_id AND p.parameter_id>0
 JOIN NexoSaludDB_LeadFactsQA.sys.objects qo ON qo.name=o.name AND qo.type=o.type
 JOIN NexoSaludDB_LeadFactsQA.sys.sql_modules qm ON qm.object_id=qo.object_id
 WHERE o.type='IF' AND o.name IN('fn_Lead_Oportunidades_Corte','fn_Lead_Propuestas_Corte','fn_Lead_Alternativas_Corte')
 AND p.name='@corte_utc' AND TYPE_NAME(p.user_type_id)='datetime2' AND p.scale=7
 AND CONVERT(varbinary(max),m.definition)=CONVERT(varbinary(max),qm.definition))<>3
 OR EXISTS(SELECT 1 FROM sys.sql_expression_dependencies WHERE referenced_id IS NULL
  AND referencing_id IN(OBJECT_ID('dbo.fn_Lead_Oportunidades_Corte'),OBJECT_ID('dbo.fn_Lead_Propuestas_Corte'),OBJECT_ID('dbo.fn_Lead_Alternativas_Corte')))
 THROW 54946,'Cambió una función de corte o falta una dependencia.',1;

IF EXISTS(SELECT 1 FROM dbo.fn_Lead_Oportunidades_Corte(@corte) WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo<>0)
 OR EXISTS(SELECT 1 FROM dbo.fn_Lead_Propuestas_Corte(@corte) WHERE propuesta_aceptada+propuesta_rechazada<>0)
 OR EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(@corte) WHERE alternativa_aceptada+alternativa_rechazada<>0)
 THROW 54947,'El corte contiene resultados nuevos. Repetir el ensayo.',1;
