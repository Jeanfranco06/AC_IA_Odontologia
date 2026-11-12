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

        IF @numero_sesion<=1 OR @duracion_min<=0 OR @fecha_programada<=SYSUTCDATETIME()
          THROW 55910,'Ordinal, duración o fecha no elegibles para nueva sesión CUSTOMER.',1;
        IF EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WITH(UPDLOCK,HOLDLOCK) WHERE id_tratamiento=@id_tratamiento AND numero_sesion=@numero_sesion)
          THROW 55911,'El ordinal ya está programado.',1;
        IF @id_disponibilidad IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.Disponibilidad WITH(UPDLOCK,HOLDLOCK) WHERE id_disponibilidad=@id_disponibilidad AND estado='Disponible' AND disponible=1 AND id_profesional=@id_profesional AND id_sede=@id_sede AND CAST(fecha AS DATE)=CAST(@fecha_programada AS DATE) AND CAST(hora_inicio AS TIME)=CAST(@fecha_programada AS TIME) AND DATEDIFF(MINUTE,hora_inicio,hora_fin)>=@duracion_min)
          THROW 55912,'Horario inexistente, incompatible o no disponible.',1;
        IF EXISTS(SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion=r.id_opcion WHERE o.id_disponibilidad=@id_disponibilidad)
          THROW 55913,'El horario pertenece a la reserva inicial PAYER.',1;


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

        IF @id_plan IS NULL OR @numero_sesion > @max_sesiones
            THROW 55222, 'El número de sesión excede las sesiones planificadas en el plan clínico vigente.', 1;

        -- R05: Validar que el profesional no tenga otra sesión activa solapada en el mismo horario
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
            THROW 55223, 'CONFLICTO DE AGENDA (R05): El profesional ya tiene una sesión asignada que se solapa con el horario solicitado.', 1;
        END;

        IF @id_disponibilidad IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM dbo.Disponibilidad WITH (UPDLOCK, HOLDLOCK)
                WHERE id_disponibilidad = @id_disponibilidad AND estado <> 'Disponible'
            )
            BEGIN
                THROW 55224, 'CONFLICTO DE SILLÓN (R05): El turno de disponibilidad seleccionado ya no se encuentra Disponible.', 1;
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
            NULL, 'Programada', 'Programación de sesión #' + CAST(@numero_sesion AS VARCHAR(10)) + ' del tratamiento',
            @id_usuario_responsable
        );

        -- Crear registro de Atención programada vinculada a la sesión y a la reserva origen del contrato (sin duplicar Reservas: R03, R04)
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
