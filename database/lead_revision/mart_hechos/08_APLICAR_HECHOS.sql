:r .\database\lead_revision\mart_hechos\00_CONTEXTO_HECHOS.sql
IF NOT (
 (DB_NAME()=N'NexoSalud_Mart_LeadFactsQA' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadFactsRef')
 OR (DB_NAME()=N'NexoSalud_Mart' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadFactsVentanaRef')
) OR DB_ID(N'$(Referencia)') IS NULL
 THROW 54932,'Falta la referencia restaurada del mismo entorno.',1;
IF @@TRANCOUNT<>0 THROW 54933,'La instalación requiere una sesión nueva.',1;
BEGIN TRANSACTION;
GO
:r .\database\lead_revision\mart_hechos\01_CREAR_HECHOS.sql
GO
:r .\database\lead_revision\mart_hechos\02_POBLAR_HECHOS.sql
:r .\database\lead_revision\mart_hechos\09_COMPARAR_CON_REFERENCIA.sql
GO
IF @@TRANCOUNT<>1 THROW 54934,'Estado inesperado de la transacción de instalación.',1;
COMMIT TRANSACTION;
SELECT DB_NAME() AS Destino,SYSUTCDATETIME() AS ConfirmadoUTC;
GO
