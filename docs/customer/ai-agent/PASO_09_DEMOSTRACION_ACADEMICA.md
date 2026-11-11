# PASO 9 — GUION Y PROTOCOLO DE DEMOSTRACIÓN ACADÉMICA
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Protocolo Reproducible para Evaluación Docente y Presentación de Proyecto  
**Duración Estimada:** 12 a 15 Minutos  
**Público Objetivo:** Docentes y Evaluadores de Ingeniería de Sistemas, Inteligencia de Negocios y Arquitectura de Software  

---

## 1. PREPARACIÓN PREVIA DEL ENTORNO

Antes de iniciar la exposición, verificar que los servicios estén activos:
1. **Base de Datos SQL Server:** Instancia local activa con bases `NexoSaludDB_Test` y `NexoSalud_Mart_Test`.
2. **Backend Node.js:** Ejecutar `npm run dev --prefix backend` (o build previo en puerto 3001).
3. **Frontend React:** Ejecutar `npm run dev --prefix frontend` (puerto 5173).
4. **Usuarios Sintéticos de Demostración:**
   - **Paciente:** Carlos Paciente (`id_persona: 101`, DNI: `10000001`).
   - **Odontólogo:** Dra. Patricia Vargas (`id_usuario: 5`, rol: `ODONTOLOGO`).
   - **Recepción:** Carlos Recepción (`id_usuario: 11`, rol: `RECEPCION`).

---

## 2. GUION DE DEMOSTRACIÓN PASO A PASO (10 ESTACIONES)

### Estación 1: Contexto de Negocio y Recorrido E2E (1.5 min)
- **Narrativa:** Explicar que NexoSalud articula el ciclo odontológico integral: `BUYER → LEAD → PAYER → CUSTOMER → TURNED`.
- **Énfasis:** El Agente Inteligente actúa en la fase **CUSTOMER**, encargándose del acompañamiento activo al paciente en tratamiento y de asistir al odontólogo como copiloto clínico-documental.

### Estación 2: Portal del Paciente y Autogestión (1.5 min)
- **Acción:** Ingresar a `/portal/customer/patient` con credenciales de paciente sintético.
- **Demostrar:**
  - Tratamiento activo de Ortodoncia / Endodoncia.
  - Indicador de avance operativo (% completado).
  - Listado de sesiones realizadas vs pendientes y fecha destacada de la próxima cita.
- **Punto Clave:** Los datos se obtienen en tiempo real de SQL Server mediante el servicio desacoplado `CustomerAiQueryService`.

### Estación 3: Asistente Conversacional con Gemini & Function Calling (2 min)
- **Acción:** Abrir el chat del asistente en el portal del paciente.
- **Interacción:** Escribir: *"¿Cuándo es mi próxima sesión y cuántas me faltan para terminar?"*
- **Demostrar:** El orquestador ejecuta la tool `getUpcomingSessions` y responde de manera precisa y contextual sin alucinaciones.
- **Punto Clave:** Mostrar en consola la invocación limpia de la herramienta sin datos hardcodeados.

### Estación 4: Recuperación de Políticas Institucionales con RAG BM25 (1.5 min)
- **Interacción:** Preguntar: *"¿Cuál es la política de la clínica para reprogramar una cita?"*
- **Demostrar:** El asistente consulta la base de conocimiento persistente en disco y responde citando el código del documento institucional (`PILOT-POL-01`), explicando la necesidad de solicitarlo con anticipación.

### Estación 5: Flujo de Reprogramación Supervisada (2 min)
- **Acción:** Solicitar reprogramación de una cita posterior desde el portal.
- **Demostrar:**
  1. Generación del token HMAC de confirmación.
  2. Solicitud registrada en estado `Pendiente`.
  3. Cambio de rol: Ingresar con credenciales de Recepción.
  4. Recepción visualiza la solicitud, selecciona un horario disponible (`Disponibilidad`) y pulsa **Aplicar Reprogramación**.
  5. La sesión original pasa formalmente a estado `Reprogramada` en la base de datos transaccional.

### Estación 6: Workspace del Odontólogo y Copiloto Documental (2 min)
- **Acción:** Iniciar sesión como Dra. Patricia Vargas en `/staff/customer/ai-workspace`.
- **Demostrar:**
  - Bandeja de atenciones asignadas.
  - Alertas clínicas automáticas (`AL-C01`: ficha clínica incompleta, `AL-C02`: evolución pendiente).
  - Gestión justificada de la alerta (transición controlada con motivo clínico).

### Estación 7: Ciclo de Vida de Borradores y Emisión Formal Separada (2 min)
- **Acción:** Sobre una atención realizada:
  1. Pulsar **Preparar Borrador**: El copiloto genera la Versión 1.
  2. Editar el contenido en el editor (Versión 2).
  3. Pulsar **Aprobar Borrador**: El odontólogo valida explícitamente el contenido. Mostrar que el paciente *aún no lo ve*.
  4. Pulsar **Emitir Documento**: Se emite formalmente la indicación postatención.
  5. Comprobar que ahora el paciente sí tiene acceso visible a sus indicaciones aprobadas en su portal.

### Estación 8: Inteligencia de Negocios y Conciliación Dimensional (2 min)
- **Acción:** Mostrar la sincronización analítica hacia el Data Mart.
- **Demostrar:** Ejecutar la consulta SQL de conciliación:
  - Total Tratamientos OLTP = Total Tratamientos Data Mart (Delta = 0).
  - Total Sesiones OLTP = Total Sesiones Data Mart (Delta = 0).
  - Explicar la tabla de hechos `Fact_InteraccionIACustomer` que registra cada interacción, alerta y borrador con trazabilidad analítica.

### Estación 9: Seguridad Perimetral y Resiliencia (1 min)
- **Demostrar:**
  - Intento de Paciente B de consultar sesiones de Paciente A -> Error 403 Forbidden.
  - Barrera SQL Server (CHECK constraint) que impide almacenar diagnósticos autónomos por IA.
  - Endpoints de observabilidad: abrir `http://localhost:3001/health/ready` y `http://localhost:3001/metrics`.

### Estación 10: Conclusión y Cierre de la Exposición (1 min)
- **Síntesis:** Resaltar que el proyecto combina IA de última generación (Gemini + BM25 RAG) con los más altos estándares de gobernanza clínica, transaccionalidad relacional e Inteligencia de Negocios.
