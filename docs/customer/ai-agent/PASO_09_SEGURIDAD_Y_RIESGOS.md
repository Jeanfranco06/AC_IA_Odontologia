# PASO 9 — EVALUACIÓN DE SEGURIDAD, GOBERNANZA CLÍNICA Y MATRIZ DE RIESGOS RESIDUALES
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Auditoría de Seguridad, Privacidad de Datos y Gestión de Riesgos  
**Fecha:** 2026-11-11  
**Versión:** 1.0.0-final  

---

## 1. AUDITORÍA DE SEGURIDAD Y PRIVACIDAD

### 1.1. Manejo y Saneamiento Integral de Secretos
- **Cero Secretos en Claro:** Se verificó mediante scripts de inspección estricta que no existe ninguna clave API de Gemini, contraseña de SQL Server o secreto de sesión expuesto en el código fuente, archivos de configuración versionados o documentación markdown.
- **Rotación Efectiva en Staging:** Las contraseñas para los usuarios de pruebas fueron rotadas mediante autenticación integrada de Windows y residen únicamente en archivos locales ignorados por Git (`.env.test.local`, `.env.staging.local`).

### 1.2. Control de Acceso y Aislamiento Perimetral (RBAC & Scopes)
- **Aislamiento Horizontal (IDOR Prevention):** Las consultas y mutaciones del paciente validan estrictamente que el `id_persona` del token JWT coincida con el propietario del tratamiento o sesión consultada. Un paciente no puede acceder ni inferir datos de otro paciente.
- **Segregación Funcional por Roles:**
  - `PACIENTE`: Solo consulta tratamientos propios, próximas citas y solicita reprogramaciones.
  - `ODONTOLOGO`: Consulta atenciones autorizadas, detecta y atiende alertas clínicas (`AL-C01`, `AL-C02`, `AL-C03`), elabora borradores, aprueba y emite indicaciones postatención.
  - `RECEPCION`: Gestiona disponibilidad de agendas, revisa y aplica reprogramaciones, y gestiona alertas operativas (`AL-C04`, `AL-C05`). No tiene acceso a emitir ni aprobar diagnósticos médicos.

### 1.3. Firmas Criptográficas para Acciones Supervisadas
- Las acciones críticas (como la solicitud de cambio de cita) emplean tokens de un solo uso firmados mediante **HMAC-SHA256** con expiración de 15 minutos, garantizando que el paciente no pueda alterar los parámetros de la solicitud entre la preparación y la confirmación.

---

## 2. GOBERNANZA CLÍNICA Y RESTRICCIONES ÉTICAS

1. **Principio de Asistencia, No Sustitución Médica:**
   El agente está diseñado como un **copiloto documental y orientador al paciente**, no como un profesional de salud autónomo.
2. **Abstención Diagnóstica y Prescriptiva:**
   El LLM tiene prohibido diagnosticar patologías o formular fármacos. Ante consultas que demanden criterio facultativo, el sistema declina amablemente la respuesta y deriva al paciente con su odontólogo tratante.
3. **Control Relacional Inviolable (CHECK Constraints):**
   Incluso ante un hipotético fallo en el prompt del LLM o vulnerabilidad en la capa de negocio, el motor de SQL Server cuenta con las restricciones:
   - `CK_InteraccionesIA_NoDiagnostico`: Aborta inserciones si `es_diagnostico_o_prescripcion = 1`.
   - `CK_BorradoresIA_NoDiagnostico`: Exige revisión humana obligatoria antes de cualquier emisión.

---

## 3. MATRIZ DE RIESGOS RESIDUALES Y MITIGACIONES

| Identificador | Descripción del Riesgo Residual | Severidad Inherente | Probabilidad | Mecanismo de Mitigación Implementado | Estado de Riesgo Residual |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **RSK-01** | Indisponibilidad o agotamiento de cuota en API externa de Gemini. | Alta | Media | Fallback determinístico local y degradación elegante con respuestas verídicas de BD sin error 500. | **BAJO (Controlado)** |
| **RSK-02** | Intento de suplantación horizontal de datos entre pacientes. | Crítica | Baja | Validación perimetral en cada tool del orquestador y middleware JWT con claim `idPersona`. | **NULO (Mitigado)** |
| **RSK-03** | Emisión accidental o autónoma de borradores clínicos sin revisión médica. | Alta | Baja | Flujo en dos pasos: `approve` seguido de `issue` formalmente diferenciado; bloqueo por constraint. | **NULO (Mitigado)** |
| **RSK-04** | Interpretación de políticas institucionales desactualizadas. | Media | Baja | Base de conocimiento RAG con versionado semántico de documentos y revocación por ACL. | **BAJO (Controlado)** |
| **RSK-05** | Pérdida de estado transaccional por fallo del servidor Node.js. | Media | Baja | Persistencia relacional atómica en SQL Server de todo el linaje de interacciones, alertas y borradores. | **NULO (Mitigado)** |

---

## 4. CONCLUSIÓN DE SEGURIDAD

No existen riesgos de severidad **Crítica** o **Alta** abiertos o sin mitigar en el alcance del proyecto. El sistema presenta una postura de seguridad y gobernanza clínica sólida y técnicamente defendible para su evaluación y presentación académica.
