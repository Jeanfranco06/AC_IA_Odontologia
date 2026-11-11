IF OBJECT_ID(N'dbo.SolicitudesReprogramacionCustomer', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudesReprogramacionCustomer (
        id_solicitud_reprogramacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudesReprogramacionCustomer PRIMARY KEY,
        id_sesion INT NOT NULL,
        id_tratamiento INT NOT NULL,
        id_persona INT NOT NULL,
        id_interaccion_origen INT NULL,
        fecha_programada_original DATETIME2 NOT NULL,
        fecha_preferida DATETIME2 NULL,
        franja_preferida VARCHAR(40) NULL,
        motivo_solicitud VARCHAR(300) NULL,
        estado_solicitud VARCHAR(30) NOT NULL CONSTRAINT DF_SolicitudReprog_Estado DEFAULT 'Pendiente',
        id_usuario_responsable INT NULL,
        fecha_creacion DATETIME2 NOT NULL CONSTRAINT DF_SolicitudReprog_Creacion DEFAULT SYSDATETIME(),
        fecha_revision DATETIME2 NULL,
        fecha_aplicacion DATETIME2 NULL,
        motivo_resolucion VARCHAR(300) NULL,
        clave_idempotencia VARCHAR(120) NOT NULL,
        id_correlacion VARCHAR(64) NULL,
        CONSTRAINT UQ_SolicitudReprog_Idempotencia UNIQUE (clave_idempotencia),
        CONSTRAINT CK_SolicitudReprog_Estado CHECK (estado_solicitud IN ('Pendiente','En_Revision','Aprobada','Rechazada','Aplicada','Cancelada')),
        CONSTRAINT CK_SolicitudReprog_Aplicada CHECK (estado_solicitud <> 'Aplicada' OR fecha_aplicacion IS NOT NULL),
        CONSTRAINT FK_SolicitudReprog_Sesion FOREIGN KEY (id_sesion) REFERENCES dbo.SesionesTratamiento(id_sesion),
        CONSTRAINT FK_SolicitudReprog_Tratamiento FOREIGN KEY (id_tratamiento) REFERENCES dbo.TratamientosContratados(id_tratamiento),
        CONSTRAINT FK_SolicitudReprog_Persona FOREIGN KEY (id_persona) REFERENCES dbo.Personas(id_persona),
        CONSTRAINT FK_SolicitudReprog_Interaccion FOREIGN KEY (id_interaccion_origen) REFERENCES dbo.InteraccionesIA(id_interaccion_ia),
        CONSTRAINT FK_SolicitudReprog_Usuario FOREIGN KEY (id_usuario_responsable) REFERENCES dbo.Usuarios(id_usuario)
    );
    CREATE INDEX IX_SolicitudReprog_PersonaEstado ON dbo.SolicitudesReprogramacionCustomer(id_persona, estado_solicitud, fecha_creacion);
    CREATE INDEX IX_SolicitudReprog_SesionEstado ON dbo.SolicitudesReprogramacionCustomer(id_sesion, estado_solicitud);
END;
