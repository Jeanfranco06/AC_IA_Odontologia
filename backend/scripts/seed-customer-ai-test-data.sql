SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'NexoSaludDB_Test' OR IS_SRVROLEMEMBER(N'sysadmin') = 1
    THROW 55090, 'Fixture bloqueado: requiere NexoSaludDB_Test y una credencial sin rol sysadmin.', 1;

/* Fixture local controlado para customerAiPersistence.test.ts.
   Solo crea tratamientos/sesiones/atenciones si las reservas aún no tienen tratamiento.
   No debe ejecutarse contra producción. */
BEGIN TRANSACTION;

DECLARE @reserva INT, @persona INT, @solicitud INT, @servicio INT, @profesional INT, @sede INT, @fecha DATETIME2;
DECLARE @tratamiento INT, @plan INT, @sesion INT, @atencion INT;

DECLARE reservas_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT TOP (2) r.id_reserva
    FROM dbo.Reservas r
    INNER JOIN dbo.Solicitudes so ON so.id_solicitud = r.id_solicitud
    INNER JOIN dbo.Opciones op ON op.id_opcion = r.id_opcion
    WHERE r.id_reserva IN (122, 123)
      AND NOT EXISTS (SELECT 1 FROM dbo.TratamientosContratados t WHERE t.id_reserva_origen = r.id_reserva)
    ORDER BY r.id_reserva DESC;

OPEN reservas_cursor;
FETCH NEXT FROM reservas_cursor INTO @reserva;
WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @persona = r.id_persona, @solicitud = r.id_solicitud, @servicio = so.id_servicio,
           @profesional = COALESCE(d.id_profesional, (SELECT TOP 1 id_profesional FROM dbo.Profesionales WHERE activo = 1)),
           @sede = COALESCE(d.id_sede, (SELECT TOP 1 id_sede FROM dbo.Sedes WHERE activo = 1)),
           @fecha = DATEADD(DAY, 7, SYSDATETIME())
    FROM dbo.Reservas r
    INNER JOIN dbo.Solicitudes so ON so.id_solicitud = r.id_solicitud
    INNER JOIN dbo.Opciones op ON op.id_opcion = r.id_opcion
    LEFT JOIN dbo.Disponibilidad d ON d.id_disponibilidad = op.id_disponibilidad
    WHERE r.id_reserva = @reserva;

    INSERT dbo.TratamientosContratados (id_persona, id_solicitud, id_reserva_origen, id_servicio, id_profesional_responsable, id_sede, precio_pactado, fecha_contratacion, estado_tratamiento)
    VALUES (@persona, @solicitud, @reserva, @servicio, @profesional, @sede, 250.00, SYSDATETIME(), 'Activado');
    SET @tratamiento = CONVERT(INT, SCOPE_IDENTITY());

    INSERT dbo.PlanTratamiento (id_tratamiento, version_plan, sesiones_planificadas, id_profesional_aprobador, estado_plan)
    VALUES (@tratamiento, 1, 3, @profesional, 'Aprobado');
    SET @plan = CONVERT(INT, SCOPE_IDENTITY());

    INSERT dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
    VALUES (@tratamiento, @plan, 1, @profesional, @sede, @fecha, 'Programada', 'Pendiente', 'Pendiente');
    SET @sesion = CONVERT(INT, SCOPE_IDENTITY());

    INSERT dbo.Atenciones (id_persona, id_reserva, id_servicio, id_profesional, id_sede, fecha_atencion, asistencia, estado_servicio, id_tratamiento, id_sesion, estado_cierre_documental)
    VALUES (@persona, @reserva, @servicio, @profesional, @sede, @fecha, 'Pendiente', 'Programado', @tratamiento, @sesion, 'Pendiente');
    SET @atencion = CONVERT(INT, SCOPE_IDENTITY());

    FETCH NEXT FROM reservas_cursor INTO @reserva;
END;
CLOSE reservas_cursor;
DEALLOCATE reservas_cursor;
COMMIT TRANSACTION;

/* Segunda sesión de demostración para probar el flujo de solicitud de cambio.
   La primera sesión queda deliberadamente fuera del flujo: no se debe reprogramar
   una sesión inicial sin que exista una sesión posterior planificada. */
INSERT dbo.SesionesTratamiento
    (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede,
     fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
SELECT t.id_tratamiento, p.id_plan, 2, s.id_profesional, s.id_sede,
       DATEADD(DAY, 14, s.fecha_programada_vigente), 'Programada', 'Pendiente', 'Pendiente'
FROM dbo.TratamientosContratados t
INNER JOIN dbo.PlanTratamiento p ON p.id_tratamiento = t.id_tratamiento AND p.version_plan = 1
INNER JOIN dbo.SesionesTratamiento s ON s.id_tratamiento = t.id_tratamiento AND s.numero_sesion = 1
WHERE t.id_tratamiento IN (1, 2)
  AND NOT EXISTS (
      SELECT 1 FROM dbo.SesionesTratamiento sx
      WHERE sx.id_tratamiento = t.id_tratamiento AND sx.numero_sesion = 2
  );

SELECT id_tratamiento, id_persona, id_reserva_origen FROM dbo.TratamientosContratados WHERE id_reserva_origen IN (122, 123);
