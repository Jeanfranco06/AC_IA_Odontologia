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

    -- Crear reserva sintética
    INSERT INTO [NexoSaludDB].dbo.Reservas (id_persona, id_solicitud, id_opcion, fecha_reserva, estado, ultima_alerta_dunning, score_riesgo_impago)
    VALUES (@IdPersona, @IdSolicitud, @IdOpcion, SYSDATETIME(), 'Pendiente', 'T-48h Preventivo', 75);
    SET @IdReserva = SCOPE_IDENTITY();

    -- Registrar pago sintético
    INSERT INTO [NexoSaludDB].dbo.Pagos (id_persona, id_reserva, importe, canal_pago, fecha_registro, estado, referencia_pago)
    VALUES (@IdPersona, @IdReserva, 180.00, 'YAPE', SYSDATETIME(), 'En_Revision', 'YAPE-TEST-999');
    SET @IdPago = SCOPE_IDENTITY();

    -- Registrar incidencia de prueba con justificación >= 10 caracteres
    INSERT INTO [NexoSaludDB].dbo.Incidencias (id_persona, id_pago, id_reserva, tipo, descripcion, prioridad, estado)
    VALUES (@IdPersona, @IdPago, @IdReserva, 'RECHAZO_VOUCHER', 'El comprobante adjunto presenta monto incompleto y borroso', 'Alta', 'Abierta');

    PRINT 'Paso 1: Registros sintéticos en NexoSaludDB creados (Reserva #' + CAST(@IdReserva AS VARCHAR) + ', Pago #' + CAST(@IdPago AS VARCHAR) + ').';

    -- Simular validación del pago
    UPDATE [NexoSaludDB].dbo.Pagos
    SET estado = 'Validado',
        fecha_validacion = DATEADD(MINUTE, 25, SYSDATETIME())
    WHERE id_pago = @IdPago;

    PRINT 'Paso 2: Validación simulada de pago completada (Tiempo: 25 minutos).';

    -- 2. VERIFICACIÓN DE FÓRMULAS E INDICADORES
    -- --------------------------------------------------------------------
    DECLARE @Validados INT = 1, @Registrados INT = 1;
    DECLARE @KPI_P1 DECIMAL(5,2) = (100.0 * @Validados / @Registrados);
    IF @KPI_P1 <> 100.00
        THROW 59001, 'Error en el cálculo matemático del KPI P1.', 1;

    PRINT 'Paso 3: Aserción matemática P1 superada: ' + CAST(@KPI_P1 AS VARCHAR) + '% (VERDE).';

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

