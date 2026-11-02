/* ETL COMPLETO -- revision de Semana 9.
   Primer bloque: Buyer revisado. Segundo bloque: demas fases heredadas.
   Fuente unica del ETL de esta revision: no hay complemento duplicado.
   Ver ../README.md y ../docs/EJECUCION_SQL_SERVER.md para seleccionar bloques.
   Estilo de laboratorio: preparar SELECT, MERGE de dimensiones, DELETE + INSERT del hecho.
   Ejecutar despues de init_oltp/init_mart nuevos O de migracion_buyer.sql.
   Detener el backend durante instalacion; el servicio actual usa el procedimiento canonico.
   No infiere sede desde zona ni conversion desde Solicitudes/etapa actual.
*/
-- ===== BLOQUE 1 DE 2: BUYER REVISADO =====
USE NexoSaludDB;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
-- Rutina canonica de captacion: tambien la invoca el backend.
CREATE OR ALTER PROCEDURE dbo.usp_SincronizarCaptacionBuyer
AS
BEGIN
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @corte DATETIME2=SYSDATETIME(),@bloqueo INT;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @bloqueo=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
         @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @bloqueo<0 THROW 51200,'Otro ETL Buyer esta en ejecucion.',1;
    IF COL_LENGTH('NexoSalud_Mart.dbo.fact_captacion_buyer','id_persona') IS NULL
        THROW 51201,'Falta aplicar el DDL/migracion atomica Buyer.',1;

    -- 1. Incorporar identidades historicas aun sin captacion estructurada.
    -- Los valores observados NO prueban el estado que tenian al registrarse.
    -- No se inventan sede, servicio, motivo, autorizacion ni fecha de conversion.
    INSERT dbo.CaptacionesBuyer
        (id_persona,fecha_captacion,id_canal,id_fuente,id_campana,
         estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
    SELECT p.id_persona,p.fecha_registro,p.id_canal_origen,ca.id_fuente,p.id_campana_origen,
           p.estado_calidad,p.autoriza_contacto,p.fecha_autorizacion,'HISTORICO_OBSERVADO'
    FROM dbo.Personas p
    LEFT JOIN dbo.Campanas ca ON ca.id_campana=p.id_campana_origen
    WHERE p.fecha_registro<=@corte AND NOT EXISTS
        (SELECT 1 FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona);

    IF EXISTS (SELECT 1 FROM dbo.CaptacionesBuyer c JOIN dbo.Campanas ca
               ON ca.id_campana=c.id_campana WHERE c.id_fuente IS NOT NULL
               AND c.id_fuente<>ca.id_fuente)
        THROW 51202,'Captacion con fuente distinta de su campana.',1;
    IF EXISTS (SELECT 1 FROM dbo.EventosEtapa e JOIN dbo.CaptacionesBuyer c
               ON c.id_captacion=e.id_captacion WHERE e.id_persona<>c.id_persona)
        THROW 51203,'Evento vinculado a captacion de otra persona.',1;

    -- 2. Preparar datos al mismo corte. No hay promedio de grupos.
    SELECT v.* INTO #DatosBuyer FROM dbo.v_DatosCaptacionBuyer v
    WHERE v.fecha_captacion<=@corte;
    CREATE UNIQUE INDEX UQ_DatosBuyer_Persona ON #DatosBuyer(id_persona);

    -- 3. Miembros desconocidos (Key=0). Nunca usar sede/campana real por defecto.
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Tiempo WHERE KeyTiempo=0)
        INSERT NexoSalud_Mart.dbo.Dim_Tiempo
        VALUES (0,'19000101',1900,1,1,1);
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Sede WHERE KeySede=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Sede ON;
        INSERT NexoSalud_Mart.dbo.Dim_Sede (KeySede,id_sede,Sede,Distrito,Zona) VALUES (0,0,'No especificada','No especificado','No especificada');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Sede OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Servicio WHERE KeyServicio=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Servicio ON;
        INSERT NexoSalud_Mart.dbo.Dim_Servicio (KeyServicio,id_servicio,ServicioOdontologico,Categoria,Procedimiento) VALUES (0,0,'No especificado','No especificada','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Servicio OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Canal WHERE KeyCanal=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Canal ON;
        INSERT NexoSalud_Mart.dbo.Dim_Canal (KeyCanal,id_canal,NombreCanal,TipoMedio) VALUES (0,0,'No especificado','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Canal OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE KeyFuente=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Fuente ON;
        INSERT NexoSalud_Mart.dbo.Dim_Fuente (KeyFuente,id_fuente,id_campana,TipoOrigen,Campana) VALUES (0,0,0,'No especificada','Sin campana');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_Fuente OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_TipoPersona WHERE KeyTipoPersona=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_TipoPersona ON;
        INSERT NexoSalud_Mart.dbo.Dim_TipoPersona (KeyTipoPersona,id_persona,Ocupacion,RangoEdad) VALUES (0,0,'No especificada','No especificado');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_TipoPersona OFF;
    END;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro WHERE KeyEstadoRegistro=0)
    BEGIN
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro ON;
        INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro (KeyEstadoRegistro,EstadoCalidad,AutorizacionContacto) VALUES (0,'No especificado','NO');
        SET IDENTITY_INSERT NexoSalud_Mart.dbo.Dim_EstadoRegistro OFF;
    END;

    -- 4. Preparar fechas de captacion y conversion (roles de la misma dimension).
    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim
    USING (
        SELECT id_fecha=CAST(fecha_captacion AS DATE) FROM #DatosBuyer
        UNION
        SELECT CAST(fecha_conversion AS DATE) FROM #DatosBuyer
        WHERE fecha_conversion IS NOT NULL AND fecha_conversion<=@corte
    ) AS origen ON origen.id_fecha=dim.id_fecha
    WHEN NOT MATCHED THEN
        INSERT (KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
        VALUES (YEAR(origen.id_fecha)*10000+MONTH(origen.id_fecha)*100+DAY(origen.id_fecha),
                origen.id_fecha,YEAR(origen.id_fecha),DATEPART(QUARTER,origen.id_fecha),
                MONTH(origen.id_fecha),DAY(origen.id_fecha));
-- 3. Dim_Sede
MERGE [NexoSalud_Mart].[dbo].[Dim_Sede] AS dim USING
(
    SELECT 
        id_sede,
        nombre AS Sede,
        COALESCE(NULLIF(LTRIM(RTRIM(zona)), ''), 'No especificado') AS Distrito,
        COALESCE(NULLIF(LTRIM(RTRIM(zona)), ''), 'No especificada') AS Zona
    FROM dbo.Sedes
) AS oltp
ON oltp.id_sede = dim.id_sede
WHEN MATCHED THEN
    UPDATE SET dim.Sede = oltp.Sede, dim.Distrito = oltp.Distrito, dim.Zona = oltp.Zona
WHEN NOT MATCHED THEN
    INSERT (id_sede, Sede, Distrito, Zona)
    VALUES (oltp.id_sede, oltp.Sede, oltp.Distrito, oltp.Zona);

-- 4. Dim_Servicio
MERGE [NexoSalud_Mart].[dbo].[Dim_Servicio] AS dim USING
(
    SELECT 
        id_servicio,
        nombre AS ServicioOdontologico,
        Categoria = CASE 
            WHEN nombre LIKE '%Implante%' THEN 'Implantología'
            WHEN nombre LIKE '%Ortodoncia%' OR nombre LIKE '%Brackets%' THEN 'Ortodoncia'
            WHEN nombre LIKE '%Profilaxis%' OR nombre LIKE '%Limpieza%' THEN 'Odontología Preventiva'
            WHEN nombre LIKE '%Curación%' OR nombre LIKE '%Restauración%' THEN 'Odontología Restauradora'
            WHEN nombre LIKE '%Evaluaci%' OR nombre LIKE '%Control%' OR nombre LIKE '%Fluori%'
                 THEN 'Odontología General'
            ELSE 'No clasificado'
        END,
        COALESCE(descripcion, nombre) AS Procedimiento
    FROM dbo.Servicios
) AS oltp
ON oltp.id_servicio = dim.id_servicio
WHEN MATCHED THEN
    UPDATE SET dim.ServicioOdontologico = oltp.ServicioOdontologico, dim.Categoria = oltp.Categoria, dim.Procedimiento = oltp.Procedimiento
WHEN NOT MATCHED THEN
    INSERT (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
    VALUES (oltp.id_servicio, oltp.ServicioOdontologico, oltp.Categoria, oltp.Procedimiento);

-- 5. Dim_Canal
MERGE [NexoSalud_Mart].[dbo].[Dim_Canal] AS dim USING
(
    SELECT 
        id_canal,
        nombre AS NombreCanal,
        TipoMedio = CASE 
            WHEN nombre LIKE '%WhatsApp%' OR nombre IN
                 ('Web', 'Página Web', 'Formulario Web', 'Facebook', 'Instagram', 'Correo Electrónico') THEN 'Digital'
            WHEN nombre LIKE '%Llamada%' THEN 'Telefónico'
            ELSE 'No clasificado'
        END
    FROM dbo.Canales
) AS oltp
ON oltp.id_canal = dim.id_canal
WHEN MATCHED THEN
    UPDATE SET dim.NombreCanal = oltp.NombreCanal, dim.TipoMedio = oltp.TipoMedio
WHEN NOT MATCHED THEN
    INSERT (id_canal, NombreCanal, TipoMedio)
    VALUES (oltp.id_canal, oltp.NombreCanal, oltp.TipoMedio);

-- 7. Dim_TipoPersona
MERGE [NexoSalud_Mart].[dbo].[Dim_TipoPersona] AS dim USING
(
    SELECT 
        id_persona,
        COALESCE(NULLIF(LTRIM(RTRIM(tipo_persona)), ''), 'No especificado') AS Ocupacion,
        RangoEdad = CASE 
            WHEN fecha_nacimiento IS NULL THEN 'No Especificado'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) < 18 THEN 'Menor de 18'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) BETWEEN 18 AND 29 THEN '18 a 29 años'
            WHEN DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) BETWEEN 30 AND 49 THEN '30 a 49 años'
            ELSE '50 años a más'
        END
    FROM dbo.Personas
) AS oltp
ON oltp.id_persona = dim.id_persona
WHEN MATCHED THEN
    UPDATE SET dim.Ocupacion = oltp.Ocupacion, dim.RangoEdad = oltp.RangoEdad
WHEN NOT MATCHED THEN
    INSERT (id_persona, Ocupacion, RangoEdad)
    VALUES (oltp.id_persona, oltp.Ocupacion, oltp.RangoEdad);

    -- Fuente/campana: incluir fuente conocida sin campana, sin escoger una campana arbitraria.
    MERGE NexoSalud_Mart.dbo.Dim_Fuente AS dim
    USING (
        SELECT f.id_fuente,c.id_campana,f.nombre AS TipoOrigen,c.nombre AS Campana
        FROM dbo.Fuentes f JOIN dbo.Campanas c ON c.id_fuente=f.id_fuente
        UNION ALL
        SELECT f.id_fuente,CAST(NULL AS INT),f.nombre,'Sin campana'
        FROM dbo.Fuentes f
    ) AS origen
    ON dim.id_fuente=origen.id_fuente
       AND ISNULL(dim.id_campana,0)=ISNULL(origen.id_campana,0)
    WHEN MATCHED THEN UPDATE SET dim.TipoOrigen=origen.TipoOrigen,dim.Campana=origen.Campana
    WHEN NOT MATCHED THEN INSERT (id_fuente,id_campana,TipoOrigen,Campana)
        VALUES (origen.id_fuente,origen.id_campana,origen.TipoOrigen,origen.Campana);

    MERGE NexoSalud_Mart.dbo.Dim_EstadoRegistro AS dim
    USING (
        SELECT DISTINCT estado_calidad AS EstadoCalidad,
               CASE WHEN autoriza_contacto=1 THEN 'SI' ELSE 'NO' END AS AutorizacionContacto
        FROM #DatosBuyer
    ) AS origen
    ON dim.EstadoCalidad=origen.EstadoCalidad
       AND dim.AutorizacionContacto=origen.AutorizacionContacto
    WHEN NOT MATCHED THEN INSERT (EstadoCalidad,AutorizacionContacto)
        VALUES (origen.EstadoCalidad,origen.AutorizacionContacto);

    -- 5. Un lookup debe devolver como maximo una fila. Abortamos antes de borrar el hecho.
    IF EXISTS (SELECT id_fecha FROM NexoSalud_Mart.dbo.Dim_Tiempo GROUP BY id_fecha HAVING COUNT(*)>1)
        THROW 51204,'Dim_Tiempo tiene fechas duplicadas.',1;
    IF EXISTS (SELECT id_sede FROM NexoSalud_Mart.dbo.Dim_Sede WHERE id_sede IS NOT NULL
               GROUP BY id_sede HAVING COUNT(*)>1)
        THROW 51205,'Dim_Sede tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_servicio FROM NexoSalud_Mart.dbo.Dim_Servicio WHERE id_servicio IS NOT NULL
               GROUP BY id_servicio HAVING COUNT(*)>1)
        THROW 51206,'Dim_Servicio tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_canal FROM NexoSalud_Mart.dbo.Dim_Canal WHERE id_canal IS NOT NULL
               GROUP BY id_canal HAVING COUNT(*)>1)
        THROW 51207,'Dim_Canal tiene identificadores duplicados.',1;
    IF EXISTS (SELECT id_fuente,ISNULL(id_campana,0) FROM NexoSalud_Mart.dbo.Dim_Fuente
               GROUP BY id_fuente,ISNULL(id_campana,0) HAVING COUNT(*)>1)
        THROW 51208,'Dim_Fuente tiene pares fuente/campana duplicados.',1;
    IF EXISTS (SELECT id_persona FROM NexoSalud_Mart.dbo.Dim_TipoPersona WHERE id_persona IS NOT NULL
               GROUP BY id_persona HAVING COUNT(*)>1)
        THROW 51209,'Dim_TipoPersona tiene personas duplicadas.',1;
    IF EXISTS (SELECT EstadoCalidad,AutorizacionContacto FROM NexoSalud_Mart.dbo.Dim_EstadoRegistro
               GROUP BY EstadoCalidad,AutorizacionContacto HAVING COUNT(*)>1)
        THROW 51210,'Dim_EstadoRegistro tiene combinaciones duplicadas.',1;

    -- 6. Gasto original por campana/mes; no se inventan importes si falta evidencia.
    SELECT id_campana,YEAR(fecha)*100+MONTH(fecha) AS anio_mes,
           CAST(SUM(importe)*100 AS BIGINT) AS centimos
    INTO #GastosBuyer FROM dbo.GastosCampana
    WHERE fecha<=CAST(@corte AS DATE)
    GROUP BY id_campana,YEAR(fecha)*100+MONTH(fecha);
    SELECT id_campana,YEAR(fecha_captacion)*100+MONTH(fecha_captacion) AS anio_mes,
           COUNT_BIG(*) AS cantidad
    INTO #CantidadBuyer FROM #DatosBuyer WHERE id_campana IS NOT NULL
    GROUP BY id_campana,YEAR(fecha_captacion)*100+MONTH(fecha_captacion);

    -- 7. Preparacion final: mismas cinco medidas, UNA fila por persona.
    SELECT b.id_persona,b.id_captacion,dt.KeyTiempo,
           CASE WHEN b.fecha_conversion<=@corte THEN dconv.KeyTiempo END AS KeyTiempoConversion,
           COALESCE(ds.KeySede,0) AS KeySede,COALESCE(dserv.KeyServicio,0) AS KeyServicio,
           COALESCE(dc.KeyCanal,0) AS KeyCanal,COALESCE(df.KeyFuente,0) AS KeyFuente,
           COALESCE(dtp.KeyTipoPersona,0) AS KeyTipoPersona,
           COALESCE(der.KeyEstadoRegistro,0) AS KeyEstadoRegistro,
           b.contacto_registrado,b.contacto_utilizable,
           CASE WHEN b.fecha_conversion<=@corte THEN 1 ELSE 0 END AS conversion_lead,
           CASE WHEN b.fecha_conversion<=@corte
                THEN CAST(DATEDIFF_BIG(SECOND,b.fecha_captacion,b.fecha_conversion)/86400.0
                          AS DECIMAL(18,6)) END AS tiempo_conversion_dia,
           CAST(CASE WHEN g.centimos IS NULL THEN NULL ELSE
                (g.centimos/q.cantidad + CASE WHEN
                    (SELECT COUNT_BIG(*) FROM #DatosBuyer b2
                     WHERE b2.id_campana=b.id_campana
                       AND YEAR(b2.fecha_captacion)*100+MONTH(b2.fecha_captacion)=g.anio_mes
                       AND b2.id_persona<=b.id_persona)<=g.centimos%q.cantidad
                 THEN 1 ELSE 0 END)/100.0 END AS DECIMAL(14,2)) AS costo_atribuido_captacion,
           b.fecha_captacion,
           CASE WHEN b.fecha_conversion<=@corte THEN b.fecha_conversion END AS fecha_conversion,
           CASE WHEN b.fecha_conversion<=@corte THEN b.id_evento_conversion END AS id_evento_conversion,
           b.origen_datos,@corte AS fecha_corte_etl
    INTO #HechoBuyer
    FROM #DatosBuyer b
    JOIN NexoSalud_Mart.dbo.Dim_Tiempo dt ON dt.id_fecha=CAST(b.fecha_captacion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Tiempo dconv ON dconv.id_fecha=CAST(b.fecha_conversion AS DATE)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Sede ds ON ds.id_sede=b.id_sede
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Servicio dserv ON dserv.id_servicio=b.id_servicio
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Canal dc ON dc.id_canal=b.id_canal
    LEFT JOIN NexoSalud_Mart.dbo.Dim_Fuente df
        ON df.id_fuente=COALESCE(b.id_fuente,0)
       AND ISNULL(df.id_campana,0)=ISNULL(b.id_campana,0)
    LEFT JOIN NexoSalud_Mart.dbo.Dim_TipoPersona dtp ON dtp.id_persona=b.id_persona
    LEFT JOIN NexoSalud_Mart.dbo.Dim_EstadoRegistro der
        ON der.EstadoCalidad=b.estado_calidad
       AND der.AutorizacionContacto=CASE WHEN b.autoriza_contacto=1 THEN 'SI' ELSE 'NO' END
    LEFT JOIN #GastosBuyer g ON g.id_campana=b.id_campana
       AND g.anio_mes=YEAR(b.fecha_captacion)*100+MONTH(b.fecha_captacion)
    LEFT JOIN #CantidadBuyer q ON q.id_campana=b.id_campana AND q.anio_mes=g.anio_mes;
    CREATE UNIQUE INDEX UQ_HechoBuyer_Persona ON #HechoBuyer(id_persona);
    DECLARE @cantidad_origen BIGINT=(SELECT COUNT_BIG(*) FROM #DatosBuyer),
            @cantidad_destino BIGINT=(SELECT COUNT_BIG(*) FROM #HechoBuyer);
    IF @cantidad_origen<>@cantidad_destino
        THROW 51211,'Perdida o duplicacion de contactos antes de cargar.',1;

    -- 8. Carga completa SOLO de Buyer; si falla, la transaccion conserva el estado anterior.
    DELETE FROM NexoSalud_Mart.dbo.fact_captacion_buyer;
    INSERT NexoSalud_Mart.dbo.fact_captacion_buyer
        (id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,
         KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,
         contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,
         fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos,fecha_corte_etl)
    SELECT id_persona,id_captacion,KeyTiempo,KeyTiempoConversion,KeySede,KeyServicio,
           KeyCanal,KeyFuente,KeyTipoPersona,KeyEstadoRegistro,contacto_registrado,
           contacto_utilizable,conversion_lead,tiempo_conversion_dia,costo_atribuido_captacion,
           fecha_captacion,fecha_conversion,id_evento_conversion,origen_datos,fecha_corte_etl
    FROM #HechoBuyer;
    COMMIT;
    SELECT @corte AS fecha_corte,COUNT(*) AS contactos,
           SUM(contacto_utilizable) AS utilizables,SUM(conversion_lead) AS conversiones,
           SUM(costo_atribuido_captacion) AS costo_atribuido
    FROM NexoSalud_Mart.dbo.fact_captacion_buyer;
    -- Gastos sin contactos NO desaparecen: se exponen para conciliacion.
    SELECT g.id_campana,g.anio_mes,g.centimos/100.0 AS gasto_no_atribuido
    FROM #GastosBuyer g LEFT JOIN #CantidadBuyer q
      ON q.id_campana=g.id_campana AND q.anio_mes=g.anio_mes
    WHERE q.cantidad IS NULL;
    DROP TABLE #HechoBuyer;
    DROP TABLE #CantidadBuyer;
    DROP TABLE #GastosBuyer;
    DROP TABLE #DatosBuyer;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;
END;
GO
EXEC dbo.usp_SincronizarCaptacionBuyer;
GO


-- ===== BLOQUE 2 DE 2: OTRAS FASES HEREDADAS =====
/* CARGA SEMANA 9: LEAD, PAYER, CUSTOMER Y TURNED.
   Puede ejecutarse despues de haber cargado Buyer, sin recrear ni borrar bases.
   No modifica el hecho Buyer ni CaptacionesBuyer.
   Conserva calculos originales de estas fases (incluidos limites heredados:
   costo_transaccion=3%, MIN de dimensiones, definiciones de estados y seguimiento).
   Unica correccion de integracion: JOIN de fuente en PAYER previamente validado.
   No debe interpretarse como auditoria o rediseno de los otros cuatro indicadores/fases.
*/
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @bloqueo_otras INT;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @bloqueo_otras=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
         @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @bloqueo_otras<0 THROW 51400,'Otro ETL esta en ejecucion.',1;
    IF COL_LENGTH('NexoSalud_Mart.dbo.fact_captacion_buyer','id_persona') IS NULL
        THROW 51401,'Este complemento corresponde al esquema revisado de Semana 9.',1;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.Dim_Sede WHERE KeySede=0)
        THROW 51411,'Ejecutar primero la carga Buyer para preparar dimensiones compartidas.',1;

    -- Completar el calendario con las fechas de las demas operaciones.
    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim USING (
        SELECT CAST(fecha_solicitud AS DATE) AS id_fecha FROM dbo.Solicitudes
        WHERE fecha_solicitud IS NOT NULL
        UNION SELECT CAST(fecha_reserva AS DATE) FROM dbo.Reservas WHERE fecha_reserva IS NOT NULL
        UNION SELECT CAST(fecha_registro AS DATE) FROM dbo.Pagos WHERE fecha_registro IS NOT NULL
        UNION SELECT CAST(fecha_atencion AS DATE) FROM dbo.Atenciones WHERE fecha_atencion IS NOT NULL
        UNION SELECT CAST(fecha_hora AS DATE) FROM dbo.Seguimientos WHERE fecha_hora IS NOT NULL
    ) AS origen ON origen.id_fecha=dim.id_fecha
    WHEN NOT MATCHED THEN INSERT (KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
        VALUES (YEAR(origen.id_fecha)*10000+MONTH(origen.id_fecha)*100+DAY(origen.id_fecha),
                origen.id_fecha,YEAR(origen.id_fecha),DATEPART(QUARTER,origen.id_fecha),
                MONTH(origen.id_fecha),DAY(origen.id_fecha));

-- 2. Dim_Hora
MERGE [NexoSalud_Mart].[dbo].[Dim_Hora] AS dim USING
(
    SELECT DISTINCT
        id_hora = DATEPART(HOUR, fecha) * 100 + DATEPART(MINUTE, fecha),
        Turno = CASE 
            WHEN DATEPART(HOUR, fecha) BETWEEN 0 AND 6 THEN 'Madrugada'
            WHEN DATEPART(HOUR, fecha) BETWEEN 7 AND 12 THEN 'Mañana'
            WHEN DATEPART(HOUR, fecha) BETWEEN 13 AND 18 THEN 'Tarde'
            ELSE 'Noche'
        END,
        Hora = DATEPART(HOUR, fecha),
        Minuto = DATEPART(MINUTE, fecha)
    FROM (
        SELECT fecha_registro AS fecha FROM dbo.Pagos WHERE fecha_registro IS NOT NULL
        UNION
        SELECT fecha_atencion AS fecha FROM dbo.Atenciones WHERE fecha_atencion IS NOT NULL
    ) AS H
) AS oltp
ON oltp.id_hora = dim.id_hora
WHEN NOT MATCHED THEN
    INSERT (id_hora, Turno, Hora, Minuto)
    VALUES (oltp.id_hora, oltp.Turno, oltp.Hora, oltp.Minuto);

-- 8. Dim_Pagador
MERGE [NexoSalud_Mart].[dbo].[Dim_Pagador] AS dim USING
(
    SELECT DISTINCT
        p.id_persona,
        COALESCE(p.tipo_persona, 'Particular') AS Ocupacion,
        RangoEdad = CASE 
            WHEN p.fecha_nacimiento IS NULL THEN 'No Especificado'
            WHEN DATEDIFF(YEAR, p.fecha_nacimiento, GETDATE()) < 30 THEN 'Joven'
            ELSE 'Adulto'
        END,
        'No Declarado' AS EstadoCivil,
        'Medio' AS NivelIngreso
    FROM dbo.Pagos pg
    INNER JOIN dbo.Personas p ON pg.id_persona = p.id_persona
) AS oltp
ON oltp.id_persona = dim.id_persona
WHEN MATCHED THEN
    UPDATE SET dim.Ocupacion = oltp.Ocupacion, dim.RangoEdad = oltp.RangoEdad, dim.EstadoCivil = oltp.EstadoCivil, dim.NivelIngreso = oltp.NivelIngreso
WHEN NOT MATCHED THEN
    INSERT (id_persona, Ocupacion, RangoEdad, EstadoCivil, NivelIngreso)
    VALUES (oltp.id_persona, oltp.Ocupacion, oltp.RangoEdad, oltp.EstadoCivil, oltp.NivelIngreso);

-- 9. Dim_Profesional
MERGE [NexoSalud_Mart].[dbo].[Dim_Profesional] AS dim USING
(
    SELECT 
        id_profesional,
        nombres + ' ' + apellidos AS Odontologo,
        COALESCE(especialidad, 'Odontología General') AS EspecialidadPrincipal
    FROM dbo.Profesionales
) AS oltp
ON oltp.id_profesional = dim.id_profesional
WHEN MATCHED THEN
    UPDATE SET dim.Odontologo = oltp.Odontologo, dim.EspecialidadPrincipal = oltp.EspecialidadPrincipal
WHEN NOT MATCHED THEN
    INSERT (id_profesional, Odontologo, EspecialidadPrincipal)
    VALUES (oltp.id_profesional, oltp.Odontologo, oltp.EspecialidadPrincipal);

-- 10. Dim_Negociador
MERGE [NexoSalud_Mart].[dbo].[Dim_Negociador] AS dim USING
(
    SELECT 
        id_usuario,
        nombres + ' ' + apellidos AS NombreNegociador
    FROM dbo.Usuarios
) AS oltp
ON oltp.id_usuario = dim.id_usuario
WHEN MATCHED THEN
    UPDATE SET dim.NombreNegociador = oltp.NombreNegociador
WHEN NOT MATCHED THEN
    INSERT (id_usuario, NombreNegociador)
    VALUES (oltp.id_usuario, oltp.NombreNegociador);

-- 11. Dim_Pasarela
MERGE [NexoSalud_Mart].[dbo].[Dim_Pasarela] AS dim USING
(
    SELECT DISTINCT
        COALESCE(canal_pago, 'EFECTIVO') AS MetodoPago,
        EntidadFinanciera = CASE 
            WHEN canal_pago LIKE '%YAPE%' THEN 'BCP'
            WHEN canal_pago LIKE '%PLIN%' THEN 'Interbank/BBVA'
            WHEN canal_pago LIKE '%BCP%' THEN 'Banco de Crédito'
            ELSE 'Caja Luxedent'
        END,
        TipoMedio = CASE 
            WHEN canal_pago IN ('YAPE', 'PLIN') THEN 'Billetera Digital'
            WHEN canal_pago LIKE '%POS%' THEN 'POS Tarjeta'
            ELSE 'Presencial'
        END
    FROM dbo.Pagos
) AS oltp
ON oltp.MetodoPago = dim.MetodoPago AND oltp.EntidadFinanciera = dim.EntidadFinanciera
WHEN NOT MATCHED THEN
    INSERT (MetodoPago, EntidadFinanciera, TipoMedio)
    VALUES (oltp.MetodoPago, oltp.EntidadFinanciera, oltp.TipoMedio);

-- 12. Dim_Cobro
MERGE [NexoSalud_Mart].[dbo].[Dim_Cobro] AS dim USING
(
    SELECT DISTINCT
        estado AS EstadoPago,
        CASE WHEN comprobante IS NOT NULL AND comprobante <> '' THEN 'SI' ELSE 'NO' END AS ComprobanteAdjunto
    FROM dbo.Pagos
) AS oltp
ON oltp.EstadoPago = dim.EstadoPago AND oltp.ComprobanteAdjunto = dim.ComprobanteAdjunto
WHEN NOT MATCHED THEN
    INSERT (EstadoPago, ComprobanteAdjunto)
    VALUES (oltp.EstadoPago, oltp.ComprobanteAdjunto);

-- 13. Dim_EstadoAtencion
MERGE [NexoSalud_Mart].[dbo].[Dim_EstadoAtencion] AS dim USING
(
    SELECT DISTINCT
        estado_servicio AS EstadoFinal,
        asistencia AS Asistencia
    FROM dbo.Atenciones
) AS oltp
ON oltp.EstadoFinal = dim.EstadoFinal AND oltp.Asistencia = dim.Asistencia
WHEN NOT MATCHED THEN
    INSERT (EstadoFinal, Asistencia)
    VALUES (oltp.EstadoFinal, oltp.Asistencia);

    -- Detener la carga si un lookup existente multiplicaria registros.
    IF EXISTS (SELECT id_fecha FROM NexoSalud_Mart.dbo.Dim_Tiempo
               GROUP BY id_fecha HAVING COUNT(*)>1)
        THROW 51402,'Fechas duplicadas en Dim_Tiempo.',1;
    IF EXISTS (SELECT id_hora FROM NexoSalud_Mart.dbo.Dim_Hora
               WHERE id_hora IS NOT NULL GROUP BY id_hora HAVING COUNT(*)>1)
        THROW 51403,'Horas duplicadas en Dim_Hora.',1;
    IF EXISTS (SELECT id_persona FROM NexoSalud_Mart.dbo.Dim_Pagador
               WHERE id_persona IS NOT NULL GROUP BY id_persona HAVING COUNT(*)>1)
        THROW 51404,'Pagadores duplicados.',1;
    IF EXISTS (SELECT id_profesional FROM NexoSalud_Mart.dbo.Dim_Profesional
               WHERE id_profesional IS NOT NULL GROUP BY id_profesional HAVING COUNT(*)>1)
        THROW 51405,'Profesionales duplicados.',1;
    IF EXISTS (SELECT id_usuario FROM NexoSalud_Mart.dbo.Dim_Negociador
               WHERE id_usuario IS NOT NULL GROUP BY id_usuario HAVING COUNT(*)>1)
        THROW 51406,'Negociadores duplicados.',1;
    IF EXISTS (SELECT MetodoPago FROM NexoSalud_Mart.dbo.Dim_Pasarela
               GROUP BY MetodoPago HAVING COUNT(*)>1)
        THROW 51407,'Mas de una pasarela por metodo: revisar lookup original.',1;
    IF EXISTS (SELECT EstadoPago,ComprobanteAdjunto FROM NexoSalud_Mart.dbo.Dim_Cobro
               GROUP BY EstadoPago,ComprobanteAdjunto HAVING COUNT(*)>1)
        THROW 51408,'Estados de cobro duplicados.',1;
    IF EXISTS (SELECT EstadoFinal,Asistencia FROM NexoSalud_Mart.dbo.Dim_EstadoAtencion
               GROUP BY EstadoFinal,Asistencia HAVING COUNT(*)>1)
        THROW 51409,'Estados de atencion duplicados.',1;
    IF EXISTS (SELECT id_campana FROM NexoSalud_Mart.dbo.Dim_Fuente WHERE id_campana>0
               GROUP BY id_campana HAVING COUNT(*)>1)
        THROW 51410,'Campanas duplicadas en Dim_Fuente.',1;

-- 2. HECHO: NEGOCIACIÓN LEAD
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador)
DELETE [NexoSalud_Mart].[dbo].fact_negociacion_lead;

INSERT INTO [NexoSalud_Mart].[dbo].fact_negociacion_lead
(KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyNegociador,
 cohorte_evaluable, conversion_payer_14_dia, solicitud_requiere_respuesta, respuesta_util_15_min, negociacion_finalizada, negociacion_abandonada, leads_en_negociacion)
SELECT 
    dt.KeyTiempo,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dn.KeyNegociador, 1) AS KeyNegociador,
    cohorte_evaluable = COUNT(s.id_solicitud),
    conversion_payer_14_dia = SUM(CASE WHEN r.id_reserva IS NOT NULL AND DATEDIFF(dd, s.fecha_solicitud, r.fecha_reserva) <= 14 THEN 1 ELSE 0 END),
    solicitud_requiere_respuesta = COUNT(s.id_solicitud),
    respuesta_util_15_min = SUM(CASE WHEN DATEDIFF(mi, s.fecha_solicitud, s.fecha_primera_respuesta) <= 15 THEN 1 ELSE 0 END),
    negociacion_finalizada = SUM(CASE WHEN s.estado = 'Convertida' THEN 1 ELSE 0 END),
    negociacion_abandonada    = SUM(CASE WHEN s.estado = 'Abandonada' THEN 1 ELSE 0 END),
    leads_en_negociacion  = SUM(CASE WHEN s.estado IN ('En Negociacion', 'En negociación', 'Pendiente') THEN 1 ELSE 0 END)
FROM NexoSaludDB.dbo.Solicitudes s
LEFT JOIN NexoSaludDB.dbo.Reservas r ON s.id_solicitud = r.id_solicitud
LEFT JOIN NexoSaludDB.dbo.Opciones o ON r.id_opcion = o.id_opcion
LEFT JOIN NexoSaludDB.dbo.Disponibilidad disp ON o.id_disponibilidad = disp.id_disponibilidad
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(s.fecha_solicitud AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = s.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = disp.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = disp.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Negociador dn ON dn.id_usuario = 1
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dn.KeyNegociador, 1);

-- 3. HECHO: GESTIÓN PAYER
-- Grano PK: (KeyTiempo, KeyPasarela, KeyCobro, KeySede, KeyServicio)
DELETE [NexoSalud_Mart].[dbo].fact_gestion_payer;

INSERT INTO [NexoSalud_Mart].[dbo].fact_gestion_payer
(KeyTiempo, KeyHora, KeySede, KeyServicio, KeyFuente, KeyPasarela, KeyPagador, KeyCobro,
 pago_registrado, pago_validado, pago_rechazado, conversion_customer, importe_total_cobro, costo_transaccion, tiempo_validacion_minuto)
SELECT 
    dt.KeyTiempo,
    MIN(dh.KeyHora) AS KeyHora,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    MIN(df.KeyFuente) AS KeyFuente,
    COALESCE(dpas.KeyPasarela, 1) AS KeyPasarela,
    MIN(dpag.KeyPagador) AS KeyPagador,
    COALESCE(dc.KeyCobro, 1) AS KeyCobro,
    pago_registrado = COUNT(p.id_pago),
    pago_validado   = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN 1 ELSE 0 END),
    pago_rechazado  = SUM(CASE WHEN UPPER(p.estado) IN ('REJECTED', 'RECHAZADO', 'FALLIDO') THEN 1 ELSE 0 END),
    conversion_customer = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN 1 ELSE 0 END),
    importe_total_cobro = SUM(CASE WHEN UPPER(p.estado) IN ('VALIDATED', 'VALIDADO', 'CONFIRMADO') THEN p.importe ELSE 0.00 END),
    costo_transaccion = SUM(p.importe * 0.03),
    tiempo_validacion_minuto = SUM(ISNULL(DATEDIFF(mi, p.fecha_registro, p.fecha_validacion), 0))
FROM NexoSaludDB.dbo.Pagos p
LEFT JOIN NexoSaludDB.dbo.Reservas r ON p.id_reserva = r.id_reserva
LEFT JOIN NexoSaludDB.dbo.Opciones o ON r.id_opcion = o.id_opcion
LEFT JOIN NexoSaludDB.dbo.Solicitudes s ON r.id_solicitud = s.id_solicitud
LEFT JOIN NexoSaludDB.dbo.Disponibilidad disp ON o.id_disponibilidad = disp.id_disponibilidad
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(p.fecha_registro AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Hora dh ON dh.id_hora = (DATEPART(HOUR, p.fecha_registro) * 100 + DATEPART(MINUTE, p.fecha_registro))
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = disp.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = s.id_servicio
-- Correccion puntual ya comprobada: no multiplicar cada pago por las campanas de la fuente 1.
LEFT JOIN NexoSaludDB.dbo.Personas persona ON persona.id_persona = p.id_persona
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Fuente df ON df.id_campana = persona.id_campana_origen
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Pasarela dpas ON dpas.MetodoPago = p.canal_pago
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Pagador dpag ON dpag.id_persona = p.id_persona
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Cobro dc ON dc.EstadoPago = p.estado 
    AND dc.ComprobanteAdjunto = CASE WHEN p.comprobante IS NOT NULL AND p.comprobante <> '' THEN 'SI' ELSE 'NO' END
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(dpas.KeyPasarela, 1), 
    COALESCE(dc.KeyCobro, 1), 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1);

-- 4. HECHO: ATENCIÓN CUSTOMER
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion)
DELETE [NexoSalud_Mart].[dbo].fact_atencion_customer;

INSERT INTO [NexoSalud_Mart].[dbo].fact_atencion_customer
(KeyTiempo, KeyHora, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
 cita_evaluable, atencion_realizada, cita_inasistencia, tiempo_sillon_dental_minuto, atencion_finalizada_conforme)
SELECT 
    dt.KeyTiempo,
    MIN(dh.KeyHora) AS KeyHora,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dea.KeyEstadoAtencion, 1) AS KeyEstadoAtencion,
    cita_evaluable = COUNT(a.id_atencion),
    atencion_realizada = SUM(CASE WHEN a.asistencia = 'Asistió' THEN 1 ELSE 0 END),
    cita_inasistencia = SUM(CASE WHEN a.asistencia = 'No asistió' THEN 1 ELSE 0 END),
    tiempo_sillon_dental_minuto = SUM(ISNULL(DATEDIFF(mi, a.fecha_inicio, a.fecha_fin), 0)),
    atencion_finalizada_conforme = SUM(CASE WHEN a.estado_servicio = 'Realizado' THEN 1 ELSE 0 END)
FROM NexoSaludDB.dbo.Atenciones a
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(a.fecha_atencion AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Hora dh ON dh.id_hora = (DATEPART(HOUR, a.fecha_atencion) * 100 + DATEPART(MINUTE, a.fecha_atencion))
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = a.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = a.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = a.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_EstadoAtencion dea ON dea.EstadoFinal = a.estado_servicio AND dea.Asistencia = a.asistencia
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dea.KeyEstadoAtencion, 1);

-- 5. HECHO: SEGUIMIENTO TURNED
-- Grano PK: (KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal)
DELETE [NexoSalud_Mart].[dbo].fact_seguimiento_turned;

INSERT INTO [NexoSalud_Mart].[dbo].fact_seguimiento_turned
(KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyCanal,
 seguimiento_registrado, seguimiento_efectivo, incidencia_reportada, incidencia_resuelta_24_hora, retorno_cohorte_90_dia, paciente_elegible_retorno)
SELECT 
    dt.KeyTiempo,
    COALESCE(ds.KeySede, 1) AS KeySede,
    COALESCE(dserv.KeyServicio, 1) AS KeyServicio,
    COALESCE(dp.KeyProfesional, 1) AS KeyProfesional,
    COALESCE(dc.KeyCanal, 1) AS KeyCanal,
    seguimiento_registrado = COUNT(s.id_seguimiento),
    seguimiento_efectivo   = SUM(CASE WHEN s.satisfaccion IS NOT NULL OR s.resultado IS NOT NULL THEN 1 ELSE 0 END),
    incidencia_reportada   = SUM(CASE WHEN s.incidencia = 1 OR s.satisfaccion <= 2 THEN 1 ELSE 0 END),
    incidencia_resuelta_24_hora = SUM(CASE WHEN s.incidencia = 1 THEN 1 ELSE 0 END),
    retorno_cohorte_90_dia   = SUM(CASE WHEN ret90.tiene_retorno_90d = 1 THEN 1 ELSE 0 END),
    paciente_elegible_retorno = COUNT(DISTINCT s.id_persona)
FROM NexoSaludDB.dbo.Seguimientos s
LEFT JOIN NexoSaludDB.dbo.Atenciones a ON s.id_atencion = a.id_atencion
INNER JOIN [NexoSalud_Mart].[dbo].Dim_Tiempo dt ON dt.id_fecha = CAST(s.fecha_hora AS DATE)
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Sede ds ON ds.id_sede = a.id_sede
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Servicio dserv ON dserv.id_servicio = a.id_servicio
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Profesional dp ON dp.id_profesional = a.id_profesional
LEFT JOIN [NexoSalud_Mart].[dbo].Dim_Canal dc ON dc.NombreCanal = s.canal
OUTER APPLY (
    SELECT TOP 1 1 AS tiene_retorno_90d
    FROM NexoSaludDB.dbo.Atenciones a2 
    WHERE a2.id_persona = s.id_persona 
      AND a2.asistencia = 'Asistió'
      AND a2.fecha_atencion > a.fecha_atencion 
      AND a2.fecha_atencion <= DATEADD(DAY, 90, a.fecha_atencion)
) ret90
GROUP BY 
    dt.KeyTiempo, 
    COALESCE(ds.KeySede, 1), 
    COALESCE(dserv.KeyServicio, 1), 
    COALESCE(dp.KeyProfesional, 1), 
    COALESCE(dc.KeyCanal, 1);

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;
GO
