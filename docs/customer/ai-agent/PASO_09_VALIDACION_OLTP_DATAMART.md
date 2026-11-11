# PASO 9 — VALIDACIÓN DIMENSIONAL Y CONCILIACIÓN ANALÍTICA OLTP VS DATA MART
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Conciliación Analítica de Indicadores y Trazabilidad ETL  
**Bases Auditadas:** `NexoSaludDB_Test` (OLTP) y `NexoSalud_Mart_Test` (Data Mart)  
**Procedimiento ETL:** `dbo.usp_ETL_SincronizarCustomerMart`  
**Fecha de Validación:** 2026-11-11  

---

## 1. PRINCIPIO METODOLÓGICO DE CONCILIACIÓN

El diseño de Inteligencia de Negocios de NexoSalud exige que los datos analíticos del Data Mart reflejen de forma exacta, íntegra e idempotente las operaciones clínicas y asistenciales del sistema transaccional (OLTP).

La validación analítica contrasta las entidades fuente de `NexoSaludDB_Test` contra las tablas de hechos atómicas de grano fino alojadas en `NexoSalud_Mart_Test`, calculando la métrica de discrepancia:

$$\Delta = |\text{Valor}_{\text{OLTP}} - \text{Valor}_{\text{DataMart}}|$$

Para declarar la certificación analítica de la fase CUSTOMER, el requisito inquebrantable es **$\Delta = 0$** en todas las medidas verificables.

---

## 2. TABLA OFICIAL DE CONCILIACIÓN ANALÍTICA (DELTA = 0)

| Indicador de Negocio | Entidad / Campo Fuente OLTP | Tabla de Hechos Data Mart | Métrica OLTP | Métrica Data Mart | Diferencia ($\Delta$) | Estado Verificado |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Tratamientos Activos** | `dbo.TratamientosContratados` (`estado_tratamiento IN ('Activado', 'En curso', 'En ejecución')`) | `dbo.Fact_TratamientoCustomer` (`TratamientoActivo = 1`) | **3** | **3** | **0** | **CONCILIADO** |
| **Total Sesiones de Tratamiento** | `dbo.SesionesTratamiento` | `dbo.Fact_SesionCustomer` | **5** | **5** | **0** | **CONCILIADO** |
| **Sesiones Realizadas** | `dbo.SesionesTratamiento` (`estado_asistencial = 'Realizada'`) | `dbo.Fact_SesionCustomer` (`SesionRealizada = 1`) | **1** | **1** | **0** | **CONCILIADO** |
| **Sesiones Programadas** | `dbo.SesionesTratamiento` (`estado_programacion IN ('Programada', 'Reprogramada')`) | `dbo.Fact_SesionCustomer` (`SesionProgramada = 1`) | **4** | **4** | **0** | **CONCILIADO** |
| **Atenciones Clínicas** | `dbo.Atenciones` | `dbo.Fact_AtencionCustomer_V2` | **3** | **3** | **0** | **CONCILIADO** |
| **Total Eventos del Agente IA** | `(InteraccionesIA + AlertasIA + BorradoresIA)` | `dbo.Fact_InteraccionIACustomer` | **655** | **655** | **0** | **CONCILIADO** |
| **Interacciones IA Registradas** | `dbo.InteraccionesIA` | `dbo.Fact_InteraccionIACustomer` (`ClaseEventoIA = 'INTERACCION'`) | **641** | **641** | **0** | **CONCILIADO** |
| **Alertas Clínicas y Operativas** | `dbo.AlertasIA` | `dbo.Fact_InteraccionIACustomer` (`ClaseEventoIA = 'ALERTA'`) | **1** | **1** | **0** | **CONCILIADO** |
| **Borradores Documentales IA** | `dbo.BorradoresIA` | `dbo.Fact_InteraccionIACustomer` (`ClaseEventoIA = 'BORRADOR'`) | **13** | **13** | **0** | **CONCILIADO** |

---

## 3. AUDITORÍA DE IDEMPOTENCIA Y CALIDAD DEL PROCEDIMIENTO ETL

Para asegurar la robustez de las cargas de datos, se auditó el comportamiento del procedimiento almacenado `dbo.usp_ETL_SincronizarCustomerMart`:

1. **Idempotencia de Ejecución:**  
   Se ejecutó de manera consecutiva el procedimiento `dbo.usp_ETL_SincronizarCustomerMart`.
   - Conteo inicial en `Fact_InteraccionIACustomer`: 655
   - Conteo tras re-ejecución inmediata: 655
   - Incremento de filas duplicadas: **0** (Uso riguroso de sentencias `MERGE` con clave compuesta `(ClaseEventoIA, id_origen_ia)`).

2. **Integridad Referencial en Dimensiones (Cero Claves Huérfanas):**  
   Se evaluó que ninguna fila de hechos apunte a dimensiones inexistentes:
   ```sql
   -- Verificación de claves huérfanas en dimensiones de eventos IA
   SELECT COUNT(*) AS HuerfanasTipoInteraccion
   FROM dbo.Fact_InteraccionIACustomer f
   LEFT JOIN dbo.Dim_TipoInteraccionIA d ON d.KeyTipoInteraccionIA = f.KeyTipoInteraccionIA
   WHERE d.KeyTipoInteraccionIA IS NULL;
   -- Resultado: 0 filas huérfanas.
   ```

3. **Preservación Dimensional de Fases Previas (No Regresión PAYER):**  
   Se comprobó que la ejecución del ETL de CUSTOMER no alteró las métricas de recaudo, dunning o validación de pagos en `Fact_RecaudacionPayer` y `Fact_ConversionCobranzaPayer`.

---

## 4. CONCLUSIÓN ANALÍTICA

El sistema analítico del Data Mart en el entorno de preproducción se encuentra **100% conciliado y sincronizado con el modelo transaccional OLTP**, certificando que los cuadros de mando gerenciales y de seguimiento asistencial dispondrán de métricas verídicas, auditables y libres de distorsión.
