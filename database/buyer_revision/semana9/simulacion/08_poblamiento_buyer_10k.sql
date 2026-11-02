/* SIMULACION OPCIONAL: 10 000 buyers ADICIONALES. Solo copia local de pruebas.
   No borra datos ni sustituye 01_catalogos.sql. Ver docs/POBLAMIENTO_BUYER_10K.md.
   Escenario versionado SIM_BUYER_10K_V1: 8 500 utilizables, 2 550 LEAD,
   60 gastos por S/60 000. Importes de simulacion, nunca defaults del hecho.
   Las conversiones historicas se cargan por conjuntos con solicitud + evento;
   no son una prueba del procedimiento operativo ni de rendimiento concurrente.
*/
USE NexoSaludDB;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

DROP TABLE IF EXISTS #Plantillas, #Campanas, #Sedes, #Servicios, #Datos, #Solicitudes;

DECLARE @Marca VARCHAR(30)='SIM_BUYER_10K_V1',
        @Cantidad INT=10000,@Utilizables INT=8500,@Conversiones INT=2550,
        @Presupuesto DECIMAL(10,2)=60000.00,
        @Inicio DATE,@Fin DATE,@Buyer INT,@Lead INT,@Bloqueo INT,@Existentes INT;
-- Estos parametros definen V1. Cambiar el escenario exige otra version/marca
-- y revisar tambien la validacion; no reajusta una cohorte ya cargada.
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC @Bloqueo=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
        @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @Bloqueo<0 THROW 51600,'Otro ETL activo. Detener backend y reintentar.',1;
    IF OBJECT_ID('dbo.usp_SincronizarCaptacionBuyer','P') IS NULL
       OR OBJECT_ID('NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer','P') IS NULL
        THROW 51601,'Instalar primero bloque 1 del ETL y script 06 de inversion.',1;
    SELECT @Buyer=id_etapa FROM dbo.Etapas WHERE nombre='BUYER';
    SELECT @Lead=id_etapa FROM dbo.Etapas WHERE nombre='LEAD';
    IF @Buyer IS NULL OR @Lead IS NULL
        THROW 51602,'Faltan etapas BUYER/LEAD. Revisar catalogos.',1;
    IF (SELECT COUNT(*) FROM dbo.Sedes WHERE activo=1)<3
       OR NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE activo=1)
        THROW 51603,'Se necesitan al menos tres sedes y un servicio activos.',1;

    SELECT @Existentes=COUNT(*) FROM dbo.Personas
    WHERE RIGHT(email,25)='@sim-buyer-10k-v1.invalid';
    IF @Existentes NOT IN (0,@Cantidad)
        THROW 51604,'Cohorte parcial o modificada. Revisar; no se borra automaticamente.',1;

    IF @Existentes=0
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Campanas WHERE LEFT(nombre,LEN(@Marca))=@Marca)
            THROW 51605,'Hay campanas de V1 sin su cohorte completa. Revisar copia de pruebas.',1;
        -- Doce meses completos anteriores al mes de hoy menos 14 dias.
        -- Incluso el ultimo contacto tiene la ventana de conversion completa.
        SET @Fin=DATEFROMPARTS(YEAR(DATEADD(DAY,-14,SYSDATETIME())),
                              MONTH(DATEADD(DAY,-14,SYSDATETIME())),1);
        SET @Inicio=DATEADD(MONTH,-12,@Fin);

        -- Plantillas del catalogo: no se presuponen IDs 1..5 ni IDs de sede/servicio.
        SELECT TOP (5) ROW_NUMBER() OVER (ORDER BY c.id_campana) AS orden,
               c.id_fuente,c.id_canal,c.nombre
        INTO #Plantillas
        FROM dbo.Campanas c
        JOIN dbo.Fuentes f ON f.id_fuente=c.id_fuente AND f.activo=1
        JOIN dbo.Canales ca ON ca.id_canal=c.id_canal AND ca.activo=1
        WHERE c.activo=1 AND LEFT(c.nombre,4)<>'SIM_'
        ORDER BY c.id_campana;
        IF (SELECT COUNT(*) FROM #Plantillas)<>5
            THROW 51606,'Se necesitan cinco campanas con fuente/canal activos (01_catalogos).',1;
        INSERT dbo.Campanas
            (nombre,descripcion,id_fuente,id_canal,fecha_inicio,fecha_fin,activo)
        SELECT @Marca+':'+CAST(orden AS VARCHAR(2))+' '+LEFT(nombre,100),
               'SIMULADO. Incluye pauta o gestion organica; no es gasto real.',
               id_fuente,id_canal,@Inicio,DATEADD(DAY,-1,@Fin),1
        FROM #Plantillas;

        SELECT CONVERT(INT,p.orden) AS orden,c.id_campana,c.id_fuente,c.id_canal
        INTO #Campanas
        FROM #Plantillas p JOIN dbo.Campanas c
          ON c.nombre=@Marca+':'+CAST(p.orden AS VARCHAR(2))+' '+LEFT(p.nombre,100);
        SELECT ROW_NUMBER() OVER (ORDER BY id_sede) AS orden,id_sede
        INTO #Sedes FROM dbo.Sedes WHERE activo=1;
        SELECT ROW_NUMBER() OVER (ORDER BY id_servicio) AS orden,id_servicio
        INTO #Servicios FROM dbo.Servicios WHERE activo=1;
        DECLARE @Servicios INT=(SELECT COUNT(*) FROM #Servicios);

        -- SELECT de preparacion: secuencia determinista sin RAND ni tablas del sistema.
        ;WITH Digitos AS (
            SELECT n FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(n)
        ), Numeros AS (
            SELECT 1+a.n+10*b.n+100*c.n+1000*d.n AS n
            FROM Digitos a CROSS JOIN Digitos b CROSS JOIN Digitos c CROSS JOIN Digitos d
        ), Distribucion AS (
            SELECT n,((n*7919)%10000)+1 AS rango,
                   (n-1)%12 AS mes,((n-1)/12)%100 AS segmento
            FROM Numeros WHERE n<=@Cantidad
        )
        SELECT d.n,d.rango,
               CAST('buyer'+RIGHT('00000'+CAST(d.n AS VARCHAR(5)),5)
                    +'@sim-buyer-10k-v1.invalid' AS VARCHAR(100)) AS email,
               DATEADD(MINUTE,480+(d.n*17)%600,
                   CAST(DATEADD(DAY,((d.n-1)/144)%28,
                       DATEADD(MONTH,d.mes,@Inicio)) AS DATETIME2)) AS fecha,
               ca.id_campana,ca.id_fuente,ca.id_canal,
               CASE WHEN d.rango>9500 THEN NULL ELSE se.id_sede END AS id_sede,
               CASE WHEN d.rango>9000 THEN NULL ELSE sv.id_servicio END AS id_servicio,
               CASE WHEN d.rango<=@Utilizables THEN 1 ELSE 0 END AS utilizable,
               CASE WHEN d.rango<=@Conversiones THEN 1 ELSE 0 END AS convertir
        INTO #Datos
        FROM Distribucion d
        JOIN #Campanas ca ON ca.orden=CASE WHEN d.segmento<40 THEN 1
            WHEN d.segmento<65 THEN 2 WHEN d.segmento<80 THEN 3
            WHEN d.segmento<92 THEN 4 ELSE 5 END
        JOIN #Sedes se ON se.orden=1+(d.n/5)%3
        JOIN #Servicios sv ON sv.orden=1+(d.n/7)%@Servicios;

        INSERT dbo.Personas
            (nombres,apellidos,email,numero,fecha_nacimiento,zona,tipo_persona,
             autoriza_contacto,fecha_autorizacion,estado_calidad,
             id_campana_origen,id_canal_origen,id_etapa_actual,fecha_registro)
        SELECT 'SimBuyer '+CAST(n AS VARCHAR(10)),'Prueba V1',email,
               NULL,DATEADD(YEAR,-(18+n%53),CAST(fecha AS DATE)),
               CASE n%3 WHEN 0 THEN 'Trujillo' WHEN 1 THEN 'Victor Larco' ELSE 'Huanchaco' END,
               'Adulto General',utilizable,CASE WHEN utilizable=1 THEN fecha END,
               CASE WHEN utilizable=1 THEN 'Valido' ELSE 'Incompleto' END,
               id_campana,id_canal,@Buyer,fecha
        FROM #Datos;
        -- Email .invalid identifica la simulacion y no es un destinatario real.
        INSERT dbo.CaptacionesBuyer
            (id_persona,fecha_captacion,id_canal,id_fuente,id_campana,id_sede,id_servicio,
             motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos)
        SELECT p.id_persona,d.fecha,d.id_canal,d.id_fuente,d.id_campana,d.id_sede,d.id_servicio,
               N'SIM_BUYER_10K_V1: consulta odontologica sintetica',
               p.estado_calidad,p.autoriza_contacto,p.fecha_autorizacion,'REGISTRO_DIRECTO'
        FROM #Datos d JOIN dbo.Personas p ON p.email=d.email;

        -- Una a tres interacciones posteriores a la captacion; no duplican buyers.
        INSERT dbo.Interacciones
            (id_persona,id_canal,id_fuente,fecha_hora,tipo,mensaje,es_respuesta_util,resultado)
        SELECT p.id_persona,d.id_canal,d.id_fuente,DATEADD(MINUTE,5*j.n,d.fecha),
               CASE WHEN j.n=2 THEN 'Mensaje Saliente' ELSE 'Mensaje Entrante' END,
               'SIM_BUYER_10K_V1: interaccion sintetica',
               CASE WHEN j.n=2 AND d.utilizable=1 THEN 1 ELSE 0 END,'Simulado'
        FROM #Datos d JOIN dbo.Personas p ON p.email=d.email
        CROSS JOIN (VALUES(1),(2),(3)) j(n)
        WHERE j.n<=1+(d.n%3);

        -- Carga HISTORICA masiva, no operacion en vivo. El SP operativo usa la hora
        -- actual y no recibe fecha: por eso no se alteran sus reglas para simular.
        CREATE TABLE #Solicitudes (id_solicitud INT,id_persona INT);
        INSERT dbo.Solicitudes (id_persona,id_servicio,motivo,estado,fecha_solicitud)
        OUTPUT inserted.id_solicitud,inserted.id_persona INTO #Solicitudes
        SELECT p.id_persona,d.id_servicio,'SIM_BUYER_10K_V1: intencion concreta',
               'Abierta',DATEADD(MINUTE,d.n%60,DATEADD(DAY,1+d.n%13,d.fecha))
        FROM #Datos d JOIN dbo.Personas p ON p.email=d.email WHERE d.convertir=1;
        INSERT dbo.EventosEtapa
            (id_persona,etapa_origen,etapa_destino,fecha_hora,motivo,evidencia,
             id_captacion,id_solicitud,clave_operacion_buyer)
        SELECT s.id_persona,@Buyer,@Lead,so.fecha_solicitud,
               'SIM_BUYER_10K_V1: conversion historica simulada',
               'SIMULADO: solicitud y evento enlazados; no es operacion real.',
               c.id_captacion,s.id_solicitud,'BUYER_LEAD:'+CAST(c.id_captacion AS VARCHAR(20))
        FROM #Solicitudes s JOIN dbo.Solicitudes so ON so.id_solicitud=s.id_solicitud
        JOIN dbo.CaptacionesBuyer c ON c.id_persona=s.id_persona;
        UPDATE p SET id_etapa_actual=@Lead,fecha_actualizacion=s.fecha_solicitud
        FROM dbo.Personas p JOIN #Solicitudes t ON t.id_persona=p.id_persona
        JOIN dbo.Solicitudes s ON s.id_solicitud=t.id_solicitud;

        -- 12 meses x 5 campanas. Pesos mensuales suman 100; pesos de campana 100.
        -- Cada gasto es evidencia SINTETICA explicita, incluso gestion de organicos.
        INSERT dbo.GastosCampana (id_campana,fecha,importe,descripcion)
        SELECT c.id_campana,DATEADD(MONTH,m.mes,@Inicio),
               CAST(@Presupuesto*m.peso*pc.peso/10000.0 AS DECIMAL(10,2)),
               'SIM_BUYER_10K_V1: gasto simulado de captacion / gestion de canal'
        FROM #Campanas c
        JOIN (VALUES(1,42),(2,28),(3,16),(4,9),(5,5)) pc(orden,peso) ON pc.orden=c.orden
        CROSS JOIN (VALUES(0,8),(1,7),(2,8),(3,7),(4,8),(5,9),
                          (6,8),(7,8),(8,9),(9,9),(10,9),(11,10)) m(mes,peso);
    END;

    -- En reejecucion no se agrega ni borra: validar lo que persiste y recargar ETL.
    IF (SELECT COUNT(*) FROM dbo.Personas WHERE RIGHT(email,25)='@sim-buyer-10k-v1.invalid')<>@Cantidad
       OR (SELECT COUNT(*) FROM dbo.Campanas WHERE LEFT(nombre,LEN(@Marca))=@Marca)<>5
        THROW 51607,'Cantidad de personas/campanas distinta del escenario V1.',1;
    IF (SELECT COUNT(*) FROM dbo.GastosCampana WHERE LEFT(descripcion,LEN(@Marca))=@Marca)<>60
       OR (SELECT COALESCE(SUM(importe),0) FROM dbo.GastosCampana
           WHERE LEFT(descripcion,LEN(@Marca))=@Marca)<>@Presupuesto
        THROW 51608,'Gastos incompletos o modificados; revisar antes de continuar.',1;
    IF (SELECT COUNT(*) FROM dbo.v_DatosCaptacionBuyer v JOIN dbo.Personas p
        ON p.id_persona=v.id_persona WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid')<>@Cantidad
       OR (SELECT SUM(v.contacto_utilizable) FROM dbo.v_DatosCaptacionBuyer v JOIN dbo.Personas p
        ON p.id_persona=v.id_persona WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid')<>@Utilizables
       OR (SELECT COUNT(*) FROM dbo.v_DatosCaptacionBuyer v JOIN dbo.Personas p
        ON p.id_persona=v.id_persona WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid'
          AND v.fecha_conversion BETWEEN v.fecha_captacion AND DATEADD(DAY,14,v.fecha_captacion))<>@Conversiones
        THROW 51609,'La cohorte fue modificada o faltan captaciones/eventos de conversion.',1;

    -- Reutilizar ETL canonico. La transaccion exterior incluye origen y ambos hechos.
    EXEC dbo.usp_SincronizarCaptacionBuyer;
    EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
    IF (SELECT COUNT(*) FROM NexoSalud_Mart.dbo.fact_captacion_buyer f
        JOIN dbo.Personas p ON p.id_persona=f.id_persona
        WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid'
          AND f.costo_atribuido_captacion IS NOT NULL)<>@Cantidad
       OR (SELECT SUM(f.costo_atribuido_captacion) FROM NexoSalud_Mart.dbo.fact_captacion_buyer f
        JOIN dbo.Personas p ON p.id_persona=f.id_persona
        WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid')<>@Presupuesto
        THROW 51610,'Atribucion incompleta o importe distinto de S/60000. Se revierte la carga.',1;
    COMMIT TRANSACTION;
    PRINT 'OK: cohorte V1 cargada/sin duplicados. Ejecutar 09_validacion_buyer_10k.sql.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
