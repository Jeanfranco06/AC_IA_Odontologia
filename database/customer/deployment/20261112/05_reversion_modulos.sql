-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Reversión aditiva: no borra tablas, columnas ni eventos nuevos. Pausar aplicación primero.
USE [$(OltpDatabase)];
GO

CREATE OR ALTER PROCEDURE dbo.usp_ProgramarSesionTratamiento
    @id_tratamiento             INT,
    @numero_sesion              INT,
    @id_profesional             INT,
    @id_sede                    INT,
    @fecha_programada           DATETIME2,
    @duracion_min               INT = 45,
    @id_disponibilidad          INT = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @estado_trat VARCHAR(30), @id_plan INT, @max_sesiones INT, @id_persona INT, @id_reserva_origen INT, @id_servicio INT;
        SELECT
            @estado_trat = t.estado_tratamiento,
            @id_persona = t.id_persona,
            @id_reserva_origen = t.id_reserva_origen,
            @id_servicio = t.id_servicio
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @estado_trat IS NULL
            THROW 55220, 'El tratamiento no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado', 'Completado')
            THROW 55221, 'No se pueden programar sesiones en un tratamiento Suspendido, Cancelado o Completado.', 1;

        SELECT TOP (1)
            @id_plan = id_plan,
            @max_sesiones = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @numero_sesion > @max_sesiones
            THROW 55222, 'El nÃºmero de sesiÃ³n excede las sesiones planificadas en el plan clÃ­nico vigente.', 1;

        -- R05: Validar que el profesional no tenga otra sesiÃ³n activa solapada en el mismo horario
        DECLARE @fin_propuesto DATETIME2 = DATEADD(MINUTE, @duracion_min, @fecha_programada);

        IF EXISTS (
            SELECT 1
            FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.id_profesional = @id_profesional
              AND s.estado_programacion IN ('Programada', 'Reprogramada')
              AND s.estado_asistencial <> 'Inasistida'
              AND @fecha_programada < DATEADD(MINUTE, s.duracion_programada_min, s.fecha_programada_vigente)
              AND @fin_propuesto > s.fecha_programada_vigente
        )
        BEGIN
            THROW 55223, 'CONFLICTO DE AGENDA (R05): El profesional ya tiene una sesiÃ³n asignada que se solapa con el horario solicitado.', 1;
        END;

        IF @id_disponibilidad IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM dbo.Disponibilidad WITH (UPDLOCK, HOLDLOCK)
                WHERE id_disponibilidad = @id_disponibilidad AND estado <> 'Disponible'
            )
            BEGIN
                THROW 55224, 'CONFLICTO DE SILLÃ“N (R05): El turno de disponibilidad seleccionado ya no se encuentra Disponible.', 1;
            END;

            UPDATE dbo.Disponibilidad
            SET estado = 'Ocupado'
            WHERE id_disponibilidad = @id_disponibilidad;
        END;

        DECLARE @id_sesion INT, @id_atencion INT;

        INSERT INTO dbo.SesionesTratamiento (
            id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede,
            id_disponibilidad, fecha_programada_vigente, duracion_programada_min,
            estado_programacion, estado_asistencial, estado_cierre
        )
        VALUES (
            @id_tratamiento, @id_plan, @numero_sesion, @id_profesional, @id_sede,
            @id_disponibilidad, @fecha_programada, @duracion_min,
            'Programada', 'Pendiente', 'Pendiente'
        );
        SET @id_sesion = SCOPE_IDENTITY();

        INSERT INTO dbo.EventosSesion (
            id_sesion, tipo_cambio, fecha_anterior, fecha_nueva,
            estado_anterior, estado_nuevo, motivo, id_usuario_responsable
        )
        VALUES (
            @id_sesion, 'CREACION', NULL, @fecha_programada,
            NULL, 'Programada', 'ProgramaciÃ³n de sesiÃ³n #' + CAST(@numero_sesion AS VARCHAR(10)) + ' del tratamiento',
            @id_usuario_responsable
        );

        -- Crear registro de AtenciÃ³n programada vinculada a la sesiÃ³n y a la reserva origen del contrato (sin duplicar Reservas: R03, R04)
        INSERT INTO dbo.Atenciones (
            id_persona, id_reserva, id_tratamiento, id_sesion, id_servicio,
            id_profesional, id_sede, fecha_atencion, asistencia,
            estado_servicio, estado_cierre_documental
        )
        VALUES (
            @id_persona, @id_reserva_origen, @id_tratamiento, @id_sesion, @id_servicio,
            @id_profesional, @id_sede, @fecha_programada, 'Pendiente',
            'Programado', 'Pendiente'
        );
        SET @id_atencion = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO


CREATE OR ALTER PROCEDURE dbo.usp_RegistrarEventoAsistencialSesion
    @id_sesion                  INT,
    @accion                     VARCHAR(30), -- 'CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION', 'CONFIRMAR_INASISTENCIA'
    @fecha_evento               DATETIME2 = NULL,
    @motivo_inasistencia        VARCHAR(300) = NULL,
    @procedimiento_principal    VARCHAR(200) = NULL,
    @evaluacion_clinica         VARCHAR(500) = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @fecha_evento = ISNULL(@fecha_evento, SYSDATETIME());

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_tratamiento INT, @id_reserva INT, @estado_trat VARCHAR(30), @es_habilitado INT, @motivo_guardian VARCHAR(100);
        DECLARE @estado_asist_ant VARCHAR(30), @id_atencion INT, @id_servicio INT, @id_prof INT;

        SELECT
            @id_tratamiento = s.id_tratamiento,
            @estado_asist_ant = s.estado_asistencial,
            @id_prof = s.id_profesional,
            @id_reserva = t.id_reserva_origen,
            @estado_trat = t.estado_tratamiento,
            @id_servicio = t.id_servicio
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK) ON t.id_tratamiento = s.id_tratamiento
        WHERE s.id_sesion = @id_sesion;

        IF @id_tratamiento IS NULL
            THROW 55240, 'La sesiÃ³n indicada no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado')
            THROW 55241, 'El tratamiento se encuentra Suspendido o Cancelado; no puede ejecutarse la sesiÃ³n.', 1;

        -- R02: Verificar siempre el guardiÃ¡n financiero antes de iniciar atenciÃ³n
        SELECT @es_habilitado = es_habilitado_customer, @motivo_guardian = motivo_guardian
        FROM dbo.fn_VerificarGuardianFinancieroCustomer(@id_reserva);

        IF @accion IN ('CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION') AND @es_habilitado <> 1
        BEGIN
            DECLARE @err VARCHAR(300) = 'GUARDIÃN FINANCIERO (R02): AtenciÃ³n bloqueada por incumplimiento financiero (' + ISNULL(@motivo_guardian, 'SIN_VALIDACION') + ').';
            THROW 55242, @err, 1;
        END;

        SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_sesion = @id_sesion;

        IF @accion = 'CONFIRMAR_LLEGADA'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = @fecha_evento,
                estado_asistencial = 'Confirmada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'Confirmada'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'CONFIRMACION_ASISTENCIA', @estado_asist_ant, 'Confirmada', 'Llegada del paciente a sala de espera', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'INICIAR_ATENCION'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = ISNULL(fecha_llegada, @fecha_evento),
                fecha_inicio_atencion = @fecha_evento,
                estado_asistencial = 'Realizada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = @fecha_evento,
                asistencia = 'AsistiÃ³',
                estado_servicio = 'En proceso'
            WHERE id_atencion = @id_atencion;

            -- Si es la primera atenciÃ³n efectiva del tratamiento, marcar fecha_inicio_real y estado 'En ejecuciÃ³n'
            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, @fecha_evento),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecuciÃ³n' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INICIO_ATENCION', @estado_asist_ant, 'Realizada', 'Ingreso del paciente a sillÃ³n odontolÃ³gico', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'FINALIZAR_ATENCION'
        BEGIN
            -- R09: Una sesiÃ³n realizada puede quedar pendiente de cierre documental
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = ISNULL(fecha_llegada, DATEADD(MINUTE, -30, @fecha_evento)),
                fecha_inicio_atencion = ISNULL(fecha_inicio_atencion, DATEADD(MINUTE, -20, @fecha_evento)),
                estado_asistencial = 'Realizada',
                estado_cierre = 'Pendiente'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = ISNULL(fecha_inicio, DATEADD(MINUTE, -20, @fecha_evento)),
                fecha_fin = @fecha_evento,
                asistencia = 'AsistiÃ³',
                estado_servicio = 'Realizado',
                procedimiento = COALESCE(@procedimiento_principal, procedimiento),
                procedimiento_realizado = COALESCE(@procedimiento_principal, procedimiento_realizado),
                evaluacion = COALESCE(@evaluacion_clinica, evaluacion),
                estado_cierre_documental = 'Pendiente'
            WHERE id_atencion = @id_atencion;

            IF @procedimiento_principal IS NOT NULL AND @id_atencion IS NOT NULL
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion = @id_atencion AND procedimiento_realizado = @procedimiento_principal)
                BEGIN
                    INSERT INTO dbo.DetalleProcedimiento (id_atencion, id_servicio, procedimiento_realizado, fecha_registro, id_profesional)
                    VALUES (@id_atencion, @id_servicio, @procedimiento_principal, @fecha_evento, @id_prof);
                END;
            END;

            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, DATEADD(MINUTE, -20, @fecha_evento)),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecuciÃ³n' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;
        END
        ELSE IF @accion = 'CONFIRMAR_INASISTENCIA'
        BEGIN
            IF NULLIF(LTRIM(RTRIM(@motivo_inasistencia)), '') IS NULL
                SET @motivo_inasistencia = 'Paciente no se presentÃ³ a la sesiÃ³n programada (No-Show confirmado)';

            UPDATE dbo.SesionesTratamiento
            SET estado_asistencial = 'Inasistida',
                estado_cierre = 'No Aplica',
                motivo_inasistencia = @motivo_inasistencia
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'No asistiÃ³',
                estado_servicio = 'Cancelado'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INASISTENCIA', @estado_asist_ant, 'Inasistida', @motivo_inasistencia, @id_usuario_responsable, @fecha_evento);
        END
        ELSE
        BEGIN
            THROW 55243, 'AcciÃ³n asistencial no reconocida.', 1;
        END;

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion, @accion AS accion_ejecutada;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO


CREATE OR ALTER PROCEDURE dbo.usp_CerrarSesionClinica
    @id_sesion                  INT,
    @id_profesional_validador   INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @estado_asist VARCHAR(30), @id_atencion INT, @id_tratamiento INT;
        SELECT
            @estado_asist = s.estado_asistencial,
            @id_tratamiento = s.id_tratamiento
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        WHERE s.id_sesion = @id_sesion;

        IF @estado_asist IS NULL
            THROW 55250, 'La sesiÃ³n no existe.', 1;

        IF @estado_asist <> 'Realizada'
            THROW 55251, 'CIERRE DE SESIÃ“N (R10): Solo puede cerrarse documentalmente una sesiÃ³n que haya sido efectivamente Realizada.', 1;

        SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_sesion = @id_sesion;

        IF @id_atencion IS NULL
            THROW 55252, 'CIERRE DE SESIÃ“N (R10): No existe atenciÃ³n clÃ­nica vinculada a la sesiÃ³n.', 1;

        -- Verificar evidencia de procedimiento consignado
        IF NOT EXISTS (SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion = @id_atencion)
           AND NOT EXISTS (SELECT 1 FROM dbo.Atenciones WHERE id_atencion = @id_atencion AND NULLIF(LTRIM(RTRIM(COALESCE(procedimiento, procedimiento_realizado))), '') IS NOT NULL)
        BEGIN
            THROW 55253, 'CIERRE DE SESIÃ“N (R10): Debe registrarse al menos un procedimiento clÃ­nico antes de cerrar la sesiÃ³n.', 1;
        END;

        -- Verificar que la Ãºltima revisiÃ³n de ficha no estÃ© Incompleta
        IF EXISTS (
            SELECT TOP (1) 1
            FROM dbo.ValidacionesFicha
            WHERE id_atencion = @id_atencion
            ORDER BY numero_revision DESC
        )
        BEGIN
            DECLARE @ult_res VARCHAR(30);
            SELECT TOP (1) @ult_res = resultado_validacion
            FROM dbo.ValidacionesFicha
            WHERE id_atencion = @id_atencion
            ORDER BY numero_revision DESC;

            IF @ult_res <> 'Completa'
                THROW 55254, 'CIERRE DE SESIÃ“N (R10): La ficha clÃ­nica tiene validaciones pendientes (Ãºltima revisiÃ³n no estÃ¡ Completa).', 1;
        END
        ELSE
        BEGIN
            -- Registrar revisiÃ³n 1 como Completa automÃ¡ticamente si todos los campos clave estÃ¡n presentes
            INSERT INTO dbo.ValidacionesFicha (id_atencion, numero_revision, fecha_revision, resultado_validacion, id_profesional_validador, id_usuario_validador)
            VALUES (@id_atencion, 1, @ahora, 'Completa', @id_profesional_validador, @id_usuario_responsable);
        END;

        UPDATE dbo.Atenciones
        SET estado_cierre_documental = 'Cerrada',
            id_profesional_validador_cierre = @id_profesional_validador,
            fecha_validacion_cierre = @ahora
        WHERE id_atencion = @id_atencion;

        UPDATE dbo.SesionesTratamiento
        SET estado_cierre = 'Cerrada',
            fecha_cierre_sesion = @ahora
        WHERE id_sesion = @id_sesion;

        INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
        VALUES (@id_sesion, 'CIERRE_SESION', 'Pendiente', 'Cerrada', 'Cierre clÃ­nico y documental validado por profesional #' + CAST(@id_profesional_validador AS VARCHAR(10)), @id_usuario_responsable, @ahora);

        -- R11 y R12: El cierre de una sesiÃ³n NO cierra automÃ¡ticamente el tratamiento ni traslada a TURNED
        COMMIT TRANSACTION;

        SELECT
            @id_sesion AS id_sesion,
            @id_tratamiento AS id_tratamiento,
            'Cerrada' AS estado_cierre_sesion,
            (SELECT estado_tratamiento FROM dbo.TratamientosContratados WHERE id_tratamiento = @id_tratamiento) AS estado_tratamiento_actual,
            (SELECT e.nombre FROM dbo.Personas p INNER JOIN dbo.Etapas e ON e.id_etapa = p.id_etapa_actual WHERE p.id_persona = (SELECT id_persona FROM dbo.TratamientosContratados WHERE id_tratamiento = @id_tratamiento)) AS etapa_persona_actual;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO


CREATE OR ALTER PROCEDURE dbo.usp_CerrarTratamientoYTransicionarTurned
    @id_tratamiento             INT,
    @id_profesional_cierre      INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_persona INT, @estado_actual VARCHAR(30), @fecha_inicio DATETIME2;
        DECLARE @sesiones_plan INT, @sesiones_cerradas INT, @sesiones_pendientes_cierre INT;

        SELECT
            @id_persona = t.id_persona,
            @estado_actual = t.estado_tratamiento,
            @fecha_inicio = t.fecha_inicio_real
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @id_persona IS NULL
            THROW 55260, 'El tratamiento indicado no existe.', 1;

        IF @estado_actual = 'Completado'
        BEGIN
            COMMIT TRANSACTION;
            SELECT @id_tratamiento AS id_tratamiento, 'Completado' AS estado_tratamiento, 1 AS ya_cerrado;
            RETURN;
        END;

        IF @estado_actual <> 'En ejecuciÃ³n' OR @fecha_inicio IS NULL
            THROW 55261, 'CIERRE DE TRATAMIENTO (R13): Solo puede cerrarse como Completado un tratamiento que haya iniciado efectivamente.', 1;

        SELECT TOP (1) @sesiones_plan = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        SELECT
            @sesiones_cerradas = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Cerrada' THEN 1 ELSE 0 END),
            @sesiones_pendientes_cierre = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Pendiente' THEN 1 ELSE 0 END)
        FROM dbo.SesionesTratamiento
        WHERE id_tratamiento = @id_tratamiento;

        IF ISNULL(@sesiones_pendientes_cierre, 0) > 0
            THROW 55262, 'CIERRE DE TRATAMIENTO (R13): Existen sesiones realizadas con cierre documental pendiente.', 1;

        IF ISNULL(@sesiones_cerradas, 0) < ISNULL(@sesiones_plan, 1)
            THROW 55263, 'CIERRE DE TRATAMIENTO (R12/R13): No se han completado todas las sesiones planificadas del plan clÃ­nico vigente.', 1;

        UPDATE dbo.TratamientosContratados
        SET estado_tratamiento = 'Completado',
            fecha_cierre_real = @ahora,
            id_profesional_cierre = @id_profesional_cierre,
            fecha_actualizacion = @ahora
        WHERE id_tratamiento = @id_tratamiento;

        -- Verificar si la persona tiene algÃºn otro tratamiento activo antes de pasar su estado global a TURNED (SecciÃ³n 12)
        DECLARE @otros_activos INT;
        SELECT @otros_activos = COUNT(*)
        FROM dbo.TratamientosContratados
        WHERE id_persona = @id_persona
          AND id_tratamiento <> @id_tratamiento
          AND estado_tratamiento IN ('Contratado', 'Activado', 'En ejecuciÃ³n');

        DECLARE @etapa_customer INT, @etapa_turned INT, @etapa_actual_persona INT;
        SELECT @etapa_customer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';
        SELECT @etapa_turned = id_etapa FROM dbo.Etapas WHERE nombre = 'TURNED';
        SELECT @etapa_actual_persona = id_etapa_actual FROM dbo.Personas WITH (UPDLOCK) WHERE id_persona = @id_persona;

        IF @otros_activos = 0 AND @etapa_turned IS NOT NULL AND @etapa_actual_persona <> @etapa_turned
        BEGIN
            UPDATE dbo.Personas
            SET id_etapa_actual = @etapa_turned,
                fecha_actualizacion = @ahora
            WHERE id_persona = @id_persona;

            INSERT INTO dbo.EventosEtapa (
                id_persona, etapa_origen, etapa_destino, fecha_hora,
                id_usuario, motivo, evidencia
            )
            VALUES (
                @id_persona, @etapa_actual_persona, @etapa_turned, @ahora,
                @id_usuario_responsable, 'Tratamiento odontolÃ³gico formalmente completado y cerrado',
                'Tratamiento #' + CAST(@id_tratamiento AS VARCHAR(20)) + ' (' + CAST(@sesiones_cerradas AS VARCHAR(10)) + ' sesiones cerradas)'
            );
        END;

        COMMIT TRANSACTION;
        SELECT
            @id_tratamiento AS id_tratamiento,
            'Completado' AS estado_tratamiento,
            @sesiones_cerradas AS sesiones_completadas,
            CASE WHEN @otros_activos = 0 THEN 'TURNED' ELSE 'CUSTOMER' END AS etapa_resultante,
            0 AS ya_cerrado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO

USE [$(MartDatabase)];
GO

CREATE OR ALTER PROCEDURE dbo.usp_ETL_SincronizarCustomerMart
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
        -- 2.1. SINCRONIZACIÃ“N DE DIMENSIONES CONFORMADAS DESDE OLTP
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
        SELECT sv.id_servicio, sv.nombre, ISNULL(sv.descripcion, 'OdontologÃ­a General'), sv.nombre
        FROM [NexoSaludDB].dbo.Servicios sv
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio dsv WHERE dsv.id_servicio = sv.id_servicio);

        -- Sincronizar Dim_Profesional por id_profesional
        INSERT INTO dbo.Dim_Profesional (id_profesional, Odontologo, EspecialidadPrincipal)
        SELECT p.id_profesional, p.nombres + ' ' + p.apellidos, ISNULL(p.especialidad, 'OdontologÃ­a General')
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
        -- 2.2. CARGA HECHO 1: dbo.Fact_TratamientoCustomer (AnÃ¡lisis A)
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
                    WHEN t.fecha_inicio_real IS NOT NULL OR t.estado_tratamiento IN ('En ejecuciÃ³n', 'Completado') THEN 1
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
        -- 2.3. CARGA HECHO 2: dbo.Fact_SesionCustomer (AnÃ¡lisis B)
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
                    WHEN s.estado_asistencial IN ('Realizada', 'Inasistida', 'En sala de espera', 'En atenciÃ³n') THEN 1
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
        -- 2.4. CARGA HECHO 3: dbo.Fact_AtencionCustomer_V2 (AnÃ¡lisis C)
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
                    WHEN a.asistencia IN ('AsistiÃ³', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 1
                    ELSE 0
                END AS atenciones_realizadas,
                CASE
                    WHEN a.asistencia IN ('AsistiÃ³', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
                    ELSE NULL
                END AS minutos_consulta,
                -- C6: EvalÃºa estrictamente la primera revisiÃ³n (numero_revision = 1) en ValidacionesFicha
                CASE
                    WHEN a.asistencia IN ('AsistiÃ³', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND vf1.resultado_validacion = 'Completa'
                    THEN 1
                    ELSE 0
                END AS fichas_completas,
                ISNULL(ind.cant_indicaciones_emitidas, 0) AS indicaciones_emitidas,
                ISNULL(proc_a.cant_procedimientos, 0) AS procedimientos_registrados,
                CASE
                    WHEN a.asistencia IN ('AsistiÃ³', 'Asiste')
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
        -- 2.5. CARGA HECHO 4: dbo.Fact_InteraccionIACustomer (AnÃ¡lisis D)
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
                    WHEN al.estado = 'Atendida' THEN 'ALERTA_ATENDIDA'
                    WHEN al.estado = 'Descartada_Justificada' THEN 'ALERTA_DESCARTADA'
                    ELSE 'ALERTA_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                1 AS alertas_generadas,
                CASE WHEN al.estado = 'Atendida' THEN 1 ELSE 0 END AS alertas_atendidas,
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
                1 AS borradores_generados,
                CASE WHEN b.estado IN ('Aprobado', 'Corregido_Y_Aprobado') THEN 1 ELSE 0 END AS borradores_aprobados
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
        -- 2.6. COMPATIBILIDAD CON dbo.fact_atencion_customer (SECCIÃ“N 8.6, H08)
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
        -- 2.7. RECONCILIACIÃ“N OLTP VS DATA MART (SECCIÃ“N 9, T20)
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
            THROW 56102, 'Error de reconciliaciÃ³n en usp_ETL_SincronizarCustomerMart: Conteos OLTP y Data Mart no coinciden.', 1;
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
            'ReconciliaciÃ³n exacta: Tratamientos=' + CAST(@Mart_Trat AS VARCHAR(10))
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

-- Las medidas modificadas por una carga NO se revierten con estos módulos. Restauración de respaldo requiere aprobación separada y evaluación de RPO. No habilitar cierres legados vulnerables sin control de aplicación.
