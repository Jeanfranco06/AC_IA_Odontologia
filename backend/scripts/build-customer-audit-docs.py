"""Genera la entrega de auditoría desde conclusiones explícitas y anclajes del código actual."""
from pathlib import Path
from datetime import datetime, timezone
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/customer/ai-agent'
OUT.mkdir(parents=True, exist_ok=True)
Q = 'backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts'
A = 'backend/src/modules/customer/ai-agent/services/customerAiActionService.ts'
R = 'backend/src/modules/customer/ai-agent/routes.ts'
T = 'backend/src/modules/customer/ai-agent/llm/toolRegistry.ts'
P = 'backend/src/modules/customer/ai-agent/policies.ts'
S = 'backend/src/modules/customer/ai-agent/services/customerSchedulingService.ts'
ETL = 'database/customer/05_etl_customer.sql'
DDL = 'database/customer/01_migracion_oltp_customer.sql'
UI = 'frontend/src/modules/customer/pages/CustomerAiStaffWorkspacePage.tsx'
PORTAL = 'frontend/src/modules/customer/pages/CustomerPatientPortalPage.tsx'
TEST = 'backend/tests/customerAcademicTraceability.test.ts'

def ref(path, needle=None):
    lines = (ROOT / path).read_text(encoding='utf-8-sig').splitlines()
    line = next((i for i, text in enumerate(lines, 1) if needle and needle in text), 1)
    return f'[{Path(path).name}:{line}](../../../{path}#L{line})'

def write(name, text):
    (OUT / name).write_text(text.strip() + '\n', encoding='utf-8')

PART = 'IMPLEMENTADO PARCIALMENTE'
INS = 'IMPLEMENTADO SIN EVIDENCIA SUFICIENTE'
NO = 'NO IMPLEMENTADO'

# Literal de requisitos: exclusivamente las frases presentes en el texto del encargo.
# No se atribuyen al informe original párrafos que no fueron proporcionados.
requirements = [
 dict(id='IA01', title='Consultar cronograma', original='leer sesiones vigentes y mostrar próximas sesiones y estados.', actor='Paciente propietario', trigger='Solicitud en portal/chat', method='getTreatmentSessions', endpoint='GET /treatments/:treatmentId/sessions; GET /me/upcoming-sessions', tool='getTreatmentSessions; getUpcomingSessions', ui='Portal: cronograma y sesiones; chat', tables='SesionesTratamiento, TratamientosContratados, Profesionales, Sedes', effects='Lectura; InteraccionesIA si consulta directa', audit='CONSULTA_SESIONES_TRATAMIENTO / CONSULTA_PROXIMAS_SESIONES', bi='interacciones_registradas; consulta sin mutar sesiones_programadas', state=INS, defect='Hay camino de producto y aislamiento en código; falta E2E autenticado SQL aislado. No inventar estados desde una atención asistida.', action='C: devolver estados persistidos e incluir Reprogramada en próximas sesiones. B: limitar la afirmación de verificación.', before='Estados derivados podían aparentar sesión cerrada; Reprogramada omitida en próximas sesiones.'),
 dict(id='IA02', title='Consultar progreso del tratamiento', original='resumir sesiones realizadas y pendientes, proporcionando avance administrativo.', actor='Paciente propietario', trigger='Consulta de tratamiento', method='getTreatmentProgress', endpoint='GET /treatments/:treatmentId/progress', tool='getTreatmentProgress', ui='Portal: indicadores del tratamiento seleccionado', tables='PlanTratamiento vigente, SesionesTratamiento, TratamientosContratados', effects='Lectura y auditoría; sin progreso duplicado persistente', audit='CONSULTA_PROGRESO_OPERATIVO', bi='sesiones_planificadas, sesiones_completadas de Fact_TratamientoCustomer', state=INS, defect='No se ejecutó reconciliación por tratamiento en SQL aislado; sesiones de planes anteriores no tienen política de sustitución explícita. Si realizadas exceden plan, el porcentaje puede superar 100 y requiere revisar datos.', action='C/E: alinear completada a Realizada Y Cerrada, plan vigente más reciente y cero sesiones sin denominador ficticio.', before='Se contaba asistencia, cierre o sinónimos como completitud, de forma distinta al ETL.'),
 dict(id='IA03', title='Solicitar agendamiento de sesión', original='consultar disponibilidad y solicitar programación de una sesión del plan.', actor='Paciente; aplicación institucional supervisada', trigger='Sesión prevista todavía no creada/programada', method=None, endpoint='No existe endpoint del agente para solicitud de programación nueva. /availability/slots es solo staff.', tool='No existe herramienta de programación inicial CUSTOMER', ui='No hay formulario específico en portal; reprogramación es distinta', tables='PlanTratamiento, SesionesTratamiento, Disponibilidad, EventosSesion; SP usp_ProgramarSesionTratamiento', effects='El SP existente crea sesión, atención y evento CREACION; no es un flujo del paciente', audit='EventosSesion del SP; sin solicitud de programación propia del agente', bi='sesiones_programadas, sesiones_planificadas, atenciones; no atribuir reprogramaciones', state=PART, defect='Existe infraestructura SQL, no solicitud con confirmación, elegibilidad ordinal y contrato de estados. Fecha de sesión es obligatoria: las sesiones faltantes se infieren del plan, no de filas sin horario. El SP debe endurecer inexistencia y compatibilidad del slot antes de exponerlo.', action='D/C pendiente: diseñar contrato de solicitud y adaptar agenda oficial; no duplicar reserva PAYER. No exponer SP incompleto al LLM.', before='SP disponible; ausencia de flujo del agente para nuevas sesiones.'),
 dict(id='IA04', title='Solicitar reprogramación', original='validar elegibilidad y disponibilidad, y preparar una propuesta de cambio.', actor='Paciente propietario; RECEPCION/ADMIN revisan y aplican', trigger='Sesión propia futura, pendiente, posterior a la primera', method='prepareRescheduleRequest', endpoint='POST /actions/prepare; /actions/confirm; /reschedule-requests/:requestId/review; /apply', tool='prepareRescheduleRequest; getRescheduleRequestStatus. Sin confirmación/aplicación como tools.', ui='Portal: preparar/confirmar; staff: bandeja, revisión y slot', tables='SolicitudesReprogramacionCustomer, SesionesTratamiento, Disponibilidad, EventosSesion, InteraccionesIA', effects='Pendiente → En_Revision opcional → Aprobada → Aplicada; rechazo/cancelación. PREPARED no persiste.', audit='SOLICITUD_REPROGRAMACION y revisiones; REPROGRAMACION en EventosSesion solo al aplicar', bi='interacciones_registradas; reprogramaciones_acumuladas solo desde evento aplicado', state=PART, defect='Transacciones y SP en código; faltan pruebas reales de solapamiento, concurrencia y horario SQL. La confirmación repetida tras cambiar la sesión aún puede devolver conflicto. La resolución por ordinal debe desambiguar tratamientos.', action='C/E: eliminar conversión silenciosa de ID a ordinal, rechazar ordinal ambiguo, reintento de aplicación al mismo slot sin otro evento, corregir mensaje PREPARED.', before='Mensaje de registro prematuro y posible elección ambigua; reintento de aplicación rechazado.'),
 dict(id='IA05', title='Resolver preguntas generales', original='consultar contenido institucional aprobado y proporcionar orientación no diagnóstica.', actor='Paciente y staff según ACL documental', trigger='Consulta general al chat', method=None, endpoint='POST /chat; /knowledge/documents y ciclo de versiones por rol', tool='searchApprovedKnowledge; getKnowledgeDocumentReference', ui='Chat del portal y staff; gestión de conocimiento', tables='Corpus JSON local + InteraccionesIA; no tabla OLTP de conocimiento institucional', effects='Registro/aprobación/publicación humana de documentos; búsqueda sin texto sensible en auditoría', audit='Conversación raíz; búsqueda directa auditable, búsqueda interna sin duplicación', bi='interacciones_registradas no equivale exclusivamente a conversaciones', state=PART, defect='El corpus incluido se autodenominaba oficial y se autopublicaba con identidades 1. No existe acreditación externa de esas fuentes. Faltan E2E con documentos institucionales auténticos y verificación determinista de todas las citas de la salida.', action='C/E: desactivar semilla automática, poner v1 autogeneradas identificables en revisión al cargar; exigir publicación humana. D: contenido institucional pendiente.', before='Diez plantillas se publicaban automáticamente como oficiales; citas generadas no se verifican al finalizar la respuesta.'),
 dict(id='IA06', title='Explicar indicaciones finales', original='recuperar indicaciones aprobadas y emitidas, y explicarlas de manera limitada.', actor='Paciente propietario; profesional autorizado', trigger='Pregunta sobre indicaciones o vista del portal', method='getApprovedAftercareInstructions', endpoint='GET /attentions/:attentionId/approved-instructions; POST /chat', tool='getMyAftercareInstructions; getApprovedAftercareInstructions', ui='Portal: indicaciones por atención y chat', tables='Atenciones, IndicacionesPostatencion', effects='Lectura; sin prescripción ni modificación del documento', audit='CONSULTA_INDICACIONES_APROBADAS o conversación única', bi='interacciones_registradas; indicaciones_emitidas no aumenta por lectura', state=PART, defect='Recuperación por propiedad, vigencia y fechas existe; explicación limitada está instruida en prompt, sin garantía semántica determinista. La herramienta sin ID consulta solo la última atención, aunque una previa pudiera tener indicaciones.', action='C/B: reforzar instrucción de no alterar dosis/frecuencia/duración y alinear indicador de disponibilidad del portal con aprobación más emisión.', before='Vista y herramienta existen; límites de explicación sin prueba clínica ni garantía de salida.'),
 dict(id='IA07', title='Preparar contexto de sesión', original='recuperar plan, antecedentes y datos relevantes para la atención.', actor='ODONTOLOGO asignado o responsable; ADMIN', trigger='Selección de atención autorizada', method='getAuthorizedClinicalContext', endpoint='GET /clinical/:attentionId/context', tool='getAuthorizedClinicalContext', ui='Copiloto: selector de atenciones, antecedentes y contexto', tables='Atenciones, AntecedentesClinicos, TratamientosContratados; checklist añade PlanTratamiento, sesiones, validaciones e indicaciones', effects='Lectura y auditoría', audit='CONSULTA_CONTEXTO_CLINICO', bi='interacciones_registradas; no modifica evolución', state=PART, defect='Devuelve antecedentes/verificación y procedimientos anteriores, pero no un resumen clínico integral validado ni citas documentales completas por cada antecedente. Alertas se consultan en bandeja separada. Checklist del plan completo solo para responsable/ADMIN.', action='C/B: integrar preparación documental del cierre sin ampliar ámbito; explicar que NO_REGISTRADA no significa ausencia clínica.', before='Contexto básico y datos previos; sin checklist verificable.'),
 dict(id='IA08', title='Presentar alertas preventivas', original='detectar información relevante o inconsistencias mediante reglas deterministas.', actor='ODONTOLOGO; RECEPCION solo AL-C04/AL-C05; ADMIN', trigger='POST /alerts/detect o herramienta; no scheduler general de las ocho ALT', method='detectDocumentationIssues', endpoint='POST /alerts/detect; GET /alerts; POST /alerts/:alertId/review', tool='detectDocumentationIssues; getPendingAlerts', ui='Copiloto: detectar, listar y revisar alertas', tables='AlertasIA, ValidacionesFicha, Atenciones, AntecedentesClinicos, BorradoresIA, IndicacionesPostatencion, solicitudes y sesiones', effects='Alertas deduplicadas; revisión con evidencia; liberar clave al resolver', audit='Correlación/versionado de reglas; revisiones registradas en InteraccionesIA', bi='alertas_generadas, alertas_atendidas; revisar sin crear nueva alerta', state=PART, defect='Cinco AL históricos no son ocho ALT. Dos ALT añadidas con tests unitarios, cuatro ALT ausentes y dos parciales. No hay cobertura de disparadores temporales generales.', action='C/E: añadir ALT-C04 y ALT-C06 conservando AL; AL-C05 usa estado canónico Realizada. Mantener códigos históricos.', before='Cinco detectores no equivalentes; AL-C05 buscaba sinónimos sin Realizada.'),
 dict(id='IA09', title='Asistir registro clínico', original='estructurar notas proporcionadas por el profesional para preparar un borrador editable de ficha.', actor='Odontólogo autorizado', trigger='Notas profesionales para estructuración', method=None, endpoint='No hay endpoint específico de notas → borrador de ficha', tool='prepareDocumentationDraft prepara documento postatención, no ficha', ui='Hay ficha manual y visor de borradores; no asistente específico de ficha', tables='Atenciones manual; BorradoresIA genérico', effects='No existe asociación asistida/versionada borrador → campos de ficha', audit='Auditoría de borrador genérico no acredita esta actividad', bi='No atribuir borradores genéricos a fichas asistidas', state=NO, defect='No hay contrato de secciones de ficha, entrada de notas, revisión y transferencia a registro oficial supervisada. La ficha histórica queda restringida a ADMIN por exposición completa previa.', action='D/C pendiente: definir contrato y reutilizar versionado con aprobación profesional. No crear hallazgos ni registrar contenido generado automáticamente.', before='Sin asistencia específica; edición manual no satisface IA09.'),
 dict(id='IA10', title='Preparar indicaciones', original='utilizar una plantilla o documento institucional autorizado y los procedimientos confirmados para generar un borrador postatención.', actor='ODONTOLOGO crea/aprueba; ODONTOLOGO/ADMIN emiten con aprobación previa', trigger='Atención autorizada y solicitud de borrador', method='prepareDocumentationDraft', endpoint='POST /document-drafts; /:draftId/revisions; /approve; /issue; /reject', tool='prepareDocumentationDraft; getDocumentDraft. Aprobar/emitir no son herramientas.', ui='Copiloto: crear, editar, versionar, aprobar y emitir', tables='BorradoresIA, Atenciones, Profesionales, IndicacionesPostatencion, InteraccionesIA', effects='Versionado → aprobación humana → emisión separada; no cambia asistencia/cierre de sesión', audit='BORRADOR_DOCUMENTAL_CREADO/REVISION/APROBADO/EMITIDO', bi='borradores_generados por raíz; aprobados versión vigente; indicaciones_emitidas separadas', state=PART, defect='No hay plantilla institucional aprobada enlazada ni verificación de procedimientos en DetalleProcedimiento como fuente del generador. Borrador seguro transcribe datos registrados; no equivale a indicaciones institucionales completas. Aprobar placeholders sigue requiriendo revisión cuidadosa.', action='C/E: quitar cuidados, evolución y contactos inventados; relectura de versión en transacción de emisión y separar emisión de cierre asistencial. D: plantilla autorizada pendiente.', before='Incluía evolución favorable/cuidados sin fuente y emitir cerraba la sesión.'),
 dict(id='IA11', title='Verificar documentación', original='ejecutar validaciones backend y mostrar requisitos pendientes.', actor='Odontólogo; paciente solo proyección autorizada', trigger='Consulta de estado documental y revisión de atención', method='getClinicalDocumentationStatus', endpoint='GET /attentions/:attentionId/documentation-status', tool='getClinicalDocumentationStatus', ui='Copiloto: última validación y campos pendientes', tables='ValidacionesFicha, Atenciones, IndicacionesPostatencion', effects='La consulta no valida ni firma. Cierre histórico separado.', audit='CONSULTA_ESTADO_DOCUMENTAL', bi='fichas_completas; no derivar de presencia de un campo', state=PART, defect='Lee validaciones previas, no ejecuta motor completo por tipo de atención. El endpoint histórico de cierre y el SP no garantizan reglas completas; SP puede crear Completa sin revisión previa completa. Se conserva como riesgo de cierre institucional.', action='B/C pendiente: distinguir consulta de validación efectiva; definir política de campos/consentimientos y cierre único transaccional antes de certificar.', before='Consulta documental existente; validación por tipo de atención incompleta.'),
 dict(id='IA12', title='Actualizar progreso de sesiones', original='actualizar automáticamente el avance administrativo del plan.', actor='Coordinación; lectura por paciente y staff', trigger='Cambios oficiales de sesión y siguiente consulta/refresco', method='getTreatmentProgress', endpoint='GET /treatments/:treatmentId/progress', tool='getTreatmentProgress', ui='Portal carga al seleccionar tratamiento; pantalla CUSTOMER invalida consultas tras mutaciones', tables='PlanTratamiento y SesionesTratamiento autoritativas; sin caché duplicada persistente', effects='Cálculo bajo demanda; no alta clínica ni transición por conteo', audit='Consulta operativa; eventos de sesión en flujos oficiales', bi='sesiones_completadas; tratamientos_completados requiere estado/fecha formal', state=PART, defect='Cálculo correcto en contrato unitario tras cambio; falta actualización oportuna de una pestaña de paciente ya abierta. El botón general no necesariamente recarga progreso si selectedId no cambia. No hay push ni polling documentado.', action='C/E: fórmula canónica; no considerar emisión documental como sesión atendida. Pendiente refresco sincronizado y test multisesión.', before='Varias definiciones de completitud y efecto lateral al emitir.'),
 dict(id='IA13', title='Preparar cierre del tratamiento', original='agrupar evidencias y preparar un checklist de cierre.', actor='Odontólogo responsable del tratamiento; ADMIN', trigger='Consulta del checklist o contexto clínico', method='getTreatmentClosureChecklist', endpoint='GET /treatments/:treatmentId/closure-checklist; incluido en /clinical/:attentionId/context cuando está autorizado', tool='Indirecta mediante getAuthorizedClinicalContext; sin herramienta de cierre', ui='Copiloto: checklist consultivo, estado formal, sesiones y pendientes', tables='TratamientosContratados, PlanTratamiento, SesionesTratamiento, Atenciones, ValidacionesFicha, IndicacionesPostatencion', effects='Solo lectura. No decisión persistida, no cierre ni transición TURNED.', audit='CONSULTA_CHECKLIST_CIERRE directa; contexto externo audita una consulta', bi='No modifica tratamientos_completados; evidencia para revisión', state=PART, defect='Checklist nuevo con pruebas unitarias; falta E2E, decisión profesional registrada y reglas institucionales de excepciones. No declara completitud por conteos.', action='C/B: añadir checklist con referencias a IDs de plan, sesión, atención, validación e indicación. Presentarlo como preparación consultiva.', before='Vista de estado no agrupaba un checklist de cierre.'),
 dict(id='IA14', title='Registrar interacciones', original='registrar metadatos auditables de las actividades del agente.', actor='Auditoría/BI; actores reales registrados por servicios', trigger='Consulta significativa, conversación o acción supervisada', method=None, endpoint='GET /records; escrituras de auditoría internas de servicios', tool='getAuthorizedAiRecords', ui='Registros y bandejas; no panel exhaustivo de fallos', tables='InteraccionesIA, AlertasIA, BorradoresIA, SolicitudesReprogramacionCustomer; Fact_InteraccionIACustomer', effects='Auditoría de eventos, alertas y borradores; múltiples clases de grano diferente', audit='Correlación, recurso, tipo/resultado; revisión con usuario/profesional', bi='interacciones_registradas, alertas_generadas/atendidas, borradores_generados/aprobados', state=PART, defect='Chats staff sin idPersona pueden no persistir; fallos no se registran integralmente; actor_orientado solo paciente/odontólogo confunde recepción. /records exige idPersona al odontólogo aunque su token normalmente carece de ella. BI desplegado no coincide con repositorio.', action='C/E: evitar auditoría duplicada del RAG interno, correlacionar y minimizar texto; ETL cuenta raíces y conserva Resuelta como atendida. Pendiente auditoría completa de fallos/roles y despliegue.', before='RAG añadía una interacción por búsqueda interna; versiones duplicaban medida de borradores en SQL anterior.')
]

alerts = [
 dict(id='ALT-C01', title='Sesión próxima sin confirmación', detector='Ninguno. AL-C01 es ficha incompleta.', rule='No hay ventana institucional ni flujo oficial de confirmación en el agente. Un estado textual Confirmada no acredita contrato de confirmación.', tables='SesionesTratamiento; faltan contrato/confirmación verificable', actor='Recepción/paciente previstos', ui='No hay alerta equivalente', match='Ausente', state=NO, action='D: propuesta; acordar estado y ventana, sin inferir inasistencia.', test='Omitida explícitamente: contrato no disponible.'),
 dict(id='ALT-C02', title='Sesión vencida sin desenlace', detector='Ninguno. AL-C02 es atención asistida sin cierre documental.', rule='No hay detector temporal de vencimiento sin desenlace; AL-C05 tampoco equivale.', tables='SesionesTratamiento y Atenciones previstos', actor='Recepción prevista', ui='No hay bandeja con esta regla', match='Ausente', state=NO, action='C pendiente: reglas de corte temporal y desenlaces oficiales; no marcar inasistencia.', test='Omitida explícitamente; casos positivo/negativo pendientes de implementar.'),
 dict(id='ALT-C03', title='Tratamiento activo con sesiones sin agendar', detector='Ninguno. AL-C03 es indicación pendiente.', rule='El plan puede prever más sesiones que las registradas, pero no hay detector ni solicitud IA03.', tables='PlanTratamiento, TratamientosContratados, SesionesTratamiento previstos', actor='Coordinación prevista; no existe rol COORDINACION separado', ui='Checklist muestra diferencia de cantidades; no equivale a alerta de agenda', match='Ausente', state=NO, action='D/C: definir estado activo, ordinales faltantes y acción supervisada de programación.', test='Omitida; no se cuenta como cubierta por checklist.'),
 dict(id='ALT-C04', title='Alergia o antecedente que requiere revisión', detector='ALT-C04 añadido; AL-C04 conserva solicitud de reprogramación pendiente.', rule='Con atención autorizada: alergias documentadas no vacías O antecedentes registrados del paciente. Mensaje exige revisión, sin determinar contraindicación.', tables='Atenciones.alergias, AntecedentesClinicos, AlertasIA', actor='Odontólogo de la atención; ADMIN supervisa', ui='Detección manual y bandeja genérica del copiloto; recepción no recibe esta alerta', match='Equivalencia documental limitada implementada', state=INS, action='C: regla determinista de presencia. No certifica verificación clínica ni interacción farmacológica.', test='Positivo alergia, negativo vacío, propiedad/rol y deduplicación con Prisma simulado. Falta SQL y resolución E2E.'),
 dict(id='ALT-C05', title='Campos obligatorios faltantes', detector='AL-C01 parcialmente equivalente; AL-C05 trata falta de atención enlazada.', rule='Última ValidacionesFicha con campos_pendientes y resultado diferente de Completa/Completada/Validada.', tables='Atenciones, ValidacionesFicha, AlertasIA', actor='Odontólogo; ADMIN', ui='Bandeja AL-C01 y estado documental', match='Parcial: lee una validación previa, no define campos por tipo', state=PART, action='B/C: conservar mapeo ALT-C05 → AL-C01 parcial y completar validador institucional.', test='Positivo validación incompleta, negativo Completa; permisos generales IA08. Falta matriz por tipo y cierre E2E.'),
 dict(id='ALT-C06', title='Borrador postatención sin aprobación', detector='ALT-C06 añadido; AL-C03 histórico solo consulta IndicacionesPostatencion.', rule='BorradoresIA vigente tipo BORRADOR_RESUMEN_DOCUMENTAL o BORRADOR_INDICACIONES_POSTATENCION con estado Generado/Corregido. Registra responsable por atención y mensaje con ID/versión.', tables='BorradoresIA, Atenciones, AlertasIA', actor='Odontólogo de atención; ADMIN', ui='Detección manual y bandeja del copiloto; edición/versionado del borrador aparte', match='Regla implementada sin política de antigüedad añadida', state=INS, action='C: detectar la entidad correcta sin confundir indicación pendiente y borrador IA; no emisión automática.', test='Positivo borrador, negativo inexistente, filtro de versión/estado, permisos y deduplicación simulada. Falta aprobación/resolución SQL E2E.'),
 dict(id='ALT-C07', title='Tratamiento con sesiones gestionadas sin cierre', detector='Ninguno', rule='No hay detector de todas las sesiones gestionadas, excepciones y ausencia de cierre formal. Checklist consultivo no genera esta alerta.', tables='TratamientosContratados, sesiones, documentos y cierre previstos', actor='Odontólogo previsto', ui='Checklist consultivo nuevo; no alerta ALT-C07', match='Ausente', state=NO, action='D/C: definir excepciones y condición formal; nunca autoalta por conteo.', test='Omitida explícitamente; IA13 cubre consulta, no este detector.'),
 dict(id='ALT-C08', title='Consulta sobre síntoma o complicación', detector='Sin detector/derivador institucional efectivo', rule='Prompts limitan diagnóstico y portal orienta a contacto profesional. No hay protocolo, cola de derivación, notificación ni SLA acreditados.', tables='InteraccionesIA puede registrar conversación; no entidad de derivación efectiva', actor='Profesional responsable previsto; destinatario no notificado automáticamente', ui='Aviso de contacto profesional, sin teléfono ni guardia inventados', match='Parcial: orientación de límites, no derivación', state=PART, action='B/D: declarar escalamiento efectivo como propuesto y dependiente de protocolo institucional.', test='Omitida la derivación; inspección visual del aviso y límites; no certificación clínica.')
]

def evidence(req):
    if req['method']:
        file = Q if req['method'].startswith('get') else A
        return ref(file, 'static async '+req['method'])
    return {'IA03': ref(DDL, 'CREATE PROCEDURE dbo.usp_ProgramarSesionTratamiento'), 'IA05': ref('backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts', 'constructor('), 'IA09': ref(A, 'static async prepareDocumentationDraft'), 'IA14': ref('backend/src/services/customerAiPersistenceService.ts', 'static async registrarInteraccion')}[req['id']]

summary = '| Requisito | Estado final | Evidencia principal |\n|---|---|---|\n' + '\n'.join(f"| {r['id']} — {r['title']} | {r['state']} | {evidence(r)} |" for r in requirements)
trace = '''# Matriz de trazabilidad IA01–IA14

Fecha local de revisión: 12 de noviembre de 2026 (America/Lima). Fuente normativa de contraste: texto del encargo entregado por el usuario. Se distingue implementación comprobada por código/pruebas de contrato de integración real en SQL. Ninguna fila se certifica integralmente por tener un endpoint o un mock.

Resultado: **0 IMPLEMENTADO Y VERIFICADO; 11 IMPLEMENTADO PARCIALMENTE; 2 IMPLEMENTADO SIN EVIDENCIA SUFICIENTE; 1 NO IMPLEMENTADO**. Sin filas NO APLICABLE. La ejecución integrada está BLOQUEADA transversalmente por el entorno, sin ocultar el estado funcional de cada fila.

Prefijo de endpoints de esta matriz: `/api/customer/ai-agent`, salvo indicación distinta. Las pruebas `customerAcademicTraceability.test.ts` son de contrato con Prisma simulado; las suites SQL históricas se mantienen separadas y protegidas.

'''+summary
for req in requirements:
    trace += f"\n\n## {req['id']} — {req['title']}\n\n| Campo | Resultado |\n|---|---|\n"
    values = [
        ('1. Requisito académico original', req['original']), ('2. Objetivo funcional', req['title']+' con datos autoritativos y sin atribuciones clínicas autónomas.'), ('3. Actor autorizado', req['actor']), ('4. Evento disparador',req['trigger']), ('5. Servicio backend', (('CustomerAiQueryService.' if req['method'].startswith('get') else 'CustomerAiActionService.')+req['method']) if req['method'] else 'Ver evidencia y límites específicos; no equiparar servicio relacionado con actividad completa.'), ('6. Endpoint',req['endpoint']), ('7. Herramienta LLM', req['tool']), ('8. Vista frontend',req['ui']), ('9. Tablas OLTP/fuentes',req['tables']), ('10. Efectos de escritura',req['effects']), ('11. Auditoría',req['audit']), ('12. Medidas BI',req['bi']), ('13. Pruebas existentes y añadidas', f"{ref(TEST, req['id']+':')}; suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría."), ('14. Resultado',req['state']), ('15. Deficiencias',req['defect']), ('16. Acción/decisión',req['action'])]
    trace += '\n'.join(f'| {label} | {value} |' for label,value in values)
    trace += '\n\nEvidencia principal: '+evidence(req)+'. Estado anterior: '+req['before']
trace += '\n\n## Cobertura frontend y pruebas\n\n'+ref(PORTAL, 'async function loadPortal')+' y '+ref(UI, 'async function fetchAttentionData')+' consumen el cliente '+ref('frontend/src/modules/customer/services/customerAiAgentApi.ts')+'. Los tests F01–F30 prueban principalmente contratos de fetch/credenciales, no 30 recorridos React con SQL. No reemplazan una prueba de navegación autenticada.\n'
write('MATRIZ_TRAZABILIDAD_IA01_IA14.md',trace)

alert_text = '''# Matriz de alertas ALT-C01–ALT-C08

**No hay correspondencia uno a uno entre ALT y AL.** Los códigos AL-C01–AL-C05 conservan su significado histórico. Se añaden ALT-C04 y ALT-C06 sin recodificar filas antiguas. Hay 2 reglas ALT implementadas en código y probadas en contrato, 2 capacidades parciales y 4 no implementadas; **0 de las 8 se certifican de extremo a extremo**.

| Alerta del informe | Detector real | Regla real | Fuente OLTP | Destinatario | Implementación frontend | Coincidencia | Acción |
|---|---|---|---|---|---|---|---|
'''
for alt in alerts:
    alert_text += f"| {alt['id']} {alt['title']} | {alt['detector']} | {alt['rule']} | {alt['tables']} | {alt['actor']} | {alt['ui']} | {alt['match']} | {alt['action']} |\n"
alert_text += '''
## Catálogo real AL-C01–AL-C05

| Código estable | Condición real | Relación académica | Destinatario y activación |
|---|---|---|---|
| AL-C01 | Última validación incompleta con campos pendientes | ALT-C05 parcial, no ALT-C01 | Odontólogo; detectar sobre atención autorizada |
| AL-C02 | asistencia = Asistió y estado_cierre_documental distinto de Completado | No equivale a ALT-C02 ni a cierre de tratamiento | Odontólogo; debe normalizarse Cerrada/Completado con contrato de cierre |
| AL-C03 | Indicación en Borrador/Pendiente_Aprobacion | Relacionada con ALT-C06, pero otra entidad | Odontólogo; consulta IndicacionesPostatencion |
| AL-C04 | Solicitud de reprogramación Pendiente/En_Revision | Sin fila ALT equivalente; no antecedentes | Recepción/ADMIN; consulta solicitudes |
| AL-C05 | Sesión Realizada sin atención vinculada con asistencia Asistió | Sin fila ALT equivalente; no campos faltantes | Odontólogo en ámbito y recepción/ADMIN; anomalía de evidencia |

## Disparadores y ciclo de vida

Detección a demanda desde endpoint/tool, no ejecución periódica garantizada. La bandeja no equivale a envío de notificación ni a confirmación por paciente. Clave SHA-256 por tipo/recurso más índice único filtrado; repetir detección devuelve la misma fila. Generada → En_Revision/Atendida/Descartada_Justificada; En_Revision → Atendida/Resuelta/Descartada_Justificada; Atendida → Resuelta. Resolver libera clave para una nueva ocurrencia; descartar mantiene supresión. Por tanto, resolver sin corregir la condición puede generar otra alerta después y debe documentarse como recurrencia, no duplicación de la misma fila. Las revisiones requieren evidencia y no crean nuevas AlertasIA.

Las nuevas ALT clínicas son de prioridad documental Media según el código, no clasificación de urgencia médica. No se inventa una ventana de antigüedad ni una interacción farmacológica. La ausencia de antecedentes no demuestra ausencia de condiciones médicas.
'''
for alt in alerts:
    alert_text += f"\n## {alt['id']} — Verificación\n\n**Estado:** {alt['state']}. **Prueba y límites:** {alt['test']}\n\n**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.\n"
alert_text += '\nEvidencia: '+ref(A, 'static async detectDocumentationIssues')+', '+ref(A, 'static async reviewAlert')+', '+ref('backend/src/services/customerAiPersistenceService.ts', 'static async atenderAlerta')+', '+ref(TEST, 'ALT-C01')+'.\n'
write('MATRIZ_ALERTAS_ALT_C01_C08.md',alert_text)

academic = '''# Correcciones del informe académico — texto definitivo y registro de cambios

El encargo reproduce los requisitos IA y ALT y la denominación, pero no entrega los párrafos literales completos de las seis secciones ni un archivo editable del informe académico. No se encontró ese informe en DOCX/PDF entre los archivos visibles del repositorio. Se usa como texto original únicamente el aportado por el usuario; donde falta, se indica expresamente. No se modifica un documento inexistente.

## Texto completo listo para copiar y pegar

### 1. Denominación y descripción general del agente

**Agente Inteligente de Atención y Seguimiento Odontológico: Asistencia al Paciente y Copiloto Clínico-Documental.**

El agente se sitúa principalmente en la etapa CUSTOMER del recorrido BUYER → LEAD → PAYER → CUSTOMER → TURNED. Su diseño comprende asistencia administrativa al paciente y apoyo documental al odontólogo. La implementación disponible permite consultar información autorizada, preparar solicitudes de reprogramación, recuperar indicaciones aprobadas y emitidas, consultar contexto documental, gestionar determinadas alertas y revisar borradores. La preparación de un checklist de cierre es consultiva y no constituye alta clínica ni transición formal a TURNED.

El alcance de diseño y el estado de implementación se distinguen en las tablas siguientes. Las funciones previstas conservan su condición de propuesta; su inclusión no acredita disponibilidad operativa. La revisión de código y las pruebas de contrato no sustituyen la validación integral en un entorno aislado. No se afirma la realización de pilotos clínicos con pacientes reales ni la aprobación institucional de las plantillas incluidas como demostración.

### 2. Intervenciones y actividades del agente

| Código | Actividad y actor | Alcance implementado y condición pendiente |
|---|---|---|
| IA01 | Consultar cronograma — paciente | Consulta las sesiones propias, sus fechas vigentes y sus estados registrados desde el portal o mediante herramientas autorizadas. La validación integral autenticada permanece pendiente. |
| IA02 | Consultar progreso — paciente | Calcula avance administrativo desde el plan vigente y las sesiones realizadas y cerradas. No representa evolución clínica ni acredita cierre del tratamiento. La conciliación integrada por tratamiento está pendiente. |
| IA03 | Solicitar agendamiento — paciente | Se propone solicitar la programación de sesiones del plan que aún no estén agendadas. Existe un procedimiento de agenda CUSTOMER, pero falta integrarlo con un contrato de solicitud, confirmación y aplicación supervisada del paciente. Esta actividad no se considera cubierta por la reprogramación. |
| IA04 | Solicitar reprogramación — paciente y recepción | Prepara una propuesta para una sesión elegible. Tras confirmación explícita del paciente se registra una solicitud para revisión institucional. Solo la aplicación humana aprobada sobre disponibilidad válida modifica la agenda. La prueba transaccional integral está pendiente. |
| IA05 | Resolver preguntas generales — paciente | Dispone de recuperación documental con restricciones de acceso, vigencia y referencias. Su uso institucional depende de documentos auténticos revisados y publicados por responsables autorizados. Las plantillas de demostración no acreditan políticas oficiales. Ante falta de evidencia debe abstenerse. |
| IA06 | Explicar indicaciones — paciente | Recupera indicaciones propias vigentes, aprobadas y emitidas para presentarlas y explicarlas de manera limitada. La explicación no debe cambiar dosis, frecuencia, duración ni significado; una ambigüedad requiere intervención profesional. La fidelidad de las respuestas generadas exige evaluación adicional. |
| IA07 | Preparar contexto — odontólogo | Recupera contexto documental autorizado, antecedentes registrados y su verificación, alergias documentadas y procedimientos previos disponibles. La falta de un dato no demuestra ausencia clínica. El profesional debe comprobar el contexto antes de utilizarlo. |
| IA08 | Presentar alertas — odontólogo y personal autorizado | Ejecuta a demanda reglas documentales y operativas identificadas en la tabla de alertas. Los cinco detectores AL históricos no cubren por sí solos las ocho alertas ALT propuestas. Las alertas requieren revisión humana y no producen decisiones terapéuticas. |
| IA09 | Asistir registro clínico — odontólogo | Se propone estructurar notas proporcionadas por el profesional en un borrador editable de ficha, asociado a la atención y sujeto a revisión. La asistencia específica de ficha no está implementada; la edición manual y el borrador postatención no la sustituyen. |
| IA10 | Preparar indicaciones — odontólogo | Prepara un borrador documental a partir de datos e indicaciones ya registrados, con edición, versionado y aprobación profesional. La emisión al paciente es posterior y diferenciada. El uso de una plantilla institucional acreditada y su vinculación con procedimientos confirmados permanece pendiente. No genera prescripciones autónomas. |
| IA11 | Verificar documentación — odontólogo | Consulta validaciones registradas, campos pendientes y estado documental. No constituye todavía un validador integral de requisitos por tipo de atención ni permite al agente firmar o cerrar documentos autónomamente. |
| IA12 | Actualizar progreso — coordinación | Recalcula el avance administrativo al consultar las fuentes oficiales, sin duplicar un campo de progreso persistente. No cierra el tratamiento por conteos. La actualización oportuna de todas las vistas abiertas y su comprobación integrada están pendientes. |
| IA13 | Preparar cierre — odontólogo | Agrupa plan vigente, sesiones, atenciones, validaciones e indicaciones emitidas en un checklist consultivo, señalando diferencias y excepciones. Requiere confirmación profesional. No registra por sí mismo una decisión formal de cierre ni una transición a TURNED. |
| IA14 | Registrar interacciones — auditoría y BI | Registra metadatos de consultas y acciones, alertas y borradores con correlación cuando el flujo la proporciona. Las consultas internas del chat no deben duplicar la conversación. La auditoría integral de fallos y roles, y la conciliación del Data Mart desplegado, permanecen pendientes. |

### 3. Arquitectura funcional y permisos

La solución utiliza React y TypeScript en la presentación, Node.js y Express en la aplicación, Prisma para acceso relacional y SQL Server para el procesamiento transaccional y analítico. Un orquestador integra Gemini mediante herramientas autorizadas; el modelo no recibe permisos para aprobar documentos, emitir indicaciones ni aplicar cambios de agenda. La recuperación documental utiliza un índice léxico y un almacén local de documentos versionados, separado de la historia clínica.

El backend valida los permisos y la pertenencia de los recursos. El paciente accede a información propia. El odontólogo consulta atenciones asignadas o tratamientos de su responsabilidad. Recepción gestiona solicitudes y alertas operativas; no recibe contexto clínico reservado. Administración supervisa las operaciones habilitadas. Los endpoints históricos que devuelven expedientes completos se restringen a administración mientras se completa su separación por recurso y rol; ello limita temporalmente la edición clínica histórica desde otros perfiles. La existencia de rutas de interfaz no sustituye la autorización del servidor.

El uso del proveedor externo requiere configuración y habilitación explícitas, además de autorización institucional para el tratamiento externo de los datos. Dichas variables de configuración son controles técnicos y no constituyen por sí mismas prueba de consentimiento, habilitación normativa o un acuerdo institucional.

### 4. Interfaces, alertas y controles

El portal del paciente presenta tratamientos, sesiones, avance administrativo, solicitudes e indicaciones emitidas, además del acceso conversacional sujeto a disponibilidad del proveedor. El espacio institucional permite seleccionar atenciones autorizadas, recuperar contexto, consultar estado documental y checklist de cierre, revisar alertas y gestionar borradores. La selección de atención está disponible mediante una lista; los identificadores internos no deben ser necesarios para el paciente.

Las solicitudes preparadas se distinguen de las confirmadas y de los cambios aplicados. Un borrador aprobado no es todavía una indicación emitida. La emisión de un documento no acredita asistencia ni cierre clínico de una sesión. Las alertas documentales son avisos para revisión y no diagnósticos, prescripciones o evaluaciones automáticas de seguridad de un tratamiento.

El sistema no acredita un servicio de urgencias de 24 horas ni una derivación automática por mostrar un aviso de contacto. Solo deben publicarse contactos y políticas respaldados por fuentes verificadas. La evaluación visual realizada cubre el acceso público y dicho aviso; los recorridos clínicos autenticados completos requieren un entorno aislado adicional.

### 5. Alertas preventivas ALT-C01–ALT-C08

| Código | Alerta y destinatario | Estado y alcance |
|---|---|---|
| ALT-C01 | Sesión próxima sin confirmación — recepción/paciente | Propuesta. Requiere estado oficial de confirmación y ventana temporal institucional. No se infiere inasistencia. |
| ALT-C02 | Sesión vencida sin desenlace — recepción | Propuesta pendiente de implementación. Debe solicitar revisión del resultado sin asignar automáticamente inasistencia. AL-C02 corresponde a otra regla. |
| ALT-C03 | Tratamiento activo con sesiones sin agendar — coordinación | Propuesta pendiente. Requiere detectar sesiones previstas sin programación y conectarlas con la futura solicitud supervisada IA03. |
| ALT-C04 | Alergia o antecedente documentado para revisión — odontólogo | Regla documental implementada a demanda: detecta presencia de alergias o antecedentes registrados. No determina contraindicaciones ni interacciones farmacológicas. Validación integral pendiente. |
| ALT-C05 | Campos obligatorios faltantes — odontólogo | Implementación parcial mediante AL-C01: presenta campos pendientes de una validación registrada. Falta verificar requisitos completos por tipo de atención y su integración con el bloqueo de cierre. |
| ALT-C06 | Borrador postatención sin aprobación — odontólogo | Regla implementada a demanda sobre borradores vigentes pendientes. Identifica borrador y versión para revisión, sin emisión automática. No presupone una política de antigüedad. Validación integral pendiente. |
| ALT-C07 | Tratamiento con sesiones gestionadas sin cierre — odontólogo | Propuesta pendiente de detector. El checklist consultivo no sustituye esta alerta ni resuelve excepciones o una decisión profesional. |
| ALT-C08 | Consulta sobre síntoma o complicación — profesional responsable | Implementación parcial de límites y orientación de contacto. La detección institucional con derivación, notificación y seguimiento permanece propuesta, condicionada a un protocolo aprobado. No se promete un tiempo de respuesta. |

Los códigos históricos se conservan: AL-C01 identifica validación de ficha con pendientes; AL-C02, atención asistida sin cierre documental; AL-C03, indicación pendiente de aprobación; AL-C04, solicitud de reprogramación pendiente; y AL-C05, sesión realizada sin atención asistida enlazada. Esta nomenclatura no es intercambiable con ALT-C01–ALT-C08.

### 6. Protección de datos

El tratamiento de información debe limitarse a los datos necesarios para la finalidad autorizada, con autenticación, control de acceso por rol y recurso, trazabilidad y revisión humana. Los documentos de conocimiento general deben mantenerse separados de la historia clínica y someterse a revisión y publicación por responsables identificables. La auditoría debe priorizar metadatos y evitar conservar texto clínico innecesario. El envío de datos a un proveedor externo requiere una base institucional documentada y controles apropiados; una bandera técnica no acredita dicha autorización. Persisten necesidades de endurecimiento de credenciales, retención, sesiones y acceso administrativo. Esta descripción no constituye certificación legal, consentimiento de pacientes ni autorización para uso clínico productivo.

## Registro de modificaciones y fundamento

### Denominación, arquitectura, interfaces y protección de datos

| Sección | Texto original disponible | Problema | Evidencia | Corrección y motivo | Naturaleza |
|---|---|---|---|---|---|
| Denominación/general | Denominación proporcionada en el apartado 2 del encargo; párrafo completo del informe no suministrado | No puede atribuirse despliegue completo a un diseño | Matrices IA/ALT y resultados de verificación | Se conserva la denominación y se distingue alcance implementado del previsto | Mixta |
| Arquitectura/permisos | Párrafo original no suministrado; lista tecnológica del apartado 2 | Permisos del agente no protegían todas las rutas históricas; configuración no prueba autorización externa | policies.ts, authContext.ts, index.ts, rutas CUSTOMER/patient-auth | Se describe el control real y la restricción temporal de expedientes completos | Implementada con pendientes |
| Interfaces/controles | Descripciones y criterios de apartados 8 y 18; no hay párrafo literal completo | Guardias/contactos, firma y cierre se sobreafirmaban | Portal y emisión en servicio; inspección visual | Se diferencia aprobación, emisión, asistencia y cierre; se eliminan promesas sin fuente | Implementada parcialmente |
| Protección de datos | Párrafo original no suministrado | No hay prueba de consentimiento, pilotos reales, retención ni contrato externo | Flags del orquestador y metadatos de auditoría | Se formula como controles y obligaciones pendientes, sin certificación normativa | Mixta |

### Actividades IA: original, problema, evidencia y texto corregido
'''
for req in requirements:
    # Each definitive table row above is the replacement text, referenced instead of inventing another variant.
    academic += f"\n#### {req['id']} — {req['title']}\n\n- **Texto original aportado:** «{req['original']}»\n- **Problema identificado:** {req['defect']}\n- **Evidencia:** {evidence(req)}.\n- **Texto corregido definitivo:** fila {req['id']} de la tabla de intervenciones anterior, que se conserva íntegra para copiar.\n- **Motivo/decisión:** {req['action']}\n- **Implementada o propuesta:** {req['state']}; la fila distingue expresamente los componentes previstos.\n"
academic += '\n### Alertas: cambios individuales\n\n| Original aportado | Problema | Evidencia | Texto corregido definitivo | Motivo y naturaleza |\n|---|---|---|---|---|\n'
for alt in alerts:
    academic += f"| {alt['id']} — {alt['title']} | {alt['match']}: {alt['detector']} | {ref(A, 'static async detectDocumentationIssues')} y matriz ALT | Fila {alt['id']} de la tabla definitiva anterior | {alt['action']} Estado: {alt['state']}. |\n"
write('CORRECCIONES_INFORME_ACADEMICO_IA.md',academic)

head = subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True).strip()
snapshot_path = OUT/'evidencias/sql-readonly.json'
snapshot = json.loads(snapshot_path.read_text(encoding='utf-8-sig')) if snapshot_path.exists() else {}
interaction_snapshot = snapshot.get('results', {}).get('iaTotals', [{}])[0].get('interactions', 'no disponible')
audit = f'''# Auditoría de cumplimiento del informe IA — NexoSalud

Revisión local: **12 de noviembre de 2026, America/Lima**. Rama: `customer`. HEAD al generar esta entrega: `{head}`. Esta auditoría prevalece como evaluación actual sobre las afirmaciones de cierre al 100 % de informes históricos; no borra su historia.

## Resumen ejecutivo y dictamen

**El agente no hace íntegramente todo lo que afirma la matriz académica.** Hay una arquitectura real de consultas, herramientas Gemini, RAG, acciones supervisadas, alertas, documentos y portal. No se certifican las 14 actividades ni las ocho alertas de extremo a extremo. El cierre previo del 100 % no es defendible con la configuración y la evidencia actuales.

Actividades: 0 implementadas y verificadas integralmente; 11 parciales; 2 implementadas sin evidencia integrada suficiente; 1 no implementada. Alertas: 2 reglas ALT implementadas en código con verificación unitaria, 2 parciales y 4 ausentes; ninguna certificada integralmente. No se eliminan requisitos para aparentar finalización.

Hay correcciones de código y pruebas nuevas, texto académico definitivo y pendientes explícitos. **No se despliega ni se ejecuta ETL sobre bases operativas.** La aceptación integral sigue pendiente de entorno SQL aislado, validación de flujos autenticados y contratos institucionales.

## Estado del repositorio e interferencia concurrente

La rama ya era customer y el árbol estaba modificado al iniciar. La primera captura de hash fue `c9a83d7`; durante el trabajo se observaron nuevos commits, entre ellos `49c0b97`, `5ae443f` y `171ac22`. El commit 5ae443f incorporó guardias de pruebas y cambios de ETL mientras esta auditoría trabajaba; otros commits integraron ajustes de UI. No se atribuye la autoría de esos commits a esta ejecución ni se considera un HEAD estable durante toda la revisión. Los cambios previos se conservaron. No se hizo reset, limpieza destructiva, push ni commit nuevo deliberado de entrega. Consultar `evidencias/git-final.txt` para el estado de cierre.

La falta de un árbol aislado limita la atribución exacta de cada diferencia; las evidencias se refieren al contenido presente al verificarlas. No se incluyeron archivos .env, tokens ni datos clínicos individuales en la entrega.

## Estado real de los nueve pasos anteriores

| Paso | Evidencia real | Dictamen actual |
|---|---|---|
| 1 — Infraestructura | Prisma, tablas y migraciones existen; SELECT confirmó tablas operativas | Implementado; no acredita seguridad de entorno. Credencial actual sysadmin. |
| 2 — Herramientas | Servicios de consulta y rutas por recurso/rol | Implementadas con pruebas de contrato; certificación integrada pendiente. |
| 3 — Gemini | @google/genai, función de proveedor, orquestador y catálogo de herramientas | Integración implementada; no se llamó a Gemini externo ni se certifica disponibilidad de nombres de modelos. |
| 4 — Acciones | Confirmación HMAC, transacciones, SP de reprogramación, alertas y borradores | Parcial; la certificación 4.1 ya declaraba bloqueos, y faltan IA03/IA09 y normalización de cierre. |
| 5 — RAG | BM25, archivos versionados, revisión/aprobación/publicación y ACL | Infraestructura real; no hay evidencia de corpus institucional acreditado. Semilla automática corregida. |
| 6 — Frontend | Portal y espacio de trabajo con cliente HTTP; selector de atenciones | Parcial; pruebas F01–F30 son sobre todo de cliente API. Accesos públicos inspeccionados visualmente; recorridos autenticados no certificados. |
| 7 — Evaluación | Suites y reportes con métricas de simulador/corpus sintético | La aprobación histórica no prueba prestaciones clínicas ni cobertura académica completa. |
| 8 — Piloto/preproducción | Scripts de despliegue, respaldo, monitoreo y escenarios técnicos | No se acredita piloto clínico ni aislamiento actual; no se ejecutaron restores, despliegues o pruebas de escritura. |
| 9 — Cierre | Afirma 229 pruebas, 100 % verificado y delta cero | No ratificado. Contradice pasos 4.1/5/6 parciales y las brechas actuales IA/ALT/BI. |

Los reportes PASO_01 a PASO_09 y sus anexos fueron contrastados por su estado, contratos y afirmaciones con las fuentes. Los documentos históricos contienen descripciones incompatibles: paso 5 declara RAG no integrado; hoy sí existe herramienta RAG, pero sin acreditación institucional. Paso 9 dice 11 herramientas y Gemini 2.5, mientras el catálogo y runtime actuales difieren. No se presenta ese historial como evidencia de ejecución actual.

## Resultados IA01–IA14

{summary}

La matriz detallada contiene los 16 campos exigidos por actividad: [MATRIZ_TRAZABILIDAD_IA01_IA14.md](MATRIZ_TRAZABILIDAD_IA01_IA14.md).

## Resultados ALT y relación con AL

| Alerta | Estado | Correspondencia real |
|---|---|---|
'''
for alt in alerts:
    audit += f"| {alt['id']} | {alt['state']} | {alt['detector']} |\n"
audit += f'''
Comparación completa, destinatarios, activación, pruebas y pendientes: [MATRIZ_ALERTAS_ALT_C01_C08.md](MATRIZ_ALERTAS_ALT_C01_C08.md). AL-C04 nunca se redefine como alergia; AL-C05 no se redefine como campos faltantes.

## Arquitectura, permisos y seguridad

React/TypeScript consume REST de Express/TypeScript. Prisma accede a SQL Server OLTP; el mart se actualiza mediante procedimientos SQL y mssql. Gemini propone herramientas del catálogo por rol y el backend valida argumentos. Hay límites de entrada, salida, concurrencia, iteraciones y timeout, con fallback RAG opcional. El nombre de modelo se configura en runtime; no se garantiza su existencia o autorización por aparecer en código. El historial de versiones/modelos no reemplaza validación real del proveedor.

Los tokens HMAC tienen expiración. La identidad de paciente/profesional se comprueba en backend y ahora se rechazan claims incompletos. Los controles clínicos de lectura distinguen propietario, profesional tratante y responsable. Recepción mantiene operaciones de solicitudes y alertas operativas. El rol AUDITOR ya no se transforma automáticamente en ADMIN. Persiste necesidad de RBAC de lectura de auditoría separado, revocación y límites de sesión.

Se hallaron rutas históricas `/api/customer` sin autenticación, con lectura completa de expediente y escrituras. Se añadieron autenticación y restricción ADMIN porque sus contratos actuales no permiten una proyección segura para recepción/paciente. **Consecuencia funcional:** odontología/recepción no pueden usar esas pantallas históricas hasta completar endpoints delimitados; el portal y el copiloto conservan sus APIs específicas. No se presenta esta restricción como cierre funcional del módulo.

En patient-auth se parametrizaron las consultas dinámicas para eliminar interpolación de tokens/datos, se añadió consumo condicional de token de activación y se autenticó la solicitud express vinculándola al paciente. El OTP solo simulado se bloquea fuera de pruebas explícitas; no se afirma envío WhatsApp. Persisten contraseña mínima débil/PBKDF2 heredado y falta de limitación integral de intentos; son bloqueantes de uso productivo, no una certificación de privacidad.

Evidencia: {ref(P)}, {ref('backend/src/modules/customer/ai-agent/authContext.ts')}, {ref('backend/src/routes/customer.routes.ts')}, {ref('backend/src/routes/patientAuth.routes.ts')}, {ref('backend/src/services/patientAuthService.ts')}, {ref('backend/src/services/staffAuthService.ts')}.

## Frontend e interfaces

Se inspeccionaron el código del portal, workspace, formulario de atención, detalle CUSTOMER, hooks y servicios. El portal permite selección de tratamiento/atención, sesiones, avance, indicaciones, solicitudes y chat. El workspace tiene lista de atenciones autorizadas, contexto, estado documental, borradores y bandejas. El nuevo checklist se conecta al contexto backend, con estado formal y pendientes; no contiene botón de alta automática.

La inspección visual en `http://localhost:5173/portal-customer` verificó formulario de acceso y aviso de contacto profesional. Se retiraron números/WhatsApp no acreditados, guardia de 24 horas, instrucciones clínicas fijas sin fuente, datos ficticios de identidad, credenciales de demostración y promesas de cifrado/no compartición sin respaldo. Se conservó la identidad visual editorial. `/customer/agent` sin sesión redirigió a la página pública, confirmando protección de navegación, no el flujo clínico autenticado.

No se inició sesión con pacientes ni se enviaron consultas clínicas al proveedor. No se certifica recorrido browser → backend → SQL → Gemini → mart. La accesibilidad visual del modal sigue requiriendo prueba de foco/tabulación y responsive completos. El bundle principal sigue siendo grande (aviso de Vite >500 kB).

## Backend y correcciones implementadas

1. Progreso usa exclusivamente Realizada + Cerrada; no deduce cierre de asistencia o sinónimos. El cronograma devuelve estados persistidos y contempla Reprogramada en próximas sesiones. Plan vigente se ordena por versión y cero sesiones produce cero, sin sesión ficticia.
2. Mensaje PREPARED ya no afirma solicitud registrada. Se suprime la reinterpretación silenciosa de IDs como ordinales, se rechaza ambigüedad entre tratamientos y se permite repetir aplicación al mismo slot sin otro evento. SP oficial conserva historia. Faltan pruebas SQL de carreras e intervalos.
3. Borrador solo transcribe procedimiento, observaciones e indicaciones registradas o señala ausencia. Se quitaron evolución favorable, cuidados y contactos inventados. Emisión ya no escribe estados de sesión y relee aprobación/vigencia dentro de transacción serializable.
4. Se añaden ALT-C04 documental y ALT-C06 sobre BorradoresIA. Se corrige AL-C05 para estado Realizada. No se agregan reglas de contraindicación, diagnóstico, urgencia o dosis.
5. Se agrega checklist consultivo con referencias a plan, sesiones, atenciones, validaciones e indicaciones; no persiste cierre ni decisión clínica.
6. RAG deja de autosembrar en ejecución normal; v1 conocidas con creador/aprobador fijos pasan a revisión al cargar. Se requiere una versión revisada/publicada legítimamente. Se evita texto sensible en auditoría de búsqueda y doble interacción por RAG interno. La búsqueda fallback sin evidencia también registra su conversación una sola vez.
7. Se corrigen autenticación de rutas/identidades, consultas parametrizadas y bloqueo OTP simulado descritos antes.
8. Entorno de test ya no sobreescribe variables explícitas de proceso ni contamina ejecución normal. Las suites SQL exigen habilitación, nombre Test, instancia autorizada y cuenta no sysadmin antes de mutar.

No se reconstruyó la aplicación ni se implementaron procedimientos clínicos sin política. IA03 necesita un contrato específico de solicitud e integración segura del SP existente; IA09 necesita el contrato de notas/ficha; alertas temporales y derivación requieren definiciones institucionales.

## OLTP, procedimientos y discrepancias de modelo

Prisma y migraciones CUSTOMER representan sesiones, planes, antecedentes, atenciones, validaciones, documentos y eventos IA. SELECT confirmó la existencia de los objetos. La sesión requiere fecha: no existe una fila estándar de sesión aún sin agendar; se debe modelar una solicitud o un ordinal previsto del plan, sin crear otra reserva PAYER.

`usp_ProgramarSesionTratamiento` crea sesión, atención y CREACION, valida plan/solapamientos pero debe endurecer slot inexistente, compatibilidad sede/profesional y duración antes de exponerse al paciente. `usp_ReprogramarSesionTratamiento` se usa por adaptador transaccional. Las solicitudes no incrementan reprogramaciones hasta aplicación.

El cierre histórico todavía posee lógica divergente del SP oficial, crea/actualiza atención con valores de reserva/servicio de respaldo y no garantiza toda la validación clínica. `usp_CerrarSesionClinica` puede registrar Completa si no existe revisión previa tras comprobar evidencia de procedimiento, lo cual no demuestra completitud por tipo. No se ejecutó ni se alteró ese contrato en base operativa. Se exige contrato único de validación/cierre antes de habilitar producción. No se confunde un cierre de sesión con cierre formal de tratamiento; este último tiene SP propio y transición TURNED supervisada.

Existen divergencias de textos de estado: Asiste/Asistió, Completado/Cerrada y sinónimos de sesión completada. Corregir el cálculo de consultas no normaliza datos históricos automáticamente. AL-C02 aún compara cierre contra Completado; una fila Cerrada podría requerir ajuste antes de certificar el detector. Las claves de idempotencia, deduplicación y raíz de borrador deben verificarse en un clon con las migraciones efectivamente instaladas.

## Data Mart, granularidad e indicadores

Los hechos reales son `Fact_TratamientoCustomer` (tratamiento), `Fact_SesionCustomer` (sesión), `Fact_AtencionCustomer_V2` (atención) y `Fact_InteraccionIACustomer` (ClaseEventoIA,id_origen_ia). Los eventos de auditoría, las alertas y las versiones no tienen igual grano. Interacciones registradas incluye consultas y auditoría de acciones: no debe rotularse únicamente como conversaciones.

En el snapshot SELECT: OLTP {interaction_snapshot} interacciones, 35 alertas, 56 versiones y 43 raíces de borrador; mart 140 interacciones, 35 alertas, 12 atendidas, 49 borradores generados y 13 aprobados. Hay 164 hechos con KeyTipoInteraccionIA=0 y cero grupos duplicados de la clave de grano inspeccionada. **No existe delta cero actual**. La primera lectura produjo 719 interacciones y lecturas posteriores cambiaron mientras otras tareas seguían activas: no se trata de un snapshot transaccional congelado. No se conoce que ambos cortes temporales sean iguales; el desfase puede incluir cargas pendientes y diferencias del procedimiento desplegado. No se fuerza conciliación manipulando medidas.

Se confirmó por lectura de definición que el ETL desplegado no contiene la lógica de raíces ni de Resuelta que sí figura en el SQL del repositorio. Se preparó código de ETL para contar una generación por raíz, una aprobación vigente por linaje y mantener una alerta resuelta como atendida. Se añaden tipos observados del OLTP a la dimensión sin cambiar códigos; los tipos ambiguos o >60 caracteres se mantienen como anomalías a revisar, sin truncarlos. **Cambios SQL preparados, no desplegados ni ejecutados.**

Tratamientos iniciados/completados dependen de fechas y estados formales. Sesiones planificadas provienen del plan; completadas exigen Realizada/Cerrada. Programadas/realizadas/inasistidas corresponden a la sesión, reprogramaciones a EventosSesion, atenciones realizadas/fichas completas/indicaciones emitidas a evidencias de atención. Leer o emitir un borrador no debe aumentar por sí solo tratamientos/sesiones completados. No se alteran definiciones para alcanzar números deseados. Falta conciliar cada medida con mismo corte, ejecutar ETL dos veces en clon y comprobar joins/versiones/reintentos.

Evidencia: {ref(ETL, 'SesionesCompletadasPorTratamiento')}, {ref(ETL, 'TiposObservados')}, {ref(ETL, 'EventosIAUnificados')}, [snapshot SQL](evidencias/sql-readonly.json).

## Decisiones A–E y prioridades

| Decisión | Aplicación |
|---|---|
| A — sistema e informe correctos | Separación conceptual de etapa CUSTOMER y no cierre automático; conservar límites y flujos humanos existentes cuando están respaldados. No equivale a certificación completa. |
| B — función descrita incorrectamente | PREPARED/registrada/aplicada, aprobación/emisión/cierre, avance administrativo, checklist consultivo, cinco AL frente a ocho ALT. |
| C — implementación incompleta corregible | Seguridad de rutas, estados/progreso, borrador sin invención, separación emisión/asistencia, ALT-C04/C06, checklist y auditoría RAG; se implementan. |
| D — propuesta o dependencia externa | IA03 como solicitud del paciente, IA09, ALT-C01/C02/C03/C07, protocolo y entrega efectiva ALT-C08, corpus y plantillas acreditados. |
| E — problema conceptual | No tratar asistencia como cierre, semilla como documento oficial, versiones como raíces ni chat interno como conversación nueva. |

Crítico residual: credencial sysadmin, autenticación heredada débil, cierre clínico no unificado y ausencia de protocolo clínico/privacidad acreditado. Alto: entorno aislado, E2E real, despliegue/conciliación ETL, contrato IA03/IA09 y auditoría completa. Medio: refresco de progreso multivista, accesibilidad/responsive completo y tamaño de bundle.

## Pruebas y limitaciones de ejecución

Ver [RESULTADOS_VERIFICACION_IA.md](RESULTADOS_VERIFICACION_IA.md). Las primeras ejecuciones bloquearon nueve suites SQL antes de sus escrituras: no eran fallos de funcionalidad ni aprobaciones. Con integración explícitamente deshabilitada, pasan las pruebas seguras y se omiten las que requieren SQL aislado. El nuevo archivo identifica IA01–IA14 y ALT-C01–ALT-C08; las capacidades ausentes permanecen omitidas con motivo, nunca pruebas triviales aprobadas.

Regresión BUYER/PAYER: suites existentes de matrices, rutas, dunning y documentos. LEAD/TURNED: compilación y revisión de contratos, sin cobertura transaccional dedicada ejecutada; no se afirma regresión completa. Gemini se simula en tests; no se verifica en vivo. SQL se lee; no se escribe ni se ejecuta ETL. El front público se inspecciona; el front autenticado se revisa en fuente/contratos.

## Corrección académica y entrega

[CORRECCIONES_INFORME_ACADEMICO_IA.md](CORRECCIONES_INFORME_ACADEMICO_IA.md) contiene las seis secciones completas listas para copiar y las modificaciones con texto original disponible, problema, evidencia, texto corregido, motivo y estado implementado/propuesto. No se inventan fragmentos del informe original no suministrados. No hay archivo editable académico identificado para actualizar.

Los cinco documentos obligatorios están en esta carpeta. Evidencia adicional: suite de trazabilidad, guardias SQL, script reproducible solo SELECT, snapshot de BD y estado Git. No se declara aceptación del 100 % ni preparación para producción. La correspondencia es defendible si se usan las formulaciones acotadas y se conservan los pendientes; el cumplimiento íntegro del diseño sigue abierto.
'''
audit += '''
## Anexo de medidas: definición y alcance de verificación

| Medida | Grano/fuente | Verificación y efecto de cambios |
|---|---|---|
| interacciones_registradas | Fila InteraccionesIA; incluye auditoría, no solo chat | Contrato de conversación única y RAG interno; snapshot muestra desfase. Staff/fallos pendientes. |
| alertas_generadas | Una fila AlertasIA | Deduplicación probada en contrato; no sumar revisiones como alertas nuevas. |
| alertas_atendidas | Estado/evidencia de la alerta | SQL preparado conserva Atendida y Resuelta; desplegado no actualizado. |
| borradores_generados | Una raíz documental | Se conserva hecho por versión pero solo raíz aporta 1; SQL pendiente de despliegue. |
| borradores_aprobados | Linaje aprobado en versión vigente | Evita sumar revisiones; cambios históricos requieren reconciliación de linaje. |
| tratamientos_iniciados | Tratamiento con inicio/estado formal según ETL | Consultar progreso o emitir documento no debe crear inicio clínico. |
| tratamientos_completados | Tratamiento completado con evidencias formales según ETL | No sumar por completar sesiones ni por emitir indicaciones. |
| sesiones_planificadas | Plan vigente del tratamiento | Revisar plan ausente: ETL usa respaldo mínimo 1, consulta actual usa cero si no hay sesiones; diferencia documentada, no se altera definición para ocultarla. |
| sesiones_completadas | Sesión Realizada Y Cerrada | Consulta alineada al ETL; snapshot clínico mart difiere de OLTP. |
| sesiones_programadas | Sesión en Programada/Reprogramada en ETL | Consulta próxima también considera Confirmada; normalización de estados pendiente. |
| sesiones_realizadas | Sesión estado asistencial Realizada | Emisión ya no incrementa esta medida por efecto lateral. |
| sesiones_inasistidas | Sesión Inasistida explícita | No se infiere por vencimiento o falta de confirmación. |
| reprogramaciones_acumuladas | EventosSesion REPROGRAMACION | Solicitud/revisión no cuentan; aplicación repetida al mismo slot no crea nuevo evento en contrato. |
| atenciones_realizadas | Atención con estados/evidencias del ETL | Diferente universo de filas frente a sesiones contratadas; no comparar totales sin filtrar igual población. |
| fichas_completas | ValidacionesFicha y requisitos del hecho de atención | Consulta visual o campo de procedimiento no acredita completitud clínica. |
| indicaciones_emitidas | IndicacionesPostatencion emitidas según ETL | Lectura/aprobación del borrador no cuenta; emisión diferenciada. |

Todas las cantidades clínicas del mart se conservan en el snapshot; no acreditan consistencia con el OLTP por compartir una etiqueta. Las comparaciones cuantitativas por tratamiento, la población y el mismo corte temporal siguen pendientes en el clon.

## Tabla de cierre de los 22 requisitos

| Requisito | Estado anterior | Corrección realizada | Estado final | Evidencia |
|---|---|---|---|---|
'''
for req in requirements:
    audit += f"| {req['id']} | {req['before']} | {req['action']} | {req['state']} | {evidence(req)} |\n"
for alt in alerts:
    before = 'Ausente o sin equivalencia demostrada con los cinco AL históricos.'
    if alt['id']=='ALT-C05': before='Cobertura parcial por AL-C01, no AL-C05.'
    if alt['id']=='ALT-C06': before='AL-C03 solo detectaba indicación pendiente, no borrador IA.'
    audit += f"| {alt['id']} | {before} | {alt['action']} | {alt['state']} | {ref(A, 'static async detectDocumentationIssues')} y matriz ALT |\n"
write('AUDITORIA_CUMPLIMIENTO_INFORME_IA.md',audit)

# Inventario de fuentes presentes: la inclusión no acredita revisión exhaustiva de cada archivo.
import hashlib
inventory = []
for directory in ('docs/customer/ai-agent', 'backend/src/modules/customer', 'backend/src/routes', 'backend/src/services', 'frontend/src/modules/customer', 'backend/prisma', 'database/customer'):
    for path in (ROOT / directory).rglob('*'):
        if path.is_file() and path.suffix in ('.ts','.tsx','.md','.sql','.prisma') and path.name not in {'build-customer-audit-docs.py'}:
            data = path.read_bytes()
            inventory.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes':len(data)})
(OUT/'evidencias').mkdir(exist_ok=True)
(OUT/'evidencias/inventario-fuentes.json').write_text(json.dumps({'head':head,'generatedAtUtc':datetime.now(timezone.utc).isoformat(),'files':inventory},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
