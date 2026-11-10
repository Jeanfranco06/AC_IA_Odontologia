:r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql
DECLARE @corte datetime2(7)=SYSUTCDATETIME();

-- Primera comprobación: medir el estado grabado antes de usar las funciones.
SELECT COUNT_BIG(*) AS Solicitudes, COUNT_BIG(fecha_ingreso_lead) AS IngresosLead,
 COUNT_BIG(CASE WHEN resultado_comercial_lead='ACEPTADA' THEN 1 END) AS M1,
 COUNT_BIG(CASE WHEN resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 END) AS M2
FROM [$(Origen)].dbo.Solicitudes;

SELECT estado,COUNT_BIG(*) AS Versiones
FROM [$(Origen)].dbo.PropuestasEconomicasLead
GROUP BY estado;

SELECT estado_respuesta,COUNT_BIG(*) AS Opciones
FROM [$(Origen)].dbo.Opciones
GROUP BY estado_respuesta;

-- Segunda comprobación: contar identidades vigentes sin joins dimensionales.
SELECT resultado_comercial_lead,COUNT_BIG(*) AS Oportunidades
FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte)
GROUP BY resultado_comercial_lead;

SELECT estado,categoria_motivo,COUNT_BIG(*) AS PropuestasRaiz
FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte)
GROUP BY estado,categoria_motivo;

SELECT estado_respuesta,categoria_motivo,COUNT_BIG(*) AS Alternativas
FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte)
GROUP BY estado_respuesta,categoria_motivo;

-- Tercera comprobación: sumar las ocho medidas con las reglas OLTP al corte.
:r .\database\lead_revision\mart_hechos\03_COMPARAR_MEDIDAS.sql

-- Ejemplo de análisis académico: sumar el hecho agregado por día y motivo.
SELECT t.id_fecha,m.TipoMotivoRechazo,SUM(f.alternativa_rechazada) AS M7,
 SUM(f.alternativa_rechazada_incompatibilidad) AS M8
FROM dbo.fact_alternativas_rechazadas_lead f
JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
JOIN dbo.Dim_MotivoRechazo m ON m.KeyMotivoRechazo=f.KeyMotivoRechazo
GROUP BY t.id_fecha,m.TipoMotivoRechazo
ORDER BY t.id_fecha,m.TipoMotivoRechazo;
SELECT @corte AS CorteUTC;
