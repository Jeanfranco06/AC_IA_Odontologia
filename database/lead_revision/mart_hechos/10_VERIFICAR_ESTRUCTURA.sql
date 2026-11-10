:r .\database\lead_revision\mart_hechos\00_CONTEXTO_HECHOS.sql
DECLARE @Esperados TABLE(Hecho sysname, FKs int);
INSERT @Esperados VALUES('fact_oportunidades_lead',5),('fact_propuestas_aceptadas_lead',3),
 ('fact_propuestas_rechazadas_lead',4),('fact_alternativas_aceptadas_lead',6),('fact_alternativas_rechazadas_lead',7);
SELECT e.Hecho,e.FKs AS FKsEsperadas,
 (SELECT COUNT(*) FROM sys.key_constraints p WHERE p.parent_object_id=t.object_id AND p.type='PK') AS PK,
 (SELECT COUNT(*) FROM sys.foreign_keys f WHERE f.parent_object_id=t.object_id) AS FKs,
 (SELECT COUNT(*) FROM sys.foreign_keys f WHERE f.parent_object_id=t.object_id
  AND f.is_disabled=0 AND f.is_not_trusted=0) AS FKsConfiables,
 (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id=t.object_id AND p.index_id=1) AS Filas
INTO #HechosInstalados
FROM @Esperados e
LEFT JOIN sys.tables t ON t.name=e.Hecho AND t.schema_id=SCHEMA_ID('dbo');
SELECT * FROM #HechosInstalados ORDER BY Hecho;
IF EXISTS (SELECT 1 FROM #HechosInstalados WHERE PK<>1 OR FKs<>FKsEsperadas OR FKsConfiables<>FKsEsperadas)
 THROW 54936,'Faltan hechos, claves primarias o relaciones dimensionales confiables.',1;
