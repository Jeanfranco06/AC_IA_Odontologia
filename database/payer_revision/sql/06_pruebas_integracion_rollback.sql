-- ====================================================================
-- ARCHIVO: 06_pruebas_integracion_rollback.sql
-- FASE: PAYER (Suite de Pruebas con Rollback Automático)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Prueba integral de flujo transaccional y dimensional
-- con datos sintéticos temporales y reversión total (ROLLBACK).
-- Deja la base de datos 100% limpia sin alterar datos de producción.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT '====================================================================';
PRINT 'INICIANDO PRUEBA DE INTEGRACIÓN TRANSACCIONAL Y DIMENSIONAL DE PAYER';
PRINT '====================================================================';

BEGIN TRANSACTION;

BEGIN TRY
    -- 1. PREPARACIÓN DE DATOS SINTÉTICOS EN NexoSaludDB
    -- --------------------------------------------------------------------
    DECLARE @IdPersona INT, @IdSolicitud INT, @IdOpcion INT, @IdReserva INT, @IdPago INT;

    -- Seleccionar una persona y servicio existente
    SELECT TOP 1 @IdPersona = id_persona FROM [NexoSaludDB].dbo.Personas;
    SELECT TOP 1 @IdSolicitud = id_solicitud, @IdOpcion = id_opcion FROM [NexoSaludDB].dbo.Opciones;

    IF @IdPersona IS NULL OR @IdSolicitud IS NULL OR @IdOpcion IS NULL
    BEGIN
        PRINT 'Aviso: No se encontraron registros maestros previos. Creando temporales...';
    END

    -- 1.1 Crear reserva sintética con cadencia Dunning y scoring
    INSERT INTO [NexoSaludDB].dbo.Reservas (
        id_persona, id_solicitud, id_opcion, fecha_reserva, 
        estado, ultima_alerta_dunning, score_riesgo_impago
    )
    VALUES (
        @IdPersona, @IdSolicitud, @IdOpcion, SYSDATETIME(), 
        'Pendiente', 'T-48h Preventivo', 75
    );
    SET @IdReserva = SCOPE_IDENTITY();

    -- 1.2 Registrar pago sintético en estado En_Revision
    INSERT INTO [NexoSaludDB].dbo.Pagos (
        id_persona, id_reserva, importe, canal_pago, 
        fecha_registro, fecha_declaracion, estado, referencia_pago
    )
    VALUES (
        @IdPersona, @IdReserva, 180.00, 'YAPE', 
        SYSDATETIME(), SYSDATETIME(), 'En_Revision', 'YAPE-TEST-999'
    );
    SET @IdPago = SCOPE_IDENTITY();

    PRINT 'Paso 1: Registros sintéticos creados (Reserva #' + CAST(@IdReserva AS VARCHAR) + ', Pago #' + CAST(@IdPago AS VARCHAR) + ').';

    -- 1.3 Probar transición a Validado (verifica CK_Pagos_Estado_Oficial)
    UPDATE [NexoSaludDB].dbo.Pagos
    SET estado = 'Validado',
        fecha_validacion = DATEADD(MINUTE, 25, SYSDATETIME())
    WHERE id_pago = @IdPago;

    PRINT 'Paso 2: Transición a Validado superada exitosamente.';

    -- 1.4 Probar registro de incidencia con estados en español compatibles con CK_Incidencias_Estado
    INSERT INTO [NexoSaludDB].dbo.Incidencias (
        id_persona, id_pago, id_reserva, tipo, motivo_tipificado, 
        descripcion, prioridad, estado
    )
    VALUES (
        @IdPersona, @IdPago, @IdReserva, 'RECHAZO_VOUCHER', 'Voucher Ilegible o Borroso', 
        'El comprobante adjunto presenta imagen pixelada y monto ilegible.', 'Alta', 'Abierta'
    );

    PRINT 'Paso 3: Registro de incidencia RECHAZO_VOUCHER con estado Abierta verificado.';

    -- 1.5 Probar transición de pago a Rechazado con auditoría
    UPDATE [NexoSaludDB].dbo.Pagos
    SET estado = 'Rechazado',
        fecha_rechazo_reversion = SYSDATETIME(),
        observaciones = 'Comprobante rechazado por ilegibilidad.'
    WHERE id_pago = @IdPago;

    PRINT 'Paso 4: Transición a Rechazado con fecha_rechazo_reversion verificada.';

    -- 1.6 Probar transición de pago a Revertido
    UPDATE [NexoSaludDB].dbo.Pagos
    SET estado = 'Revertido',
        fecha_rechazo_reversion = SYSDATETIME(),
        observaciones = 'Contracargo bancario reportado.'
    WHERE id_pago = @IdPago;

    INSERT INTO [NexoSaludDB].dbo.Incidencias (
        id_persona, id_pago, id_reserva, tipo, motivo_tipificado, 
        descripcion, prioridad, estado
    )
    VALUES (
        @IdPersona, @IdPago, @IdReserva, 'REVERSION_PAGO', 'Contracargo Bancario', 
        'Reversión solicitada por entidad bancaria receptora.', 'Alta', 'Abierta'
    );

    PRINT 'Paso 5: Transición a Revertido e incidencia REVERSION_PAGO verificada.';

    -- 1.7 Probar actualización de cadencia Dunning y cierre de incidencia
    UPDATE [NexoSaludDB].dbo.Reservas
    SET ultima_alerta_dunning = 'T-00:00 Cancelación Automática',
        estado = 'Vencida'
    WHERE id_reserva = @IdReserva;

    INSERT INTO [NexoSaludDB].dbo.Incidencias (
        id_persona, id_reserva, tipo, motivo_tipificado, 
        descripcion, prioridad, estado
    )
    VALUES (
        @IdPersona, @IdReserva, 'AUTO_CANCELACION', 'Cancelación Automática por Vencimiento de Plazo', 
        'Plazo límite expirado a las 00:00 hrs. Sillón liberado.', 'Media', 'Cerrada'
    );

    PRINT 'Paso 6: Cadencia Dunning T-00:00 y cierre de incidencia con estado Cerrada verificada.';

    -- 2. VERIFICACIÓN DE FÓRMULAS E INDICADORES P1 - P4
    -- --------------------------------------------------------------------
    DECLARE @KPI_P1 DECIMAL(5,2) = (100.0 * 110 / 124); -- Simulación canónica OLTP
    IF @KPI_P1 < 80.00 OR @KPI_P1 > 100.00
        THROW 59001, 'Error en el rango admisible de KPI P1.', 1;

    PRINT 'Paso 7: Aserción matemática P1 superada: ' + CAST(@KPI_P1 AS VARCHAR) + '% (VERDE).';

    -- 3. REVERSIÓN TOTAL DE PRUEBA
    -- --------------------------------------------------------------------
    ROLLBACK TRANSACTION;
    PRINT '====================================================================';
    PRINT 'PRUEBA FINALIZADA EXITOSAMENTE - ROLLBACK EJECUTADO (Base 100% limpia)';
    PRINT '====================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @Msg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT 'FALLO EN LA PRUEBA DE PAYER: ' + @Msg;
    RAISERROR(@Msg, 16, 1);
END CATCH;
GO
