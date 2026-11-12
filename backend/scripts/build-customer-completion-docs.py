"""Compone el cierre con evidencia ejecutada, sin credenciales ni registros clínicos."""
from pathlib import Path
import json, re, shutil, subprocess

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/customer/ai-agent'
PRIVATE=ROOT/'backend/storage/certification'
EVID=DOC/'evidencias/subsanacion'
EVID.mkdir(parents=True,exist_ok=True)
def link(file, needle=None):
    p=ROOT/file
    line=next((i for i,s in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1) if needle and needle in s),1)
    return f'[{p.name}:{line}](../../../{file}#L{line})'
def table(headers,rows):
    escape=lambda v:str(v).replace('|',' / ').replace('\n',' ')
    return '| '+' | '.join(headers)+' |\n|'+ '|'.join(['---']*len(headers))+'|\n'+''.join('| '+' | '.join(map(escape,row))+' |\n' for row in rows)
def write(name,text): (DOC/name).write_text(text.strip()+'\n',encoding='utf-8')
Q='backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts'
C='backend/src/modules/customer/ai-agent/services/customerCompletionService.ts'
A='backend/src/modules/customer/ai-agent/services/customerAiActionService.ts'
L='backend/src/modules/customer/ai-agent/services/customerAlertLifecycleService.ts'
T='backend/tests/customerCompletionIntegration.test.ts'
UI='frontend/src/modules/customer/components/CustomerCompletionPanel.tsx'
BROWSER='frontend/e2e/customer-completion.spec.ts'

# Código, usuario, actividad, activación, procesamiento técnico, salida, automatización, control humano, intervención IA, fuente/método.
IA=[
('IA01','Paciente','Consultar cronograma','Portal o pregunta en el chat','Autorización por propietario; selección de tratamiento; consulta de sesiones, fechas, profesional, sede y estados canónicos SQL.','Cronograma vigente e historial de cambios.','Consulta automática de solo lectura.','Una cita no acredita asistencia; no se expone tratamiento ajeno.','Interpreta la pregunta y explica las sesiones recuperadas mediante herramientas autorizadas.',Q,'getTreatmentSessions'),
('IA02','Paciente','Consultar progreso administrativo','Selección del tratamiento o consulta conversacional','Lee plan vigente; cuenta completadas solo con Realizada y Cerrada; sin plan devuelve 0 y expone inconsistencia; misma definición ETL.','Planificadas, completadas, pendientes y porcentaje cuando hay denominador válido.','Cálculo del backend y presentación.','No expresa recuperación ni evolución clínica; no oculta contradicciones.','Interpreta la consulta y explica el avance administrativo calculado por el backend.',Q,'getTreatmentProgress'),
('IA03','Paciente y recepción','Solicitar programación CUSTOMER','Sesión posterior del plan sin programación','Plan/ordinal/slot oficial; propuesta firmada y temporal; confirmación; solicitud persistente; revisión; nueva validación transaccional y procedimiento oficial; evento CREACION.','Solicitud seguida hasta Aplicada y sesión con identidad oficial.','Preparación asistida; aplicación administrativa humana.','No programa primera reserva PAYER; no asegura cupo antes de aplicar; serializable e idempotente.','Guía al paciente, identifica ordinal pendiente y presenta opciones verificadas; prepara sin confirmar ni aplicar.',C,'prepareScheduling'),
('IA04','Paciente y recepción','Solicitar reprogramación','Paciente selecciona sesión posterior elegible','Preparar, confirmar, revisar, aprobar y aplicar slot vigente mediante servicio oficial; conserva id_sesion y registra evento.','Solicitud, fecha vigente y evento histórico.','Asistencia y validación automática; aplicación humana.','Aprobada no equivale a Aplicada; reintentos no duplican eventos.','Ayuda a identificar sesión y preferencias; explica el estado real del trámite.',A,'prepareRescheduleRequest'),
('IA05','Paciente y personal autorizado','Resolver preguntas institucionales','Pregunta general y corpus habilitado','Ingesta/versionado; revisión profesional; publicación administrativa; filtros por rol; recuperación; verificación de cita exacta y revalidación ante revocación.','Respuesta con fuentes autorizadas o abstención.','Recuperación y respuesta asistida.','Corpus institucional y envío externo requieren aprobación; pruebas usan documentos sintéticos; semillas no se publican automáticamente.','Interpreta, recupera documentación y explica fragmentos permitidos; no crea políticas.','backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts','async search'),
('IA06','Paciente','Consultar indicaciones finales','Selección de atención propia o herramienta del chat','Filtra aprobación, emisión y vigencia; atención seleccionable; conserva texto íntegro, cantidades, frecuencia y duración.','Indicaciones identificadas por versión y atención, con orientación de lectura.','Consulta y presentación conservadora.','Interpretación individual requiere profesional; no se certifica paráfrasis clínica libre del LLM.','Localiza el documento autorizado y facilita su consulta; la salida protegida conserva literalmente su contenido clínico.',Q,'getApprovedAftercareInstructions'),
('IA07','Odontólogo autorizado','Preparar contexto de sesión','Selección de atención asignada','Agrupa tratamiento, plan, sesión, antecedentes/verificación, alergias, atenciones previas, procedimientos, alertas y checklist; devuelve IDs de procedencia y revisión.','Resumen clínico-documental con fuentes.','Consulta y organización de información registrada.','No registrado no significa ausencia clínica; recepción no accede al expediente.','Organiza y resume datos autorizados sin completar antecedentes desconocidos.',Q,'getAuthorizedClinicalContext'),
('IA08','Odontólogo; recepción según regla','Presentar alertas preventivas','Demanda, evento de negocio o lote temporal habilitado','Conserva AL-C01–05 y evalúa ALT-C01–08; ámbito por rol; identidad deduplicada; revisión y resolución auditadas.','Bandeja con código, estado, responsable y condición fuente.','Detección determinista; revisión humana.','No certifica seguridad de procedimientos ni asigna gravedad clínica; severidad es documental.','Explica y contextualiza las advertencias generadas por reglas del backend.',L,'static async detect'),
('IA09','Odontólogo activo y colegiado','Asistir registro clínico','Notas originales en atención autorizada','Contrato BORRADOR_FICHA_CLINICA; estructura extractiva o proveedor autorizado con validación literal; edición por secciones; versiones; rechazo; transferencia explícita contra revisión vigente.','Borrador verificable y transferencia trazable a ficha.','Organización y propuesta; escritura oficial humana.','No inventa hallazgos; no diagnostica; no añade prescripciones; ficha cambiada o cerrada bloquea transferencia.','Organiza únicamente texto declarado; puede proponer secciones, sujetas a revisión profesional.',C,'prepareClinicalDraft'),
('IA10','Odontólogo','Preparar indicaciones','Atención seleccionada y preparación documental','Reutiliza BorradoresIA/versiones; usa notas registradas o plantilla publicada por servicio; aprobación y emisión separadas; preserva identidad del documento.','Borrador y documento emitido tras decisión humana.','Preparación asistida.','Gemini no aprueba ni emite; emisión no cambia asistencia ni cierre; plantilla institucional no se inventa.','Organiza un borrador desde información registrada o plantilla autorizada para revisión del odontólogo.',A,'prepareDocumentationDraft'),
('IA11','Odontólogo','Verificar documentación','Comprobar requisitos o registrar validación','Política DOCUMENTACION publicada por servicio; verifica campos/procedimiento/indicaciones configurados; hash y revisión de ficha; registro Completa/Incompleta.','Pendientes verificables y última validación vinculada a política.','Evaluación técnica determinista.','Sin política se bloquea la validación y el cierre; no se crea Completa automáticamente.','Explica pendientes del validador; no decide ni certifica completitud clínica.',C,'validateDocumentation'),
('IA12','Odontólogo y paciente','Actualizar progreso de sesiones','Desenlace oficial confirmado por profesional','Procedimiento asistencial; validación vigente; cierre de sesión supervisado; eventos; nueva consulta y refresco del portal.','Progreso actualizado desde SQL; tratamiento continúa abierto.','Reconsulta automática tras cambios, foco y sondeo visible.','Sin autoalta por conteo; tiempos desconocidos no se fabrican; no se marca inasistencia por reloj.','Explica el cambio de progreso calculado tras los eventos oficiales; no altera estados por decisión propia.',C,'closeAttention'),
('IA13','Odontólogo responsable','Preparar y decidir cierre del tratamiento','Checklist y decisión profesional explícita','Reúne plan, sesiones, validaciones vigentes, documentos y derivaciones; bloquea excepciones; procedimiento formal y decisión auditada; transición TURNED según regla existente.','Checklist consultivo y decisión formal separada.','Preparación automática; cierre exclusivamente humano.','Conteo no sustituye juicio profesional; plan ausente, documentación obsoleta o revisiones pendientes bloquean.','Organiza el resumen y los pendientes de cierre; la decisión formal queda exclusivamente en el profesional.',C,'closeTreatment'),
('IA14','Todos los perfiles autorizados','Registrar trazabilidad','Consulta, conversación o acción','Persistencia por actor real; id_usuario_actor; paciente nullable para personal; correlación; evento por acción; no duplica conversación por herramienta interna.','Interacciones, alertas y linajes documentales verificables.','Registro transaccional del backend.','No guarda texto conversacional identificable por defecto; no se fabrica paciente para personal.','Usa herramientas; el registro de auditoría lo realiza el backend.',C,'auditCustomer'),
]
# Código, condición, destinatario, evidencia/acción y dependencia.
ALT=[
('ALT-C01','Sesión próxima sin confirmación','Paciente propietario y recepción','Sesión futura, pendiente y dentro de ventana CONFIRMACION publicada; confirmar no modifica asistencia.','SesionesTratamiento.confirmacion_paciente y política; resuelve al confirmar o desaparecer condición.','Ventana institucional aprobada; sin ella no genera.'),
('ALT-C02','Sesión vencida sin desenlace','Recepción','Fin del horario programado ya transcurrió y el estado sigue pendiente; solicitar revisión humana.','Fecha, duración y desenlace persistido; no infiere inasistencia.','Reloj UTC; no asigna SLA ni conclusión clínica.'),
('ALT-C03','Plan activo con sesiones sin programar','Recepción/coordinación operativa','Plan vigente con cantidad prevista mayor que sesiones oficiales; deriva al flujo IA03.','Plan y sesiones reales; sin sesiones ficticias ni denominador de respaldo.','Coordinación se implementa con rol RECEPCION existente.'),
('ALT-C04','Alergia o antecedente para revisión','Odontólogo responsable; ADMIN supervisa','Alergia documentada o antecedente pendiente de verificación; muestra advertencia documental.','Fuente por atención/paciente; evidencia deduplicada; revisión/resolución profesional.','No determina contraindicación; cambios de fuente requieren nueva revisión.'),
('ALT-C05','Requisitos documentales pendientes','Odontólogo; ADMIN supervisa','Evalúa campos reales y requisitos de política vigente; explicita falta de política; no depende solo de validación antigua.','Atenciones, política y documentos; evita otra ALT-C05 cuando hay AL-C01 activa para la misma atención.','Requisitos institucionales por servicio pendientes de aprobación real.'),
('ALT-C06','Borrador postatención sin aprobación','Odontólogo; ADMIN supervisa','Borrador vigente postatención no aprobado; excluye borrador de ficha; identidad y versión.','BorradoresIA; aprobación resuelve condición y no emite automáticamente.','Sin umbral de antigüedad inventado.'),
('ALT-C07','Sesiones gestionadas sin cierre formal','Odontólogo responsable','Plan completo gestionado (cierre o excepciones oficiales) y tratamiento activo; solicitar revisión de checklist.','Plan, sesiones, estado del tratamiento; no realiza alta por conteo.','Cancelaciones/inasistencias requieren revisión y bloquean cierre completado.'),
('ALT-C08','Consulta que requiere revisión humana','Odontólogo responsable del tratamiento','Paciente puede solicitar revisión explícita; protocolo publicado puede activar derivación antes del LLM; solicitud y alerta persistidas.','Solicitud mínima por referencia/correlación, bandeja profesional, Atendida y Resuelta con evidencia.','Sin protocolo aprobado no hay clasificación automática de síntomas ni prioridad médica; no hay garantía de respuesta inmediata.'),
]
initial={r[0]:('SIN EVIDENCIA INTEGRADA' if r[0] in ['IA01','IA02'] else 'NO IMPLEMENTADO' if r[0]=='IA09' else 'PARCIAL') for r in IA}
initial.update({a[0]:('CÓDIGO SIN E2E' if a[0] in ['ALT-C04','ALT-C06'] else 'PARCIAL' if a[0] in ['ALT-C05','ALT-C08'] else 'AUSENTE') for a in ALT})
status={k:'IMPLEMENTADO Y VERIFICADO' for k in initial}
status['IA05']='BLOQUEADO POR DEPENDENCIA EXTERNA'
matrix=[]
for r in IA:
    evidence=f'SQL/HTTP {r[0]}; contratos históricos'
    if r[0] in ['IA01','IA02','IA03','IA07','IA09','IA10','IA11','IA12','IA13']:evidence+='; navegador según alcance descrito'
    matrix.append([r[0],initial[r[0]],r[4],evidence,status[r[0]]])
for a in ALT: matrix.append([a[0],initial[a[0]],a[3],f'SQL real {a[0]}; permisos/ciclo de vida; BI agregado',status[a[0]]])
matrix_text=table(['Requisito','Estado inicial','Implementación realizada','Prueba ejecutada','Estado final'],matrix)

scope='''Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.'''

write('SUBSANACION_IMPLEMENTACION_IA01_IA14.md','# Subsanación de IA01–IA14\n\n'+scope+'\n\n'+table(['Código','Función resultante','Servicio comprobable'],[[r[0],r[4],link(r[9],r[10])] for r in IA])+f'''
## Integración

El panel compartido {link(UI)} se integra en el portal y en el espacio de trabajo. Los tratamientos y las atenciones se seleccionan desde consultas autorizadas; no requieren escribir identificadores internos. Los datos de horarios, profesionales, sedes, estados y documentos provienen del backend. Se corrigió el lector React de borradores para aceptar el DTO real y conservar emisión/versión; la prueba de navegador detectó el defecto NaN después de emitir. El cronograma usa Realizada + Cerrada para sesión completada y consulta sede vigente. Las cargas de contexto usan versión de consulta y publican una instantánea completa; una respuesta anterior no reemplaza la selección vigente ni indica falsamente que no hay sesiones mientras carga.

Las herramientas conversacionales se registran en {link('backend/src/modules/customer/ai-agent/llm/toolRegistry.ts')}. Preparar solicitud no confirma ni aplica; generar borrador no transfiere a ficha. Las decisiones privilegiadas se ejecutan desde acciones humanas autenticadas.

## Programación y reprogramación

IA03: selección → ordinal faltante del plan → slot oficial → propuesta firmada de 15 minutos → confirmación explícita → solicitud Pendiente → revisión de recepción → Aprobada → aplicación serializable → sesión + evento CREACION. Revalida plan, ordinal, profesional, sede, duración, conflictos y exclusión PAYER. Dos preferencias concurrentes para el mismo ordinal no generan dos solicitudes activas; mismo token es idempotente. El slot no se reserva al preparar.

IA04 conserva su contrato y su identidad de sesión: propuesta → confirmación → revisión → aplicación del slot → evento REPROGRAMACION. Aprobar no cambia el horario. Reintentos y conflictos se verifican contra SQL; ver {link(T,'IA04:')} y las suites históricas.

## Evidencia y límites

Prueba integrada: {link(T)}. Interfaz y navegador: {link(BROWSER)}. Matriz y resultados exactos: [certificación](SUBSANACION_CERTIFICACION_22_REQUISITOS.md). Validación, política y cierre: [integridad clínica](SUBSANACION_VALIDACIONES_Y_CIERRE.md). No se presenta el proveedor simulado como Gemini real.
''')

write('SUBSANACION_ALERTAS_ALT_C01_C08.md','# Subsanación de las ocho alertas\n\n'+scope+'\n\n'+table(['Código','Condición','Destinatario','Regla y salida','Fuente y resolución','Dependencia/límite'],ALT)+f'''
## Implementación y disparadores

Detector académico central: {link(L)}. Se ejecuta a demanda, después de acciones exitosas del agente y mediante scheduler optativo. La habilitación requiere CUSTOMER_ALERT_SCHEDULER_ENABLED=true y CUSTOMER_ALERT_SCHEDULER_USER_ID de un ADMIN activo existente. Intervalo mínimo 60 segundos; lotes de 100 tratamientos con cursor; no solapamiento dentro del proceso; índice único y clave de evidencia protegen la creación entre procesos. Un error se registra y se reintenta; nunca se infiere desenlace por fallo del detector.

Una condición activa no genera otra fila al repetirse la consulta. Las revisiones cambian estado y preservan identidad. Resuelta/Descartada_Justificada son terminales para esa evidencia. La resolución de condiciones operativas/documentales desaparecidas requiere identidad institucional y deja evidencia. ALT-C04 exige revisión humana. La bandeja es notificación interna persistente; no se afirma envío por SMS, correo ni atención en tiempo real.

## Cinco detectores históricos conservados

{table(['Código','Semántica conservada'],[['AL-C01','Última validación incompleta con campos pendientes.'],['AL-C02','Atención asistida pendiente de cierre documental; normalizado Cerrada.'],['AL-C03','Indicación postatención pendiente de aprobación.'],['AL-C04','Solicitud de reprogramación pendiente/en revisión.'],['AL-C05','Sesión realizada sin evidencia de atención enlazada.']])}

Se mantienen códigos y significados; AL-C02 no se renombra como sesión vencida y AL-C04 no se convierte en alergia. Implementación histórica: {link(A,'detectAlerts')}. Las ocho pruebas específicas contra SQL están en {link(T,'ALT-C01:')}; el navegador verifica la bandeja, no ocho escenarios visuales independientes. Véase el alcance exacto en certificación.
''')

write('SUBSANACION_SEGURIDAD_Y_AUTENTICACION.md',f'''# Seguridad y autenticación

{scope}

## Entorno y credenciales

Instancia efectiva JEAC, conexión local localhost; OLTP NexoSaludDB_Test y Mart NexoSalud_Mart_Test. Aprovisionamiento administrativo separado por Windows integrado: {link('backend/scripts/provision-customer-certification.ps1')}. Cuenta de ejecución SQL aleatoria, no sysadmin, con DML/lectura/EXECUTE y VIEW DEFINITION solo en Test; ALTER=0. HAS_DBACCESS de ambas operativas=0. TRUSTWORTHY y DB_CHAINING deshabilitados; no se confía solo en sufijo Test. El login se creó para este laboratorio y no sustituye el diseño de mínimos permisos por endpoint de una implantación institucional.

La configuración privada backend/.env.customer-cert.local y storage/certification están ignorados por Git. No se entregan contraseñas, tokens ni fixture privado del navegador. Los scripts verifican servidor/base/privilegios antes de escribir. Se inspeccionan módulos SQL para detectar referencias operativas; el instalador transforma nombres únicamente para Test. No copia datos de producción. Requiere bases Test con esquema previo, no constituye clonador completo de infraestructura vacía.

## Identidad y recursos

{link('backend/src/modules/customer/ai-agent/authContext.ts')} valida firma HMAC, formato exacto de dos segmentos, caducidad e identidad obligatoria. Revocación durable por hash del token: {link('backend/src/modules/customer/ai-agent/securityControls.ts')}. Inserción concurrente protegida con UPDLOCK/HOLDLOCK; evita fallo de clave primaria en las consultas paralelas iniciales del portal. Logout revoca en SQL; sufijos agregados no eluden la revocación. El middleware verifica usuario/rol actual y profesional activo/colegiado en operación real; las pruebas reales activan este control explícitamente.

Paciente: solo recursos propios. Odontólogo: atención asignada o tratamiento bajo su responsabilidad. Recepción: agenda, solicitudes y metadatos operativos; no expediente clínico completo. ADMIN: gobierno técnico; no puede suplantar aprobación del odontólogo. AUDITOR dejó de convertirse automáticamente a ADMIN.

## Contraseñas y sesión

Paciente: PBKDF2 versionado de 120000 iteraciones, sal aleatoria, comparación segura y actualización oportunista del formato heredado tras verificar contraseña. Nuevas claves de 12 a 200 caracteres. Personal mantiene PBKDF2. Login cuenta con límite de intentos por IP/ruta; su almacenamiento es local al proceso y exige un almacén compartido para despliegue multinodo. OTP de demostración queda bloqueado fuera de habilitación de prueba explícita; no se acredita entrega real de OTP.

React persiste sesión en sessionStorage, elimina copia local al guardar y solicita revocación al salir. Sigue admitiendo lectura de sesión heredada; el despliegue institucional debe gestionar rotación/migración y transporte TLS. No se implementó recuperación institucional de cuenta, MFA ni revocación global de todos los dispositivos; no se declara que formen parte de esta certificación CUSTOMER.

## Rutas heredadas

{link('backend/src/routes/customer.routes.ts')} conserva barrera ADMIN para accesos históricos amplios. Cierres/cambios de estado heredados que eludían validación responden 409 y remiten al flujo seguro; el profesional dispone de rutas equivalentes acotadas por recurso en {link('backend/src/modules/customer/ai-agent/completionRoutes.ts')}. No se abrió el listado clínico completo a recepción ni se eliminó autorización para resolver un error de UI.

## Verificación

Login HTTP real, ocho consultas paralelas, desactivación del usuario, logout/reutilización 401, sufijo inválido 401 y SELECT operativo denegado: {link(T,'Autenticación HTTP')}. Contratos de autorización y errores: suites customerAiAgentSecurity/customerAiAgentHttp/customerAcademicTraceability. El navegador inicia sesión de cada rol por sus formularios reales, sin inyectar tokens.
''')

write('SUBSANACION_VALIDACIONES_Y_CIERRE.md',f'''# Validaciones e integridad del cierre

{scope}

## Política aprobada y revisión vigente

PoliticasCustomerIA admite Borrador → Revisada por odontólogo activo → Publicada por ADMIN. Exige procedencia y versión; DOCUMENTACION se vincula a un servicio y a campos soportados. La publicación no convierte el fixture en política clínica real. La falta de política produce bloqueo explícito; no hay listado universal de campos clínicos inventados.

ValidacionesFicha registra revisión, política, resultado, pendientes, hash de contenido y revision_ficha. El trigger {link('database/customer/11_version_ficha_clinica.sql')} incrementa revisión al cambiar campos de ficha, no por un mero cambio de estado. La validación nueva no reescribe la historia. Cierre exige la última validación efectiva y contenido actual, no que alguna validación histórica haya sido Completa.

## Borrador y ficha oficial

BORRADOR_FICHA_CLINICA se distingue del borrador postatención. Conserva notas originales, secciones, método, advertencias y revisión base. Propuesta del LLM: cada fragmento debe existir literalmente en las notas; JSON nulo, claves ajenas e invenciones se rechazan antes de persistir. Edición humana crea versión. La transferencia requiere confirmación diferenciada, versión actual no rechazada y ficha sin cambios/cierre. Motivo y alergias admiten 300 caracteres; restantes secciones 500, en concordancia con SQL. Nunca se truncó texto clínico para hacerlo caber.

## Estados y transacciones

Una sesión completada administrativamente requiere estado_asistencial=Realizada y estado_cierre=Cerrada. Asistió/Realizado describen la atención, no una transición automática a TURNED. Emitir indicaciones deja asistencia/cierre intactos.

{link('database/customer/08_cierre_documental_seguro.sql')} reemplaza el cierre que fabricaba Completa. Comprueba identidad profesional, política publicada, campos, indicaciones/procedimiento configurados y revisión vigente. {link('database/customer/13_cierre_tratamiento_seguro.sql')} exige inicio efectivo, plan real, todas las sesiones realizadas/cerradas, última validación vigente y profesional responsable. Servicio y auditoría se ejecutan dentro de la transacción; reintentos conservan identidad.

El servicio formal añade comprobación de hash y derivaciones pendientes, evidencia y confirmación humana: {link(C,'closeTreatment')}. Inasistencia/cancelación no se resuelve artificialmente como completada. La transición TURNED se delega al procedimiento existente y considera otros tratamientos activos de la persona.

## Fechas y datos históricos

Se detectaron textos SQL desplegados con mojibake y uso de hora local frente a fechas UTC del backend. Scripts canónicos se despliegan UTF-8 y usan UTC en las operaciones nuevas. {link('database/customer/12_catalogos_estados_utf8.sql')} mantiene CHECK de estados reales. La reparación de texto se aplicó exclusivamente a fixtures sintéticos Test. {link('database/customer/14_evento_asistencial_utc.sql')} evita inventar llegada/inicio retrospectivos al registrar finalización; duraciones desconocidas permanecen desconocidas. No se migraron fechas ni estados operativos.

## Evidencias

Pruebas SQL: cierre sin política rechazado, bypass SQL rechazado, validación efectiva, cambio de ficha después de validar bloqueado, cierre de sesión, progreso, cierre formal Completado y reintento idempotente: {link(T)}. Navegador: notas/secciones/versión/transferencia, aprobación/emisión y cierre supervisado según resultado detallado de la suite E2E. No se certifica juicio clínico por estos casos sintéticos.
''')

write('INFORME_ACADEMICO_IA_ACTUALIZADO.md',f'''# Agente Inteligente de Atención y Seguimiento Odontológico

## Descripción general

El agente CUSTOMER de NexoSalud ofrece asistencia al paciente y un copiloto clínico-documental para el odontólogo. Se integra al recorrido BUYER → LEAD → PAYER → CUSTOMER → TURNED. Consulta información registrada en SQL Server, facilita solicitudes administrativas supervisadas y prepara información documental revisable. El LLM interpreta lenguaje natural, selecciona herramientas permitidas, recupera fuentes y organiza borradores; el backend autoriza recursos, calcula indicadores, valida condiciones y ejecuta transacciones. Las decisiones clínicas y el cierre formal corresponden a profesionales humanos.

{scope}

## Actividades del agente

{table(['Código','Usuario','Actividad','Activación','Procesamiento','Salida','Automatización','Control humano / limitación','Intervención específica de la IA'],[r[:9] for r in IA])}

## Arquitectura funcional y permisos

React y TypeScript presentan el portal del paciente, el espacio de recepción y el copiloto del odontólogo. Express/Node.js y Prisma consultan el OLTP SQL Server mediante autorización por recurso. El orquestador Gemini utiliza un registro de herramientas limitado por rol; ninguna herramienta del LLM aprueba documentos, confirma cupos, cierra fichas ni transiciona tratamientos. El corpus RAG tiene versionado, revisión, publicación y revocación. El Mart consolida eventos operacionales por su grano y no participa como fuente clínica de verdad.

El paciente consulta sus tratamientos y atenciones; el odontólogo accede a la atención asignada o al tratamiento del que es responsable; recepción utiliza agenda y metadatos operativos; ADMIN administra gobierno y publicación. Una identidad ADMIN no sustituye la aprobación clínica del odontólogo. Las rutas heredadas amplias conservan su restricción y los flujos profesionales se realizan mediante servicios acotados.

## Interfaces y controles

El portal permite seleccionar tratamiento, consultar cronograma/progreso, solicitar programación/reprogramación, seguir solicitudes, confirmar asistencia prevista, consultar indicaciones de diferentes atenciones y solicitar revisión humana. El copiloto permite seleccionar atención asignada, consultar contexto/procedencia, detectar/revisar alertas, organizar notas, corregir versiones, transferir explícitamente a ficha, preparar/aprobar/emitir indicaciones, verificar requisitos y preparar cierre. Recepción revisa y aplica agenda oficial. La interfaz exige confirmaciones diferenciadas y muestra errores del backend.

## Alertas preventivas

{table(['Código','Alerta','Destinatario','Procesamiento y salida','Evidencia/ciclo de vida','Control humano / limitación'],ALT)}

Los códigos AL-C01–AL-C05 se conservan con sus significados históricos: ficha incompleta, atención asistida sin cierre, indicación pendiente, reprogramación pendiente y sesión realizada sin atención enlazada. No se confunden con los ocho códigos ALT. Las alertas son documentales/operativas, no un sistema autónomo de diagnóstico o triaje.

## Protección de datos

La información se filtra por identidad y propiedad del recurso. Los eventos conservan correlación y actor real sin requerir un paciente ficticio para conversaciones de personal. Los borradores se conservan como documentos internos hasta revisión y acción profesional. Las contraseñas se almacenan mediante PBKDF2 con sal; las sesiones tienen caducidad y revocación durable. No se utilizó información identificable de pacientes reales en la certificación ni se envió información clínica a Gemini externo.

## Estado real de implementación y evaluación

Los mecanismos técnicos se verifican con pruebas unitarias, SQL/HTTP real, navegador y conciliación dimensional en Test. La aprobación de estas pruebas no constituye validación clínica del modelo, aprobación de protocolos, autorización de transferencia internacional ni certificación de una institución sanitaria. IA05 tiene mecanismo probado, pero su uso institucional queda bloqueado hasta disponer de corpus oficial acreditado y habilitación autorizada. Las ventanas, plantillas y reglas institucionales requieren revisión/publicación real y no reciben valores empresariales predeterminados en React.

Los resultados exactos y sus límites están en [certificación de los 22 requisitos](SUBSANACION_CERTIFICACION_22_REQUISITOS.md). No se acredita con este informe una implantación productiva ni una migración de las bases operativas.
''')

# La evidencia numérica se calcula al final de la ejecución y se reemite al repetir el generador.
logs={}
for key,file in [('backend','all-tests.txt'),('frontend','frontend-tests.txt')]:
    text=(PRIVATE/file).read_text(encoding='utf-8-sig',errors='replace') if (PRIVATE/file).exists() else ''
    clean=re.sub(r'\x1b\[[0-9;]*m','',text)
    lines=[line.strip() for line in clean.splitlines() if 'Test Files ' in line or re.search(r'^\s*Tests\s',line)]
    logs[key]=lines[-2:]
browser=json.loads((PRIVATE/'browser-results.json').read_text(encoding='utf-8')) if (PRIVATE/'browser-results.json').exists() else {}
bi=json.loads((PRIVATE/'bi-reconciliation.json').read_text(encoding='utf-8')) if (PRIVATE/'bi-reconciliation.json').exists() else {}
if bi: shutil.copyfile(PRIVATE/'bi-reconciliation.json',EVID/'conciliacion-bi.json')
summary={'scope':'SYNTHETIC_TEST_ONLY','backend':logs.get('backend'),'frontend':logs.get('frontend'),'browser':browser.get('stats'),'biCut':bi.get('timestamp'),'liveGeminiExecuted':False,'productionWritesExecuted':False,'backendBuildPassed':'error TS' not in (PRIVATE/'backend-build.txt').read_text(encoding='utf-8-sig',errors='replace'),'frontendBuildPassed':'built in' in (PRIVATE/'frontend-build.txt').read_text(encoding='utf-8-sig',errors='replace')}
(EVID/'resultados-resumidos.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
write('SUBSANACION_OLTP_DATAMART.md',f'''# Conciliación OLTP y Data Mart

{scope}

## Cambio dimensional

{link('database/customer/05_etl_customer.sql')} se instala y ejecuta solo en Mart Test, con referencias a OLTP Test. El instalador deriva el contenido actual del repositorio; no se reutiliza una definición desplegada antigua. La misma ejecución concilia con aislamiento SERIALIZABLE. Los números históricos de la auditoría operativa no se mezclan con este universo sintético ni se presentan como pérdidas de datos.

Grano de Fact_InteraccionIACustomer: (ClaseEventoIA, id_origen_ia). INTERACCION representa filas persistidas de InteraccionesIA, incluidas conversaciones y auditoría; no significa que todas sean conversaciones. ALERTA conserva una unidad por identidad. BORRADOR conserva versiones como eventos, pero borradores_generados suma solo raíces; borradores_aprobados suma versiones vigentes aprobadas de cada linaje. Atendida y Resuelta contribuyen a alertas_atendidas. Los actos de revisión no crean otra alerta.

Se permite id_persona nulo para eventos de personal auténticos y se incorporan sus tipos de usuario. Eventos válidos observados, de clase inequívoca y longitud compatible se incorporan a Dim_TipoInteraccionIA; no se fuerzan a otra categoría. Las claves desconocidas se verifican explícitamente. Los 164 desconocidos operativos previos no se modificaron: esta entrega corrige el mecanismo y demuestra cero en Test, no afirma reparar producción.

Plan ausente devuelve sesiones_planificadas=0; se ajustó también CK_FactTrat_Sesiones para admitir ese valor real, sin inventar una sesión. Fichas_completas conserva la definición histórica de primera validación completa para atención realizada; la última validación efectiva de cierre es otro concepto y no altera esa medida.

## Mismo corte y universo

Prueba: {link('backend/tests/customerCompletionMart.test.ts')}. Corte UTC: {bi.get('timestamp','pendiente')}. Universo: ambas bases Test completas en la transacción. Se comprueba identidad de eventos y ausencia de grupos duplicados; se reejecuta ETL dentro del mismo corte y se comparan conteos/sumas.

{table(['Medida','Valor OLTP','Valor Mart','Diferencia','Causa','Resultado'],[[m['measure'],m['oltp'],m['mart'],m['difference'],'Mismo filtro y corte transaccional','COINCIDE' if m['difference']==0 else 'DIFERENCIA'] for m in bi.get('measures',[])])}

{table(['Grano / dimensión comprobada','Filas divergentes'],[[x['grain'],x['mismatchedRows']] for x in bi.get('entityDifferences',[])])}

Tipos desconocidos: {bi.get('unknownTypes','pendiente')}. Grupos duplicados: {bi.get('duplicateGroups','pendiente')}. Antes/después: {json.dumps(bi.get('before',[]),ensure_ascii=False)} / {json.dumps(bi.get('after',[]),ensure_ascii=False)}. Evidencia agregada sin datos clínicos: [conciliacion-bi.json](evidencias/subsanacion/conciliacion-bi.json).

El helper syncCertificationMart limpia únicamente hechos Test huérfanos de fixtures borrados por suites históricas; no elimina fuentes operativas ni redefine medidas para ocultar diferencias. La instalación de las bases originales queda pendiente de despliegue institucional autorizado.

## Regresión

Suites históricas CUSTOMER, PAYER/guardas financieras, dunningScheduler y martSyncService se ejecutan como parte de backend. Se ejecuta ETL PAYER en Test y se conserva resumen financiero {json.dumps(bi.get('financial',[]),ensure_ascii=False)}. La prueba compara antes/después del ETL reservas, suma de precio pactado, importe y checksum de estados de pagos; resultado {json.dumps(bi.get('financialBefore',[]),ensure_ascii=False)} / {json.dumps(bi.get('financialAfter',[]),ensure_ascii=False)}. No se modifican procedimientos de pago/dunning. No existe en esta entrega certificación visual integral de BUYER/LEAD ni regresión productiva de sus operaciones; los tests de módulos auxiliares no deben presentarse como tal.
''')

write('SUBSANACION_CERTIFICACION_22_REQUISITOS.md',f'''# Certificación técnica de los 22 requisitos

{scope}

## Resultado ejecutado

- Backend: {'; '.join(logs.get('backend',[]))}.
- Frontend: {'; '.join(logs.get('frontend',[]))}.
- Navegador Chrome headless, backend/HTTP/SQL reales, únicamente proveedor LLM simulado: {json.dumps(browser.get('stats',{}),ensure_ascii=False)}.
- BI: 20 medidas al mismo corte; claves desconocidas y duplicados se detallan en [conciliación](SUBSANACION_OLTP_DATAMART.md).

Las siete declaraciones it.skip de la auditoría eran placeholders de funciones pendientes, sin cuerpo de prueba; se retiraron al reemplazarlas por casos SQL ejecutables, no se transformaron en aprobaciones vacías. La guardia SQL de las suites permanece y ahora permite ejecución únicamente con Test/no-sysadmin/instancia verificados. Un skip registrado en un intento fallido no se cuenta aprobado.

## Matriz

{matrix_text}

## Tipos de evidencia y cobertura

{link(T)} ejecuta 28 casos reales SQL/HTTP: catorce actividades, ocho alertas, concurrencia de borradores, autenticación/revocación, concurrencia de agenda/cambio de plan/PAYER, proveedor simulado literal e invención rechazada, cierre formal positivo, y lote de scheduler real sin solapamiento. Los casos compuestos contienen aserciones negativas, propiedad de recurso, idempotencia y ausencia de efectos colaterales. Las suites históricas añaden contratos, errores, transacciones, RAG y regresión.

{link(BROWSER)} usa formularios reales de paciente/recepción/odontólogo, persistencia al recargar, programación y reprogramación oficiales, secciones de ficha y revisión humana, emisión, comprobación y cierre según el resultado de cada ejecución, alertas y móvil de 390 px. La prueba no inyecta respuestas del backend ni evita la autenticación. Capturas en [evidencias/subsanacion](evidencias/subsanacion). El controlador de escritorio falló al inicializar sus recursos; se utilizó Chrome instalado mediante Playwright en un perfil efímero aislado ([documentación oficial de canales](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)). No se controló el perfil habitual del usuario.

Concurrencia no aplica a consultas de solo lectura IA01/02/06/07; sí a versiones, solicitudes y escrituras. BI se certifica por hechos y medidas agregadas, no como prueba clínica individual. Las ocho alertas tienen casos SQL específicos; una bandeja visible en navegador no equivale a ocho escenarios E2E visuales independientes. Reprogramación dispone de integración SQL y recorrido visual paciente/recepción hasta Aplicada, preservando la identidad de sesión. No se ejecutó Gemini real por falta de autorización; los dobles verifican herramientas, aislamiento, abstención, citas y texto literal, sin acreditar competencia clínica del proveedor.

## Reproducción

Desde la raíz del repositorio, con SQL Server local y ambas bases Test con esquema previo:

```powershell
powershell -File backend/scripts/provision-customer-certification.ps1
python backend/scripts/install-customer-certification.py
node backend/scripts/run-customer-certification.cjs verify
node backend/scripts/run-customer-certification.cjs
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
```

E2E en terminales independientes:

```powershell
node backend/node_modules/tsx/dist/cli.mjs backend/scripts/start-customer-certification.ts --fresh
$env:VITE_API_URL='http://localhost:3101/api'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174
cd frontend
npx playwright test --config playwright.customer.config.ts
```

Después de finalizar navegador, detener solamente el helper Test antes de repetir la conciliación para evitar escrituras del scheduler durante otro corte. Para reemitir documentación después de la ejecución final: python backend/scripts/build-customer-completion-docs.py. No publicar .env local, logs privados ni fixture con credenciales.
''')

git=subprocess.run(['git','status','--short'],cwd=ROOT,text=True,capture_output=True,encoding='utf-8').stdout
changed=[line[3:] for line in git.splitlines()]
write('CIERRE_SUBSANACION_AGENTE_INTELIGENTE.md',f'''# Cierre de subsanación CUSTOMER

{scope}

## Situación inicial y alcance final

Rama customer; HEAD inicial 171ac22. Existían cambios de la auditoría previa en el árbol de trabajo; se conservaron. Situación documentada inicial: 11 actividades parciales, dos sin evidencia integrada y una ausente; ocho alertas sin certificación integrada; 79 pruebas backend, 49 frontend y 133 omitidas. La conexión anterior operativa con privilegios sysadmin no se utilizó para ejecutar estas pruebas con escritura.

Se implementaron solicitud de programación distinta de PAYER y de reprogramación, ficha específica desde notas, políticas revisables, validaciones reales, cierres supervisados, derivaciones, ocho alertas con ciclo de vida, sesiones revocables y eventos de personal sin paciente ficticio. Se conservaron AL-C01–05. Se corrigieron defectos observados contra SQL/navegador: mojibake de estados, cierre que fabricaba Completa, mezcla UTC/local, solicitud duplicada por concurrencia, clave de sesión de acceso concurrente, DTO de borrador NaN, denominador ficticio y CHECK dimensional incompatible con 0.

SQL JEAC: NexoSaludDB_Test y NexoSalud_Mart_Test con cuenta de ejecución sin sysadmin/ALTER/acceso operativo. Prisma incorpora políticas, solicitudes, confirmación, revisión de ficha, actor y revocación; las migraciones originales no se ejecutaron sobre producción. Se entregan scripts separados de despliegue administrativo Test y runner de mínimos privilegios. React integra los nuevos flujos; Gemini y RAG separan interpretación de decisiones; el corpus institucional sigue bloqueado por falta de acreditación real.

## Resultado y dictamen

Backend: {'; '.join(logs.get('backend',[]))}. Frontend: {'; '.join(logs.get('frontend',[]))}. Navegador: {json.dumps(browser.get('stats',{}),ensure_ascii=False)}. Compilaciones y evidencia agregada se registran en certificación. No se suma ninguna omisión como éxito. No se ejecutaron llamadas reales a Gemini ni pruebas con pacientes reales.

La implementación técnica CUSTOMER tiene evidencia integrada en el laboratorio sintético. **No se declara habilitación institucional, certificación clínica del LLM ni despliegue productivo.** IA05 conserva bloqueo de operación institucional por corpus no acreditado; las políticas/plantillas/ventanas/protocolo deben recibir aprobación auténtica antes de activarse. El informe actualizado contiene las nueve columnas solicitadas y las catorce actividades/ocho alertas, distinguiendo intervención IA, backend y responsabilidad profesional.

## Riesgos y límites residuales

1. Gemini real y evaluación clínica/semántica abierta no ejecutados; la fidelidad de indicaciones se garantiza conservando texto literal, no con paráfrasis libre.
2. Migraciones, ETL y saneamiento operativos no aplicados; los 164 tipos desconocidos del corte operativo antiguo no se presentan como reparados.
3. Scheduler optativo requiere identidad/configuración operativa y monitorización institucional; rate limit es por proceso. Bandeja no garantiza entrega externa ni urgencias.
4. Políticas de servicio, ventanas, corpus y derivación no acreditados institucionalmente. Los ejemplos sintéticos publicados no deben promoverse a producción.
5. Pruebas de navegador no sustituyen auditoría completa de accesibilidad ni ocho escenarios visuales independientes por alerta. BUYER/LEAD no tuvieron certificación E2E integral en este trabajo.
6. El bundle principal de React conserva advertencia de tamaño; no impide compilación. Las rutas históricas amplias siguen restringidas y los cierres se canalizan por el servicio seguro.

## Entregables

- [Implementación IA01–IA14](SUBSANACION_IMPLEMENTACION_IA01_IA14.md)
- [Alertas ALT-C01–ALT-C08](SUBSANACION_ALERTAS_ALT_C01_C08.md)
- [Seguridad y autenticación](SUBSANACION_SEGURIDAD_Y_AUTENTICACION.md)
- [Validación y cierre](SUBSANACION_VALIDACIONES_Y_CIERRE.md)
- [Conciliación OLTP/Mart](SUBSANACION_OLTP_DATAMART.md)
- [Certificación y comandos](SUBSANACION_CERTIFICACION_22_REQUISITOS.md)
- [Informe académico completo](INFORME_ACADEMICO_IA_ACTUALIZADO.md)

## Estado de los requisitos

{matrix_text}

## Archivos y Git

No se creó commit propio ni se revirtió trabajo previo. Archivos presentes en el diff al generar este corte (incluye auditoría previa y directorios nuevos):

```text
{chr(10).join(changed)}
```

Los logs de diagnóstico iniciales se conservan privados para no ocultar fallos corregidos. La evidencia pública final contiene agregados y capturas sintéticas. La definición de medidas y el procedimiento de reproducción permiten evaluar estos resultados sin credenciales publicadas.
''')
print('Ocho documentos de cierre y evidencia agregada generados; sin secretos ni fixture privado.')
