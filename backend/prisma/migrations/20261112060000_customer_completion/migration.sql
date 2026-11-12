-- Aplicar por administración únicamente; la aplicación no requiere DDL.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
-- El ejecutor de certificación rechaza referencias a bases operativas.
IF OBJECT_ID('dbo.PoliticasCustomerIA','U') IS NULL
CREATE TABLE dbo.PoliticasCustomerIA (
 id_politica INT IDENTITY PRIMARY KEY, codigo VARCHAR(60) NOT NULL, version INT NOT NULL,
 id_servicio INT NULL, estado VARCHAR(25) NOT NULL DEFAULT 'Borrador', configuracion NVARCHAR(MAX) NOT NULL,
 id_usuario_creador INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
 id_profesional_revisor INT NULL REFERENCES dbo.Profesionales(id_profesional),
 fecha_revision DATETIME2 NULL, fecha_publicacion DATETIME2 NULL,
 CONSTRAINT UQ_PoliticaCustomer UNIQUE(codigo,version),
 CONSTRAINT CK_PoliticaCustomer_JSON CHECK(ISJSON(configuracion)=1),
 CONSTRAINT CK_PoliticaCustomer_Publicacion CHECK(estado<>'Publicada' OR (id_profesional_revisor IS NOT NULL AND fecha_revision IS NOT NULL AND fecha_publicacion IS NOT NULL))
);
IF OBJECT_ID('dbo.SolicitudesCustomerIA','U') IS NULL
CREATE TABLE dbo.SolicitudesCustomerIA (
 id_solicitud INT IDENTITY PRIMARY KEY, tipo VARCHAR(30) NOT NULL,
 id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
 id_tratamiento INT NULL REFERENCES dbo.TratamientosContratados(id_tratamiento),
 id_atencion INT NULL REFERENCES dbo.Atenciones(id_atencion),
 id_profesional INT NULL REFERENCES dbo.Profesionales(id_profesional),
 estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente', payload NVARCHAR(MAX) NOT NULL,
 clave_idempotencia VARCHAR(120) NOT NULL UNIQUE, id_correlacion VARCHAR(64) NOT NULL,
 fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(), fecha_revision DATETIME2 NULL,
 id_usuario_responsable INT NULL REFERENCES dbo.Usuarios(id_usuario), evidencia VARCHAR(500) NULL,
 CONSTRAINT CK_SolicitudCustomer_JSON CHECK(ISJSON(payload)=1),
 CONSTRAINT CK_SolicitudCustomer_Tipo CHECK(tipo IN ('AGENDAMIENTO','DERIVACION','CIERRE')),
 CONSTRAINT CK_SolicitudCustomer_Estado CHECK(estado IN ('Pendiente','En_Revision','Aprobada','Aplicada','Rechazada','Cancelada','Atendida','Resuelta'))
);
IF COL_LENGTH('dbo.SesionesTratamiento','confirmacion_paciente') IS NULL
 ALTER TABLE dbo.SesionesTratamiento ADD confirmacion_paciente VARCHAR(20) NOT NULL DEFAULT 'No_Solicitada', fecha_confirmacion DATETIME2 NULL;
IF COL_LENGTH('dbo.BorradoresIA','fecha_transferencia_ficha') IS NULL
 ALTER TABLE dbo.BorradoresIA ADD fecha_transferencia_ficha DATETIME2 NULL;
IF COL_LENGTH('dbo.ValidacionesFicha','id_politica_ia') IS NULL
 ALTER TABLE dbo.ValidacionesFicha ADD id_politica_ia INT NULL REFERENCES dbo.PoliticasCustomerIA(id_politica), huella_documental VARCHAR(64) NULL;
IF COL_LENGTH('dbo.Atenciones','revision_ficha') IS NULL ALTER TABLE dbo.Atenciones ADD revision_ficha INT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.ValidacionesFicha','revision_ficha') IS NULL ALTER TABLE dbo.ValidacionesFicha ADD revision_ficha INT NOT NULL DEFAULT 0;
-- Auditoría de staff sin inventar un paciente para satisfacer una FK.
ALTER TABLE dbo.InteraccionesIA ALTER COLUMN id_persona INT NULL;
IF COL_LENGTH('dbo.InteraccionesIA','id_usuario_actor') IS NULL
 ALTER TABLE dbo.InteraccionesIA ADD id_usuario_actor INT NULL REFERENCES dbo.Usuarios(id_usuario);
DECLARE @check SYSNAME;
DECLARE actor_checks CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.InteraccionesIA') AND definition LIKE '%actor_orientado%';
OPEN actor_checks; FETCH NEXT FROM actor_checks INTO @check;
WHILE @@FETCH_STATUS=0 BEGIN EXEC('ALTER TABLE dbo.InteraccionesIA DROP CONSTRAINT ['+@check+']'); FETCH NEXT FROM actor_checks INTO @check; END;
CLOSE actor_checks; DEALLOCATE actor_checks;
ALTER TABLE dbo.InteraccionesIA ADD CONSTRAINT CK_InteraccionesIA_ActorCompletion CHECK(actor_orientado IN ('PACIENTE','ODONTOLOGO','RECEPCION','ADMIN'));
IF OBJECT_ID('dbo.SesionesAccesoIA','U') IS NULL
CREATE TABLE dbo.SesionesAccesoIA (
 id_sesion VARCHAR(64) PRIMARY KEY, fecha_expiracion DATETIME2 NOT NULL, fecha_revocacion DATETIME2 NULL
);
