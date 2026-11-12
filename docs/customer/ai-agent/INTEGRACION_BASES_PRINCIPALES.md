# Integración Definitiva con NexoSaludDB y NexoSalud_Mart

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
