-- ====================================================================
-- ARCHIVO: 05_indicadores_y_reportes_payer.sql
-- FASE: PAYER (Indicadores P1–P4 y Vistas de Reportes R1–R3)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Consultas canónicas y vistas analíticas para auditar
-- los cuatro indicadores de PAYER y los reportes R1, R2 y R3 en NexoSalud_Mart.
-- ====================================================================

SET NOCOUNT ON;
GO

USE [NexoSalud_Mart];
GO

-- ====================================================================
-- 1. CONSULTA DE INDICADORES PAYER (P1, P2, P3, P4) CON SEMÁFOROS
-- ====================================================================
CREATE OR ALTER VIEW dbo.v_Indicadores_Payer_Oficial AS
WITH TotalesF1 AS (
    SELECT 
        SUM(PagosRegistrados) AS TotalRegistrados,
        SUM(PagosValidados) AS TotalValidados,
        SUM(PagosRechazados) AS TotalRechazados
    FROM dbo.Fact_RecaudacionPayer
),
TotalesF2 AS (
    SELECT 
        SUM(TiempoTotalValidacionMin) AS MinutosAcumulados,
        SUM(PagosValidados) AS ConteoValidados
    FROM dbo.Fact_ValidacionIncidenciaPayer
),
TotalesF3 AS (
    SELECT 
        SUM(ReservasPreagendadas) AS TotalReservas,
        SUM(ConversionesACustomer) AS TotalConversiones
    FROM dbo.Fact_ConversionCobranzaPayer
)
SELECT 
    -- P1: Tasa de Pagos Validados
    CAST(100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0) AS DECIMAL(5,2)) AS P1_TasaPagosValidados_Pct,
    CASE 
        WHEN (100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0)) >= 80.0 THEN 'VERDE'
        WHEN (100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0)) >= 60.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P1_Semaforo,

    -- P2: Tiempo Promedio de Validación
    CAST(1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidados, 0) AS DECIMAL(6,1)) AS P2_TiempoPromedioValidacion_Min,
    CASE 
        WHEN (1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidados, 0)) <= 60.0 THEN 'VERDE'
        WHEN (1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidados, 0)) <= 120.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P2_Semaforo,

    -- P3: Tasa de Pagos Rechazados
    CAST(100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0) AS DECIMAL(5,2)) AS P3_TasaPagosRechazados_Pct,
    CASE 
        WHEN (100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0)) <= 5.0 THEN 'VERDE'
        WHEN (100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0)) <= 10.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P3_Semaforo,

    -- P4: Tasa de Conversión a CUSTOMER
    CAST(100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0) AS DECIMAL(5,2)) AS P4_TasaConversionCustomer_Pct,
    CASE 
        WHEN (100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0)) >= 90.0 THEN 'VERDE'
        WHEN (100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0)) >= 75.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P4_Semaforo
FROM TotalesF1 f1
CROSS JOIN TotalesF2 f2
CROSS JOIN TotalesF3 f3;
GO

-- ====================================================================
-- 2. REPORTE R1: Recaudación y Estados de Pago (Alimentado por F1)
-- ====================================================================
CREATE OR ALTER VIEW dbo.v_ReporteR1_Recaudacion_Payer AS
SELECT 
    t.Anio,
    t.Mes,
    s.Sede AS NombreSede,
    serv.ServicioOdontologico AS NombreServicio,
    p.TipoMedio,
    p.MetodoPago,
    c.EstadoPago,
    f.PagosRegistrados,
    f.PagosValidados,
    f.PagosPendientes,
    f.PagosRechazados,
    f.PagosRevertidos,
    f.IngresosBrutosRecaudados,
    f.CostoTransaccionPasarela
FROM dbo.Fact_RecaudacionPayer f
INNER JOIN dbo.Dim_Tiempo t ON t.KeyTiempo = f.KeyTiempo
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio serv ON serv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
INNER JOIN dbo.Dim_Cobro c ON c.KeyCobro = f.KeyCobro;
GO

-- ====================================================================
-- 3. REPORTE R2: Tiempos de Validación e Incidencias (Alimentado por F2)
-- ====================================================================
CREATE OR ALTER VIEW dbo.v_ReporteR2_ValidacionIncidencias_Payer AS
SELECT 
    t.Anio,
    t.Mes,
    s.Sede AS NombreSede,
    p.MetodoPago,
    inc.TipoIncidencia,
    inc.Prioridad AS PrioridadIncidencia,
    inc.MotivoEstandar,
    f.CantidadIncidencias,
    f.PagosValidados,
    f.PagosRechazados,
    f.PagosRevertidos,
    CAST(1.0 * f.TiempoTotalValidacionMin / NULLIF(f.PagosValidados, 0) AS DECIMAL(6,1)) AS TiempoPromedioMinutos
FROM dbo.Fact_ValidacionIncidenciaPayer f
INNER JOIN dbo.Dim_Tiempo t ON t.KeyTiempo = f.KeyTiempo
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
INNER JOIN dbo.Dim_Incidencia inc ON inc.KeyIncidencia = f.KeyIncidencia;
GO

-- ====================================================================
-- 4. REPORTE R3: Efectividad de Conversión y Cadencia Dunning (Alimentado por F3)
-- ====================================================================
CREATE OR ALTER VIEW dbo.v_ReporteR3_CadenciaConversion_Payer AS
SELECT 
    t.Anio,
    t.Mes,
    s.Sede AS NombreSede,
    serv.ServicioOdontologico AS NombreServicio,
    notif.EtapaCadencia,
    riesgo.NivelRiesgo AS NivelRiesgoIA,
    f.ReservasPreagendadas,
    f.ReservasConfirmadas,
    f.ReservasCanceladasImpago AS SillonesLiberadosPorImpago,
    f.ConversionesACustomer,
    CAST(100.0 * f.ConversionesACustomer / NULLIF(f.ReservasPreagendadas, 0) AS DECIMAL(5,2)) AS TasaEfectividad_Pct
FROM dbo.Fact_ConversionCobranzaPayer f
INNER JOIN dbo.Dim_Tiempo t ON t.KeyTiempo = f.KeyTiempo
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio serv ON serv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_NotificacionCobranza notif ON notif.KeyNotificacion = f.KeyNotificacion
INNER JOIN dbo.Dim_RiesgoImpago riesgo ON riesgo.KeyRiesgoImpago = f.KeyRiesgoImpago;
GO

PRINT 'Vistas de Indicadores (P1–P4) y Reportes (R1–R3) creadas exitosamente en NexoSalud_Mart.';
GO
