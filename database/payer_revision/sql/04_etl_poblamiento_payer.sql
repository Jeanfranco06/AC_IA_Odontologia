-- ====================================================================
-- ARCHIVO: 04_etl_poblamiento_payer.sql
-- FASE: PAYER (ETL / Carga Incremental Idempotente)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Carga idempotente y atómica de los tres hechos de PAYER
-- desde NexoSaludDB hacia NexoSalud_Mart utilizando MERGE y sp_getapplock.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE [NexoSalud_Mart];
GO

BEGIN TRANSACTION;

DECLARE @AppLockResult INT;
EXEC @AppLockResult = sp_getapplock 
    @Resource = 'ETL_NexoSalud_Payer_Lock', 
    @LockMode = 'Exclusive', 
    @LockOwner = 'Transaction', 
    @LockTimeout = 15000;

IF @AppLockResult < 0
BEGIN
    ROLLBACK TRANSACTION;
    THROW 51001, 'No se pudo obtener el bloqueo exclusivo para el ETL de PAYER. Proceso en ejecución concurrente.', 1;
END;

BEGIN TRY
    -- --------------------------------------------------------------------
    -- 1. ETL CARGA F1: Fact_RecaudacionPayer
    -- --------------------------------------------------------------------
    ;WITH SourceF1 AS (
        SELECT 
            ISNULL(dt.KeyTiempo, 1) AS KeyTiempo,
            ISNULL(ds.KeySede, 1) AS KeySede,
            ISNULL(dserv.KeyServicio, 1) AS KeyServicio,
            ISNULL(dp.KeyPasarela, 1) AS KeyPasarela,
            CASE 
                WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO') THEN 1
                WHEN UPPER(TRIM(p.estado)) IN ('PENDIENTE', 'PENDING', 'EN_REVISION', 'IN_REVIEW') THEN 2
                WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED', 'FALLIDO') THEN 3
                WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 4
                ELSE 1
            END AS KeyCobro,
            COUNT(p.id_pago) AS PagosRegistrados,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO') THEN 1 ELSE 0 END) AS PagosValidados,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('PENDIENTE', 'PENDING', 'EN_REVISION', 'IN_REVIEW') THEN 1 ELSE 0 END) AS PagosPendientes,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED', 'FALLIDO') THEN 1 ELSE 0 END) AS PagosRechazados,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 1 ELSE 0 END) AS PagosRevertidos,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO') THEN ISNULL(p.importe, 0) ELSE 0.00 END) AS IngresosBrutosRecaudados,
            SUM(ISNULL(p.importe, 0) * 0.035) AS CostoTransaccionPasarela
        FROM [NexoSaludDB].dbo.Pagos p
        INNER JOIN [NexoSaludDB].dbo.Reservas r ON r.id_reserva = p.id_reserva
        LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
        LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
        LEFT JOIN [NexoSaludDB].dbo.Solicitudes sol ON sol.id_solicitud = r.id_solicitud
        LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(p.fecha_registro AS DATE)
        LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = disp.id_sede
        LEFT JOIN dbo.Dim_Servicio dserv ON dserv.id_servicio = sol.id_servicio
        LEFT JOIN dbo.Dim_Pasarela dp ON dp.MetodoPago = p.canal_pago
        WHERE p.fecha_registro IS NOT NULL
        GROUP BY 
            ISNULL(dt.KeyTiempo, 1),
            ISNULL(ds.KeySede, 1),
            ISNULL(dserv.KeyServicio, 1),
            ISNULL(dp.KeyPasarela, 1),
            CASE 
                WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED', 'CONFIRMADO') THEN 1
                WHEN UPPER(TRIM(p.estado)) IN ('PENDIENTE', 'PENDING', 'EN_REVISION', 'IN_REVIEW') THEN 2
                WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED', 'FALLIDO') THEN 3
                WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 4
                ELSE 1
            END
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
            target.CostoTransaccionPasarela = src.CostoTransaccionPasarela
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyPasarela, KeyCobro, PagosRegistrados, PagosValidados, PagosPendientes, PagosRechazados, PagosRevertidos, IngresosBrutosRecaudados, CostoTransaccionPasarela)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyPasarela, src.KeyCobro, src.PagosRegistrados, src.PagosValidados, src.PagosPendientes, src.PagosRechazados, src.PagosRevertidos, src.IngresosBrutosRecaudados, src.CostoTransaccionPasarela);

    PRINT 'Hecho F1 (Fact_RecaudacionPayer) cargado exitosamente.';

    -- --------------------------------------------------------------------
    -- 2. ETL CARGA F2: Fact_ValidacionIncidenciaPayer
    -- --------------------------------------------------------------------
    ;WITH SourceF2 AS (
        SELECT 
            ISNULL(dt.KeyTiempo, 1) AS KeyTiempo,
            ISNULL(ds.KeySede, 1) AS KeySede,
            ISNULL(dp.KeyPasarela, 1) AS KeyPasarela,
            CASE 
                WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED') THEN 1
                WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED') THEN 3
                WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 4
                ELSE 2
            END AS KeyCobro,
            ISNULL(di.KeyIncidencia, 1) AS KeyIncidencia,
            SUM(CASE 
                WHEN p.fecha_validacion IS NOT NULL AND p.fecha_registro IS NOT NULL
                THEN DATEDIFF(MINUTE, p.fecha_registro, p.fecha_validacion)
                ELSE 15
            END) AS TiempoTotalValidacionMin,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED') THEN 1 ELSE 0 END) AS PagosValidados,
            COUNT(inc.id_incidencia) AS CantidadIncidencias,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED') THEN 1 ELSE 0 END) AS PagosRechazados,
            SUM(CASE WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 1 ELSE 0 END) AS PagosRevertidos
        FROM [NexoSaludDB].dbo.Pagos p
        INNER JOIN [NexoSaludDB].dbo.Reservas r ON r.id_reserva = p.id_reserva
        LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
        LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
        LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(p.fecha_registro AS DATE)
        LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = disp.id_sede
        LEFT JOIN dbo.Dim_Pasarela dp ON dp.MetodoPago = p.canal_pago
        LEFT JOIN [NexoSaludDB].dbo.Incidencias inc ON inc.id_pago = p.id_pago
        LEFT JOIN dbo.Dim_Incidencia di ON di.TipoIncidencia = inc.tipo
        WHERE p.fecha_registro IS NOT NULL
        GROUP BY 
            ISNULL(dt.KeyTiempo, 1),
            ISNULL(ds.KeySede, 1),
            ISNULL(dp.KeyPasarela, 1),
            CASE 
                WHEN UPPER(TRIM(p.estado)) IN ('VALIDADO', 'VALIDATED') THEN 1
                WHEN UPPER(TRIM(p.estado)) IN ('RECHAZADO', 'REJECTED') THEN 3
                WHEN UPPER(TRIM(p.estado)) IN ('REVERTIDO', 'REVERTED') THEN 4
                ELSE 2
            END,
            ISNULL(di.KeyIncidencia, 1)
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
            target.CantidadIncidencias = src.CantidadIncidencias,
            target.PagosRechazados = src.PagosRechazados,
            target.PagosRevertidos = src.PagosRevertidos
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo, KeySede, KeyPasarela, KeyCobro, KeyIncidencia, TiempoTotalValidacionMin, PagosValidados, CantidadIncidencias, PagosRechazados, PagosRevertidos)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyPasarela, src.KeyCobro, src.KeyIncidencia, src.TiempoTotalValidacionMin, src.PagosValidados, src.CantidadIncidencias, src.PagosRechazados, src.PagosRevertidos);

    PRINT 'Hecho F2 (Fact_ValidacionIncidenciaPayer) cargado exitosamente.';

    -- --------------------------------------------------------------------
    -- 3. ETL CARGA F3: Fact_ConversionCobranzaPayer
    -- --------------------------------------------------------------------
    ;WITH SourceF3 AS (
        SELECT 
            ISNULL(dt.KeyTiempo, 1) AS KeyTiempo,
            ISNULL(ds.KeySede, 1) AS KeySede,
            ISNULL(dserv.KeyServicio, 1) AS KeyServicio,
            ISNULL(dn.KeyNotificacion, 1) AS KeyNotificacion,
            ISNULL(dr.KeyRiesgoImpago, 1) AS KeyRiesgoImpago,
            COUNT(r.id_reserva) AS ReservasPreagendadas,
            SUM(CASE WHEN r.estado IN ('Confirmada', 'Atendida', 'CONFIRMADA') THEN 1 ELSE 0 END) AS ReservasConfirmadas,
            SUM(CASE WHEN r.estado IN ('Cancelada', 'Vencida', 'CANCELADA') THEN 1 ELSE 0 END) AS ReservasCanceladasImpago,
            SUM(CASE WHEN aten.id_atencion IS NOT NULL THEN 1 ELSE 0 END) AS ConversionesACustomer,
            COUNT(p.id_pago) AS PagosRegistrados
        FROM [NexoSaludDB].dbo.Reservas r
        LEFT JOIN [NexoSaludDB].dbo.Opciones o ON o.id_opcion = r.id_opcion
        LEFT JOIN [NexoSaludDB].dbo.Disponibilidad disp ON disp.id_disponibilidad = o.id_disponibilidad
        LEFT JOIN [NexoSaludDB].dbo.Solicitudes sol ON sol.id_solicitud = r.id_solicitud
        LEFT JOIN [NexoSaludDB].dbo.Pagos p ON p.id_reserva = r.id_reserva
        LEFT JOIN [NexoSaludDB].dbo.Atenciones aten ON aten.id_reserva = r.id_reserva
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
            ISNULL(dt.KeyTiempo, 1),
            ISNULL(ds.KeySede, 1),
            ISNULL(dserv.KeyServicio, 1),
            ISNULL(dn.KeyNotificacion, 1),
            ISNULL(dr.KeyRiesgoImpago, 1)
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
        INSERT (KeyTiempo, KeySede, KeyServicio, KeyNotificacion, KeyRiesgoImpago, ReservasPreagendadas, ReservasConfirmadas, ReservasCanceladasImpago, ConversionesACustomer, PagosRegistrados)
        VALUES (src.KeyTiempo, src.KeySede, src.KeyServicio, src.KeyNotificacion, src.KeyRiesgoImpago, src.ReservasPreagendadas, src.ReservasConfirmadas, src.ReservasCanceladasImpago, src.ConversionesACustomer, src.PagosRegistrados);

    PRINT 'Hecho F3 (Fact_ConversionCobranzaPayer) cargado exitosamente.';

    COMMIT TRANSACTION;
    PRINT 'ETL de PAYER finalizado con éxito.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrSev INT = ERROR_SEVERITY();
    DECLARE @ErrState INT = ERROR_STATE();
    RAISERROR(@ErrMsg, @ErrSev, @ErrState);
END CATCH;
GO
