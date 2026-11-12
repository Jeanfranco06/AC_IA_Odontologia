# Integración de Capacidades Analíticas — Actividades IA15 a IA18

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
