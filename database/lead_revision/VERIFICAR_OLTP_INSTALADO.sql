:ON ERROR EXIT
SET NOCOUNT ON;
IF DB_NAME() <> N'$(BaseEsperada)' OR DB_NAME() NOT IN (N'NexoSaludDB',N'NexoSalud_LeadEnsayoFinal')
 THROW 54620,'Destino OLTP inesperado para la verificación.',1;
IF @@TRANCOUNT <> 0
 THROW 54621,'Ejecutar la comprobación en una sesión nueva.',1;

DECLARE @esperadas table (vista sysname, medida sysname);
INSERT @esperadas VALUES
 ('v_OrigenMedidasOportunidadLead','oportunidad_aceptada'),
 ('v_OrigenMedidasOportunidadLead','oportunidad_cerrada_sin_acuerdo'),
 ('v_OrigenMedidasPropuestaLead','propuesta_aceptada'),
 ('v_OrigenMedidasPropuestaLead','propuesta_rechazada'),
 ('v_OrigenMedidasPropuestaLead','propuesta_rechazada_economica'),
 ('v_OrigenMedidasAlternativaLead','alternativa_aceptada'),
 ('v_OrigenMedidasAlternativaLead','alternativa_rechazada'),
 ('v_OrigenMedidasAlternativaLead','alternativa_rechazada_incompatibilidad');
IF EXISTS (
 SELECT vista,medida FROM @esperadas
 EXCEPT
 SELECT v.name,c.name FROM sys.views v JOIN sys.columns c ON c.object_id=v.object_id
 WHERE v.schema_id=SCHEMA_ID('dbo') AND TYPE_NAME(c.user_type_id)='int')
 THROW 54622,'Faltan medidas aprobadas o tienen un tipo inesperado.',1;

DECLARE @corte datetime2(7)=SYSUTCDATETIME();
SELECT * INTO #Oportunidad FROM dbo.fn_Lead_Oportunidades_Corte(@corte);
SELECT * INTO #Propuesta FROM dbo.fn_Lead_Propuestas_Corte(@corte);
SELECT * INTO #Alternativa FROM dbo.fn_Lead_Alternativas_Corte(@corte);

IF EXISTS(SELECT id_solicitud FROM #Oportunidad GROUP BY id_solicitud HAVING COUNT_BIG(*)>1)
 OR EXISTS(SELECT id_propuesta_logica FROM #Propuesta GROUP BY id_propuesta_logica HAVING COUNT_BIG(*)>1)
 OR EXISTS(SELECT id_opcion FROM #Alternativa GROUP BY id_opcion HAVING COUNT_BIG(*)>1)
 THROW 54623,'El grano de los indicadores contiene duplicados.',1;
IF EXISTS(SELECT 1 FROM #Oportunidad WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo>1)
 OR EXISTS(SELECT 1 FROM #Propuesta WHERE propuesta_aceptada+propuesta_rechazada>1 OR propuesta_rechazada_economica>propuesta_rechazada)
 OR EXISTS(SELECT 1 FROM #Alternativa WHERE alternativa_aceptada+alternativa_rechazada>1 OR alternativa_rechazada_incompatibilidad>alternativa_rechazada)
 THROW 54624,'Las medidas no respetan las relaciones entre resultados y motivos.',1;

WITH o AS (
 SELECT COALESCE(SUM(CONVERT(bigint,oportunidad_aceptada)),0) AS M1,
  COALESCE(SUM(CONVERT(bigint,oportunidad_cerrada_sin_acuerdo)),0) AS M2 FROM #Oportunidad
), p AS (
 SELECT COALESCE(SUM(CONVERT(bigint,propuesta_aceptada)),0) AS M3,
  COALESCE(SUM(CONVERT(bigint,propuesta_rechazada)),0) AS M4,
  COALESCE(SUM(CONVERT(bigint,propuesta_rechazada_economica)),0) AS M5 FROM #Propuesta
), a AS (
 SELECT COALESCE(SUM(CONVERT(bigint,alternativa_aceptada)),0) AS M6,
  COALESCE(SUM(CONVERT(bigint,alternativa_rechazada)),0) AS M7,
  COALESCE(SUM(CONVERT(bigint,alternativa_rechazada_incompatibilidad)),0) AS M8 FROM #Alternativa
)
SELECT @corte AS CorteUTC,M1,M2,M3,M4,M5,M6,M7,M8,
 CAST(100.0*M1/NULLIF(M1+M2,0) AS decimal(8,2)) AS L1,
 CAST(100.0*M5/NULLIF(M3+M4,0) AS decimal(8,2)) AS L2,
 CAST(100.0*M8/NULLIF(M6+M7,0) AS decimal(8,2)) AS L3
FROM o CROSS JOIN p CROSS JOIN a;

SELECT 'BUYER_LEAD' AS Flujo,COUNT_BIG(*) AS ConversionesDocumentadas
FROM dbo.EventosEtapa e JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion
JOIN dbo.Solicitudes s ON s.id_solicitud=e.id_solicitud AND s.id_persona=c.id_persona
JOIN dbo.Etapas b ON b.id_etapa=e.etapa_origen AND b.nombre='BUYER'
JOIN dbo.Etapas l ON l.id_etapa=e.etapa_destino AND l.nombre='LEAD';

SELECT OBJECT_NAME(parent_object_id) AS Tabla,name AS Restriccion,is_disabled,is_not_trusted
FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1
UNION ALL
SELECT OBJECT_NAME(parent_object_id),name,is_disabled,is_not_trusted
FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1;
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;
GO
