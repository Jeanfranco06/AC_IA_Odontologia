:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'NexoSalud_Mart_LeadPreQA' OR N'$(Origen)'<>N'NexoSaludDB_LeadPreQA'
 THROW 54900,'El paquete de hechos solo admite el par LeadPreQA.',1;
IF OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Oportunidades_Corte','IF') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Propuestas_Corte','IF') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Alternativas_Corte','IF') IS NULL
 THROW 54901,'Faltan las funciones OLTP aprobadas de LEAD.',1;
