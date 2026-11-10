:r .\database\lead_revision\mart_hechos\00_CONTEXTO_HECHOS.sql
IF NOT (
 (DB_NAME()=N'NexoSalud_Mart_LeadFactsQA' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadFactsRef')
 OR (DB_NAME()=N'NexoSalud_Mart' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadFactsVentanaRef')
) OR DB_ID(N'$(Referencia)') IS NULL
 THROW 54932,'Falta la referencia restaurada del mismo entorno.',1;

-- Una fila completa incluye todas las claves, los descriptores y las medidas.
-- Se ordena por la PK y se compara el JSON como bytes, incluidos los nulos.
DECLARE @Comparacion TABLE(Objeto sysname, Actual nvarchar(max), Referencia nvarchar(max));
INSERT @Comparacion VALUES
 ('Dim_Tiempo',
  (SELECT * FROM dbo.Dim_Tiempo ORDER BY KeyTiempo FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Tiempo ORDER BY KeyTiempo FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Servicio',
  (SELECT * FROM dbo.Dim_Servicio ORDER BY KeyServicio FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Servicio ORDER BY KeyServicio FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Canal',
  (SELECT * FROM dbo.Dim_Canal ORDER BY KeyCanal FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Canal ORDER BY KeyCanal FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Sede',
  (SELECT * FROM dbo.Dim_Sede ORDER BY KeySede FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Sede ORDER BY KeySede FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Negociador',
  (SELECT * FROM dbo.Dim_Negociador ORDER BY KeyNegociador FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Negociador ORDER BY KeyNegociador FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Profesional',
  (SELECT * FROM dbo.Dim_Profesional ORDER BY KeyProfesional FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Profesional ORDER BY KeyProfesional FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Promocion',
  (SELECT * FROM dbo.Dim_Promocion ORDER BY KeyPromocion FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Promocion ORDER BY KeyPromocion FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_MotivoRechazo',
  (SELECT * FROM dbo.Dim_MotivoRechazo ORDER BY KeyMotivoRechazo FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_MotivoRechazo ORDER BY KeyMotivoRechazo FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('Dim_Horario',
  (SELECT * FROM dbo.Dim_Horario ORDER BY KeyHorario FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.Dim_Horario ORDER BY KeyHorario FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('fact_captacion_buyer',
  (SELECT * FROM dbo.fact_captacion_buyer ORDER BY KeyTiempo,KeySede,KeyCanal,KeyFuente,KeyEstadoRegistro FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.fact_captacion_buyer ORDER BY KeyTiempo,KeySede,KeyCanal,KeyFuente,KeyEstadoRegistro FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('fact_negociacion_lead',
  (SELECT * FROM dbo.fact_negociacion_lead ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyNegociador FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.fact_negociacion_lead ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyNegociador FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('fact_gestion_payer',
  (SELECT * FROM dbo.fact_gestion_payer ORDER BY KeyTiempo,KeyPasarela,KeyCobro,KeySede,KeyServicio FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.fact_gestion_payer ORDER BY KeyTiempo,KeyPasarela,KeyCobro,KeySede,KeyServicio FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('fact_atencion_customer',
  (SELECT * FROM dbo.fact_atencion_customer ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyEstadoAtencion FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.fact_atencion_customer ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyEstadoAtencion FOR JSON PATH,INCLUDE_NULL_VALUES)),
 ('fact_seguimiento_turned',
  (SELECT * FROM dbo.fact_seguimiento_turned ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyCanal FOR JSON PATH,INCLUDE_NULL_VALUES),
  (SELECT * FROM [$(Referencia)].dbo.fact_seguimiento_turned ORDER BY KeyTiempo,KeySede,KeyServicio,KeyProfesional,KeyCanal FOR JSON PATH,INCLUDE_NULL_VALUES));

IF EXISTS (SELECT 1 FROM @Comparacion
 WHERE ISNULL(CONVERT(varbinary(max),Actual),0x)<>ISNULL(CONVERT(varbinary(max),Referencia),0x))
BEGIN
 SELECT Objeto AS ObjetoDistinto FROM @Comparacion
 WHERE ISNULL(CONVERT(varbinary(max),Actual),0x)<>ISNULL(CONVERT(varbinary(max),Referencia),0x);
 THROW 54935,'Una dimensión o un hecho heredado difiere de la referencia.',1;
END;
SELECT COUNT(*) AS ObjetosIdenticos FROM @Comparacion;
SELECT 'fact_captacion_buyer' AS Hecho,COUNT_BIG(*) AS FilasConservadas FROM dbo.fact_captacion_buyer
UNION ALL
SELECT 'fact_negociacion_lead' AS Hecho,COUNT_BIG(*) AS FilasConservadas FROM dbo.fact_negociacion_lead
UNION ALL
SELECT 'fact_gestion_payer' AS Hecho,COUNT_BIG(*) AS FilasConservadas FROM dbo.fact_gestion_payer
UNION ALL
SELECT 'fact_atencion_customer' AS Hecho,COUNT_BIG(*) AS FilasConservadas FROM dbo.fact_atencion_customer
UNION ALL
SELECT 'fact_seguimiento_turned' AS Hecho,COUNT_BIG(*) AS FilasConservadas FROM dbo.fact_seguimiento_turned;
