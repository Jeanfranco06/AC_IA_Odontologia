/* =========================================================================================
   VALIDACION Y REPORTE DE CONCILIACION DEL EMBUDO COMPLETO (10K BUYERS -> CUSTOMER)
   =========================================================================================
   Comprueba la coherencia cuantitativa y relacional de la cohorte SIM_BUYER_10K_V1
   en las etapas BUYER, LEAD, PAYER y CUSTOMER.
   ========================================================================================= */

USE NexoSaludDB;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

PRINT '=========================================================================================';
PRINT ' REPORTE DE CONCILIACION Y COHERENCIA DEL EMBUDO CLINICO (NexoSalud Odontologia)';
PRINT '=========================================================================================';

-- 1. Totales por Etapa del Funnel
SELECT 
    '1. BUYER (Total Cohorte)' AS Etapa,
    COUNT(*) AS Total_Registros,
    SUM(CASE WHEN c.autoriza_contacto = 1 AND c.estado_calidad = 'Valido' THEN 1 ELSE 0 END) AS Contactos_Utilizables,
    '100.0% de captaciones iniciales' AS Observacion
FROM dbo.Personas p
JOIN dbo.CaptacionesBuyer c ON c.id_persona = p.id_persona
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid'

UNION ALL

SELECT 
    '2. LEAD (Solicitudes / Negociaciones)' AS Etapa,
    COUNT(*) AS Total_Registros,
    SUM(CASE WHEN s.estado = 'Convertida' THEN 1 ELSE 0 END) AS Convertidas_A_Reserva,
    '30.0% de conversion Buyer->Lead (2 550 / 8 500)' AS Observacion
FROM dbo.Solicitudes s
JOIN dbo.Personas p ON p.id_persona = s.id_persona
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid'

UNION ALL

SELECT 
    '3. PAYER (Reservas y Pagos)' AS Etapa,
    COUNT(DISTINCT r.id_reserva) AS Total_Registros,
    SUM(CASE WHEN pg.estado IN ('Confirmado', 'Validado') THEN 1 ELSE 0 END) AS Pagos_Validados_Tesoreria,
    '60.0% aceptacion Lead->Reserva (1 530 / 2 550)' AS Observacion
FROM dbo.Reservas r
JOIN dbo.Personas p ON p.id_persona = r.id_persona
LEFT JOIN dbo.Pagos pg ON pg.id_reserva = r.id_reserva
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid'

UNION ALL

SELECT 
    '4. CUSTOMER (Atenciones Clinicas)' AS Etapa,
    COUNT(*) AS Total_Registros,
    SUM(CASE WHEN a.asistencia IN ('Asiste', 'Asistió') AND a.estado_servicio = 'Realizado' THEN 1 ELSE 0 END) AS Pacientes_Atendidos_Sillon,
    '85.0% asistencia efectiva sobre pagos validados (1 105 / 1 300)' AS Observacion
FROM dbo.Atenciones a
JOIN dbo.Personas p ON p.id_persona = a.id_persona
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid';

-- 2. Resumen Financiero y Recaudacion de la Cohorte
SELECT 
    COUNT(*) AS Pagos_Registrados,
    SUM(CASE WHEN estado IN ('Confirmado', 'Validado') THEN 1 ELSE 0 END) AS Pagos_Validados,
    SUM(CASE WHEN estado = 'Fallido' THEN 1 ELSE 0 END) AS Pagos_Fallidos,
    SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS Pagos_Pendientes,
    SUM(CASE WHEN estado IN ('Confirmado', 'Validado') THEN importe ELSE 0 END) AS Total_Recaudado_Validados_PEN,
    AVG(CASE WHEN estado IN ('Confirmado', 'Validado') THEN importe ELSE NULL END) AS Ticket_Promedio_PEN
FROM dbo.Pagos pg
JOIN dbo.Personas p ON p.id_persona = pg.id_persona
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid';

-- 3. Resumen Operativo Clinico (Sillon Odontologico)
SELECT 
    COUNT(*) AS Total_Citas_Programadas,
    SUM(CASE WHEN asistencia IN ('Asiste', 'Asistió') THEN 1 ELSE 0 END) AS Asistencias_Efectivas,
    SUM(CASE WHEN asistencia IN ('No asiste', 'No asistió') THEN 1 ELSE 0 END) AS Inasistencias_NoShow,
    SUM(CASE WHEN asistencia = 'Pendiente' THEN 1 ELSE 0 END) AS Reprogramadas_Pendientes,
    ROUND(100.0 * SUM(CASE WHEN asistencia IN ('Asiste', 'Asistió') THEN 1 ELSE 0 END) / COUNT(*), 2) AS Tasa_Asistencia_Pct,
    ROUND(100.0 * SUM(CASE WHEN asistencia IN ('No asiste', 'No asistió') THEN 1 ELSE 0 END) / COUNT(*), 2) AS Tasa_NoShow_Pct,
    AVG(CASE WHEN asistencia IN ('Asiste', 'Asistió') THEN DATEDIFF(MINUTE, fecha_inicio, fecha_fin) ELSE NULL END) AS Duracion_Promedio_Sillon_Min
FROM dbo.Atenciones a
JOIN dbo.Personas p ON p.id_persona = a.id_persona
WHERE p.email LIKE '%@sim-buyer-10k-v1.invalid';

PRINT '=========================================================================================';
PRINT ' VALIDACION FINALIZADA.';
PRINT '=========================================================================================';
GO
