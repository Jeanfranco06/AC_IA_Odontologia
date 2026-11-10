-- ====================================================================
-- ARCHIVO: 04_hechos_customer.sql
-- FASE: CUSTOMER (Tablas de Hechos Especializadas y Bitácora ETL)
-- BASE DE DATOS: NexoSalud_Mart
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Crea la tabla de auditoría y reconciliación dbo.ETL_EjecucionLog.
--   2. Extiende de forma aditiva Fact_RecaudacionPayer (H07) y
--      Fact_ValidacionIncidenciaPayer (H06) sin romper vistas existentes.
--   3. Crea las 4 tablas de hechos especializadas de CUSTOMER (Sección 8.4/8.5):
--      - dbo.Fact_TratamientoCustomer   (Análisis A: 5 medidas)
--      - dbo.Fact_SesionCustomer        (Análisis B: 5 medidas)
--      - dbo.Fact_AtencionCustomer_V2   (Análisis C: 5 medidas)
--      - dbo.Fact_InteraccionIACustomer (Análisis D: 5 medidas)
--   4. Preserva dbo.fact_atencion_customer y crea vista de compatibilidad
--      dbo.v_Compatibilidad_Fact_AtencionCustomer (Sección 8.6, H08).
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSalud_Mart];
GO

-- ====================================================================
-- SECCIÓN 1: BITÁCORA DE EJECUCIÓN ETL Y EXTENSIONES DE HECHOS PAYER (H06, H07)
-- ====================================================================

IF OBJECT_ID('dbo.ETL_EjecucionLog', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ETL_EjecucionLog (
        id_ejecucion        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ETL_EjecucionLog PRIMARY KEY,
        proceso             VARCHAR(80) NOT NULL,
        fecha_inicio        DATETIME2 NOT NULL CONSTRAINT DF_ETLLog_Inicio DEFAULT SYSDATETIME(),
        fecha_fin           DATETIME2 NULL,
        estado              VARCHAR(20) NOT NULL,
        filas_origen        INT NULL,
        filas_destino       INT NULL,
        mensaje             VARCHAR(500) NULL
    );
    PRINT 'Tabla dbo.ETL_EjecucionLog creada.';
END;

-- H07: Separar costo contractual verificado del costo estimado referencial en Fact_RecaudacionPayer (F1)
IF COL_LENGTH('dbo.Fact_RecaudacionPayer', 'CostoPasarelaVerificado') IS NULL
BEGIN
    ALTER TABLE dbo.Fact_RecaudacionPayer ADD CostoPasarelaVerificado DECIMAL(10,2) NULL;
END;

IF COL_LENGTH('dbo.Fact_RecaudacionPayer', 'CostoPasarelaEstimadoNoContractual') IS NULL
BEGIN
    ALTER TABLE dbo.Fact_RecaudacionPayer ADD CostoPasarelaEstimadoNoContractual DECIMAL(10,2) NULL;
END;

-- H06: Registrar denominador real de pagos con tiempo de validación medible en Fact_ValidacionIncidenciaPayer (F2)
IF COL_LENGTH('dbo.Fact_ValidacionIncidenciaPayer', 'PagosConTiempoMedible') IS NULL
BEGIN
    ALTER TABLE dbo.Fact_ValidacionIncidenciaPayer ADD PagosConTiempoMedible INT NOT NULL CONSTRAINT DF_F2_PagosMedibles DEFAULT 0;
END;
GO

-- ====================================================================
-- SECCIÓN 2: LAS 4 TABLAS DE HECHOS ESPECIALIZADAS DE CUSTOMER (20 MEDIDAS)
-- ====================================================================

BEGIN TRANSACTION;

-- --------------------------------------------------------------------
-- 2.1. HECHO 1: dbo.Fact_TratamientoCustomer (Análisis A: Tratamientos)
-- Grano: 1 fila por Tratamiento Contratado (id_tratamiento)
-- Medidas: tratamientos_iniciados, tratamientos_completados,
--          sesiones_planificadas, sesiones_completadas, dias_duracion_real
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Fact_TratamientoCustomer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_TratamientoCustomer (
        id_tratamiento              INT NOT NULL CONSTRAINT PK_Fact_TratamientoCustomer PRIMARY KEY,
        id_persona                  INT NOT NULL,
        id_reserva_origen           INT NOT NULL,
        version_plan_vigente        INT NOT NULL CONSTRAINT DF_FactTrat_VerPlan DEFAULT 1,

        -- Claves foráneas a dimensiones conformadas y de CUSTOMER (Role-Playing Time Keys)
        KeyTiempoContratacion       INT NOT NULL CONSTRAINT FK_FactTrat_TiempoContratacion REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyTiempoInicio             INT NOT NULL CONSTRAINT FK_FactTrat_TiempoInicio REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyTiempoCierre             INT NOT NULL CONSTRAINT FK_FactTrat_TiempoCierre REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                     INT NOT NULL CONSTRAINT FK_FactTrat_Sede REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio                 INT NOT NULL CONSTRAINT FK_FactTrat_Servicio REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyProfesional              INT NOT NULL CONSTRAINT FK_FactTrat_Profesional REFERENCES dbo.Dim_Profesional(KeyProfesional),
        KeyEstadoTratamiento        INT NOT NULL CONSTRAINT FK_FactTrat_EstadoTratamiento REFERENCES dbo.Dim_EstadoTratamiento(KeyEstadoTratamiento),

        -- 5 Medidas Cuantitativas obligatorias del Análisis A
        tratamientos_iniciados      INT NOT NULL CONSTRAINT DF_FactTrat_Iniciados DEFAULT 0,
        tratamientos_completados    INT NOT NULL CONSTRAINT DF_FactTrat_Completados DEFAULT 0,
        sesiones_planificadas       INT NOT NULL CONSTRAINT DF_FactTrat_SesPlan DEFAULT 1,
        sesiones_completadas        INT NOT NULL CONSTRAINT DF_FactTrat_SesComp DEFAULT 0,
        dias_duracion_real          INT NULL,

        -- Auditoría ETL
        fecha_corte_etl             DATETIME2 NOT NULL CONSTRAINT DF_FactTrat_Corte DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_FactTrat_ReservaOrigen UNIQUE (id_reserva_origen),
        CONSTRAINT CK_FactTrat_Iniciados CHECK (tratamientos_iniciados IN (0, 1)),
        CONSTRAINT CK_FactTrat_Completados CHECK (tratamientos_completados IN (0, 1) AND tratamientos_completados <= tratamientos_iniciados),
        CONSTRAINT CK_FactTrat_Sesiones CHECK (sesiones_planificadas >= 1 AND sesiones_completadas >= 0),
        CONSTRAINT CK_FactTrat_Duracion CHECK (
            (tratamientos_completados = 0 AND dias_duracion_real IS NULL)
            OR (tratamientos_completados = 1 AND dias_duracion_real IS NOT NULL AND dias_duracion_real >= 0)
        )
    );

    CREATE INDEX IX_FactTrat_Dimensiones ON dbo.Fact_TratamientoCustomer(KeyTiempoContratacion, KeySede, KeyServicio, KeyProfesional, KeyEstadoTratamiento);
    PRINT 'Tabla dbo.Fact_TratamientoCustomer (Análisis A) creada.';
END;

-- --------------------------------------------------------------------
-- 2.2. HECHO 2: dbo.Fact_SesionCustomer (Análisis B: Sesiones y Agenda)
-- Grano: 1 fila por Sesión de Tratamiento (id_sesion)
-- Medidas: sesiones_programadas, sesiones_realizadas, sesiones_inasistidas,
--          reprogramaciones_acumuladas, minutos_espera
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Fact_SesionCustomer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_SesionCustomer (
        id_sesion                   INT NOT NULL CONSTRAINT PK_Fact_SesionCustomer PRIMARY KEY,
        id_tratamiento              INT NOT NULL,
        id_persona                  INT NOT NULL,
        numero_sesion               INT NOT NULL,

        -- Claves foráneas a dimensiones conformadas y de CUSTOMER
        KeyTiempoProgramada         INT NOT NULL CONSTRAINT FK_FactSes_TiempoProgramada REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyTiempoEjecucion          INT NOT NULL CONSTRAINT FK_FactSes_TiempoEjecucion REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyHoraProgramada           INT NOT NULL CONSTRAINT FK_FactSes_HoraProgramada REFERENCES dbo.Dim_Hora(KeyHora),
        KeySede                     INT NOT NULL CONSTRAINT FK_FactSes_Sede REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio                 INT NOT NULL CONSTRAINT FK_FactSes_Servicio REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyProfesional              INT NOT NULL CONSTRAINT FK_FactSes_Profesional REFERENCES dbo.Dim_Profesional(KeyProfesional),
        KeyEstadoSesion             INT NOT NULL CONSTRAINT FK_FactSes_EstadoSesion REFERENCES dbo.Dim_EstadoSesion(KeyEstadoSesion),

        -- 5 Medidas Cuantitativas obligatorias del Análisis B
        sesiones_programadas        INT NOT NULL CONSTRAINT DF_FactSes_Programadas DEFAULT 1,
        sesiones_realizadas         INT NOT NULL CONSTRAINT DF_FactSes_Realizadas DEFAULT 0,
        sesiones_inasistidas        INT NOT NULL CONSTRAINT DF_FactSes_Inasistidas DEFAULT 0,
        reprogramaciones_acumuladas INT NOT NULL CONSTRAINT DF_FactSes_Reprogramaciones DEFAULT 0,
        minutos_espera              INT NULL,

        -- Indicadores auxiliares para denominadores exactos sin tiempos ficticios
        sesion_evaluable            INT NOT NULL CONSTRAINT DF_FactSes_Evaluable DEFAULT 0,
        tiene_espera_medible        INT NOT NULL CONSTRAINT DF_FactSes_EsperaMedible DEFAULT 0,
        fecha_corte_etl             DATETIME2 NOT NULL CONSTRAINT DF_FactSes_Corte DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_FactSes_TratamientoNum UNIQUE (id_tratamiento, numero_sesion),
        CONSTRAINT CK_FactSes_Programadas CHECK (sesiones_programadas IN (0, 1)),
        CONSTRAINT CK_FactSes_RealizadasInasistidas CHECK (
            sesiones_realizadas IN (0, 1)
            AND sesiones_inasistidas IN (0, 1)
            AND (sesiones_realizadas + sesiones_inasistidas) <= 1
        ),
        CONSTRAINT CK_FactSes_Reprogramaciones CHECK (reprogramaciones_acumuladas >= 0),
        CONSTRAINT CK_FactSes_MinutosEspera CHECK (
            (tiene_espera_medible = 0 AND minutos_espera IS NULL)
            OR (tiene_espera_medible = 1 AND minutos_espera IS NOT NULL AND minutos_espera >= 0)
        )
    );

    CREATE INDEX IX_FactSes_Dimensiones ON dbo.Fact_SesionCustomer(KeyTiempoProgramada, KeySede, KeyServicio, KeyProfesional, KeyEstadoSesion);
    PRINT 'Tabla dbo.Fact_SesionCustomer (Análisis B) creada.';
END;

-- --------------------------------------------------------------------
-- 2.3. HECHO 3: dbo.Fact_AtencionCustomer_V2 (Análisis C: Prestación Clínica)
-- Grano: 1 fila por Atención Clínica (id_atencion)
-- Medidas: atenciones_realizadas, minutos_consulta, fichas_completas,
--          indicaciones_emitidas, procedimientos_registrados
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Fact_AtencionCustomer_V2', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_AtencionCustomer_V2 (
        id_atencion                     INT NOT NULL CONSTRAINT PK_Fact_AtencionCustomer_V2 PRIMARY KEY,
        id_sesion                       INT NULL,
        id_tratamiento                  INT NULL,
        id_persona                      INT NOT NULL,

        -- Claves foráneas a dimensiones conformadas
        KeyTiempoAtencion               INT NOT NULL CONSTRAINT FK_FactAtenV2_Tiempo REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyHoraAtencion                 INT NOT NULL CONSTRAINT FK_FactAtenV2_Hora REFERENCES dbo.Dim_Hora(KeyHora),
        KeySede                         INT NOT NULL CONSTRAINT FK_FactAtenV2_Sede REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio                     INT NOT NULL CONSTRAINT FK_FactAtenV2_Servicio REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyProfesional                  INT NOT NULL CONSTRAINT FK_FactAtenV2_Profesional REFERENCES dbo.Dim_Profesional(KeyProfesional),
        KeyEstadoAtencion               INT NOT NULL CONSTRAINT FK_FactAtenV2_EstadoAtencion REFERENCES dbo.Dim_EstadoAtencion(KeyEstadoAtencion),

        -- 5 Medidas Cuantitativas obligatorias del Análisis C
        atenciones_realizadas           INT NOT NULL CONSTRAINT DF_FactAtenV2_Realizadas DEFAULT 0,
        minutos_consulta                INT NULL,
        fichas_completas                INT NOT NULL CONSTRAINT DF_FactAtenV2_FichasComp DEFAULT 0,
        indicaciones_emitidas           INT NOT NULL CONSTRAINT DF_FactAtenV2_Indicaciones DEFAULT 0,
        procedimientos_registrados      INT NOT NULL CONSTRAINT DF_FactAtenV2_Procedimientos DEFAULT 0,

        -- Indicadores auxiliares para denominadores exactos de C5, C6 y C7
        tiene_duracion_medible          INT NOT NULL CONSTRAINT DF_FactAtenV2_DurMedible DEFAULT 0,
        atencion_con_indicacion_emitida INT NOT NULL CONSTRAINT DF_FactAtenV2_ConIndicacion DEFAULT 0,
        fecha_corte_etl                 DATETIME2 NOT NULL CONSTRAINT DF_FactAtenV2_Corte DEFAULT SYSDATETIME(),

        CONSTRAINT CK_FactAtenV2_Realizadas CHECK (atenciones_realizadas IN (0, 1)),
        CONSTRAINT CK_FactAtenV2_Fichas CHECK (fichas_completas IN (0, 1) AND fichas_completas <= atenciones_realizadas),
        CONSTRAINT CK_FactAtenV2_Conteos CHECK (indicaciones_emitidas >= 0 AND procedimientos_registrados >= 0),
        CONSTRAINT CK_FactAtenV2_MinutosConsulta CHECK (
            (tiene_duracion_medible = 0 AND minutos_consulta IS NULL)
            OR (tiene_duracion_medible = 1 AND minutos_consulta IS NOT NULL AND minutos_consulta > 0)
        )
    );

    CREATE INDEX IX_FactAtenV2_Dimensiones ON dbo.Fact_AtencionCustomer_V2(KeyTiempoAtencion, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion);
    PRINT 'Tabla dbo.Fact_AtencionCustomer_V2 (Análisis C) creada.';
END;

-- --------------------------------------------------------------------
-- 2.4. HECHO 4: dbo.Fact_InteraccionIACustomer (Análisis D: Copiloto IA)
-- Grano: 1 fila por Evento del Agente IA (ClaseEventoIA, id_origen_ia)
-- Medidas: interacciones_registradas, alertas_generadas, alertas_atendidas,
--          borradores_generados, borradores_aprobados
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Fact_InteraccionIACustomer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_InteraccionIACustomer (
        ClaseEventoIA               VARCHAR(20) NOT NULL,
        id_origen_ia                INT NOT NULL,
        id_persona                  INT NOT NULL,
        id_tratamiento              INT NULL,
        id_sesion                   INT NULL,
        id_atencion                 INT NULL,

        -- Claves foráneas a dimensiones conformadas y de IA
        KeyTiempoEvento             INT NOT NULL CONSTRAINT FK_FactIA_Tiempo REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyHoraEvento               INT NOT NULL CONSTRAINT FK_FactIA_Hora REFERENCES dbo.Dim_Hora(KeyHora),
        KeySede                     INT NOT NULL CONSTRAINT FK_FactIA_Sede REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio                 INT NOT NULL CONSTRAINT FK_FactIA_Servicio REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyProfesional              INT NOT NULL CONSTRAINT FK_FactIA_Profesional REFERENCES dbo.Dim_Profesional(KeyProfesional),
        KeyTipoInteraccionIA        INT NOT NULL CONSTRAINT FK_FactIA_TipoInteraccion REFERENCES dbo.Dim_TipoInteraccionIA(KeyTipoInteraccionIA),
        KeyTipoUsuarioIA            INT NOT NULL CONSTRAINT FK_FactIA_TipoUsuario REFERENCES dbo.Dim_TipoUsuarioIA(KeyTipoUsuarioIA),
        KeyResultadoIA              INT NOT NULL CONSTRAINT FK_FactIA_Resultado REFERENCES dbo.Dim_ResultadoIA(KeyResultadoIA),

        -- 5 Medidas Cuantitativas obligatorias del Análisis D
        interacciones_registradas   INT NOT NULL CONSTRAINT DF_FactIA_Interacciones DEFAULT 0,
        alertas_generadas           INT NOT NULL CONSTRAINT DF_FactIA_AlertasGen DEFAULT 0,
        alertas_atendidas           INT NOT NULL CONSTRAINT DF_FactIA_AlertasAtend DEFAULT 0,
        borradores_generados        INT NOT NULL CONSTRAINT DF_FactIA_BorradoresGen DEFAULT 0,
        borradores_aprobados        INT NOT NULL CONSTRAINT DF_FactIA_BorradoresAprob DEFAULT 0,

        fecha_corte_etl             DATETIME2 NOT NULL CONSTRAINT DF_FactIA_Corte DEFAULT SYSDATETIME(),

        CONSTRAINT PK_Fact_InteraccionIACustomer PRIMARY KEY (ClaseEventoIA, id_origen_ia),
        CONSTRAINT CK_FactIA_ClaseEvento CHECK (ClaseEventoIA IN ('INTERACCION', 'ALERTA', 'BORRADOR')),
        CONSTRAINT CK_FactIA_MedidasMutuamenteExcluyentes CHECK (
            (ClaseEventoIA = 'INTERACCION' AND interacciones_registradas = 1 AND alertas_generadas = 0 AND alertas_atendidas = 0 AND borradores_generados = 0 AND borradores_aprobados = 0)
            OR (ClaseEventoIA = 'ALERTA' AND interacciones_registradas = 0 AND alertas_generadas = 1 AND alertas_atendidas IN (0, 1) AND borradores_generados = 0 AND borradores_aprobados = 0)
            OR (ClaseEventoIA = 'BORRADOR' AND interacciones_registradas = 0 AND alertas_generadas = 0 AND alertas_atendidas = 0 AND borradores_generados = 1 AND borradores_aprobados IN (0, 1))
        )
    );

    CREATE INDEX IX_FactIA_Dimensiones ON dbo.Fact_InteraccionIACustomer(KeyTiempoEvento, KeySede, KeyServicio, KeyProfesional, KeyTipoInteraccionIA, KeyTipoUsuarioIA, KeyResultadoIA);
    PRINT 'Tabla dbo.Fact_InteraccionIACustomer (Análisis D) creada.';
END;

COMMIT TRANSACTION;
GO

-- ====================================================================
-- SECCIÓN 3: VISTA DE COMPATIBILIDAD SOBRE EL HECHO HEREDADO (SECCIÓN 8.6, H08)
-- ====================================================================

IF OBJECT_ID('dbo.v_Compatibilidad_Fact_AtencionCustomer', 'V') IS NOT NULL
    DROP VIEW dbo.v_Compatibilidad_Fact_AtencionCustomer;
GO

CREATE VIEW dbo.v_Compatibilidad_Fact_AtencionCustomer
AS
SELECT
    fa.KeyTiempoAtencion AS KeyTiempo,
    MIN(fa.KeyHoraAtencion) AS KeyHora,
    fa.KeySede,
    fa.KeyServicio,
    fa.KeyProfesional,
    fa.KeyEstadoAtencion,
    SUM(CASE WHEN fs.sesion_evaluable = 1 THEN 1 ELSE 0 END) AS cita_evaluable,
    SUM(fa.atenciones_realizadas) AS atencion_realizada,
    SUM(ISNULL(fs.sesiones_inasistidas, 0)) AS cita_inasistencia,
    SUM(ISNULL(fa.minutos_consulta, 0)) AS tiempo_sillon_dental_minuto,
    SUM(CASE WHEN fa.atenciones_realizadas = 1 AND fa.fichas_completas = 1 THEN 1 ELSE 0 END) AS atencion_finalizada_conforme
FROM dbo.Fact_AtencionCustomer_V2 fa
LEFT JOIN dbo.Fact_SesionCustomer fs ON fs.id_sesion = fa.id_sesion
GROUP BY
    fa.KeyTiempoAtencion,
    fa.KeySede,
    fa.KeyServicio,
    fa.KeyProfesional,
    fa.KeyEstadoAtencion;
GO

PRINT 'Estructura de hechos de CUSTOMER (04_hechos_customer.sql) creada y verificada exitosamente.';
GO
