-- Conteos OLTP independientes del mapeo dimensional y de las banderas del ETL.
-- Las funciones OLTP existentes resuelven las identidades e historiales aprobados.
SELECT COUNT_BIG(CASE WHEN resultado_comercial_lead='ACEPTADA' THEN 1 END) M1,
       COUNT_BIG(CASE WHEN resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 END) M2
INTO #ControlO
FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN estado='Aceptada' THEN 1 END) M3,
       COUNT_BIG(CASE WHEN estado='Rechazada' THEN 1 END) M4,
       COUNT_BIG(CASE WHEN estado='Rechazada' AND categoria_motivo='ECONOMICO' THEN 1 END) M5
INTO #ControlP
FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte);

SELECT COUNT_BIG(CASE WHEN a.estado_respuesta='Aceptada' THEN 1 END) M6,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' THEN 1 END) M7,
       COUNT_BIG(CASE WHEN a.estado_respuesta='Rechazada' AND a.categoria_motivo='INCOMPATIBILIDAD' THEN 1 END) M8
INTO #ControlA
FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte) a
JOIN [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte) s ON s.id_solicitud=a.id_solicitud;

SELECT o.M1,o.M2,p.M3,p.M4,p.M5,a.M6,a.M7,a.M8 INTO #ControlOLTP
FROM #ControlO o CROSS JOIN #ControlP p CROSS JOIN #ControlA a;

-- Sumas Mart. Un hecho sin grupos produce cero.
SELECT
 (SELECT ISNULL(SUM(oportunidad_aceptada),0) FROM dbo.fact_oportunidades_lead) M1,
 (SELECT ISNULL(SUM(oportunidad_cerrada_sin_acuerdo),0) FROM dbo.fact_oportunidades_lead) M2,
 (SELECT ISNULL(SUM(propuesta_aceptada),0) FROM dbo.fact_propuestas_aceptadas_lead) M3,
 (SELECT ISNULL(SUM(propuesta_rechazada),0) FROM dbo.fact_propuestas_rechazadas_lead) M4,
 (SELECT ISNULL(SUM(propuesta_rechazada_economica),0) FROM dbo.fact_propuestas_rechazadas_lead) M5,
 (SELECT ISNULL(SUM(alternativa_aceptada),0) FROM dbo.fact_alternativas_aceptadas_lead) M6,
 (SELECT ISNULL(SUM(alternativa_rechazada),0) FROM dbo.fact_alternativas_rechazadas_lead) M7,
 (SELECT ISNULL(SUM(alternativa_rechazada_incompatibilidad),0) FROM dbo.fact_alternativas_rechazadas_lead) M8
INTO #ControlMart;

SELECT 'OLTP' AS Fuente,* FROM #ControlOLTP
UNION ALL
SELECT 'Mart',* FROM #ControlMart;
IF EXISTS (SELECT * FROM #ControlOLTP EXCEPT SELECT * FROM #ControlMart)
 THROW 54908,'Las sumas de los hechos no coinciden con los conteos OLTP.',1;
DROP TABLE #ControlO,#ControlP,#ControlA,#ControlOLTP,#ControlMart;
