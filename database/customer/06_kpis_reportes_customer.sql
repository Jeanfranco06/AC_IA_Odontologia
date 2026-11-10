-- ====================================================================
-- ARCHIVO: 06_kpis_reportes_customer.sql
-- FASE: CUSTOMER (Indicadores C1–C8 y Vistas Analíticas A, B, C, D)
-- BASE DE DATOS: NexoSalud_Mart
-- MOTOR: Microsoft SQL Server 2016 / 2019 / 2022
-- DESCRIPCIÓN:
--   1. Actualiza dbo.v_Indicadores_Payer_Oficial y dbo.v_ReporteR2_ValidacionIncidencias_Payer
--      para emplear PagosConTiempoMedible (H06) y CostoPasarelaVerificado (H07).
--   2. Crea dbo.v_Indicadores_Customer_Oficial con los 8 indicadores C1..C8,
--      semáforos gerenciales y las 20 medidas de CUSTOMER.
--   3. Crea las 4 vistas analíticas oficiales de los Análisis A, B, C y D:
--      - dbo.v_Reporte_Customer_A_Tratamientos
--      - dbo.v_Reporte_Customer_B_Sesiones
--      - dbo.v_Reporte_Customer_C_PrestacionClinica
--      - dbo.v_Reporte_Customer_D_AgenteIA
-- ====================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [NexoSalud_Mart];
GO

-- ====================================================================
-- SECCIÓN 1: ACTUALIZACIÓN DE VISTAS PAYER CORREGIDAS (H06, H07)
-- ====================================================================

IF OBJECT_ID('dbo.v_Indicadores_Payer_Oficial', 'V') IS NOT NULL
    DROP VIEW dbo.v_Indicadores_Payer_Oficial;
GO

CREATE VIEW dbo.v_Indicadores_Payer_Oficial
AS
WITH TotalesF1 AS (
    SELECT
        SUM(PagosRegistrados) AS TotalRegistrados,
        SUM(PagosValidados) AS TotalValidados,
        SUM(PagosRechazados) AS TotalRechazados,
        SUM(IngresosBrutosRecaudados) AS IngresosBrutosRecaudados,
        SUM(CostoTransaccionPasarela) AS CostoPasarelaContractual,
        SUM(ISNULL(CostoPasarelaEstimadoNoContractual, 0.00)) AS CostoPasarelaEstimadoReferencial
    FROM dbo.Fact_RecaudacionPayer
),
TotalesF2 AS (
    SELECT
        SUM(TiempoTotalValidacionMin) AS MinutosAcumulados,
        SUM(PagosValidados) AS ConteoValidados,
        SUM(PagosConTiempoMedible) AS ConteoValidadosConTiempoMedible
    FROM dbo.Fact_ValidacionIncidenciaPayer
),
TotalesF3 AS (
    SELECT
        SUM(ReservasPreagendadas) AS TotalReservas,
        SUM(ConversionesACustomer) AS TotalConversiones
    FROM dbo.Fact_ConversionCobranzaPayer
)
SELECT
    -- P1: Tasa de Pagos Validados
    CAST(100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0) AS DECIMAL(5,2)) AS P1_TasaPagosValidados_Pct,
    CASE
        WHEN (100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0)) >= 80.0 THEN 'VERDE'
        WHEN (100.0 * f1.TotalValidados / NULLIF(f1.TotalRegistrados, 0)) >= 60.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P1_Semaforo,

    -- P2: Tiempo Promedio de Validación (H06: usa exclusivamente PagosConTiempoMedible)
    CAST(1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidadosConTiempoMedible, 0) AS DECIMAL(6,1)) AS P2_TiempoPromedioValidacion_Min,
    CASE
        WHEN ISNULL(f2.ConteoValidadosConTiempoMedible, 0) = 0 THEN 'SIN_EVIDENCIA_MEDIBLE'
        WHEN (1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidadosConTiempoMedible, 0)) <= 60.0 THEN 'VERDE'
        WHEN (1.0 * f2.MinutosAcumulados / NULLIF(f2.ConteoValidadosConTiempoMedible, 0)) <= 120.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P2_Semaforo,

    -- P3: Tasa de Pagos Rechazados
    CAST(100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0) AS DECIMAL(5,2)) AS P3_TasaPagosRechazados_Pct,
    CASE
        WHEN (100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0)) <= 5.0 THEN 'VERDE'
        WHEN (100.0 * f1.TotalRechazados / NULLIF(f1.TotalRegistrados, 0)) <= 10.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P3_Semaforo,

    -- P4: Tasa de Conversión a CUSTOMER (H05: sin duplicación por sesiones)
    CAST(100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0) AS DECIMAL(5,2)) AS P4_TasaConversionCustomer_Pct,
    CASE
        WHEN (100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0)) >= 90.0 THEN 'VERDE'
        WHEN (100.0 * f3.TotalConversiones / NULLIF(f3.TotalReservas, 0)) >= 75.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS P4_Semaforo
FROM TotalesF1 f1
CROSS JOIN TotalesF2 f2
CROSS JOIN TotalesF3 f3;
GO

IF OBJECT_ID('dbo.v_ReporteR2_ValidacionIncidencias_Payer', 'V') IS NOT NULL
    DROP VIEW dbo.v_ReporteR2_ValidacionIncidencias_Payer;
GO

CREATE VIEW dbo.v_ReporteR2_ValidacionIncidencias_Payer
AS
SELECT
    t.Anio,
    t.Mes,
    s.Sede AS NombreSede,
    p.MetodoPago,
    inc.TipoIncidencia,
    inc.Prioridad AS PrioridadIncidencia,
    inc.MotivoEstandar,
    f.CantidadIncidencias,
    f.PagosValidados,
    f.PagosConTiempoMedible,
    f.PagosRechazados,
    f.PagosRevertidos,
    CAST(1.0 * f.TiempoTotalValidacionMin / NULLIF(f.PagosConTiempoMedible, 0) AS DECIMAL(6,1)) AS TiempoPromedioMinutos
FROM dbo.Fact_ValidacionIncidenciaPayer f
INNER JOIN dbo.Dim_Tiempo t ON t.KeyTiempo = f.KeyTiempo
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Pasarela p ON p.KeyPasarela = f.KeyPasarela
INNER JOIN dbo.Dim_Incidencia inc ON inc.KeyIncidencia = f.KeyIncidencia;
GO

-- ====================================================================
-- SECCIÓN 2: VISTA OFICIAL DE INDICADORES CUSTOMER (C1–C8 Y 20 MEDIDAS)
-- ====================================================================

IF OBJECT_ID('dbo.v_Indicadores_Customer_Oficial', 'V') IS NOT NULL
    DROP VIEW dbo.v_Indicadores_Customer_Oficial;
GO

CREATE VIEW dbo.v_Indicadores_Customer_Oficial
AS
WITH ResumenA AS (
    SELECT
        SUM(tratamientos_iniciados) AS tratamientos_iniciados,
        SUM(tratamientos_completados) AS tratamientos_completados,
        SUM(sesiones_planificadas) AS sesiones_planificadas,
        SUM(sesiones_completadas) AS sesiones_completadas,
        CAST(AVG(CAST(dias_duracion_real AS DECIMAL(10,2))) AS DECIMAL(8,2)) AS dias_duracion_real_promedio
    FROM dbo.Fact_TratamientoCustomer
),
ResumenB AS (
    SELECT
        SUM(sesiones_programadas) AS sesiones_programadas,
        SUM(sesiones_realizadas) AS sesiones_realizadas,
        SUM(sesiones_inasistidas) AS sesiones_inasistidas,
        SUM(reprogramaciones_acumuladas) AS reprogramaciones_acumuladas,
        SUM(sesion_evaluable) AS sesiones_evaluables,
        SUM(tiene_espera_medible) AS sesiones_con_espera_medible,
        CAST(1.0 * SUM(ISNULL(minutos_espera, 0)) / NULLIF(SUM(tiene_espera_medible), 0) AS DECIMAL(8,2)) AS minutos_espera_promedio
    FROM dbo.Fact_SesionCustomer
),
ResumenC AS (
    SELECT
        SUM(atenciones_realizadas) AS atenciones_realizadas,
        SUM(tiene_duracion_medible) AS atenciones_con_duracion_medible,
        CAST(1.0 * SUM(ISNULL(minutos_consulta, 0)) / NULLIF(SUM(tiene_duracion_medible), 0) AS DECIMAL(8,2)) AS minutos_consulta_promedio,
        SUM(fichas_completas) AS fichas_completas,
        SUM(indicaciones_emitidas) AS indicaciones_emitidas,
        SUM(atencion_con_indicacion_emitida) AS atenciones_con_indicacion_emitida,
        SUM(procedimientos_registrados) AS procedimientos_registrados
    FROM dbo.Fact_AtencionCustomer_V2
),
ResumenD AS (
    SELECT
        SUM(interacciones_registradas) AS interacciones_registradas,
        SUM(alertas_generadas) AS alertas_generadas,
        SUM(alertas_atendidas) AS alertas_atendidas,
        SUM(borradores_generados) AS borradores_generados,
        SUM(borradores_aprobados) AS borradores_aprobados
    FROM dbo.Fact_InteraccionIACustomer
)
SELECT
    -- Las 20 medidas obligatorias consolidadas (Análisis A, B, C, D)
    a.tratamientos_iniciados,
    a.tratamientos_completados,
    a.sesiones_planificadas,
    a.sesiones_completadas,
    a.dias_duracion_real_promedio AS dias_duracion_real,

    b.sesiones_programadas,
    b.sesiones_realizadas,
    b.sesiones_inasistidas,
    b.reprogramaciones_acumuladas,
    b.minutos_espera_promedio AS minutos_espera,

    c.atenciones_realizadas,
    c.minutos_consulta_promedio AS minutos_consulta,
    c.fichas_completas,
    c.indicaciones_emitidas,
    c.procedimientos_registrados,

    d.interacciones_registradas,
    d.alertas_generadas,
    d.alertas_atendidas,
    d.borradores_generados,
    d.borradores_aprobados,

    -- C1: Tasa de Completitud de Tratamientos
    CAST(100.0 * a.tratamientos_completados / NULLIF(a.tratamientos_iniciados, 0) AS DECIMAL(5,2)) AS C1_TasaCompletitudTratamientos_Pct,
    CASE
        WHEN (100.0 * a.tratamientos_completados / NULLIF(a.tratamientos_iniciados, 0)) >= 80.0 THEN 'VERDE'
        WHEN (100.0 * a.tratamientos_completados / NULLIF(a.tratamientos_iniciados, 0)) >= 60.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C1_Semaforo,

    -- C2: Índice de Avance de Sesiones Planificadas
    CAST(100.0 * a.sesiones_completadas / NULLIF(a.sesiones_planificadas, 0) AS DECIMAL(5,2)) AS C2_TasaAvanceSesiones_Pct,
    CASE
        WHEN (100.0 * a.sesiones_completadas / NULLIF(a.sesiones_planificadas, 0)) >= 85.0 THEN 'VERDE'
        WHEN (100.0 * a.sesiones_completadas / NULLIF(a.sesiones_planificadas, 0)) >= 70.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C2_Semaforo,

    -- C3: Tasa de Cumplimiento de Agenda de Sesiones (sobre sesiones evaluables vencidas/ejecutadas)
    CAST(100.0 * b.sesiones_realizadas / NULLIF(b.sesiones_evaluables, 0) AS DECIMAL(5,2)) AS C3_TasaCumplimientoAgenda_Pct,
    CASE
        WHEN (100.0 * b.sesiones_realizadas / NULLIF(b.sesiones_evaluables, 0)) >= 85.0 THEN 'VERDE'
        WHEN (100.0 * b.sesiones_realizadas / NULLIF(b.sesiones_evaluables, 0)) >= 75.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C3_Semaforo,

    -- C4: Tasa de Inasistencia Clínica
    CAST(100.0 * b.sesiones_inasistidas / NULLIF(b.sesiones_evaluables, 0) AS DECIMAL(5,2)) AS C4_TasaInasistenciaClinica_Pct,
    CASE
        WHEN (100.0 * b.sesiones_inasistidas / NULLIF(b.sesiones_evaluables, 0)) <= 10.0 THEN 'VERDE'
        WHEN (100.0 * b.sesiones_inasistidas / NULLIF(b.sesiones_evaluables, 0)) <= 18.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C4_Semaforo,

    -- C5: Tiempo Efectivo Promedio de Consulta en Sillón
    c.minutos_consulta_promedio AS C5_TiempoPromedioConsulta_Min,
    CASE
        WHEN c.minutos_consulta_promedio BETWEEN 25.0 AND 60.0 THEN 'VERDE'
        WHEN c.minutos_consulta_promedio BETWEEN 15.0 AND 75.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C5_Semaforo,

    -- C6: Tasa de Fichas Clínicas Completas en Primera Revisión
    CAST(100.0 * c.fichas_completas / NULLIF(c.atenciones_realizadas, 0) AS DECIMAL(5,2)) AS C6_TasaFichasCompletasPrimeraRevision_Pct,
    CASE
        WHEN (100.0 * c.fichas_completas / NULLIF(c.atenciones_realizadas, 0)) >= 95.0 THEN 'VERDE'
        WHEN (100.0 * c.fichas_completas / NULLIF(c.atenciones_realizadas, 0)) >= 85.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C6_Semaforo,

    -- C7: Cobertura de Indicaciones Post-Atención Emitidas
    CAST(100.0 * c.atenciones_con_indicacion_emitida / NULLIF(c.atenciones_realizadas, 0) AS DECIMAL(5,2)) AS C7_CoberturaIndicacionesPostatencion_Pct,
    CASE
        WHEN (100.0 * c.atenciones_con_indicacion_emitida / NULLIF(c.atenciones_realizadas, 0)) >= 90.0 THEN 'VERDE'
        WHEN (100.0 * c.atenciones_con_indicacion_emitida / NULLIF(c.atenciones_realizadas, 0)) >= 75.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C7_Semaforo,

    -- C8: Efectividad Operativa del Agente IA (Atención de Alertas y Aprobación de Borradores)
    CAST(100.0 * d.alertas_atendidas / NULLIF(d.alertas_generadas, 0) AS DECIMAL(5,2)) AS C8a_TasaAtencionAlertasIA_Pct,
    CAST(100.0 * d.borradores_aprobados / NULLIF(d.borradores_generados, 0) AS DECIMAL(5,2)) AS C8b_TasaAprobacionBorradoresIA_Pct,
    CASE
        WHEN (100.0 * d.alertas_atendidas / NULLIF(d.alertas_generadas, 0)) >= 85.0
         AND (100.0 * d.borradores_aprobados / NULLIF(d.borradores_generados, 0)) >= 75.0 THEN 'VERDE'
        WHEN (100.0 * d.alertas_atendidas / NULLIF(d.alertas_generadas, 0)) >= 70.0
         AND (100.0 * d.borradores_aprobados / NULLIF(d.borradores_generados, 0)) >= 60.0 THEN 'AMBAR'
        ELSE 'ROJO'
    END AS C8_Semaforo
FROM ResumenA a
CROSS JOIN ResumenB b
CROSS JOIN ResumenC c
CROSS JOIN ResumenD d;
GO

-- ====================================================================
-- SECCIÓN 3: VISTAS ANALÍTICAS PARA LOS 4 REPORTES DE CUSTOMER (A, B, C, D)
-- ====================================================================

-- 3.1. Reporte A: Ejecución y Progreso de Tratamientos (Fact_TratamientoCustomer)
IF OBJECT_ID('dbo.v_Reporte_Customer_A_Tratamientos', 'V') IS NOT NULL
    DROP VIEW dbo.v_Reporte_Customer_A_Tratamientos;
GO

CREATE VIEW dbo.v_Reporte_Customer_A_Tratamientos
AS
SELECT
    tc.Anio AS AnioContratacion,
    tc.Mes AS MesContratacion,
    s.Sede AS NombreSede,
    sv.ServicioOdontologico AS NombreServicio,
    p.Odontologo AS ProfesionalResponsable,
    p.EspecialidadPrincipal,
    et.EstadoTratamiento,
    et.CategoriaCicloTratamiento,
    COUNT(f.id_tratamiento) AS TotalTratamientosContratados,
    SUM(f.tratamientos_iniciados) AS tratamientos_iniciados,
    SUM(f.tratamientos_completados) AS tratamientos_completados,
    SUM(f.sesiones_planificadas) AS sesiones_planificadas,
    SUM(f.sesiones_completadas) AS sesiones_completadas,
    CAST(AVG(CAST(f.dias_duracion_real AS DECIMAL(10,2))) AS DECIMAL(8,2)) AS dias_duracion_real
FROM dbo.Fact_TratamientoCustomer f
INNER JOIN dbo.Dim_Tiempo tc ON tc.KeyTiempo = f.KeyTiempoContratacion
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio sv ON sv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_Profesional p ON p.KeyProfesional = f.KeyProfesional
INNER JOIN dbo.Dim_EstadoTratamiento et ON et.KeyEstadoTratamiento = f.KeyEstadoTratamiento
GROUP BY
    tc.Anio, tc.Mes, s.Sede, sv.ServicioOdontologico,
    p.Odontologo, p.EspecialidadPrincipal,
    et.EstadoTratamiento, et.CategoriaCicloTratamiento;
GO

-- 3.2. Reporte B: Cumplimiento de Sesiones y Agenda Clínica (Fact_SesionCustomer)
IF OBJECT_ID('dbo.v_Reporte_Customer_B_Sesiones', 'V') IS NOT NULL
    DROP VIEW dbo.v_Reporte_Customer_B_Sesiones;
GO

CREATE VIEW dbo.v_Reporte_Customer_B_Sesiones
AS
SELECT
    tp.Anio AS AnioProgramado,
    tp.Mes AS MesProgramado,
    h.Turno AS TurnoAgenda,
    s.Sede AS NombreSede,
    sv.ServicioOdontologico AS NombreServicio,
    p.Odontologo AS ProfesionalAsignado,
    es.EstadoProgramacion,
    es.EstadoAsistencial,
    es.EstadoCierre,
    SUM(f.sesiones_programadas) AS sesiones_programadas,
    SUM(f.sesiones_realizadas) AS sesiones_realizadas,
    SUM(f.sesiones_inasistidas) AS sesiones_inasistidas,
    SUM(f.reprogramaciones_acumuladas) AS reprogramaciones_acumuladas,
    CAST(1.0 * SUM(ISNULL(f.minutos_espera, 0)) / NULLIF(SUM(f.tiene_espera_medible), 0) AS DECIMAL(8,2)) AS minutos_espera
FROM dbo.Fact_SesionCustomer f
INNER JOIN dbo.Dim_Tiempo tp ON tp.KeyTiempo = f.KeyTiempoProgramada
INNER JOIN dbo.Dim_Hora h ON h.KeyHora = f.KeyHoraProgramada
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio sv ON sv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_Profesional p ON p.KeyProfesional = f.KeyProfesional
INNER JOIN dbo.Dim_EstadoSesion es ON es.KeyEstadoSesion = f.KeyEstadoSesion
GROUP BY
    tp.Anio, tp.Mes, h.Turno, s.Sede, sv.ServicioOdontologico,
    p.Odontologo, es.EstadoProgramacion, es.EstadoAsistencial, es.EstadoCierre;
GO

-- 3.3. Reporte C: Prestación Clínica y Calidad Documental (Fact_AtencionCustomer_V2)
IF OBJECT_ID('dbo.v_Reporte_Customer_C_PrestacionClinica', 'V') IS NOT NULL
    DROP VIEW dbo.v_Reporte_Customer_C_PrestacionClinica;
GO

CREATE VIEW dbo.v_Reporte_Customer_C_PrestacionClinica
AS
SELECT
    ta.Anio AS AnioAtencion,
    ta.Mes AS MesAtencion,
    h.Turno AS TurnoAtencion,
    s.Sede AS NombreSede,
    sv.ServicioOdontologico AS NombreServicio,
    p.Odontologo AS ProfesionalTratante,
    ea.EstadoFinal,
    ea.Asistencia,
    ea.EstadoCierreDocumental,
    SUM(f.atenciones_realizadas) AS atenciones_realizadas,
    CAST(1.0 * SUM(ISNULL(f.minutos_consulta, 0)) / NULLIF(SUM(f.tiene_duracion_medible), 0) AS DECIMAL(8,2)) AS minutos_consulta,
    SUM(f.fichas_completas) AS fichas_completas,
    SUM(f.indicaciones_emitidas) AS indicaciones_emitidas,
    SUM(f.procedimientos_registrados) AS procedimientos_registrados
FROM dbo.Fact_AtencionCustomer_V2 f
INNER JOIN dbo.Dim_Tiempo ta ON ta.KeyTiempo = f.KeyTiempoAtencion
INNER JOIN dbo.Dim_Hora h ON h.KeyHora = f.KeyHoraAtencion
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio sv ON sv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_Profesional p ON p.KeyProfesional = f.KeyProfesional
INNER JOIN dbo.Dim_EstadoAtencion ea ON ea.KeyEstadoAtencion = f.KeyEstadoAtencion
GROUP BY
    ta.Anio, ta.Mes, h.Turno, s.Sede, sv.ServicioOdontologico,
    p.Odontologo, ea.EstadoFinal, ea.Asistencia, ea.EstadoCierreDocumental;
GO

-- 3.4. Reporte D: Copiloto Clínico y Orientación al Paciente (Fact_InteraccionIACustomer)
IF OBJECT_ID('dbo.v_Reporte_Customer_D_AgenteIA', 'V') IS NOT NULL
    DROP VIEW dbo.v_Reporte_Customer_D_AgenteIA;
GO

CREATE VIEW dbo.v_Reporte_Customer_D_AgenteIA
AS
SELECT
    te.Anio AS AnioEvento,
    te.Mes AS MesEvento,
    s.Sede AS NombreSede,
    sv.ServicioOdontologico AS NombreServicio,
    p.Odontologo AS ProfesionalVinculado,
    ti.ClaseEventoIA,
    ti.TipoInteraccionIA,
    tu.ActorOrientado,
    tu.CanalInteraccion,
    r.EstadoResolucionIA,
    r.ResultadoRevisionHumana,
    SUM(f.interacciones_registradas) AS interacciones_registradas,
    SUM(f.alertas_generadas) AS alertas_generadas,
    SUM(f.alertas_atendidas) AS alertas_atendidas,
    SUM(f.borradores_generados) AS borradores_generados,
    SUM(f.borradores_aprobados) AS borradores_aprobados
FROM dbo.Fact_InteraccionIACustomer f
INNER JOIN dbo.Dim_Tiempo te ON te.KeyTiempo = f.KeyTiempoEvento
INNER JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
INNER JOIN dbo.Dim_Servicio sv ON sv.KeyServicio = f.KeyServicio
INNER JOIN dbo.Dim_Profesional p ON p.KeyProfesional = f.KeyProfesional
INNER JOIN dbo.Dim_TipoInteraccionIA ti ON ti.KeyTipoInteraccionIA = f.KeyTipoInteraccionIA
INNER JOIN dbo.Dim_TipoUsuarioIA tu ON tu.KeyTipoUsuarioIA = f.KeyTipoUsuarioIA
INNER JOIN dbo.Dim_ResultadoIA r ON r.KeyResultadoIA = f.KeyResultadoIA
GROUP BY
    te.Anio, te.Mes, s.Sede, sv.ServicioOdontologico, p.Odontologo,
    ti.ClaseEventoIA, ti.TipoInteraccionIA, tu.ActorOrientado,
    tu.CanalInteraccion, r.EstadoResolucionIA, r.ResultadoRevisionHumana;
GO

SELECT * FROM dbo.v_Indicadores_Payer_Oficial;
SELECT * FROM dbo.v_Indicadores_Customer_Oficial;

PRINT 'Vistas analíticas e indicadores de CUSTOMER (06_kpis_reportes_customer.sql) creados exitosamente.';
GO
