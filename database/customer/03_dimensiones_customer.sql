-- ====================================================================
-- ARCHIVO: 03_dimensiones_customer.sql
-- FASE: CUSTOMER (Dimensiones Conformadas y Nuevas Dimensiones de CUSTOMER)
-- BASE DE DATOS: NexoSalud_Mart
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Inserta miembros desconocidos explícitos (Key = 0) en todas las
--      dimensiones conformadas y de PAYER para resolver H04.
--   2. Extiende Dim_Pasarela con EstadoTasa y TasaComisionContractual NULL
--      para resolver H07 (prohibición de presentar tasa supuesta como real).
--   3. Normaliza Dim_Cobro y Dim_EstadoAtencion con claves naturales.
--   4. Crea y puebla las 5 dimensiones especializadas de CUSTOMER:
--      - dbo.Dim_EstadoTratamiento
--      - dbo.Dim_EstadoSesion
--      - dbo.Dim_TipoInteraccionIA
--      - dbo.Dim_TipoUsuarioIA
--      - dbo.Dim_ResultadoIA
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSalud_Mart];
GO

-- Extensión previa de columnas en dimensiones existentes (requiere lote propio antes de DML)
IF COL_LENGTH('dbo.Dim_Pasarela', 'TasaComisionContractual') IS NULL
BEGIN
    ALTER TABLE dbo.Dim_Pasarela ADD TasaComisionContractual DECIMAL(6,4) NULL;
END;

IF COL_LENGTH('dbo.Dim_Pasarela', 'EstadoTasa') IS NULL
BEGIN
    ALTER TABLE dbo.Dim_Pasarela ADD EstadoTasa VARCHAR(30) NOT NULL CONSTRAINT DF_DimPasarela_EstadoTasa DEFAULT 'SIN_CONTRATO_VERIFICADO';
END;

IF COL_LENGTH('dbo.Dim_EstadoAtencion', 'EstadoCierreDocumental') IS NULL
BEGIN
    ALTER TABLE dbo.Dim_EstadoAtencion ADD EstadoCierreDocumental VARCHAR(30) NULL;
END;
GO

BEGIN TRANSACTION;

-- ====================================================================
-- SECCIÓN 1: MIEMBROS DESCONOCIDOS EXPLÍCITOS (KEY = 0) EN DIMENSIONES EXISTENTES (H04)
-- ====================================================================

-- 1.1. Dim_Tiempo (KeyTiempo = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = 0)
BEGIN
    INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
    VALUES (0, '1900-01-01', 1900, 1, 1, 1);
END;

-- Asegurar calendario de Dim_Tiempo para 2025, 2026 y 2027 (incluyendo sesiones futuras programadas)
;WITH Numeros AS (
    SELECT TOP (1461) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
),
Fechas AS (
    SELECT DATEADD(DAY, n, CAST('2024-01-01' AS DATE)) AS fecha
    FROM Numeros
)
INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
SELECT
    YEAR(f.fecha) * 10000 + MONTH(f.fecha) * 100 + DAY(f.fecha) AS KeyTiempo,
    f.fecha AS id_fecha,
    YEAR(f.fecha) AS Anio,
    DATEPART(QUARTER, f.fecha) AS Trimestre,
    MONTH(f.fecha) AS Mes,
    DAY(f.fecha) AS Dia
FROM Fechas f
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Tiempo dt WHERE dt.id_fecha = f.fecha
);

-- 1.2. Dim_Hora (KeyHora = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Hora WHERE KeyHora = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Hora ON;
    INSERT INTO dbo.Dim_Hora (KeyHora, id_hora, Turno, Hora, Minuto)
    VALUES (0, -1, 'DESCONOCIDO', -1, -1);
    SET IDENTITY_INSERT dbo.Dim_Hora OFF;
END;

-- Asegurar las 24 horas del día (0..23) en Dim_Hora para cruce por DATEPART(HOUR, ...)
;WITH Horas AS (
    SELECT TOP (24) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS h
    FROM sys.all_objects
)
INSERT INTO dbo.Dim_Hora (id_hora, Turno, Hora, Minuto)
SELECT
    h.h AS id_hora,
    CASE
        WHEN h.h BETWEEN 6 AND 11 THEN 'Mañana'
        WHEN h.h BETWEEN 12 AND 17 THEN 'Tarde'
        ELSE 'Noche'
    END AS Turno,
    h.h AS Hora,
    0 AS Minuto
FROM Horas h
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Hora dh WHERE dh.Hora = h.h AND dh.KeyHora > 0
);

-- 1.3. Dim_Sede (KeySede = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede WHERE KeySede = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Sede ON;
    INSERT INTO dbo.Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
    VALUES (0, -1, 'DESCONOCIDO', 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_Sede OFF;
END;

-- 1.4. Dim_Servicio (KeyServicio = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Servicio ON;
    INSERT INTO dbo.Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (0, -1, 'DESCONOCIDO', 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_Servicio OFF;
END;

-- 1.5. Dim_Profesional (KeyProfesional = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Profesional WHERE KeyProfesional = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Profesional ON;
    INSERT INTO dbo.Dim_Profesional (KeyProfesional, id_profesional, Odontologo, EspecialidadPrincipal)
    VALUES (0, -1, 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_Profesional OFF;
END;

-- 1.6. Dim_Pasarela (KeyPasarela = 0) y extensión H07 (TasaComisionContractual)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Pasarela WHERE KeyPasarela = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Pasarela ON;
    INSERT INTO dbo.Dim_Pasarela (KeyPasarela, MetodoPago, EntidadFinanciera, TipoMedio, TasaComisionContractual, EstadoTasa)
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO', 'DESCONOCIDO', NULL, 'SIN_CONTRATO_VERIFICADO');
    SET IDENTITY_INSERT dbo.Dim_Pasarela OFF;
END;

-- 1.7. Dim_Cobro (KeyCobro = 0 y homologación de estados oficiales e históricos para H04)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Cobro WHERE KeyCobro = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Cobro ON;
    INSERT INTO dbo.Dim_Cobro (KeyCobro, EstadoPago, ComprobanteAdjunto)
    VALUES (0, 'DESCONOCIDO', 'No');
    SET IDENTITY_INSERT dbo.Dim_Cobro OFF;
END;

-- Asegurar miembros explícitos por clave natural EstadoPago en Dim_Cobro
;WITH EstadosCobroCanónicos AS (
    SELECT 'Validado' AS EstadoPago, 'Sí' AS ComprobanteAdjunto UNION ALL
    SELECT 'Confirmado', 'No' UNION ALL
    SELECT 'Pendiente', 'No' UNION ALL
    SELECT 'En_Revision', 'Sí' UNION ALL
    SELECT 'Rechazado', 'Sí' UNION ALL
    SELECT 'Fallido', 'No' UNION ALL
    SELECT 'Revertido', 'Sí'
)
INSERT INTO dbo.Dim_Cobro (EstadoPago, ComprobanteAdjunto)
SELECT e.EstadoPago, e.ComprobanteAdjunto
FROM EstadosCobroCanónicos e
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_Cobro dc WHERE dc.EstadoPago = e.EstadoPago
);

-- 1.8. Dim_Incidencia (KeyIncidencia = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Incidencia WHERE KeyIncidencia = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_Incidencia ON;
    INSERT INTO dbo.Dim_Incidencia (KeyIncidencia, TipoIncidencia, Prioridad, MotivoEstandar)
    VALUES (0, 'DESCONOCIDO', 'N/A', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_Incidencia OFF;
END;

-- 1.9. Dim_NotificacionCobranza (KeyNotificacion = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_NotificacionCobranza WHERE KeyNotificacion = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_NotificacionCobranza ON;
    INSERT INTO dbo.Dim_NotificacionCobranza (KeyNotificacion, EtapaCadencia, CanalNotificacion)
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_NotificacionCobranza OFF;
END;

-- 1.10. Dim_RiesgoImpago (KeyRiesgoImpago = 0)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_RiesgoImpago WHERE KeyRiesgoImpago = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_RiesgoImpago ON;
    INSERT INTO dbo.Dim_RiesgoImpago (KeyRiesgoImpago, NivelRiesgo, RangoProbabilidad)
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_RiesgoImpago OFF;
END;

-- 1.11. Dim_EstadoAtencion (KeyEstadoAtencion = 0 y extensión para CUSTOMER)
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoAtencion WHERE KeyEstadoAtencion = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_EstadoAtencion ON;
    INSERT INTO dbo.Dim_EstadoAtencion (KeyEstadoAtencion, EstadoFinal, Asistencia, EstadoCierreDocumental)
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO', 'DESCONOCIDO');
    SET IDENTITY_INSERT dbo.Dim_EstadoAtencion OFF;
END;

UPDATE dbo.Dim_EstadoAtencion
SET EstadoCierreDocumental = CASE
    WHEN EstadoFinal IN ('Realizado', 'Finalizado') AND Asistencia IN ('Asistió', 'Asiste') THEN 'Cerrada'
    ELSE 'Pendiente'
END
WHERE EstadoCierreDocumental IS NULL AND KeyEstadoAtencion > 0;

;WITH EstadosAtencionBase AS (
    SELECT 'Programado' AS EstadoFinal, 'Pendiente' AS Asistencia, 'Pendiente' AS EstadoCierreDocumental UNION ALL
    SELECT 'Programado', 'Confirmada', 'Pendiente' UNION ALL
    SELECT 'En proceso', 'Asistió', 'Pendiente' UNION ALL
    SELECT 'En curso', 'Asiste', 'Pendiente' UNION ALL
    SELECT 'Realizado', 'Asistió', 'Cerrada' UNION ALL
    SELECT 'Finalizado', 'Asiste', 'Cerrada' UNION ALL
    SELECT 'Cancelado', 'No asistió', 'Pendiente' UNION ALL
    SELECT 'Cancelado', 'No asiste', 'Pendiente' UNION ALL
    SELECT 'Programado', 'No asistió', 'Pendiente'
)
INSERT INTO dbo.Dim_EstadoAtencion (EstadoFinal, Asistencia, EstadoCierreDocumental)
SELECT b.EstadoFinal, b.Asistencia, b.EstadoCierreDocumental
FROM EstadosAtencionBase b
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_EstadoAtencion da
    WHERE da.EstadoFinal = b.EstadoFinal AND da.Asistencia = b.Asistencia
);

PRINT 'Miembros desconocidos explícitos (Key = 0) e integraciones de dimensiones conformadas verificados.';
COMMIT TRANSACTION;
GO

-- ====================================================================
-- SECCIÓN 2: CREACIÓN Y POBLAMIENTO DE LAS 5 NUEVAS DIMENSIONES DE CUSTOMER
-- ====================================================================

BEGIN TRANSACTION;

-- 2.1. Dim_EstadoTratamiento (Para Fact_TratamientoCustomer - Análisis A)
IF OBJECT_ID('dbo.Dim_EstadoTratamiento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_EstadoTratamiento (
        KeyEstadoTratamiento        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Dim_EstadoTratamiento PRIMARY KEY,
        CodigoEstadoTratamiento     VARCHAR(30) NOT NULL CONSTRAINT UQ_Dim_EstadoTratamiento_Codigo UNIQUE,
        EstadoTratamiento           VARCHAR(50) NOT NULL,
        CategoriaCicloTratamiento   VARCHAR(40) NOT NULL,
        EsActivo                    BIT NOT NULL,
        EsFinalizadoExitoso         BIT NOT NULL,
        HabilitaTransicionTurned    BIT NOT NULL
    );
    PRINT 'Tabla dbo.Dim_EstadoTratamiento creada.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoTratamiento WHERE KeyEstadoTratamiento = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_EstadoTratamiento ON;
    INSERT INTO dbo.Dim_EstadoTratamiento (
        KeyEstadoTratamiento, CodigoEstadoTratamiento, EstadoTratamiento,
        CategoriaCicloTratamiento, EsActivo, EsFinalizadoExitoso, HabilitaTransicionTurned
    )
    VALUES (0, 'DESCONOCIDO', 'Desconocido', 'Desconocido', 0, 0, 0);
    SET IDENTITY_INSERT dbo.Dim_EstadoTratamiento OFF;
END;

;WITH SemillaEstadoTratamiento AS (
    SELECT 'CONTRATADO' AS Codigo, 'Contratado' AS Estado, 'Pre-Operativo' AS Categoria, 1 AS EsActivo, 0 AS EsExitoso, 0 AS HabilitaTurned UNION ALL
    SELECT 'ACTIVADO', 'Activado', 'Habilitado Clínicamente', 1, 0, 0 UNION ALL
    SELECT 'EN_EJECUCION', 'En ejecución', 'Tratamiento Activo', 1, 0, 0 UNION ALL
    SELECT 'COMPLETADO', 'Completado', 'Cierre Clínico Exitoso', 0, 1, 1 UNION ALL
    SELECT 'SUSPENDIDO', 'Suspendido', 'Excepción Temporal', 0, 0, 0 UNION ALL
    SELECT 'INTERRUMPIDO', 'Interrumpido', 'Excepción Definitiva', 0, 0, 0 UNION ALL
    SELECT 'CANCELADO', 'Cancelado', 'Baja Administrativa/Clínica', 0, 0, 0
)
INSERT INTO dbo.Dim_EstadoTratamiento (
    CodigoEstadoTratamiento, EstadoTratamiento, CategoriaCicloTratamiento,
    EsActivo, EsFinalizadoExitoso, HabilitaTransicionTurned
)
SELECT s.Codigo, s.Estado, s.Categoria, s.EsActivo, s.EsExitoso, s.HabilitaTurned
FROM SemillaEstadoTratamiento s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_EstadoTratamiento d WHERE d.CodigoEstadoTratamiento = s.Codigo
);

-- 2.2. Dim_EstadoSesion (Para Fact_SesionCustomer - Análisis B)
IF OBJECT_ID('dbo.Dim_EstadoSesion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_EstadoSesion (
        KeyEstadoSesion         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Dim_EstadoSesion PRIMARY KEY,
        CodigoEstadoSesion      VARCHAR(60) NOT NULL CONSTRAINT UQ_Dim_EstadoSesion_Codigo UNIQUE,
        EstadoProgramacion      VARCHAR(30) NOT NULL,
        EstadoAsistencial       VARCHAR(30) NOT NULL,
        EstadoCierre            VARCHAR(30) NOT NULL,
        EsSesionEvaluable       BIT NOT NULL,
        EsSesionRealizada       BIT NOT NULL,
        EsSesionInasistida      BIT NOT NULL
    );
    PRINT 'Tabla dbo.Dim_EstadoSesion creada.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Dim_EstadoSesion WHERE KeyEstadoSesion = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_EstadoSesion ON;
    INSERT INTO dbo.Dim_EstadoSesion (
        KeyEstadoSesion, CodigoEstadoSesion, EstadoProgramacion, EstadoAsistencial,
        EstadoCierre, EsSesionEvaluable, EsSesionRealizada, EsSesionInasistida
    )
    VALUES (0, 'DESCONOCIDO', 'Desconocido', 'Desconocido', 'Desconocido', 0, 0, 0);
    SET IDENTITY_INSERT dbo.Dim_EstadoSesion OFF;
END;

;WITH SemillaEstadoSesion AS (
    SELECT 'PROG_PEND_PEND' AS Codigo, 'Programada' AS EstProg, 'Pendiente' AS EstAsist, 'Pendiente' AS EstCierre, 0 AS Eval, 0 AS Realiz, 0 AS Inasist UNION ALL
    SELECT 'PROG_CONF_PEND', 'Programada', 'Confirmada', 'Pendiente', 0, 0, 0 UNION ALL
    SELECT 'PROG_SALA_PEND', 'Programada', 'En sala de espera', 'Pendiente', 1, 0, 0 UNION ALL
    SELECT 'PROG_ATEN_PEND', 'Programada', 'En atención', 'Pendiente', 1, 0, 0 UNION ALL
    SELECT 'PROG_REAL_PEND', 'Programada', 'Realizada', 'Pendiente', 1, 1, 0 UNION ALL
    SELECT 'PROG_REAL_CERR', 'Programada', 'Realizada', 'Cerrada', 1, 1, 0 UNION ALL
    SELECT 'PROG_INAS_NOAP', 'Programada', 'Inasistida', 'No Aplica', 1, 0, 1 UNION ALL
    SELECT 'REPR_PEND_PEND', 'Reprogramada', 'Pendiente', 'Pendiente', 0, 0, 0 UNION ALL
    SELECT 'REPR_CONF_PEND', 'Reprogramada', 'Confirmada', 'Pendiente', 0, 0, 0 UNION ALL
    SELECT 'REPR_SALA_PEND', 'Reprogramada', 'En sala de espera', 'Pendiente', 1, 0, 0 UNION ALL
    SELECT 'REPR_ATEN_PEND', 'Reprogramada', 'En atención', 'Pendiente', 1, 0, 0 UNION ALL
    SELECT 'REPR_REAL_PEND', 'Reprogramada', 'Realizada', 'Pendiente', 1, 1, 0 UNION ALL
    SELECT 'REPR_REAL_CERR', 'Reprogramada', 'Realizada', 'Cerrada', 1, 1, 0 UNION ALL
    SELECT 'REPR_INAS_NOAP', 'Reprogramada', 'Inasistida', 'No Aplica', 1, 0, 1 UNION ALL
    SELECT 'CANC_NOAP_NOAP', 'Cancelada', 'No Aplica', 'No Aplica', 0, 0, 0
)
INSERT INTO dbo.Dim_EstadoSesion (
    CodigoEstadoSesion, EstadoProgramacion, EstadoAsistencial, EstadoCierre,
    EsSesionEvaluable, EsSesionRealizada, EsSesionInasistida
)
SELECT s.Codigo, s.EstProg, s.EstAsist, s.EstCierre, s.Eval, s.Realiz, s.Inasist
FROM SemillaEstadoSesion s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_EstadoSesion d WHERE d.CodigoEstadoSesion = s.Codigo
);

-- 2.3. Dim_TipoInteraccionIA (Para Fact_InteraccionIACustomer - Análisis D)
IF OBJECT_ID('dbo.Dim_TipoInteraccionIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_TipoInteraccionIA (
        KeyTipoInteraccionIA        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Dim_TipoInteraccionIA PRIMARY KEY,
        CodigoTipoInteraccionIA     VARCHAR(60) NOT NULL CONSTRAINT UQ_Dim_TipoInteraccionIA_Codigo UNIQUE,
        ClaseEventoIA               VARCHAR(30) NOT NULL,
        TipoInteraccionIA           VARCHAR(80) NOT NULL,
        PropositoOperativo          VARCHAR(120) NOT NULL,
        RequiereAprobacionHumana    BIT NOT NULL
    );
    PRINT 'Tabla dbo.Dim_TipoInteraccionIA creada.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoInteraccionIA WHERE KeyTipoInteraccionIA = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_TipoInteraccionIA ON;
    INSERT INTO dbo.Dim_TipoInteraccionIA (
        KeyTipoInteraccionIA, CodigoTipoInteraccionIA, ClaseEventoIA,
        TipoInteraccionIA, PropositoOperativo, RequiereAprobacionHumana
    )
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO', 'Desconocido', 'Desconocido', 0);
    SET IDENTITY_INSERT dbo.Dim_TipoInteraccionIA OFF;
END;

;WITH SemillaTipoIA AS (
    SELECT 'CONSULTA_AGENDA_PACIENTE' AS Codigo, 'INTERACCION' AS Clase, 'Consulta de Agenda del Paciente' AS Tipo, 'Orientación sobre próxima sesión y sede' AS Proposito, 0 AS ReqAprob UNION ALL
    SELECT 'RESUMEN_PROGRESO_CLINICO', 'INTERACCION', 'Resumen de Progreso Clínico', 'Síntesis de avance de sesiones para el odontólogo', 0 UNION ALL
    SELECT 'RECORDATORIO_ASISTENCIA', 'INTERACCION', 'Recordatorio Preventivo de Asistencia', 'Confirmación preventiva de asistencia a sesión', 0 UNION ALL
    SELECT 'SUGERENCIA_REPROGRAMACION', 'INTERACCION', 'Sugerencia de Ventana de Reprogramación', 'Propuesta de horarios disponibles ante cambio de cita', 1 UNION ALL
    SELECT 'ALERTA_RIESGO_INASISTENCIA', 'ALERTA', 'Alerta de Riesgo de Inasistencia o Abandono', 'Detección temprana de fricción de asistencia', 1 UNION ALL
    SELECT 'ALERTA_SEGUIMIENTO_SESION', 'ALERTA', 'Alerta de Seguimiento Operativo de Sesión', 'Aviso preventivo para confirmación de sesión', 1 UNION ALL
    SELECT 'ALERTA_FICHA_INCOMPLETA', 'ALERTA', 'Alerta de Ficha Clínica Incompleta', 'Recordatorio de campos obligatorios pendientes', 1 UNION ALL
    SELECT 'BORRADOR_INDICACIONES_POSTATENCION', 'BORRADOR', 'Borrador de Indicaciones Post-Atención', 'Asistencia en redacción de cuidados postoperatorios', 1
)
INSERT INTO dbo.Dim_TipoInteraccionIA (
    CodigoTipoInteraccionIA, ClaseEventoIA, TipoInteraccionIA,
    PropositoOperativo, RequiereAprobacionHumana
)
SELECT s.Codigo, s.Clase, s.Tipo, s.Proposito, s.ReqAprob
FROM SemillaTipoIA s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_TipoInteraccionIA d WHERE d.CodigoTipoInteraccionIA = s.Codigo
);

-- 2.4. Dim_TipoUsuarioIA (Para Fact_InteraccionIACustomer - Análisis D)
IF OBJECT_ID('dbo.Dim_TipoUsuarioIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_TipoUsuarioIA (
        KeyTipoUsuarioIA        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Dim_TipoUsuarioIA PRIMARY KEY,
        CodigoTipoUsuarioIA     VARCHAR(30) NOT NULL CONSTRAINT UQ_Dim_TipoUsuarioIA_Codigo UNIQUE,
        ActorOrientado          VARCHAR(30) NOT NULL,
        RolClinicoOperativo     VARCHAR(60) NOT NULL,
        CanalInteraccion        VARCHAR(50) NOT NULL
    );
    PRINT 'Tabla dbo.Dim_TipoUsuarioIA creada.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoUsuarioIA WHERE KeyTipoUsuarioIA = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_TipoUsuarioIA ON;
    INSERT INTO dbo.Dim_TipoUsuarioIA (
        KeyTipoUsuarioIA, CodigoTipoUsuarioIA, ActorOrientado,
        RolClinicoOperativo, CanalInteraccion
    )
    VALUES (0, 'DESCONOCIDO', 'DESCONOCIDO', 'Desconocido', 'Desconocido');
    SET IDENTITY_INSERT dbo.Dim_TipoUsuarioIA OFF;
END;

;WITH SemillaUsuarioIA AS (
    SELECT 'PACIENTE' AS Codigo, 'PACIENTE' AS Actor, 'Paciente en Tratamiento Activo' AS Rol, 'WhatsApp / Portal Paciente' AS Canal UNION ALL
    SELECT 'ODONTOLOGO', 'ODONTOLOGO', 'Odontólogo Tratante / Copiloto Clínico', 'Consola Clínica Web' UNION ALL
    SELECT 'AUDITOR_CLINICO', 'AUDITOR_CLINICO', 'Auditor Clínico / Coordinación Asistencial', 'Panel de Supervisión Clínica'
)
INSERT INTO dbo.Dim_TipoUsuarioIA (
    CodigoTipoUsuarioIA, ActorOrientado, RolClinicoOperativo, CanalInteraccion
)
SELECT s.Codigo, s.Actor, s.Rol, s.Canal
FROM SemillaUsuarioIA s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_TipoUsuarioIA d WHERE d.CodigoTipoUsuarioIA = s.Codigo
);

-- 2.5. Dim_ResultadoIA (Para Fact_InteraccionIACustomer - Análisis D)
IF OBJECT_ID('dbo.Dim_ResultadoIA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_ResultadoIA (
        KeyResultadoIA          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Dim_ResultadoIA PRIMARY KEY,
        CodigoResultadoIA       VARCHAR(60) NOT NULL CONSTRAINT UQ_Dim_ResultadoIA_Codigo UNIQUE,
        EstadoResolucionIA      VARCHAR(40) NOT NULL,
        ResultadoRevisionHumana VARCHAR(50) NOT NULL,
        EsAlertaAtendida        BIT NOT NULL,
        EsBorradorAprobado      BIT NOT NULL,
        FueEscaladoAHumano      BIT NOT NULL
    );
    PRINT 'Tabla dbo.Dim_ResultadoIA creada.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Dim_ResultadoIA WHERE KeyResultadoIA = 0)
BEGIN
    SET IDENTITY_INSERT dbo.Dim_ResultadoIA ON;
    INSERT INTO dbo.Dim_ResultadoIA (
        KeyResultadoIA, CodigoResultadoIA, EstadoResolucionIA,
        ResultadoRevisionHumana, EsAlertaAtendida, EsBorradorAprobado, FueEscaladoAHumano
    )
    VALUES (0, 'DESCONOCIDO', 'Desconocido', 'Desconocido', 0, 0, 0);
    SET IDENTITY_INSERT dbo.Dim_ResultadoIA OFF;
END;

;WITH SemillaResultadoIA AS (
    SELECT 'INTERACCION_COMPLETADA' AS Codigo, 'Completada' AS EstadoRes, 'No Requiere Revisión' AS RevHum, 0 AS AlertaAt, 0 AS BorrAprob, 0 AS Escalado UNION ALL
    SELECT 'INTERACCION_APROBADA', 'Aprobada', 'Aprobada por Profesional', 0, 0, 0 UNION ALL
    SELECT 'INTERACCION_DERIVADA_PERSONAL', 'Derivada_Personal', 'Escalada a Recepción/Personal', 0, 0, 1 UNION ALL
    SELECT 'INTERACCION_EN_REVISION', 'En_Revision', 'En Revisión Humana', 0, 0, 1 UNION ALL
    SELECT 'INTERACCION_RECHAZADA', 'Rechazada', 'Rechazada por Profesional', 0, 0, 0 UNION ALL
    SELECT 'ALERTA_ATENDIDA', 'Atendida', 'Gestionada por Equipo Clínico', 1, 0, 0 UNION ALL
    SELECT 'ALERTA_PENDIENTE', 'Generada', 'Pendiente de Atención', 0, 0, 0 UNION ALL
    SELECT 'ALERTA_DESCARTADA', 'Descartada_Justificada', 'Descartada con Justificación', 0, 0, 0 UNION ALL
    SELECT 'BORRADOR_APROBADO', 'Aprobado', 'Aprobado sin Cambios por Odontólogo', 0, 1, 0 UNION ALL
    SELECT 'BORRADOR_CORREGIDO_Y_APROBADO', 'Corregido_Y_Aprobado', 'Editado y Aprobado por Odontólogo', 0, 1, 0 UNION ALL
    SELECT 'BORRADOR_RECHAZADO', 'Rechazado', 'Rechazado por Odontólogo', 0, 0, 0 UNION ALL
    SELECT 'BORRADOR_PENDIENTE', 'Generado', 'Pendiente de Revisión Profesional', 0, 0, 0
)
INSERT INTO dbo.Dim_ResultadoIA (
    CodigoResultadoIA, EstadoResolucionIA, ResultadoRevisionHumana,
    EsAlertaAtendida, EsBorradorAprobado, FueEscaladoAHumano
)
SELECT s.Codigo, s.EstadoRes, s.RevHum, s.AlertaAt, s.BorrAprob, s.Escalado
FROM SemillaResultadoIA s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Dim_ResultadoIA d WHERE d.CodigoResultadoIA = s.Codigo
);

COMMIT TRANSACTION;

SELECT
    'RESUMEN_DIMENSIONES_CUSTOMER' AS Seccion,
    (SELECT COUNT(*) FROM dbo.Dim_EstadoTratamiento) AS FilasDimEstadoTratamiento,
    (SELECT COUNT(*) FROM dbo.Dim_EstadoSesion) AS FilasDimEstadoSesion,
    (SELECT COUNT(*) FROM dbo.Dim_TipoInteraccionIA) AS FilasDimTipoInteraccionIA,
    (SELECT COUNT(*) FROM dbo.Dim_TipoUsuarioIA) AS FilasDimTipoUsuarioIA,
    (SELECT COUNT(*) FROM dbo.Dim_ResultadoIA) AS FilasDimResultadoIA;

PRINT 'Dimensiones de CUSTOMER (03_dimensiones_customer.sql) creadas y sembradas exitosamente.';
GO
