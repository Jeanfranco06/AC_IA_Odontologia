/*
  POBLAMIENTO TRANSACCIONAL DE DEMOSTRACION - NexoSaludDB existente (Somee)

  No crea ni borra tablas. No modifica pacientes previos. Inserta una cohorte
  sintetica identificable por el correo *@example.invalid. Los nombres son
  plausibles pero no identifican a pacientes reales. No ejecutar si se
  necesitan indicadores exclusivamente reales: estos registros apareceran en
  consultas y reportes hasta que se filtren explicitamente.

  Cohorte: 805 BUYER, 310 que avanzan a LEAD, 125 a PAYER,
  110 a CUSTOMER y 80 a TURNED. Son 805 personas en total, no la suma.
  Tambien inserta campanas, gastos, interacciones, solicitudes, preferencias,
  disponibilidades historicas, opciones, reservas, pagos, atenciones y
  seguimientos relacionados. Todo se confirma o revierte en una transaccion.

  Requisitos comprobados el 2026-10-23: esquema dbo de NexoSaludDB,
  catalogos Etapas, Canales, Fuentes, Sedes, Servicios, Tarifas,
  Profesionales y ProfesionalServicio existentes. No depende de IDs fijos.

  Este archivo solamente prepara datos para la base transaccional. No ejecuta
  el ETL ni modifica NexoSalud_Mart.
*/

USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Prefijo varchar(40) = 'nexosalud-demo-oltp-20261023-';
DECLARE @Dominio varchar(20) = '@example.invalid';
DECLARE @Cantidad int = 805;
DECLARE @IdBuyer int, @IdLead int, @IdPayer int, @IdCustomer int, @IdTurned int;
DECLARE @IdWhatsApp int, @IdWeb int, @IdFuenteSocial int, @IdFuenteWeb int;
DECLARE @IdCampanaSocial int, @IdCampanaWeb int, @IdUsuario int;
DECLARE @Existentes int;

DECLARE @Nombres TABLE (rn int PRIMARY KEY, nombre varchar(50) NOT NULL);
INSERT INTO @Nombres (rn, nombre) VALUES
    (1, 'Ana'), (2, 'María'), (3, 'Lucía'), (4, 'Daniela'), (5, 'Valeria'),
    (6, 'Camila'), (7, 'Andrea'), (8, 'Mariana'), (9, 'Gabriela'), (10, 'Sofía'),
    (11, 'Natalia'), (12, 'Paola'), (13, 'Carolina'), (14, 'Rosa'), (15, 'Claudia'),
    (16, 'Elena'), (17, 'José'), (18, 'Luis'), (19, 'Carlos'), (20, 'Miguel'),
    (21, 'Diego'), (22, 'Javier'), (23, 'Fernando'), (24, 'Ricardo'), (25, 'Andrés');

DECLARE @Apellidos TABLE (rn int PRIMARY KEY, apellido varchar(50) NOT NULL);
INSERT INTO @Apellidos (rn, apellido) VALUES
    (1, 'García'), (2, 'Rodríguez'), (3, 'Fernández'), (4, 'López'),
    (5, 'Martínez'), (6, 'Sánchez'), (7, 'Pérez'), (8, 'Ramírez'),
    (9, 'Torres'), (10, 'Flores'), (11, 'Díaz'), (12, 'Vargas'),
    (13, 'Castillo'), (14, 'Rojas'), (15, 'Mendoza'), (16, 'Chávez'),
    (17, 'Cruz'), (18, 'Medina'), (19, 'Aguilar'), (20, 'Romero'),
    (21, 'Salazar'), (22, 'Herrera'), (23, 'Navarro'), (24, 'Paredes'),
    (25, 'Cabrera'), (26, 'Cárdenas'), (27, 'Quispe'), (28, 'Huamán'),
    (29, 'Espinoza');

DECLARE @TotalNombres int = (SELECT COUNT(*) FROM @Nombres);
DECLARE @TotalApellidos int = (SELECT COUNT(*) FROM @Apellidos);

IF DB_NAME() <> 'NexoSaludDB'
    THROW 50001, 'Se requiere la base NexoSaludDB.', 1;

IF OBJECT_ID('dbo.Personas', 'U') IS NULL
   OR OBJECT_ID('dbo.Seguimientos', 'U') IS NULL
   OR OBJECT_ID('dbo.ProfesionalServicio', 'U') IS NULL
    THROW 50002, 'El esquema transaccional esperado no esta completo.', 1;

SELECT @IdBuyer = id_etapa FROM dbo.Etapas WHERE nombre = 'BUYER';
SELECT @IdLead = id_etapa FROM dbo.Etapas WHERE nombre = 'LEAD';
SELECT @IdPayer = id_etapa FROM dbo.Etapas WHERE nombre = 'PAYER';
SELECT @IdCustomer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';
SELECT @IdTurned = id_etapa FROM dbo.Etapas WHERE nombre = 'TURNED';
SELECT @IdWhatsApp = id_canal FROM dbo.Canales WHERE nombre = 'WhatsApp';
SELECT @IdWeb = id_canal FROM dbo.Canales WHERE nombre = 'Página Web / Portal Online';
SELECT @IdFuenteSocial = id_fuente FROM dbo.Fuentes WHERE nombre = 'Redes Sociales';
SELECT @IdFuenteWeb = id_fuente FROM dbo.Fuentes WHERE nombre = 'Formulario Web - Portal NexoSalud';
SELECT TOP (1) @IdUsuario = id_usuario FROM dbo.Usuarios WHERE activo = 1 ORDER BY id_usuario;

IF @IdBuyer IS NULL OR @IdLead IS NULL OR @IdPayer IS NULL
   OR @IdCustomer IS NULL OR @IdTurned IS NULL OR @IdWhatsApp IS NULL
   OR @IdWeb IS NULL OR @IdFuenteSocial IS NULL OR @IdFuenteWeb IS NULL
    THROW 50003, 'Falta una etapa, canal o fuente requerida; no se inserto nada.', 1;

SELECT @Existentes = COUNT(*)
FROM dbo.Personas
WHERE email LIKE @Prefijo + '%@example.invalid';

IF @Existentes > 0
BEGIN
    IF @Existentes <> @Cantidad
       OR (SELECT COUNT(*) FROM dbo.Solicitudes s JOIN dbo.Personas p ON p.id_persona = s.id_persona WHERE p.email LIKE @Prefijo + '%@example.invalid') <> 310
       OR (SELECT COUNT(*) FROM dbo.Pagos x JOIN dbo.Personas p ON p.id_persona = x.id_persona WHERE p.email LIKE @Prefijo + '%@example.invalid') <> 125
       OR (SELECT COUNT(*) FROM dbo.Atenciones a JOIN dbo.Personas p ON p.id_persona = a.id_persona WHERE p.email LIKE @Prefijo + '%@example.invalid') <> 110
       OR (SELECT COUNT(*) FROM dbo.Seguimientos s JOIN dbo.Personas p ON p.id_persona = s.id_persona WHERE p.email LIKE @Prefijo + '%@example.invalid') <> 80
        THROW 50004, 'La cohorte ya existe parcialmente o fue alterada. Revisar antes de repetir.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        ;WITH Cohorte AS (
            SELECT p.id_persona,
                   TRY_CONVERT(int, SUBSTRING(p.email, LEN(@Prefijo) + 1, 4)) AS seq
            FROM dbo.Personas p
            WHERE p.email LIKE @Prefijo + '[0-9][0-9][0-9][0-9]@example.invalid'
        )
        UPDATE p
        SET nombres = nom.nombre,
            apellidos = CONCAT(pat.apellido, ' ', mat.apellido)
        FROM dbo.Personas p
        JOIN Cohorte c ON c.id_persona = p.id_persona
        JOIN @Nombres nom ON nom.rn = ((c.seq - 1) % @TotalNombres) + 1
        JOIN @Apellidos pat ON pat.rn = ((c.seq - 1) % @TotalApellidos) + 1
        JOIN @Apellidos mat ON mat.rn = (((c.seq - 1) % @TotalApellidos + 1
            + ((c.seq - 1) / @TotalApellidos) % (@TotalApellidos - 1)) % @TotalApellidos) + 1
        WHERE p.nombres = 'Paciente' OR p.apellidos LIKE 'Demo %';

        DECLARE @NombresActualizados int = @@ROWCOUNT;
        IF EXISTS (
            SELECT 1 FROM dbo.Personas
            WHERE email LIKE @Prefijo + '%@example.invalid'
              AND (nombres = 'Paciente' OR apellidos LIKE 'Demo %')
        )
            THROW 50009, 'No se pudieron actualizar todos los nombres de la cohorte.', 1;

        COMMIT TRANSACTION;
        PRINT CONCAT('Cohorte existente: ', @NombresActualizados,
                     ' nombres sinteticos actualizados; no se insertaron personas nuevas.');
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    SELECT ROW_NUMBER() OVER (ORDER BY s.id_servicio) AS rn,
           s.id_servicio, t.precio
    INTO #ServiciosSeed
    FROM dbo.Servicios s
    CROSS APPLY (
        SELECT TOP (1) precio
        FROM dbo.Tarifas
        WHERE id_servicio = s.id_servicio AND activo = 1
        ORDER BY fecha_inicio DESC, id_tarifa DESC
    ) t
    WHERE s.activo = 1
      AND EXISTS (
          SELECT 1 FROM dbo.ProfesionalServicio ps
          JOIN dbo.Profesionales pr ON pr.id_profesional = ps.id_profesional
          WHERE ps.id_servicio = s.id_servicio AND pr.activo = 1
      );

    SELECT ROW_NUMBER() OVER (ORDER BY id_sede) AS rn, id_sede
    INTO #SedesSeed FROM dbo.Sedes WHERE activo = 1;

    DECLARE @TotalServicios int = (SELECT COUNT(*) FROM #ServiciosSeed);
    DECLARE @TotalSedes int = (SELECT COUNT(*) FROM #SedesSeed);
    IF @TotalServicios = 0 OR @TotalSedes = 0
        THROW 50005, 'Se requiere al menos un servicio con tarifa/profesional y una sede activa.', 1;

    INSERT INTO dbo.Campanas
        (nombre, descripcion, id_fuente, id_canal, fecha_inicio, fecha_fin, activo)
    VALUES
        ('DEMO OLTP 2026 - Redes Sociales', 'Datos sinteticos; no representa captacion real', @IdFuenteSocial, @IdWhatsApp, '2026-09-01', '2026-09-30', 0),
        ('DEMO OLTP 2026 - Portal Web', 'Datos sinteticos; no representa captacion real', @IdFuenteWeb, @IdWeb, '2026-09-01', '2026-09-30', 0);

    SELECT @IdCampanaSocial = id_campana FROM dbo.Campanas WHERE nombre = 'DEMO OLTP 2026 - Redes Sociales';
    SELECT @IdCampanaWeb = id_campana FROM dbo.Campanas WHERE nombre = 'DEMO OLTP 2026 - Portal Web';

    INSERT INTO dbo.GastosCampana (id_campana, fecha, importe, descripcion)
    VALUES
        (@IdCampanaSocial, '2026-09-01', 1250.00, 'Gasto sintetico DEMO OLTP'),
        (@IdCampanaSocial, '2026-09-15', 980.00, 'Gasto sintetico DEMO OLTP'),
        (@IdCampanaWeb, '2026-09-01', 740.00, 'Gasto sintetico DEMO OLTP'),
        (@IdCampanaWeb, '2026-09-15', 680.00, 'Gasto sintetico DEMO OLTP');

    SELECT TOP (@Cantidad)
           CAST(ROW_NUMBER() OVER (ORDER BY a.object_id, b.object_id) AS int) AS seq
    INTO #NumerosSeed
    FROM sys.all_objects a CROSS JOIN sys.all_objects b;

    IF (SELECT COUNT(*) FROM #NumerosSeed) <> @Cantidad
        THROW 50006, 'No se pudieron generar los 805 identificadores de la cohorte.', 1;

    INSERT INTO dbo.Personas
        (nombres, apellidos, dni, email, numero, zona, tipo_persona,
         autoriza_contacto, estado_calidad, id_campana_origen,
         id_canal_origen, id_etapa_actual, fecha_registro, fecha_actualizacion)
    SELECT nom.nombre, CONCAT(pat.apellido, ' ', mat.apellido),
           NULL, CONCAT(@Prefijo, RIGHT('0000' + CONVERT(varchar(4), n.seq), 4), @Dominio),
           NULL, CASE WHEN n.seq % 3 = 0 THEN 'Centro' WHEN n.seq % 3 = 1 THEN 'California' ELSE 'Primavera' END,
           'Adulto General', 0, 'Valido',
           CASE WHEN n.seq % 2 = 0 THEN @IdCampanaSocial ELSE @IdCampanaWeb END,
           CASE WHEN n.seq % 2 = 0 THEN @IdWhatsApp ELSE @IdWeb END,
           @IdBuyer,
           DATEADD(DAY, (n.seq - 1) % 20, CONVERT(datetime2(0), '2026-09-01T09:00:00')),
           DATEADD(DAY, (n.seq - 1) % 20, CONVERT(datetime2(0), '2026-09-01T09:00:00'))
    FROM #NumerosSeed n
    JOIN @Nombres nom ON nom.rn = ((n.seq - 1) % @TotalNombres) + 1
    JOIN @Apellidos pat ON pat.rn = ((n.seq - 1) % @TotalApellidos) + 1
    JOIN @Apellidos mat ON mat.rn = (((n.seq - 1) % @TotalApellidos + 1
        + ((n.seq - 1) / @TotalApellidos) % (@TotalApellidos - 1)) % @TotalApellidos) + 1;

    SELECT n.seq, p.id_persona, p.fecha_registro AS fecha_base,
           sv.id_servicio, sv.precio, sed.id_sede, prof.id_profesional,
           p.id_campana_origen AS id_campana,
           p.id_canal_origen AS id_canal,
           CASE WHEN n.seq % 2 = 0 THEN @IdFuenteSocial ELSE @IdFuenteWeb END AS id_fuente
    INTO #PersonasSeed
    FROM #NumerosSeed n
    JOIN dbo.Personas p ON p.email = CONCAT(@Prefijo, RIGHT('0000' + CONVERT(varchar(4), n.seq), 4), @Dominio)
    JOIN #ServiciosSeed sv ON sv.rn = ((n.seq - 1) % @TotalServicios) + 1
    JOIN #SedesSeed sed ON sed.rn = ((n.seq - 1) % @TotalSedes) + 1
    CROSS APPLY (
        SELECT TOP (1) ps.id_profesional
        FROM dbo.ProfesionalServicio ps
        JOIN dbo.Profesionales pr ON pr.id_profesional = ps.id_profesional AND pr.activo = 1
        WHERE ps.id_servicio = sv.id_servicio
        ORDER BY CASE WHEN ps.id_profesional % 2 = n.seq % 2 THEN 0 ELSE 1 END,
                 ps.id_profesional
    ) prof;

    IF (SELECT COUNT(*) FROM #PersonasSeed) <> @Cantidad
        THROW 50007, 'No se pudo relacionar toda la cohorte con servicios, sedes y profesionales.', 1;

    CREATE UNIQUE CLUSTERED INDEX IX_PersonasSeed_seq ON #PersonasSeed(seq);

    INSERT INTO dbo.Interacciones
        (id_persona, id_canal, id_fuente, id_usuario, fecha_hora,
         tipo, mensaje, es_respuesta_util, resultado)
    SELECT id_persona, id_canal, id_fuente, NULL, DATEADD(MINUTE, 10, fecha_base),
           'Registro Inicial', 'Registro sintetico DEMO OLTP 2026',
           CASE WHEN seq <= 310 THEN 1 ELSE 0 END, 'Contacto de demostracion'
    FROM #PersonasSeed;

    INSERT INTO dbo.Interacciones
        (id_persona, id_canal, id_fuente, id_usuario, fecha_hora,
         tipo, mensaje, es_respuesta_util, resultado)
    SELECT id_persona, id_canal, id_fuente, @IdUsuario, DATEADD(HOUR, 1, fecha_base),
           'Seguimiento comercial', 'Interaccion sintetica DEMO OLTP 2026', 1,
           'Solicitud de informacion'
    FROM #PersonasSeed WHERE seq <= 310;

    INSERT INTO dbo.EventosEtapa
        (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
    SELECT id_persona, NULL, @IdBuyer, fecha_base, NULL, 'DEMO OLTP 2026: ingreso BUYER'
    FROM #PersonasSeed;

    INSERT INTO dbo.Solicitudes
        (id_persona, id_servicio, fecha_solicitud, motivo, tipo_consulta,
         prioridad, estado, fecha_primera_respuesta, fecha_cierre)
    SELECT id_persona, id_servicio, DATEADD(HOUR, 2, fecha_base),
           'Consulta sintetica DEMO OLTP 2026', 'Evaluacion', 'Normal',
           CASE WHEN seq <= 125 THEN 'Convertida' ELSE 'Abierta' END,
           DATEADD(HOUR, 3, fecha_base),
           CASE WHEN seq <= 125 THEN DATEADD(DAY, 2, fecha_base) ELSE NULL END
    FROM #PersonasSeed WHERE seq <= 310;

    INSERT INTO dbo.PersonaPreferencias
        (id_persona, id_canal, id_servicio_interes, sede_preferida, fecha_inicio)
    SELECT ps.id_persona, ps.id_canal, ps.id_servicio, sed.nombre, DATEADD(HOUR, 2, ps.fecha_base)
    FROM #PersonasSeed ps JOIN dbo.Sedes sed ON sed.id_sede = ps.id_sede
    WHERE ps.seq <= 310;

    INSERT INTO dbo.EventosEtapa
        (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
    SELECT id_persona, @IdBuyer, @IdLead, DATEADD(HOUR, 2, fecha_base),
           @IdUsuario, 'DEMO OLTP 2026: solicitud LEAD'
    FROM #PersonasSeed WHERE seq <= 310;

    DECLARE @i int = 1, @IdPersona int, @IdServicio int, @IdSede int,
            @IdProfesional int, @IdSolicitud int, @IdDisponibilidad int,
            @IdOpcion int, @IdReserva int, @IdAtencion int,
            @Precio decimal(12,2), @Base datetime2(0), @FechaCita datetime2(0),
            @HoraInicio time(0), @HoraFin time(0);

    WHILE @i <= 125
    BEGIN
        SELECT @IdPersona = id_persona, @IdServicio = id_servicio,
               @IdSede = id_sede, @IdProfesional = id_profesional,
               @Precio = precio, @Base = fecha_base
        FROM #PersonasSeed WHERE seq = @i;

        SELECT @IdSolicitud = id_solicitud FROM dbo.Solicitudes WHERE id_persona = @IdPersona;
        SET @HoraInicio = TIMEFROMPARTS(8 + ((@i - 1) % 10), 0, 0, 0, 0);
        SET @HoraFin = TIMEFROMPARTS(9 + ((@i - 1) % 10), 0, 0, 0, 0);
        SET @FechaCita = DATEADD(HOUR, 8 + ((@i - 1) % 10),
                        CONVERT(datetime2(0), CONVERT(date, DATEADD(DAY, 3, @Base))));

        INSERT INTO dbo.Disponibilidad
            (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
        VALUES (@IdProfesional, @IdSede, CONVERT(date, @FechaCita),
                @HoraInicio, @HoraFin, 'Ocupado');
        SET @IdDisponibilidad = CONVERT(int, SCOPE_IDENTITY());

        INSERT INTO dbo.Opciones
            (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
        VALUES (@IdSolicitud, @IdDisponibilidad, @Precio,
                DATEADD(DAY, 1, @Base), 1);
        SET @IdOpcion = CONVERT(int, SCOPE_IDENTITY());

        INSERT INTO dbo.Reservas
            (id_persona, id_solicitud, id_opcion, fecha_reserva, estado,
             confirmacion_explicita, fecha_confirmacion)
        VALUES (@IdPersona, @IdSolicitud, @IdOpcion, DATEADD(DAY, 2, @Base),
                'Confirmada', 1, DATEADD(HOUR, 1, DATEADD(DAY, 2, @Base)));
        SET @IdReserva = CONVERT(int, SCOPE_IDENTITY());

        INSERT INTO dbo.Pagos
            (id_persona, id_reserva, referencia_pago, importe, canal_pago,
             fecha_registro, fecha_validacion, estado, validado_por, observaciones)
        VALUES (@IdPersona, @IdReserva,
                CONCAT('DEMO-OLTP-2026-', RIGHT('0000' + CONVERT(varchar(4), @i), 4)),
                @Precio, CASE WHEN @i % 2 = 0 THEN 'Yape' ELSE 'Tarjeta' END,
                DATEADD(HOUR, 2, DATEADD(DAY, 2, @Base)),
                DATEADD(HOUR, 3, DATEADD(DAY, 2, @Base)),
                'Validado', @IdUsuario, 'Pago sintetico; sin transaccion financiera');
        INSERT INTO dbo.EventosEtapa
            (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
        VALUES (@IdPersona, @IdLead, @IdPayer,
                DATEADD(HOUR, 3, DATEADD(DAY, 2, @Base)),
                @IdUsuario, 'DEMO OLTP 2026: pago validado PAYER');

        IF @i <= 110
        BEGIN
            INSERT INTO dbo.Atenciones
                (id_persona, id_reserva, id_servicio, id_profesional, id_sede,
                 fecha_atencion, fecha_inicio, fecha_fin, asistencia,
                 estado_servicio, motivo_consulta, evaluacion, diagnostico_basico,
                 procedimiento, procedimiento_realizado, observaciones, resultado,
                 indicaciones_finales)
            VALUES
                (@IdPersona, @IdReserva, @IdServicio, @IdProfesional, @IdSede,
                 @FechaCita, @FechaCita, DATEADD(MINUTE, 45, @FechaCita),
                 'Asiste', 'Finalizado', 'Consulta sintetica DEMO OLTP 2026',
                 'Evaluacion de demostracion', 'Registro sintetico',
                 'Procedimiento de demostracion', 'Procedimiento de demostracion',
                 'No corresponde a un paciente real', 'Finalizado',
                 'Indicaciones sinteticas');
            SET @IdAtencion = CONVERT(int, SCOPE_IDENTITY());

            INSERT INTO dbo.EventosEtapa
                (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
            VALUES (@IdPersona, @IdPayer, @IdCustomer, @FechaCita,
                    @IdUsuario, 'DEMO OLTP 2026: atencion CUSTOMER');

            IF @i <= 80
            BEGIN
                INSERT INTO dbo.Seguimientos
                    (id_persona, id_atencion, id_usuario, fecha_hora, canal,
                     tipo, resultado, satisfaccion, incidencia, observaciones)
                VALUES (@IdPersona, @IdAtencion, @IdUsuario,
                        DATEADD(DAY, 2, @FechaCita), 'WhatsApp', 'Postventa',
                        'Seguimiento sintetico satisfactorio',
                        CASE WHEN @i % 5 = 0 THEN 4 ELSE 5 END,
                        0, 'DEMO OLTP 2026; no contactar');

                INSERT INTO dbo.EventosEtapa
                    (id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo)
                VALUES (@IdPersona, @IdCustomer, @IdTurned,
                        DATEADD(DAY, 2, @FechaCita), @IdUsuario,
                        'DEMO OLTP 2026: seguimiento TURNED');
            END;
        END;

        SET @i += 1;
    END;

    UPDATE p
    SET id_etapa_actual = CASE
            WHEN ps.seq <= 80 THEN @IdTurned
            WHEN ps.seq <= 110 THEN @IdCustomer
            WHEN ps.seq <= 125 THEN @IdPayer
            WHEN ps.seq <= 310 THEN @IdLead
            ELSE @IdBuyer END,
        fecha_actualizacion = CASE
            WHEN ps.seq <= 80 THEN DATEADD(DAY, 5, ps.fecha_base)
            WHEN ps.seq <= 110 THEN DATEADD(DAY, 3, ps.fecha_base)
            WHEN ps.seq <= 125 THEN DATEADD(DAY, 2, ps.fecha_base)
            WHEN ps.seq <= 310 THEN DATEADD(HOUR, 2, ps.fecha_base)
            ELSE ps.fecha_base END
    FROM dbo.Personas p JOIN #PersonasSeed ps ON ps.id_persona = p.id_persona;

    IF (SELECT COUNT(*) FROM dbo.Personas WHERE email LIKE @Prefijo + '%@example.invalid') <> 805
       OR (SELECT COUNT(*) FROM dbo.Pagos x JOIN #PersonasSeed ps ON ps.id_persona = x.id_persona) <> 125
       OR (SELECT COUNT(*) FROM dbo.Atenciones a JOIN #PersonasSeed ps ON ps.id_persona = a.id_persona) <> 110
       OR (SELECT COUNT(*) FROM dbo.Seguimientos s JOIN #PersonasSeed ps ON ps.id_persona = s.id_persona) <> 80
        THROW 50008, 'La verificacion final de la cohorte fallo; se revierte todo.', 1;

    COMMIT TRANSACTION;
    PRINT 'Poblamiento transaccional sintetico completado: 805 personas, 310 solicitudes, 125 pagos, 110 atenciones y 80 seguimientos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
