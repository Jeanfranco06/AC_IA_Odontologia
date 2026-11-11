# PASO 8 — GUÍA OPERATIVA Y MANUAL DE USUARIO POR PERFIL
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Guía Práctica de Operación para Roles del Sistema  
**Entorno:** Preproducción / Staging  
**Fecha:** 2026-11-11  

---

## 1. GUÍA PARA EL PACIENTE (PORTAL DE AUTOGESTIÓN Y ASISTENTE)

### 1.1. Acceso e Identificación
1. Ingrese a la plataforma y seleccione **Portal Paciente**.
2. Digite su número de identificación (DNI / Pasaporte) y clave de acceso temporal.
3. El sistema otorgará un token de sesión seguro con vigencia limitada, restringido exclusivamente a su información médica.

### 1.2. Consulta de Tratamientos y Citas
- **Tratamientos Contratados:** En la pantalla principal visualizará sus planes de tratamiento activos, porcentaje de avance acumulado y número de sesiones realizadas vs pendientes.
- **Próximas Sesiones:** El portal destacará la fecha, hora, sede y odontólogo responsable de su próxima atención programada.

### 1.3. Uso del Asistente Conversacional
- En la esquina inferior derecha encontrará el **Asistente Virtual**.
- Puede formular preguntas cotidianas en lenguaje natural, por ejemplo:
  - *"¿Cuándo es mi próxima cita y con qué doctor me toca?"*
  - *"¿Qué cuidados debo tener tras una extracción dental?"*
  - *"¿Cuál es la política para cambiar de horario mi cita?"*
- **Importante:** El asistente le brindará información de su historial y protocolos autorizados, pero **nunca formulará diagnósticos médicos ni modificará prescripciones**. Ante dudas clínicas complejas, le sugerirá contactar a su odontólogo.

### 1.4. Solicitud de Reprogramación
1. Si requiere cambiar una cita futura (con al menos 24 horas de antelación), pulse en **"Solicitar Reprogramación"**.
2. Seleccione la fecha/franja horaria sugerida y escriba el motivo del cambio.
3. El sistema registrará la solicitud en estado `Pendiente`.
4. El personal de recepción revisará y confirmará su nueva cita, notificándole el cambio.

---

## 2. GUÍA PARA EL ODONTÓLOGO (ESPACIO CLÍNICO Y COPILOTO DOCUMENTAL)

### 2.1. Acceso al Espacio de Trabajo
1. Inicie sesión con sus credenciales institucionales de profesional de salud.
2. Acceda a la pestaña **Customer AI — Copiloto Clínico**.

### 2.2. Detección y Revisión de Alertas Clínicas
- La bandeja de alertas le notificará si existen atenciones previas con información documental incompleta (ej. evolución pendiente o indicaciones no emitidas).
- Para gestionar una alerta:
  1. Haga clic en la alerta correspondiente.
  2. Seleccione **Revisar** o **Atender**.
  3. Ingrese una breve justificación clínica (máximo 200 caracteres) y confirme.

### 2.3. Flujo de Borradores e Indicaciones Postatención
El copiloto ayuda a estructurar notas e indicaciones, asegurando el control humano permanente:
1. **Generación de Borrador:** Al finalizar la atención, presione **"Preparar Borrador"**. El asistente sintetizará la información en un borrador inicial (Versión 1).
2. **Revisión y Ajuste (Versión 2):** Modifique cualquier dato clínico, dosificación o advertencia necesaria en el editor.
3. **Aprobación Formal:** Pulse **"Aprobar Borrador"**. Esta acción confirma que la información ha sido validada por su criterio médico.
4. **Emisión Oficial:** Pulse **"Emitir Documento"**. En este momento, las indicaciones postatención se hacen visibles formalmente para el paciente en su portal.
- **Gobernanza:** Ningún borrador se emite automáticamente sin su confirmación explícita.

---

## 3. GUÍA PARA RECEPCIÓN Y ATENCIÓN AL CLIENTE

### 3.1. Gestión de Solicitudes de Reprogramación
1. En la vista de recepción, consulte la sección **"Solicitudes de Reprogramación Pendientes"**.
2. Al seleccionar una solicitud, el sistema mostrará la cita original del paciente y su justificación.
3. Verifique la agenda y seleccione un horario disponible en el selector de disponibilidad.
4. Pulse **"Aplicar Reprogramación"**. La sesión se actualizará inmediatamente en el sistema y se liberará el horario anterior.

### 3.2. Gestión de Alertas Operativas
- Recepción tiene competencia sobre alertas de tipo operativo (`AL-C04`: solicitudes de reprogramación pendientes de gestión, `AL-C05`: sesiones completadas o marcadas asistenciales sin atención registrada como asistida).
- No intente modificar alertas clínicas de evolución médica (`AL-C01`: ficha clínica con campos pendientes, `AL-C02`: atención realizada pendiente de cierre documental, `AL-C03`: indicación postatención pendiente de aprobación profesional), ya que el sistema denegará la acción por control estricto de roles.

---

## 4. GUÍA PARA EL ADMINISTRADOR Y EQUIPO TÉCNICO

### 4.1. Verificación Rápida del Sistema
Para corroborar la salud operativa en cualquier momento, ejecute desde terminal o navegador:
```bash
# Comprobar liveness
curl http://localhost:3001/health/live

# Comprobar readiness (BD OLTP + Data Mart + RAG)
curl http://localhost:3001/health/ready

# Consultar métricas de latencia y llamadas
curl http://localhost:3001/metrics
```

### 4.2. Procedimiento ante Incidencias
- **Si `/health/ready` devuelve 503:** Compruebe el estado del servicio SQL Server local y verifique que las credenciales en `.env.staging.local` no hayan expirado.
- **Si la tasa de error de LLM aumenta:** El orquestador entrará automáticamente en modo degradado seguro. Verifique las cuotas de Gemini o la conectividad externa.
