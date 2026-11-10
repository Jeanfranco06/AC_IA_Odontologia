-- ====================================================================
-- ARCHIVO: 02_mart_dimensiones_payer.sql
-- FASE: PAYER (Dimensional - NexoSalud_Mart)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Creación y poblamiento base de dimensiones especializadas
-- para el modelo de tres hechos de la fase PAYER.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('NexoSalud_Mart', 'NexoSalud_MartPruebas')
BEGIN
    PRINT 'AVISO: Verifique que la sesión apunte a la base dimensional NexoSalud_Mart.';
END
GO

BEGIN TRANSACTION;

-- 1. DIMENSIÓN INCIDENCIAS DE PAGO (Para F2 - Validación e Incidencias)
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Dim_Incidencia', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Incidencia (
        KeyIncidencia       INT IDENTITY(1,1) PRIMARY KEY,
        TipoIncidencia      VARCHAR(100) NOT NULL,
        Prioridad           VARCHAR(20) NOT NULL,
        MotivoEstandar      VARCHAR(100) NOT NULL
    );
    PRINT 'Tabla Dim_Incidencia creada.';
END

-- Poblamiento semilla canónico de incidencias
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Incidencia WHERE MotivoEstandar = 'Sin Incidencia (Pago Conforme)')
BEGIN
    INSERT INTO dbo.Dim_Incidencia (TipoIncidencia, Prioridad, MotivoEstandar)
    VALUES 
        ('CONFORME', 'Baja', 'Sin Incidencia (Pago Conforme)'),
        ('RECHAZO_VOUCHER', 'Media', 'Monto Incompleto'),
        ('RECHAZO_VOUCHER', 'Alta', 'Voucher Ilegible o Borroso'),
        ('RECHAZO_VOUCHER', 'Crítica', 'Comprobante Falso o Alterado'),
        ('RECHAZO_VOUCHER', 'Alta', 'Cuenta de Destino Incorrecta'),
        ('REVERSION_PAGO', 'Alta', 'Contracargo Bancario'),
        ('REVERSION_PAGO', 'Media', 'Anulación Voluntaria por Paciente'),
        ('ERROR_OPERATIVO', 'Media', 'Discrepancia en Número de Operación');
    PRINT 'Semillas de Dim_Incidencia insertadas.';
END

-- 2. DIMENSIÓN NOTIFICACIÓN Y CADENCIA DUNNING (Para F3 - Conversión y Cadencia)
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Dim_NotificacionCobranza', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_NotificacionCobranza (
        KeyNotificacion     INT IDENTITY(1,1) PRIMARY KEY,
        EtapaCadencia       VARCHAR(50) NOT NULL,
        CanalNotificacion   VARCHAR(50) NOT NULL
    );
    PRINT 'Tabla Dim_NotificacionCobranza creada.';
END

-- Poblamiento semilla canónico de cadencia
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_NotificacionCobranza WHERE EtapaCadencia = 'T-48h Preventivo')
BEGIN
    INSERT INTO dbo.Dim_NotificacionCobranza (EtapaCadencia, CanalNotificacion)
    VALUES 
        ('Sin Notificación Previa', 'Ninguno'),
        ('T-48h Preventivo', 'Email + PDF Orden'),
        ('T-24h Urgencia Clínica', 'Email + WhatsApp Alerta'),
        ('T-00:00 Cancelación Automática', 'Email Expiración');
    PRINT 'Semillas de Dim_NotificacionCobranza insertadas.';
END

-- 3. DIMENSIÓN SCORING RIESGO IA (Para F3 - Conversión y Cadencia)
-- --------------------------------------------------------------------
IF OBJECT_ID('dbo.Dim_RiesgoImpago', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_RiesgoImpago (
        KeyRiesgoImpago     INT IDENTITY(1,1) PRIMARY KEY,
        NivelRiesgo         VARCHAR(20) NOT NULL,
        RangoProbabilidad   VARCHAR(30) NOT NULL
    );
    PRINT 'Tabla Dim_RiesgoImpago creada.';
END

-- Poblamiento semilla canónico de scoring IA
IF NOT EXISTS (SELECT 1 FROM dbo.Dim_RiesgoImpago WHERE NivelRiesgo = 'BAJO')
BEGIN
    INSERT INTO dbo.Dim_RiesgoImpago (NivelRiesgo, RangoProbabilidad)
    VALUES 
        ('NO_EVALUADO', 'Sin Score Asignado'),
        ('BAJO', '0% - 39% de Probabilidad'),
        ('MODERADO', '40% - 64% de Probabilidad'),
        ('ALTO', '65% - 100% de Probabilidad');
    PRINT 'Semillas de Dim_RiesgoImpago insertadas.';
END

COMMIT TRANSACTION;
PRINT 'Dimensiones especializadas de PAYER creadas y sembradas exitosamente.';
GO

