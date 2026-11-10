-- ====================================================================
-- ARCHIVO: 02_catalogos_customer.sql
-- FASE: CUSTOMER (Catálogos Clínicos y Migración Controlada de Históricos)
-- BASE DE DATOS: NexoSaludDB (OLTP)
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Inserta roles clínicos necesarios ('Odontologo', 'AuditorClinico').
--   2. Clasifica de forma controlada los pagos históricos 'Confirmado'
--      sin sobrescribir su estado a 'Validado' cuando carecen de evidencia
--      de conciliación (H01).
--   3. Migra de manera idempotente las reservas y atenciones históricas de
--      CUSTOMER hacia TratamientosContratados, PlanTratamiento,
--      SesionesTratamiento, EventosSesion, DetalleProcedimiento y
--      ValidacionesFicha sin inventar tiempos de espera ni precios.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSaludDB];
GO

BEGIN TRANSACTION;

-- 1. Catálogo de Roles Clínicos y de Auditoría para CUSTOMER
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre = 'Odontologo')
    INSERT INTO dbo.Roles (nombre) VALUES ('Odontologo');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE nombre = 'AuditorClinico')
    INSERT INTO dbo.Roles (nombre) VALUES ('AuditorClinico');

-- Asegurar al menos un usuario auditor clínico para trazabilidad de validaciones
IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE email = 'auditoria.clinica@nexosalud.pe')
BEGIN
    DECLARE @id_rol_auditor INT = (SELECT TOP 1 id_rol FROM dbo.Roles WHERE nombre = 'AuditorClinico');
    INSERT INTO dbo.Usuarios (nombres, apellidos, email, password_hash, id_rol, activo)
    VALUES ('Elena', 'Valdivia', 'auditoria.clinica@nexosalud.pe', 'HASH_AUDITOR_CLINICO_2026', @id_rol_auditor, 1);
END;

-- 2. H01: Regla documentada de migración de estados en Pagos
-- No equiparar automáticamente 'Confirmado' con 'Validado' si falta referencia_pago o si fecha_validacion < fecha_registro.
UPDATE p
SET p.estado = 'Validado',
    p.origen_validacion = 'HISTORICO_CONCILIADO_CON_EVIDENCIA'
FROM dbo.Pagos p
INNER JOIN dbo.Reservas r ON r.id_reserva = p.id_reserva
WHERE p.estado = 'Confirmado'
  AND p.importe > 0
  AND p.referencia_pago IS NOT NULL
  AND p.fecha_validacion IS NOT NULL
  AND p.fecha_validacion >= p.fecha_registro
  AND r.estado IN ('Confirmada', 'Atendida');

UPDATE p
SET p.origen_validacion = 'HISTORICO_OBSERVADO_SIN_EVIDENCIA_CONCILIACION'
FROM dbo.Pagos p
WHERE p.estado = 'Confirmado'
  AND p.origen_validacion IS NULL;

UPDATE p
SET p.origen_validacion = 'VALIDACION_OFICIAL_PAYER'
FROM dbo.Pagos p
WHERE p.estado IN ('Validado', 'VALIDADO', 'VALIDATED')
  AND p.origen_validacion IS NULL;

PRINT 'Clasificación controlada de pagos históricos (H01) aplicada.';

-- 3. Migrar Reservas con Atención o Pago Conciliado hacia TratamientosContratados (1 por id_reserva_origen)
;WITH ResumenAtencionesPorReserva AS (
    SELECT
        a.id_reserva,
        COUNT(*) AS total_atenciones,
        SUM(CASE WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 1 ELSE 0 END) AS atenciones_realizadas,
        MIN(CASE WHEN a.asistencia IN ('Asistió', 'Asiste') THEN COALESCE(a.fecha_inicio, a.fecha_atencion) END) AS primer_inicio_real,
        MAX(CASE WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN COALESCE(a.fecha_fin, a.fecha_atencion) END) AS ultimo_fin_real,
        MIN(a.id_servicio) AS id_servicio_atencion,
        MIN(a.id_profesional) AS id_prof_atencion,
        MIN(a.id_sede) AS id_sede_atencion
    FROM dbo.Atenciones a
    GROUP BY a.id_reserva
)
INSERT INTO dbo.TratamientosContratados (
    id_persona,
    id_solicitud,
    id_reserva_origen,
    id_servicio,
    id_profesional_responsable,
    id_sede,
    precio_pactado,
    fecha_contratacion,
    fecha_activacion,
    fecha_inicio_real,
    fecha_fin_prevista,
    fecha_cierre_real,
    estado_tratamiento,
    id_profesional_cierre,
    fecha_creacion
)
SELECT
    r.id_persona,
    r.id_solicitud,
    r.id_reserva AS id_reserva_origen,
    COALESCE(ra.id_servicio_atencion, s.id_servicio, 1) AS id_servicio,
    COALESCE(ra.id_prof_atencion, d.id_profesional, 1) AS id_profesional_responsable,
    COALESCE(ra.id_sede_atencion, d.id_sede, 1) AS id_sede,
    ISNULL(o.precio_ofrecido, 0.00) AS precio_pactado,
    r.fecha_reserva AS fecha_contratacion,
    COALESCE(r.fecha_confirmacion, r.fecha_reserva) AS fecha_activacion,
    ra.primer_inicio_real AS fecha_inicio_real,
    DATEADD(DAY, ISNULL(ra.total_atenciones, 1) * 7, r.fecha_reserva) AS fecha_fin_prevista,
    -- Solo marcar como Completado si la persona ya pasó a TURNED o si todas sus sesiones históricas fueron realizadas
    CASE
        WHEN e.nombre = 'TURNED' AND ra.primer_inicio_real IS NOT NULL
        THEN CASE WHEN ra.ultimo_fin_real >= ra.primer_inicio_real THEN ra.ultimo_fin_real ELSE ra.primer_inicio_real END
        ELSE NULL
    END AS fecha_cierre_real,
    CASE
        WHEN e.nombre = 'TURNED' AND ra.primer_inicio_real IS NOT NULL THEN 'Completado'
        WHEN ra.primer_inicio_real IS NOT NULL THEN 'En ejecución'
        ELSE 'Activado'
    END AS estado_tratamiento,
    CASE
        WHEN e.nombre = 'TURNED' AND ra.primer_inicio_real IS NOT NULL THEN COALESCE(ra.id_prof_atencion, d.id_profesional, 1)
        ELSE NULL
    END AS id_profesional_cierre,
    r.fecha_reserva
FROM dbo.Reservas r
INNER JOIN dbo.Personas per ON per.id_persona = r.id_persona
INNER JOIN dbo.Etapas e ON e.id_etapa = per.id_etapa_actual
INNER JOIN dbo.Solicitudes s ON s.id_solicitud = r.id_solicitud
INNER JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion
LEFT JOIN dbo.Disponibilidad d ON d.id_disponibilidad = o.id_disponibilidad
LEFT JOIN ResumenAtencionesPorReserva ra ON ra.id_reserva = r.id_reserva
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TratamientosContratados t WHERE t.id_reserva_origen = r.id_reserva
)
AND (
    ra.id_reserva IS NOT NULL
    OR EXISTS (SELECT 1 FROM dbo.Pagos p WHERE p.id_reserva = r.id_reserva AND p.estado IN ('Validado', 'Confirmado'))
);

-- Enlazar Pagos existentes con su TratamientoContratado
UPDATE p
SET p.id_tratamiento = t.id_tratamiento
FROM dbo.Pagos p
INNER JOIN dbo.TratamientosContratados t ON t.id_reserva_origen = p.id_reserva
WHERE p.id_tratamiento IS NULL;

-- 4. Crear PlanTratamiento versión 1 para cada TratamientoContratado que aún no tenga plan
;WITH ConteoSesiones AS (
    SELECT
        t.id_tratamiento,
        COUNT(a.id_atencion) AS cant_atenciones
    FROM dbo.TratamientosContratados t
    LEFT JOIN dbo.Atenciones a ON a.id_reserva = t.id_reserva_origen
    GROUP BY t.id_tratamiento
)
INSERT INTO dbo.PlanTratamiento (
    id_tratamiento,
    version_plan,
    es_vigente,
    fecha_aprobacion,
    id_profesional_aprobador,
    sesiones_planificadas,
    duracion_estimada,
    estado_plan,
    motivo_modificacion,
    fecha_creacion
)
SELECT
    t.id_tratamiento,
    1 AS version_plan,
    1 AS es_vigente,
    ISNULL(t.fecha_activacion, t.fecha_contratacion) AS fecha_aprobacion,
    t.id_profesional_responsable,
    CASE
        WHEN t.estado_tratamiento = 'Completado' THEN
            CASE
                WHEN (SELECT COUNT(*) FROM dbo.Atenciones a2 WHERE a2.id_reserva = t.id_reserva_origen AND a2.asistencia IN ('Asistió', 'Asiste')) > 0
                THEN (SELECT COUNT(*) FROM dbo.Atenciones a2 WHERE a2.id_reserva = t.id_reserva_origen AND a2.asistencia IN ('Asistió', 'Asiste'))
                ELSE 1
            END
        WHEN ISNULL(cs.cant_atenciones, 0) > 1 THEN cs.cant_atenciones
        ELSE 1
    END AS sesiones_planificadas,
    CASE WHEN ISNULL(cs.cant_atenciones, 1) > 1 THEN cs.cant_atenciones * 7 ELSE 7 END AS duracion_estimada,
    'Aprobado' AS estado_plan,
    'Plan inicial migrado desde histórico operativo' AS motivo_modificacion,
    t.fecha_creacion
FROM dbo.TratamientosContratados t
INNER JOIN ConteoSesiones cs ON cs.id_tratamiento = t.id_tratamiento
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PlanTratamiento pt WHERE pt.id_tratamiento = t.id_tratamiento
);

-- 5. Migrar Atenciones existentes hacia SesionesTratamiento (1 sesión por Atención histórica)
-- Nota: No se inventa fecha_llegada para registros históricos que no la registraron (minutos_espera = NULL).
;WITH AtencionesNumeradas AS (
    SELECT
        a.id_atencion,
        t.id_tratamiento,
        pt.id_plan,
        ROW_NUMBER() OVER (PARTITION BY t.id_tratamiento ORDER BY a.fecha_atencion ASC, a.id_atencion ASC) AS numero_sesion,
        a.id_profesional,
        a.id_sede,
        o.id_disponibilidad,
        COALESCE(a.fecha_inicio, a.fecha_atencion) AS fecha_programada_vigente,
        a.fecha_inicio,
        a.fecha_fin,
        a.asistencia,
        a.estado_servicio
    FROM dbo.Atenciones a
    INNER JOIN dbo.TratamientosContratados t ON t.id_reserva_origen = a.id_reserva
    INNER JOIN dbo.PlanTratamiento pt ON pt.id_tratamiento = t.id_tratamiento AND pt.es_vigente = 1
    INNER JOIN dbo.Reservas r ON r.id_reserva = a.id_reserva
    INNER JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion
    WHERE a.id_sesion IS NULL
)
INSERT INTO dbo.SesionesTratamiento (
    id_tratamiento,
    id_plan,
    numero_sesion,
    id_profesional,
    id_sede,
    id_disponibilidad,
    fecha_programada_vigente,
    duracion_programada_min,
    fecha_llegada,
    fecha_inicio_atencion,
    fecha_cierre_sesion,
    estado_programacion,
    estado_asistencial,
    estado_cierre,
    motivo_inasistencia,
    fecha_creacion
)
SELECT
    an.id_tratamiento,
    an.id_plan,
    an.numero_sesion,
    an.id_profesional,
    an.id_sede,
    CASE WHEN an.numero_sesion = 1 THEN an.id_disponibilidad ELSE NULL END,
    an.fecha_programada_vigente,
    45 AS duracion_programada_min,
    NULL AS fecha_llegada, -- Prohibido inventar tiempo de espera en históricos sin fecha_llegada
    CASE WHEN an.asistencia IN ('Asistió', 'Asiste') THEN an.fecha_inicio ELSE NULL END AS fecha_inicio_atencion,
    CASE WHEN an.asistencia IN ('Asistió', 'Asiste') AND an.estado_servicio IN ('Realizado', 'Finalizado') THEN COALESCE(an.fecha_fin, an.fecha_programada_vigente) ELSE NULL END AS fecha_cierre_sesion,
    'Programada' AS estado_programacion,
    CASE
        WHEN an.asistencia IN ('Asistió', 'Asiste') THEN 'Realizada'
        WHEN an.asistencia IN ('No asistió', 'No asiste') THEN 'Inasistida'
        WHEN an.asistencia = 'Confirmada' THEN 'Confirmada'
        ELSE 'Pendiente'
    END AS estado_asistencial,
    CASE
        WHEN an.asistencia IN ('Asistió', 'Asiste') AND an.estado_servicio IN ('Realizado', 'Finalizado') THEN 'Cerrada'
        WHEN an.asistencia IN ('No asistió', 'No asiste') THEN 'No Aplica'
        ELSE 'Pendiente'
    END AS estado_cierre,
    CASE
        WHEN an.asistencia IN ('No asistió', 'No asiste') THEN 'Inasistencia histórica observada'
        ELSE NULL
    END AS motivo_inasistencia,
    an.fecha_programada_vigente
FROM AtencionesNumeradas an
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SesionesTratamiento s
    WHERE s.id_tratamiento = an.id_tratamiento AND s.numero_sesion = an.numero_sesion
);

-- Enlazar cada Atención histórica con su Tratamiento y su Sesión correspondiente
;WITH MapaAtencionSesion AS (
    SELECT
        a.id_atencion,
        t.id_tratamiento,
        ROW_NUMBER() OVER (PARTITION BY t.id_tratamiento ORDER BY a.fecha_atencion ASC, a.id_atencion ASC) AS num_sesion
    FROM dbo.Atenciones a
    INNER JOIN dbo.TratamientosContratados t ON t.id_reserva_origen = a.id_reserva
    WHERE a.id_sesion IS NULL
)
UPDATE a
SET a.id_tratamiento = m.id_tratamiento,
    a.id_sesion = s.id_sesion,
    a.estado_cierre_documental = CASE
        WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 'Cerrada'
        ELSE 'Pendiente'
    END,
    a.id_profesional_validador_cierre = CASE
        WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN a.id_profesional
        ELSE NULL
    END,
    a.fecha_validacion_cierre = CASE
        WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN COALESCE(a.fecha_fin, a.fecha_atencion)
        ELSE NULL
    END
FROM dbo.Atenciones a
INNER JOIN MapaAtencionSesion m ON m.id_atencion = a.id_atencion
INNER JOIN dbo.SesionesTratamiento s ON s.id_tratamiento = m.id_tratamiento AND s.numero_sesion = m.num_sesion;

-- Para TratamientosContratados sin ninguna Atención histórica, crear su Sesión 1 pendiente
INSERT INTO dbo.SesionesTratamiento (
    id_tratamiento,
    id_plan,
    numero_sesion,
    id_profesional,
    id_sede,
    id_disponibilidad,
    fecha_programada_vigente,
    duracion_programada_min,
    estado_programacion,
    estado_asistencial,
    estado_cierre,
    fecha_creacion
)
SELECT
    t.id_tratamiento,
    pt.id_plan,
    1 AS numero_sesion,
    t.id_profesional_responsable,
    t.id_sede,
    o.id_disponibilidad,
    t.fecha_contratacion,
    45,
    'Programada',
    'Pendiente',
    'Pendiente',
    t.fecha_creacion
FROM dbo.TratamientosContratados t
INNER JOIN dbo.PlanTratamiento pt ON pt.id_tratamiento = t.id_tratamiento AND pt.es_vigente = 1
INNER JOIN dbo.Reservas r ON r.id_reserva = t.id_reserva_origen
INNER JOIN dbo.Opciones o ON o.id_opcion = r.id_opcion
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SesionesTratamiento s WHERE s.id_tratamiento = t.id_tratamiento
);

-- 6. Migrar DetalleProcedimiento desde Atenciones históricas que tienen procedimiento_realizado
INSERT INTO dbo.DetalleProcedimiento (
    id_atencion,
    id_servicio,
    procedimiento_realizado,
    fecha_registro,
    id_profesional,
    implica_cargo_adicional,
    observaciones
)
SELECT
    a.id_atencion,
    a.id_servicio,
    COALESCE(NULLIF(LTRIM(RTRIM(a.procedimiento_realizado)), ''), NULLIF(LTRIM(RTRIM(a.procedimiento)), '')),
    COALESCE(a.fecha_fin, a.fecha_atencion),
    a.id_profesional,
    0,
    a.observaciones
FROM dbo.Atenciones a
WHERE NULLIF(LTRIM(RTRIM(COALESCE(a.procedimiento_realizado, a.procedimiento))), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.DetalleProcedimiento dp WHERE dp.id_atencion = a.id_atencion
  );

-- 7. Migrar ValidacionesFicha (Revisión 1) para Atenciones históricas realizadas
INSERT INTO dbo.ValidacionesFicha (
    id_atencion,
    numero_revision,
    fecha_revision,
    resultado_validacion,
    campos_pendientes,
    id_profesional_validador
)
SELECT
    a.id_atencion,
    1 AS numero_revision,
    COALESCE(a.fecha_fin, a.fecha_atencion) AS fecha_revision,
    CASE
        WHEN NULLIF(LTRIM(RTRIM(COALESCE(a.procedimiento_realizado, a.procedimiento))), '') IS NOT NULL
             AND NULLIF(LTRIM(RTRIM(a.motivo_consulta)), '') IS NOT NULL
        THEN 'Completa'
        ELSE 'Incompleta'
    END AS resultado_validacion,
    CASE
        WHEN NULLIF(LTRIM(RTRIM(COALESCE(a.procedimiento_realizado, a.procedimiento))), '') IS NOT NULL
             AND NULLIF(LTRIM(RTRIM(a.motivo_consulta)), '') IS NOT NULL
        THEN NULL
        ELSE 'Falta completar motivo_consulta o indicaciones_finales en registro histórico'
    END AS campos_pendientes,
    a.id_profesional
FROM dbo.Atenciones a
WHERE a.asistencia IN ('Asistió', 'Asiste')
  AND a.estado_servicio IN ('Realizado', 'Finalizado')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ValidacionesFicha vf WHERE vf.id_atencion = a.id_atencion AND vf.numero_revision = 1
  );

-- Si alguna atención histórica tenía revisión 1 Incompleta pero ya fue cerrada en el histórico,
-- registrar la revisión 2 como Completa (conservando intacta la revisión 1 para el indicador C6!)
INSERT INTO dbo.ValidacionesFicha (
    id_atencion,
    numero_revision,
    fecha_revision,
    resultado_validacion,
    campos_pendientes,
    id_profesional_validador
)
SELECT
    vf.id_atencion,
    2 AS numero_revision,
    DATEADD(MINUTE, 10, vf.fecha_revision),
    'Completa',
    NULL,
    vf.id_profesional_validador
FROM dbo.ValidacionesFicha vf
INNER JOIN dbo.Atenciones a ON a.id_atencion = vf.id_atencion
WHERE vf.numero_revision = 1
  AND vf.resultado_validacion = 'Incompleta'
  AND a.estado_cierre_documental = 'Cerrada'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ValidacionesFicha vf2 WHERE vf2.id_atencion = vf.id_atencion AND vf2.numero_revision = 2
  );

-- 8. Migrar IndicacionesPostatencion desde Atenciones históricas que ya tenían indicaciones_finales
INSERT INTO dbo.IndicacionesPostatencion (
    id_atencion,
    version,
    es_version_vigente,
    estado,
    contenido_indicaciones,
    origen_documento,
    id_profesional_aprobador,
    fecha_aprobacion,
    fecha_emision,
    fecha_creacion
)
SELECT
    a.id_atencion,
    1 AS version,
    1 AS es_version_vigente,
    'Documento emitido' AS estado,
    a.indicaciones_finales,
    'PROFESIONAL' AS origen_documento,
    a.id_profesional,
    COALESCE(a.fecha_fin, a.fecha_atencion),
    COALESCE(a.fecha_fin, a.fecha_atencion),
    COALESCE(a.fecha_fin, a.fecha_atencion)
FROM dbo.Atenciones a
WHERE NULLIF(LTRIM(RTRIM(a.indicaciones_finales)), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM dbo.IndicacionesPostatencion ind WHERE ind.id_atencion = a.id_atencion
  );

UPDATE dbo.IndicacionesPostatencion
SET id_documento_raiz = id_indicacion
WHERE id_documento_raiz IS NULL;

-- 9. Migrar AntecedentesClinicos estructurados desde PersonaSaludOdontologica para pacientes con TratamientoContratado
INSERT INTO dbo.AntecedentesClinicos (
    id_persona,
    id_salud_odonto_origen,
    categoria_antecedente,
    descripcion_antecedente,
    nivel_riesgo,
    estado_verificacion,
    id_profesional_verificador,
    fecha_verificacion,
    fecha_registro
)
SELECT
    pso.id_persona,
    pso.id_salud_odonto,
    CASE
        WHEN pso.condicion_atencion_especial IN ('Diabetes', 'Hipertensión', 'Embarazo') THEN 'CONDICION_SISTEMICA'
        ELSE 'ODONTOLOGICO_PREVIO'
    END AS categoria_antecedente,
    'Triaje odontológico inicial: Tratamiento previo = ' + ISNULL(pso.tratamiento_previo, 'Ninguno')
        + ' | Condición = ' + ISNULL(pso.condicion_atencion_especial, 'Ninguna')
        + ' | Dolor = ' + ISNULL(pso.nivel_dolor, 'Ninguno'),
    CASE
        WHEN pso.condicion_atencion_especial IN ('Diabetes', 'Hipertensión', 'Embarazo') THEN 'Alto'
        WHEN pso.nivel_dolor = 'Intenso' THEN 'Medio'
        ELSE 'Bajo'
    END AS nivel_riesgo,
    'Verificado' AS estado_verificacion,
    (SELECT TOP 1 t.id_profesional_responsable FROM dbo.TratamientosContratados t WHERE t.id_persona = pso.id_persona ORDER BY t.id_tratamiento ASC) AS id_profesional_verificador,
    pso.fecha_registro AS fecha_verificacion,
    pso.fecha_registro
FROM dbo.PersonaSaludOdontologica pso
WHERE EXISTS (
    SELECT 1 FROM dbo.TratamientosContratados t WHERE t.id_persona = pso.id_persona
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.AntecedentesClinicos ac WHERE ac.id_salud_odonto_origen = pso.id_salud_odonto
);

-- 10. Semilla inicial determinista e idempotente de eventos del Copiloto IA (6.10) sobre tratamientos existentes
-- 10.1. InteraccionesIA (orientación de agenda al paciente y resumen de progreso al profesional)
IF NOT EXISTS (SELECT 1 FROM dbo.InteraccionesIA)
BEGIN
    DECLARE @id_usr_rev_int INT = (SELECT TOP 1 id_usuario FROM dbo.Usuarios WHERE email = 'auditoria.clinica@nexosalud.pe');

    INSERT INTO dbo.InteraccionesIA (
        id_persona,
        id_profesional,
        id_tratamiento,
        id_sesion,
        id_atencion,
        actor_orientado,
        tipo_evento,
        resumen_consulta,
        fecha_hora,
        estado,
        resultado,
        requiere_revision_humana,
        id_usuario_revisor,
        id_profesional_aprobador,
        fecha_aprobacion,
        version_agente,
        es_diagnostico_o_prescripcion
    )
    SELECT TOP 20
        t.id_persona,
        s.id_profesional,
        t.id_tratamiento,
        s.id_sesion,
        a.id_atencion,
        CASE WHEN s.numero_sesion % 2 = 1 THEN 'PACIENTE' ELSE 'ODONTOLOGO' END AS actor_orientado,
        CASE
            WHEN s.numero_sesion % 3 = 1 THEN 'CONSULTA_AGENDA_PACIENTE'
            WHEN s.numero_sesion % 3 = 2 THEN 'RESUMEN_PROGRESO_CLINICO'
            ELSE 'RECORDATORIO_ASISTENCIA'
        END AS tipo_evento,
        'Interacción asistida sobre sesión #' + CAST(s.numero_sesion AS VARCHAR(10)) + ' del tratamiento #' + CAST(t.id_tratamiento AS VARCHAR(10)),
        s.fecha_programada_vigente AS fecha_hora,
        CASE WHEN s.numero_sesion % 5 = 0 THEN 'Derivada_Personal' ELSE 'Completada' END AS estado,
        CASE WHEN s.numero_sesion % 5 = 0 THEN 'Derivada a recepción para coordinación manual' ELSE 'Orientación emitida conforme a protocolo sin prescripción autónoma' END AS resultado,
        CASE WHEN s.numero_sesion % 5 = 0 THEN 1 ELSE 0 END AS requiere_revision_humana,
        CASE WHEN s.numero_sesion % 5 = 0 THEN @id_usr_rev_int ELSE NULL END AS id_usuario_revisor,
        CASE WHEN s.numero_sesion % 2 = 0 THEN s.id_profesional ELSE NULL END AS id_profesional_aprobador,
        CASE WHEN s.numero_sesion % 2 = 0 THEN s.fecha_programada_vigente ELSE NULL END AS fecha_aprobacion,
        'CopilotoOdonto-v1.0',
        0
    FROM dbo.SesionesTratamiento s
    INNER JOIN dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento
    LEFT JOIN dbo.Atenciones a ON a.id_sesion = s.id_sesion
    ORDER BY s.id_sesion ASC;
END;

-- 10.2. AlertasIA (alertas operativas/clínicas tempranas con trazabilidad de atención)
IF NOT EXISTS (SELECT 1 FROM dbo.AlertasIA)
BEGIN
    DECLARE @id_usr_auditor INT = (SELECT TOP 1 id_usuario FROM dbo.Usuarios WHERE email = 'auditoria.clinica@nexosalud.pe');

    INSERT INTO dbo.AlertasIA (
        id_persona,
        id_profesional,
        id_tratamiento,
        id_sesion,
        id_atencion,
        tipo_evento,
        severidad,
        mensaje_alerta,
        fecha_hora,
        estado,
        resultado,
        requiere_revision_humana,
        id_usuario_revisor,
        id_profesional_revisor,
        fecha_atencion_alerta,
        version_agente
    )
    SELECT TOP 12
        t.id_persona,
        s.id_profesional,
        t.id_tratamiento,
        s.id_sesion,
        a.id_atencion,
        CASE
            WHEN s.estado_asistencial = 'Inasistida' THEN 'ALERTA_RIESGO_INASISTENCIA'
            ELSE 'ALERTA_SEGUIMIENTO_SESION'
        END AS tipo_evento,
        CASE WHEN s.estado_asistencial = 'Inasistida' THEN 'Alta' ELSE 'Media' END AS severidad,
        'Alerta preventiva generada para seguimiento de sesión #' + CAST(s.numero_sesion AS VARCHAR(10)),
        s.fecha_programada_vigente AS fecha_hora,
        CASE WHEN s.id_sesion % 4 = 0 THEN 'Generada' ELSE 'Atendida' END AS estado,
        CASE WHEN s.id_sesion % 4 = 0 THEN 'Pendiente de gestión' ELSE 'Contacto preventivo y verificación de plan ejecutados' END AS resultado,
        1 AS requiere_revision_humana,
        CASE WHEN s.id_sesion % 4 = 0 THEN NULL ELSE @id_usr_auditor END AS id_usuario_revisor,
        CASE WHEN s.id_sesion % 4 = 0 THEN NULL ELSE s.id_profesional END AS id_profesional_revisor,
        CASE WHEN s.id_sesion % 4 = 0 THEN NULL ELSE DATEADD(MINUTE, 25, s.fecha_programada_vigente) END AS fecha_atencion_alerta,
        'CopilotoOdonto-v1.0'
    FROM dbo.SesionesTratamiento s
    INNER JOIN dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento
    LEFT JOIN dbo.Atenciones a ON a.id_sesion = s.id_sesion
    ORDER BY s.id_sesion ASC;
END;

-- 10.3. BorradoresIA (borradores de indicaciones post-atención revisados por el profesional)
IF NOT EXISTS (SELECT 1 FROM dbo.BorradoresIA)
BEGIN
    DECLARE @id_usr_borr INT = (SELECT TOP 1 id_usuario FROM dbo.Usuarios WHERE email = 'auditoria.clinica@nexosalud.pe');

    INSERT INTO dbo.BorradoresIA (
        version_borrador,
        es_version_actual,
        id_persona,
        id_profesional,
        id_tratamiento,
        id_sesion,
        id_atencion,
        id_indicacion_vinculada,
        tipo_evento,
        contenido_sugerido,
        fecha_hora,
        estado,
        resultado,
        requiere_revision_humana,
        id_profesional_aprobador,
        id_usuario_revisor,
        fecha_aprobacion,
        version_agente
    )
    SELECT TOP 15
        1 AS version_borrador,
        1 AS es_version_actual,
        a.id_persona,
        a.id_profesional,
        a.id_tratamiento,
        a.id_sesion,
        ind.id_atencion,
        ind.id_indicacion,
        'BORRADOR_INDICACIONES_POSTATENCION' AS tipo_evento,
        'Borrador sugerido por IA: ' + ind.contenido_indicaciones AS contenido_sugerido,
        DATEADD(MINUTE, -5, ind.fecha_creacion) AS fecha_hora,
        CASE
            WHEN ind.id_indicacion % 5 = 0 THEN 'Rechazado'
            WHEN ind.id_indicacion % 3 = 0 THEN 'Corregido_Y_Aprobado'
            ELSE 'Aprobado'
        END AS estado,
        CASE
            WHEN ind.id_indicacion % 5 = 0 THEN 'Rechazado por odontólogo y redactado manualmente'
            WHEN ind.id_indicacion % 3 = 0 THEN 'Corregido y aprobado por odontólogo tratante'
            ELSE 'Aprobado sin cambios por odontólogo tratante'
        END AS resultado,
        1 AS requiere_revision_humana,
        CASE WHEN ind.id_indicacion % 5 = 0 THEN NULL ELSE ind.id_profesional_aprobador END AS id_profesional_aprobador,
        @id_usr_borr AS id_usuario_revisor,
        CASE WHEN ind.id_indicacion % 5 = 0 THEN NULL ELSE ind.fecha_aprobacion END AS fecha_aprobacion,
        'CopilotoOdonto-v1.0'
    FROM dbo.IndicacionesPostatencion ind
    INNER JOIN dbo.Atenciones a ON a.id_atencion = ind.id_atencion
    ORDER BY ind.id_indicacion ASC;

    UPDATE dbo.BorradoresIA
    SET id_borrador_raiz = id_borrador_ia
    WHERE id_borrador_raiz IS NULL;
END;

COMMIT TRANSACTION;

SELECT
    'RESUMEN_MIGRACION_CATALOGOS_CUSTOMER' AS Seccion,
    (SELECT COUNT(*) FROM dbo.TratamientosContratados) AS TratamientosMigrados,
    (SELECT COUNT(*) FROM dbo.PlanTratamiento) AS PlanesMigrados,
    (SELECT COUNT(*) FROM dbo.SesionesTratamiento) AS SesionesMigradas,
    (SELECT COUNT(*) FROM dbo.DetalleProcedimiento) AS ProcedimientosMigrados,
    (SELECT COUNT(*) FROM dbo.ValidacionesFicha) AS ValidacionesFichaMigradas,
    (SELECT COUNT(*) FROM dbo.IndicacionesPostatencion) AS IndicacionesMigradas,
    (SELECT COUNT(*) FROM dbo.AntecedentesClinicos) AS AntecedentesMigrados,
    (SELECT COUNT(*) FROM dbo.InteraccionesIA) AS InteraccionesIAMigradas,
    (SELECT COUNT(*) FROM dbo.AlertasIA) AS AlertasIAMigradas,
    (SELECT COUNT(*) FROM dbo.BorradoresIA) AS BorradoresIAMigrados;

PRINT 'Catálogos y migración histórica de CUSTOMER (02_catalogos_customer.sql) completados con éxito.';
GO
