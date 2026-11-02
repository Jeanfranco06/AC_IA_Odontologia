-- BLOQUE 1: CONFIABILIDAD DE INVERSION BUYER.
-- Requiere las bases revisadas y el ETL base de Semana 9.
-- No inserta gastos simulados. Los ejemplos estan en pruebas/06_datos_inversion_simulados.sql.
-- Grano: una fila por id_gasto de GastosCampana, incluso sin contactos.
USE NexoSalud_Mart;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.fact_inversion_campana_buyer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.fact_inversion_campana_buyer (
        id_gasto INT NOT NULL CONSTRAINT PK_FactInversionCampana PRIMARY KEY,
        KeyTiempo INT NOT NULL CONSTRAINT FK_FactInversion_Tiempo REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        KeyFuente INT NOT NULL CONSTRAINT FK_FactInversion_Fuente REFERENCES dbo.Dim_Fuente(KeyFuente),
        KeyCanal INT NOT NULL CONSTRAINT FK_FactInversion_Canal REFERENCES dbo.Dim_Canal(KeyCanal),
        monto_inversion DECIMAL(14,2) NOT NULL CONSTRAINT CK_FactInversion_MontoPositivo CHECK (monto_inversion >= 0),
        impresiones INT NULL,
        clics INT NULL,
        fecha_gasto DATE NOT NULL,
        descripcion_gasto NVARCHAR(255) NULL,
        origen_datos VARCHAR(30) NOT NULL CONSTRAINT DF_FactInversion_Origen DEFAULT 'OLTP_GASTOS_CAMPANA',
        fecha_corte_etl DATETIME2 NOT NULL CONSTRAINT DF_FactInversion_ETL DEFAULT SYSDATETIME()
    );
END;
GO

-- Actualizacion compatible con tablas ya creadas por el commit 281537d.
-- Retirar DEFAULT 0: la fuente actual no registra impresiones ni clics.
DECLARE @ddl NVARCHAR(MAX) = N'';
SELECT @ddl = @ddl + N'ALTER TABLE dbo.fact_inversion_campana_buyer DROP CONSTRAINT '
    + QUOTENAME(d.name) + N';'
FROM sys.default_constraints d
JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
WHERE d.parent_object_id=OBJECT_ID('dbo.fact_inversion_campana_buyer')
  AND c.name IN ('impresiones','clics');
IF @ddl<>N'' EXEC sys.sp_executesql @ddl;
GO

-- Unica implementacion: SSMS y backend invocan este mismo procedimiento.
CREATE OR ALTER PROCEDURE dbo.usp_SincronizarInversionCampanaBuyer
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @bloqueo INT, @corte DATETIME2=SYSDATETIME();
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Mismo bloqueo que el ETL base: ambos preparan dimensiones compartidas.
        EXEC @bloqueo=NexoSaludDB.sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
            @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000;
        IF @bloqueo<0 THROW 51500,'Otro ETL Buyer esta en ejecucion.',1;

        SELECT g.id_gasto,g.id_campana,g.fecha,g.importe,g.descripcion,
               c.id_campana AS campana_verificada,c.id_fuente,c.id_canal,
               c.nombre AS Campana,f.nombre AS TipoOrigen
        INTO #GastosOrigen
        FROM NexoSaludDB.dbo.GastosCampana g
        LEFT JOIN NexoSaludDB.dbo.Campanas c ON c.id_campana=g.id_campana
        LEFT JOIN NexoSaludDB.dbo.Fuentes f ON f.id_fuente=c.id_fuente;
        CREATE UNIQUE INDEX UQ_GastosOrigen ON #GastosOrigen(id_gasto);
        IF EXISTS (SELECT 1 FROM #GastosOrigen WHERE campana_verificada IS NULL)
            THROW 51501,'Hay gastos sin campana de origen verificable.',1;

        IF EXISTS (SELECT id_fecha FROM dbo.Dim_Tiempo GROUP BY id_fecha HAVING COUNT(*)>1)
            THROW 51502,'Dim_Tiempo tiene fechas duplicadas.',1;
        IF EXISTS (SELECT id_fuente,id_campana FROM dbo.Dim_Fuente
                   GROUP BY id_fuente,id_campana HAVING COUNT(*)>1)
            THROW 51503,'Dim_Fuente tiene combinaciones duplicadas.',1;
        IF EXISTS (SELECT id_canal FROM dbo.Dim_Canal WHERE id_canal IS NOT NULL
                   GROUP BY id_canal HAVING COUNT(*)>1)
            THROW 51504,'Dim_Canal tiene identificadores duplicados.',1;

        MERGE dbo.Dim_Tiempo AS dim
        USING (SELECT DISTINCT fecha FROM #GastosOrigen) AS src
        ON dim.id_fecha=src.fecha
        WHEN NOT MATCHED THEN INSERT (KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
            VALUES (YEAR(src.fecha)*10000+MONTH(src.fecha)*100+DAY(src.fecha),src.fecha,
                    YEAR(src.fecha),DATEPART(QUARTER,src.fecha),MONTH(src.fecha),DAY(src.fecha));

        MERGE dbo.Dim_Fuente AS dim
        USING (SELECT DISTINCT id_fuente,id_campana,Campana,
                   COALESCE(TipoOrigen,'No especificada') AS TipoOrigen FROM #GastosOrigen) AS src
        ON ISNULL(dim.id_fuente,0)=ISNULL(src.id_fuente,0) AND dim.id_campana=src.id_campana
        WHEN MATCHED THEN UPDATE SET dim.TipoOrigen=src.TipoOrigen,dim.Campana=src.Campana
        WHEN NOT MATCHED THEN INSERT (id_fuente,id_campana,TipoOrigen,Campana)
            VALUES (src.id_fuente,src.id_campana,src.TipoOrigen,src.Campana);

        MERGE dbo.Dim_Canal AS dim
        USING (SELECT c.id_canal,c.nombre AS NombreCanal,
                   CASE WHEN c.nombre LIKE '%WhatsApp%' OR c.nombre IN
                       ('Web','Página Web','Formulario Web','Facebook','Instagram','Correo Electrónico') THEN 'Digital'
                        WHEN c.nombre LIKE '%Llamada%' THEN 'Telefónico' ELSE 'No clasificado' END AS TipoMedio
               FROM NexoSaludDB.dbo.Canales c
               WHERE EXISTS (SELECT 1 FROM #GastosOrigen g WHERE g.id_canal=c.id_canal)) AS src
        ON dim.id_canal=src.id_canal
        WHEN MATCHED THEN UPDATE SET dim.NombreCanal=src.NombreCanal,dim.TipoMedio=src.TipoMedio
        WHEN NOT MATCHED THEN INSERT (id_canal,NombreCanal,TipoMedio)
            VALUES (src.id_canal,src.NombreCanal,src.TipoMedio);

        SELECT g.id_gasto,dt.KeyTiempo,df.KeyFuente,dc.KeyCanal,
               g.importe,g.fecha,g.descripcion
        INTO #GastosCarga
        FROM #GastosOrigen g
        LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha=g.fecha
        LEFT JOIN dbo.Dim_Fuente df ON ISNULL(df.id_fuente,0)=ISNULL(g.id_fuente,0)
                                  AND df.id_campana=g.id_campana
        LEFT JOIN dbo.Dim_Canal dc ON dc.id_canal=ISNULL(g.id_canal,0);
        IF (SELECT COUNT_BIG(*) FROM #GastosCarga)<>(SELECT COUNT_BIG(*) FROM #GastosOrigen)
            THROW 51505,'Se perdieron o multiplicaron gastos al resolver dimensiones.',1;
        IF EXISTS (SELECT 1 FROM #GastosCarga WHERE KeyTiempo IS NULL OR KeyFuente IS NULL OR KeyCanal IS NULL)
            THROW 51506,'Dimension sin resolver. Ejecutar primero el ETL base de Semana 9.',1;
        CREATE UNIQUE INDEX UQ_GastosCarga ON #GastosCarga(id_gasto);

        MERGE dbo.fact_inversion_campana_buyer AS tgt
        USING #GastosCarga AS src ON tgt.id_gasto=src.id_gasto
        WHEN MATCHED THEN UPDATE SET
            tgt.KeyTiempo=src.KeyTiempo,tgt.KeyFuente=src.KeyFuente,tgt.KeyCanal=src.KeyCanal,
            tgt.monto_inversion=src.importe,tgt.impresiones=NULL,tgt.clics=NULL,
            tgt.fecha_gasto=src.fecha,tgt.descripcion_gasto=LEFT(src.descripcion,255),
            tgt.origen_datos='OLTP_GASTOS_CAMPANA',tgt.fecha_corte_etl=@corte
        WHEN NOT MATCHED THEN INSERT
            (id_gasto,KeyTiempo,KeyFuente,KeyCanal,monto_inversion,impresiones,clics,
             fecha_gasto,descripcion_gasto,origen_datos,fecha_corte_etl)
            VALUES (src.id_gasto,src.KeyTiempo,src.KeyFuente,src.KeyCanal,src.importe,NULL,NULL,
                    src.fecha,LEFT(src.descripcion,255),'OLTP_GASTOS_CAMPANA',@corte)
        -- Es un espejo completo del origen: un gasto eliminado deja de contarse en el Mart.
        WHEN NOT MATCHED BY SOURCE THEN DELETE;

        IF (SELECT COUNT_BIG(*) FROM dbo.fact_inversion_campana_buyer)<>
           (SELECT COUNT_BIG(*) FROM #GastosOrigen)
            THROW 51507,'No concilia la cantidad de gastos.',1;
        IF COALESCE((SELECT SUM(monto_inversion) FROM dbo.fact_inversion_campana_buyer),0)<>
           COALESCE((SELECT SUM(CAST(importe AS DECIMAL(14,2))) FROM #GastosOrigen),0)
            THROW 51508,'No concilia el importe de inversion.',1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
EXEC dbo.usp_SincronizarInversionCampanaBuyer;
GO

-- Conciliacion: ambas diferencias deben ser cero, incluso con origen vacio.
SELECT o.gastos AS gastos_oltp,d.gastos AS gastos_mart,d.gastos-o.gastos AS diferencia_registros,
       o.importe AS importe_oltp,d.importe AS importe_mart,d.importe-o.importe AS diferencia_importe
FROM (SELECT COUNT_BIG(*) AS gastos,COALESCE(SUM(CAST(importe AS DECIMAL(14,2))),0) AS importe
      FROM NexoSaludDB.dbo.GastosCampana) o
CROSS JOIN (SELECT COUNT_BIG(*) AS gastos,COALESCE(SUM(monto_inversion),0) AS importe
            FROM dbo.fact_inversion_campana_buyer) d;
GO

-- Las consultas siguientes conservan el CPL anterior. Se revisara en el bloque 2.
-- 4. CONSULTAS DE VALIDACIÓN Y REPORTES DE GESTIÓN

-- Consulta 4.1: Validación de registros cargados en la 2da tabla de hechos
SELECT 
    fi.id_gasto,
    t.id_fecha AS fecha,
    f.TipoOrigen AS origen,
    f.Campana AS campana,
    c.NombreCanal AS canal,
    fi.monto_inversion
FROM [NexoSalud_Mart].dbo.fact_inversion_campana_buyer fi
JOIN [NexoSalud_Mart].dbo.Dim_Tiempo t ON t.KeyTiempo = fi.KeyTiempo
JOIN [NexoSalud_Mart].dbo.Dim_Fuente f ON f.KeyFuente = fi.KeyFuente
JOIN [NexoSalud_Mart].dbo.Dim_Canal c ON c.KeyCanal = fi.KeyCanal
ORDER BY fi.fecha_gasto DESC;

-- Consulta 4.2: CÁLCULO FORMAL DEL INDICADOR B3 (Costo por LEAD Atribuible)
-- Cruzando las dos tablas de hechos mediante las dimensiones conformadas Dim_Fuente y Dim_Canal
;WITH InversionPorCampana AS (
    SELECT 
        KeyFuente,
        KeyCanal,
        SUM(monto_inversion) AS total_inversion
    FROM [NexoSalud_Mart].dbo.fact_inversion_campana_buyer
    GROUP BY KeyFuente, KeyCanal
),
LeadsPorCampana AS (
    SELECT 
        KeyFuente,
        KeyCanal,
        SUM(contacto_registrado) AS total_contactos,
        SUM(conversion_lead) AS total_leads
    FROM [NexoSalud_Mart].dbo.fact_captacion_buyer
    GROUP BY KeyFuente, KeyCanal
)
SELECT 
    f.TipoOrigen AS origen,
    f.Campana AS campana,
    c.NombreCanal AS canal,
    ISNULL(inv.total_inversion, 0.00) AS inversion_soles,
    ISNULL(l.total_contactos, 0) AS contactos_captados,
    ISNULL(l.total_leads, 0) AS leads_generados,
    CASE 
        WHEN ISNULL(l.total_leads, 0) > 0 
        THEN ROUND(inv.total_inversion / l.total_leads, 2)
        ELSE NULL 
    END AS costo_por_lead_cpl
FROM InversionPorCampana inv
FULL OUTER JOIN LeadsPorCampana l ON l.KeyFuente = inv.KeyFuente AND l.KeyCanal = inv.KeyCanal
JOIN [NexoSalud_Mart].dbo.Dim_Fuente f ON f.KeyFuente = COALESCE(inv.KeyFuente, l.KeyFuente)
JOIN [NexoSalud_Mart].dbo.Dim_Canal c ON c.KeyCanal = COALESCE(inv.KeyCanal, l.KeyCanal)
WHERE COALESCE(inv.KeyFuente, l.KeyFuente) > 0
ORDER BY inversion_soles DESC;

-- Consulta 4.3: MATRIZ EJECUTIVA DEL REPORTE 2 (Campaña x Canal)
-- Filas: Campaña agrupada por TipoOrigen | Columnas: Canal | Celdas: Inversión en S/.
SELECT 
    f.TipoOrigen AS categoria,
    f.Campana AS item,
    c.NombreCanal AS canal,
    SUM(fi.monto_inversion) AS inversion_soles
FROM [NexoSalud_Mart].dbo.fact_inversion_campana_buyer fi
JOIN [NexoSalud_Mart].dbo.Dim_Fuente f ON f.KeyFuente = fi.KeyFuente
JOIN [NexoSalud_Mart].dbo.Dim_Canal c ON c.KeyCanal = fi.KeyCanal
GROUP BY f.TipoOrigen, f.Campana, c.NombreCanal
ORDER BY f.TipoOrigen, f.Campana;
GO

