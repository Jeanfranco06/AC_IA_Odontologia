:r .\database\lead_revision\mart_hechos\00_CONTEXTO_HECHOS.sql
DECLARE @corte datetime2(7)=SYSUTCDATETIME();
:r .\database\lead_revision\mart_hechos\03_COMPARAR_MEDIDAS.sql
SELECT @corte AS CorteUTC;
GO
