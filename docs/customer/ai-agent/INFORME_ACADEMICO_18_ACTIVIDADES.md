# Sistema NexoSalud: Arquitectura y Evaluación del Agente Inteligente CUSTOMER con Integración Dual OLTP y Data Mart

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
