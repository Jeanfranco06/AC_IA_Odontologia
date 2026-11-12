-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
-- Solo lecturas. Los bloqueos no reparan datos automáticamente.
IF EXISTS(SELECT 1 FROM dbo.TratamientosContratados WHERE estado_tratamiento NOT IN('Contratado','Activado',N'En ejecución','Suspendido','Completado','Cancelado')) THROW 56501,'Estados de tratamiento no compatibles; requiere decisión histórica explícita.',1;
IF EXISTS(SELECT 1 FROM dbo.Atenciones WHERE asistencia NOT IN('Pendiente','Confirmada',N'Asistió',N'No asistió','Asiste','No asiste')) THROW 56502,'Estados de asistencia no compatibles.',1;
IF EXISTS(SELECT 1 FROM dbo.InteraccionesIA WHERE actor_orientado NOT IN('PACIENTE','ODONTOLOGO','RECEPCION','ADMIN')) THROW 56503,'Actor histórico no compatible.',1;
IF EXISTS(SELECT id_tratamiento,numero_sesion FROM dbo.SesionesTratamiento GROUP BY id_tratamiento,numero_sesion HAVING COUNT(*)>1) THROW 56504,'Ordinales de sesión duplicados.',1;
IF EXISTS(SELECT id_tratamiento FROM dbo.PlanTratamiento WHERE es_vigente=1 GROUP BY id_tratamiento HAVING COUNT(*)>1) THROW 56505,'Más de un plan vigente.',1;
SELECT @@SERVERNAME serverName,DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') administrativeExecutor;
SELECT OBJECT_NAME(parent_object_id) tableName,name,is_not_trusted FROM sys.check_constraints WHERE is_not_trusted=1 OR is_disabled=1;
SELECT OBJECT_NAME(parent_object_id) tableName,name,is_not_trusted FROM sys.foreign_keys WHERE is_not_trusted=1 OR is_disabled=1;
USE [$(MartDatabase)];
IF EXISTS(SELECT ClaseEventoIA,id_origen_ia FROM dbo.Fact_InteraccionIACustomer GROUP BY ClaseEventoIA,id_origen_ia HAVING COUNT(*)>1) THROW 56506,'Grano de eventos duplicado.',1;
SELECT ClaseEventoIA,COUNT(*) unknownFacts FROM dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0 GROUP BY ClaseEventoIA;
