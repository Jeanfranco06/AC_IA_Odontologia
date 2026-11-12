-- Reinstala los contratos de estado del DDL canónico con codificación UTF-8.
-- WITH CHECK rechaza datos históricos no equivalentes: no los reclasifica silenciosamente.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Tratamientos_Estado') ALTER TABLE dbo.TratamientosContratados DROP CONSTRAINT CK_Tratamientos_Estado;
ALTER TABLE dbo.TratamientosContratados WITH CHECK ADD CONSTRAINT CK_Tratamientos_Estado CHECK(estado_tratamiento IN('Contratado','Activado',N'En ejecución','Suspendido','Completado','Cancelado'));
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Atenciones_Asistencia') ALTER TABLE dbo.Atenciones DROP CONSTRAINT CK_Atenciones_Asistencia;
ALTER TABLE dbo.Atenciones WITH CHECK ADD CONSTRAINT CK_Atenciones_Asistencia CHECK(asistencia IN('Pendiente','Confirmada',N'Asistió',N'No asistió','Asiste','No asiste'));
COMMIT;
