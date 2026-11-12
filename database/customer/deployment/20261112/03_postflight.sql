-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.Atenciones','revision_ficha') IS NULL OR COL_LENGTH('dbo.InteraccionesIA','id_usuario_actor') IS NULL OR OBJECT_ID('dbo.SolicitudesCustomerIA','U') IS NULL OR OBJECT_ID('dbo.SesionesAccesoIA','U') IS NULL THROW 56510,'Esquema CUSTOMER incompleto.',1;
SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints WHERE name IN('CK_Tratamientos_Estado','CK_Atenciones_Asistencia','CK_InteraccionesIA_ActorCompletion');
SELECT COUNT(*) publishedPolicies FROM dbo.PoliticasCustomerIA WHERE estado='Publicada';
USE [$(MartDatabase)];
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.usp_ETL_SincronizarCustomerMart')) definition;
SELECT COUNT(*) unknownFacts FROM dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0;
-- Ejecutar conciliación de las 20 medidas por separado; estas lecturas no ejecutan ETL.
