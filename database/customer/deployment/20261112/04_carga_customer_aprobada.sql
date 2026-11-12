-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [$(MartDatabase)];
-- Escritura adicional separada: requiere autorización para carga y conciliación del clon.
EXEC dbo.usp_ETL_SincronizarCustomerMart;
