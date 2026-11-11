# PASO 8 — MATRIZ DE RESULTADOS DEL PILOTO FUNCIONAL CONTROLADO
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD (ENTORNO PREPRODUCCIÓN / STAGING)

**Fecha de Ejecución:** 2026-11-11  
**Entorno de Ejecución:** Staging Aislado (`NexoSaludDB_Test`, `NexoSalud_Mart_Test`)  
**Suite Automatizada:** `backend/tests/customerAiPilotFunctional.test.ts`  
**Resultado Global:** **14 / 14 Aprobadas (100.0%)**

---

### Resumen Ejecutivo de la Matriz

| Identificador | Escenario / Prueba Funcional | Perfil Evaluado | Entrada Sintética / Acción | Resultado Esperado | Resultado Observado | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PIL-01** | Consulta de tratamiento activo por el paciente | Paciente (`PACIENTE`) | Token JWT de Paciente A (`id_persona: 101`). Solicitud `patientTreatments()`. | Retorna tratamientos activos ('Activado' o 'En curso') con id, diagnóstico base y presupuesto. | Tratamiento `id: 1` obtenido correctamente con estado 'Activado' / 'En curso'. | **APROBADO** |
| **PIL-02** | Seguimiento de sesiones realizadas, pendientes y próximas | Paciente (`PACIENTE`) | Solicitud `treatmentSessions(1)` y `patientUpcoming()`. | Lista de sesiones con estados ('Realizada', 'Programada') y desglose de avance. | 3 sesiones recuperadas: Sesión 1 'Realizada', Sesiones 2 y 3 'Programada'. Próxima cita verificada. | **APROBADO** |
| **PIL-03** | Asistente conversacional responde con datos verídicos del tratamiento | Paciente (`PACIENTE`) | Mensaje: "¿Cuál es mi tratamiento activo y cuántas sesiones tengo?". | Orquestador invoca `consultarTratamientosActivos`, formula respuesta verídica sin alucinaciones. | Respuesta generada con contexto verídico de Endodoncia y 3 sesiones documentadas. Cero invención. | **APROBADO** |
| **PIL-04** | Consulta documental RAG de política institucional autorizada | Paciente (`PACIENTE`) | Pregunta: "¿Cuál es la política de reprogramación de citas?". | Búsqueda BM25 sobre repositorio RAG persistido. Retorna política formal con límite de 24h. | Documento recuperado con relevancia formal. Respuesta cita requisito de 24 horas previas. | **APROBADO** |
| **PIL-05** | Consulta mixta (próxima sesión y política de atención) | Paciente (`PACIENTE`) | Pregunta: "Dime cuándo es mi próxima cita y qué debo tener en cuenta para llegar". | Orquestador ejecuta paralelamente tool clínica y búsqueda RAG. Retorna síntesis coherente. | Respuesta orquestada con fecha/hora de la sesión y recomendaciones de puntualidad institucional. | **APROBADO** |
| **PIL-06** | Flujo supervisado completo de solicitud y aplicación de reprogramación | Paciente y Recepción | Paciente solicita reprogramación de sesión 2; recepcionista revisa y aplica en cupo disponible. | Se crea solicitud en estado 'Pendiente'; recepcionista aplica; sesión pasa a 'Reprogramada'. | Solicitud registrada, slot asignado válidamente, sesión actualizada a 'Reprogramada'. Trazabilidad 100%. | **APROBADO** |
| **PIL-07** | Consulta y gestión supervisada de alertas documentales | Odontólogo (`ODONTOLOGO`) | Consulta de alertas activas; detección en atención y transición formal de estado con justificación. | Detección de omisión documental; transición controlada 'Generada' -> 'En_Revision' / 'Atendida'. | Alerta transicionada con éxito a estado válido con registro de auditoría clínica. | **APROBADO** |
| **PIL-08** | Elaboración, revisión y aprobación humana de borrador clínico | Odontólogo (`ODONTOLOGO`) | Preparación de borrador v1, edición a v2, aprobación explícita humana (`corrected=true`). | Estado transiciona: `Generado` (v1) -> `Revisado` (v2) -> `Aprobado` (v2). No emitido aún. | Ciclo de vida cumplido rigurosamente. Preserva borrador raíz y linaje de versiones intacto. | **APROBADO** |
| **PIL-09** | Emisión documental formal separada con confirmación y visibilidad al paciente | Odontólogo y Paciente | Odontólogo emite borrador aprobado; paciente consulta indicaciones postatención. | Borrador pasa a `Emitido`; se genera indicación formal; paciente visualiza las indicaciones aprobadas. | Documento emitido con éxito. Paciente consulta y lee las indicaciones aprobadas de su atención. | **APROBADO** |
| **PIL-10** | Seguridad de acceso perimetral y rechazo de violaciones horizontales | Paciente B vs Paciente A | Paciente B (`id_persona: 102`) intenta consultar sesiones del Tratamiento 1 (perteneciente a Paciente A). | Rechazo inmediato con error de autorización `FORBIDDEN` / `NOT_FOUND` (aislamiento horizontal). | Operación denegada categóricamente. Ni el ORM ni el API exponen datos ajenos. | **APROBADO** |
| **PIL-11** | Resiliencia ante falla controlada de Gemini (degradación elegante) | Sistema / Paciente | Invocación del orquestador simulando timeout/error de red en la llamada de Gemini API. | Captura de falla técnica, fallback determinístico y respuesta de orientación segura sin error 500. | Degradación elegante verificada. El sistema ofrece canales institucionales y mantiene estabilidad. | **APROBADO** |
| **PIL-12** | Continuidad de servicio tras reinicio y preservación íntegra de estado | Sistema / Base de Datos | Simulación de reinicio de proceso; re-instanciación de servicios y lectura de BD. | Todos los borradores, alertas y solicitudes creados previamente persisten intactos. | Integridad de datos confirmada. La persistencia transaccional en SQL Server es 100% duradera. | **APROBADO** |
| **PIL-13** | Conciliación dimensional con Data Mart (Delta = 0) | Data Mart / OLTP | Conteo de tratamientos activos en OLTP (`Tratamientos`) vs Data Mart (`Fact_TratamientoCustomer`). | Discrepancia absoluta nula: Delta = 0 entre registros transaccionales y analíticos. | Conciliación exacta: Delta = 0 verificado en entorno de preproducción. | **APROBADO** |
| **PIL-14** | No regresión financiera sobre contratos de PAYER | PAYER / Módulos Previos | Validación de contratos de pago (`ContratosPago`) asociados al tratamiento durante el flujo Customer. | El saldo contractual, monto total y estado del contrato permanecen intactos sin corrupción. | Integridad financiera intacta. Módulo PAYER no sufre impacto secundario por operaciones de CUSTOMER. | **APROBADO** |

---

### Conclusión de la Evaluación de Piloto

El piloto funcional controlado demostró un comportamiento **100% alineado con las especificaciones de negocio, clínicas y técnicas**:
1. **Separación de roles:** Paciente, Odontólogo y Recepción operan con aislamiento perimetral estricto.
2. **Supervisión humana garantizada:** Cero acciones de emisión o reprogramación ocurren de forma autónoma.
3. **Resiliencia y robustez:** La degradación controlada ante fallas de LLM y la persistencia relacional operan sin pérdidas de información.
