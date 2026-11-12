# -*- coding: utf-8 -*-
"""
Generador de los 6 documentos de integración definitiva con NexoSaludDB y NexoSalud_Mart.
Produce documentación exhaustiva, con tablas, diagramas y trazabilidad académica completa.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/customer/ai-agent'
DOC.mkdir(parents=True, exist_ok=True)

def write_doc(filename: str, content: str):
    p = DOC / filename
    p.write_text(content.strip() + '\n', encoding='utf-8')
    print(f'Documento generado: {filename} ({len(content)} caracteres)')

# ==============================================================================
# 1. INTEGRACION_BASES_PRINCIPALES.md
# ==============================================================================
doc_1 = """# Integración Definitiva con NexoSaludDB y NexoSalud_Mart

**Sistema NexoSalud — Módulo CUSTOMER y Agente Inteligente**  
**Rama:** `customer`  
**Fecha:** 12 de noviembre de 2026  
**Perfil de Arquitectura:** Integración Híbrida Transaccional (OLTP) y Analítica (Data Mart)

---

## 1. Resumen Ejecutivo y Arquitectura de Conexión

El presente documento formaliza la arquitectura de doble conexión del sistema NexoSalud y su Agente Inteligente CUSTOMER, asegurando que las operaciones en producción utilicen las bases de datos principales:
1. **Base OLTP Principal:** `NexoSaludDB` — Responsable de la gestión transaccional, cronogramas, sesiones, atenciones, validaciones documentales, alertas y persistencia de interacciones del agente.
2. **Data Mart Principal:** `NexoSalud_Mart` — Responsable del análisis multidimensional histórico, tendencias institucionales, cumplimiento de cohortes de tratamiento y desempeño global de la IA.

Se certificó previamente el comportamiento funcional del sistema en entornos aislados de certificación (`NexoSaludDB_Test` y `NexoSalud_Mart_Test`) con **249 pruebas backend automatizadas**, **49 pruebas frontend**, **6 pruebas de extremo a extremo (E2E)** y la conciliación determinista de **20 medidas dimensionales**. La transición hacia las bases principales se ha diseñado de manera rigurosa, no destructiva y bajo principio de mínimo privilegio, evitando sustituciones globales de variables de entorno o migraciones ciegas.

```
+---------------------------------------------------------------------------------------------------+
|                                      SISTEMA NEXOSALUD                                            |
+---------------------------------------------------------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
           +---------------------------+                     +---------------------------+
           |   ASISTENCIA OPERACIONAL  |                     |    ANÁLISIS INTELIGENTE   |
           |    Actividades IA01–IA14  |                     |    Actividades IA15–IA18  |
           |     Alertas ALT-C01–C08   |                     |     Reportes y Tableros   |
           +---------------------------+                     +---------------------------+
                         |                                                 |
                         v                                                 v
           +---------------------------+                     +---------------------------+
           |     Backend de Negocio    |                     | Servicio de Consulta BI   |
           |  (Prisma ORM Transaccional|                     |  (Prisma Read-Only Client)|
           +---------------------------+                     +---------------------------+
                         |                                                 |
                         | (Escritura / Lectura                            | (SELECT Únicamente /
                         |  Transaccional Autorizada)                      |  Filtros Parametrizados)
                         v                                                 v
           +---------------------------+       ETL           +---------------------------+
           |         OLTP              |  Conservador        |         DATA MART         |
           |       NexoSaludDB         | ----------------->  |       NexoSalud_Mart      |
           +---------------------------+                     +---------------------------+
```

---

## 2. Configuración y Aislamiento por Entorno

El sistema implementa una separación inequívoca de entornos mediante el gestor de perfiles `backend/src/databaseProfiles.ts`, asegurando que no se mezclen conexiones de prueba con instancias operativas reales.

| Variable de Entorno | Entorno de Certificación / Test | Entorno Principal Autorizado | Propósito y Restricción |
|---|---|---|---|
| `NEXOSALUD_ENV` | `certification` (o `development`) | `principal` | Selecciona el perfil estricto de arranque. |
| `SQLSERVER_URL` | `database=NexoSaludDB_Test` | `database=NexoSaludDB` | Conexión transaccional para Prisma Client. |
| `MART_READ_URL` | `database=NexoSalud_Mart_Test` | `database=NexoSalud_Mart` | Conexión analítica de solo lectura (sin DDL/DML). |
| `NEXOSALUD_PRINCIPAL_ENABLED` | `false` | `true` (tras autorización) | Interruptor de seguridad de despliegue principal. |
| `AI_AGENT_LLM_ENABLED` | `true` (simulado / fixture) | `true` (con proveedor oficial) | Habilita el orquestador conversacional. |
| `AI_AGENT_EXTERNAL_DATA_AUTHORIZED` | `true` | Requiere convenio de privacidad | Autorización formal para envío de tokens al LLM. |

### Verificación de Integridad en el Arranque (`verifyStartupDatabases`)
El módulo `backend/src/startupDatabaseChecks.ts` ejecuta en cada inicio del servidor:
1. **Validación de Pares:** Comprueba mediante `assertDatabasePair` que la conexión OLTP y la conexión Mart correspondan exactamente al mismo perfil (bloquea combinaciones mixtas como `NexoSaludDB` con `NexoSalud_Mart_Test`).
2. **Identidad no Administrativa:** Ejecuta `IS_SRVROLEMEMBER('sysadmin')` y bloquea el arranque si la aplicación intenta conectarse como `sysadmin`.
3. **Comprobación de Privilegios Mart:** Verifica que la credencial analítica carezca de permisos `INSERT`, `UPDATE`, `DELETE`, `ALTER` o `EXECUTE`.
4. **Verificación de Esquema:** Inspecciona la presencia de columnas y tablas requeridas por CUSTOMER (`Atenciones.revision_ficha`, `InteraccionesIA.id_usuario_actor`, `PoliticasCustomerIA`, `SolicitudesCustomerIA`, `SesionesAccesoIA`).
5. **Bloqueo sin Exposición:** Ante cualquier discrepancia, emite excepciones genéricas sin exponer credenciales ni nombres de servidores en bitácoras públicas.

---

## 3. Matriz de Conexiones por Servicio

| Servicio Backend | Archivo Fuente | Base de Datos | Tipo de Conexión | Privilegios Requeridos |
|---|---|---|---|---|
| `CustomerAiQueryService` | `customerAiQueryService.ts` | `NexoSaludDB` | OLTP (Prisma) | `SELECT` en tablas clínicas y operacionales. |
| `CustomerAiActionService` | `customerAiActionService.ts` | `NexoSaludDB` | OLTP (Prisma) | `SELECT`, `INSERT`, `UPDATE` en solicitudes, borradores y alertas. |
| `CustomerCompletionService` | `customerCompletionService.ts` | `NexoSaludDB` | OLTP (Prisma) | `SELECT`, `INSERT`, `UPDATE`, `EXECUTE` de SPs seguros de cierre y sesión. |
| `CustomerAlertLifecycleService` | `customerAlertLifecycleService.ts` | `NexoSaludDB` | OLTP (Prisma) | `SELECT` en atenciones/sesiones, `INSERT`/`UPDATE` en `AlertasIA`. |
| `DurableKnowledgeService` | `durableKnowledgeService.ts` | Almacén persistente / OLTP | RAG Corporativo | `SELECT` en políticas publicadas. |
| `CustomerAnalyticsService` | `customerAnalyticsService.ts` | `NexoSalud_Mart` | Mart Read (`readCustomerMart`) | `SELECT` exclusivo en 4 tablas de hechos y dimensiones vinculadas. |
| `customerMartReader` | `customerMartRead.ts` | `NexoSalud_Mart` | Prisma Client dedicado | `SELECT` exclusivo, sin DML, DDL ni ejecución de procedimientos. |

---

## 4. Estado de Preparación y Garantías de Seguridad

1. **Sin Inyección de SQL Arbitrario:** Gemini no tiene acceso a generar cadenas SQL libres ni a consultar la base de datos de forma directa. Todas las consultas analíticas utilizan plantillas fuertemente parametrizadas (`Prisma.sql`), con validación de tipo de dato, límites de rango temporal (máximo 366 días) y volumen acotado (máximo 100 grupos).
2. **Preservación Histórica:** La base principal `NexoSaludDB` y el Mart `NexoSalud_Mart` conservan todos sus registros existentes. No se ha aplicado `prisma migrate reset`, truncate ni depuración forzada.
3. **Datos Simulados Coherentes:** Conforme a la instrucción del proyecto, los datos reales simulados de `NexoSaludDB` son sujetos de homologación de estados y validación previa antes de ejecutar cualquier sincronización dimensional.
4. **Despliegue Condicionado:** Toda alteración sobre las bases principales queda supeditada a la ejecución controlada del paquete de migración empaquetado con hashes SHA-256 en `database/customer/deployment/20261112/`.
"""

write_doc('INTEGRACION_BASES_PRINCIPALES.md', doc_1)

# ==============================================================================
# 2. PLAN_MIGRACION_OLTP_MART.md
# ==============================================================================
doc_2 = """# Plan de Migración Controlada — NexoSaludDB y NexoSalud_Mart

**Entorno de Destino:** Bases de Datos Principales (`NexoSaludDB` y `NexoSalud_Mart`)  
**Fecha:** 12 de noviembre de 2026  
**Estado:** Paquete Preparado y Verificado en Test (`PREPARED_NOT_AUTHORIZED`)  
**Ubicación del Paquete:** `database/customer/deployment/20261112/`

---

## 1. Inventario de Diferencias Detectadas

La inspección en modo solo lectura (`backend/scripts/inspect-principal-readonly.cjs`) sobre las bases principales reveló las siguientes discrepancias respecto a la estructura certificada en Test:

### A. Diferencias en NexoSaludDB (OLTP)
1. **Columnas Faltantes en Tablas Existentes:**
   - `dbo.Atenciones.revision_ficha` (`int`, NOT NULL, default 1).
   - `dbo.BorradoresIA.fecha_transferencia_ficha` (`datetime2`, NULL).
   - `dbo.InteraccionesIA.id_usuario_actor` (`int`, NULL, FK hacia `dbo.Usuarios`).
   - `dbo.SesionesTratamiento.confirmacion_paciente` (`varchar(20)`, NOT NULL, default 'No_Requerida').
   - `dbo.SesionesTratamiento.fecha_confirmacion` (`datetime2`, NULL).
2. **Tablas Faltantes:**
   - `dbo.PoliticasCustomerIA` (Almacén de reglas de validación documental, confirmación y derivación).
   - `dbo.SesionesAccesoIA` (Almacén de revocación de sesiones JWT y control de concurrencia).
   - `dbo.SolicitudesCustomerIA` (Bandeja unificada de programación de sesiones y derivaciones humanas).
3. **Procedimientos Almacenados y Reglas de Negocio:**
   - Se requiere instalar versiones seguras y parametrizadas de:
     - `dbo.usp_ProgramarSesionTratamiento` (Validación transaccional de disponibilidad y prevención de colisiones).
     - `dbo.usp_RegistrarEventoAsistencialSesion` (Registro estricto de eventos asistenciales en tiempo UTC).
     - `dbo.usp_CerrarSesionClinica` (Cierre condicionado a validación documental).
     - `dbo.usp_CerrarTratamientoYTransicionarTurned` (Cierre formal con checklist clínico y transición supervisada).
4. **Restricciones CHECK:**
   - `CK_Tratamientos_Estado`: Homologación de estados UTF-8 (`Contratado`, `Activado`, `En ejecución`, `Suspendido`, `Completado`, `Cancelado`).
   - `CK_Atenciones_Asistencia`: Homologación de valores (`Pendiente`, `Confirmada`, `Asistió`, `No asistió`, `Asiste`, `No asiste`).
   - `CK_InteraccionesIA_NoDiagnostico`: Garantía a nivel de base de datos de que ninguna interacción constituya diagnóstico o prescripción autónoma.

### B. Diferencias en NexoSalud_Mart (Data Mart)
1. **Ampliación Dimensional:**
   - `dbo.Dim_TipoInteraccionIA.CodigoTipoInteraccionIA`: Longitud actual insuficiente (`varchar(30)`). Debe ampliarse a `varchar(60)` para soportar códigos como `REVISION_ALERTA_SEGUIMIENTO_POST_TRATAMIENTO` (44 caracteres).
   - Incorporación de los 12 códigos de evento identificados en las alertas, interacciones y borradores de CUSTOMER.
2. **Procedimiento ETL Conservador:**
   - `dbo.usp_ETL_SincronizarCustomerMart`: El procedimiento anterior incluía cláusulas destructivas (`WHEN NOT MATCHED BY SOURCE THEN DELETE` y `DELETE FROM Fact_AtencionCustomer`). Se reemplaza por la versión conservadora `15_etl_customer_conservador.sql`, que preserva hechos legados y utiliza operadores `MERGE` aditivos.

---

## 2. Paquete de Despliegue Preparado (`manifest.json`)

Los scripts SQL han sido generados por `prepare-principal-deployment.py` y se encuentran inmutables bajo control de hashes SHA-256:

| Orden | Script de Migración | Hash SHA-256 | Propósito Operativo |
|---|---|---|---|
| 00 | `00_respaldo_y_restauracion.sql` | `e668f9facca68735a9f597495602ef335dfd651b2942295c896fab7652af8607` | Plantilla de backup CHECKSUM y verificación de restauración para DBA. |
| 01 | `01_preflight.sql` | `7f222801c637b30d7d9f85758019f91e7ead4d2321422cf5eb715984cca0ad64` | Verificación de solo lectura de restricciones, claves huérfanas y estados. |
| 02 | `02_incremental.sql` | `e178d7d6638c3d3fbcd36755319fdfc9a4b016171834b8625ae2cd35e11d7fb6` | Transacción DDL: crea tablas, añade columnas, instala SPs seguros y dimensiones. |
| 03 | `03_postflight.sql` | `792db35cc953c9b2b92098d62c22daace87dee822c96ffa2c75c0838111cb5f5` | Validación de solo lectura posterior para verificar presencia de objetos. |
| 04 | `04_carga_customer_aprobada.sql` | `494d65960f8c552d13046a43e4b5362945711de5bf10a7f75ccd1901c6b49a07` | Ejecución explícitamente autorizada del ETL conservador sincronizado. |
| 05 | `05_reversion_modulos.sql` | `78d8af2282030291f93c73e5c4029e7b9979c4786460b8057c51460de81f8742` | Rollback aditivo de módulos y procedimientos almacenados sin pérdida de datos. |
| 06 | `06_permisos_cuentas.sql` | `130c5f700c3054735c5603fe32993f4c26c124ee746b879ab9b3d03941b81d7e` | Asignación estricta de permisos de solo lectura al usuario analítico. |
| 15 | `15_etl_customer_conservador.sql` | `21d0068e8bad15373106247f2053cf6e5c27e0e44416239a2abff5e06a896e3b` | Código fuente del ETL conservador libre de sentencias DELETE/TRUNCATE. |

---

## 3. Protocolo de Ejecución en Ventana de Mantenimiento

Para desplegar sobre `NexoSaludDB` y `NexoSalud_Mart`, se debe seguir estrictamente la siguiente secuencia de 6 pasos:

### Paso 1: Notificación y Aislamiento de Tráfico
- Pausar los servicios de ingesta de la aplicación (`PORT=3001`).
- Asegurar que no existan transacciones activas de usuarios.

### Paso 2: Respaldo Completo Verificado
```sql
-- Ejecutar plantilla 00_respaldo_y_restauracion.sql definiendo variables:
BACKUP DATABASE [NexoSaludDB] TO DISK=N'$(BackupDir)\\NexoSaludDB_$(ReleaseId).bak' WITH COPY_ONLY, CHECKSUM, COMPRESSION;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$(BackupDir)\\NexoSalud_Mart_$(ReleaseId).bak' WITH COPY_ONLY, CHECKSUM, COMPRESSION;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\\NexoSaludDB_$(ReleaseId).bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\\NexoSalud_Mart_$(ReleaseId).bak' WITH CHECKSUM;
```

### Paso 3: Comprobación Previa (Pre-flight)
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/01_preflight.sql -b
```
*Si este paso arroja error 56501 a 56506, el despliegue se detiene de inmediato sin haber realizado modificaciones.*

### Paso 4: Migración Incremental Transaccional
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/02_incremental.sql -b
```
*Aplica cambios dentro de `BEGIN TRANSACTION ... COMMIT TRANSACTION` con `SET XACT_ABORT ON`.*

### Paso 5: Comprobación Posterior (Post-flight) y Permisos
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/03_postflight.sql -b
sqlcmd -S localhost -d NexoSalud_Mart -v BiReader="NexoSaludBIRead" -i database/customer/deployment/20261112/06_permisos_cuentas.sql -b
```

### Paso 6: Carga Sincronizada y Conciliación
```bash
sqlcmd -S localhost -d NexoSalud_Mart -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/04_carga_customer_aprobada.sql -b
```

---

## 4. Plan de Reversión y Mitigación de Riesgos (Rollback)

1. **Reversión de Procedimientos Almacenados:** Si el aplicativo presenta anomalías tras la migración, se ejecuta `05_reversion_modulos.sql`, que reinstala las firmas anteriores de los módulos sin eliminar columnas ni datos recolectados.
2. **Reversión por Restauración de Copia de Seguridad:** Si se requiere un retroceso integral del estado del motor, el DBA restaurará las copias `_$(ReleaseId).bak` en una ubicación verificada.
3. **Punto de Recuperación (RPO / RTO):**
   - **RPO Objetivo:** 0 minutos (el respaldo previo se toma con el tráfico web pausado).
   - **RTO Objetivo:** Menor a 15 minutos (tiempo estimado de compilación y verificación post-vuelo).
"""

write_doc('PLAN_MIGRACION_OLTP_MART.md', doc_2)

# ==============================================================================
# 3. RECONCILIACION_MART_PRINCIPAL.md
# ==============================================================================
doc_3 = """# Reconciliación del Data Mart Principal — NexoSalud_Mart

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
"""

write_doc('RECONCILIACION_MART_PRINCIPAL.md', doc_3)

# ==============================================================================
# 4. INTEGRACION_IA15_IA18.md
# ==============================================================================
doc_4 = """# Integración de Capacidades Analíticas — Actividades IA15 a IA18

**Ampliación del Agente Inteligente CUSTOMER hacia el Data Mart**  
**Fecha:** 12 de noviembre de 2026  
**Servicio Backend:** `backend/src/modules/customer/ai-agent/services/customerAnalyticsService.ts`  
**Registro de Herramientas:** `backend/src/modules/customer/ai-agent/llm/toolRegistry.ts`

---

## 1. Justificación y Alcance de las Nuevas Actividades

El agente inteligente de NexoSalud ha sido ampliado de 14 a 18 actividades para incorporar análisis de Inteligencia de Negocios (BI) sobre el Data Mart `NexoSalud_Mart`, manteniendo intactas las 14 actividades operacionales (IA01–IA14) y las 8 alertas asistenciales (ALT-C01–ALT-C08).

Las actividades IA15–IA18 delegan todo cómputo matemático, agregación y cálculo de tasas al motor SQL Server. Gemini actúa exclusivamente como un **intérprete normativo y explicativo de los resultados recuperados**, garantizando que el modelo de lenguaje jamás invente porcentajes, conteos ni tendencias.

---

## 2. Especificación Técnica de IA15 a IA18

### IA15 — Consultar Indicadores de Tratamientos
- **Herramienta Backend:** `getTreatmentAnalytics`
- **Tabla de Hechos:** `NexoSalud_Mart.dbo.Fact_TratamientoCustomer`
- **Criterio de Cohorte:** Fecha de contratación del tratamiento (`KeyTiempoContratacion`).
- **Roles Autorizados:** `ADMIN`, `ODONTOLOGO`, `RECEPCION`.
- **Métricas Retornadas por SQL:**
  - `tratamientos_iniciados`: Sumatoria de tratamientos que registraron inicio o avance.
  - `tratamientos_completados`: Tratamientos con desenlace administrativo 'Completado'.
  - `sesiones_planificadas`: Sesiones estipuladas según el plan contractual vigente.
  - `sesiones_completadas`: Sesiones efectivamente realizadas y cerradas.
  - `dias_duracion_real`: Días transcurridos entre inicio y cierre real.
  - `ratePercent`: `100.0 * sesiones_completadas / NULLIF(sesiones_planificadas, 0)`
  - `averageDuration`: `dias_duracion_real / NULLIF(tratamientos_completados, 0)`

### IA16 — Analizar Cumplimiento de Sesiones
- **Herramienta Backend:** `getSessionComplianceAnalytics`
- **Tabla de Hechos:** `NexoSalud_Mart.dbo.Fact_SesionCustomer`
- **Criterio de Cohorte:** Fecha programada vigente de la sesión (`KeyTiempoProgramada`).
- **Roles Autorizados:** `ADMIN`, `ODONTOLOGO`, `RECEPCION`.
- **Métricas Retornadas por SQL:**
  - `sesiones_programadas`: Sesiones agendadas en el período.
  - `sesiones_realizadas`: Sesiones con asistencia efectiva.
  - `sesiones_inasistidas`: Sesiones marcadas con inasistencia del paciente.
  - `reprogramaciones_acumuladas`: Total de cambios de agenda asociados a las sesiones de la cohorte.
  - `minutos_espera`: Minutos entre la llegada y el ingreso a sillón.
  - `ratePercent`: `100.0 * sesiones_realizadas / NULLIF(sesion_evaluable, 0)`
  - `averageDuration`: `minutos_espera / NULLIF(tiene_espera_medible, 0)`

### IA17 — Analizar Atenciones y Documentación Clínica
- **Herramienta Backend:** `getClinicalDocumentationAnalytics`
- **Tabla de Hechos:** `NexoSalud_Mart.dbo.Fact_AtencionCustomer_V2`
- **Criterio de Cohorte:** Fecha de la atención asistencial (`KeyTiempoAtencion`).
- **Roles Autorizados:** `ADMIN`, `ODONTOLOGO` (Restringido para `RECEPCION`).
- **Métricas Retornadas por SQL:**
  - `atenciones_realizadas`: Consultas y procedimientos realizados.
  - `minutos_consulta`: Duración total en sillón clínico.
  - `fichas_completas`: Atenciones validadas como completas en primera revisión.
  - `indicaciones_emitidas`: Documentos de alta post-atención vigentes y emitidos.
  - `procedimientos_registrados`: Total de procedimientos dentales detallados.
  - `ratePercent`: `100.0 * fichas_completas / NULLIF(atenciones_realizadas, 0)`
  - `averageDuration`: `minutos_consulta / NULLIF(tiene_duracion_medible, 0)`

### IA18 — Analizar Desempeño del Agente Inteligente
- **Herramienta Backend:** `getAiPerformanceAnalytics`
- **Tabla de Hechos:** `NexoSalud_Mart.dbo.Fact_InteraccionIACustomer`
- **Criterio de Cohorte:** Fecha del evento o documento (`KeyTiempoEvento`).
- **Roles Autorizados:** `ADMIN`, `ODONTOLOGO` (Restringido para `RECEPCION`).
- **Métricas Retornadas por SQL:**
  - `interacciones_registradas`: Conversaciones y consultas operacionales del agente.
  - `alertas_generadas`: Alertas emitidas por reglas preventivas deterministas.
  - `alertas_atendidas`: Alertas revisadas o resueltas por personal autorizado.
  - `borradores_generados`: Propuestas documentales organizadas por el agente.
  - `borradores_aprobados`: Borradores transferidos o aprobados por el odontólogo.

---

## 3. Contratos de Entrada, Seguridad y Validación (`parseAnalyticsFilter`)

Cualquier invocación analítica debe superar la validación determinista de tipos:
1. `startDate` y `endDate`: Cadenas obligatorias en formato estricto `YYYY-MM-DD`. Deben representar fechas calendario válidas en UTC.
2. `Rango Máximo:` Entre 1 y 366 días inclusive. Se rechazan intervalos negativos o que excedan un año calendario.
3. `groupBy`: Opciones restringidas a lista cerrada: `'none'`, `'month'`, `'branch'`, `'service'`.
4. `branchId` y `serviceId`: Enteros positivos seguros.
5. `Bloqueo de Inyección:` Se prohíbe cualquier propiedad adicional (`additionalProperties: false`). Las consultas SQL se ensamblan únicamente mediante identificadores parametrizados en `@prisma/client`.

---

## 4. Transparencia y Frescura del Data Mart

Toda respuesta emitida por el backend o explicada por Gemini incluye metadatos de frescura:
- `lastSuccessfulSync`: Marca de tiempo de la última ejecución completada con éxito registrada en `ETL_EjecucionLog`.
- `latestLoadStatus`: Estado de la última carga del proceso ETL.
- `Aviso de No Tiempo Real:` **"El Mart no es información en tiempo real. La fecha de carga histórica no incluye zona horaria; no equivale a la fecha del evento transaccional."**
"""

write_doc('INTEGRACION_IA15_IA18.md', doc_4)

# ==============================================================================
# 5. PRUEBAS_CONEXIONES_Y_SEGURIDAD.md
# ==============================================================================
doc_5 = """# Pruebas de Conexión, Seguridad y Autorización

**Certificación de Seguridad, Control de Acceso y Resiliencia**  
**Fecha:** 12 de noviembre de 2026  
**Resultado Global:** Certificación Técnica Completa en Entorno Test Aislado

---

## 1. Matriz de Control de Acceso por Rol (RBAC)

Se implementó una barrera de cuatro niveles que combina autenticación JWT con firma de sesión, validación de perfil en capa de aplicación y filtrado en la consulta SQL Server:

| Perfil / Rol | Actividades Operacionales (OLTP) | Actividades Analíticas (Mart) | Restricción Dimensional en SQL |
|---|---|---|---|
| **PACIENTE** | IA01, IA02, IA03, IA04, IA05, IA06, IA12, IA14. | **Ninguna (Acceso Bloqueado HTTP 403).** | Acceso a Mart revocado por software y por contrato. |
| **ODONTOLOGO** | IA05, IA07, IA08, IA09, IA10, IA11, IA12, IA13, IA14; Alertas ALT-C01 a C08. | IA15, IA16, IA17, IA18. | **Ámbito Profesional Propio:** Cláusula `AND f.KeyProfesional IN (SELECT KeyProfesional FROM Dim_Profesional WHERE id_profesional = @idProfesional)`. No visualiza métricas de otros médicos. |
| **RECEPCION** | IA03, IA04, IA05, IA08, IA14; Alertas ALT-C01, C02, C03. | IA15, IA16 (Exclusivamente). | Bloqueo estricto de IA17 (documentación médica) e IA18 (desempeño de IA). |
| **ADMINISTRADOR** | Todas las operacionales bajo supervisión. | IA15, IA16, IA17, IA18. | Ámbito Institucional Agregado Global. |

---

## 2. Seguridad de Conexión a la Base de Datos Analítica

La identidad analítica para consultar `NexoSalud_Mart` cumple con los principios de seguridad defensiva:
1. **Solo SELECT:** Concede permisos `GRANT SELECT` únicamente sobre las 4 tablas de hechos (`Fact_TratamientoCustomer`, `Fact_SesionCustomer`, `Fact_AtencionCustomer_V2`, `Fact_InteraccionIACustomer`), las dimensiones vinculadas y la bitácora `ETL_EjecucionLog`.
2. **Denegación Explícita:** `DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::dbo TO [NexoSaludBIRead]`.
3. **Imposibilidad de DDL:** La cuenta no posee privilegios para alterar tablas, compilar vistas ni modificar la estructura.
4. **Sin Cadena de Propiedad:** Las credenciales OLTP y Mart son independientes; no se utiliza suplantación cruzada de identidad ni llamadas RPC arbitrarias entre bases.

---

## 3. Resultados de Pruebas Automatizadas

El conjunto de pruebas ejecutadas de forma automatizada sobre el entorno aislado certificó la estabilidad del sistema:

### A. Pruebas Backend (Vitest — 249 Pruebas Pasadas)
- `customerAcademicTraceability.test.ts` (27 pruebas): Verificación de contratos, aislamiento de roles y trazabilidad de IA01 a IA18.
- `customerAnalyticsIntegration.test.ts` (13 pruebas): Consultas reales en Mart, validación de parámetros, agregaciones, roles y orquestador BI.
- `customerCompletionIntegration.test.ts` (28 pruebas): Concurrencia real, programación segura, cierres transaccionales y bloqueo de bypass SQL.
- `customerCompletionMart.test.ts` (1 prueba): Conciliación determinista de las 20 medidas dimensionales al mismo corte transaccional.
- `customerAiCertificationP01P32.test.ts` (32 pruebas): Certificación exhaustiva de políticas de negocio P01 a P32.
- `customerAiPilotFunctional.test.ts` (14 pruebas): Escenarios piloto funcionales PIL-01 a PIL-14.
- `customerKnowledgeBaseCertificationP01P32.test.ts` (32 pruebas): RAG determinista y corpus institucional.
- `customerAiPerformance.test.ts` (8 pruebas): Benchmarks de latencia y pruebas de resiliencia ante caída del proveedor LLM.
- `customerAiSecurityEvaluation.test.ts` (8 pruebas): Verificación de restricciones CHECK anti-diagnóstico y protección contra SQL injection.

### B. Pruebas Frontend (Vitest — 49 Pruebas Pasadas)
- Certificación de interfaces F01 a F30.
- Renderizado seguro de componentes sin exposición de identificadores clínicos sensibles.
- Generación y descarga de constancias en formato PDF.

### C. Pruebas de Extremo a Extremo (Playwright E2E — 6 Pruebas Pasadas)
1. **Portal del Paciente:** Autenticación, visualización de cronograma y solicitud de programación asistida.
2. **Recepción:** Revisión y aplicación transaccional de solicitudes de sesión.
3. **Reprogramación:** Flujo completo de solicitud y aplicación de cambio de agenda.
4. **Copiloto Clínico:** Flujo del odontólogo: asistencia documental por secciones, versionado de borradores y transferencia explícita a ficha.
5. **Portal Móvil:** Verificación de responsive design en viewport estrecho (390x844) sin desbordamiento horizontal.
6. **Análisis Inteligente BI:** Selección de filtros, consulta de indicadores multidimensionales y explicación interactiva por rol.

---

## 4. Benchmarks de Rendimiento

Mediciones obtenidas en pruebas de estrés y latencia (`customerAiPerformance.test.ts`):
- **Emisión / Validación de Tokens:** p50 = 0.01 ms, p95 = 0.03 ms.
- **Consulta de Tratamientos:** p50 = 1.76 ms, p95 = 4.12 ms.
- **Consulta de Sesiones Próximas:** p50 = 1.64 ms, p95 = 2.91 ms.
- **Búsqueda RAG Léxica (BM25):** p50 = 1.66 ms, p95 = 4.45 ms.
- **Orquestación Conversacional (Simulada):** p50 = 1.84 ms, p95 = 2.98 ms.
"""

write_doc('PRUEBAS_CONEXIONES_Y_SEGURIDAD.md', doc_5)

# ==============================================================================
# 6. INFORME_ACADEMICO_18_ACTIVIDADES.md
# ==============================================================================
doc_6 = """# Sistema NexoSalud: Arquitectura y Evaluación del Agente Inteligente CUSTOMER con Integración Dual OLTP y Data Mart

**Informe Académico Final — 18 Actividades y 8 Alertas Asistenciales**  
**Fecha:** 12 de noviembre de 2026  
**Autores:** Equipo de Arquitectura e Inteligencia de Negocios NexoSalud  
**Ámbito Académico:** Ingeniería de Software, Inteligencia Artificial y Sistemas de Información en Salud

---

## 1. Arquitectura Integral del Sistema (10 Componentes)

El sistema NexoSalud implementa una arquitectura desacoplada y orientada a la gobernanza clínica, que articula la asistencia transaccional en tiempo real con el análisis multidimensional de inteligencia de negocios:

```
[1. Portal del Paciente]      [2. Copiloto Personal de Salud]
   (React / Tailwind)             (React / Workspace Staff)
           |                                  |
           +----------------+-----------------+
                            | (HTTP / REST / JWT Bearer)
                            v
             +------------------------------+
             |    3. Backend de Negocio     |
             |  (Node.js / Express / TS)    |
             +------------------------------+
               |              |            |
               v              |            v
    +--------------------+    |    +-----------------------------+
    | 4. Motor de Reglas |    |    | 5. Agente Conversacional    |
    |  (Alertas, Cierres,|    |    |    Gemini & RAG Oficial     |
    |   Validaciones)    |    |    |   (Tool Registry Acotado)   |
    +--------------------+    |    +-----------------------------+
               |              |                   |
               +--------------+                   |
                              |                   |
               +--------------+                   |
               | (Lectura / Escritura             | (Herramientas Backend
               |  Transaccional)                  |  Sin SQL Libre)
               v                                  v
    +--------------------+             +-----------------------------+
    | 6. NexoSaludDB     |             | 9. Servicios Analíticos BI  |
    | (Base OLTP)        |             | (Consultas Parametrizadas)  |
    +--------------------+             +-----------------------------+
               |                                  |
               | 7. Pipeline ETL Conservador      | (SELECT Solo Lectura)
               |    (usp_ETL_SincronizarCustomer) |
               v                                  v
    +------------------------------------------------------------+
    | 8. NexoSalud_Mart (Data Mart Analítico - Esquema Estrella) |
    +------------------------------------------------------------+
                                   ^
                                   | (Registro Transaccional de Eventos)
    +------------------------------------------------------------+
    | 10. Subsistema de Auditoría y Trazabilidad Inmutable       |
    +------------------------------------------------------------+
```

### Descripción de los 10 Componentes Arquitectónicos:
1. **Portal del Paciente:** Interfaz web adaptativa y accesible que permite consultar citas, avances administrativos, indicaciones aprobadas y preparar solicitudes de reprogramación o nuevas sesiones.
2. **Copiloto Profesional y Administrativo:** Espacio de trabajo para odontólogos y personal de recepción con asistencia documental, validación de fichas, gestión de alertas y análisis de métricas.
3. **Backend de Negocio:** Servidor centralizado en Node.js/Express que encapsula la lógica de dominio, autenticación de sesión y autorización por rol.
4. **Motor de Reglas Clínico-Administrativas:** Módulo determinista que ejecuta periódicamente la detección de las alertas ALT-C01 a ALT-C08 y verifica requisitos documentales publicados.
5. **Agente Conversacional Gemini & RAG Oficial:** Orquestador de lenguaje natural dotado de catálogo cerrado de herramientas (`toolRegistry.ts`), control de alucinación y citas documentales verificadas.
6. **NexoSaludDB (Base de Datos OLTP):** Motor relacional SQL Server que custodia la verdad operativa, historias clínicas, turnos y eventos asistenciales.
7. **Pipeline ETL Conservador:** Procedimiento almacenado `usp_ETL_SincronizarCustomerMart` con sentencias `MERGE` aditivas, libre de comandos destructivos (`DELETE`/`TRUNCATE`), garantizando la preservación de hechos históricos.
8. **NexoSalud_Mart (Data Mart Analítico):** Almacén dimensional con hechos de tratamientos, sesiones, atenciones e interacciones IA bajo esquema estrella.
9. **Servicios de Consulta Analítica:** Capa backend de solo lectura (`CustomerAnalyticsService`) que ejecuta agregaciones deterministas en SQL Server para servir a la interfaz y al agente.
10. **Subsistema de Auditoría y Trazabilidad:** Bitácora inmutable en `InteraccionesIA` y `ETL_EjecucionLog` que registra el actor, la acción, la latencia y la justificación de cada operación.

---

## 2. Matriz Académica de las 18 Actividades del Agente Inteligente

Tabla integral con las 9 columnas metodológicas normalizadas:

| Código | Usuario | Actividad | Activación | Procesamiento | Salida | Automatización | Control Humano / Limitación | Intervención Específica de la IA |
|---|---|---|---|---|---|---|---|---|
| **IA01** | Paciente | Consultar cronograma | Portal o pregunta en el chat. | Autorización por propietario; selección de tratamiento; consulta de sesiones, fechas, profesional, sede y estados canónicos en OLTP. | Cronograma vigente e historial de cambios de agenda. | Consulta automática de solo lectura. | Una cita no acredita asistencia; no expone tratamientos ajenos. | Interpreta la consulta y explica las fechas recuperadas mediante la herramienta autorizada. |
| **IA02** | Paciente | Consultar progreso administrativo | Selección de tratamiento o conversación. | Lee plan vigente; cuenta sesiones completadas exclusivamente con `Realizada + Cerrada`; cálculo determinista de avance. | Porcentaje de avance administrativo y conteo de sesiones. | Backend calcula avance y lo entrega al agente. | No expresa evolución ni recuperación clínica; no oculta discrepancias. | Interpreta la intención del paciente y explica el avance administrativo sin alterar cifras. |
| **IA03** | Paciente y Recepción | Solicitar programación CUSTOMER | Sesión posterior del plan sin programación. | Propuesta firmada temporal de 15 min; confirmación del paciente; solicitud persistente; revisión y aplicación en agenda por recepción. | Solicitud trazable hasta 'Aplicada' y sesión oficial creada. | Preparación asistida; aplicación humana obligatoria. | No reserva cupo al preparar; no aplica en agenda sin decisión humana; idempotente. | Guía al paciente a seleccionar ordinales pendientes y genera la propuesta no vinculante. |
| **IA04** | Paciente y Recepción | Solicitar reprogramación | Selección de sesión futura elegible. | Propuesta de cambio con motivo; confirmación; revisión humana; aprobación y aplicación en horario oficial por recepción. | Solicitud registrada, nuevo horario asignado y evento histórico. | Validación de horarios y preparación asistida; aplicación administrativa. | La aprobación no equivale a la aplicación en agenda; requiere disponibilidad real. | Identifica preferencias del paciente y redacta la solicitud estructurada. |
| **IA05** | Paciente y Personal | Resolver preguntas institucionales | Pregunta en lenguaje natural sobre protocolos. | Búsqueda léxica BM25 en almacén de conocimiento duradero; verificación estricta de citas; rechazo si no hay evidencia. | Respuesta respaldada con código de documento y versión vigente. | Recuperación léxica y citación asistida. | No genera políticas clínicas; no responde sobre tratamientos médicos individuales. | Redacta la respuesta exclusivamente con base en los fragmentos autorizados recuperados. |
| **IA06** | Paciente | Consultar indicaciones finales | Consulta conversacional o botón en portal. | Filtra versión vigente aprobada y emitida de la atención propia; recupera texto íntegro sin alteraciones. | Indicaciones post-atención literales con cantidades y frecuencia. | Consulta y entrega controlada de datos aprobados. | No modifica posología ni interpreta síntomas; consulta médica requerida ante dudas. | Localiza el documento emitido y lo presenta conservando íntegro su significado clínico. |
| **IA07** | Odontólogo | Preparar contexto de sesión | Selección de paciente asignado al turno. | Agrupa tratamiento, plan, alergias documentadas, antecedentes, atenciones previas y checklist de sesión en OLTP. | Resumen clínico-documental estructurado con identificadores. | Organización automática de información registrada. | Antecedente no registrado no implica ausencia clínica; no inventa historial. | Sintetiza los datos autorizados para optimizar el tiempo de consulta profesional. |
| **IA08** | Personal Autorizado | Presentar alertas preventivas | Evento de negocio, carga de pantalla o lote. | Evaluación de reglas de negocio ALT-C01 a ALT-C08 sobre `NexoSaludDB`; deduplicación por entidad y estado abierto. | Bandeja de alertas con código, responsable y severidad documental. | Detección determinista en backend. | No emite diagnósticos ni triaje médico; la severidad es procedimental. | Contextualiza la advertencia y expone los motivos normativos que la generaron. |
| **IA09** | Odontólogo | Asistir registro clínico | Notas preliminares ingresadas por el médico. | Borrador extractivo estructurado por secciones (motivo, evaluación, procedimiento, alergias); control de versiones y hash. | Borrador clínico editable con historial de versiones. | Estructuración asistida; transferencia manual obligatoria. | No inventa signos ni síntomas; ficha cerrada o modificada bloquea la transferencia. | Organiza exclusivamente el texto dictado o ingresado por el odontólogo tratante. |
| **IA10** | Odontólogo | Preparar indicaciones | Atención seleccionada y notas de consulta. | Propuesta de recomendaciones basada en plantilla aprobada por servicio o notas registradas; versión preliminar. | Borrador de indicaciones post-atención listo para revisión. | Preparación asistida de texto. | Gemini no aprueba ni emite; la emisión oficial requiere clic y firma del médico. | Redacta sugerencias de cuidados según el procedimiento dental registrado. |
| **IA11** | Odontólogo | Verificar documentación | Comprobar requisitos antes del cierre. | Cotejo contra política `DOCUMENTACION` publicada para el servicio; verificación de campos obligatorios e indicaciones. | Informe de completitud (Completa o Incompleta con pendientes). | Evaluación algorítmica de campos en backend. | Sin política aprobada se bloquea el cierre; la IA no declara completitud clínica. | Explica detalladamente cuáles campos faltan según el protocolo del servicio. |
| **IA12** | Odontólogo y Paciente | Actualizar progreso de sesiones | Cierre supervisado de la atención asistencial. | Procedimiento `usp_CerrarSesionClinica`; valida estado de sesión, atención realizada y validación documental previa. | Estado de sesión actualizado a 'Cerrada' y avance recalculado. | Transición atómica en SQL Server. | No realiza auto-altas por conteo de citas; requiere confirmación médica. | Notifica el nuevo estado y explica el avance logrado en el plan general. |
| **IA13** | Odontólogo | Preparar y decidir cierre del tratamiento | Solicitud de cierre formal del tratamiento. | Procedimiento `usp_CerrarTratamientoYTransicionarTurned`; verifica sesiones cerradas, saldos y checklist asistencial. | Tratamiento en estado 'Completado' y transición a seguimiento. | Cierre transaccional supervisado. | Conteo no sustituye criterio clínico; excepciones obligan a justificación humana. | Consolida el expediente y resalta pendientes antes de la decisión del odontólogo. |
| **IA14** | Todos los Perfiles | Registrar trazabilidad | Cualquier consulta, acción o conversación. | Persistencia transaccional en `InteraccionesIA` con actor real, código de evento, token de correlación y latencia. | Registro inmutable de auditoría para gobernanza y BI. | Registro automático no bloqueante en cada endpoint. | No almacena datos personales ni conversaciones completas por defecto. | El agente opera sobre canales auditados; el registro lo asegura el backend. |
| **IA15** | Administrador, Odontólogo, Recepción | Consultar indicadores de tratamientos | Consulta analítica en panel BI o pregunta al agente. | Consulta parametrizada sobre `Fact_TratamientoCustomer` en `NexoSalud_Mart`; agregación de iniciados, completados y duración. | Indicadores agregados de cohorte, tasa de cumplimiento y duración media. | Cálculo determinista en SQL Server. | Odontólogo limitado a su propia producción; no expone identidad de pacientes. | Interpreta la consulta, invoca `getTreatmentAnalytics` y explica las tendencias calculadas por SQL. |
| **IA16** | Administrador, Odontólogo, Recepción | Analizar cumplimiento de sesiones | Consulta analítica en panel BI o chat analítico. | Consulta parametrizada sobre `Fact_SesionCustomer`; agrega sesiones programadas, realizadas, inasistencias y esperas. | Tasa de asistencia, reprogramaciones acumuladas y promedio de espera. | Cómputo matemático en base de datos dimensional. | Recepción limitada a indicadores operacionales; no accede a fichas médicas. | Explica la tasa de inasistencia y el impacto de las reprogramaciones en la cohorte. |
| **IA17** | Administrador, Odontólogo | Analizar atenciones y documentación | Consulta analítica de gestión clínica. | Consulta parametrizada sobre `Fact_AtencionCustomer_V2`; cálculo de atenciones, fichas completas e indicaciones. | Porcentaje de completitud documental en primera validación y duración en sillón. | Ejecución SQL sobre hechos analíticos. | Acceso denegado a Recepción y Pacientes; solo personal clínico o dirección. | Identifica cuellos de botella en la documentación y explica los promedios calculados. |
| **IA18** | Administrador, Odontólogo | Analizar desempeño del agente inteligente | Auditoría y evaluación del copiloto IA. | Consulta parametrizada sobre `Fact_InteraccionIACustomer`; agrega interacciones, alertas generadas/atendidas y borradores. | Métricas de adopción, efectividad de alertas y volumen de borradores aprobados. | Agregación dimensional en Data Mart. | No lista textos privados ni datos sensibles de interacciones individuales. | Explica la tasa de resolución de alertas y la productividad de los borradores asistidos. |

---

## 3. Matriz de Alertas Asistenciales y Operacionales (ALT-C01 a ALT-C08)

Las 8 alertas preventivas operan sobre datos vigentes de `NexoSaludDB` y alimentan la bandeja del personal:

| Código | Denominación | Condición Disparadora | Destinatarios | Resolución / Acción Requerida |
|---|---|---|---|---|
| **ALT-C01** | Sesión próxima sin confirmación | Sesión futura dentro de la ventana de confirmación publicada que permanece en estado no confirmada. | Paciente y Recepción | Se resuelve cuando el paciente confirma en el portal o recepción valida contacto telefónico. |
| **ALT-C02** | Sesión vencida sin desenlace | El horario final de la cita transcurrió y la sesión continúa marcada como 'Pendiente' en agenda. | Recepción | Recepción contacta al paciente y registra el desenlace formal (Realizada, Inasistida o Cancelada). |
| **ALT-C03** | Plan activo con sesiones sin programar | Tratamiento activo con sesiones planificadas en el contrato que aún no cuentan con cita asignada. | Recepción y Paciente | Invoca el flujo IA03 para seleccionar slot oficial y programar la siguiente sesión. |
| **ALT-C04** | Alergia o antecedente para revisión | Alergia documentada o antecedente clínico crítico que requiere verificación previa a la atención. | Odontólogo Tratante | El odontólogo revisa el antecedente en sillón y confirma su pertinencia clínica en el expediente. |
| **ALT-C05** | Requisitos documentales pendientes | Atención realizada que carece de campos obligatorios o validación documental según política del servicio. | Odontólogo | El médico subsana los campos observados y revalida la ficha mediante IA11. |
| **ALT-C06** | Borrador post-atención sin aprobación | Borrador de indicaciones generado que no ha sido aprobado ni emitido tras finalizar la consulta. | Odontólogo | El profesional revisa el texto, aplica correcciones y aprueba/emite el documento oficial. |
| **ALT-C07** | Sesiones gestionadas sin cierre formal | Todas las sesiones del plan han sido realizadas o gestionadas, pero el tratamiento continúa activo. | Odontólogo Responsable | Evaluación del checklist de alta y ejecución del cierre formal mediante IA13. |
| **ALT-C08** | Consulta que requiere revisión humana | El paciente manifiesta dudas complejas, dolor o síntomas que activan protocolo de derivación supervisada. | Odontólogo Responsable | Se genera solicitud prioritaria en bandeja médica; el copiloto se abstiene de diagnosticar. |

---

## 4. Diferenciación Metodológica: Cómputo SQL Server vs. Interpretación Cognitiva IA

Para garantizar rigor académico y seguridad clínica, el sistema separa de manera radical el cálculo de datos de la interpretación lingüística:

```
+-------------------------------------------------------------------------------+
|                       CAPA COMPUTACIONAL (SQL SERVER)                         |
|  - Cómputo de sumas, conteos, diferencias de fechas (DATEDIFF).               |
|  - Cálculo de tasas: 100.0 * completadas / NULLIF(planificadas, 0).          |
|  - Agrupación dimensional por Sede, Servicio y Mes cronológico.               |
|  - Aplicación de restricciones de seguridad (RBAC por id_profesional).        |
|  - Estado determinista: Sin fluctuaciones estocásticas ni redondeos opacos.   |
+-------------------------------------------------------------------------------+
                                        |
                                        | (Payload estructurado JSON / Solo Lectura)
                                        v
+-------------------------------------------------------------------------------+
|                  CAPA COGNITIVA INTERPRETATIVA (GEMINI LLM)                   |
|  - Lectura exclusiva del resultado pre-calculado por SQL Server.              |
|  - Prohibición estricta de generar o inventar cifras, denominadores o fechas. |
|  - Contextualización de la cohorte analítica y aclaración de no-tiempo-real.  |
|  - Explicación accesible en lenguaje natural adaptada al perfil del usuario.  |
|  - Incorporación obligatoria de limitaciones y advertencias de gobernanza.    |
+-------------------------------------------------------------------------------+
```

---

## 5. Declaración de Cumplimiento y Disponibilidad Operativa

1. **Entorno Certificado:** Todas las pruebas unitarias, de integración, E2E y de conciliación dimensional corrieron satisfactoriamente sobre el banco de pruebas aislado (`_Test`).
2. **Entorno Principal:** Las bases principales `NexoSaludDB` y `NexoSalud_Mart` se encuentran diagnosticadas, con inventario de diferencias cerrado y con el paquete de despliegue `customer-20261112` preparado para su ejecución en ventana de mantenimiento autorizada.
3. **Disponibilidad:** El sistema cuenta con 18 actividades especificadas, probadas e integradas en la interfaz de usuario de NexoSalud.
"""

write_doc('INFORME_ACADEMICO_18_ACTIVIDADES.md', doc_6)

print('Los 6 documentos fueron generados con éxito.')
