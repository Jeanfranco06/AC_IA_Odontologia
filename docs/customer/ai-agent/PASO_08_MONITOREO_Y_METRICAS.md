# PASO 8 — SISTEMA DE MONITOREO, TELEMETRÍA Y ALERTAS OPERATIVAS
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Especificación y Operación del Sistema de Observabilidad  
**Entorno:** Preproducción / Staging  
**Fecha:** 2026-11-11  

---

## 1. PRINCIPIO DE SEPARACIÓN CONCEPTUAL

Uno de los principios de diseño fundamentales implementados en el Paso 8 es la **separación categórica entre las alertas operativas técnicas y las alertas clínicas asistenciales**:

| Dimensión | Alertas Operativas Técnicas | Alertas Clínicas Asistenciales (`AlertasIA`) |
| :--- | :--- | :--- |
| **Objetivo** | Salud de infraestructura, latencias y disponibilidad del sistema. | Cumplimiento asistencial, omisión de notas y seguridad del paciente. |
| **Destinatarios** | Equipo de DevOps, SRE y Administradores de Sistemas. | Odontólogos tratantes y Personal de Recepción / Supervisión Clínica. |
| **Mecanismo** | Endpoints HTTP `/health/*`, `/metrics`, logs estructurados. | Entidad `AlertasIA` en SQL Server, badges en interfaz clínica. |
| **Ejemplos** | BD inaccesible (HTTP 503), latencia p95 > 2500ms, fallos 5xx. | Atención sin nota de evolución, sesión sin indicación postatención. |

---

## 2. ARQUITECTURA DE TELEMETRÍA Y OBSERVABILIDAD

El backend implementa un recolector de métricas desacoplado en memoria con capacidad de volcado y consulta en tiempo real ([`metricsCollector.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/src/modules/customer/ai-agent/monitoring/metricsCollector.ts)).

### Métricas Recolectadas

1. **Latencias de Petición HTTP (`http_latency_ms`):**
   - Recolección de muestras temporales.
   - Cálculo dinámico de percentiles: **p50 (mediana)** y **p95 (cola crítica)**.
   - Latencia promedio global.
2. **Volumen de Solicitudes y Concurrencia:**
   - Contador de peticiones entrantes totales.
   - Distribución de códigos de respuesta HTTP (2xx, 4xx, 5xx).
3. **Métricas del Proveedor LLM (Gemini):**
   - Conteo de llamadas exitosas y fallidas al API de Gemini.
   - Tiempo de respuesta de la inferencia generativa.
   - Tasa de errores y activación de mecanismos de fallback / degradación elegante.
4. **Métricas de Herramientas (Function Calling):**
   - Conteo de ejecuciones por nombre de herramienta (`consultarTratamientosActivos`, etc.).
   - Errores de validación de entrada vs excepciones de base de datos.
5. **Métricas de Búsqueda RAG Lexical BM25:**
   - Frecuencia de consultas a la base documental.
   - Latencia promedio de indexación y búsqueda vectorial/lexical.

---

## 3. ENDPOINTS DE HEALTH CHECKS Y TELEMETRÍA

Los endpoints se encuentran registrados bajo el prefijo raíz `/health` y `/metrics` en [`healthRoutes.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/src/modules/customer/ai-agent/monitoring/healthRoutes.ts):

### A. Endpoint de Liveness (`GET /health/live`)
- **Propósito:** Indicador para balanceadores y orquestadores (e.g. Kubernetes, PM2, Docker) de que el proceso Node.js responde.
- **Respuesta típica:**
  ```json
  {
    "status": "ALIVE",
    "timestamp": "2026-11-11T05:00:00.000Z",
    "uptimeSeconds": 1420
  }
  ```

### B. Endpoint de Readiness (`GET /health/ready`)
- **Propósito:** Comprueba que todas las dependencias críticas estén listas para procesar tráfico de usuario.
- **Verificaciones activas:**
  1. Conexión activa y consulta `SELECT 1` a SQL Server OLTP (`NexoSaludDB_Test`).
  2. Conexión activa a SQL Server Data Mart (`NexoSalud_Mart_Test`).
  3. Base de conocimiento RAG cargada en memoria.
- **Códigos de retorno:** `HTTP 200 OK` si todas las dependencias son saludables; `HTTP 503 Service Unavailable` si falla alguna dependencia.

### C. Endpoint de Diagnóstico Detallado (`GET /health/diag`)
- **Propósito:** Ofrece información exhaustiva sobre el entorno para personal técnico autorizado.
- **Información provista:** Estado de memoria (`heapUsed`, `heapTotal`, `rss`), versión de Node.js, entorno de ejecución, estado detallado de bases de datos y directorio RAG.

### D. Endpoint de Métricas Operativas (`GET /metrics`)
- **Propósito:** Exposición de métricas estructuradas en formato JSON / compatible con Prometheus.
- **Payload representativo:**
  ```json
  {
    "uptimeSeconds": 1420,
    "http": {
      "totalRequests": 348,
      "statusCodes": { "200": 332, "400": 12, "403": 3, "500": 1 },
      "latency": {
        "p50Ms": 4.12,
        "p95Ms": 18.45,
        "avgMs": 5.80,
        "samples": 348
      }
    },
    "llm": {
      "totalCalls": 45,
      "errors": 1,
      "avgLatencyMs": 320.15
    },
    "tools": {
      "executions": {
        "consultarTratamientosActivos": 120,
        "consultarProximasSesiones": 85,
        "consultarPoliticaInstitucional": 42
      }
    }
  }
  ```

---

## 4. MATRIZ DE UMBRALES Y DISPARADORES DE ALERTA

| Métrica | Umbral de Advertencia (Warning) | Umbral Crítico (Critical) | Acción Operativa Automatizada / Manual |
| :--- | :--- | :--- | :--- |
| **Disponibilidad BD** | Intermitencia > 1s | Fallo en `SELECT 1` (Down) | Alertar a DBA, conmuta `/health/ready` a 503, pausar orquestación. |
| **Latencia p95 (API)** | > 500 ms | > 2000 ms | Inspeccionar consultas bloqueadas en SQL Server (`sp_who2`). |
| **Tasa Errores LLM** | > 5% en 5 min | > 15% en 5 min | Activar fallback determinístico automático a respuestas base. |
| **Uso de Memoria Heap** | > 75% asignado | > 90% asignado | Reinicio controlado del proceso (reclaim de memoria en V8). |
| **Fallas de Autenticación**| > 10 en 1 min por IP | > 50 en 1 min por IP | Bloqueo perimetral temporal por sospecha de fuerza bruta. |
