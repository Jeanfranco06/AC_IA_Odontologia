/* =========================================================================================
   SIMULACION END-TO-END COHERENTE: DEL EMBUDO COMPLETO DE 10K BUYERS HASTA CUSTOMER
   =========================================================================================
   Proyecto: NexoSalud Odontologia
   Ambiente: Base de pruebas local (NexoSaludDB)
   Requisito previo: 08_poblamiento_buyer_10k.sql ejecutado previamente (Cohorte SIM_BUYER_10K_V1).
   
   Embudo y Coherencia del Negocio:
   1. BUYER:     10 000 captaciones | 8 500 utilizables (85%) | 1 500 descartados
   2. LEAD:       2 550 solicitudes abiertas (30% de utilizables)
                  -> 1 530 convertidas (60% aceptacion) | 1 020 cerradas/abandonadas (40%)
   3. PAYER:      1 530 reservas creadas y pagos registrados
                  -> 1 300 pagos validados (85% Guardian de Dominio)
                  ->   150 pagos fallidos/rechazados (10%)
                  ->    80 pagos pendientes de revision (5%)
   4. CUSTOMER:   1 300 pacientes promovidos a CUSTOMER (con cita en sillon clinico)
                  -> 1 105 asistencias efectivas (85% asistencia) con atencion 'Realizada'
                  ->   130 inasistencias no-show (10%)
                  ->    65 cancelaciones anticipadas / reprogramaciones (5%)
   ========================================================================================= */

USE NexoSaludDB;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    PRINT '>>> INICIANDO POBLAMIENTO COHERENTE DEL EMBUDO: LEAD -> PAYER -> CUSTOMER...';

    -- 1. Verificaciones previas
    IF NOT EXISTS (SELECT 1 FROM dbo.Personas WHERE email LIKE '%@sim-buyer-10k-v1.invalid')
        THROW 53001, 'No se encontro la cohorte SIM_BUYER_10K_V1. Ejecutar primero 08_poblamiento_buyer_10k.sql.', 1;

    DECLARE @IdEtapaBuyer INT, @IdEtapaLead INT, @IdEtapaPayer INT, @IdEtapaCustomer INT;
    SELECT @IdEtapaBuyer    = id_etapa FROM dbo.Etapas WHERE nombre = 'BUYER';
    SELECT @IdEtapaLead     = id_etapa FROM dbo.Etapas WHERE nombre = 'LEAD';
    SELECT @IdEtapaPayer    = id_etapa FROM dbo.Etapas WHERE nombre = 'PAYER';
    SELECT @IdEtapaCustomer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';

    IF @IdEtapaBuyer IS NULL OR @IdEtapaLead IS NULL OR @IdEtapaPayer IS NULL OR @IdEtapaCustomer IS NULL
        THROW 53002, 'Faltan etapas del funnel en la tabla dbo.Etapas.', 1;

    -- Usuario administrador/sistema para auditoria
    DECLARE @IdUsuarioAdmin INT;
    SELECT TOP 1 @IdUsuarioAdmin = id_usuario FROM dbo.Usuarios WHERE activo = 1;
    IF @IdUsuarioAdmin IS NULL SET @IdUsuarioAdmin = 1;

    -- Tablas temporales de trabajo
    DROP TABLE IF EXISTS #SolicitudesV1, #Convertidas, #NoConvertidas, #SlotsDisponibles, #PagosDetalle, #AtencionesDetalle;

    -- 2. Seleccionar las 2 550 Solicitudes de la cohorte V1
    SELECT 
        s.id_solicitud,
        s.id_persona,
        s.id_servicio,
        s.fecha_solicitud,
        c.id_sede,
        ROW_NUMBER() OVER (ORDER BY s.id_solicitud) AS nro_fila
    INTO #SolicitudesV1
    FROM dbo.Solicitudes s
    JOIN dbo.Personas p ON p.id_persona = s.id_persona
    JOIN dbo.CaptacionesBuyer c ON c.id_persona = p.id_persona
    WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid';

    DECLARE @TotalSolicitudes INT = (SELECT COUNT(*) FROM #SolicitudesV1);
    IF @TotalSolicitudes <> 2550
        THROW 53003, 'Se esperaban exactamente 2 550 solicitudes en la cohorte V1.', 1;

    PRINT CONCAT('    * Solicitudes V1 encontradas: ', @TotalSolicitudes);

    -- 3. Segmentar Solicitudes en LEAD:
    --    - 1 530 Convertidas (60%)
    --    - 1 020 Abandonadas/Cerradas (40%)
    SELECT * INTO #Convertidas   FROM #SolicitudesV1 WHERE nro_fila <= 1530;
    SELECT * INTO #NoConvertidas FROM #SolicitudesV1 WHERE nro_fila > 1530;

    -- 4. Actualizar Solicitudes NO Convertidas (1 020)
    UPDATE s
    SET s.fecha_primera_respuesta = DATEADD(MINUTE, 8 + (s.id_solicitud % 12), s.fecha_solicitud),
        s.fecha_cierre = DATEADD(DAY, 2 + (s.id_solicitud % 4), s.fecha_solicitud),
        s.estado = CASE WHEN (s.id_solicitud % 2) = 0 THEN 'Abandonada' ELSE 'Cerrada' END,
        s.motivo = CASE 
            WHEN (s.id_solicitud % 3) = 0 THEN 'Desiste por incompatibilidad de horario con jornada laboral'
            WHEN (s.id_solicitud % 3) = 1 THEN 'Presupuesto fuera de su alcance actual; evaluara despues'
            ELSE 'No respondio a la propuesta economica tras seguimiento'
        END
    FROM dbo.Solicitudes s
    JOIN #NoConvertidas nc ON nc.id_solicitud = s.id_solicitud;

    -- 5. Actualizar Solicitudes Convertidas (1 530)
    UPDATE s
    SET s.fecha_primera_respuesta = DATEADD(MINUTE, 5 + (s.id_solicitud % 8), s.fecha_solicitud),
        s.fecha_cierre = DATEADD(DAY, 1 + (s.id_solicitud % 3), s.fecha_solicitud),
        s.estado = 'Convertida',
        s.motivo = 'Paciente acepto propuesta y fecha de atencion; genera reserva'
    FROM dbo.Solicitudes s
    JOIN #Convertidas c ON c.id_solicitud = s.id_solicitud;

    PRINT '    * Solicitudes LEAD actualizadas (1 530 convertidas, 1 020 cerradas/abandonadas).';

    -- 6. Crear slots de Disponibilidad y Opciones para las 1 530 solicitudes convertidas
    -- Obtenemos profesionales activos por sede
    DECLARE @DefaultSede INT = (SELECT TOP 1 id_sede FROM dbo.Sedes WHERE activo = 1);
    DECLARE @DefaultProf INT = (SELECT TOP 1 id_profesional FROM dbo.Profesionales WHERE activo = 1);

    -- Tabla de slots a insertar
    CREATE TABLE #SlotsGenerados (
        id_solicitud INT,
        id_persona INT,
        id_servicio INT,
        id_sede INT,
        id_profesional INT,
        fecha_cita DATE,
        hora_inicio TIME,
        hora_fin TIME,
        precio DECIMAL(10,2),
        id_disponibilidad INT NULL,
        id_opcion INT NULL
    );

    INSERT INTO #SlotsGenerados (
        id_solicitud, id_persona, id_servicio, id_sede, id_profesional,
        fecha_cita, hora_inicio, hora_fin, precio
    )
    SELECT 
        c.id_solicitud,
        c.id_persona,
        ISNULL(c.id_servicio, (SELECT TOP 1 id_servicio FROM dbo.Servicios WHERE activo = 1)),
        ISNULL(c.id_sede, @DefaultSede),
        ISNULL((
            SELECT TOP 1 ps.id_profesional 
            FROM dbo.ProfesionalServicio ps 
            WHERE ps.id_servicio = c.id_servicio
        ), @DefaultProf),
        CAST(DATEADD(DAY, 4 + (c.id_solicitud % 10), c.fecha_solicitud) AS DATE),
        TIMEFROMPARTS(9 + (c.id_solicitud % 9), 0, 0, 0, 0),
        TIMEFROMPARTS(10 + (c.id_solicitud % 9), 0, 0, 0, 0),
        CASE 
            WHEN c.id_servicio = 1 THEN 80.00   -- Consulta / Diagnostico
            WHEN c.id_servicio = 2 THEN 150.00  -- Profilaxis / Limpieza
            WHEN c.id_servicio = 3 THEN 250.00  -- Curacion estetica
            WHEN c.id_servicio = 4 THEN 450.00  -- Ortodoncia inicial
            ELSE 180.00
        END
    FROM #Convertidas c;

    -- Insertar Disponibilidades
    INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
    SELECT id_profesional, id_sede, fecha_cita, hora_inicio, hora_fin, 'Ocupado'
    FROM #SlotsGenerados;

    -- Mapear id_disponibilidad generado usando CTE
    ;WITH CTE_Disp AS (
        SELECT id_disponibilidad, 
               ROW_NUMBER() OVER (ORDER BY id_disponibilidad DESC) AS rn_desc
        FROM dbo.Disponibilidad
    ),
    CTE_Slots AS (
        SELECT id_solicitud,
               ROW_NUMBER() OVER (ORDER BY id_solicitud DESC) AS rn_desc
        FROM #SlotsGenerados
    )
    UPDATE s
    SET s.id_disponibilidad = d.id_disponibilidad
    FROM #SlotsGenerados s
    JOIN CTE_Slots cs ON cs.id_solicitud = s.id_solicitud
    JOIN CTE_Disp d ON d.rn_desc = cs.rn_desc;

    -- Insertar Opciones
    INSERT INTO dbo.Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
    SELECT s.id_solicitud, s.id_disponibilidad, s.precio, DATEADD(DAY, 1, sol.fecha_solicitud), 1
    FROM #SlotsGenerados s
    JOIN dbo.Solicitudes sol ON sol.id_solicitud = s.id_solicitud;

    ;WITH CTE_Opc AS (
        SELECT id_opcion, id_solicitud,
               ROW_NUMBER() OVER (PARTITION BY id_solicitud ORDER BY id_opcion DESC) AS rn
        FROM dbo.Opciones
    )
    UPDATE s
    SET s.id_opcion = o.id_opcion
    FROM #SlotsGenerados s
    JOIN CTE_Opc o ON o.id_solicitud = s.id_solicitud AND o.rn = 1;

    PRINT '    * Disponibilidades y Opciones creadas para 1 530 negociaciones.';

    -- 7. Insertar 1 530 Reservas en estado inicial
    CREATE TABLE #ReservasGeneradas (
        id_solicitud INT,
        id_persona INT,
        id_reserva INT
    );

    INSERT INTO dbo.Reservas (
        id_persona, id_solicitud, id_opcion, fecha_reserva, estado,
        fecha_vencimiento_bloqueo, confirmacion_explicita, fecha_confirmacion
    )
    SELECT 
        s.id_persona,
        s.id_solicitud,
        s.id_opcion,
        DATEADD(DAY, 2, sol.fecha_solicitud),
        'Pendiente',
        DATEADD(HOUR, 48, DATEADD(DAY, 2, sol.fecha_solicitud)),
        0,
        NULL
    FROM #SlotsGenerados s
    JOIN dbo.Solicitudes sol ON sol.id_solicitud = s.id_solicitud;

    ;WITH CTE_Res AS (
        SELECT id_reserva, id_solicitud,
               ROW_NUMBER() OVER (PARTITION BY id_solicitud ORDER BY id_reserva DESC) AS rn
        FROM dbo.Reservas
    )
    INSERT INTO #ReservasGeneradas (id_solicitud, id_persona, id_reserva)
    SELECT s.id_solicitud, s.id_persona, r.id_reserva
    FROM #SlotsGenerados s
    JOIN CTE_Res r ON r.id_solicitud = s.id_solicitud AND r.rn = 1;

    PRINT '    * 1 530 Reservas generadas.';

    -- 8. Registrar Pagos y Eventos LEAD -> PAYER
    -- Mapeo de canales de pago realistas
    CREATE TABLE #PagosBase (
        id_persona INT,
        id_reserva INT,
        id_solicitud INT,
        referencia_pago VARCHAR(100),
        importe DECIMAL(10,2),
        canal_pago VARCHAR(50),
        fecha_registro DATETIME2,
        fecha_validacion DATETIME2 NULL,
        estado_pago VARCHAR(20),
        comprobante VARCHAR(100) NULL,
        tipo_resultado VARCHAR(20), -- 'VALIDADO', 'FALLIDO', 'PENDIENTE'
        id_pago INT NULL
    );

    INSERT INTO #PagosBase (
        id_persona, id_reserva, id_solicitud, referencia_pago, importe, canal_pago,
        fecha_registro, fecha_validacion, estado_pago, comprobante, tipo_resultado
    )
    SELECT 
        rg.id_persona,
        rg.id_reserva,
        rg.id_solicitud,
        CONCAT('OP-', YEAR(sol.fecha_solicitud), '-', RIGHT('000000' + CAST(rg.id_reserva AS VARCHAR(10)), 6)),
        sg.precio,
        CASE (rg.id_reserva % 4)
            WHEN 0 THEN 'Yape / Plin'
            WHEN 1 THEN 'Tarjeta Niubiz Web'
            WHEN 2 THEN 'Transferencia BCP'
            ELSE 'Efectivo Recepcion'
        END,
        DATEADD(HOUR, 3, DATEADD(DAY, 2, sol.fecha_solicitud)),
        -- 1 300 Validados (fila <= 1300), 150 Fallidos, 80 Pendientes
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1300 
                THEN DATEADD(MINUTE, 35 + (rg.id_reserva % 50), DATEADD(HOUR, 3, DATEADD(DAY, 2, sol.fecha_solicitud)))
            ELSE NULL 
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1300 THEN 'Confirmado'
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1450 THEN 'Fallido'
            ELSE 'Pendiente'
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1300 
                THEN CONCAT('BOL-EB01-', RIGHT('000000' + CAST(rg.id_reserva AS VARCHAR(10)), 6))
            ELSE NULL
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1300 THEN 'VALIDADO'
            WHEN ROW_NUMBER() OVER (ORDER BY rg.id_reserva) <= 1450 THEN 'FALLIDO'
            ELSE 'PENDIENTE'
        END
    FROM #ReservasGeneradas rg
    JOIN #SlotsGenerados sg ON sg.id_solicitud = rg.id_solicitud
    JOIN dbo.Solicitudes sol ON sol.id_solicitud = rg.id_solicitud;

    INSERT INTO dbo.Pagos (
        id_persona, id_reserva, referencia_pago, importe, canal_pago,
        fecha_registro, fecha_validacion, estado, comprobante, validado_por, observaciones
    )
    SELECT 
        id_persona, id_reserva, referencia_pago, importe, canal_pago,
        fecha_registro, fecha_validacion, estado_pago, comprobante,
        CASE WHEN tipo_resultado = 'VALIDADO' THEN @IdUsuarioAdmin ELSE NULL END,
        CASE 
            WHEN tipo_resultado = 'VALIDADO' THEN 'Abono validado formalmente por tesoreria'
            WHEN tipo_resultado = 'FALLIDO'  THEN 'Comprobante no coincide con extracto bancario'
            ELSE 'En espera de acreditacion interbancaria'
        END
    FROM #PagosBase;

    -- Evento LEAD -> PAYER para todos los que iniciaron pago
    INSERT INTO dbo.EventosEtapa (
        id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo, evidencia, id_solicitud
    )
    SELECT 
        pb.id_persona,
        @IdEtapaLead,
        @IdEtapaPayer,
        pb.fecha_registro,
        @IdUsuarioAdmin,
        'Registro de pago de reserva generado',
        CONCAT('Comprobante ref: ', pb.referencia_pago, ' por S/ ', pb.importe),
        pb.id_solicitud
    FROM #PagosBase pb;

    PRINT '    * 1 530 Pagos registrados y eventos LEAD -> PAYER generados.';

    -- 9. Actualizar Estados de Reservas segun validacion
    -- Fallidos (150) -> Cancelada
    UPDATE r
    SET r.estado = 'Cancelada'
    FROM dbo.Reservas r
    JOIN #PagosBase pb ON pb.id_reserva = r.id_reserva
    WHERE pb.tipo_resultado = 'FALLIDO';

    -- Validados (1 300) -> Confirmada con confirmacion explicita
    UPDATE r
    SET r.estado = 'Confirmada',
        r.confirmacion_explicita = 1,
        r.fecha_confirmacion = pb.fecha_validacion
    FROM dbo.Reservas r
    JOIN #PagosBase pb ON pb.id_reserva = r.id_reserva
    WHERE pb.tipo_resultado = 'VALIDADO';

    PRINT '    * 1 300 Reservas Confirmadas y 150 Canceladas por pago fallido.';

    -- 10. Promover a CUSTOMER los 1 300 pacientes con pago validado
    UPDATE p
    SET p.id_etapa_actual = @IdEtapaCustomer,
        p.fecha_actualizacion = pb.fecha_validacion
    FROM dbo.Personas p
    JOIN #PagosBase pb ON pb.id_persona = p.id_persona
    WHERE pb.tipo_resultado = 'VALIDADO';

    -- Evento PAYER -> CUSTOMER
    INSERT INTO dbo.EventosEtapa (
        id_persona, etapa_origen, etapa_destino, fecha_hora, id_usuario, motivo, evidencia, id_solicitud
    )
    SELECT 
        pb.id_persona,
        @IdEtapaPayer,
        @IdEtapaCustomer,
        pb.fecha_validacion,
        @IdUsuarioAdmin,
        'Guardian de Dominio: pago validado y cita confirmada en sillon',
        CONCAT('Comprobante emitido: ', pb.comprobante),
        pb.id_solicitud
    FROM #PagosBase pb
    WHERE pb.tipo_resultado = 'VALIDADO';

    PRINT '    * 1 300 Pacientes promovidos formalmente a CUSTOMER (con EventoEtapa registrado).';

    -- 11. Generar Atenciones Clinicas en Sillon para los 1 300 CUSTOMERS
    -- Segmentacion de asistencia:
    -- - 1 105 Asistio / Realizado (85%)
    -- -   130 No asistio / Cancelado (10% No-show)
    -- -    65 Pendiente / Reprogramado (5%)
    
    CREATE TABLE #AtencionesBase (
        id_persona INT,
        id_reserva INT,
        id_servicio INT,
        id_profesional INT,
        id_sede INT,
        fecha_atencion DATETIME2,
        fecha_inicio DATETIME2 NULL,
        fecha_fin DATETIME2 NULL,
        asistencia VARCHAR(20),
        estado_servicio VARCHAR(30),
        motivo_consulta VARCHAR(300),
        diagnostico_basico VARCHAR(200),
        procedimiento_realizado VARCHAR(200),
        nro_orden INT
    );

    INSERT INTO #AtencionesBase (
        id_persona, id_reserva, id_servicio, id_profesional, id_sede,
        fecha_atencion, fecha_inicio, fecha_fin, asistencia, estado_servicio,
        motivo_consulta, diagnostico_basico, procedimiento_realizado, nro_orden
    )
    SELECT 
        sg.id_persona,
        pb.id_reserva,
        sg.id_servicio,
        sg.id_profesional,
        sg.id_sede,
        CAST(CONCAT(sg.fecha_cita, ' ', sg.hora_inicio) AS DATETIME2),
        -- Asistio: inicio y fin reales
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1105
                THEN CAST(CONCAT(sg.fecha_cita, ' ', sg.hora_inicio) AS DATETIME2)
            ELSE NULL
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1105
                THEN DATEADD(MINUTE, 35 + (pb.id_reserva % 30), CAST(CONCAT(sg.fecha_cita, ' ', sg.hora_inicio) AS DATETIME2))
            ELSE NULL
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1105 THEN 'Asiste'
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1235 THEN 'No asiste'
            ELSE 'Pendiente'
        END,
        CASE 
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1105 THEN 'Realizado'
            WHEN ROW_NUMBER() OVER (ORDER BY pb.id_reserva) <= 1235 THEN 'Cancelado'
            ELSE 'Programado'
        END,
        'Evaluacion inicial y tratamiento odontologico segun plan de atencion',
        CASE (pb.id_reserva % 4)
            WHEN 0 THEN 'Caries dental superficial en esmalte (K02.0)'
            WHEN 1 THEN 'Gingivitis cronica asociada a placa (K05.1)'
            WHEN 2 THEN 'Maloclusion dental Angle clase I (K07.2)'
            ELSE 'Salud periodontal aceptable; requiere profilaxis preventiva'
        END,
        CASE (pb.id_reserva % 4)
            WHEN 0 THEN 'Curacion dental con resina nanohibrida fotocurable'
            WHEN 1 THEN 'Profilaxis dental ultrasonica y destartraje supra-gingival'
            WHEN 2 THEN 'Toma de modelos de estudio, fotos clinicas y planimetria'
            ELSE 'Limpieza profunda, aplicacion de fluor barniz y profilaxis'
        END,
        ROW_NUMBER() OVER (ORDER BY pb.id_reserva)
    FROM #PagosBase pb
    JOIN #SlotsGenerados sg ON sg.id_solicitud = pb.id_solicitud
    WHERE pb.tipo_resultado = 'VALIDADO';

    INSERT INTO dbo.Atenciones (
        id_persona, id_reserva, id_servicio, id_profesional, id_sede,
        fecha_atencion, fecha_inicio, fecha_fin, asistencia, estado_servicio,
        motivo_consulta, antecedentes, alergias, evaluacion,
        diagnostico_basico, procedimiento, procedimiento_realizado
    )
    SELECT 
        id_persona, id_reserva, id_servicio, id_profesional, id_sede,
        fecha_atencion, fecha_inicio, fecha_fin, asistencia, estado_servicio,
        motivo_consulta,
        'Sin antecedentes sistemicos relevantes reportados en anamnesis',
        'Niega alergias medicamentosas conocidas',
        'Cavidad oral examinada clinicamente; mucosa sana, piezas completas',
        diagnostico_basico,
        procedimiento_realizado,
        procedimiento_realizado
    FROM #AtencionesBase;

    -- Actualizar Reservas de los que ya asistieron a 'Atendida' o 'Cancelada'
    UPDATE r
    SET r.estado = 'Atendida'
    FROM dbo.Reservas r
    JOIN #AtencionesBase ab ON ab.id_reserva = r.id_reserva
    WHERE ab.asistencia IN ('Asiste', 'Asistió');

    UPDATE r
    SET r.estado = 'Cancelada'
    FROM dbo.Reservas r
    JOIN #AtencionesBase ab ON ab.id_reserva = r.id_reserva
    WHERE ab.asistencia IN ('No asiste', 'No asistió');

    PRINT '    * 1 300 Atenciones creadas: 1 105 Asistieron (Realizadas), 130 No-shows y 65 Pendientes.';

    COMMIT TRANSACTION;

    PRINT '=========================================================================================';
    PRINT '>>> OK: EMBUDO COMPLETO SIMULADO Y CONCILIADO CON EXITO (10K BUYER -> CUSTOMER).';
    PRINT '=========================================================================================';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrNum INT = ERROR_NUMBER();
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrLine INT = ERROR_LINE();
    RAISERROR('Error %d en linea %d: %s', 16, 1, @ErrNum, @ErrLine, @ErrMsg);
END CATCH;
GO
