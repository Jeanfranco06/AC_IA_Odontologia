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

    SET @fecha_evento = ISNULL(@fecha_evento, SYSUTCDATETIME());

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
            THROW 55240, 'La sesión indicada no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado')
            THROW 55241, 'El tratamiento se encuentra Suspendido o Cancelado; no puede ejecutarse la sesión.', 1;

        -- R02: Verificar siempre el guardián financiero antes de iniciar atención
        SELECT @es_habilitado = es_habilitado_customer, @motivo_guardian = motivo_guardian
        FROM dbo.fn_VerificarGuardianFinancieroCustomer(@id_reserva);

        IF @accion IN ('CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION') AND @es_habilitado <> 1
        BEGIN
            DECLARE @err VARCHAR(300) = 'GUARDIÁN FINANCIERO (R02): Atención bloqueada por incumplimiento financiero (' + ISNULL(@motivo_guardian, 'SIN_VALIDACION') + ').';
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
                asistencia = 'Asistió',
                estado_servicio = 'En proceso'
            WHERE id_atencion = @id_atencion;

            -- Si es la primera atención efectiva del tratamiento, marcar fecha_inicio_real y estado 'En ejecución'
            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, @fecha_evento),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INICIO_ATENCION', @estado_asist_ant, 'Realizada', 'Ingreso del paciente a sillón odontológico', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'FINALIZAR_ATENCION'
        BEGIN
            -- R09: Una sesión realizada puede quedar pendiente de cierre documental
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = fecha_llegada,
                fecha_inicio_atencion = fecha_inicio_atencion,
                estado_asistencial = 'Realizada',
                estado_cierre = 'Pendiente'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = fecha_inicio,
                fecha_fin = @fecha_evento,
                asistencia = 'Asistió',
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
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;
        END
        ELSE IF @accion = 'CONFIRMAR_INASISTENCIA'
        BEGIN
            IF NULLIF(LTRIM(RTRIM(@motivo_inasistencia)), '') IS NULL
                SET @motivo_inasistencia = 'Paciente no se presentó a la sesión programada (No-Show confirmado)';

            UPDATE dbo.SesionesTratamiento
            SET estado_asistencial = 'Inasistida',
                estado_cierre = 'No Aplica',
                motivo_inasistencia = @motivo_inasistencia
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'No asistió',
                estado_servicio = 'Cancelado'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INASISTENCIA', @estado_asist_ant, 'Inasistida', @motivo_inasistencia, @id_usuario_responsable, @fecha_evento);
        END
        ELSE
        BEGIN
            THROW 55243, 'Acción asistencial no reconocida.', 1;
        END;

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion, @accion AS accion_ejecutada;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
