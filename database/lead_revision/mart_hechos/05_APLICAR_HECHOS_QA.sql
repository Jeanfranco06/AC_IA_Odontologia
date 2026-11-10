:r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql
BEGIN TRANSACTION;
GO
:r .\database\lead_revision\mart_hechos\01_CREAR_HECHOS.sql
GO
:r .\database\lead_revision\mart_hechos\02_POBLAR_HECHOS.sql
COMMIT TRANSACTION;
GO
