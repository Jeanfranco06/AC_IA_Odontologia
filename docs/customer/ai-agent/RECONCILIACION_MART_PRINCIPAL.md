# Reconciliación del Data Mart Principal — NexoSalud_Mart

**Auditoría y Diagnóstico de Desfase Dimensional**  
**Fecha de Inspección:** 12 de noviembre de 2026  
**Corte Transaccional:** `inspection.private.json` (Modo Serializable, Solo Lectura)

---

## 1. Diagnóstico de los 164 Hechos Desconocidos (`KeyTipoInteraccionIA = 0`)

La auditoría sobre la tabla `NexoSalud_Mart.dbo.Fact_InteraccionIACustomer` identificó exactamente **164 registros** asignados a la clave subrogada `KeyTipoInteraccionIA = 0` (Dimensión Desconocida). La inspección cruzada reveló las siguientes 12 causas raíz:

| Clase de Evento | Código de Evento en OLTP | Longitud (Caracteres) | Cantidad de Hechos | ¿Existe en Dim_TipoInteraccionIA Actual? | Acción Correctiva Preparada |
|---|---|---|---|---|---|
| `INTERACCION` | `CONSULTA_RAG_CONOCIMIENTO` | 25 | 75 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `CONVERSACION_CON_HERRAMIENTAS` | 29 | 22 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `ALERTA` | `ALERTA_SEGUIMIENTO_POST_TRATAMIENTO` | 35 | 12 | No (Faltante, longitud > 30) | Ampliar columna a `varchar(60)` e insertar. |
| `INTERACCION` | `ANALISIS_FICHA_CLINICA` | 22 | 12 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `CONSULTA_PROXIMA_CITA` | 21 | 12 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `ALERTA` | `AVISO_DOCUMENTAL` | 16 | 11 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `CONSULTA_COMPROBANTE` | 20 | 11 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `REVISION_ALERTA_SEGUIMIENTO_POST_TRATAMIENTO` | 44 | 4 | No (Faltante, longitud > 30) | Ampliar columna a `varchar(60)` e insertar. |
| `INTERACCION` | `CONSULTA_CONTEXTO_CLINICO` | 25 | 2 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `BORRADOR` | `BORRADOR_RESUMEN_DOCUMENTAL` | 27 | 1 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `CONSULTA_PROGRESO_OPERATIVO` | 27 | 1 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| `INTERACCION` | `CONSULTA_TRATAMIENTOS` | 21 | 1 | No (Faltante) | Insertar código en dimensión y actualizar clave. |
| **TOTAL** | — | — | **164** | — | **Resolución del 100% de hechos desconocidos.** |

### Factores Determinantes:
1. **Truncamiento por Tipo de Dato:** La dimensión histórica `Dim_TipoInteraccionIA` definió `CodigoTipoInteraccionIA VARCHAR(30)`. Eventos como `REVISION_ALERTA_SEGUIMIENTO_POST_TRATAMIENTO` poseen 44 caracteres, impidiendo su inserción o vinculación sin desbordamiento.
2. **Ausencia de Catálogo Dinámico en ETL:** El ETL previo no realizaba la resolución automática de tipos de evento generados por nuevas reglas de negocio o alertas asistenciales.

---

## 2. Conciliación de las 20 Medidas Certificadas

Comparación en la base principal entre la fuente transaccional `NexoSaludDB` y los hechos de `NexoSalud_Mart`:

| # | Medida Certificada | Valor en OLTP | Valor en Mart Principal | Diferencia | Diagnóstico y Causa Técnica |
|---|---|---|---|---|---|
| 1 | `tratamientos_iniciados` | 4 | 0 | +4 | ETL ejecutado previo a la activación de nuevos tratamientos. |
| 2 | `tratamientos_completados` | 1 | 0 | +1 | Tratamiento completado recientemente sin sincronización posterior. |
| 3 | `sesiones_planificadas` | 11 | 6 | +5 | Nuevos planes de tratamiento contratados pendientes de carga. |
| 4 | `sesiones_completadas` | 5 | 0 | +5 | Requiere sincronización bajo definición `Realizada + Cerrada`. |
| 5 | `dias_duracion_real` | 14 | 0 | +14 | Depende de la carga del tratamiento completado. |
| 6 | `sesiones_programadas` | 11 | 2 | +9 | Sesiones programadas y reprogramadas en agenda reciente. |
| 7 | `sesiones_realizadas` | 5 | 0 | +5 | Atenciones efectuadas pendientes de proceso de carga. |
| 8 | `sesiones_inasistidas` | 0 | 0 | 0 | **Conciliado.** |
| 9 | `reprogramaciones_acumuladas` | 0 | 0 | 0 | **Conciliado.** |
| 10 | `minutos_espera` | 0 | 0 | 0 | **Conciliado.** |
| 11 | `atenciones_realizadas` | 1292 | 1105 | +187 | **Desfase por colación/tilde:** OLTP contiene 187 registros con `asistencia = 'Asistió'`. El ETL previo solo filtraba `'Asiste'`. |
| 12 | `minutos_consulta` | 63130 | 54760 | +8370 | Corresponde con exactitud matemática a los minutos de las 187 atenciones omitidas. |
| 13 | `fichas_completas` | 0 | 0 | 0 | **Conciliado.** |
| 14 | `indicaciones_emitidas` | 2 | 0 | +2 | Indicaciones emitidas posteriores al último ciclo de carga. |
| 15 | `procedimientos_registrados` | 0 | 0 | 0 | **Conciliado.** |
| 16 | `interacciones_registradas` | 728 | 140 | +588 | Interacciones del copiloto y auditorías acumuladas en OLTP. |
| 17 | `alertas_generadas` | 35 | 35 | 0 | **Conciliado.** |
| 18 | `alertas_atendidas` | 12 | 12 | 0 | **Conciliado.** |
| 19 | `borradores_generados` | 43 | 49 | -6 | El Mart previo contaba versiones hijas en lugar de la raíz documental. |
| 20 | `borradores_aprobados` | 15 | 13 | +2 | Aprobaciones clínicas recientes pendientes de sincronización. |

---

## 3. Subsanación y Corrección Mediante el ETL Conservador

El script `database/customer/10_ajustes_dimensionales_ia.sql` y el procedimiento `15_etl_customer_conservador.sql` subsanan íntegramente las diferencias:

1. **Corrección de la Tilde y Colación en Atenciones:**
   ```sql
   -- Filtro corregido en el ETL conservador:
   WHERE a.asistencia IN (N'Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado')
   ```
   Recupera de inmediato las 187 atenciones y los 8,370 minutos de consulta omitidos.

2. **Resolución del Grano de Borradores:**
   ```sql
   -- Agrupación por raíz documental para evitar duplicaciones por versiones intermedias:
   COUNT(DISTINCT COALESCE(b.id_borrador_raiz, b.id_borrador_ia)) AS borradores_generados
   ```

3. **Verificación en el Entorno Test (`customerCompletionMart.test.ts`):**
   Tras aplicar esta lógica en `NexoSalud_Mart_Test`, la prueba automatizada certifica:
   - Medidas con diferencia: **0 de 20** (Delta = 0 absoluto).
   - Hechos con `KeyTipoInteraccionIA = 0`: **0**.
   - Grupos con grano duplicado: **0**.
   - Ejecución idempotente: `after === before` (la segunda ejecución consecutiva no altera sumatorias ni genera filas huérfanas).
