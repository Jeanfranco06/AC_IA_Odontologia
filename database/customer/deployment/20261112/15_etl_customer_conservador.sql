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
        -- 2.1. SINCRONIZACIÓN DE DIMENSIONES CONFORMADAS DESDE OLTP
        -- --------------------------------------------------------------------
        ;WITH FechasCustomerOLTP AS (
            SELECT CAST(fecha_contratacion AS DATE) AS fecha FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_contratacion IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_real AS DATE) FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_inicio_real IS NOT NULL
            UNION
            SELECT CAST(fecha_cierre_real AS DATE) FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_cierre_real IS NOT NULL
            UNION
            SELECT CAST(fecha_programada_vigente AS DATE) FROM [$(OltpDatabase)].dbo.SesionesTratamiento WHERE fecha_programada_vigente IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_atencion AS DATE) FROM [$(OltpDatabase)].dbo.SesionesTratamiento WHERE fecha_inicio_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_atencion AS DATE) FROM [$(OltpDatabase)].dbo.Atenciones WHERE fecha_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.InteraccionesIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.AlertasIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.BorradoresIA WHERE fecha_hora IS NOT NULL
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
        FROM [$(OltpDatabase)].dbo.Sedes s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede ds WHERE ds.id_sede = s.id_sede);

        -- Sincronizar Dim_Servicio por id_servicio
        INSERT INTO dbo.Dim_Servicio (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
        SELECT sv.id_servicio, sv.nombre, ISNULL(sv.descripcion, 'Odontología General'), sv.nombre
        FROM [$(OltpDatabase)].dbo.Servicios sv
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio dsv WHERE dsv.id_servicio = sv.id_servicio);

        -- Sincronizar Dim_Profesional por id_profesional
        INSERT INTO dbo.Dim_Profesional (id_profesional, Odontologo, EspecialidadPrincipal)
        SELECT p.id_profesional, p.nombres + ' ' + p.apellidos, ISNULL(p.especialidad, 'Odontología General')
        FROM [$(OltpDatabase)].dbo.Profesionales p
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Profesional dp WHERE dp.id_profesional = p.id_profesional);

        -- Sincronizar combinaciones nuevas de Dim_EstadoAtencion
        INSERT INTO dbo.Dim_EstadoAtencion (EstadoFinal, Asistencia, EstadoCierreDocumental)
        SELECT DISTINCT
            a.estado_servicio,
            a.asistencia,
            ISNULL(a.estado_cierre_documental, 'Pendiente')
        FROM [$(OltpDatabase)].dbo.Atenciones a
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.Dim_EstadoAtencion da
            WHERE da.EstadoFinal = a.estado_servicio
              AND da.Asistencia = a.asistencia
        );

        -- --------------------------------------------------------------------
        -- 2.2. CARGA HECHO 1: dbo.Fact_TratamientoCustomer (Análisis A)
        -- Grano: 1 fila por id_tratamiento
        -- --------------------------------------------------------------------
        ;WITH SesionesCompletadasPorTratamiento AS (
            SELECT
                s.id_tratamiento,
                SUM(CASE WHEN s.estado_asistencial = 'Realizada' AND s.estado_cierre = 'Cerrada' THEN 1 ELSE 0 END) AS sesiones_completadas
            FROM [$(OltpDatabase)].dbo.SesionesTratamiento s
            GROUP BY s.id_tratamiento
        ),
        PlanVigentePorTratamiento AS (
            SELECT
                pt.id_tratamiento,
                pt.version_plan,
                pt.sesiones_planificadas,
                ROW_NUMBER() OVER (PARTITION BY pt.id_tratamiento ORDER BY pt.version_plan DESC) AS rn
            FROM [$(OltpDatabase)].dbo.PlanTratamiento pt
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
                    WHEN t.fecha_inicio_real IS NOT NULL OR t.estado_tratamiento IN ('En ejecución', 'Completado') THEN 1
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
                ISNULL(pv.sesiones_planificadas, 0) AS sesiones_planificadas,
                ISNULL(sc.sesiones_completadas, 0) AS sesiones_completadas,
                CASE
                    WHEN t.estado_tratamiento = 'Completado'
                         AND t.fecha_inicio_real IS NOT NULL
                         AND t.fecha_cierre_real IS NOT NULL
                         AND t.fecha_cierre_real >= t.fecha_inicio_real
                    THEN DATEDIFF(DAY, t.fecha_inicio_real, t.fecha_cierre_real)
                    ELSE NULL
                END AS dias_duracion_real
            FROM [$(OltpDatabase)].dbo.TratamientosContratados t
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
            );

        -- --------------------------------------------------------------------
        -- 2.3. CARGA HECHO 2: dbo.Fact_SesionCustomer (Análisis B)
        -- Grano: 1 fila por id_sesion
        -- --------------------------------------------------------------------
        ;WITH ReprogramacionesPorSesion AS (
            SELECT
                ev.id_sesion,
                SUM(CASE WHEN ev.tipo_cambio = 'REPROGRAMACION' THEN 1 ELSE 0 END) AS cant_reprogramaciones
            FROM [$(OltpDatabase)].dbo.EventosSesion ev
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
                    WHEN s.estado_asistencial IN ('Realizada', 'Inasistida', 'En sala de espera', 'En atención') THEN 1
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
            FROM [$(OltpDatabase)].dbo.SesionesTratamiento s
            INNER JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento
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
            );

        -- --------------------------------------------------------------------
        -- 2.4. CARGA HECHO 3: dbo.Fact_AtencionCustomer_V2 (Análisis C)
        -- Grano: 1 fila por id_atencion
        -- --------------------------------------------------------------------
        ;WITH ProcedimientosPorAtencion AS (
            SELECT
                dp.id_atencion,
                COUNT(dp.id_detalle_procedimiento) AS cant_procedimientos
            FROM [$(OltpDatabase)].dbo.DetalleProcedimiento dp
            GROUP BY dp.id_atencion
        ),
        IndicacionesPorAtencion AS (
            SELECT
                ind.id_atencion,
                SUM(CASE WHEN ind.es_version_vigente = 1 AND ind.estado = 'Documento emitido' THEN 1 ELSE 0 END) AS cant_indicaciones_emitidas
            FROM [$(OltpDatabase)].dbo.IndicacionesPostatencion ind
            GROUP BY ind.id_atencion
        ),
        PrimeraRevisionFicha AS (
            SELECT
                vf.id_atencion,
                vf.resultado_validacion
            FROM [$(OltpDatabase)].dbo.ValidacionesFicha vf
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
                    WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 1
                    ELSE 0
                END AS atenciones_realizadas,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
                    ELSE NULL
                END AS minutos_consulta,
                -- C6: Evalúa estrictamente la primera revisión (numero_revision = 1) en ValidacionesFicha
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND vf1.resultado_validacion = 'Completa'
                    THEN 1
                    ELSE 0
                END AS fichas_completas,
                ISNULL(ind.cant_indicaciones_emitidas, 0) AS indicaciones_emitidas,
                ISNULL(proc_a.cant_procedimientos, 0) AS procedimientos_registrados,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
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
            FROM [$(OltpDatabase)].dbo.Atenciones a
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
            );

        -- --------------------------------------------------------------------
        -- 2.5. CARGA HECHO 4: dbo.Fact_InteraccionIACustomer (Análisis D)
        -- Grano: 1 fila por (ClaseEventoIA, id_origen_ia)
        -- --------------------------------------------------------------------
        -- Incorporar códigos realmente observados; no convertirlos en códigos académicos.
        -- Se conserva la granularidad (ClaseEventoIA, id_origen_ia) del hecho.
        ;WITH TiposObservados AS (
            SELECT tipo_evento AS Codigo, 'INTERACCION' AS Clase FROM [$(OltpDatabase)].dbo.InteraccionesIA
            UNION SELECT tipo_evento, 'ALERTA' FROM [$(OltpDatabase)].dbo.AlertasIA
            UNION SELECT tipo_evento, 'BORRADOR' FROM [$(OltpDatabase)].dbo.BorradoresIA
        ), TiposUnivocos AS (
            SELECT Codigo, MIN(Clase) AS Clase FROM TiposObservados
            WHERE LEN(Codigo) <= 60
            GROUP BY Codigo HAVING COUNT(DISTINCT Clase) = 1
        )
        INSERT INTO dbo.Dim_TipoInteraccionIA (
            CodigoTipoInteraccionIA, ClaseEventoIA, TipoInteraccionIA,
            PropositoOperativo, RequiereAprobacionHumana
        )
        SELECT s.Codigo, s.Clase, s.Codigo, 'Evento operativo observado en OLTP',
               CASE WHEN s.Clase = 'INTERACCION' THEN 0 ELSE 1 END
        FROM TiposUnivocos s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoInteraccionIA d WHERE d.CodigoTipoInteraccionIA = s.Codigo);

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
            FROM [$(OltpDatabase)].dbo.InteraccionesIA i
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = i.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = i.id_atencion

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
                    WHEN al.estado IN ('Atendida', 'Resuelta') THEN 'ALERTA_ATENDIDA'
                    WHEN al.estado = 'Descartada_Justificada' THEN 'ALERTA_DESCARTADA'
                    ELSE 'ALERTA_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                1 AS alertas_generadas,
                CASE WHEN al.estado IN ('Atendida', 'Resuelta') THEN 1 ELSE 0 END AS alertas_atendidas,
                0 AS borradores_generados,
                0 AS borradores_aprobados
            FROM [$(OltpDatabase)].dbo.AlertasIA al
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = al.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = al.id_atencion

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
                CASE WHEN b.id_borrador_raiz IS NULL OR b.id_borrador_raiz = b.id_borrador_ia THEN 1 ELSE 0 END AS borradores_generados,
                CASE WHEN b.es_version_actual = 1 AND b.estado IN ('Aprobado', 'Corregido_Y_Aprobado') THEN 1 ELSE 0 END AS borradores_aprobados
            FROM [$(OltpDatabase)].dbo.BorradoresIA b
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = b.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = b.id_atencion
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
            );

        -- --------------------------------------------------------------------
        -- 2.6. COMPATIBILIDAD CON dbo.fact_atencion_customer (SECCIÓN 8.6, H08)
        -- --------------------------------------------------------------------
        -- Hecho agregado legado preservado; sin reconstrucción destructiva.
        DECLARE @OLTP_Trat INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.TratamientosContratados);
        DECLARE @Mart_Trat INT = (SELECT COUNT(*) FROM dbo.Fact_TratamientoCustomer);

        DECLARE @OLTP_Ses INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.SesionesTratamiento);
        DECLARE @Mart_Ses INT = (SELECT COUNT(*) FROM dbo.Fact_SesionCustomer);

        DECLARE @OLTP_Aten INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.Atenciones);
        DECLARE @Mart_Aten INT = (SELECT COUNT(*) FROM dbo.Fact_AtencionCustomer_V2);

        DECLARE @OLTP_IA INT = (
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.InteraccionesIA) +
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.AlertasIA) +
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.BorradoresIA)
        );
        DECLARE @Mart_IA INT = (SELECT COUNT(*) FROM dbo.Fact_InteraccionIACustomer);

        IF @OLTP_Trat <> @Mart_Trat OR @OLTP_Ses <> @Mart_Ses OR @OLTP_Aten <> @Mart_Aten OR @OLTP_IA <> @Mart_IA
        BEGIN
            THROW 56102, 'Error de reconciliación en usp_ETL_SincronizarCustomerMart: Conteos OLTP y Data Mart no coinciden.', 1;
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
            'Reconciliación exacta: Tratamientos=' + CAST(@Mart_Trat AS VARCHAR(10))
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
