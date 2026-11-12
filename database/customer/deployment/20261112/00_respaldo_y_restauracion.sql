-- PLANTILLA DBA, NO EJECUTADA. Rutas, nombres y ventana requieren aprobación.
-- ReleaseId debe ser único; no se usa REPLACE ni se sobrescriben bases existentes.
BACKUP DATABASE [NexoSaludDB] TO DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH COPY_ONLY,CHECKSUM,COMPRESSION,NOINIT;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH COPY_ONLY,CHECKSUM,COMPRESSION,NOINIT;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH CHECKSUM;
-- VERIFYONLY no sustituye restauración de prueba.
RESTORE FILELISTONLY FROM DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak';
RESTORE FILELISTONLY FROM DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak';
-- DBA prepara MOVE de cada archivo lógico a rutas aisladas para dos clones autorizados.
-- Nunca ejecutar RESTORE ... WITH REPLACE sobre la base activa para ensayar.
-- Documentar restauración real, consistencia CHECKDB y conciliación antes de habilitar despliegue.
