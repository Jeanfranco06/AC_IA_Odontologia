-- Migración aditiva: Persistencia de Agente Inteligente CUSTOMER
-- NexoSalud: InteraccionesIA, AlertasIA, BorradoresIA con relaciones clínicas y trazabilidad

IF OBJECT_ID('dbo.InteraccionesIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InteraccionesIA (
        id_interaccion_ia               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InteraccionesIA PRIMARY KEY,
        id_persona                      INT NOT NULL CONSTRAINT FK_InteraccionesIA_Persona REFERENCES dbo.Personas(id_persona),
        id_profesional                  INT NULL CONSTRAINT FK_InteraccionesIA_Profesional REFERENCES dbo.Profesionales(id_profesional),
        id_tratamiento                  INT NULL CONSTRAINT FK_InteraccionesIA_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        id_sesion                       INT NULL CONSTRAINT FK_InteraccionesIA_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion),
        id_atencion                     INT NULL CONSTRAINT FK_InteraccionesIA_Atencion REFERENCES dbo.Atenciones(id_atencion),
        actor_orientado                 VARCHAR(20) NOT NULL,
        tipo_evento                     VARCHAR(80) NOT NULL,
        resumen_consulta                VARCHAR(300) NOT NULL,
        fecha_hora                      DATETIME2 NOT NULL CONSTRAINT DF_InteraccionesIA_Fecha DEFAULT SYSDATETIME(),
        estado                          VARCHAR(30) NOT NULL CONSTRAINT DF_InteraccionesIA_Estado DEFAULT 'Completada',
        resultado                       VARCHAR(200) NOT NULL,
        requiere_revision_humana        BIT NOT NULL CONSTRAINT DF_InteraccionesIA_ReqRev DEFAULT 0,
        id_usuario_revisor              INT NULL CONSTRAINT FK_InteraccionesIA_UsuarioRev REFERENCES dbo.Usuarios(id_usuario),
        id_profesional_aprobador        INT NULL CONSTRAINT FK_InteraccionesIA_ProfAprob REFERENCES dbo.Profesionales(id_profesional),
        fecha_aprobacion                DATETIME2 NULL,
        version_agente                  VARCHAR(40) NOT NULL CONSTRAINT DF_InteraccionesIA_Version DEFAULT 'CopilotoOdonto-v1.0',
        es_diagnostico_o_prescripcion   BIT NOT NULL CONSTRAINT DF_InteraccionesIA_NoDiag DEFAULT 0,
        id_correlacion                  VARCHAR(64) NULL,

        CONSTRAINT CK_InteraccionesIA_Actor CHECK (actor_orientado IN ('PACIENTE', 'ODONTOLOGO')),
        CONSTRAINT CK_InteraccionesIA_Estado CHECK (
            estado IN ('Registrada', 'Completada', 'Derivada_Personal', 'En_Revision', 'Aprobada', 'Rechazada')
        ),
        CONSTRAINT CK_InteraccionesIA_NoDiagnostico CHECK (es_diagnostico_o_prescripcion = 0)
    );
END;

IF COL_LENGTH('dbo.InteraccionesIA', 'id_correlacion') IS NULL
BEGIN
    ALTER TABLE dbo.InteraccionesIA ADD id_correlacion VARCHAR(64) NULL;
END;

IF OBJECT_ID('dbo.AlertasIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AlertasIA (
        id_alerta_ia                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AlertasIA PRIMARY KEY,
        id_interaccion_origen       INT NULL CONSTRAINT FK_AlertasIA_InteraccionOrigen REFERENCES dbo.InteraccionesIA(id_interaccion_ia),
        id_persona                  INT NOT NULL CONSTRAINT FK_AlertasIA_Persona REFERENCES dbo.Personas(id_persona),
        id_profesional              INT NULL CONSTRAINT FK_AlertasIA_Profesional REFERENCES dbo.Profesionales(id_profesional),
        id_tratamiento              INT NULL CONSTRAINT FK_AlertasIA_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        id_sesion                   INT NULL CONSTRAINT FK_AlertasIA_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion),
        id_atencion                 INT NULL CONSTRAINT FK_AlertasIA_Atencion REFERENCES dbo.Atenciones(id_atencion),
        tipo_evento                 VARCHAR(80) NOT NULL,
        severidad                   VARCHAR(20) NOT NULL CONSTRAINT DF_AlertasIA_Severidad DEFAULT 'Media',
        mensaje_alerta              VARCHAR(300) NOT NULL,
        fecha_hora                  DATETIME2 NOT NULL CONSTRAINT DF_AlertasIA_Fecha DEFAULT SYSDATETIME(),
        estado                      VARCHAR(30) NOT NULL CONSTRAINT DF_AlertasIA_Estado DEFAULT 'Generada',
        resultado                   VARCHAR(200) NULL,
        requiere_revision_humana    BIT NOT NULL CONSTRAINT DF_AlertasIA_ReqRev DEFAULT 1,
        id_usuario_revisor          INT NULL CONSTRAINT FK_AlertasIA_UsuarioRev REFERENCES dbo.Usuarios(id_usuario),
        id_profesional_revisor      INT NULL CONSTRAINT FK_AlertasIA_ProfRev REFERENCES dbo.Profesionales(id_profesional),
        fecha_atencion_alerta       DATETIME2 NULL,
        version_agente              VARCHAR(40) NOT NULL CONSTRAINT DF_AlertasIA_Version DEFAULT 'CopilotoOdonto-v1.0',

        CONSTRAINT CK_AlertasIA_Severidad CHECK (severidad IN ('Baja', 'Media', 'Alta', 'Crítica')),
        CONSTRAINT CK_AlertasIA_Estado CHECK (estado IN ('Generada', 'En_Revision', 'Atendida', 'Descartada_Justificada')),
        CONSTRAINT CK_AlertasIA_EvidenciaAtencion CHECK (
            estado NOT IN ('Atendida', 'Descartada_Justificada')
            OR ((id_profesional_revisor IS NOT NULL OR id_usuario_revisor IS NOT NULL) AND fecha_atencion_alerta IS NOT NULL)
        )
    );
END;

IF COL_LENGTH('dbo.AlertasIA', 'id_interaccion_origen') IS NULL
BEGIN
    ALTER TABLE dbo.AlertasIA ADD id_interaccion_origen INT NULL CONSTRAINT FK_AlertasIA_InteraccionOrigen REFERENCES dbo.InteraccionesIA(id_interaccion_ia);
END;

IF OBJECT_ID('dbo.BorradoresIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BorradoresIA (
        id_borrador_ia              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BorradoresIA PRIMARY KEY,
        id_interaccion_origen       INT NULL CONSTRAINT FK_BorradoresIA_InteraccionOrigen REFERENCES dbo.InteraccionesIA(id_interaccion_ia),
        id_borrador_raiz            INT NULL,
        version_borrador            INT NOT NULL CONSTRAINT DF_BorradoresIA_Ver DEFAULT 1,
        es_version_actual           BIT NOT NULL CONSTRAINT DF_BorradoresIA_Actual DEFAULT 1,
        id_persona                  INT NOT NULL CONSTRAINT FK_BorradoresIA_Persona REFERENCES dbo.Personas(id_persona),
        id_profesional              INT NOT NULL CONSTRAINT FK_BorradoresIA_Prof REFERENCES dbo.Profesionales(id_profesional),
        id_tratamiento              INT NULL CONSTRAINT FK_BorradoresIA_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        id_sesion                   INT NULL CONSTRAINT FK_BorradoresIA_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion),
        id_atencion                 INT NOT NULL CONSTRAINT FK_BorradoresIA_Atencion REFERENCES dbo.Atenciones(id_atencion),
        id_indicacion_vinculada     INT NULL CONSTRAINT FK_BorradoresIA_Indicacion REFERENCES dbo.IndicacionesPostatencion(id_indicacion),
        tipo_evento                 VARCHAR(80) NOT NULL CONSTRAINT DF_BorradoresIA_Tipo DEFAULT 'BORRADOR_INDICACIONES_POSTATENCION',
        contenido_sugerido          VARCHAR(MAX) NOT NULL,
        fecha_hora                  DATETIME2 NOT NULL CONSTRAINT DF_BorradoresIA_Fecha DEFAULT SYSDATETIME(),
        estado                      VARCHAR(30) NOT NULL CONSTRAINT DF_BorradoresIA_Estado DEFAULT 'Generado',
        resultado                   VARCHAR(200) NULL,
        requiere_revision_humana    BIT NOT NULL CONSTRAINT DF_BorradoresIA_ReqRev DEFAULT 1,
        id_profesional_aprobador    INT NULL CONSTRAINT FK_BorradoresIA_ProfAprob REFERENCES dbo.Profesionales(id_profesional),
        id_usuario_revisor          INT NULL CONSTRAINT FK_BorradoresIA_UsuarioRev REFERENCES dbo.Usuarios(id_usuario),
        fecha_aprobacion            DATETIME2 NULL,
        version_agente              VARCHAR(40) NOT NULL CONSTRAINT DF_BorradoresIA_Version DEFAULT 'CopilotoOdonto-v1.0',

        CONSTRAINT CK_BorradoresIA_Version CHECK (version_borrador >= 1),
        CONSTRAINT CK_BorradoresIA_ReqRev CHECK (requiere_revision_humana = 1),
        CONSTRAINT CK_BorradoresIA_Estado CHECK (
            estado IN ('Generado', 'En_Revision', 'Aprobado', 'Corregido_Y_Aprobado', 'Rechazado')
        ),
        CONSTRAINT CK_BorradoresIA_EvidenciaAprobacion CHECK (
            estado NOT IN ('Aprobado', 'Corregido_Y_Aprobado')
            OR (id_profesional_aprobador IS NOT NULL AND fecha_aprobacion IS NOT NULL)
        )
    );
END;

IF COL_LENGTH('dbo.BorradoresIA', 'id_interaccion_origen') IS NULL
BEGIN
    ALTER TABLE dbo.BorradoresIA ADD id_interaccion_origen INT NULL CONSTRAINT FK_BorradoresIA_InteraccionOrigen REFERENCES dbo.InteraccionesIA(id_interaccion_ia);
END;
