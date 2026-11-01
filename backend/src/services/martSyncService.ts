import { queryMart } from '../db/mart';

export class MartSyncService {
  private static lastSyncTimestamp = 0;

  /**
   * Asegura que la fecha actual exista en Dim_Tiempo para no violar claves foráneas.
   */
  public static async ensureCurrentDateInDimTiempo(date: Date = new Date()): Promise<number> {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const keyTiempo = parseInt(`${yyyy}${mm}${dd}`, 10);
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const quarter = Math.floor(date.getMonth() / 3) + 1;

    try {
      await queryMart(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo = ${keyTiempo})
        BEGIN
          INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
          VALUES (${keyTiempo}, '${dateStr}', ${yyyy}, ${quarter}, ${parseInt(mm, 10)}, ${parseInt(dd, 10)});
        END
      `);
    } catch (err: any) {
      console.warn('[MartSyncService] Error asegurando fecha en Dim_Tiempo:', err.message);
    }

    return keyTiempo;
  }

  /**
   * Sincroniza la etapa BUYER (fact_captacion_buyer) desde NexoSaludDB hacia NexoSalud_Mart.
   * Compatible tanto con el esquema atómico (id_persona como PK) como con el legado agregado.
   */
  public static async syncBuyer(): Promise<number> {
    try {
      await this.ensureCurrentDateInDimTiempo();

      const checkSchema = await queryMart<{ hasIdPersona: number }>(`
        SELECT CASE WHEN COL_LENGTH('dbo.fact_captacion_buyer', 'id_persona') IS NOT NULL THEN 1 ELSE 0 END AS hasIdPersona
      `);
      const isAtomic = checkSchema[0]?.hasIdPersona === 1;

      if (isAtomic) {
        // Esquema atómico revisado: 1 fila por persona/captación
        const sql = `
          -- 1. Insertar en CaptacionesBuyer cualquier persona registrada que aún no tenga registro
          IF OBJECT_ID('[NexoSaludDB].dbo.CaptacionesBuyer', 'U') IS NOT NULL
          BEGIN
            INSERT [NexoSaludDB].dbo.CaptacionesBuyer
                (id_persona, fecha_captacion, id_canal, id_fuente, id_campana, estado_calidad, autoriza_contacto, fecha_autorizacion, origen_datos)
            SELECT p.id_persona, p.fecha_registro, p.id_canal_origen, ca.id_fuente, p.id_campana_origen, p.estado_calidad, p.autoriza_contacto, p.fecha_autorizacion, 'HISTORICO_OBSERVADO'
            FROM [NexoSaludDB].dbo.Personas p
            LEFT JOIN [NexoSaludDB].dbo.Campanas ca ON ca.id_campana = p.id_campana_origen
            WHERE NOT EXISTS (SELECT 1 FROM [NexoSaludDB].dbo.CaptacionesBuyer c WHERE c.id_persona = p.id_persona);
          END;

          -- 2. Sincronización atómica por id_persona
          MERGE [NexoSalud_Mart].dbo.fact_captacion_buyer AS tgt
          USING (
              SELECT v.id_persona, v.id_captacion, dt.KeyTiempo,
                     dconv.KeyTiempo AS KeyTiempoConversion,
                     COALESCE(ds.KeySede, 0) AS KeySede,
                     COALESCE(dserv.KeyServicio, 0) AS KeyServicio,
                     COALESCE(dc.KeyCanal, 0) AS KeyCanal,
                     COALESCE(df.KeyFuente, 0) AS KeyFuente,
                     COALESCE(dtp.KeyTipoPersona, 0) AS KeyTipoPersona,
                     COALESCE(der.KeyEstadoRegistro, 0) AS KeyEstadoRegistro,
                     v.contacto_registrado, v.contacto_utilizable,
                     CASE WHEN v.fecha_conversion IS NOT NULL THEN 1 ELSE 0 END AS conversion_lead,
                     CASE WHEN v.fecha_conversion IS NOT NULL
                          THEN CAST(DATEDIFF_BIG(SECOND, v.fecha_captacion, v.fecha_conversion)/86400.0 AS DECIMAL(18,6))
                     END AS tiempo_conversion_dia,
                     v.fecha_captacion, v.fecha_conversion, v.id_evento_conversion,
                     v.origen_datos, SYSDATETIME() AS fecha_corte_etl
              FROM [NexoSaludDB].dbo.v_DatosCaptacionBuyer v
              JOIN [NexoSalud_Mart].dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(v.fecha_captacion AS DATE)
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_Tiempo dconv ON dconv.id_fecha = CAST(v.fecha_conversion AS DATE)
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_Sede ds ON ds.id_sede = v.id_sede
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_Servicio dserv ON dserv.id_servicio = v.id_servicio
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_Canal dc ON dc.id_canal = v.id_canal
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_Fuente df ON df.id_fuente = v.id_fuente AND df.id_campana = v.id_campana
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_TipoPersona dtp ON dtp.id_persona = v.id_persona
              LEFT JOIN [NexoSalud_Mart].dbo.Dim_EstadoRegistro der
                     ON der.EstadoCalidad = v.estado_calidad
                    AND der.AutorizacionContacto = CASE WHEN v.autoriza_contacto = 1 THEN 'SI' ELSE 'NO' END
          ) AS src
          ON tgt.id_persona = src.id_persona
          WHEN MATCHED THEN
              UPDATE SET 
                  tgt.KeyTiempo = src.KeyTiempo,
                  tgt.KeyTiempoConversion = src.KeyTiempoConversion,
                  tgt.KeySede = src.KeySede,
                  tgt.KeyServicio = src.KeyServicio,
                  tgt.KeyCanal = src.KeyCanal,
                  tgt.KeyFuente = src.KeyFuente,
                  tgt.KeyTipoPersona = src.KeyTipoPersona,
                  tgt.KeyEstadoRegistro = src.KeyEstadoRegistro,
                  tgt.contacto_registrado = src.contacto_registrado,
                  tgt.contacto_utilizable = src.contacto_utilizable,
                  tgt.conversion_lead = src.conversion_lead,
                  tgt.tiempo_conversion_dia = src.tiempo_conversion_dia,
                  tgt.fecha_captacion = src.fecha_captacion,
                  tgt.fecha_conversion = src.fecha_conversion,
                  tgt.id_evento_conversion = src.id_evento_conversion,
                  tgt.fecha_corte_etl = src.fecha_corte_etl
          WHEN NOT MATCHED THEN
              INSERT (id_persona, id_captacion, KeyTiempo, KeyTiempoConversion, KeySede, KeyServicio,
                      KeyCanal, KeyFuente, KeyTipoPersona, KeyEstadoRegistro,
                      contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia,
                      fecha_captacion, fecha_conversion, id_evento_conversion, origen_datos, fecha_corte_etl)
              VALUES (src.id_persona, src.id_captacion, src.KeyTiempo, src.KeyTiempoConversion, src.KeySede, src.KeyServicio,
                      src.KeyCanal, src.KeyFuente, src.KeyTipoPersona, src.KeyEstadoRegistro,
                      src.contacto_registrado, src.contacto_utilizable, src.conversion_lead, src.tiempo_conversion_dia,
                      src.fecha_captacion, src.fecha_conversion, src.id_evento_conversion, src.origen_datos, src.fecha_corte_etl);
        `;
        await queryMart(sql);
      } else {
        // Esquema legado agregado (fallback)
        const legacySql = `
          ;WITH EventosLeadUnico AS (
              SELECT id_persona, MIN(fecha_hora) AS fecha_hora_lead
              FROM [NexoSaludDB].dbo.[EventosEtapa]
              WHERE etapa_destino = 2
              GROUP BY id_persona
          ),
          BuyerSource AS (
              SELECT 
                  CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT) AS KeyTiempo,
                  ISNULL(ds.KeySede, 1) AS KeySede,
                  ISNULL(dc.KeyCanal, 4) AS KeyCanal,
                  ISNULL(df.KeyFuente, 1) AS KeyFuente,
                  CASE 
                      WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 4
                      WHEN p.estado_calidad LIKE '%Incomplet%' THEN 1
                      WHEN p.estado_calidad LIKE '%Duplicad%' THEN 2
                      WHEN p.estado_calidad LIKE '%Rechazad%' THEN 3
                      ELSE 4
                  END AS KeyEstadoRegistro,
                  COUNT(p.id_persona) AS contacto_registrado,
                  SUM(CASE WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 1 ELSE 0 END) AS contacto_utilizable,
                  SUM(CASE WHEN ev.fecha_hora_lead IS NOT NULL THEN 1 ELSE 0 END) AS conversion_lead,
                  AVG(CASE 
                      WHEN ev.fecha_hora_lead >= p.fecha_registro
                      THEN DATEDIFF(DAY, p.fecha_registro, ev.fecha_hora_lead)
                      ELSE 0 
                  END) AS tiempo_conversion_dia
              FROM [NexoSaludDB].dbo.[Personas] p
              OUTER APPLY (
                  SELECT TOP (1) sede.KeySede
                  FROM [NexoSalud_Mart].dbo.[Dim_Sede] sede
                  WHERE sede.id_sede > 0 AND p.zona IS NOT NULL
                    AND (sede.Zona = p.zona OR sede.Sede LIKE '%' + p.zona + '%')
                  ORDER BY CASE WHEN sede.Zona = p.zona THEN 0 ELSE 1 END, sede.KeySede
              ) ds
              LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Canal] dc ON p.id_canal_origen = dc.id_canal
              LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Fuente] df ON p.id_campana_origen = df.id_campana
              LEFT JOIN EventosLeadUnico ev ON p.id_persona = ev.id_persona
              GROUP BY 
                  CAST(FORMAT(p.fecha_registro, 'yyyyMMdd') AS INT),
                  ISNULL(ds.KeySede, 1),
                  ISNULL(dc.KeyCanal, 4),
                  ISNULL(df.KeyFuente, 1),
                  CASE 
                      WHEN p.estado_calidad LIKE '%Valid%' AND p.autoriza_contacto = 1 THEN 4
                      WHEN p.estado_calidad LIKE '%Incomplet%' THEN 1
                      WHEN p.estado_calidad LIKE '%Duplicad%' THEN 2
                      WHEN p.estado_calidad LIKE '%Rechazad%' THEN 3
                      ELSE 4
                  END
          )
          MERGE [NexoSalud_Mart].dbo.[fact_captacion_buyer] AS fact
          USING BuyerSource AS src
          ON fact.KeyTiempo = src.KeyTiempo 
             AND fact.KeySede = src.KeySede
             AND fact.KeyCanal = src.KeyCanal 
             AND fact.KeyFuente = src.KeyFuente 
             AND fact.KeyEstadoRegistro = src.KeyEstadoRegistro
          WHEN MATCHED THEN
              UPDATE SET 
                  fact.contacto_registrado = src.contacto_registrado,
                  fact.contacto_utilizable = src.contacto_utilizable,
                  fact.conversion_lead = src.conversion_lead,
                  fact.tiempo_conversion_dia = src.tiempo_conversion_dia
          WHEN NOT MATCHED BY TARGET THEN
              INSERT (KeyTiempo, KeySede, KeyCanal, KeyFuente, KeyEstadoRegistro, contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia)
              VALUES (src.KeyTiempo, src.KeySede, src.KeyCanal, src.KeyFuente, src.KeyEstadoRegistro, src.contacto_registrado, src.contacto_utilizable, src.conversion_lead, src.tiempo_conversion_dia)
          WHEN NOT MATCHED BY SOURCE THEN
              DELETE;
        `;
        await queryMart(legacySql);
      }
    } catch (err: any) {
      console.warn('[MartSyncService] Advertencia en syncBuyer:', err.message);
    }

    // Sincronizar también la segunda tabla de hechos BUYER: fact_inversion_campana_buyer
    await this.syncInversionCampanaBuyer();

    this.lastSyncTimestamp = Date.now();
    return this.lastSyncTimestamp;
  }

  /**
   * Sincroniza la segunda tabla de hechos BUYER (fact_inversion_campana_buyer)
   * desde GastosCampana y Campanas de NexoSaludDB hacia NexoSalud_Mart.
   */
  public static async syncInversionCampanaBuyer(): Promise<void> {
    try {
      // 1. Asegurar existencia de la tabla en NexoSalud_Mart si aún no fue creada
      await queryMart(`
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
        END
      `);

      // 2. MERGE idempotente desde NexoSaludDB.dbo.GastosCampana
      const mergeSql = `
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
      `;
      await queryMart(mergeSql);
    } catch (err: any) {
      console.warn('[MartSyncService] Advertencia en syncInversionCampanaBuyer:', err.message);
    }
  }

  /**
   * Sincroniza de forma completa si ha transcurrido un intervalo o bajo demanda.
   */
  public static async syncAll(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastSyncTimestamp < 10000) {
      return; // Throttled para evitar saturar en llamadas concurrentes
    }
    await this.syncBuyer();
  }
}
