/* ====================================================================================
   PRUEBAS OPERATIVAS Y VALIDACIÓN INTEGRAL DE BUYER — PARTE DE GERMAIN
   Archivo: database/buyer_revision/semana9/05_pruebas_operativas_germain.sql
   Responsable: Germain Cruz Vargas (con revisión de Daniel Ordóñez)
   Rama: analysis/buyer-bases-datos
   Objetivo: Verificar operativamente la lista de aceptación de docs/PENDIENTES_BUYER_BD.md
             - Sede y servicio declarados (no todos caen en KeySede=0 / KeyServicio=0).
             - Múltiples interacciones sin multiplicar personas/contactos registrados.
             - Gastos reales/sintéticos en GastosCampana y conciliación al céntimo.
             - Conversión real mediante usp_ConvertirBuyerALead (éxito, reintento y rechazo).
             - Ejecución y verificación en el Data Mart (fact_captacion_buyer).
   Idempotente: Puede reejecutarse limpiamente. Usa prefijo [PRUEBA_GERMAIN].
   ==================================================================================== */

USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '======================================================================';
PRINT 'PASO 1: LIMPIEZA IDEMPOTENTE DE PRUEBAS ANTERIORES DE GERMAIN';
PRINT '======================================================================';

-- 1. Identificar personas de pruebas previas
DECLARE @PersonasBorrar TABLE (id_persona INT);
INSERT INTO @PersonasBorrar
SELECT id_persona FROM dbo.Personas
WHERE email LIKE '%@test.germain.invalid'
   OR nombres LIKE 'GermainPrueba%';

-- 2. Eliminar eventos de etapa asociados
DELETE e FROM dbo.EventosEtapa e
JOIN @PersonasBorrar p ON p.id_persona = e.id_persona;

-- 3. Eliminar solicitudes de prueba
DELETE s FROM dbo.Solicitudes s
JOIN @PersonasBorrar p ON p.id_persona = s.id_persona;

-- 4. Eliminar interacciones de prueba
DELETE i FROM dbo.Interacciones i
JOIN @PersonasBorrar p ON p.id_persona = i.id_persona;

-- 5. Eliminar captaciones buyer
DELETE c FROM dbo.CaptacionesBuyer c
JOIN @PersonasBorrar p ON p.id_persona = c.id_persona;

-- 6. Eliminar personas de prueba
DELETE per FROM dbo.Personas per
JOIN @PersonasBorrar p ON p.id_persona = per.id_persona;

-- 7. Eliminar gastos de campaña de prueba
DELETE FROM dbo.GastosCampana
WHERE CHARINDEX('[PRUEBA_GERMAIN]', descripcion) > 0;

-- 8. Limpiar filas de prueba en el Data Mart
DELETE FROM NexoSalud_Mart.dbo.fact_captacion_buyer
WHERE id_persona IN (SELECT id_persona FROM @PersonasBorrar);

PRINT 'Limpieza completada con exito.';
GO

PRINT '======================================================================';
PRINT 'PASO 2: INSERCIÓN DE CASOS CONTROLADOS DE CAPTACIÓN BUYER';
PRINT '======================================================================';

DECLARE @FechaPrueba DATETIME2 = DATEADD(DAY, -5, SYSDATETIME());
DECLARE @EtapaBuyer INT;
SELECT @EtapaBuyer = id_etapa FROM dbo.Etapas WHERE nombre = 'BUYER';

-- CASO A: Contacto utilizable con Sede California (2) y Servicio Ortodoncia (9)
-- Campaña 1 (Meta Ads WhatsApp, id_fuente=1, id_canal=1)
DECLARE @id_persona_A INT, @id_cap_A INT;
INSERT INTO dbo.Personas 
    (nombres, apellidos, numero, email, estado_calidad, autoriza_contacto, 
     fecha_autorizacion, id_etapa_actual, id_canal_origen, id_campana_origen, fecha_registro)
VALUES 
    ('GermainPrueba Carlos', 'Benitez Rojas', '944111222', 'carlos.benitez@test.germain.invalid',
     'Valido', 1, @FechaPrueba, @EtapaBuyer, 1, 1, @FechaPrueba);
SET @id_persona_A = SCOPE_IDENTITY();

INSERT INTO dbo.CaptacionesBuyer
    (id_persona, fecha_captacion, id_canal, id_fuente, id_campana, id_sede, id_servicio,
     motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
VALUES
    (@id_persona_A, @FechaPrueba, 1, 1, 1, 2, 9, 
     N'[PRUEBA_GERMAIN] Consulta por frenillos y ortodoncia en Sede California',
     'Valido', 1, @FechaPrueba, 'REGISTRO_DIRECTO');
SET @id_cap_A = SCOPE_IDENTITY();

-- CASO B: Contacto utilizable con Sede El Golf (3) y Servicio Implante (10)
-- Campaña 2 (Meta Ads Instagram, id_fuente=1, id_canal=3)
DECLARE @id_persona_B INT, @id_cap_B INT;
INSERT INTO dbo.Personas 
    (nombres, apellidos, numero, email, estado_calidad, autoriza_contacto, 
     fecha_autorizacion, id_etapa_actual, id_canal_origen, id_campana_origen, fecha_registro)
VALUES 
    ('GermainPrueba Laura', 'Quispe Soto', '944333444', 'laura.quispe@test.germain.invalid',
     'Valido', 1, @FechaPrueba, @EtapaBuyer, 3, 2, @FechaPrueba);
SET @id_persona_B = SCOPE_IDENTITY();

INSERT INTO dbo.CaptacionesBuyer
    (id_persona, fecha_captacion, id_canal, id_fuente, id_campana, id_sede, id_servicio,
     motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
VALUES
    (@id_persona_B, @FechaPrueba, 3, 1, 2, 3, 10, 
     N'[PRUEBA_GERMAIN] Consulta costo de implante de titanio en Sede El Golf',
     'Valido', 1, @FechaPrueba, 'REGISTRO_DIRECTO');
SET @id_cap_B = SCOPE_IDENTITY();

-- CASO C: Contacto incompleto / sin autorizacion / sin sede ni servicio (miembros desconocidos)
DECLARE @id_persona_C INT, @id_cap_C INT;
INSERT INTO dbo.Personas 
    (nombres, apellidos, numero, email, estado_calidad, autoriza_contacto, 
     fecha_autorizacion, id_etapa_actual, id_canal_origen, id_campana_origen, fecha_registro)
VALUES 
    ('GermainPrueba Anonimo', 'Incompleto', NULL, NULL,
     'Incompleto', 0, NULL, @EtapaBuyer, 1, 1, @FechaPrueba);
SET @id_persona_C = SCOPE_IDENTITY();

INSERT INTO dbo.CaptacionesBuyer
    (id_persona, fecha_captacion, id_canal, id_fuente, id_campana, id_sede, id_servicio,
     motivo_consulta, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
VALUES
    (@id_persona_C, @FechaPrueba, 1, 1, 1, NULL, NULL, 
     N'[PRUEBA_GERMAIN] Sin datos de contacto ni consentimiento',
     'Incompleto', 0, NULL, 'REGISTRO_DIRECTO');
SET @id_cap_C = SCOPE_IDENTITY();

PRINT 'Casos A (ID: ' + CAST(@id_persona_A AS VARCHAR(10)) + '), B (ID: ' + CAST(@id_persona_B AS VARCHAR(10)) + ') y C (ID: ' + CAST(@id_persona_C AS VARCHAR(10)) + ') creados exitosamente.';
GO

PRINT '======================================================================';
PRINT 'PASO 3: REGISTRO DE MÚLTIPLES INTERACCIONES PARA LA PERSONA A';
PRINT '======================================================================';

-- Verificar que múltiples mensajes/interacciones NO duplican personas
DECLARE @id_persona_A INT = (SELECT id_persona FROM dbo.Personas WHERE email = 'carlos.benitez@test.germain.invalid');

INSERT INTO dbo.Interacciones (id_persona, id_canal, id_fuente, fecha_hora, tipo, mensaje, es_respuesta_util, resultado)
VALUES 
(@id_persona_A, 1, 1, DATEADD(MINUTE, 5, SYSDATETIME()), 'Mensaje Entrante', '[PRUEBA_GERMAIN] Hola, deseo consultar precios de ortodoncia', 0, 'Recibido'),
(@id_persona_A, 1, 1, DATEADD(MINUTE, 10, SYSDATETIME()), 'Mensaje Saliente', '[PRUEBA_GERMAIN] Estimado Carlos, disponemos de atencion en Sede California', 1, 'Respondido'),
(@id_persona_A, 1, 1, DATEADD(MINUTE, 15, SYSDATETIME()), 'Mensaje Entrante', '[PRUEBA_GERMAIN] Excelente, por favor agendemos cita de evaluacion', 0, 'Aceptado');

DECLARE @conteo_interacciones INT = (SELECT COUNT(*) FROM dbo.Interacciones WHERE id_persona = @id_persona_A);
PRINT 'Total interacciones registradas para Persona A: ' + CAST(@conteo_interacciones AS VARCHAR(10));
GO

PRINT '======================================================================';
PRINT 'PASO 4: REGISTRO DE GASTOS DE CAMPAÑA PARA ATRIBUCIÓN AL CÉNTIMO';
PRINT '======================================================================';

-- Gasto para Campaña 1 en la fecha de la prueba
DECLARE @FechaGasto DATE = CAST(DATEADD(DAY, -5, SYSDATETIME()) AS DATE);

INSERT INTO dbo.GastosCampana (id_campana, fecha, importe, descripcion)
VALUES 
(1, @FechaGasto, 100.00, '[PRUEBA_GERMAIN] Pauta Meta Ads Campaña 1 Mes de Prueba'),
(5, @FechaGasto, 50.00, '[PRUEBA_GERMAIN] Gasto sin contactos en Campaña 5 Mes de Prueba (Pendiente)');

PRINT 'Gastos de prueba registrados en GastosCampana.';
GO

PRINT '======================================================================';
PRINT 'PASO 5: PRUEBA DE CONVERSIÓN REAL (usp_ConvertirBuyerALead)';
PRINT '======================================================================';

DECLARE @id_cap_A INT = (SELECT id_captacion FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona = c.id_persona WHERE p.email = 'carlos.benitez@test.germain.invalid');
DECLARE @id_cap_C INT = (SELECT id_captacion FROM dbo.CaptacionesBuyer c JOIN dbo.Personas p ON p.id_persona = c.id_persona WHERE p.email IS NULL AND p.nombres LIKE 'GermainPrueba Anonimo%');

-- 5.1 Conversión exitosa de Persona A
PRINT '--> Ejecutando conversion exitosa de Persona A...';
EXEC dbo.usp_ConvertirBuyerALead
    @id_captacion = @id_cap_A,
    @id_servicio = 9,
    @motivo = N'[PRUEBA_GERMAIN] Solicitud formal de ortodoncia',
    @id_usuario = NULL;

-- 5.2 Reintento idempotente de Persona A (debe devolver ya_convertido = 1 sin error y sin duplicar)
PRINT '--> Ejecutando reintento de conversion de Persona A (idempotencia)...';
EXEC dbo.usp_ConvertirBuyerALead
    @id_captacion = @id_cap_A,
    @id_servicio = 9,
    @motivo = N'[PRUEBA_GERMAIN] Intento duplicado',
    @id_usuario = NULL;

-- 5.3 Intento de conversión de Persona C (Incompleto / sin autorizacion): debe ser rechazado
PRINT '--> Probando rechazo controlado de Persona C (incompleto)...';
BEGIN TRY
    EXEC dbo.usp_ConvertirBuyerALead
        @id_captacion = @id_cap_C,
        @id_servicio = 1,
        @motivo = N'[PRUEBA_GERMAIN] Intento invalido',
        @id_usuario = NULL;
    PRINT 'ERROR: Se esperaba rechazo de Persona C pero no ocurrio.';
END TRY
BEGIN CATCH
    PRINT 'OK: Rechazo controlado exitoso. Error capturado: ' + ERROR_MESSAGE();
END CATCH;
GO

PRINT '======================================================================';
PRINT 'PASO 6: EJECUCIÓN DEL ETL REVISADO (BLOQUE 1 BUYER)';
PRINT '======================================================================';

-- Ejecutamos la logica de sincronizacion del Bloque 1 de poblamiento_merge_mart.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @corte DATETIME2 = SYSDATETIME(), @bloqueo INT;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @bloqueo = sys.sp_getapplock @Resource = 'ETL_BUYER_SEMANA9',
         @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
    IF @bloqueo < 0 THROW 51200, 'Otro ETL Buyer esta en ejecucion.', 1;

    -- 1. Captaciones historicas o nuevas
    INSERT dbo.CaptacionesBuyer
        (id_persona, fecha_captacion, id_canal, id_fuente, id_campana,
         estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
    SELECT p.id_persona, p.fecha_registro, p.id_canal_origen, ca.id_fuente, p.id_campana_origen,
           p.estado_calidad, p.autoriza_contacto, p.fecha_autorizacion, 'HISTORICO_OBSERVADO'
    FROM dbo.Personas p
    LEFT JOIN dbo.Campanas ca ON ca.id_campana = p.id_campana_origen
    WHERE p.fecha_registro <= @corte AND NOT EXISTS
        (SELECT 1 FROM dbo.CaptacionesBuyer c WHERE c.id_persona = p.id_persona);

    -- 2. Staging temporal
    IF OBJECT_ID('tempdb..#DatosBuyer') IS NOT NULL DROP TABLE #DatosBuyer;
    SELECT v.* INTO #DatosBuyer FROM dbo.v_DatosCaptacionBuyer v
    WHERE v.fecha_captacion <= @corte;
    CREATE UNIQUE INDEX UQ_DatosBuyer_Persona ON #DatosBuyer(id_persona);

    -- 3. Miembros desconocidos
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Tiempo WHERE KeyTiempo = 0)
        INSERT NexoSalud_Mart.dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
        VALUES (0, '19000101', 1900, 1, 1, 1);
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Sede WHERE KeySede = 0)
        INSERT NexoSalud_Mart.dbo.Dim_Sede (KeySede, id_sede, Sede, Distrito, Zona)
        VALUES (0, 0, 'No especificada', 'No especificado', 'No especificada');
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Servicio WHERE KeyServicio = 0)
        INSERT NexoSalud_Mart.dbo.Dim_Servicio (KeyServicio, id_servicio, ServicioOdontologico, Categoria, Procedimiento)
        VALUES (0, 0, 'No especificado', 'No clasificado', 'No especificado');
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Canal WHERE KeyCanal = 0)
        INSERT NexoSalud_Mart.dbo.Dim_Canal (KeyCanal, id_canal, NombreCanal, TipoMedio)
        VALUES (0, 0, 'No especificado', 'No clasificado');
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE KeyFuente = 0)
        INSERT NexoSalud_Mart.dbo.Dim_Fuente (KeyFuente, id_fuente, id_campana, TipoOrigen, Campana)
        VALUES (0, 0, 0, 'No especificada', 'Sin campana');
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_TipoPersona WHERE KeyTipoPersona = 0)
        INSERT NexoSalud_Mart.dbo.Dim_TipoPersona (KeyTipoPersona, id_persona, Ocupacion, RangoEdad)
        VALUES (0, 0, 'No especificado', 'No Especificado');
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro WHERE KeyEstadoRegistro = 0)
        INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro (KeyEstadoRegistro, EstadoCalidad, AutorizacionContacto)
        VALUES (0, 'No especificado', 'NO');

    -- 4. Merges dimensionales
    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim USING (
        SELECT DISTINCT CAST(fecha_captacion AS DATE) AS f FROM #DatosBuyer WHERE fecha_captacion IS NOT NULL
        UNION
        SELECT DISTINCT CAST(fecha_conversion AS DATE) FROM #DatosBuyer WHERE fecha_conversion IS NOT NULL
    ) AS o ON dim.id_fecha = o.f
    WHEN NOT MATCHED THEN INSERT (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
        VALUES (YEAR(o.f)*10000+MONTH(o.f)*100+DAY(o.f), o.f, YEAR(o.f), DATEPART(QUARTER, o.f), MONTH(o.f), DAY(o.f));

    MERGE NexoSalud_Mart.dbo.Dim_EstadoRegistro AS dim USING (
        SELECT DISTINCT estado_calidad AS EstadoCalidad,
               CASE WHEN autoriza_contacto = 1 THEN 'SI' ELSE 'NO' END AS AutorizacionContacto
        FROM #DatosBuyer
    ) AS o ON dim.EstadoCalidad = o.EstadoCalidad AND dim.AutorizacionContacto = o.AutorizacionContacto
    WHEN NOT MATCHED THEN INSERT (EstadoCalidad, AutorizacionContacto)
        VALUES (o.EstadoCalidad, o.AutorizacionContacto);

    -- 5. Gastos
    IF OBJECT_ID('tempdb..#GastosBuyer') IS NOT NULL DROP TABLE #GastosBuyer;
    SELECT id_campana, YEAR(fecha)*100+MONTH(fecha) AS anio_mes,
           CAST(SUM(importe)*100 AS BIGINT) AS centimos
    INTO #GastosBuyer FROM dbo.GastosCampana
    WHERE fecha <= CAST(@corte AS DATE)
    GROUP BY id_campana, YEAR(fecha)*100+MONTH(fecha);

    IF OBJECT_ID('tempdb..#CantidadBuyer') IS NOT NULL DROP TABLE #CantidadBuyer;
    SELECT id_campana, YEAR(fecha_captacion)*100+MONTH(fecha_captacion) AS anio_mes,
           COUNT_BIG(*) AS cantidad
    INTO #CantidadBuyer FROM #DatosBuyer WHERE id_campana IS NOT NULL
    GROUP BY id_campana, YEAR(fecha_captacion)*100+MONTH(fecha_captacion);

    -- 6. Carga del Hecho fact_captacion_buyer
    DELETE FROM NexoSalud_Mart.dbo.fact_captacion_buyer;

    INSERT NexoSalud_Mart.dbo.fact_captacion_buyer (
        id_persona, id_captacion, KeyTiempo, KeyTiempoConversion, KeySede, KeyServicio,
        KeyCanal, KeyFuente, KeyTipoPersona, KeyEstadoRegistro,
        contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia,
        costo_atribuido_captacion, fecha_captacion, fecha_conversion, id_evento_conversion,
        origen_datos, fecha_corte_etl
    )
    SELECT b.id_persona, b.id_captacion, dt.KeyTiempo,
           CASE WHEN b.fecha_conversion <= @corte THEN dconv.KeyTiempo END AS KeyTiempoConversion,
           COALESCE(ds.KeySede, 0) AS KeySede,
           COALESCE(dserv.KeyServicio, 0) AS KeyServicio,
           COALESCE(dc.KeyCanal, 0) AS KeyCanal,
           COALESCE(df.KeyFuente, 0) AS KeyFuente,
           COALESCE(dtp.KeyTipoPersona, 0) AS KeyTipoPersona,
           COALESCE(der.KeyEstadoRegistro, 0) AS KeyEstadoRegistro,
           b.contacto_registrado, b.contacto_utilizable,
           CASE WHEN b.fecha_conversion <= @corte THEN 1 ELSE 0 END AS conversion_lead,
           CASE WHEN b.fecha_conversion <= @corte
                THEN CAST(DATEDIFF_BIG(SECOND, b.fecha_captacion, b.fecha_conversion)/86400.0 AS DECIMAL(18,6)) END AS tiempo_conversion_dia,
           CAST(CASE WHEN g.centimos IS NULL THEN NULL ELSE
                (g.centimos/q.cantidad + CASE WHEN
                    (SELECT COUNT_BIG(*) FROM #DatosBuyer b2
                     WHERE b2.id_campana = b.id_campana
                       AND YEAR(b2.fecha_captacion)*100+MONTH(b2.fecha_captacion) = g.anio_mes
                       AND b2.id_persona <= b.id_persona) <= g.centimos%q.cantidad
                 THEN 1 ELSE 0 END)/100.0 END AS DECIMAL(14,2)) AS costo_atribuido_captacion,
           b.fecha_captacion,
           CASE WHEN b.fecha_conversion <= @corte THEN b.fecha_conversion END AS fecha_conversion,
           CASE WHEN b.fecha_conversion <= @corte THEN b.id_evento_conversion END AS id_evento_conversion,
           b.origen_datos, @corte AS fecha_corte_etl
    FROM #DatosBuyer b
    JOIN NexoSalud_Mart.dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(b.fecha_captacion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Tiempo dconv ON dconv.id_fecha = CAST(b.fecha_conversion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Sede ds ON ds.id_sede = b.id_sede
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Servicio dserv ON dserv.id_servicio = b.id_servicio
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Canal dc ON dc.id_canal = b.id_canal
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Fuente df ON df.id_fuente = b.id_fuente AND df.id_campana = b.id_campana
    LEFT JOIN NexoSalud_Mart.dbo.Dim_TipoPersona dtp ON dtp.id_persona = b.id_persona
    LEFT JOIN NexoSalud_Mart.dbo.Dim_EstadoRegistro der
           ON der.EstadoCalidad = b.estado_calidad
          AND der.AutorizacionContacto = CASE WHEN b.autoriza_contacto = 1 THEN 'SI' ELSE 'NO' END
    LEFT JOIN #GastosBuyer g ON g.id_campana = b.id_campana AND g.anio_mes = YEAR(b.fecha_captacion)*100+MONTH(b.fecha_captacion)
    LEFT JOIN #CantidadBuyer q ON q.id_campana = b.id_campana AND q.anio_mes = YEAR(b.fecha_captacion)*100+MONTH(b.fecha_captacion);

    COMMIT TRANSACTION;
    PRINT 'ETL Bloque 1 Buyer completado con exito.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

PRINT '======================================================================';
PRINT 'PASO 7: RESULTADOS Y VERIFICACIÓN EN NexoSalud_Mart';
PRINT '======================================================================';

USE NexoSalud_Mart;
GO

-- 7.1 Verificar los tres casos de prueba en fact_captacion_buyer
SELECT f.id_persona, f.origen_datos, 
       s.Sede, serv.ServicioOdontologico, c.NombreCanal,
       f.contacto_registrado, f.contacto_utilizable, f.conversion_lead,
       f.costo_atribuido_captacion
FROM dbo.fact_captacion_buyer f
JOIN dbo.Dim_Sede s ON s.KeySede = f.KeySede
JOIN dbo.Dim_Servicio serv ON serv.KeyServicio = f.KeyServicio
JOIN dbo.Dim_Canal c ON c.KeyCanal = f.KeyCanal
WHERE f.origen_datos = 'REGISTRO_DIRECTO';

-- 7.2 Conciliación de céntimos para la Campaña 1 en el mes de prueba
SELECT g.id_campana, g.anio_mes,
       g.centimos / 100.0 AS gasto_original,
       ISNULL(SUM(f.costo_atribuido_captacion), 0) AS gasto_atribuido,
       (g.centimos / 100.0) - ISNULL(SUM(f.costo_atribuido_captacion), 0) AS diferencia_centimos
FROM (
    SELECT id_campana, YEAR(fecha)*100+MONTH(fecha) AS anio_mes, CAST(SUM(importe)*100 AS BIGINT) AS centimos
    FROM NexoSaludDB.dbo.GastosCampana
    WHERE CHARINDEX('[PRUEBA_GERMAIN]', descripcion) > 0
    GROUP BY id_campana, YEAR(fecha)*100+MONTH(fecha)
) g
LEFT JOIN dbo.fact_captacion_buyer f 
    ON f.KeyFuente IN (SELECT KeyFuente FROM dbo.Dim_Fuente WHERE id_campana = g.id_campana)
   AND YEAR(f.fecha_captacion)*100+MONTH(f.fecha_captacion) = g.anio_mes
GROUP BY g.id_campana, g.anio_mes, g.centimos;

-- 7.3 Cálculo de Indicadores B1, B2 y B3 sobre la cohorte probada de REGISTRO_DIRECTO
SELECT 
    'COHORTE PRUEBA GERMAIN' AS cohorte,
    SUM(f.contacto_registrado) AS contactos_registrados,
    SUM(f.contacto_utilizable) AS contactos_utilizables,
    100.0 * SUM(f.contacto_utilizable) / NULLIF(SUM(f.contacto_registrado), 0) AS B2_pct_calidad,
    SUM(f.conversion_lead) AS conversiones_lead,
    100.0 * SUM(f.conversion_lead) / NULLIF(SUM(f.contacto_utilizable), 0) AS B1_pct_conversion,
    SUM(f.costo_atribuido_captacion) AS gasto_atribuido_total,
    SUM(f.costo_atribuido_captacion) / NULLIF(SUM(f.conversion_lead), 0) AS B3_costo_por_lead_soles
FROM dbo.fact_captacion_buyer f
WHERE f.origen_datos = 'REGISTRO_DIRECTO';
GO
