# Cambios realizados y estado de la entrega

[Guía principal para Germain](README.md) · [Pendientes de BD](docs/PENDIENTES_BUYER_BD.md) · [Ejecución](docs/EJECUCION_SQL_SERVER.md).

**Fecha de este resumen:** 1 de noviembre de 2026.  
**Rama:** `analysis/buyer-bases-datos`.  
**Alcance:** revisión de Semana 9, principalmente Buyer. No se integró a `main`, no se implementó el agente y no se migró a PostgreSQL.

## 1. Decisiones vigentes

- Conservar cinco medidas y tres indicadores de Buyer, así como el formato de la matriz del informe principal.
- Registrar una primera captación por persona. No contar cada oportunidad, solicitud o mensaje como una persona nueva.
- Mantener la conversión auditable mediante `EventosEtapa`; no sustituirla por etapa actual o primera solicitud.
- Conservar desconocidos y costos no verificables sin asignarles valores reales ficticios.
- Dejar `OportunidadesCaptacion`, medidas auxiliares persistidas y un hecho de gastos como alternativas posteriores justificables, no componentes ya implementados de esta versión.

## 2. Cambios SQL implementados en el paquete

| Componente | Cambio |
|---|---|
| OLTP Buyer | Tabla `CaptacionesBuyer`, única por persona; procedencia `REGISTRO_DIRECTO`/`HISTORICO_OBSERVADO`; sede, servicio y origen declarados. |
| Evidencia de transición | Campos opcionales de captación/solicitud en `EventosEtapa` e identificador único de operación Buyer. |
| Operación de conversión | `usp_ConvertirBuyerALead`: transacción, validaciones y reintento sin crear otra operación cuando ya existe conversión. Su flujo nuevo aún necesita pruebas integrales. |
| Preparación futura | Referencias opcionales desde `DecisionesIA` hacia captación e interacción; no proveedor IA implementado. |
| Mart Buyer | Detalle por persona/captación, cinco medidas originales, fechas/evidencia y duración individual nullable. |
| ETL Buyer | Extracción desde evento real, dimensiones mediante claves naturales y desconocidos 0, staging único y `DELETE + INSERT` con transacción/bloqueo. |
| Gastos | Fuente `GastosCampana`, reparto por campaña/mes conservando céntimos, ausencias `NULL` y gasto sin contactos visible como no atribuido. |
| Consultas | B1/B2/B3, matriz y conciliaciones de medidas, evidencia, duración y gastos. |
| Datos base | `01_catalogos.sql` conserva las instrucciones y datos sintéticos originales; no se fabricaron gastos para completar B3. |
| Otras fases | Reincorporación de sus dimensiones/hechos con reglas heredadas. Se conserva la corrección puntual del JOIN PAYER que triplicaba pagos. |

Se retiraron los sustitutos de ubicación/perfil reales usados cuando faltaba información, como «Trujillo», «Centro» y «Particular». Las reglas de clasificación, umbrales, conteos 0/1 y clave desconocida 0 siguen siendo constantes explícitas. Los datos sintéticos no son evidencia real del negocio.

## 3. Historial previo a esta entrega documental

| Commit | Trabajo |
|---|---|
| `b65c34c` y `dde0fc4` | Propuesta inicial y diagnóstico de lectura en la rama nueva. |
| `f6f8bbc` | Versión SQL candidata sobre Semana 9: captura atómica, evidencia, migración, ETL y pruebas. |
| `d8bdee3` | Documentación exclusivamente comentada pasó de `.sql` a `.md`; revisión de sustitutos fijos y guía local. |
| `b82b4a7` | Poblamiento de las otras cuatro fases y conciliación básica, manteniendo la corrección PAYER. |
| Esta entrega | Guías enlazadas para Germain, registro de estado y limpieza de duplicados. No cambia las expresiones ejecutables del ETL. |

Los commits permanecen en GitHub y en el historial git. No se modificó el Google Docs del equipo.

## 4. Evidencia observada y límites

Daniel aportó capturas de su ejecución en SQL Server:

- Buyer 805 contactos, 680 utilizables y 310 conversiones en ambas bases.
- LEAD 310 solicitudes; PAYER 124 pagos y 110 validados; CUSTOMER 219 citas; TURNED 80 seguimientos. Diferencias básicas mostradas: cero.
- S/ 19 100 validados en ambas bases.
- Sin duplicados ni discrepancias de eventos/duración en las consultas mostradas; sin cronología negativa mostrada.
- Los 805 contactos siguen como `HISTORICO_OBSERVADO`, con sede/servicio 0 y costo no verificable.
- `Interacciones` y `GastosCampana` tienen cero registros en ese baseline.

El asistente realizó análisis sintáctico T-SQL y controles estáticos. No dispone de una conexión a esa instancia para certificar toda su ejecución. No están demostrados todavía: captura directa completa, costo con datos no vacíos, conversión nueva, rechazos, concurrencia, repetición integral y rollback de fallos. Consultar la [lista de aceptación](docs/PENDIENTES_BUYER_BD.md).

## 5. Limpieza de archivos

| Archivo anterior | Tratamiento |
|---|---|
| `semana9/05_poblamiento_otras_fases.sql` | Retirado: duplicaba el bloque 2 de `poblamiento_merge_mart.sql`. El archivo completo es la única fuente activa. |
| `01_diagnostico_buyer.sql` | Retirado del paquete activo: diagnóstico inicial de esquemas/alternativas. La continuación usa `02_validacion.sql` y las guías actuales. |
| `00_contrato_propuesto.md` | Retirado del paquete activo: mezclaba propuestas amplias no adoptadas con la versión mínima. Las decisiones actuales están en la guía y los pendientes. |
| `semana9/00_orden_y_alcance.md` | Consolidado en `docs/EJECUCION_SQL_SERVER.md`. |
| `init_oltp.sql` e `init_mart.sql` frente a `migracion_buyer.sql` | Conservados: creación nueva y actualización de un esquema anterior son rutas diferentes, no dos instalaciones consecutivas. Mantener sus definiciones equivalentes. |
| SQL de `database/` raíz y de otras ramas | No eliminados: pertenecen al sistema/base anterior y pueden ser referenciados por scripts del backend. No mezclarlos con este paquete al ejecutar. |

No se eliminó ningún dato de BD con esta limpieza. Para recuperar un diagnóstico o complemento anterior se puede consultar el commit `b82b4a7`; no volver a introducir copias paralelas en la carpeta activa.

## 6. Trabajo asignado, todavía pendiente

- **Principal de Germain:** [cierre Buyer BD](docs/PENDIENTES_BUYER_BD.md).
- **Complementario:** [propuestas para los responsables de otras fases](docs/RECOMENDACIONES_OTRAS_FASES.md), sin cambios de reglas aplicados en esta entrega.
- **Posterior:** [integración del sistema y agente](docs/AGENTE_BUYER.md), cuando las BD y el ETL estén verificados.
- **Futuro separado:** evaluar PostgreSQL para despliegue conservando pruebas de paridad; T-SQL/SQL Server siguen vigentes aquí.

## Bloques 2, 3 y 4

Se corrige CPL como cociente de sumas por cada nivel, se conserva NULL en API/interfaz/CSV/PDF y se distingue del B3 por cohorte. El backend y las pruebas operativas invocan la rutina canonica de captacion; ambos hechos se cargan en una transaccion desde la API. Se agregan pruebas automaticas de calculo/servicio y prueba SQL de fallo/rollback. Instalacion y limites en [cierre y validacion local](docs/CIERRE_BUYER_Y_VALIDACION_LOCAL.md). La ejecucion real en SQL Server sigue pendiente.
