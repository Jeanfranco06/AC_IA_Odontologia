CREATE OR ALTER PROCEDURE dbo.usp_CerrarTratamientoYTransicionarTurned
    @id_tratamiento             INT,
    @id_profesional_cierre      INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSUTCDATETIME();

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

        IF NOT EXISTS(SELECT 1 FROM dbo.Profesionales p JOIN dbo.TratamientosContratados t ON t.id_profesional_responsable=p.id_profesional WHERE t.id_tratamiento=@id_tratamiento AND p.id_profesional=@id_profesional_cierre AND p.activo=1 AND p.numero_colegiatura IS NOT NULL)
            THROW 55920,'El cierre requiere al profesional responsable activo y colegiado.',1;
        IF @estado_actual = 'Completado'
        BEGIN
            COMMIT TRANSACTION;
            SELECT @id_tratamiento AS id_tratamiento, 'Completado' AS estado_tratamiento, 1 AS ya_cerrado;
            RETURN;
        END;

        IF @estado_actual <> 'En ejecución' OR @fecha_inicio IS NULL
            THROW 55261, 'CIERRE DE TRATAMIENTO (R13): Solo puede cerrarse como Completado un tratamiento que haya iniciado efectivamente.', 1;

        SELECT TOP (1) @sesiones_plan = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @sesiones_plan IS NULL OR @sesiones_plan<1
            THROW 55921,'Cierre sin plan vigente válido.',1;
        IF (SELECT COUNT(*) FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento)<>@sesiones_plan
           OR EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento AND (estado_asistencial<>'Realizada' OR estado_cierre<>'Cerrada' OR numero_sesion<1 OR numero_sesion>@sesiones_plan))
            THROW 55922,'Existen sesiones pendientes o excepciones que requieren revisión profesional.',1;
        IF EXISTS(SELECT 1 FROM dbo.Atenciones a OUTER APPLY(SELECT TOP(1) v.* FROM dbo.ValidacionesFicha v WHERE v.id_atencion=a.id_atencion ORDER BY numero_revision DESC)v WHERE a.id_tratamiento=@id_tratamiento AND (v.id_validacion IS NULL OR v.resultado_validacion<>'Completa' OR v.revision_ficha<>a.revision_ficha OR NOT EXISTS(SELECT 1 FROM dbo.PoliticasCustomerIA p WHERE p.id_politica=v.id_politica_ia AND p.estado='Publicada' AND p.codigo='DOCUMENTACION' AND p.id_servicio=a.id_servicio)))
            THROW 55923,'Validación documental no vigente para el cierre formal.',1;
        SELECT
            @sesiones_cerradas = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Cerrada' THEN 1 ELSE 0 END),
            @sesiones_pendientes_cierre = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Pendiente' THEN 1 ELSE 0 END)
        FROM dbo.SesionesTratamiento
        WHERE id_tratamiento = @id_tratamiento;

        IF ISNULL(@sesiones_pendientes_cierre, 0) > 0
            THROW 55262, 'CIERRE DE TRATAMIENTO (R13): Existen sesiones realizadas con cierre documental pendiente.', 1;

        IF ISNULL(@sesiones_cerradas, 0) < ISNULL(@sesiones_plan, 1)
            THROW 55263, 'CIERRE DE TRATAMIENTO (R12/R13): No se han completado todas las sesiones planificadas del plan clínico vigente.', 1;

        UPDATE dbo.TratamientosContratados
        SET estado_tratamiento = 'Completado',
            fecha_cierre_real = @ahora,
            id_profesional_cierre = @id_profesional_cierre,
            fecha_actualizacion = @ahora
        WHERE id_tratamiento = @id_tratamiento;

        -- Verificar si la persona tiene algún otro tratamiento activo antes de pasar su estado global a TURNED (Sección 12)
        DECLARE @otros_activos INT;
        SELECT @otros_activos = COUNT(*)
        FROM dbo.TratamientosContratados
        WHERE id_persona = @id_persona
          AND id_tratamiento <> @id_tratamiento
          AND estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución');

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
                @id_usuario_responsable, 'Tratamiento odontológico formalmente completado y cerrado',
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
