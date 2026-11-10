:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF NOT (
 (N'$(AutorizarPrincipal)'=N'NO' AND (
   (DB_NAME()=N'NexoSalud_Mart_LeadPreQA' AND N'$(Origen)'=N'NexoSaludDB_LeadPreQA')
   OR (DB_NAME()=N'NexoSalud_Mart_LeadFactsQA' AND N'$(Origen)'=N'NexoSaludDB_LeadFactsQA')))
 OR (N'$(AutorizarPrincipal)'=N'SI' AND @@SERVERNAME=N'ANTHONY'
     AND DB_NAME()=N'NexoSalud_Mart' AND N'$(Origen)'=N'NexoSaludDB')
) THROW 54900,'Par de bases de hechos no autorizado.',1;
IF OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Oportunidades_Corte','IF') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Propuestas_Corte','IF') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.fn_Lead_Alternativas_Corte','IF') IS NULL
 THROW 54901,'Faltan las funciones OLTP aprobadas de LEAD.',1;
