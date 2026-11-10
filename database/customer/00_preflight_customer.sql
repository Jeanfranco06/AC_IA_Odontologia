-- ====================================================================
-- ARCHIVO: 00_preflight_customer.sql
-- FASE: CUSTOMER (Inspección Preliminar y Verificación de Precondiciones)
-- BASES DE DATOS: NexoSaludDB (OLTP) y NexoSalud_Mart (Data Mart)
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN: Verifica de manera no destructiva el estado de las bases
-- transaccional y dimensional antes de aplicar la migración de CUSTOMER.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT '====================================================================';
PRINT ' PREFLIGHT DE INTEGRACIÓN — FASE CUSTOMER DE NEXOSALUD';
PRINT '====================================================================';

-- 1. Verificar existencia y estado de las bases de datos
IF DB_ID('NexoSaludDB') IS NULL
    THROW 55001, 'PREFLIGHT ERROR: No existe la base transaccional NexoSaludDB.', 1;

IF DB_ID('NexoSalud_Mart') IS NULL
    THROW 55002, 'PREFLIGHT ERROR: No existe la base dimensional NexoSalud_Mart.', 1;

IF DATABASEPROPERTYEX('NexoSaludDB', 'Updateability') <> 'READ_WRITE'
    THROW 55003, 'PREFLIGHT ERROR: NexoSaludDB no se encuentra en modo READ_WRITE.', 1;

IF DATABASEPROPERTYEX('NexoSalud_Mart', 'Updateability') <> 'READ_WRITE'
    THROW 55004, 'PREFLIGHT ERROR: NexoSalud_Mart no se encuentra en modo READ_WRITE.', 1;

PRINT 'OK: Bases NexoSaludDB y NexoSalud_Mart existen y están en modo READ_WRITE.';
GO

USE [NexoSaludDB];
GO

-- 2. Verificar tablas base y extensiones de BUYER, LEAD y PAYER en NexoSaludDB
DECLARE @FaltantesOLTP TABLE (Objeto VARCHAR(128));

INSERT INTO @FaltantesOLTP (Objeto)
SELECT v.Objeto
FROM (VALUES
    ('dbo.Personas'),
    ('dbo.Etapas'),
    ('dbo.Solicitudes'),
    ('dbo.Opciones'),
    ('dbo.Reservas'),
    ('dbo.Pagos'),
    ('dbo.Disponibilidad'),
    ('dbo.Servicios'),
    ('dbo.Tarifas'),
    ('dbo.Profesionales'),
    ('dbo.Sedes'),
    ('dbo.Atenciones'),
    ('dbo.Seguimientos'),
    ('dbo.EventosEtapa'),
    ('dbo.Incidencias'),
    ('dbo.DecisionesIA'),
    ('dbo.PersonaSaludOdontologica'),
    ('dbo.CaptacionesBuyer'),
    ('dbo.PropuestasEconomicasLead'),
    ('dbo.PromocionesLead'),
    ('dbo.MotivosRechazoLead'),
    ('dbo.CambiosOpcionLead')
) AS v(Objeto)
WHERE OBJECT_ID(v.Objeto, 'U') IS NULL;

IF EXISTS (SELECT 1 FROM @FaltantesOLTP)
BEGIN
    SELECT 'OBJETO_OLTP_FALTANTE' AS TipoError, Objeto FROM @FaltantesOLTP;
    THROW 55005, 'PREFLIGHT ERROR: Faltan tablas base o extensiones de BUYER/LEAD en NexoSaludDB.', 1;
END;

IF COL_LENGTH('dbo.Reservas', 'ultima_alerta_dunning') IS NULL
   OR COL_LENGTH('dbo.Reservas', 'score_riesgo_impago') IS NULL
   OR COL_LENGTH('dbo.Incidencias', 'motivo_tipificado') IS NULL
BEGIN
    THROW 55006, 'PREFLIGHT ERROR: Falta aplicar 01_oltp_payer_extension.sql en NexoSaludDB.', 1;
END;

PRINT 'OK: Tablas base y extensiones OLTP de BUYER, LEAD y PAYER verificadas.';

-- 3. Diagnóstico de restricciones CHECK en conflicto (H01, H02, H09)
SELECT
    'DIAGNOSTICO_RESTRICCIONES_OLTP' AS Seccion,
    OBJECT_NAME(parent_object_id) AS Tabla,
    name AS NombreRestriccion,
    is_disabled AS Deshabilitada,
    definition AS DefinicionActual
FROM sys.check_constraints
WHERE parent_object_id IN (
    OBJECT_ID('dbo.Pagos'),
    OBJECT_ID('dbo.Disponibilidad'),
    OBJECT_ID('dbo.Atenciones'),
    OBJECT_ID('dbo.Incidencias'),
    OBJECT_ID('dbo.Reservas')
)
ORDER BY OBJECT_NAME(parent_object_id), name;

-- 4. Inventario de conteos actuales en NexoSaludDB antes de migrar
SELECT
    'INVENTARIO_OLTP_PRE_MIGRACION' AS Seccion,
    (SELECT COUNT(*) FROM dbo.Personas) AS TotalPersonas,
    (SELECT COUNT(*) FROM dbo.CaptacionesBuyer) AS TotalCaptacionesBuyer,
    (SELECT COUNT(*) FROM dbo.Solicitudes) AS TotalSolicitudes,
    (SELECT COUNT(*) FROM dbo.Opciones) AS TotalOpciones,
    (SELECT COUNT(*) FROM dbo.Reservas) AS TotalReservas,
    (SELECT COUNT(*) FROM dbo.Pagos) AS TotalPagos,
    (SELECT COUNT(*) FROM dbo.Pagos WHERE estado IN ('Validado', 'VALIDADO', 'VALIDATED', 'Confirmado')) AS PagosValidadosOConfirmados,
    (SELECT COUNT(*) FROM dbo.Atenciones) AS TotalAtenciones,
    (SELECT COUNT(*) FROM dbo.Seguimientos) AS TotalSeguimientos,
    (SELECT COUNT(*) FROM dbo.Incidencias) AS TotalIncidencias;
GO

USE [NexoSalud_Mart];
GO

-- 5. Verificar objetos existentes en NexoSalud_Mart (BUYER, LEAD, PAYER y heredados)
DECLARE @FaltantesMart TABLE (Objeto VARCHAR(128));

INSERT INTO @FaltantesMart (Objeto)
SELECT v.Objeto
FROM (VALUES
    ('dbo.Dim_Tiempo'),
    ('dbo.Dim_Hora'),
    ('dbo.Dim_Sede'),
    ('dbo.Dim_Servicio'),
    ('dbo.Dim_Profesional'),
    ('dbo.Dim_Pasarela'),
    ('dbo.Dim_Cobro'),
    ('dbo.Dim_EstadoAtencion'),
    ('dbo.Dim_Incidencia'),
    ('dbo.Dim_NotificacionCobranza'),
    ('dbo.Dim_RiesgoImpago'),
    ('dbo.fact_captacion_buyer'),
    ('dbo.fact_inversion_campana_buyer'),
    ('dbo.fact_negociacion_lead'),
    ('dbo.Fact_RecaudacionPayer'),
    ('dbo.Fact_ValidacionIncidenciaPayer'),
    ('dbo.Fact_ConversionCobranzaPayer'),
    ('dbo.fact_atencion_customer'),
    ('dbo.fact_seguimiento_turned')
) AS v(Objeto)
WHERE OBJECT_ID(v.Objeto, 'U') IS NULL;

IF EXISTS (SELECT 1 FROM @FaltantesMart)
BEGIN
    SELECT 'OBJETO_MART_FALTANTE' AS TipoError, Objeto FROM @FaltantesMart;
    THROW 55007, 'PREFLIGHT ERROR: Faltan dimensiones o tablas de hechos base/PAYER en NexoSalud_Mart.', 1;
END;

SELECT
    'INVENTARIO_MART_PRE_MIGRACION' AS Seccion,
    (SELECT COUNT(*) FROM dbo.Dim_Tiempo) AS DimTiempo_Filas,
    (SELECT COUNT(*) FROM dbo.Dim_Sede) AS DimSede_Filas,
    (SELECT COUNT(*) FROM dbo.Dim_Servicio) AS DimServicio_Filas,
    (SELECT COUNT(*) FROM dbo.Dim_Profesional) AS DimProfesional_Filas,
    (SELECT COUNT(*) FROM dbo.fact_captacion_buyer) AS FactBuyer_Filas,
    (SELECT COUNT(*) FROM dbo.Fact_RecaudacionPayer) AS FactPayerF1_Filas,
    (SELECT COUNT(*) FROM dbo.Fact_ValidacionIncidenciaPayer) AS FactPayerF2_Filas,
    (SELECT COUNT(*) FROM dbo.Fact_ConversionCobranzaPayer) AS FactPayerF3_Filas,
    (SELECT COUNT(*) FROM dbo.fact_atencion_customer) AS FactCustomerLegacy_Filas;

PRINT '====================================================================';
PRINT ' PREFLIGHT COMPLETADO EXITOSAMENTE.';
PRINT '====================================================================';
GO
