/* SOLO LECTURA de bases: validacion de SIM_BUYER_10K_V1.
   Esperado: 10000 / 8500 / 2550; B1=30%, B2=85%, B3=23.529411...
   No confundir con los totales globales que incluyen la cohorte original.
   Ejecutar sin backend ni otras escrituras durante la comprobacion.
*/
USE NexoSaludDB;
GO
SET NOCOUNT ON;
DROP TABLE IF EXISTS #Origen10k, #Mart10k, #Gasto10k, #Atribuido10k;

SELECT v.* INTO #Origen10k FROM dbo.v_DatosCaptacionBuyer v
JOIN dbo.Personas p ON p.id_persona=v.id_persona
WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid';
SELECT f.* INTO #Mart10k FROM NexoSalud_Mart.dbo.fact_captacion_buyer f
JOIN dbo.Personas p ON p.id_persona=f.id_persona
WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid';

-- 1. Conciliacion directa. Ambas filas deben ser 10000 / 8500 / 2550.
SELECT 'TRANSACCIONAL' AS origen,COUNT(*) AS registrados,
       SUM(contacto_utilizable) AS utilizables,
       SUM(CASE WHEN fecha_conversion IS NOT NULL THEN 1 ELSE 0 END) AS conversiones
FROM #Origen10k
UNION ALL
SELECT 'DIMENSIONAL',SUM(contacto_registrado),SUM(contacto_utilizable),SUM(conversion_lead)
FROM #Mart10k;

-- 2. Los tres indicadores se calculan; no se insertan como constantes.
SELECT MIN(fecha_captacion) AS primera_captacion,MAX(fecha_captacion) AS ultima_captacion,
       COUNT(*) AS buyers,COUNT(costo_atribuido_captacion) AS buyers_con_costo,
       SUM(CASE WHEN costo_atribuido_captacion IS NULL THEN 1 ELSE 0 END) AS costos_pendientes,
       SUM(costo_atribuido_captacion) AS costo_atribuido,
       SUM(conversion_lead) AS conversiones,
       100.0*SUM(CASE WHEN contacto_utilizable=1 AND conversion_lead=1
            AND fecha_conversion BETWEEN fecha_captacion AND DATEADD(DAY,14,fecha_captacion)
            THEN 1 ELSE 0 END)/NULLIF(SUM(contacto_utilizable),0) AS B1_porcentaje,
       100.0*SUM(contacto_utilizable)/NULLIF(SUM(contacto_registrado),0) AS B2_porcentaje,
       CASE WHEN COUNT(*)=COUNT(costo_atribuido_captacion)
            THEN SUM(costo_atribuido_captacion)/NULLIF(SUM(conversion_lead),0) END AS B3_soles,
       MIN(costo_atribuido_captacion) AS menor_costo_contacto,
       MAX(costo_atribuido_captacion) AS mayor_costo_contacto
FROM #Mart10k;

-- 3. Campana/mes: 60 filas, sin diferencias y sin costo NULL.
SELECT g.id_campana,YEAR(g.fecha)*100+MONTH(g.fecha) AS periodo,
       COUNT(*) AS gastos,SUM(g.importe) AS gasto
INTO #Gasto10k FROM dbo.GastosCampana g
JOIN dbo.Campanas c ON c.id_campana=g.id_campana
WHERE LEFT(c.nombre,17)='SIM_BUYER_10K_V1:'
GROUP BY g.id_campana,YEAR(g.fecha)*100+MONTH(g.fecha);
SELECT c.id_campana,YEAR(f.fecha_captacion)*100+MONTH(f.fecha_captacion) AS periodo,
       COUNT(*) AS contactos,COUNT(f.costo_atribuido_captacion) AS con_costo,
       SUM(f.costo_atribuido_captacion) AS atribuido
INTO #Atribuido10k FROM #Mart10k f
JOIN NexoSalud_Mart.dbo.Dim_Fuente c ON c.KeyFuente=f.KeyFuente
GROUP BY c.id_campana,YEAR(f.fecha_captacion)*100+MONTH(f.fecha_captacion);
SELECT COALESCE(g.id_campana,a.id_campana) AS id_campana,
       COALESCE(g.periodo,a.periodo) AS periodo,a.contactos,
       g.gasto,a.atribuido,g.gasto-a.atribuido AS diferencia
FROM #Gasto10k g FULL JOIN #Atribuido10k a
 ON a.id_campana=g.id_campana AND a.periodo=g.periodo
ORDER BY id_campana,periodo;

-- 4. Segundo hecho: 60 gastos y S/60000 en ambos origenes.
SELECT 'TRANSACCIONAL' AS origen,COUNT(*) AS gastos,SUM(g.importe) AS importe
FROM dbo.GastosCampana g JOIN dbo.Campanas c ON c.id_campana=g.id_campana
WHERE LEFT(c.nombre,17)='SIM_BUYER_10K_V1:'
UNION ALL
SELECT 'DIMENSIONAL',COUNT(*),SUM(f.monto_inversion)
FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer f
JOIN NexoSalud_Mart.dbo.Dim_Fuente c ON c.KeyFuente=f.KeyFuente
WHERE LEFT(c.Campana,17)='SIM_BUYER_10K_V1:';

-- 5. Contexto declarado e interacciones: mas mensajes no multiplican contactos.
SELECT s.Sede,sv.ServicioOdontologico,COUNT(*) AS buyers,
       SUM(f.conversion_lead) AS conversiones,SUM(f.costo_atribuido_captacion) AS costo
FROM #Mart10k f
JOIN NexoSalud_Mart.dbo.Dim_Sede s ON s.KeySede=f.KeySede
JOIN NexoSalud_Mart.dbo.Dim_Servicio sv ON sv.KeyServicio=f.KeyServicio
GROUP BY s.Sede,sv.ServicioOdontologico ORDER BY s.Sede,sv.ServicioOdontologico;
SELECT COUNT(*) AS interacciones,COUNT(DISTINCT i.id_persona) AS buyers_con_interacciones
FROM dbo.Interacciones i JOIN #Origen10k v ON v.id_persona=i.id_persona;

-- Aserciones: errores reales detienen la validacion; no basta "consulta ejecutada".
IF (SELECT COUNT(*) FROM #Origen10k)<>10000 OR (SELECT COUNT(*) FROM #Mart10k)<>10000
   OR (SELECT SUM(contacto_registrado) FROM #Mart10k)<>10000
   OR (SELECT SUM(contacto_utilizable) FROM #Mart10k)<>8500
   OR (SELECT SUM(conversion_lead) FROM #Mart10k)<>2550
    THROW 51620,'Totales distintos del escenario 10k.',1;
IF EXISTS (
    SELECT v.id_persona FROM #Origen10k v FULL JOIN #Mart10k f ON f.id_persona=v.id_persona
    WHERE v.id_persona IS NULL OR f.id_persona IS NULL
       OR v.id_captacion<>f.id_captacion OR v.contacto_utilizable<>f.contacto_utilizable
       OR v.fecha_captacion<>f.fecha_captacion
       OR COALESCE(v.id_evento_conversion,-1)<>COALESCE(f.id_evento_conversion,-1)
       OR COALESCE(v.fecha_conversion,CAST('19000101' AS DATETIME2))
          <>COALESCE(f.fecha_conversion,CAST('19000101' AS DATETIME2))
       OR f.conversion_lead<>CASE WHEN v.fecha_conversion IS NOT NULL THEN 1 ELSE 0 END
) THROW 51621,'Hay diferencias por persona entre OLTP y Mart.',1;
IF EXISTS (SELECT 1 FROM #Mart10k WHERE costo_atribuido_captacion IS NULL
            OR costo_atribuido_captacion<0 OR DATEADD(DAY,14,fecha_captacion)>fecha_corte_etl
            OR (conversion_lead=1 AND (contacto_utilizable<>1 OR fecha_conversion IS NULL
                OR fecha_conversion<fecha_captacion OR fecha_conversion>DATEADD(DAY,14,fecha_captacion))))
   OR (SELECT SUM(costo_atribuido_captacion) FROM #Mart10k)<>60000
    THROW 51622,'Costo incompleto, ventana inmadura o conversion fuera de regla.',1;
IF (SELECT COUNT(*) FROM #Gasto10k)<>60 OR (SELECT SUM(gastos) FROM #Gasto10k)<>60
   OR (SELECT SUM(gasto) FROM #Gasto10k)<>60000
   OR EXISTS (SELECT 1 FROM #Gasto10k g FULL JOIN #Atribuido10k a
       ON a.id_campana=g.id_campana AND a.periodo=g.periodo
       WHERE g.id_campana IS NULL OR a.id_campana IS NULL
          OR a.con_costo<>a.contactos OR g.gasto<>a.atribuido)
    THROW 51623,'La conciliacion de gastos por campana/mes no cuadra.',1;
IF EXISTS (
    SELECT g.id_gasto FROM dbo.GastosCampana g
    JOIN dbo.Campanas c ON c.id_campana=g.id_campana
    FULL JOIN (SELECT f.*,df.id_campana AS origen_campana FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer f
        JOIN NexoSalud_Mart.dbo.Dim_Fuente df ON df.KeyFuente=f.KeyFuente
        WHERE LEFT(df.Campana,17)='SIM_BUYER_10K_V1:') f ON f.id_gasto=g.id_gasto
    WHERE (LEFT(c.nombre,17)='SIM_BUYER_10K_V1:' OR f.id_gasto IS NOT NULL)
      AND (g.id_gasto IS NULL OR f.id_gasto IS NULL OR g.importe<>f.monto_inversion
           OR g.fecha<>f.fecha_gasto OR g.id_campana<>f.origen_campana)
) THROW 51624,'Gastos distintos entre origen y segundo hecho.',1;
IF (SELECT COUNT(*) FROM dbo.EventosEtapa e JOIN #Origen10k v
        ON v.id_evento_conversion=e.id_evento_etapa
        JOIN dbo.Solicitudes s ON s.id_solicitud=e.id_solicitud
        WHERE e.id_captacion=v.id_captacion AND s.id_persona=v.id_persona
          AND s.fecha_solicitud=e.fecha_hora)<>2550
    THROW 51625,'Faltan solicitudes/eventos enlazados de las conversiones.',1;
IF (SELECT COUNT(*) FROM dbo.Interacciones i JOIN #Origen10k v ON v.id_persona=i.id_persona)<>20000
   OR (SELECT COUNT(DISTINCT i.id_persona) FROM dbo.Interacciones i
       JOIN #Origen10k v ON v.id_persona=i.id_persona)<>10000
    THROW 51626,'Interacciones distintas del escenario inicial V1.',1;
PRINT 'OK: 10k, B1/B2/B3, eventos, costos por campana/mes y ambos hechos conciliados.';
GO
