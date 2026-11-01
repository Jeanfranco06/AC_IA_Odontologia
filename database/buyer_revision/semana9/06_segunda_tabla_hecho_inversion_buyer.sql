-- ====================================================================
-- SEGUNDA TABLA DE HECHOS BUYER: fact_inversion_campana_buyer
-- Proyecto: NexoSalud - Fase BUYER (Metodología Dr. Ricardo Mendoza Rivera)
-- Autor: Germain (Integrante 1 - BI & Data Warehouse)
-- ====================================================================
-- JUSTIFICACIÓN METODOLÓGICA:
-- Conforme al "Cuadro de Medidas y Dimensiones", el indicador B3 (Costo por LEAD)
-- combina medidas con distinto grano y origen documental:
-- 1) fact_captacion_buyer: Grano = 1 contacto individual (Origen: Formulario/Personas)
-- 2) fact_inversion_campana_buyer: Grano = 1 gasto por fecha y campaña (Origen: GastosCampana)
-- Forzar el gasto publicitario en la tabla de captación obliga a prorrateos artificiales.
-- La constelación de hechos resuelve limpiamente la aditividad de Kimball.
-- ====================================================================

-- 1. ASEGURAR ESTRUCTURA EN NexoSaludDB (OLTP)
USE NexoSaludDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- Semilla de gastos publicitarios representativos para Septiembre 2026 (si no existen)
IF NOT EXISTS (SELECT 1 FROM dbo.GastosCampana WHERE fecha BETWEEN '2026-09-01' AND '2026-09-30')
BEGIN
    INSERT INTO dbo.GastosCampana (id_campana, fecha, importe, descripcion)
    VALUES 
        (1, '2026-09-15', 1500.00, 'Pauta Meta Ads - Campaña Primavera WhatsApp (Mes Completo)'),
        (2, '2026-09-15', 850.00,  'Pauta Meta Ads - Campaña Primavera Instagram Feed & Stories'),
        (3, '2026-09-15', 450.00,  'Pauta Meta Ads - Campaña Primavera Facebook Ads Segmentado'),
        (4, '2026-09-10', 200.00,  'Inversión SEO / Mantenimiento Landing Page NexoSalud'),
        (5, '2026-09-10', 100.00,  'Optimización y Verificación Google Maps Ficha Local');
END;
GO

-- 2. CREACIÓN DE LA SEGUNDA TABLA DE HECHOS EN NexoSalud_Mart
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
        impresiones INT NULL DEFAULT 0,
        clics INT NULL DEFAULT 0,
        fecha_gasto DATE NOT NULL,
        descripcion_gasto NVARCHAR(255) NULL,
        origen_datos VARCHAR(30) NOT NULL CONSTRAINT DF_FactInversion_Origen DEFAULT 'OLTP_GASTOS_CAMPANA',
        fecha_corte_etl DATETIME2 NOT NULL CONSTRAINT DF_FactInversion_ETL DEFAULT SYSDATETIME()
    );
    PRINT 'Tabla fact_inversion_campana_buyer creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'Tabla fact_inversion_campana_buyer ya existía.';
END;
GO

-- 3. PROCESO ETL / MERGE IDEMPOTENTE DESDE NexoSaludDB HACIA NexoSalud_Mart
;WITH GastosSource AS (
    SELECT 
        gc.id_gasto,
        CAST(FORMAT(gc.fecha, 'yyyyMMdd') AS INT) AS KeyTiempo,
        COALESCE(df.KeyFuente, 0) AS KeyFuente,
        COALESCE(dc.KeyCanal, 0) AS KeyCanal,
        gc.importe AS monto_inversion,
        0 AS impresiones,
        0 AS clics,
        CAST(gc.fecha AS DATE) AS fecha_gasto,
        LEFT(gc.descripcion, 255) AS descripcion_gasto,
        'OLTP_GASTOS_CAMPANA' AS origen_datos,
        SYSDATETIME() AS fecha_corte_etl
    FROM [NexoSaludDB].dbo.GastosCampana gc
    JOIN [NexoSaludDB].dbo.Campanas c ON c.id_campana = gc.id_campana
    JOIN [NexoSalud_Mart].dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(gc.fecha AS DATE)
    LEFT JOIN [NexoSalud_Mart].dbo.Dim_Fuente df ON df.id_campana = c.id_campana
    LEFT JOIN [NexoSalud_Mart].dbo.Dim_Canal dc ON dc.id_canal = c.id_canal
)
MERGE [NexoSalud_Mart].dbo.fact_inversion_campana_buyer AS tgt
USING GastosSource AS src
ON tgt.id_gasto = src.id_gasto
WHEN MATCHED THEN
    UPDATE SET 
        tgt.KeyTiempo = src.KeyTiempo,
        tgt.KeyFuente = src.KeyFuente,
        tgt.KeyCanal = src.KeyCanal,
        tgt.monto_inversion = src.monto_inversion,
        tgt.impresiones = src.impresiones,
        tgt.clics = src.clics,
        tgt.fecha_gasto = src.fecha_gasto,
        tgt.descripcion_gasto = src.descripcion_gasto,
        tgt.fecha_corte_etl = src.fecha_corte_etl
WHEN NOT MATCHED THEN
    INSERT (id_gasto, KeyTiempo, KeyFuente, KeyCanal, monto_inversion, impresiones, clics,
            fecha_gasto, descripcion_gasto, origen_datos, fecha_corte_etl)
    VALUES (src.id_gasto, src.KeyTiempo, src.KeyFuente, src.KeyCanal, src.monto_inversion,
            src.impresiones, src.clics, src.fecha_gasto, src.descripcion_gasto,
            src.origen_datos, src.fecha_corte_etl);
GO

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

