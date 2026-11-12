-- ====================================================================
-- ARCHIVO: 05_etl_customer.sql
-- FASE: CUSTOMER (ETL Transaccional, Idempotente y Reconciliado)
-- BASE DE DATOS: NexoSalud_Mart (lee desde NexoSaludDB)
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Implementa dbo.usp_ETL_SincronizarPayerMart corrigiendo H04 (claves
--      naturales y Key=0), H05 (eliminación de Fan-Trap en F2 y F3),
--      H06 (exclusión de tiempos ficticios de 15 min y negativos) y
--      H07 (separación de comisión contractual frente a estimada).
--   2. Implementa dbo.usp_ETL_SincronizarCustomerMart con sp_getapplock,
--      sincronización de dimensiones conformadas, MERGE idempotente sobre
--      los 4 hechos de CUSTOMER, actualización de compatibilidad sobre
--      dbo.fact_atencion_customer, reconciliación OLTP vs Mart y registro
--      en dbo.ETL_EjecucionLog.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSalud_Mart];
GO

-- ====================================================================
-- SECCIÓN 1: PROCEDIMIENTO ETL CORREGIDO DE PAYER (H04, H05, H06, H07)
-- ====================================================================

IF OBJECT_ID('dbo.usp_ETL_SincronizarPayerMart', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ETL_SincronizarPayerMart;
GO

CREATE PROCEDURE dbo.usp_ETL_SincronizarPayerMart
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaInicio DATETIME2 = SYSDATETIME();
    DECLARE @FilasOrigen INT = 0;
    DECLARE @FilasDestino INT = 0;
    DECLARE @AppLockResult INT;

    BEGIN TRANSACTION;

    EXEC @AppLockResult = sp_getapplock
        @Resource = 'ETL_NexoSalud_Payer_Lock',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 30000;

    IF @AppLockResult < 0
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 56001, 'No se pudo obtener el bloqueo exclusivo para usp_ETL_SincronizarPayerMart.', 1;
    END;

    BEGIN TRY
        -- 1.1. Asegurar fechas en Dim_Tiempo para todos los pagos y reservas en OLTP
        ;WITH FechasOLTP AS (
            SELECT DISTINCT CAST(fecha_registro AS DATE) AS fecha FROM [NexoSaludDB].dbo.Pagos WHERE fecha_registro IS NOT NULL
            UNION
            SELECT DISTINCT CAST(fecha_reserva AS DATE) AS fecha FROM [NexoSaludDB].dbo.Reservas WHERE fecha_reserva IS NOT NULL
        )
        INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
        SELECT
            YEAR(f.fecha) * 10000 + MONTH(f.fecha) * 100 + DAY(f.fecha),
            f.fecha,
            YEAR(f.fecha),
            DATEPART(QUARTER, f.fecha),
            MONTH(f.fecha),
            DAY(f.fecha)
        FROM FechasOLTP f
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo dt WHERE dt.id_fecha = f.fecha);

        -- 1.2. Limpiar filas agregadas previas de F1, F2, F3 dentro de la transacción para recomputar sin residuos de claves fijas
        DELETE FROM dbo.Fact_RecaudacionPayer;
        DELETE FROM dbo.Fact_ValidacionIncidenciaPayer;
        DELETE FROM dbo.Fact_ConversionCobranzaPayer;

        -- --------------------------------------------------------------------
        -- 1.3. CARGA F1: Fact_RecaudacionPayer (Resuelve H04 y H07)
        -- --------------------------------------------------------------------
        ;WITH PagosNormalizados AS (
            SELECT
                p.id_pago,
                p.id_reserva,
                p.fecha_registro,
                p.fecha_validacion,
                p.referencia_pago,
                p.canal_pago,
                ISNULL(p.importe, 0.00) AS importe,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED') THEN 'Validado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'CONFIRMADO' THEN 'Confirmado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('EN_REVISION', 'IN_REVIEW') THEN 'En_Revision'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('PENDIENTE', 'PENDING') THEN 'Pendiente'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('RECHAZADO', 'REJECTED') THEN 'Rechazado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'FALLIDO' THEN 'Fallido'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('REVERTIDO', 'REVERTED') THEN 'Revertido'
                    ELSE 'DESCONOCIDO'
                END AS EstadoNaturalPago,
                -- H01: Solo es formalmente validado si su estado es Validado o si es Confirmado con evidencia verificable
                CASE
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED') THEN 1
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'CONFIRMADO'
                         AND p.referencia_pago IS NOT NULL
                         AND p.fecha_validacion IS NOT NULL
                         AND p.fecha_validacion >= p.fecha_registro THEN 1
                    ELSE 0
                END AS EsValidadoOficial,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO') THEN 1
                    ELSE 0
                END AS EsRecaudadoOperativo
            FROM [NexoSaludDB].dbo.Pagos p
            WHERE p.fecha_registro IS NOT NULL
        ),
        SourceF1 AS (
            SELECT
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempo,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyPasarela, 0) AS KeyPasarela,
                ISNULL(dc.KeyCobro, 0) AS KeyCobro,
                COUNT(pn.id_pago) AS PagosRegistrados,
                SUM(pn.EsValidadoOficial) AS PagosValidados,
                SUM(CASE WHEN pn.EstadoNaturalPago IN ('Pendiente', 'En_Revision', 'Confirmado') AND pn.EsValidadoOficial = 0 THEN 1 ELSE 0 END) AS PagosPendientes,
                SUM(CASE WHEN pn.EstadoNaturalPago IN ('Rechazado', 'Fallido') THEN 1 ELSE 0 END) AS PagosRechazados,
                SUM(CASE WHEN pn.EstadoNaturalPago = 'Revertido' THEN 1 ELSE 0 END) AS PagosRevertidos,
                SUM(CASE WHEN pn.EsRecaudadoOperativo = 1 THEN pn.importe ELSE 0.00 END) AS IngresosBrutosRecaudados,
                -- H07: CostoTransaccionPasarela solo reporta comisión cuando existe contrato verificado en Dim_Pasarela
                SUM(CASE
                    WHEN dp.EstadoTasa = 'VERIFICADO_CONTRACTUAL' AND dp.TasaComisionContractual IS NOT NULL AND pn.EsValidadoOficial = 1
                    THEN ROUND(pn.importe * dp.TasaComisionContractual, 2)
                    ELSE 0.00
                END) AS CostoTransaccionPasarela,
                SUM(CASE
                    WHEN dp.EstadoTasa = 'VERIFICADO_CONTRACTUAL' AND dp.TasaComisionContractual IS NOT NULL AND pn.EsValidadoOficial = 1
                    THEN ROUND(pn.importe * dp.TasaComisionContractual, 2)
                    ELSE NULL
                END) AS CostoPasarelaVerificado,
                SUM(CASE
                    WHEN pn.EsRecaudadoOperativo = 1 THEN ROUND(pn.importe * 0.035, 2)
                    ELSE 0.00
                END) AS CostoPasarelaEstimadoNoContractual
            FROM PagosNormalizados pn
            INNER JOIN [NexoSaludDB].dbo.Reservas r ON r.id_reserva = pn.id_reserva
            LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
            LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
            LEFT JOIN [NexoSaludDB].dbo.Solicitudes sol ON sol.id_solicitud = r.id_solicitud
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(pn.fecha_registro AS DATE)
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = disp.id_sede
            LEFT JOIN dbo.Dim_Servicio dserv ON dserv.id_servicio = sol.id_servicio
            LEFT JOIN dbo.Dim_Pasarela dp ON dp.MetodoPago = pn.canal_pago
            LEFT JOIN dbo.Dim_Cobro dc ON dc.EstadoPago = pn.EstadoNaturalPago
            GROUP BY
                ISNULL(dt.KeyTiempo, 0),
                ISNULL(ds.KeySede, 0),
                ISNULL(dserv.KeyServicio, 0),
                ISNULL(dp.KeyPasarela, 0),
                ISNULL(dc.KeyCobro, 0)
        )
        MERGE dbo.Fact_RecaudacionPayer AS target
        USING SourceF1 AS src
        ON  target.KeyTiempo = src.KeyTiempo
        AND target.KeySede = src.KeySede
        AND target.KeyServicio = src.KeyServicio
        AND target.KeyPasarela = src.KeyPasarela
        AND target.KeyCobro = src.KeyCobro
        WHEN MATCHED THEN
            UPDATE SET
                target.PagosRegistrados = src.PagosRegistrados,
                target.PagosValidados = src.PagosValidados,
                target.PagosPendientes = src.PagosPendientes,
                target.PagosRechazados = src.PagosRechazados,
                target.PagosRevertidos = src.PagosRevertidos,
                target.IngresosBrutosRecaudados = src.IngresosBrutosRecaudados,
                target.CostoTransaccionPasarela = src.CostoTransaccionPasarela,
                target.CostoPasarelaVerificado = src.CostoPasarelaVerificado,
                target.CostoPasarelaEstimadoNoContractual = src.CostoPasarelaEstimadoNoContractual
        WHEN NOT MATCHED THEN
            INSERT (
                KeyTiempo, KeySede, KeyServicio, KeyPasarela, KeyCobro,
                PagosRegistrados, PagosValidados, PagosPendientes, PagosRechazados, PagosRevertidos,
                IngresosBrutosRecaudados, CostoTransaccionPasarela, CostoPasarelaVerificado, CostoPasarelaEstimadoNoContractual
            )
            VALUES (
                src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyPasarela, src.KeyCobro,
                src.PagosRegistrados, src.PagosValidados, src.PagosPendientes, src.PagosRechazados, src.PagosRevertidos,
                src.IngresosBrutosRecaudados, src.CostoTransaccionPasarela, src.CostoPasarelaVerificado, src.CostoPasarelaEstimadoNoContractual
            );

        -- --------------------------------------------------------------------
        -- 1.4. CARGA F2: Fact_ValidacionIncidenciaPayer (Resuelve H04, H05, H06)
        -- Pre-agrega Incidencias por id_pago para impedir Fan-Trap (H05)
        -- Excluye tiempos ficticios de 15 min y duraciones negativas (H06)
        -- --------------------------------------------------------------------
        ;WITH IncidenciasPorPago AS (
            SELECT
                inc.id_pago,
                COUNT(inc.id_incidencia) AS CantidadIncidenciasPago,
                MAX(inc.tipo) AS TipoIncidenciaPrincipal
            FROM [NexoSaludDB].dbo.Incidencias inc
            WHERE inc.id_pago IS NOT NULL
            GROUP BY inc.id_pago
        ),
        PagosBaseF2 AS (
            SELECT
                p.id_pago,
                p.id_reserva,
                p.fecha_registro,
                p.fecha_validacion,
                p.canal_pago,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED') THEN 'Validado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'CONFIRMADO' THEN 'Confirmado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('EN_REVISION', 'IN_REVIEW') THEN 'En_Revision'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('PENDIENTE', 'PENDING') THEN 'Pendiente'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('RECHAZADO', 'REJECTED') THEN 'Rechazado'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'FALLIDO' THEN 'Fallido'
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('REVERTIDO', 'REVERTED') THEN 'Revertido'
                    ELSE 'DESCONOCIDO'
                END AS EstadoNaturalPago,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED') THEN 1
                    WHEN UPPER(LTRIM(RTRIM(p.estado))) = 'CONFIRMADO'
                         AND p.referencia_pago IS NOT NULL
                         AND p.fecha_validacion IS NOT NULL
                         AND p.fecha_validacion >= p.fecha_registro THEN 1
                    ELSE 0
                END AS EsValidadoOficial,
                -- H06: Solo medir tiempo real cuando existen ambas marcas temporales y fecha_validacion >= fecha_registro
                CASE
                    WHEN p.fecha_validacion IS NOT NULL
                         AND p.fecha_registro IS NOT NULL
                         AND p.fecha_validacion >= p.fecha_registro
                         AND UPPER(LTRIM(RTRIM(p.estado))) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO')
                    THEN DATEDIFF(MINUTE, p.fecha_registro, p.fecha_validacion)
                    ELSE NULL
                END AS MinutosValidacionReal,
                ISNULL(ip.CantidadIncidenciasPago, 0) AS CantidadIncidenciasPago,
                ISNULL(ip.TipoIncidenciaPrincipal, 'CONFORME') AS TipoIncidenciaPrincipal
            FROM [NexoSaludDB].dbo.Pagos p
            LEFT JOIN IncidenciasPorPago ip ON ip.id_pago = p.id_pago
            WHERE p.fecha_registro IS NOT NULL
        ),
        SourceF2 AS (
            SELECT
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempo,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dp.KeyPasarela, 0) AS KeyPasarela,
                ISNULL(dc.KeyCobro, 0) AS KeyCobro,
                ISNULL(di.KeyIncidencia, 0) AS KeyIncidencia,
                SUM(ISNULL(pb.MinutosValidacionReal, 0)) AS TiempoTotalValidacionMin,
                SUM(pb.EsValidadoOficial) AS PagosValidados,
                SUM(CASE WHEN pb.MinutosValidacionReal IS NOT NULL THEN 1 ELSE 0 END) AS PagosConTiempoMedible,
                SUM(pb.CantidadIncidenciasPago) AS CantidadIncidencias,
                SUM(CASE WHEN pb.EstadoNaturalPago IN ('Rechazado', 'Fallido') THEN 1 ELSE 0 END) AS PagosRechazados,
                SUM(CASE WHEN pb.EstadoNaturalPago = 'Revertido' THEN 1 ELSE 0 END) AS PagosRevertidos
            FROM PagosBaseF2 pb
            INNER JOIN [NexoSaludDB].dbo.Reservas r ON r.id_reserva = pb.id_reserva
            LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
            LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(pb.fecha_registro AS DATE)
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = disp.id_sede
            LEFT JOIN dbo.Dim_Pasarela dp ON dp.MetodoPago = pb.canal_pago
            LEFT JOIN dbo.Dim_Cobro dc ON dc.EstadoPago = pb.EstadoNaturalPago
            LEFT JOIN dbo.Dim_Incidencia di ON di.KeyIncidencia = (
                SELECT TOP 1 d2.KeyIncidencia
                FROM dbo.Dim_Incidencia d2
                WHERE d2.TipoIncidencia = pb.TipoIncidenciaPrincipal
                ORDER BY d2.KeyIncidencia ASC
            )
            GROUP BY
                ISNULL(dt.KeyTiempo, 0),
                ISNULL(ds.KeySede, 0),
                ISNULL(dp.KeyPasarela, 0),
                ISNULL(dc.KeyCobro, 0),
                ISNULL(di.KeyIncidencia, 0)
        )
        MERGE dbo.Fact_ValidacionIncidenciaPayer AS target
        USING SourceF2 AS src
        ON  target.KeyTiempo = src.KeyTiempo
        AND target.KeySede = src.KeySede
        AND target.KeyPasarela = src.KeyPasarela
        AND target.KeyCobro = src.KeyCobro
        AND target.KeyIncidencia = src.KeyIncidencia
        WHEN MATCHED THEN
            UPDATE SET
                target.TiempoTotalValidacionMin = src.TiempoTotalValidacionMin,
                target.PagosValidados = src.PagosValidados,
                target.PagosConTiempoMedible = src.PagosConTiempoMedible,
                target.CantidadIncidencias = src.CantidadIncidencias,
                target.PagosRechazados = src.PagosRechazados,
                target.PagosRevertidos = src.PagosRevertidos
        WHEN NOT MATCHED THEN
            INSERT (
                KeyTiempo, KeySede, KeyPasarela, KeyCobro, KeyIncidencia,
                TiempoTotalValidacionMin, PagosValidados, PagosConTiempoMedible,
                CantidadIncidencias, PagosRechazados, PagosRevertidos
            )
            VALUES (
                src.KeyTiempo, src.KeySede, src.KeyPasarela, src.KeyCobro, src.KeyIncidencia,
                src.TiempoTotalValidacionMin, src.PagosValidados, src.PagosConTiempoMedible,
                src.CantidadIncidencias, src.PagosRechazados, src.PagosRevertidos
            );

        -- --------------------------------------------------------------------
        -- 1.5. CARGA F3: Fact_ConversionCobranzaPayer (Resuelve H04 y H05)
        -- Pre-agrega Pagos y Tratamientos/Atenciones por id_reserva para
        -- impedir que una reserva con 4 sesiones cuente como 4 reservas!
        -- --------------------------------------------------------------------
        ;WITH PagosPorReserva AS (
            SELECT
                p.id_reserva,
                COUNT(p.id_pago) AS CantPagosReserva
            FROM [NexoSaludDB].dbo.Pagos p
            GROUP BY p.id_reserva
        ),
        ConversionPorReserva AS (
            SELECT
                r.id_reserva,
                CASE
                    WHEN EXISTS (SELECT 1 FROM [NexoSaludDB].dbo.TratamientosContratados t WHERE t.id_reserva_origen = r.id_reserva)
                      OR EXISTS (SELECT 1 FROM [NexoSaludDB].dbo.Atenciones a WHERE a.id_reserva = r.id_reserva)
                    THEN 1 ELSE 0
                END AS ConvirtioACustomer
            FROM [NexoSaludDB].dbo.Reservas r
        ),
        SourceF3 AS (
            SELECT
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempo,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dserv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dn.KeyNotificacion, 0) AS KeyNotificacion,
                ISNULL(dr.KeyRiesgoImpago, 0) AS KeyRiesgoImpago,
                COUNT(r.id_reserva) AS ReservasPreagendadas,
                SUM(CASE WHEN r.estado IN ('Confirmada', 'Atendida', 'CONFIRMADA') THEN 1 ELSE 0 END) AS ReservasConfirmadas,
                SUM(CASE WHEN r.estado IN ('Cancelada', 'Vencida', 'CANCELADA') THEN 1 ELSE 0 END) AS ReservasCanceladasImpago,
                SUM(ISNULL(cr.ConvirtioACustomer, 0)) AS ConversionesACustomer,
                SUM(ISNULL(pr.CantPagosReserva, 0)) AS PagosRegistrados
            FROM [NexoSaludDB].dbo.Reservas r
            LEFT JOIN PagosPorReserva pr ON pr.id_reserva = r.id_reserva
            LEFT JOIN ConversionPorReserva cr ON cr.id_reserva = r.id_reserva
            LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
            LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
            LEFT JOIN [NexoSaludDB].dbo.Solicitudes sol ON sol.id_solicitud = r.id_solicitud
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(r.fecha_reserva AS DATE)
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = disp.id_sede
            LEFT JOIN dbo.Dim_Servicio dserv ON dserv.id_servicio = sol.id_servicio
            LEFT JOIN dbo.Dim_NotificacionCobranza dn ON dn.EtapaCadencia = ISNULL(r.ultima_alerta_dunning, 'Sin Notificación Previa')
            LEFT JOIN dbo.Dim_RiesgoImpago dr ON dr.NivelRiesgo = (
                CASE
                    WHEN r.score_riesgo_impago >= 65 THEN 'ALTO'
                    WHEN r.score_riesgo_impago >= 40 THEN 'MODERADO'
                    WHEN r.score_riesgo_impago IS NOT NULL THEN 'BAJO'
                    ELSE 'NO_EVALUADO'
                END
            )
            WHERE r.fecha_reserva IS NOT NULL
            GROUP BY
                ISNULL(dt.KeyTiempo, 0),
                ISNULL(ds.KeySede, 0),
                ISNULL(dserv.KeyServicio, 0),
                ISNULL(dn.KeyNotificacion, 0),
                ISNULL(dr.KeyRiesgoImpago, 0)
        )
        MERGE dbo.Fact_ConversionCobranzaPayer AS target
        USING SourceF3 AS src
        ON  target.KeyTiempo = src.KeyTiempo
        AND target.KeySede = src.KeySede
        AND target.KeyServicio = src.KeyServicio
        AND target.KeyNotificacion = src.KeyNotificacion
        AND target.KeyRiesgoImpago = src.KeyRiesgoImpago
        WHEN MATCHED THEN
            UPDATE SET
                target.ReservasPreagendadas = src.ReservasPreagendadas,
                target.ReservasConfirmadas = src.ReservasConfirmadas,
                target.ReservasCanceladasImpago = src.ReservasCanceladasImpago,
                target.ConversionesACustomer = src.ConversionesACustomer,
                target.PagosRegistrados = src.PagosRegistrados
        WHEN NOT MATCHED THEN
            INSERT (
                KeyTiempo, KeySede, KeyServicio, KeyNotificacion, KeyRiesgoImpago,
                ReservasPreagendadas, ReservasConfirmadas, ReservasCanceladasImpago,
                ConversionesACustomer, PagosRegistrados
            )
            VALUES (
                src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyNotificacion, src.KeyRiesgoImpago,
                src.ReservasPreagendadas, src.ReservasConfirmadas, src.ReservasCanceladasImpago,
                src.ConversionesACustomer, src.PagosRegistrados
            );

        -- Reconciliación F3: ReservasPreagendadas en Mart debe coincidir exactamente con Reservas en OLTP
        SELECT @FilasOrigen = COUNT(*) FROM [NexoSaludDB].dbo.Reservas WHERE fecha_reserva IS NOT NULL;
        SELECT @FilasDestino = ISNULL(SUM(ReservasPreagendadas), 0) FROM dbo.Fact_ConversionCobranzaPayer;

        IF @FilasOrigen <> @FilasDestino
        BEGIN
            THROW 56002, 'Error de reconciliación en Fact_ConversionCobranzaPayer (H05): El conteo de reservas no coincide con OLTP.', 1;
        END;

        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES ('usp_ETL_SincronizarPayerMart', @FechaInicio, SYSDATETIME(), 'EXITOSO', @FilasOrigen, @FilasDestino, 'F1, F2 y F3 sincronizados sin Fan-Trap ni tiempos artificiales.');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES ('usp_ETL_SincronizarPayerMart', @FechaInicio, SYSDATETIME(), 'ERROR', @FilasOrigen, @FilasDestino, LEFT(@ErrMsg, 500));

        THROW;
    END CATCH;
END;
GO

-- ====================================================================
-- SECCIÓN 2: PROCEDIMIENTO ETL DE CUSTOMER (SECCIÓN 9, T19, T20)
-- ====================================================================

IF OBJECT_ID('dbo.usp_ETL_SincronizarCustomerMart', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ETL_SincronizarCustomerMart;
GO

CREATE PROCEDURE dbo.usp_ETL_SincronizarCustomerMart
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaInicio DATETIME2 = SYSDATETIME();
    DECLARE @FilasOrigen INT = 0;
    DECLARE @FilasDestino INT = 0;
    DECLARE @AppLockResult INT;

    BEGIN TRANSACTION;

    EXEC @AppLockResult = sp_getapplock
        @Resource = 'ETL_NexoSalud_Customer_Lock',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 30000;

    IF @AppLockResult < 0
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 56101, 'No se pudo obtener el bloqueo exclusivo para usp_ETL_SincronizarCustomerMart.', 1;
    END;

    BEGIN TRY
        -- --------------------------------------------------------------------
        -- 2.1. SINCRONIZACIÓN DE DIMENSIONES CONFORMADAS DESDE OLTP
        -- --------------------------------------------------------------------
        ;WITH FechasCustomerOLTP AS (
            SELECT CAST(fecha_contratacion AS DATE) AS fecha FROM [NexoSaludDB].dbo.TratamientosContratados WHERE fecha_contratacion IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_real AS DATE) FROM [NexoSaludDB].dbo.TratamientosContratados WHERE fecha_inicio_real IS NOT NULL
            UNION
            SELECT CAST(fecha_cierre_real AS DATE) FROM [NexoSaludDB].dbo.TratamientosContratados WHERE fecha_cierre_real IS NOT NULL
            UNION
            SELECT CAST(fecha_programada_vigente AS DATE) FROM [NexoSaludDB].dbo.SesionesTratamiento WHERE fecha_programada_vigente IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_atencion AS DATE) FROM [NexoSaludDB].dbo.SesionesTratamiento WHERE fecha_inicio_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_atencion AS DATE) FROM [NexoSaludDB].dbo.Atenciones WHERE fecha_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [NexoSaludDB].dbo.InteraccionesIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [NexoSaludDB].dbo.AlertasIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [NexoSaludDB].dbo.BorradoresIA WHERE fecha_hora IS NOT NULL
        )
        INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
        SELECT
            YEAR(f.fecha) * 10000 + MONTH(f.fecha) * 100 + DAY(f.fecha),
            f.fecha,
            YEAR(f.fecha),
            DATEPART(QUARTER, f.fecha),
            MONTH(f.fecha),
            DAY(f.fecha)
        FROM FechasCustomerOLTP f
        WHERE f.fecha IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo dt WHERE dt.id_fecha = f.fecha);

        -- Sincronizar Dim_Sede por id_sede
        INSERT INTO dbo.Dim_Sede (id_sede, Sede, Distrito, Zona)
        SELECT s.id_sede, s.nombre, ISNULL(s.zona, 'Lima'), ISNULL(s.zona, 'Lima Metropolitana')
        FROM [NexoSaludDB].dbo.Sedes s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede ds WHERE ds.id_sede = s.id_sede);

        -- Sincronizar Dim_Servicio por id_servicio
        INSERT INTO dbo.Dim_Servicio (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
        SELECT sv.id_servicio, sv.nombre, ISNULL(sv.descripcion, 'Odontología General'), sv.nombre
        FROM [NexoSaludDB].dbo.Servicios sv
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio dsv WHERE dsv.id_servicio = sv.id_servicio);

        -- Sincronizar Dim_Profesional por id_profesional
        INSERT INTO dbo.Dim_Profesional (id_profesional, Odontologo, EspecialidadPrincipal)
        SELECT p.id_profesional, p.nombres + ' ' + p.apellidos, ISNULL(p.especialidad, 'Odontología General')
        FROM [NexoSaludDB].dbo.Profesionales p
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Profesional dp WHERE dp.id_profesional = p.id_profesional);

        -- Sincronizar combinaciones nuevas de Dim_EstadoAtencion
        INSERT INTO dbo.Dim_EstadoAtencion (EstadoFinal, Asistencia, EstadoCierreDocumental)
        SELECT DISTINCT
            a.estado_servicio,
            a.asistencia,
            ISNULL(a.estado_cierre_documental, 'Pendiente')
        FROM [NexoSaludDB].dbo.Atenciones a
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.Dim_EstadoAtencion da
            WHERE da.EstadoFinal = a.estado_servicio
              AND da.Asistencia = a.asistencia
        );

        -- --------------------------------------------------------------------
        -- 2.2. CARGA HECHO 1: dbo.Fact_TratamientoCustomer (Análisis A)
        -- Grano: 1 fila por id_tratamiento
        -- --------------------------------------------------------------------
        ;WITH SesionesCompletadasPorTratamiento AS (
            SELECT
                s.id_tratamiento,
                SUM(CASE WHEN s.estado_asistencial = 'Realizada' AND s.estado_cierre = 'Cerrada' THEN 1 ELSE 0 END) AS sesiones_completadas
            FROM [NexoSaludDB].dbo.SesionesTratamiento s
            GROUP BY s.id_tratamiento
        ),
        PlanVigentePorTratamiento AS (
            SELECT
                pt.id_tratamiento,
                pt.version_plan,
                pt.sesiones_planificadas,
                ROW_NUMBER() OVER (PARTITION BY pt.id_tratamiento ORDER BY pt.version_plan DESC) AS rn
            FROM [NexoSaludDB].dbo.PlanTratamiento pt
            WHERE pt.es_vigente = 1
        ),
        SourceTratamiento AS (
            SELECT
                t.id_tratamiento,
                t.id_persona,
                t.id_reserva_origen,
                ISNULL(pv.version_plan, 1) AS version_plan_vigente,
                ISNULL(dt_con.KeyTiempo, 0) AS KeyTiempoContratacion,
                ISNULL(dt_ini.KeyTiempo, 0) AS KeyTiempoInicio,
                ISNULL(dt_cie.KeyTiempo, 0) AS KeyTiempoCierre,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(det.KeyEstadoTratamiento, 0) AS KeyEstadoTratamiento,
                CASE
                    WHEN t.fecha_inicio_real IS NOT NULL OR t.estado_tratamiento IN ('En ejecución', 'Completado') THEN 1
                    ELSE 0
                END AS tratamientos_iniciados,
                CASE
                    WHEN t.estado_tratamiento = 'Completado'
                         AND t.fecha_inicio_real IS NOT NULL
                         AND t.fecha_cierre_real IS NOT NULL
                         AND t.fecha_cierre_real >= t.fecha_inicio_real
                    THEN 1
                    ELSE 0
                END AS tratamientos_completados,
                CASE WHEN ISNULL(pv.sesiones_planificadas, 1) >= 1 THEN ISNULL(pv.sesiones_planificadas, 1) ELSE 1 END AS sesiones_planificadas,
                ISNULL(sc.sesiones_completadas, 0) AS sesiones_completadas,
                CASE
                    WHEN t.estado_tratamiento = 'Completado'
                         AND t.fecha_inicio_real IS NOT NULL
                         AND t.fecha_cierre_real IS NOT NULL
                         AND t.fecha_cierre_real >= t.fecha_inicio_real
                    THEN DATEDIFF(DAY, t.fecha_inicio_real, t.fecha_cierre_real)
                    ELSE NULL
                END AS dias_duracion_real
            FROM [NexoSaludDB].dbo.TratamientosContratados t
            LEFT JOIN PlanVigentePorTratamiento pv ON pv.id_tratamiento = t.id_tratamiento AND pv.rn = 1
            LEFT JOIN SesionesCompletadasPorTratamiento sc ON sc.id_tratamiento = t.id_tratamiento
            LEFT JOIN dbo.Dim_Tiempo dt_con ON dt_con.id_fecha = CAST(t.fecha_contratacion AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_ini ON dt_ini.id_fecha = CAST(t.fecha_inicio_real AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_cie ON dt_cie.id_fecha = CAST(t.fecha_cierre_real AS DATE)
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = t.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = t.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = t.id_profesional_responsable
            LEFT JOIN dbo.Dim_EstadoTratamiento det ON det.EstadoTratamiento = t.estado_tratamiento
        )
        MERGE dbo.Fact_TratamientoCustomer AS target
        USING SourceTratamiento AS src
        ON target.id_tratamiento = src.id_tratamiento
        WHEN MATCHED THEN
            UPDATE SET
                target.id_persona = src.id_persona,
                target.id_reserva_origen = src.id_reserva_origen,
                target.version_plan_vigente = src.version_plan_vigente,
                target.KeyTiempoContratacion = src.KeyTiempoContratacion,
                target.KeyTiempoInicio = src.KeyTiempoInicio,
                target.KeyTiempoCierre = src.KeyTiempoCierre,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoTratamiento = src.KeyEstadoTratamiento,
                target.tratamientos_iniciados = src.tratamientos_iniciados,
                target.tratamientos_completados = src.tratamientos_completados,
                target.sesiones_planificadas = src.sesiones_planificadas,
                target.sesiones_completadas = src.sesiones_completadas,
                target.dias_duracion_real = src.dias_duracion_real,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_tratamiento, id_persona, id_reserva_origen, version_plan_vigente,
                KeyTiempoContratacion, KeyTiempoInicio, KeyTiempoCierre,
                KeySede, KeyServicio, KeyProfesional, KeyEstadoTratamiento,
                tratamientos_iniciados, tratamientos_completados,
                sesiones_planificadas, sesiones_completadas, dias_duracion_real,
                fecha_corte_etl
            )
            VALUES (
                src.id_tratamiento, src.id_persona, src.id_reserva_origen, src.version_plan_vigente,
                src.KeyTiempoContratacion, src.KeyTiempoInicio, src.KeyTiempoCierre,
                src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoTratamiento,
                src.tratamientos_iniciados, src.tratamientos_completados,
                src.sesiones_planificadas, src.sesiones_completadas, src.dias_duracion_real,
                SYSDATETIME()
            )
        WHEN NOT MATCHED BY SOURCE THEN
            DELETE;

        -- --------------------------------------------------------------------
        -- 2.3. CARGA HECHO 2: dbo.Fact_SesionCustomer (Análisis B)
        -- Grano: 1 fila por id_sesion
        -- --------------------------------------------------------------------
        ;WITH ReprogramacionesPorSesion AS (
            SELECT
                ev.id_sesion,
                SUM(CASE WHEN ev.tipo_cambio = 'REPROGRAMACION' THEN 1 ELSE 0 END) AS cant_reprogramaciones
            FROM [NexoSaludDB].dbo.EventosSesion ev
            GROUP BY ev.id_sesion
        ),
        SourceSesion AS (
            SELECT
                s.id_sesion,
                s.id_tratamiento,
                t.id_persona,
                s.numero_sesion,
                ISNULL(dt_prog.KeyTiempo, 0) AS KeyTiempoProgramada,
                ISNULL(dt_ejec.KeyTiempo, 0) AS KeyTiempoEjecucion,
                ISNULL(dh.KeyHora, 0) AS KeyHoraProgramada,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(des.KeyEstadoSesion, 0) AS KeyEstadoSesion,
                CASE WHEN s.estado_programacion IN ('Programada', 'Reprogramada') THEN 1 ELSE 0 END AS sesiones_programadas,
                CASE WHEN s.estado_asistencial = 'Realizada' THEN 1 ELSE 0 END AS sesiones_realizadas,
                CASE WHEN s.estado_asistencial = 'Inasistida' THEN 1 ELSE 0 END AS sesiones_inasistidas,
                ISNULL(rp.cant_reprogramaciones, 0) AS reprogramaciones_acumuladas,
                -- Prohibido inventar tiempo de espera cuando falta fecha_llegada o fecha_inicio_atencion
                CASE
                    WHEN s.fecha_llegada IS NOT NULL
                         AND s.fecha_inicio_atencion IS NOT NULL
                         AND s.fecha_inicio_atencion >= s.fecha_llegada
                    THEN DATEDIFF(MINUTE, s.fecha_llegada, s.fecha_inicio_atencion)
                    ELSE NULL
                END AS minutos_espera,
                -- Sesiones futuras pendientes no contaminan denominadores de asistencia (T16)
                CASE
                    WHEN s.estado_asistencial IN ('Realizada', 'Inasistida', 'En sala de espera', 'En atención') THEN 1
                    WHEN s.estado_programacion IN ('Programada', 'Reprogramada') AND s.fecha_programada_vigente <= SYSDATETIME() THEN 1
                    ELSE 0
                END AS sesion_evaluable,
                CASE
                    WHEN s.fecha_llegada IS NOT NULL
                         AND s.fecha_inicio_atencion IS NOT NULL
                         AND s.fecha_inicio_atencion >= s.fecha_llegada
                    THEN 1
                    ELSE 0
                END AS tiene_espera_medible
            FROM [NexoSaludDB].dbo.SesionesTratamiento s
            INNER JOIN [NexoSaludDB].dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento
            LEFT JOIN ReprogramacionesPorSesion rp ON rp.id_sesion = s.id_sesion
            LEFT JOIN dbo.Dim_Tiempo dt_prog ON dt_prog.id_fecha = CAST(s.fecha_programada_vigente AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_ejec ON dt_ejec.id_fecha = CAST(COALESCE(s.fecha_inicio_atencion, s.fecha_cierre_sesion) AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, s.fecha_programada_vigente) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = s.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = t.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = s.id_profesional
            LEFT JOIN dbo.Dim_EstadoSesion des ON des.EstadoProgramacion = s.estado_programacion
                                              AND des.EstadoAsistencial = s.estado_asistencial
                                              AND des.EstadoCierre = s.estado_cierre
        )
        MERGE dbo.Fact_SesionCustomer AS target
        USING SourceSesion AS src
        ON target.id_sesion = src.id_sesion
        WHEN MATCHED THEN
            UPDATE SET
                target.id_tratamiento = src.id_tratamiento,
                target.id_persona = src.id_persona,
                target.numero_sesion = src.numero_sesion,
                target.KeyTiempoProgramada = src.KeyTiempoProgramada,
                target.KeyTiempoEjecucion = src.KeyTiempoEjecucion,
                target.KeyHoraProgramada = src.KeyHoraProgramada,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoSesion = src.KeyEstadoSesion,
                target.sesiones_programadas = src.sesiones_programadas,
                target.sesiones_realizadas = src.sesiones_realizadas,
                target.sesiones_inasistidas = src.sesiones_inasistidas,
                target.reprogramaciones_acumuladas = src.reprogramaciones_acumuladas,
                target.minutos_espera = src.minutos_espera,
                target.sesion_evaluable = src.sesion_evaluable,
                target.tiene_espera_medible = src.tiene_espera_medible,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_sesion, id_tratamiento, id_persona, numero_sesion,
                KeyTiempoProgramada, KeyTiempoEjecucion, KeyHoraProgramada,
                KeySede, KeyServicio, KeyProfesional, KeyEstadoSesion,
                sesiones_programadas, sesiones_realizadas, sesiones_inasistidas,
                reprogramaciones_acumuladas, minutos_espera,
                sesion_evaluable, tiene_espera_medible, fecha_corte_etl
            )
            VALUES (
                src.id_sesion, src.id_tratamiento, src.id_persona, src.numero_sesion,
                src.KeyTiempoProgramada, src.KeyTiempoEjecucion, src.KeyHoraProgramada,
                src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoSesion,
                src.sesiones_programadas, src.sesiones_realizadas, src.sesiones_inasistidas,
                src.reprogramaciones_acumuladas, src.minutos_espera,
                src.sesion_evaluable, src.tiene_espera_medible, SYSDATETIME()
            )
        WHEN NOT MATCHED BY SOURCE THEN
            DELETE;

        -- --------------------------------------------------------------------
        -- 2.4. CARGA HECHO 3: dbo.Fact_AtencionCustomer_V2 (Análisis C)
        -- Grano: 1 fila por id_atencion
        -- --------------------------------------------------------------------
        ;WITH ProcedimientosPorAtencion AS (
            SELECT
                dp.id_atencion,
                COUNT(dp.id_detalle_procedimiento) AS cant_procedimientos
            FROM [NexoSaludDB].dbo.DetalleProcedimiento dp
            GROUP BY dp.id_atencion
        ),
        IndicacionesPorAtencion AS (
            SELECT
                ind.id_atencion,
                SUM(CASE WHEN ind.es_version_vigente = 1 AND ind.estado = 'Documento emitido' THEN 1 ELSE 0 END) AS cant_indicaciones_emitidas
            FROM [NexoSaludDB].dbo.IndicacionesPostatencion ind
            GROUP BY ind.id_atencion
        ),
        PrimeraRevisionFicha AS (
            SELECT
                vf.id_atencion,
                vf.resultado_validacion
            FROM [NexoSaludDB].dbo.ValidacionesFicha vf
            WHERE vf.numero_revision = 1
        ),
        SourceAtencionV2 AS (
            SELECT
                a.id_atencion,
                a.id_sesion,
                a.id_tratamiento,
                a.id_persona,
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempoAtencion,
                ISNULL(dh.KeyHora, 0) AS KeyHoraAtencion,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(dea.KeyEstadoAtencion, 0) AS KeyEstadoAtencion,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 1
                    ELSE 0
                END AS atenciones_realizadas,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
                    ELSE NULL
                END AS minutos_consulta,
                -- C6: Evalúa estrictamente la primera revisión (numero_revision = 1) en ValidacionesFicha
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND vf1.resultado_validacion = 'Completa'
                    THEN 1
                    ELSE 0
                END AS fichas_completas,
                ISNULL(ind.cant_indicaciones_emitidas, 0) AS indicaciones_emitidas,
                ISNULL(proc_a.cant_procedimientos, 0) AS procedimientos_registrados,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN 1
                    ELSE 0
                END AS tiene_duracion_medible,
                CASE
                    WHEN ISNULL(ind.cant_indicaciones_emitidas, 0) >= 1 THEN 1
                    ELSE 0
                END AS atencion_con_indicacion_emitida
            FROM [NexoSaludDB].dbo.Atenciones a
            LEFT JOIN ProcedimientosPorAtencion proc_a ON proc_a.id_atencion = a.id_atencion
            LEFT JOIN IndicacionesPorAtencion ind ON ind.id_atencion = a.id_atencion
            LEFT JOIN PrimeraRevisionFicha vf1 ON vf1.id_atencion = a.id_atencion
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(a.fecha_atencion AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, COALESCE(a.fecha_inicio, a.fecha_atencion)) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = a.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = a.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = a.id_profesional
            LEFT JOIN dbo.Dim_EstadoAtencion dea ON dea.KeyEstadoAtencion = (
                SELECT TOP 1 d2.KeyEstadoAtencion
                FROM dbo.Dim_EstadoAtencion d2
                WHERE d2.EstadoFinal = a.estado_servicio AND d2.Asistencia = a.asistencia
                ORDER BY d2.KeyEstadoAtencion ASC
            )
        )
        MERGE dbo.Fact_AtencionCustomer_V2 AS target
        USING SourceAtencionV2 AS src
        ON target.id_atencion = src.id_atencion
        WHEN MATCHED THEN
            UPDATE SET
                target.id_sesion = src.id_sesion,
                target.id_tratamiento = src.id_tratamiento,
                target.id_persona = src.id_persona,
                target.KeyTiempoAtencion = src.KeyTiempoAtencion,
                target.KeyHoraAtencion = src.KeyHoraAtencion,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoAtencion = src.KeyEstadoAtencion,
                target.atenciones_realizadas = src.atenciones_realizadas,
                target.minutos_consulta = src.minutos_consulta,
                target.fichas_completas = src.fichas_completas,
                target.indicaciones_emitidas = src.indicaciones_emitidas,
                target.procedimientos_registrados = src.procedimientos_registrados,
                target.tiene_duracion_medible = src.tiene_duracion_medible,
                target.atencion_con_indicacion_emitida = src.atencion_con_indicacion_emitida,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_atencion, id_sesion, id_tratamiento, id_persona,
                KeyTiempoAtencion, KeyHoraAtencion, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
                atenciones_realizadas, minutos_consulta, fichas_completas,
                indicaciones_emitidas, procedimientos_registrados,
                tiene_duracion_medible, atencion_con_indicacion_emitida, fecha_corte_etl
            )
            VALUES (
                src.id_atencion, src.id_sesion, src.id_tratamiento, src.id_persona,
                src.KeyTiempoAtencion, src.KeyHoraAtencion, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoAtencion,
                src.atenciones_realizadas, src.minutos_consulta, src.fichas_completas,
                src.indicaciones_emitidas, src.procedimientos_registrados,
                src.tiene_duracion_medible, src.atencion_con_indicacion_emitida, SYSDATETIME()
            )
        WHEN NOT MATCHED BY SOURCE THEN
            DELETE;

        -- --------------------------------------------------------------------
        -- 2.5. CARGA HECHO 4: dbo.Fact_InteraccionIACustomer (Análisis D)
        -- Grano: 1 fila por (ClaseEventoIA, id_origen_ia)
        -- --------------------------------------------------------------------
        ;WITH EventosIAUnificados AS (
            -- A) InteraccionesIA
            SELECT
                'INTERACCION' AS ClaseEventoIA,
                i.id_interaccion_ia AS id_origen_ia,
                i.id_persona,
                i.id_tratamiento,
                i.id_sesion,
                i.id_atencion,
                COALESCE(i.id_profesional, t.id_profesional_responsable) AS id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                i.fecha_hora,
                i.tipo_evento AS CodigoTipoInteraccionIA,
                i.actor_orientado AS CodigoTipoUsuarioIA,
                CASE
                    WHEN i.estado = 'Aprobada' THEN 'INTERACCION_APROBADA'
                    WHEN i.estado = 'Derivada_Personal' THEN 'INTERACCION_DERIVADA_PERSONAL'
                    WHEN i.estado = 'En_Revision' THEN 'INTERACCION_EN_REVISION'
                    WHEN i.estado = 'Rechazada' THEN 'INTERACCION_RECHAZADA'
                    ELSE 'INTERACCION_COMPLETADA'
                END AS CodigoResultadoIA,
                1 AS interacciones_registradas,
                0 AS alertas_generadas,
                0 AS alertas_atendidas,
                0 AS borradores_generados,
                0 AS borradores_aprobados
            FROM [NexoSaludDB].dbo.InteraccionesIA i
            LEFT JOIN [NexoSaludDB].dbo.TratamientosContratados t ON t.id_tratamiento = i.id_tratamiento
            LEFT JOIN [NexoSaludDB].dbo.Atenciones a ON a.id_atencion = i.id_atencion

            UNION ALL

            -- B) AlertasIA
            SELECT
                'ALERTA' AS ClaseEventoIA,
                al.id_alerta_ia AS id_origen_ia,
                al.id_persona,
                al.id_tratamiento,
                al.id_sesion,
                al.id_atencion,
                COALESCE(al.id_profesional, al.id_profesional_revisor, t.id_profesional_responsable) AS id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                al.fecha_hora,
                al.tipo_evento AS CodigoTipoInteraccionIA,
                'AUDITOR_CLINICO' AS CodigoTipoUsuarioIA,
                CASE
                    WHEN al.estado IN ('Atendida', 'Resuelta') THEN 'ALERTA_ATENDIDA'
                    WHEN al.estado = 'Descartada_Justificada' THEN 'ALERTA_DESCARTADA'
                    ELSE 'ALERTA_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                1 AS alertas_generadas,
                CASE WHEN al.estado IN ('Atendida', 'Resuelta') THEN 1 ELSE 0 END AS alertas_atendidas,
                0 AS borradores_generados,
                0 AS borradores_aprobados
            FROM [NexoSaludDB].dbo.AlertasIA al
            LEFT JOIN [NexoSaludDB].dbo.TratamientosContratados t ON t.id_tratamiento = al.id_tratamiento
            LEFT JOIN [NexoSaludDB].dbo.Atenciones a ON a.id_atencion = al.id_atencion

            UNION ALL

            -- C) BorradoresIA
            SELECT
                'BORRADOR' AS ClaseEventoIA,
                b.id_borrador_ia AS id_origen_ia,
                b.id_persona,
                b.id_tratamiento,
                b.id_sesion,
                b.id_atencion,
                b.id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                b.fecha_hora,
                b.tipo_evento AS CodigoTipoInteraccionIA,
                'ODONTOLOGO' AS CodigoTipoUsuarioIA,
                CASE
                    WHEN b.estado = 'Aprobado' THEN 'BORRADOR_APROBADO'
                    WHEN b.estado = 'Corregido_Y_Aprobado' THEN 'BORRADOR_CORREGIDO_Y_APROBADO'
                    WHEN b.estado = 'Rechazado' THEN 'BORRADOR_RECHAZADO'
                    ELSE 'BORRADOR_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                0 AS alertas_generadas,
                0 AS alertas_atendidas,
                CASE WHEN b.id_borrador_raiz IS NULL OR b.id_borrador_raiz = b.id_borrador_ia THEN 1 ELSE 0 END AS borradores_generados,
                CASE WHEN b.es_version_actual = 1 AND b.estado IN ('Aprobado', 'Corregido_Y_Aprobado') THEN 1 ELSE 0 END AS borradores_aprobados
            FROM [NexoSaludDB].dbo.BorradoresIA b
            LEFT JOIN [NexoSaludDB].dbo.TratamientosContratados t ON t.id_tratamiento = b.id_tratamiento
            LEFT JOIN [NexoSaludDB].dbo.Atenciones a ON a.id_atencion = b.id_atencion
        ),
        SourceIA AS (
            SELECT
                ev.ClaseEventoIA,
                ev.id_origen_ia,
                ev.id_persona,
                ev.id_tratamiento,
                ev.id_sesion,
                ev.id_atencion,
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempoEvento,
                ISNULL(dh.KeyHora, 0) AS KeyHoraEvento,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(dti.KeyTipoInteraccionIA, 0) AS KeyTipoInteraccionIA,
                ISNULL(dtu.KeyTipoUsuarioIA, 0) AS KeyTipoUsuarioIA,
                ISNULL(dr.KeyResultadoIA, 0) AS KeyResultadoIA,
                ev.interacciones_registradas,
                ev.alertas_generadas,
                ev.alertas_atendidas,
                ev.borradores_generados,
                ev.borradores_aprobados
            FROM EventosIAUnificados ev
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(ev.fecha_hora AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, ev.fecha_hora) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = ev.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = ev.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = ev.id_profesional
            LEFT JOIN dbo.Dim_TipoInteraccionIA dti ON dti.CodigoTipoInteraccionIA = ev.CodigoTipoInteraccionIA
            LEFT JOIN dbo.Dim_TipoUsuarioIA dtu ON dtu.CodigoTipoUsuarioIA = ev.CodigoTipoUsuarioIA
            LEFT JOIN dbo.Dim_ResultadoIA dr ON dr.CodigoResultadoIA = ev.CodigoResultadoIA
        )
        MERGE dbo.Fact_InteraccionIACustomer AS target
        USING SourceIA AS src
        ON target.ClaseEventoIA = src.ClaseEventoIA AND target.id_origen_ia = src.id_origen_ia
        WHEN MATCHED THEN
            UPDATE SET
                target.id_persona = src.id_persona,
                target.id_tratamiento = src.id_tratamiento,
                target.id_sesion = src.id_sesion,
                target.id_atencion = src.id_atencion,
                target.KeyTiempoEvento = src.KeyTiempoEvento,
                target.KeyHoraEvento = src.KeyHoraEvento,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyTipoInteraccionIA = src.KeyTipoInteraccionIA,
                target.KeyTipoUsuarioIA = src.KeyTipoUsuarioIA,
                target.KeyResultadoIA = src.KeyResultadoIA,
                target.interacciones_registradas = src.interacciones_registradas,
                target.alertas_generadas = src.alertas_generadas,
                target.alertas_atendidas = src.alertas_atendidas,
                target.borradores_generados = src.borradores_generados,
                target.borradores_aprobados = src.borradores_aprobados,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                ClaseEventoIA, id_origen_ia, id_persona, id_tratamiento, id_sesion, id_atencion,
                KeyTiempoEvento, KeyHoraEvento, KeySede, KeyServicio, KeyProfesional,
                KeyTipoInteraccionIA, KeyTipoUsuarioIA, KeyResultadoIA,
                interacciones_registradas, alertas_generadas, alertas_atendidas,
                borradores_generados, borradores_aprobados, fecha_corte_etl
            )
            VALUES (
                src.ClaseEventoIA, src.id_origen_ia, src.id_persona, src.id_tratamiento, src.id_sesion, src.id_atencion,
                src.KeyTiempoEvento, src.KeyHoraEvento, src.KeySede, src.KeyServicio, src.KeyProfesional,
                src.KeyTipoInteraccionIA, src.KeyTipoUsuarioIA, src.KeyResultadoIA,
                src.interacciones_registradas, src.alertas_generadas, src.alertas_atendidas,
                src.borradores_generados, src.borradores_aprobados, SYSDATETIME()
            )
        WHEN NOT MATCHED BY SOURCE THEN
            DELETE;

        -- --------------------------------------------------------------------
        -- 2.6. COMPATIBILIDAD CON dbo.fact_atencion_customer (SECCIÓN 8.6, H08)
        -- --------------------------------------------------------------------
        DELETE FROM dbo.fact_atencion_customer;

        INSERT INTO dbo.fact_atencion_customer (
            KeyTiempo, KeyHora, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
            cita_evaluable, atencion_realizada, cita_inasistencia,
            tiempo_sillon_dental_minuto, atencion_finalizada_conforme
        )
        SELECT
            KeyTiempo, KeyHora, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
            cita_evaluable, atencion_realizada, cita_inasistencia,
            tiempo_sillon_dental_minuto, atencion_finalizada_conforme
        FROM dbo.v_Compatibilidad_Fact_AtencionCustomer;

        -- --------------------------------------------------------------------
        -- 2.7. RECONCILIACIÓN OLTP VS DATA MART (SECCIÓN 9, T20)
        -- --------------------------------------------------------------------
        DECLARE @OLTP_Trat INT = (SELECT COUNT(*) FROM [NexoSaludDB].dbo.TratamientosContratados);
        DECLARE @Mart_Trat INT = (SELECT COUNT(*) FROM dbo.Fact_TratamientoCustomer);

        DECLARE @OLTP_Ses INT = (SELECT COUNT(*) FROM [NexoSaludDB].dbo.SesionesTratamiento);
        DECLARE @Mart_Ses INT = (SELECT COUNT(*) FROM dbo.Fact_SesionCustomer);

        DECLARE @OLTP_Aten INT = (SELECT COUNT(*) FROM [NexoSaludDB].dbo.Atenciones);
        DECLARE @Mart_Aten INT = (SELECT COUNT(*) FROM dbo.Fact_AtencionCustomer_V2);

        DECLARE @OLTP_IA INT = (
            (SELECT COUNT(*) FROM [NexoSaludDB].dbo.InteraccionesIA) +
            (SELECT COUNT(*) FROM [NexoSaludDB].dbo.AlertasIA) +
            (SELECT COUNT(*) FROM [NexoSaludDB].dbo.BorradoresIA)
        );
        DECLARE @Mart_IA INT = (SELECT COUNT(*) FROM dbo.Fact_InteraccionIACustomer);

        IF @OLTP_Trat <> @Mart_Trat OR @OLTP_Ses <> @Mart_Ses OR @OLTP_Aten <> @Mart_Aten OR @OLTP_IA <> @Mart_IA
        BEGIN
            THROW 56102, 'Error de reconciliación en usp_ETL_SincronizarCustomerMart: Conteos OLTP y Data Mart no coinciden.', 1;
        END;

        SET @FilasOrigen = @OLTP_Trat + @OLTP_Ses + @OLTP_Aten + @OLTP_IA;
        SET @FilasDestino = @Mart_Trat + @Mart_Ses + @Mart_Aten + @Mart_IA;

        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES (
            'usp_ETL_SincronizarCustomerMart',
            @FechaInicio,
            SYSDATETIME(),
            'EXITOSO',
            @FilasOrigen,
            @FilasDestino,
            'Reconciliación exacta: Tratamientos=' + CAST(@Mart_Trat AS VARCHAR(10))
                + ', Sesiones=' + CAST(@Mart_Ses AS VARCHAR(10))
                + ', Atenciones=' + CAST(@Mart_Aten AS VARCHAR(10))
                + ', EventosIA=' + CAST(@Mart_IA AS VARCHAR(10))
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsgCustomer NVARCHAR(4000) = ERROR_MESSAGE();
        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES ('usp_ETL_SincronizarCustomerMart', @FechaInicio, SYSDATETIME(), 'ERROR', @FilasOrigen, @FilasDestino, LEFT(@ErrMsgCustomer, 500));

        THROW;
    END CATCH;
END;
GO

-- Ejecutar ambos procedimientos ETL y verificar resultados iniciales
EXEC dbo.usp_ETL_SincronizarPayerMart;
EXEC dbo.usp_ETL_SincronizarCustomerMart;
GO

SELECT
    'RESUMEN_ETL_CUSTOMER_Y_PAYER' AS Seccion,
    (SELECT SUM(ReservasPreagendadas) FROM dbo.Fact_ConversionCobranzaPayer) AS F3_ReservasPreagendadas,
    (SELECT SUM(ConversionesACustomer) FROM dbo.Fact_ConversionCobranzaPayer) AS F3_ConversionesACustomer,
    (SELECT COUNT(*) FROM dbo.Fact_TratamientoCustomer) AS Fact1_Tratamientos,
    (SELECT COUNT(*) FROM dbo.Fact_SesionCustomer) AS Fact2_Sesiones,
    (SELECT COUNT(*) FROM dbo.Fact_AtencionCustomer_V2) AS Fact3_AtencionesV2,
    (SELECT COUNT(*) FROM dbo.Fact_InteraccionIACustomer) AS Fact4_EventosIA;
GO
