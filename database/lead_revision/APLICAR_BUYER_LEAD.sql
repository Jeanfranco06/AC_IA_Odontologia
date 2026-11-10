:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME() <> N'$(BaseEsperada)' OR DB_NAME() NOT IN (N'NexoSaludDB',N'NexoSalud_LeadEnsayoFinal')
 THROW 54612,'La sesión no apunta al destino OLTP explícitamente autorizado.',1;
IF DATABASEPROPERTYEX(DB_NAME(),'Updateability') <> 'READ_WRITE' OR @@TRANCOUNT <> 0
 THROW 54613,'Se requiere una sesión nueva sobre una base de escritura.',1;
IF OBJECT_ID('dbo.Personas','U') IS NULL OR OBJECT_ID('dbo.EventosEtapa','U') IS NULL
 OR OBJECT_ID('dbo.DecisionesIA','U') IS NULL OR OBJECT_ID('dbo.Solicitudes','U') IS NULL
 OR OBJECT_ID('dbo.Opciones','U') IS NULL OR OBJECT_ID('dbo.Interacciones','U') IS NULL
 OR OBJECT_ID('dbo.Disponibilidad','U') IS NULL OR OBJECT_ID('dbo.PersonaPreferencias','U') IS NULL
 OR NOT EXISTS (SELECT 1 FROM dbo.Etapas WHERE nombre='BUYER')
 OR NOT EXISTS (SELECT 1 FROM dbo.Etapas WHERE nombre='LEAD')
 THROW 54614,'El esquema base OLTP no coincide con el preflight.',1;

EXEC sys.sp_set_session_context @key=N'instalacion_buyer_lead', @value=1;
BEGIN TRANSACTION;
GO

PRINT 'Instalando BUYER OLTP';
GO
:r .\database\lead_revision\01_BUYER_OLTP.sql

PRINT 'Instalando LEAD OLTP';
GO
:r .\database\lead_revision\INSTALAR_LEAD_COMPLETO.sql

IF @@TRANCOUNT <> 1
 THROW 54615,'La transacción externa de instalación no está activa.',1;
IF OBJECT_ID('dbo.usp_ConvertirBuyerALead','P') IS NULL OR OBJECT_ID('dbo.v_DatosCaptacionBuyer','V') IS NULL
 OR OBJECT_ID('dbo.usp_Lead_ReporteR1','P') IS NULL OR OBJECT_ID('dbo.usp_Lead_ReporteR2','P') IS NULL
 OR OBJECT_ID('dbo.usp_Lead_ReporteR3','P') IS NULL
 THROW 54616,'No se encontraron todos los módulos requeridos.',1;
COMMIT TRANSACTION;
EXEC sys.sp_set_session_context @key=N'instalacion_buyer_lead', @value=NULL;
PRINT 'BUYER y LEAD instalados en la misma transacción.';
GO
