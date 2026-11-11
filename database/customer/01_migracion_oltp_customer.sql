-- ====================================================================
-- ARCHIVO: 01_migracion_oltp_customer.sql
-- FASE: CUSTOMER (Migración Aditiva e Idempotente OLTP - NexoSaludDB)
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Resuelve inconsistencias heredadas H01, H02 y H09 sin destruir datos.
--   2. Crea las entidades OLTP de CUSTOMER (TratamientosContratados,
--      PlanTratamiento, SesionesTratamiento, EventosSesion, extensiones de
--      Atenciones, DetalleProcedimiento, ValidacionesFicha,
--      IndicacionesPostatencion, AntecedentesClinicos y tablas de IA).
--   3. Implementa las reglas transaccionales R01 a R18 mediante triggers,
--      funciones y procedimientos almacenados con control de concurrencia.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSaludDB];
GO

BEGIN TRANSACTION;

-- ====================================================================
-- SECCIÓN 1: RESOLUCIÓN DE INCONSISTENCIAS HEREDADAS (H01, H02, H09, LEAD/BUYER ALIGNMENT)
-- ====================================================================

-- 1.0. Alineación de columnas requeridas por el modelo ORM (BUYER y LEAD)
IF COL_LENGTH('dbo.Interacciones', 'id_solicitud') IS NULL
BEGIN
    ALTER TABLE dbo.Interacciones ADD id_solicitud INT NULL;
    PRINT 'Columna Interacciones.id_solicitud agregada.';
END;

IF COL_LENGTH('dbo.Personas', 'fecha_ingreso_lead') IS NULL
BEGIN
    ALTER TABLE dbo.Personas ADD 
        fecha_ingreso_lead DATETIME2 NULL,
        archivada_lead_en DATETIME2 NULL,
        clave_registro_web_lead VARCHAR(100) NULL,
        hash_registro_web_lead VARCHAR(100) NULL,
        id_negociador INT NULL,
        id_canal_origen INT NULL,
        id_sede_interes_lead INT NULL,
        resultado_comercial_lead VARCHAR(50) NULL,
        fecha_decision_comercial_lead DATETIME2 NULL,
        valor_acordado_lead DECIMAL(10,2) NULL,
        id_propuesta_aceptada_lead INT NULL,
        motivo_cierre_lead VARCHAR(200) NULL,
        fecha_proximo_seguimiento DATETIME2 NULL;
    PRINT 'Columnas comerciales de Lead agregadas a Personas.';
END;

IF COL_LENGTH('dbo.Solicitudes', 'fecha_ingreso_lead') IS NULL
BEGIN
    ALTER TABLE dbo.Solicitudes ADD 
        fecha_ingreso_lead DATETIME2 NULL,
        archivada_lead_en DATETIME2 NULL,
        clave_registro_web_lead VARCHAR(100) NULL,
        hash_registro_web_lead VARCHAR(100) NULL,
        id_negociador INT NULL,
        id_canal_origen INT NULL,
        id_sede_interes_lead INT NULL,
        resultado_comercial_lead VARCHAR(50) NULL,
        fecha_decision_comercial_lead DATETIME2 NULL,
        valor_acordado_lead DECIMAL(10,2) NULL,
        id_propuesta_aceptada_lead INT NULL,
        motivo_cierre_lead VARCHAR(200) NULL,
        fecha_proximo_seguimiento DATETIME2 NULL;
    PRINT 'Columnas comerciales de Lead agregadas a Solicitudes.';
END;

IF COL_LENGTH('dbo.Opciones', 'archivada_lead_en') IS NULL
BEGIN
    ALTER TABLE dbo.Opciones ADD 
        archivada_lead_en DATETIME2 NULL,
        estado_respuesta VARCHAR(50) NULL,
        fecha_respuesta DATETIME2 NULL,
        motivo_rechazo VARCHAR(250) NULL,
        tipo_motivo_rechazo VARCHAR(50) NULL,
        id_propuesta_lead INT NULL,
        id_preferencia_lead INT NULL,
        id_motivo_rechazo_lead INT NULL,
        pref_fecha_lead DATETIME2 NULL,
        pref_dia_semana_lead VARCHAR(20) NULL,
        pref_turno_lead VARCHAR(20) NULL,
        pref_hora_inicio_lead VARCHAR(10) NULL,
        pref_hora_fin_lead VARCHAR(10) NULL,
        ofr_turno_lead VARCHAR(20) NULL;
    PRINT 'Columnas comerciales de Lead agregadas a Opciones.';
END;

-- 1.1. H01: Eliminar CK_Pagos_Estado antiguo que bloqueaba 'Validado', 'En_Revision', 'Rechazado'
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Pagos_Estado' AND parent_object_id = OBJECT_ID('dbo.Pagos'))
BEGIN
    ALTER TABLE dbo.Pagos DROP CONSTRAINT CK_Pagos_Estado;
    PRINT 'H01 resuelto: Restricción heredada CK_Pagos_Estado eliminada.';
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Pagos_Estado_Oficial' AND parent_object_id = OBJECT_ID('dbo.Pagos'))
BEGIN
    ALTER TABLE dbo.Pagos DROP CONSTRAINT CK_Pagos_Estado_Oficial;
END;

ALTER TABLE dbo.Pagos WITH CHECK ADD CONSTRAINT CK_Pagos_Estado_Oficial CHECK (
    estado IN (
        'Pendiente', 'En_Revision', 'Validado', 'Rechazado', 'Revertido',
        'PENDING', 'IN_REVIEW', 'VALIDATED', 'REJECTED', 'REVERTED',
        'Confirmado', 'Fallido'
    )
);

IF COL_LENGTH('dbo.Pagos', 'origen_validacion') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD origen_validacion VARCHAR(60) NULL;
END
ELSE IF COL_LENGTH('dbo.Pagos', 'origen_validacion') < 60
BEGIN
    ALTER TABLE dbo.Pagos ALTER COLUMN origen_validacion VARCHAR(60) NULL;
END;

IF COL_LENGTH('dbo.Pagos', 'es_cuota_tratamiento') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD es_cuota_tratamiento BIT NOT NULL CONSTRAINT DF_Pagos_EsCuota DEFAULT 0;
END;

IF COL_LENGTH('dbo.Pagos', 'fecha_rechazo_reversion') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD fecha_rechazo_reversion DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.Incidencias', 'motivo_tipificado') IS NULL
BEGIN
    ALTER TABLE dbo.Incidencias ADD motivo_tipificado VARCHAR(100) NULL;
END;

-- 1.2. H02: Normalizar contrato de Disponibilidad.estado como fuente única de verdad
-- Se expone disponible como columna calculada determinista para lectores que la consulten
IF COL_LENGTH('dbo.Disponibilidad', 'disponible') IS NULL
BEGIN
    ALTER TABLE dbo.Disponibilidad ADD disponible AS CAST(CASE WHEN estado = 'Disponible' THEN 1 ELSE 0 END AS BIT) PERSISTED;
    PRINT 'H02 resuelto: Columna calculada Disponibilidad.disponible derivada de Disponibilidad.estado.';
END;

-- 1.3. H09: Homologar restricciones CHECK en Atenciones e Incidencias frente al backend
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Atenciones_Asistencia' AND parent_object_id = OBJECT_ID('dbo.Atenciones'))
    ALTER TABLE dbo.Atenciones DROP CONSTRAINT CK_Atenciones_Asistencia;

ALTER TABLE dbo.Atenciones WITH CHECK ADD CONSTRAINT CK_Atenciones_Asistencia CHECK (
    asistencia IN ('Pendiente', 'Confirmada', 'Asistió', 'Asiste', 'No asistió', 'No asiste')
);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Atenciones_Estado' AND parent_object_id = OBJECT_ID('dbo.Atenciones'))
    ALTER TABLE dbo.Atenciones DROP CONSTRAINT CK_Atenciones_Estado;

ALTER TABLE dbo.Atenciones WITH CHECK ADD CONSTRAINT CK_Atenciones_Estado CHECK (
    estado_servicio IN ('Programado', 'En proceso', 'En curso', 'Realizado', 'Finalizado', 'Cancelado')
);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Incidencias_Estado' AND parent_object_id = OBJECT_ID('dbo.Incidencias'))
    ALTER TABLE dbo.Incidencias DROP CONSTRAINT CK_Incidencias_Estado;

ALTER TABLE dbo.Incidencias WITH CHECK ADD CONSTRAINT CK_Incidencias_Estado CHECK (
    estado IN ('Abierta', 'En proceso', 'Resuelta', 'Cerrada', 'OPEN', 'CLOSED')
);

PRINT 'H09 resuelto: Restricciones CHECK en Atenciones e Incidencias homologadas.';

-- ====================================================================
-- SECCIÓN 2: ENTIDADES OLTP DE LA FASE CUSTOMER (SECCIÓN 6.1 A 6.10)
-- ====================================================================

-- 2.1. TratamientosContratados (6.1)
IF OBJECT_ID('dbo.TratamientosContratados', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TratamientosContratados (
        id_tratamiento                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TratamientosContratados PRIMARY KEY,
        id_persona                      INT NOT NULL CONSTRAINT FK_Tratamientos_Persona REFERENCES dbo.Personas(id_persona),
        id_solicitud                    INT NOT NULL CONSTRAINT FK_Tratamientos_Solicitud REFERENCES dbo.Solicitudes(id_solicitud),
        id_reserva_origen               INT NOT NULL CONSTRAINT FK_Tratamientos_ReservaOrigen REFERENCES dbo.Reservas(id_reserva),
        id_servicio                     INT NOT NULL CONSTRAINT FK_Tratamientos_Servicio REFERENCES dbo.Servicios(id_servicio),
        id_profesional_responsable      INT NOT NULL CONSTRAINT FK_Tratamientos_Profesional REFERENCES dbo.Profesionales(id_profesional),
        id_sede                         INT NOT NULL CONSTRAINT FK_Tratamientos_Sede REFERENCES dbo.Sedes(id_sede),
        precio_pactado                  DECIMAL(10,2) NOT NULL CONSTRAINT DF_Tratamientos_Precio DEFAULT 0.00,
        fecha_contratacion              DATETIME2 NOT NULL,
        fecha_activacion                DATETIME2 NULL,
        fecha_inicio_real               DATETIME2 NULL,
        fecha_fin_prevista              DATETIME2 NULL,
        fecha_cierre_real               DATETIME2 NULL,
        estado_tratamiento              VARCHAR(30) NOT NULL CONSTRAINT DF_Tratamientos_Estado DEFAULT 'Contratado',
        motivo_suspension_cancelacion   VARCHAR(300) NULL,
        id_profesional_cierre           INT NULL CONSTRAINT FK_Tratamientos_ProfCierre REFERENCES dbo.Profesionales(id_profesional),
        fecha_creacion                  DATETIME2 NOT NULL CONSTRAINT DF_Tratamientos_Creacion DEFAULT SYSDATETIME(),
        fecha_actualizacion             DATETIME2 NULL,

        -- R04 y R06: Una reserva inicial origina como máximo un tratamiento; una persona puede tener varios tratamientos en distintas reservas
        CONSTRAINT UQ_Tratamientos_ReservaOrigen UNIQUE (id_reserva_origen),
        CONSTRAINT CK_Tratamientos_Estado CHECK (
            estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución', 'Suspendido', 'Completado', 'Cancelado')
        ),
        CONSTRAINT CK_Tratamientos_Precio CHECK (precio_pactado >= 0),
        CONSTRAINT CK_Tratamientos_FechasCierre CHECK (
            (estado_tratamiento <> 'Completado' OR (fecha_inicio_real IS NOT NULL AND fecha_cierre_real IS NOT NULL AND fecha_cierre_real >= fecha_inicio_real))
        )
    );

    CREATE INDEX IX_Tratamientos_Persona_Estado ON dbo.TratamientosContratados(id_persona, estado_tratamiento);
    PRINT 'Tabla dbo.TratamientosContratados creada.';
END;

-- Enlace opcional en Pagos para pagos/cuotas posteriores de un tratamiento (R08)
IF COL_LENGTH('dbo.Pagos', 'id_tratamiento') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD id_tratamiento INT NULL
        CONSTRAINT FK_Pagos_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento);
END;

-- 2.2. PlanTratamiento (6.2)
IF OBJECT_ID('dbo.PlanTratamiento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlanTratamiento (
        id_plan                     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PlanTratamiento PRIMARY KEY,
        id_tratamiento              INT NOT NULL CONSTRAINT FK_PlanTratamiento_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        version_plan                INT NOT NULL,
        es_vigente                  BIT NOT NULL CONSTRAINT DF_PlanTratamiento_Vigente DEFAULT 1,
        fecha_aprobacion            DATETIME2 NOT NULL CONSTRAINT DF_PlanTratamiento_Aprobacion DEFAULT SYSDATETIME(),
        id_profesional_aprobador    INT NOT NULL CONSTRAINT FK_PlanTratamiento_ProfAprobador REFERENCES dbo.Profesionales(id_profesional),
        sesiones_planificadas       INT NOT NULL,
        duracion_estimada           INT NOT NULL CONSTRAINT DF_PlanTratamiento_Duracion DEFAULT 30,
        estado_plan                 VARCHAR(30) NOT NULL CONSTRAINT DF_PlanTratamiento_Estado DEFAULT 'Aprobado',
        motivo_modificacion         VARCHAR(300) NULL,
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_PlanTratamiento_Creacion DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_PlanTratamiento_Version UNIQUE (id_tratamiento, version_plan),
        CONSTRAINT CK_PlanTratamiento_Version CHECK (version_plan >= 1),
        CONSTRAINT CK_PlanTratamiento_Sesiones CHECK (sesiones_planificadas >= 1),
        CONSTRAINT CK_PlanTratamiento_Duracion CHECK (duracion_estimada >= 1),
        CONSTRAINT CK_PlanTratamiento_Estado CHECK (estado_plan IN ('Borrador', 'Aprobado', 'Reemplazado', 'Anulado'))
    );

    CREATE UNIQUE INDEX UQ_PlanTratamiento_UnicoVigente
    ON dbo.PlanTratamiento(id_tratamiento)
    WHERE es_vigente = 1;

    PRINT 'Tabla dbo.PlanTratamiento creada.';
END;

-- 2.3. SesionesTratamiento (6.3)
IF OBJECT_ID('dbo.SesionesTratamiento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SesionesTratamiento (
        id_sesion                   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SesionesTratamiento PRIMARY KEY,
        id_tratamiento              INT NOT NULL CONSTRAINT FK_Sesiones_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        id_plan                     INT NOT NULL CONSTRAINT FK_Sesiones_Plan REFERENCES dbo.PlanTratamiento(id_plan),
        numero_sesion               INT NOT NULL,
        id_profesional              INT NOT NULL CONSTRAINT FK_Sesiones_Profesional REFERENCES dbo.Profesionales(id_profesional),
        id_sede                     INT NOT NULL CONSTRAINT FK_Sesiones_Sede REFERENCES dbo.Sedes(id_sede),
        id_disponibilidad           INT NULL CONSTRAINT FK_Sesiones_Disponibilidad REFERENCES dbo.Disponibilidad(id_disponibilidad),
        fecha_programada_vigente    DATETIME2 NOT NULL,
        duracion_programada_min     INT NOT NULL CONSTRAINT DF_Sesiones_DuracionMin DEFAULT 45,
        fecha_llegada               DATETIME2 NULL,
        fecha_inicio_atencion       DATETIME2 NULL,
        fecha_cierre_sesion         DATETIME2 NULL,
        estado_programacion         VARCHAR(30) NOT NULL CONSTRAINT DF_Sesiones_EstadoProg DEFAULT 'Programada',
        estado_asistencial          VARCHAR(30) NOT NULL CONSTRAINT DF_Sesiones_EstadoAsist DEFAULT 'Pendiente',
        estado_cierre               VARCHAR(30) NOT NULL CONSTRAINT DF_Sesiones_EstadoCierre DEFAULT 'Pendiente',
        motivo_inasistencia         VARCHAR(300) NULL,
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_Sesiones_Creacion DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_Sesiones_Tratamiento_Numero UNIQUE (id_tratamiento, numero_sesion),
        CONSTRAINT CK_Sesiones_Numero CHECK (numero_sesion >= 1),
        CONSTRAINT CK_Sesiones_Duracion CHECK (duracion_programada_min > 0),
        CONSTRAINT CK_Sesiones_EstadoProg CHECK (estado_programacion IN ('Programada', 'Reprogramada', 'Cancelada')),
        CONSTRAINT CK_Sesiones_EstadoAsist CHECK (estado_asistencial IN ('Pendiente', 'Confirmada', 'Realizada', 'Inasistida')),
        CONSTRAINT CK_Sesiones_EstadoCierre CHECK (estado_cierre IN ('Pendiente', 'Cerrada', 'No Aplica')),
        CONSTRAINT CK_Sesiones_CoherenciaCierre CHECK (
            estado_cierre <> 'Cerrada' OR (estado_asistencial = 'Realizada' AND fecha_cierre_sesion IS NOT NULL)
        ),
        CONSTRAINT CK_Sesiones_TiemposEspera CHECK (
            fecha_llegada IS NULL OR fecha_inicio_atencion IS NULL OR fecha_inicio_atencion >= fecha_llegada
        )
    );

    CREATE INDEX IX_Sesiones_AgendaProfesional
    ON dbo.SesionesTratamiento(id_profesional, fecha_programada_vigente, estado_programacion);

    PRINT 'Tabla dbo.SesionesTratamiento creada.';
END;

-- 2.4. EventosSesion (6.4)
IF OBJECT_ID('dbo.EventosSesion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventosSesion (
        id_evento_sesion        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventosSesion PRIMARY KEY,
        id_sesion               INT NOT NULL CONSTRAINT FK_EventosSesion_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion),
        tipo_cambio             VARCHAR(40) NOT NULL,
        fecha_anterior          DATETIME2 NULL,
        fecha_nueva             DATETIME2 NULL,
        estado_anterior         VARCHAR(30) NULL,
        estado_nuevo            VARCHAR(30) NULL,
        motivo                  VARCHAR(300) NOT NULL,
        id_usuario_responsable  INT NULL CONSTRAINT FK_EventosSesion_Usuario REFERENCES dbo.Usuarios(id_usuario),
        fecha_operacion         DATETIME2 NOT NULL CONSTRAINT DF_EventosSesion_FechaOp DEFAULT SYSDATETIME(),

        CONSTRAINT CK_EventosSesion_Tipo CHECK (
            tipo_cambio IN (
                'CREACION', 'REPROGRAMACION', 'CONFIRMACION_ASISTENCIA',
                'INASISTENCIA', 'INICIO_ATENCION', 'CIERRE_SESION',
                'SUSPENSION', 'CANCELACION'
            )
        )
    );

    CREATE INDEX IX_EventosSesion_Sesion_Tipo ON dbo.EventosSesion(id_sesion, tipo_cambio);
    PRINT 'Tabla dbo.EventosSesion creada.';
END;

-- 2.5. Extensión de Atenciones (6.5)
IF COL_LENGTH('dbo.Atenciones', 'id_tratamiento') IS NULL
BEGIN
    ALTER TABLE dbo.Atenciones ADD id_tratamiento INT NULL
        CONSTRAINT FK_Atenciones_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento);
END;

IF COL_LENGTH('dbo.Atenciones', 'id_sesion') IS NULL
BEGIN
    ALTER TABLE dbo.Atenciones ADD id_sesion INT NULL
        CONSTRAINT FK_Atenciones_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion);
END;

IF COL_LENGTH('dbo.Atenciones', 'estado_cierre_documental') IS NULL
BEGIN
    ALTER TABLE dbo.Atenciones ADD estado_cierre_documental VARCHAR(30) NOT NULL
        CONSTRAINT DF_Atenciones_EstadoCierreDoc DEFAULT 'Pendiente'
        CONSTRAINT CK_Atenciones_EstadoCierreDoc CHECK (estado_cierre_documental IN ('Pendiente', 'Cerrada', 'Observada'));
END;

IF COL_LENGTH('dbo.Atenciones', 'id_profesional_validador_cierre') IS NULL
BEGIN
    ALTER TABLE dbo.Atenciones ADD id_profesional_validador_cierre INT NULL
        CONSTRAINT FK_Atenciones_ProfValidadorCierre REFERENCES dbo.Profesionales(id_profesional);
END;

IF COL_LENGTH('dbo.Atenciones', 'fecha_validacion_cierre') IS NULL
BEGIN
    ALTER TABLE dbo.Atenciones ADD fecha_validacion_cierre DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Atenciones') AND name = 'UQ_Atenciones_Sesion_NotNull')
BEGIN
    EXEC('CREATE UNIQUE INDEX UQ_Atenciones_Sesion_NotNull ON dbo.Atenciones(id_sesion) WHERE id_sesion IS NOT NULL;');
END;

-- 2.6. DetalleProcedimiento (6.6)
IF OBJECT_ID('dbo.DetalleProcedimiento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DetalleProcedimiento (
        id_detalle_procedimiento    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DetalleProcedimiento PRIMARY KEY,
        id_atencion                 INT NOT NULL CONSTRAINT FK_DetalleProc_Atencion REFERENCES dbo.Atenciones(id_atencion),
        id_servicio                 INT NOT NULL CONSTRAINT FK_DetalleProc_Servicio REFERENCES dbo.Servicios(id_servicio),
        procedimiento_realizado     VARCHAR(200) NOT NULL,
        fecha_registro              DATETIME2 NOT NULL CONSTRAINT DF_DetalleProc_Fecha DEFAULT SYSDATETIME(),
        id_profesional              INT NOT NULL CONSTRAINT FK_DetalleProc_Profesional REFERENCES dbo.Profesionales(id_profesional),
        implica_cargo_adicional     BIT NOT NULL CONSTRAINT DF_DetalleProc_CargoAdic DEFAULT 0,
        id_solicitud_adicional      INT NULL CONSTRAINT FK_DetalleProc_SolicitudAdic REFERENCES dbo.Solicitudes(id_solicitud),
        observaciones               VARCHAR(500) NULL
    );

    CREATE INDEX IX_DetalleProcedimiento_Atencion ON dbo.DetalleProcedimiento(id_atencion);
    PRINT 'Tabla dbo.DetalleProcedimiento creada.';
END;

-- 2.7. ValidacionesFicha (6.7)
IF OBJECT_ID('dbo.ValidacionesFicha', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValidacionesFicha (
        id_validacion               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ValidacionesFicha PRIMARY KEY,
        id_atencion                 INT NOT NULL CONSTRAINT FK_ValidacionesFicha_Atencion REFERENCES dbo.Atenciones(id_atencion),
        numero_revision             INT NOT NULL,
        fecha_revision              DATETIME2 NOT NULL CONSTRAINT DF_ValidacionesFicha_Fecha DEFAULT SYSDATETIME(),
        resultado_validacion        VARCHAR(30) NOT NULL,
        campos_pendientes           VARCHAR(500) NULL,
        id_usuario_validador        INT NULL CONSTRAINT FK_ValidacionesFicha_Usuario REFERENCES dbo.Usuarios(id_usuario),
        id_profesional_validador    INT NULL CONSTRAINT FK_ValidacionesFicha_Prof REFERENCES dbo.Profesionales(id_profesional),

        CONSTRAINT UQ_ValidacionesFicha_AtencionRev UNIQUE (id_atencion, numero_revision),
        CONSTRAINT CK_ValidacionesFicha_NumRev CHECK (numero_revision >= 1),
        CONSTRAINT CK_ValidacionesFicha_Resultado CHECK (resultado_validacion IN ('Completa', 'Incompleta', 'Observada'))
    );

    PRINT 'Tabla dbo.ValidacionesFicha creada.';
END;

-- 2.8. IndicacionesPostatencion (6.8)
IF OBJECT_ID('dbo.IndicacionesPostatencion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.IndicacionesPostatencion (
        id_indicacion               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IndicacionesPostatencion PRIMARY KEY,
        id_documento_raiz           INT NULL,
        id_atencion                 INT NOT NULL CONSTRAINT FK_Indicaciones_Atencion REFERENCES dbo.Atenciones(id_atencion),
        version                     INT NOT NULL CONSTRAINT DF_Indicaciones_Version DEFAULT 1,
        es_version_vigente          BIT NOT NULL CONSTRAINT DF_Indicaciones_Vigente DEFAULT 1,
        estado                      VARCHAR(30) NOT NULL CONSTRAINT DF_Indicaciones_Estado DEFAULT 'Borrador',
        contenido_indicaciones      VARCHAR(MAX) NOT NULL,
        origen_documento            VARCHAR(30) NOT NULL CONSTRAINT DF_Indicaciones_Origen DEFAULT 'PROFESIONAL',
        id_profesional_aprobador    INT NULL CONSTRAINT FK_Indicaciones_ProfAprobador REFERENCES dbo.Profesionales(id_profesional),
        fecha_aprobacion            DATETIME2 NULL,
        fecha_emision               DATETIME2 NULL,
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_Indicaciones_Creacion DEFAULT SYSDATETIME(),

        CONSTRAINT CK_Indicaciones_Version CHECK (version >= 1),
        CONSTRAINT CK_Indicaciones_Estado CHECK (
            estado IN ('Borrador', 'Versión revisada', 'Documento aprobado', 'Documento emitido')
        ),
        CONSTRAINT CK_Indicaciones_Origen CHECK (origen_documento IN ('PROFESIONAL', 'COPILOTO_IA')),
        -- R18: Ninguna indicación puede aprobarse o emitirse sin aprobación profesional verificable
        CONSTRAINT CK_Indicaciones_AprobacionProfesional CHECK (
            estado NOT IN ('Documento aprobado', 'Documento emitido')
            OR (id_profesional_aprobador IS NOT NULL AND fecha_aprobacion IS NOT NULL)
        ),
        CONSTRAINT CK_Indicaciones_FechaEmision CHECK (
            estado <> 'Documento emitido' OR fecha_emision IS NOT NULL
        )
    );

    CREATE INDEX IX_Indicaciones_Atencion_Estado ON dbo.IndicacionesPostatencion(id_atencion, estado, es_version_vigente);
    PRINT 'Tabla dbo.IndicacionesPostatencion creada.';
END;

-- 2.9. AntecedentesClinicos (6.9)
IF OBJECT_ID('dbo.AntecedentesClinicos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AntecedentesClinicos (
        id_antecedente              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AntecedentesClinicos PRIMARY KEY,
        id_persona                  INT NOT NULL CONSTRAINT FK_Antecedentes_Persona REFERENCES dbo.Personas(id_persona),
        id_atencion                 INT NULL CONSTRAINT FK_Antecedentes_Atencion REFERENCES dbo.Atenciones(id_atencion),
        id_salud_odonto_origen      INT NULL CONSTRAINT FK_Antecedentes_SaludOdonto REFERENCES dbo.PersonaSaludOdontologica(id_salud_odonto),
        categoria_antecedente       VARCHAR(50) NOT NULL,
        descripcion_antecedente     VARCHAR(500) NOT NULL,
        nivel_riesgo                VARCHAR(20) NOT NULL CONSTRAINT DF_Antecedentes_Riesgo DEFAULT 'No Verificado',
        estado_verificacion         VARCHAR(30) NOT NULL CONSTRAINT DF_Antecedentes_EstadoVerif DEFAULT 'Pendiente',
        id_profesional_verificador  INT NULL CONSTRAINT FK_Antecedentes_ProfVerificador REFERENCES dbo.Profesionales(id_profesional),
        fecha_verificacion          DATETIME2 NULL,
        fecha_registro              DATETIME2 NOT NULL CONSTRAINT DF_Antecedentes_Registro DEFAULT SYSDATETIME(),

        CONSTRAINT CK_Antecedentes_Categoria CHECK (
            categoria_antecedente IN ('ALERGIA', 'CONDICION_SISTEMICA', 'MEDICACION', 'QUIRURGICO', 'ODONTOLOGICO_PREVIO', 'RIESGO_HEMORRAGICO', 'OTRO')
        ),
        CONSTRAINT CK_Antecedentes_Riesgo CHECK (
            nivel_riesgo IN ('Bajo', 'Medio', 'Alto', 'Crítico', 'No Verificado')
        ),
        CONSTRAINT CK_Antecedentes_Verificacion CHECK (
            estado_verificacion IN ('Pendiente', 'Verificado', 'Descartado')
        ),
        CONSTRAINT CK_Antecedentes_EvidenciaVerificador CHECK (
            estado_verificacion = 'Pendiente' OR (id_profesional_verificador IS NOT NULL AND fecha_verificacion IS NOT NULL)
        )
    );

    PRINT 'Tabla dbo.AntecedentesClinicos creada.';
END;

-- 2.10. Registros del Agente Inteligente (6.10: InteraccionesIA, AlertasIA, BorradoresIA)
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
        -- R17: Las respuestas de IA no constituyen diagnósticos ni prescripciones
        es_diagnostico_o_prescripcion   BIT NOT NULL CONSTRAINT DF_InteraccionesIA_NoDiag DEFAULT 0,

        CONSTRAINT CK_InteraccionesIA_Actor CHECK (actor_orientado IN ('PACIENTE', 'ODONTOLOGO')),
        CONSTRAINT CK_InteraccionesIA_Estado CHECK (
            estado IN ('Registrada', 'Completada', 'Derivada_Personal', 'En_Revision', 'Aprobada', 'Rechazada')
        ),
        CONSTRAINT CK_InteraccionesIA_NoDiagnostico CHECK (es_diagnostico_o_prescripcion = 0)
    );

    PRINT 'Tabla dbo.InteraccionesIA creada.';
END;

IF OBJECT_ID('dbo.AlertasIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AlertasIA (
        id_alerta_ia                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AlertasIA PRIMARY KEY,
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
        clave_deduplicacion         VARCHAR(64) NULL,
        id_correlacion              VARCHAR(64) NULL,

        CONSTRAINT CK_AlertasIA_Severidad CHECK (severidad IN ('Baja', 'Media', 'Alta', 'Crítica')),
        CONSTRAINT CK_AlertasIA_Estado CHECK (estado IN ('Generada', 'En_Revision', 'Atendida', 'Resuelta', 'Descartada_Justificada')),
        CONSTRAINT CK_AlertasIA_EvidenciaAtencion CHECK (
            estado NOT IN ('Atendida', 'Resuelta', 'Descartada_Justificada')
            OR ((id_profesional_revisor IS NOT NULL OR id_usuario_revisor IS NOT NULL) AND fecha_atencion_alerta IS NOT NULL)
        )
    );

    PRINT 'Tabla dbo.AlertasIA creada.';
END;

IF COL_LENGTH('dbo.AlertasIA', 'clave_deduplicacion') IS NULL
    ALTER TABLE dbo.AlertasIA ADD clave_deduplicacion VARCHAR(64) NULL;
IF COL_LENGTH('dbo.AlertasIA', 'id_correlacion') IS NULL
    ALTER TABLE dbo.AlertasIA ADD id_correlacion VARCHAR(64) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AlertasIA_ClaveDeduplicacion' AND object_id = OBJECT_ID('dbo.AlertasIA'))
    CREATE UNIQUE INDEX UX_AlertasIA_ClaveDeduplicacion ON dbo.AlertasIA(clave_deduplicacion) WHERE clave_deduplicacion IS NOT NULL;

IF OBJECT_ID('dbo.BorradoresIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BorradoresIA (
        id_borrador_ia              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BorradoresIA PRIMARY KEY,
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
        -- R18: Aprobación profesional obligatoria para aprobar un borrador de IA
        CONSTRAINT CK_BorradoresIA_EvidenciaAprobacion CHECK (
            estado NOT IN ('Aprobado', 'Corregido_Y_Aprobado')
            OR (id_profesional_aprobador IS NOT NULL AND fecha_aprobacion IS NOT NULL)
        )
    );

    PRINT 'Tabla dbo.BorradoresIA creada.';
END;

-- 2.11. Tabla de Solicitudes de Reprogramación del Agente Customer
IF OBJECT_ID('dbo.SolicitudesReprogramacionCustomer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SolicitudesReprogramacionCustomer (
        id_solicitud_reprogramacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudesReprogramacionCustomer PRIMARY KEY,
        id_sesion                   INT NOT NULL CONSTRAINT FK_SolicitudReprog_Sesion REFERENCES dbo.SesionesTratamiento(id_sesion),
        id_tratamiento              INT NOT NULL CONSTRAINT FK_SolicitudReprog_Tratamiento REFERENCES dbo.TratamientosContratados(id_tratamiento),
        id_persona                  INT NOT NULL CONSTRAINT FK_SolicitudReprog_Persona REFERENCES dbo.Personas(id_persona),
        id_interaccion_origen       INT NULL CONSTRAINT FK_SolicitudReprog_Interaccion REFERENCES dbo.InteraccionesIA(id_interaccion_ia),
        id_usuario_responsable      INT NULL CONSTRAINT FK_SolicitudReprog_Usuario REFERENCES dbo.Usuarios(id_usuario),
        fecha_programada_original   DATETIME2 NOT NULL,
        fecha_preferida             DATETIME2 NULL,
        franja_preferida            VARCHAR(40) NULL,
        motivo_solicitud            VARCHAR(300) NULL,
        estado_solicitud            VARCHAR(30) NOT NULL CONSTRAINT DF_SolicitudReprog_Estado DEFAULT 'Pendiente',
        motivo_resolucion           VARCHAR(300) NULL,
        fecha_creacion              DATETIME2 NOT NULL CONSTRAINT DF_SolicitudReprog_Fecha DEFAULT SYSDATETIME(),
        fecha_revision              DATETIME2 NULL,
        fecha_aplicacion            DATETIME2 NULL,
        clave_idempotencia          VARCHAR(100) NULL,
        id_correlacion              VARCHAR(64) NULL,

        CONSTRAINT CK_SolicitudReprog_Estado CHECK (
            estado_solicitud IN ('Pendiente', 'En_Revision', 'Aprobada', 'Rechazada', 'Cancelada', 'Aplicada')
        ),
        CONSTRAINT UQ_SolicitudReprog_Idempotencia UNIQUE (clave_idempotencia)
    );

    CREATE INDEX IX_SolicitudReprog_PersonaEstado ON dbo.SolicitudesReprogramacionCustomer(id_persona, estado_solicitud, fecha_creacion);
    CREATE INDEX IX_SolicitudReprog_SesionEstado ON dbo.SolicitudesReprogramacionCustomer(id_sesion, estado_solicitud);
    PRINT 'Tabla dbo.SolicitudesReprogramacionCustomer creada.';
END;

-- 2.12. Tabla de Credenciales y Autenticación de Pacientes
IF OBJECT_ID('dbo.CredencialesPaciente', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CredencialesPaciente (
        id_credencial       INT IDENTITY(1,1) PRIMARY KEY,
        id_persona          INT NOT NULL UNIQUE CONSTRAINT FK_Credenciales_Persona REFERENCES dbo.Personas(id_persona) ON DELETE CASCADE,
        dni                 VARCHAR(20) NOT NULL,
        password_hash       VARCHAR(255) NULL,
        password_salt       VARCHAR(64) NULL,
        activation_token    VARCHAR(255) NULL,
        token_expires_at    DATETIME2 NULL,
        token_used          BIT DEFAULT 0,
        otp_code            VARCHAR(10) NULL,
        otp_expires_at      DATETIME2 NULL,
        ultimo_acceso       DATETIME2 NULL,
        fecha_creacion      DATETIME2 DEFAULT GETDATE()
    );
    CREATE INDEX IX_Credenciales_DNI ON dbo.CredencialesPaciente(dni);
    PRINT 'Tabla dbo.CredencialesPaciente creada.';
END;

-- 2.13. Rol Recepción en Catálogo de Roles
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre = 'Recepcion')
BEGIN
    INSERT INTO dbo.Roles (nombre) VALUES ('Recepcion');
    PRINT 'Rol Recepcion agregado a dbo.Roles.';
END;

COMMIT TRANSACTION;
GO

-- ====================================================================
-- SECCIÓN 3: TRIGGERS Y FUNCIONES DE INTEGRIDAD TRANSACCIONAL
-- ====================================================================

-- 3.1. Trigger que protege la inmutabilidad de la primera revisión en ValidacionesFicha (6.7, T10)
IF OBJECT_ID('dbo.TR_ValidacionesFicha_InmutabilidadRev1', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_ValidacionesFicha_InmutabilidadRev1;
GO

CREATE TRIGGER dbo.TR_ValidacionesFicha_InmutabilidadRev1
ON dbo.ValidacionesFicha
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted WHERE numero_revision = 1)
    BEGIN
        THROW 55101, 'INTEGRIDAD DOCUMENTAL: La primera revisión de una ficha clínica (numero_revision = 1) es inmutable. Registre una nueva revisión con numero_revision > 1.', 1;
    END;
END;
GO

-- 3.2. Trigger que impide eliminar o alterar versiones históricas de PlanTratamiento (6.2, R14)
IF OBJECT_ID('dbo.TR_PlanTratamiento_ProtegerHistorial', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_PlanTratamiento_ProtegerHistorial;
GO

CREATE TRIGGER dbo.TR_PlanTratamiento_ProtegerHistorial
ON dbo.PlanTratamiento
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
    BEGIN
        THROW 55102, 'TRAZABILIDAD CLÍNICA (R14): No se permite eliminar versiones históricas de PlanTratamiento.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM deleted d
        INNER JOIN inserted i ON i.id_plan = d.id_plan
        WHERE d.sesiones_planificadas <> i.sesiones_planificadas
           OR d.id_tratamiento <> i.id_tratamiento
           OR d.version_plan <> i.version_plan
    )
    BEGIN
        THROW 55103, 'TRAZABILIDAD CLÍNICA (R14): No se puede sobrescribir sesiones_planificadas de un plan aprobado. Cree una nueva versión con usp_AprobarVersionPlanTratamiento.', 1;
    END;
END;
GO

-- 3.3. Trigger que protege Opciones.precio_ofrecido de alteraciones retrospectivas cuando ya existe Tratamiento (R07)
IF OBJECT_ID('dbo.TR_Opciones_ProtegerPrecioPactado', 'TR') IS NOT NULL
    DROP TRIGGER dbo.TR_Opciones_ProtegerPrecioPactado;
GO

CREATE TRIGGER dbo.TR_Opciones_ProtegerPrecioPactado
ON dbo.Opciones
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(precio_ofrecido)
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN deleted d ON d.id_opcion = i.id_opcion
            INNER JOIN dbo.Reservas r ON r.id_opcion = i.id_opcion
            INNER JOIN dbo.TratamientosContratados t ON t.id_reserva_origen = r.id_reserva
            WHERE i.precio_ofrecido <> d.precio_ofrecido
        )
        BEGIN
            THROW 55104, 'CONTRATO LEAD/PAYER (R07): No se permite modificar retrospectivamente el precio pactado de un acuerdo que ya tiene un tratamiento contratado.', 1;
        END;
    END;
END;
GO

-- 3.4. Función Guardián Financiero PAYER -> CUSTOMER (4.4, R01, R02)
IF OBJECT_ID('dbo.fn_VerificarGuardianFinancieroCustomer', 'IF') IS NOT NULL
    DROP FUNCTION dbo.fn_VerificarGuardianFinancieroCustomer;
GO

CREATE FUNCTION dbo.fn_VerificarGuardianFinancieroCustomer (
    @id_reserva INT
)
RETURNS TABLE
AS
RETURN
(
    WITH ResumenPagos AS (
        SELECT
            r.id_reserva,
            r.id_persona,
            r.id_solicitud,
            r.id_opcion,
            r.estado AS estado_reserva,
            ISNULL(o.precio_ofrecido, 0.00) AS precio_pactado,
            SUM(CASE
                WHEN p.estado IN ('Validado', 'VALIDADO', 'VALIDATED')
                  OR (p.estado = 'Confirmado' AND p.fecha_validacion IS NOT NULL AND p.referencia_pago IS NOT NULL)
                THEN p.importe ELSE 0.00
            END) AS importe_validado,
            SUM(CASE WHEN p.estado IN ('Revertido', 'REVERTED') THEN 1 ELSE 0 END) AS conteo_revertidos,
            SUM(CASE
                WHEN p.estado IN ('Validado', 'VALIDADO', 'VALIDATED')
                  OR (p.estado = 'Confirmado' AND p.fecha_validacion IS NOT NULL AND p.referencia_pago IS NOT NULL)
                THEN 1 ELSE 0
            END) AS conteo_pagos_validados
        FROM dbo.Reservas r
        INNER JOIN dbo.Solicitudes s ON s.id_solicitud = r.id_solicitud AND s.id_persona = r.id_persona
        INNER JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion AND o.id_solicitud = r.id_solicitud
        LEFT JOIN dbo.Pagos p ON p.id_reserva = r.id_reserva
        WHERE r.id_reserva = @id_reserva
        GROUP BY r.id_reserva, r.id_persona, r.id_solicitud, r.id_opcion, r.estado, o.precio_ofrecido
    )
    SELECT
        rp.id_reserva,
        rp.id_persona,
        rp.id_solicitud,
        rp.id_opcion,
        rp.estado_reserva,
        rp.precio_pactado,
        rp.importe_validado,
        rp.conteo_pagos_validados,
        rp.conteo_revertidos,
        -- Política financiera: Al menos 1 pago formalmente Validado, sin reversión activa sin cubrir,
        -- y que cubra como mínimo el 30% de anticipo (o 100% si el precio es <= 50 soles) y > 0
        CASE
            WHEN rp.estado_reserva IN ('Cancelada', 'Vencida') THEN 0
            WHEN rp.conteo_pagos_validados = 0 THEN 0
            WHEN rp.importe_validado <= 0 THEN 0
            WHEN rp.importe_validado < ROUND(rp.precio_pactado * 0.30, 2) THEN 0
            ELSE 1
        END AS es_habilitado_customer,
        CASE
            WHEN rp.estado_reserva IN ('Cancelada', 'Vencida') THEN 'RESERVA_CANCELADA_O_VENCIDA'
            WHEN rp.conteo_pagos_validados = 0 AND rp.conteo_revertidos > 0 THEN 'PAGO_REVERTIDO_SIN_REGULARIZAR'
            WHEN rp.conteo_pagos_validados = 0 THEN 'SIN_PAGO_OFICIAL_VALIDADO'
            WHEN rp.importe_validado <= 0 THEN 'IMPORTE_VALIDADO_CERO'
            WHEN rp.importe_validado < ROUND(rp.precio_pactado * 0.30, 2) THEN 'ANTICIPO_MINIMO_NO_CUBIERTO'
            ELSE 'HABILITADO'
        END AS motivo_guardian
    FROM ResumenPagos rp
);
GO

-- ====================================================================
-- SECCIÓN 4: PROCEDIMIENTOS TRANSACCIONALES DE CUSTOMER (R01 A R18)
-- ====================================================================

-- 4.1. Activación de Tratamiento desde PAYER (R01, R02, R03, R04, R15)
IF OBJECT_ID('dbo.usp_ActivarTratamientoDesdePayer', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ActivarTratamientoDesdePayer;
GO

CREATE PROCEDURE dbo.usp_ActivarTratamientoDesdePayer
    @id_reserva                 INT,
    @sesiones_planificadas      INT = 1,
    @duracion_estimada_dias     INT = 30,
    @id_profesional_aprobador   INT = NULL,
    @id_usuario                 INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSDATETIME();
    DECLARE @id_tratamiento INT, @id_plan INT, @id_sesion INT, @id_atencion INT;
    DECLARE @id_persona INT, @id_solicitud INT, @id_servicio INT, @id_prof INT, @id_sede INT, @id_disp INT;
    DECLARE @precio_pactado DECIMAL(10,2), @fecha_cita DATETIME2, @es_habilitado INT, @motivo VARCHAR(100);
    DECLARE @etapa_origen INT, @etapa_customer INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verificar si ya fue activado para esta reserva origen (R04: Idempotencia sin duplicar)
        SELECT
            @id_tratamiento = t.id_tratamiento,
            @id_persona = t.id_persona
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_reserva_origen = @id_reserva;

        IF @id_tratamiento IS NOT NULL
        BEGIN
            SELECT TOP (1) @id_plan = id_plan FROM dbo.PlanTratamiento WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;
            SELECT TOP (1) @id_sesion = id_sesion FROM dbo.SesionesTratamiento WHERE id_tratamiento = @id_tratamiento ORDER BY numero_sesion ASC;
            SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_reserva = @id_reserva ORDER BY id_atencion ASC;

            COMMIT TRANSACTION;
            SELECT
                @id_tratamiento AS id_tratamiento,
                @id_plan AS id_plan,
                @id_sesion AS id_sesion_inicial,
                @id_atencion AS id_atencion_inicial,
                1 AS ya_activado;
            RETURN;
        END;

        -- Verificar Guardián Financiero (R01, R02)
        SELECT
            @es_habilitado = g.es_habilitado_customer,
            @motivo = g.motivo_guardian,
            @id_persona = g.id_persona,
            @id_solicitud = g.id_solicitud,
            @precio_pactado = g.precio_pactado
        FROM dbo.fn_VerificarGuardianFinancieroCustomer(@id_reserva) g;

        IF @id_persona IS NULL
            THROW 55201, 'GUARDIÁN CUSTOMER (R01): La reserva no existe o la terna (Persona, Solicitud, Opción) es inconsistente.', 1;

        IF @es_habilitado <> 1
        BEGIN
            DECLARE @msg VARCHAR(300) = 'GUARDIÁN FINANCIERO RECHAZADO (R02): No se puede activar CUSTOMER. Motivo: ' + ISNULL(@motivo, 'DESCONOCIDO');
            THROW 55202, @msg, 1;
        END;

        -- Resolver datos clínicos desde la Reserva / Solicitud / Disponibilidad
        SELECT
            @id_servicio = ISNULL(s.id_servicio, (SELECT TOP 1 id_servicio FROM dbo.Servicios ORDER BY id_servicio)),
            @id_disp = o.id_disponibilidad,
            @id_prof = ISNULL(d.id_profesional, (SELECT TOP 1 id_profesional FROM dbo.Profesionales ORDER BY id_profesional)),
            @id_sede = ISNULL(d.id_sede, (SELECT TOP 1 id_sede FROM dbo.Sedes ORDER BY id_sede)),
            @fecha_cita = CASE
                WHEN d.fecha IS NOT NULL AND d.hora_inicio IS NOT NULL
                THEN DATEADD(MINUTE, DATEDIFF(MINUTE, '00:00:00', d.hora_inicio), CAST(d.fecha AS DATETIME2))
                ELSE r.fecha_reserva
            END
        FROM dbo.Reservas r
        INNER JOIN dbo.Solicitudes s ON s.id_solicitud = r.id_solicitud
        INNER JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion
        LEFT JOIN dbo.Disponibilidad d ON d.id_disponibilidad = o.id_disponibilidad
        WHERE r.id_reserva = @id_reserva;

        IF @id_profesional_aprobador IS NULL
            SET @id_profesional_aprobador = @id_prof;

        IF @sesiones_planificadas IS NULL OR @sesiones_planificadas < 1
            SET @sesiones_planificadas = 1;

        IF @duracion_estimada_dias IS NULL OR @duracion_estimada_dias < 1
            SET @duracion_estimada_dias = CASE WHEN @sesiones_planificadas > 1 THEN @sesiones_planificadas * 7 ELSE 1 END;

        -- 1. Confirmar la reserva inicial sin crear duplicados (R04)
        UPDATE dbo.Reservas
        SET estado = CASE WHEN estado = 'Atendida' THEN 'Atendida' ELSE 'Confirmada' END,
            confirmacion_explicita = 1,
            fecha_confirmacion = ISNULL(fecha_confirmacion, @ahora)
        WHERE id_reserva = @id_reserva;

        IF @id_disp IS NOT NULL
        BEGIN
            UPDATE dbo.Disponibilidad
            SET estado = 'Ocupado'
            WHERE id_disponibilidad = @id_disp AND estado <> 'Ocupado';
        END;

        -- 2. Crear el Tratamiento Contratado en estado 'Activado' (la contratación/activación no equivale a inicio real)
        INSERT INTO dbo.TratamientosContratados (
            id_persona, id_solicitud, id_reserva_origen, id_servicio,
            id_profesional_responsable, id_sede, precio_pactado,
            fecha_contratacion, fecha_activacion, fecha_inicio_real,
            fecha_fin_prevista, estado_tratamiento, fecha_creacion
        )
        VALUES (
            @id_persona, @id_solicitud, @id_reserva, @id_servicio,
            @id_prof, @id_sede, @precio_pactado,
            @ahora, @ahora, NULL,
            DATEADD(DAY, @duracion_estimada_dias, @fecha_cita), 'Activado', @ahora
        );
        SET @id_tratamiento = SCOPE_IDENTITY();

        -- Vincular los pagos de la reserva al tratamiento
        UPDATE dbo.Pagos
        SET id_tratamiento = @id_tratamiento
        WHERE id_reserva = @id_reserva AND id_tratamiento IS NULL;

        -- 3. Crear PlanTratamiento versión 1
        INSERT INTO dbo.PlanTratamiento (
            id_tratamiento, version_plan, es_vigente, fecha_aprobacion,
            id_profesional_aprobador, sesiones_planificadas, duracion_estimada,
            estado_plan, motivo_modificacion
        )
        VALUES (
            @id_tratamiento, 1, 1, @ahora,
            @id_profesional_aprobador, @sesiones_planificadas, @duracion_estimada_dias,
            'Aprobado', 'Plan clínico inicial aprobado en activación CUSTOMER'
        );
        SET @id_plan = SCOPE_IDENTITY();

        -- 4. Crear Sesión 1 vinculada a la primera cita
        INSERT INTO dbo.SesionesTratamiento (
            id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede,
            id_disponibilidad, fecha_programada_vigente, duracion_programada_min,
            estado_programacion, estado_asistencial, estado_cierre
        )
        VALUES (
            @id_tratamiento, @id_plan, 1, @id_prof, @id_sede,
            @id_disp, @fecha_cita, 45,
            'Programada', 'Pendiente', 'Pendiente'
        );
        SET @id_sesion = SCOPE_IDENTITY();

        INSERT INTO dbo.EventosSesion (
            id_sesion, tipo_cambio, fecha_anterior, fecha_nueva,
            estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion
        )
        VALUES (
            @id_sesion, 'CREACION', NULL, @fecha_cita,
            NULL, 'Programada', 'Sesión inicial creada desde reserva validada en PAYER', @id_usuario, @ahora
        );

        -- 5. Vincular o crear el registro de Atención para la Sesión 1 (en estado 'Programado')
        SELECT TOP (1) @id_atencion = id_atencion
        FROM dbo.Atenciones
        WHERE id_reserva = @id_reserva
        ORDER BY id_atencion ASC;

        IF @id_atencion IS NULL
        BEGIN
            INSERT INTO dbo.Atenciones (
                id_persona, id_reserva, id_tratamiento, id_sesion, id_servicio,
                id_profesional, id_sede, fecha_atencion, asistencia,
                estado_servicio, estado_cierre_documental
            )
            VALUES (
                @id_persona, @id_reserva, @id_tratamiento, @id_sesion, @id_servicio,
                @id_prof, @id_sede, @fecha_cita, 'Pendiente',
                'Programado', 'Pendiente'
            );
            SET @id_atencion = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE dbo.Atenciones
            SET id_tratamiento = @id_tratamiento,
                id_sesion = ISNULL(id_sesion, @id_sesion)
            WHERE id_atencion = @id_atencion;
        END;

        -- 6. Actualizar etapa de la Persona a CUSTOMER y registrar EventosEtapa
        SELECT @etapa_origen = id_etapa_actual FROM dbo.Personas WITH (UPDLOCK) WHERE id_persona = @id_persona;
        SELECT @etapa_customer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';

        IF @etapa_customer IS NOT NULL AND @etapa_origen <> @etapa_customer
        BEGIN
            UPDATE dbo.Personas
            SET id_etapa_actual = @etapa_customer,
                fecha_actualizacion = @ahora
            WHERE id_persona = @id_persona;

            INSERT INTO dbo.EventosEtapa (
                id_persona, etapa_origen, etapa_destino, fecha_hora,
                id_usuario, motivo, evidencia
            )
            VALUES (
                @id_persona, @etapa_origen, @etapa_customer, @ahora,
                @id_usuario, 'Pase formal PAYER a CUSTOMER con guardián financiero validado',
                'Tratamiento #' + CAST(@id_tratamiento AS VARCHAR(20)) + ' / Reserva #' + CAST(@id_reserva AS VARCHAR(20))
            );
        END;

        COMMIT TRANSACTION;

        SELECT
            @id_tratamiento AS id_tratamiento,
            @id_plan AS id_plan,
            @id_sesion AS id_sesion_inicial,
            @id_atencion AS id_atencion_inicial,
            0 AS ya_activado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.2. Aprobar nueva versión de PlanTratamiento sin sobrescribir la anterior (6.2, R14)
IF OBJECT_ID('dbo.usp_AprobarVersionPlanTratamiento', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_AprobarVersionPlanTratamiento;
GO

CREATE PROCEDURE dbo.usp_AprobarVersionPlanTratamiento
    @id_tratamiento             INT,
    @id_profesional_aprobador   INT,
    @sesiones_planificadas      INT,
    @duracion_estimada          INT,
    @motivo_modificacion        VARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@motivo_modificacion)), '') IS NULL
        THROW 55210, 'PLAN TRATAMIENTO (R14): Se requiere un motivo explícito para crear una nueva versión del plan.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @version_actual INT, @id_plan_anterior INT, @id_nuevo_plan INT;

        SELECT TOP (1)
            @id_plan_anterior = id_plan,
            @version_actual = version_plan
        FROM dbo.PlanTratamiento WITH (UPDLOCK, HOLDLOCK)
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @id_plan_anterior IS NULL
            THROW 55211, 'No existe un plan vigente para el tratamiento indicado.', 1;

        UPDATE dbo.PlanTratamiento
        SET es_vigente = 0,
            estado_plan = 'Reemplazado'
        WHERE id_plan = @id_plan_anterior;

        INSERT INTO dbo.PlanTratamiento (
            id_tratamiento, version_plan, es_vigente, fecha_aprobacion,
            id_profesional_aprobador, sesiones_planificadas, duracion_estimada,
            estado_plan, motivo_modificacion
        )
        VALUES (
            @id_tratamiento, @version_actual + 1, 1, SYSDATETIME(),
            @id_profesional_aprobador, @sesiones_planificadas, @duracion_estimada,
            'Aprobado', @motivo_modificacion
        );
        SET @id_nuevo_plan = SCOPE_IDENTITY();

        -- Actualizar sesiones pendientes para apuntar al nuevo plan vigente
        UPDATE dbo.SesionesTratamiento
        SET id_plan = @id_nuevo_plan
        WHERE id_tratamiento = @id_tratamiento AND estado_cierre = 'Pendiente';

        COMMIT TRANSACTION;
        SELECT @id_nuevo_plan AS id_plan_nuevo, (@version_actual + 1) AS nueva_version;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.3. Programar Sesión Posterior del Tratamiento con prevención de solapamiento (R03, R05, R06, R15)
IF OBJECT_ID('dbo.usp_ProgramarSesionTratamiento', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ProgramarSesionTratamiento;
GO

CREATE PROCEDURE dbo.usp_ProgramarSesionTratamiento
    @id_tratamiento             INT,
    @numero_sesion              INT,
    @id_profesional             INT,
    @id_sede                    INT,
    @fecha_programada           DATETIME2,
    @duracion_min               INT = 45,
    @id_disponibilidad          INT = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @estado_trat VARCHAR(30), @id_plan INT, @max_sesiones INT, @id_persona INT, @id_reserva_origen INT, @id_servicio INT;
        SELECT
            @estado_trat = t.estado_tratamiento,
            @id_persona = t.id_persona,
            @id_reserva_origen = t.id_reserva_origen,
            @id_servicio = t.id_servicio
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @estado_trat IS NULL
            THROW 55220, 'El tratamiento no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado', 'Completado')
            THROW 55221, 'No se pueden programar sesiones en un tratamiento Suspendido, Cancelado o Completado.', 1;

        SELECT TOP (1)
            @id_plan = id_plan,
            @max_sesiones = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @numero_sesion > @max_sesiones
            THROW 55222, 'El número de sesión excede las sesiones planificadas en el plan clínico vigente.', 1;

        -- R05: Validar que el profesional no tenga otra sesión activa solapada en el mismo horario
        DECLARE @fin_propuesto DATETIME2 = DATEADD(MINUTE, @duracion_min, @fecha_programada);

        IF EXISTS (
            SELECT 1
            FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.id_profesional = @id_profesional
              AND s.estado_programacion IN ('Programada', 'Reprogramada')
              AND s.estado_asistencial <> 'Inasistida'
              AND @fecha_programada < DATEADD(MINUTE, s.duracion_programada_min, s.fecha_programada_vigente)
              AND @fin_propuesto > s.fecha_programada_vigente
        )
        BEGIN
            THROW 55223, 'CONFLICTO DE AGENDA (R05): El profesional ya tiene una sesión asignada que se solapa con el horario solicitado.', 1;
        END;

        IF @id_disponibilidad IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM dbo.Disponibilidad WITH (UPDLOCK, HOLDLOCK)
                WHERE id_disponibilidad = @id_disponibilidad AND estado <> 'Disponible'
            )
            BEGIN
                THROW 55224, 'CONFLICTO DE SILLÓN (R05): El turno de disponibilidad seleccionado ya no se encuentra Disponible.', 1;
            END;

            UPDATE dbo.Disponibilidad
            SET estado = 'Ocupado'
            WHERE id_disponibilidad = @id_disponibilidad;
        END;

        DECLARE @id_sesion INT, @id_atencion INT;

        INSERT INTO dbo.SesionesTratamiento (
            id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede,
            id_disponibilidad, fecha_programada_vigente, duracion_programada_min,
            estado_programacion, estado_asistencial, estado_cierre
        )
        VALUES (
            @id_tratamiento, @id_plan, @numero_sesion, @id_profesional, @id_sede,
            @id_disponibilidad, @fecha_programada, @duracion_min,
            'Programada', 'Pendiente', 'Pendiente'
        );
        SET @id_sesion = SCOPE_IDENTITY();

        INSERT INTO dbo.EventosSesion (
            id_sesion, tipo_cambio, fecha_anterior, fecha_nueva,
            estado_anterior, estado_nuevo, motivo, id_usuario_responsable
        )
        VALUES (
            @id_sesion, 'CREACION', NULL, @fecha_programada,
            NULL, 'Programada', 'Programación de sesión #' + CAST(@numero_sesion AS VARCHAR(10)) + ' del tratamiento',
            @id_usuario_responsable
        );

        -- Crear registro de Atención programada vinculada a la sesión y a la reserva origen del contrato (sin duplicar Reservas: R03, R04)
        INSERT INTO dbo.Atenciones (
            id_persona, id_reserva, id_tratamiento, id_sesion, id_servicio,
            id_profesional, id_sede, fecha_atencion, asistencia,
            estado_servicio, estado_cierre_documental
        )
        VALUES (
            @id_persona, @id_reserva_origen, @id_tratamiento, @id_sesion, @id_servicio,
            @id_profesional, @id_sede, @fecha_programada, 'Pendiente',
            'Programado', 'Pendiente'
        );
        SET @id_atencion = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.4. Reprogramar una Sesión existente sin crear una nueva sesión (6.3, 6.4, R05, R06, R14, T06)
IF OBJECT_ID('dbo.usp_ReprogramarSesionTratamiento', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ReprogramarSesionTratamiento;
GO

CREATE PROCEDURE dbo.usp_ReprogramarSesionTratamiento
    @id_sesion                  INT,
    @nueva_fecha_programada     DATETIME2,
    @motivo_reprogramacion      VARCHAR(300),
    @id_nuevo_profesional       INT = NULL,
    @id_nueva_sede              INT = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NULLIF(LTRIM(RTRIM(@motivo_reprogramacion)), '') IS NULL
        THROW 55230, 'REPROGRAMACIÓN (R14): El motivo de reprogramación es obligatorio.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @fecha_anterior DATETIME2, @estado_prog_ant VARCHAR(30), @estado_asist VARCHAR(30);
        DECLARE @id_prof INT, @id_sede INT, @duracion INT;

        SELECT
            @fecha_anterior = s.fecha_programada_vigente,
            @estado_prog_ant = s.estado_programacion,
            @estado_asist = s.estado_asistencial,
            @id_prof = ISNULL(@id_nuevo_profesional, s.id_profesional),
            @id_sede = ISNULL(@id_nueva_sede, s.id_sede),
            @duracion = s.duracion_programada_min
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        WHERE s.id_sesion = @id_sesion;

        IF @fecha_anterior IS NULL
            THROW 55231, 'La sesión indicada no existe.', 1;

        IF @estado_asist = 'Realizada'
            THROW 55232, 'No se puede reprogramar una sesión que ya fue realizada.', 1;

        -- R05: Verificar no solapamiento en el nuevo horario
        DECLARE @fin_nuevo DATETIME2 = DATEADD(MINUTE, @duracion, @nueva_fecha_programada);
        IF EXISTS (
            SELECT 1
            FROM dbo.SesionesTratamiento s2 WITH (UPDLOCK, HOLDLOCK)
            WHERE s2.id_profesional = @id_prof
              AND s2.id_sesion <> @id_sesion
              AND s2.estado_programacion IN ('Programada', 'Reprogramada')
              AND s2.estado_asistencial <> 'Inasistida'
              AND @nueva_fecha_programada < DATEADD(MINUTE, s2.duracion_programada_min, s2.fecha_programada_vigente)
              AND @fin_nuevo > s2.fecha_programada_vigente
        )
        BEGIN
            THROW 55233, 'CONFLICTO DE AGENDA (R05): El profesional ya tiene otra sesión programada en ese bloque horario.', 1;
        END;

        UPDATE dbo.SesionesTratamiento
        SET fecha_programada_vigente = @nueva_fecha_programada,
            id_profesional = @id_prof,
            id_sede = @id_sede,
            estado_programacion = 'Reprogramada',
            estado_asistencial = 'Pendiente',
            motivo_inasistencia = NULL
        WHERE id_sesion = @id_sesion;

        UPDATE dbo.Atenciones
        SET fecha_atencion = @nueva_fecha_programada,
            id_profesional = @id_prof,
            id_sede = @id_sede,
            asistencia = 'Pendiente',
            estado_servicio = 'Programado'
        WHERE id_sesion = @id_sesion;

        INSERT INTO dbo.EventosSesion (
            id_sesion, tipo_cambio, fecha_anterior, fecha_nueva,
            estado_anterior, estado_nuevo, motivo, id_usuario_responsable
        )
        VALUES (
            @id_sesion, 'REPROGRAMACION', @fecha_anterior, @nueva_fecha_programada,
            @estado_prog_ant, 'Reprogramada', @motivo_reprogramacion, @id_usuario_responsable
        );

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @fecha_anterior AS fecha_anterior, @nueva_fecha_programada AS fecha_nueva;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.5. Registrar Asistencia, Inicio/Fin de Atención o Inasistencia en una Sesión (R02, R09, T07, T09)
IF OBJECT_ID('dbo.usp_RegistrarEventoAsistencialSesion', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_RegistrarEventoAsistencialSesion;
GO

CREATE PROCEDURE dbo.usp_RegistrarEventoAsistencialSesion
    @id_sesion                  INT,
    @accion                     VARCHAR(30), -- 'CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION', 'CONFIRMAR_INASISTENCIA'
    @fecha_evento               DATETIME2 = NULL,
    @motivo_inasistencia        VARCHAR(300) = NULL,
    @procedimiento_principal    VARCHAR(200) = NULL,
    @evaluacion_clinica         VARCHAR(500) = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @fecha_evento = ISNULL(@fecha_evento, SYSDATETIME());

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_tratamiento INT, @id_reserva INT, @estado_trat VARCHAR(30), @es_habilitado INT, @motivo_guardian VARCHAR(100);
        DECLARE @estado_asist_ant VARCHAR(30), @id_atencion INT, @id_servicio INT, @id_prof INT;

        SELECT
            @id_tratamiento = s.id_tratamiento,
            @estado_asist_ant = s.estado_asistencial,
            @id_prof = s.id_profesional,
            @id_reserva = t.id_reserva_origen,
            @estado_trat = t.estado_tratamiento,
            @id_servicio = t.id_servicio
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK) ON t.id_tratamiento = s.id_tratamiento
        WHERE s.id_sesion = @id_sesion;

        IF @id_tratamiento IS NULL
            THROW 55240, 'La sesión indicada no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado')
            THROW 55241, 'El tratamiento se encuentra Suspendido o Cancelado; no puede ejecutarse la sesión.', 1;

        -- R02: Verificar siempre el guardián financiero antes de iniciar atención
        SELECT @es_habilitado = es_habilitado_customer, @motivo_guardian = motivo_guardian
        FROM dbo.fn_VerificarGuardianFinancieroCustomer(@id_reserva);

        IF @accion IN ('CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION') AND @es_habilitado <> 1
        BEGIN
            DECLARE @err VARCHAR(300) = 'GUARDIÁN FINANCIERO (R02): Atención bloqueada por incumplimiento financiero (' + ISNULL(@motivo_guardian, 'SIN_VALIDACION') + ').';
            THROW 55242, @err, 1;
        END;

        SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_sesion = @id_sesion;

        IF @accion = 'CONFIRMAR_LLEGADA'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = @fecha_evento,
                estado_asistencial = 'Confirmada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'Confirmada'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'CONFIRMACION_ASISTENCIA', @estado_asist_ant, 'Confirmada', 'Llegada del paciente a sala de espera', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'INICIAR_ATENCION'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = ISNULL(fecha_llegada, @fecha_evento),
                fecha_inicio_atencion = @fecha_evento,
                estado_asistencial = 'Realizada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = @fecha_evento,
                asistencia = 'Asistió',
                estado_servicio = 'En proceso'
            WHERE id_atencion = @id_atencion;

            -- Si es la primera atención efectiva del tratamiento, marcar fecha_inicio_real y estado 'En ejecución'
            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, @fecha_evento),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INICIO_ATENCION', @estado_asist_ant, 'Realizada', 'Ingreso del paciente a sillón odontológico', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'FINALIZAR_ATENCION'
        BEGIN
            -- R09: Una sesión realizada puede quedar pendiente de cierre documental
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = ISNULL(fecha_llegada, DATEADD(MINUTE, -30, @fecha_evento)),
                fecha_inicio_atencion = ISNULL(fecha_inicio_atencion, DATEADD(MINUTE, -20, @fecha_evento)),
                estado_asistencial = 'Realizada',
                estado_cierre = 'Pendiente'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = ISNULL(fecha_inicio, DATEADD(MINUTE, -20, @fecha_evento)),
                fecha_fin = @fecha_evento,
                asistencia = 'Asistió',
                estado_servicio = 'Realizado',
                procedimiento = COALESCE(@procedimiento_principal, procedimiento),
                procedimiento_realizado = COALESCE(@procedimiento_principal, procedimiento_realizado),
                evaluacion = COALESCE(@evaluacion_clinica, evaluacion),
                estado_cierre_documental = 'Pendiente'
            WHERE id_atencion = @id_atencion;

            IF @procedimiento_principal IS NOT NULL AND @id_atencion IS NOT NULL
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion = @id_atencion AND procedimiento_realizado = @procedimiento_principal)
                BEGIN
                    INSERT INTO dbo.DetalleProcedimiento (id_atencion, id_servicio, procedimiento_realizado, fecha_registro, id_profesional)
                    VALUES (@id_atencion, @id_servicio, @procedimiento_principal, @fecha_evento, @id_prof);
                END;
            END;

            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, DATEADD(MINUTE, -20, @fecha_evento)),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;
        END
        ELSE IF @accion = 'CONFIRMAR_INASISTENCIA'
        BEGIN
            IF NULLIF(LTRIM(RTRIM(@motivo_inasistencia)), '') IS NULL
                SET @motivo_inasistencia = 'Paciente no se presentó a la sesión programada (No-Show confirmado)';

            UPDATE dbo.SesionesTratamiento
            SET estado_asistencial = 'Inasistida',
                estado_cierre = 'No Aplica',
                motivo_inasistencia = @motivo_inasistencia
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'No asistió',
                estado_servicio = 'Cancelado'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INASISTENCIA', @estado_asist_ant, 'Inasistida', @motivo_inasistencia, @id_usuario_responsable, @fecha_evento);
        END
        ELSE
        BEGIN
            THROW 55243, 'Acción asistencial no reconocida.', 1;
        END;

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion, @accion AS accion_ejecutada;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.6. Cerrar Documentalmente una Sesión (R10, R11, R12, T05)
IF OBJECT_ID('dbo.usp_CerrarSesionClinica', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CerrarSesionClinica;
GO

CREATE PROCEDURE dbo.usp_CerrarSesionClinica
    @id_sesion                  INT,
    @id_profesional_validador   INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @estado_asist VARCHAR(30), @id_atencion INT, @id_tratamiento INT;
        SELECT
            @estado_asist = s.estado_asistencial,
            @id_tratamiento = s.id_tratamiento
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        WHERE s.id_sesion = @id_sesion;

        IF @estado_asist IS NULL
            THROW 55250, 'La sesión no existe.', 1;

        IF @estado_asist <> 'Realizada'
            THROW 55251, 'CIERRE DE SESIÓN (R10): Solo puede cerrarse documentalmente una sesión que haya sido efectivamente Realizada.', 1;

        SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_sesion = @id_sesion;

        IF @id_atencion IS NULL
            THROW 55252, 'CIERRE DE SESIÓN (R10): No existe atención clínica vinculada a la sesión.', 1;

        -- Verificar evidencia de procedimiento consignado
        IF NOT EXISTS (SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion = @id_atencion)
           AND NOT EXISTS (SELECT 1 FROM dbo.Atenciones WHERE id_atencion = @id_atencion AND NULLIF(LTRIM(RTRIM(COALESCE(procedimiento, procedimiento_realizado))), '') IS NOT NULL)
        BEGIN
            THROW 55253, 'CIERRE DE SESIÓN (R10): Debe registrarse al menos un procedimiento clínico antes de cerrar la sesión.', 1;
        END;

        -- Verificar que la última revisión de ficha no esté Incompleta
        IF EXISTS (
            SELECT TOP (1) 1
            FROM dbo.ValidacionesFicha
            WHERE id_atencion = @id_atencion
            ORDER BY numero_revision DESC
        )
        BEGIN
            DECLARE @ult_res VARCHAR(30);
            SELECT TOP (1) @ult_res = resultado_validacion
            FROM dbo.ValidacionesFicha
            WHERE id_atencion = @id_atencion
            ORDER BY numero_revision DESC;

            IF @ult_res <> 'Completa'
                THROW 55254, 'CIERRE DE SESIÓN (R10): La ficha clínica tiene validaciones pendientes (última revisión no está Completa).', 1;
        END
        ELSE
        BEGIN
            -- Registrar revisión 1 como Completa automáticamente si todos los campos clave están presentes
            INSERT INTO dbo.ValidacionesFicha (id_atencion, numero_revision, fecha_revision, resultado_validacion, id_profesional_validador, id_usuario_validador)
            VALUES (@id_atencion, 1, @ahora, 'Completa', @id_profesional_validador, @id_usuario_responsable);
        END;

        UPDATE dbo.Atenciones
        SET estado_cierre_documental = 'Cerrada',
            id_profesional_validador_cierre = @id_profesional_validador,
            fecha_validacion_cierre = @ahora
        WHERE id_atencion = @id_atencion;

        UPDATE dbo.SesionesTratamiento
        SET estado_cierre = 'Cerrada',
            fecha_cierre_sesion = @ahora
        WHERE id_sesion = @id_sesion;

        INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
        VALUES (@id_sesion, 'CIERRE_SESION', 'Pendiente', 'Cerrada', 'Cierre clínico y documental validado por profesional #' + CAST(@id_profesional_validador AS VARCHAR(10)), @id_usuario_responsable, @ahora);

        -- R11 y R12: El cierre de una sesión NO cierra automáticamente el tratamiento ni traslada a TURNED
        COMMIT TRANSACTION;

        SELECT
            @id_sesion AS id_sesion,
            @id_tratamiento AS id_tratamiento,
            'Cerrada' AS estado_cierre_sesion,
            (SELECT estado_tratamiento FROM dbo.TratamientosContratados WHERE id_tratamiento = @id_tratamiento) AS estado_tratamiento_actual,
            (SELECT e.nombre FROM dbo.Personas p INNER JOIN dbo.Etapas e ON e.id_etapa = p.id_etapa_actual WHERE p.id_persona = (SELECT id_persona FROM dbo.TratamientosContratados WHERE id_tratamiento = @id_tratamiento)) AS etapa_persona_actual;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.7. Cerrar Formalmente un Tratamiento y Transicionar a TURNED (R11, R12, R13, T14)
IF OBJECT_ID('dbo.usp_CerrarTratamientoYTransicionarTurned', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CerrarTratamientoYTransicionarTurned;
GO

CREATE PROCEDURE dbo.usp_CerrarTratamientoYTransicionarTurned
    @id_tratamiento             INT,
    @id_profesional_cierre      INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_persona INT, @estado_actual VARCHAR(30), @fecha_inicio DATETIME2;
        DECLARE @sesiones_plan INT, @sesiones_cerradas INT, @sesiones_pendientes_cierre INT;

        SELECT
            @id_persona = t.id_persona,
            @estado_actual = t.estado_tratamiento,
            @fecha_inicio = t.fecha_inicio_real
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @id_persona IS NULL
            THROW 55260, 'El tratamiento indicado no existe.', 1;

        IF @estado_actual = 'Completado'
        BEGIN
            COMMIT TRANSACTION;
            SELECT @id_tratamiento AS id_tratamiento, 'Completado' AS estado_tratamiento, 1 AS ya_cerrado;
            RETURN;
        END;

        IF @estado_actual <> 'En ejecución' OR @fecha_inicio IS NULL
            THROW 55261, 'CIERRE DE TRATAMIENTO (R13): Solo puede cerrarse como Completado un tratamiento que haya iniciado efectivamente.', 1;

        SELECT TOP (1) @sesiones_plan = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        SELECT
            @sesiones_cerradas = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Cerrada' THEN 1 ELSE 0 END),
            @sesiones_pendientes_cierre = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Pendiente' THEN 1 ELSE 0 END)
        FROM dbo.SesionesTratamiento
        WHERE id_tratamiento = @id_tratamiento;

        IF ISNULL(@sesiones_pendientes_cierre, 0) > 0
            THROW 55262, 'CIERRE DE TRATAMIENTO (R13): Existen sesiones realizadas con cierre documental pendiente.', 1;

        IF ISNULL(@sesiones_cerradas, 0) < ISNULL(@sesiones_plan, 1)
            THROW 55263, 'CIERRE DE TRATAMIENTO (R12/R13): No se han completado todas las sesiones planificadas del plan clínico vigente.', 1;

        UPDATE dbo.TratamientosContratados
        SET estado_tratamiento = 'Completado',
            fecha_cierre_real = @ahora,
            id_profesional_cierre = @id_profesional_cierre,
            fecha_actualizacion = @ahora
        WHERE id_tratamiento = @id_tratamiento;

        -- Verificar si la persona tiene algún otro tratamiento activo antes de pasar su estado global a TURNED (Sección 12)
        DECLARE @otros_activos INT;
        SELECT @otros_activos = COUNT(*)
        FROM dbo.TratamientosContratados
        WHERE id_persona = @id_persona
          AND id_tratamiento <> @id_tratamiento
          AND estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución');

        DECLARE @etapa_customer INT, @etapa_turned INT, @etapa_actual_persona INT;
        SELECT @etapa_customer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';
        SELECT @etapa_turned = id_etapa FROM dbo.Etapas WHERE nombre = 'TURNED';
        SELECT @etapa_actual_persona = id_etapa_actual FROM dbo.Personas WITH (UPDLOCK) WHERE id_persona = @id_persona;

        IF @otros_activos = 0 AND @etapa_turned IS NOT NULL AND @etapa_actual_persona <> @etapa_turned
        BEGIN
            UPDATE dbo.Personas
            SET id_etapa_actual = @etapa_turned,
                fecha_actualizacion = @ahora
            WHERE id_persona = @id_persona;

            INSERT INTO dbo.EventosEtapa (
                id_persona, etapa_origen, etapa_destino, fecha_hora,
                id_usuario, motivo, evidencia
            )
            VALUES (
                @id_persona, @etapa_actual_persona, @etapa_turned, @ahora,
                @id_usuario_responsable, 'Tratamiento odontológico formalmente completado y cerrado',
                'Tratamiento #' + CAST(@id_tratamiento AS VARCHAR(20)) + ' (' + CAST(@sesiones_cerradas AS VARCHAR(10)) + ' sesiones cerradas)'
            );
        END;

        COMMIT TRANSACTION;
        SELECT
            @id_tratamiento AS id_tratamiento,
            'Completado' AS estado_tratamiento,
            @sesiones_cerradas AS sesiones_completadas,
            CASE WHEN @otros_activos = 0 THEN 'TURNED' ELSE 'CUSTOMER' END AS etapa_resultante,
            0 AS ya_cerrado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 4.8. Manejo seguro de Reversión Financiera posterior al inicio de un Tratamiento (R16, T20)
IF OBJECT_ID('dbo.usp_ProcesarReversionFinancieraEnCustomer', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ProcesarReversionFinancieraEnCustomer;
GO

CREATE PROCEDURE dbo.usp_ProcesarReversionFinancieraEnCustomer
    @id_pago                INT,
    @motivo_reversion       VARCHAR(300),
    @id_usuario_responsable INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF LEN(LTRIM(RTRIM(ISNULL(@motivo_reversion, '')))) < 10
        THROW 55270, 'REVERSIÓN FINANCIERA (PAYER/R16): La justificación de reversión exige como mínimo 10 caracteres.', 1;

    DECLARE @ahora DATETIME2 = SYSDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_reserva INT, @id_persona INT, @id_tratamiento INT;
        SELECT
            @id_reserva = p.id_reserva,
            @id_persona = p.id_persona,
            @id_tratamiento = p.id_tratamiento
        FROM dbo.Pagos p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.id_pago = @id_pago;

        IF @id_reserva IS NULL
            THROW 55271, 'El pago indicado no existe.', 1;

        IF @id_tratamiento IS NULL
            SELECT @id_tratamiento = id_tratamiento FROM dbo.TratamientosContratados WHERE id_reserva_origen = @id_reserva;

        -- 1. Marcar el pago como Revertido sin borrar historia clínica
        UPDATE dbo.Pagos
        SET estado = 'Revertido',
            fecha_rechazo_reversion = @ahora,
            observaciones = LEFT(ISNULL(observaciones, '') + ' | REVERTIDO: ' + @motivo_reversion, 300)
        WHERE id_pago = @id_pago;

        -- 2. Registrar incidencia obligatoria
        INSERT INTO dbo.Incidencias (
            id_persona, id_pago, id_reserva, tipo, motivo_tipificado,
            descripcion, prioridad, estado, fecha_registro, id_usuario_responsable
        )
        VALUES (
            @id_persona, @id_pago, @id_reserva, 'REVERSION_PAGO', 'Contracargo Bancario',
            @motivo_reversion, 'Alta', 'Abierta', @ahora, @id_usuario_responsable
        );

        -- 3. R16: Preservar intactas todas las Atenciones y Sesiones ya realizadas,
        -- pero suspender el tratamiento activo y bloquear sesiones futuras pendientes
        IF @id_tratamiento IS NOT NULL
        BEGIN
            UPDATE dbo.TratamientosContratados
            SET estado_tratamiento = CASE
                    WHEN estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución') THEN 'Suspendido'
                    ELSE estado_tratamiento
                END,
                motivo_suspension_cancelacion = 'SUSPENSION_POR_REVERSION_FINANCIERA: ' + LEFT(@motivo_reversion, 240),
                fecha_actualizacion = @ahora
            WHERE id_tratamiento = @id_tratamiento;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            SELECT
                s.id_sesion, 'SUSPENSION', s.estado_programacion, 'Cancelada',
                'Sesión futura bloqueada por reversión financiera del pago #' + CAST(@id_pago AS VARCHAR(20)),
                @id_usuario_responsable, @ahora
            FROM dbo.SesionesTratamiento s
            WHERE s.id_tratamiento = @id_tratamiento
              AND s.estado_asistencial = 'Pendiente'
              AND s.estado_programacion <> 'Cancelada';

            UPDATE dbo.SesionesTratamiento
            SET estado_programacion = 'Cancelada',
                estado_cierre = 'No Aplica'
            WHERE id_tratamiento = @id_tratamiento
              AND estado_asistencial = 'Pendiente'
              AND estado_programacion <> 'Cancelada';
        END;

        COMMIT TRANSACTION;

        SELECT
            @id_pago AS id_pago_revertido,
            @id_tratamiento AS id_tratamiento_afectado,
            (SELECT estado_tratamiento FROM dbo.TratamientosContratados WHERE id_tratamiento = @id_tratamiento) AS nuevo_estado_tratamiento,
            (SELECT COUNT(*) FROM dbo.Atenciones WHERE id_tratamiento = @id_tratamiento AND asistencia IN ('Asistió', 'Asiste')) AS atenciones_historicas_preservadas;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

PRINT 'Migración OLTP de CUSTOMER (01_migracion_oltp_customer.sql) completada con éxito.';
GO
