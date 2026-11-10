:r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql
IF @@TRANCOUNT<>0 THROW 54763,'Ejecute el paquete en una sesión nueva.',1;
IF DATABASEPROPERTYEX(DB_NAME(),'Updateability')<>'READ_WRITE'
 THROW 54764,'El destino debe permitir escritura durante la carga.',1;
BEGIN TRANSACTION;
GO
:r .\database\lead_revision\mart_dimensiones\01_MIGRAR_DIMENSIONES.sql
GO
:r .\database\lead_revision\mart_dimensiones\03_CARGAR_DIMENSIONES.sql
GO
IF @@TRANCOUNT<>1 THROW 54765,'La transacción del paquete no quedó en el estado esperado.',1;
COMMIT TRANSACTION;
SELECT DB_NAME() AS Destino, SYSUTCDATETIME() AS ConfirmadoUTC;
GO
