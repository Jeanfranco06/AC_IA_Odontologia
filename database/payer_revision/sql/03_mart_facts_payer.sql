-- ====================================================================
-- ARCHIVO: 03_mart_facts_payer.sql
-- FASE: PAYER (Dimensional - NexoSalud_Mart)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Creación de las tres tablas de hechos especializadas
-- de la fase PAYER con llaves compuestas y restricciones de grano.
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

-- ====================================================================
-- 1. HECHO F1: Fact_RecaudacionPayer (Recaudación y Estados de Pago)
-- Grano: Día × Sede × Servicio × Pasarela × EstadoCobro
-- Alimenta: Reporte R1, KPIs P1 (Validados) y P3 (Rechazados)
-- ====================================================================
IF OBJECT_ID('dbo.Fact_RecaudacionPayer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_RecaudacionPayer (
        KeyTiempo               INT NOT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                 INT NOT NULL REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio             INT NOT NULL REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyPasarela             INT NOT NULL REFERENCES dbo.Dim_Pasarela(KeyPasarela),
        KeyCobro                INT NOT NULL REFERENCES dbo.Dim_Cobro(KeyCobro),
        
        -- Medidas Cuantitativas
        PagosRegistrados        INT DEFAULT 0,
        PagosValidados          INT DEFAULT 0,
        PagosPendientes         INT DEFAULT 0,
        PagosRechazados         INT DEFAULT 0,
        PagosRevertidos         INT DEFAULT 0,
        IngresosBrutosRecaudados DECIMAL(12,2) DEFAULT 0.00,
        CostoTransaccionPasarela DECIMAL(10,2) DEFAULT 0.00,

        CONSTRAINT PK_Fact_RecaudacionPayer PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyPasarela, KeyCobro)
    );
    PRINT 'Tabla Fact_RecaudacionPayer (F1) creada exitosamente.';
END

-- ====================================================================
-- 2. HECHO F2: Fact_ValidacionIncidenciaPayer (Validación e Incidencias)
-- Grano: Día × Sede × Pasarela × EstadoCobro × Incidencia
-- Alimenta: Reporte R2, KPI P2 (Tiempo promedio de validación)
-- ====================================================================
IF OBJECT_ID('dbo.Fact_ValidacionIncidenciaPayer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_ValidacionIncidenciaPayer (
        KeyTiempo               INT NOT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                 INT NOT NULL REFERENCES dbo.Dim_Sede(KeySede),
        KeyPasarela             INT NOT NULL REFERENCES dbo.Dim_Pasarela(KeyPasarela),
        KeyCobro                INT NOT NULL REFERENCES dbo.Dim_Cobro(KeyCobro),
        KeyIncidencia           INT NOT NULL REFERENCES dbo.Dim_Incidencia(KeyIncidencia),

        -- Medidas Cuantitativas
        TiempoTotalValidacionMin INT DEFAULT 0,
        PagosValidados          INT DEFAULT 0,
        CantidadIncidencias     INT DEFAULT 0,
        PagosRechazados         INT DEFAULT 0,
        PagosRevertidos         INT DEFAULT 0,

        CONSTRAINT PK_Fact_ValidacionIncidenciaPayer PRIMARY KEY (KeyTiempo, KeySede, KeyPasarela, KeyCobro, KeyIncidencia)
    );
    PRINT 'Tabla Fact_ValidacionIncidenciaPayer (F2) creada exitosamente.';
END

-- ====================================================================
-- 3. HECHO F3: Fact_ConversionCobranzaPayer (Conversión y Cadencia)
-- Grano: Día × Sede × Servicio × EtapaCadencia × RiesgoImpago
-- Alimenta: Reporte R3, KPI P4 (Conversión a CUSTOMER)
-- ====================================================================
IF OBJECT_ID('dbo.Fact_ConversionCobranzaPayer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Fact_ConversionCobranzaPayer (
        KeyTiempo               INT NOT NULL REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeySede                 INT NOT NULL REFERENCES dbo.Dim_Sede(KeySede),
        KeyServicio             INT NOT NULL REFERENCES dbo.Dim_Servicio(KeyServicio),
        KeyNotificacion         INT NOT NULL REFERENCES dbo.Dim_NotificacionCobranza(KeyNotificacion),
        KeyRiesgoImpago         INT NOT NULL REFERENCES dbo.Dim_RiesgoImpago(KeyRiesgoImpago),

        -- Medidas Cuantitativas
        ReservasPreagendadas    INT DEFAULT 0,
        ReservasConfirmadas     INT DEFAULT 0,
        ReservasCanceladasImpago INT DEFAULT 0,
        ConversionesACustomer   INT DEFAULT 0,
        PagosRegistrados        INT DEFAULT 0,

        CONSTRAINT PK_Fact_ConversionCobranzaPayer PRIMARY KEY (KeyTiempo, KeySede, KeyServicio, KeyNotificacion, KeyRiesgoImpago)
    );
    PRINT 'Tabla Fact_ConversionCobranzaPayer (F3) creada exitosamente.';
END

COMMIT TRANSACTION;
PRINT 'Estructura de hechos de PAYER creada y verificada.';
GO

