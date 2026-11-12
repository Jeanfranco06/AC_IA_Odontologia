# Auditoría de cumplimiento del informe IA — NexoSalud

Revisión local: **12 de noviembre de 2026, America/Lima**. Rama: `customer`. HEAD al generar esta entrega: `171ac22`. Esta auditoría prevalece como evaluación actual sobre las afirmaciones de cierre al 100 % de informes históricos; no borra su historia.

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

| Requisito | Estado final | Evidencia principal |
|---|---|---|
| IA01 — Consultar cronograma | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:88](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L88) |
| IA02 — Consultar progreso del tratamiento | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA03 — Solicitar agendamiento de sesión | IMPLEMENTADO PARCIALMENTE | [01_migracion_oltp_customer.sql:1093](../../../database/customer/01_migracion_oltp_customer.sql#L1093) |
| IA04 — Solicitar reprogramación | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:122](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L122) |
| IA05 — Resolver preguntas generales | IMPLEMENTADO PARCIALMENTE | [durableKnowledgeService.ts:46](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L46) |
| IA06 — Explicar indicaciones finales | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:175](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L175) |
| IA07 — Preparar contexto de sesión | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:409](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L409) |
| IA08 — Presentar alertas preventivas | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) |
| IA09 — Asistir registro clínico | NO IMPLEMENTADO | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA10 — Preparar indicaciones | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA11 — Verificar documentación | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:451](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L451) |
| IA12 — Actualizar progreso de sesiones | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA13 — Preparar cierre del tratamiento | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:369](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L369) |
| IA14 — Registrar interacciones | IMPLEMENTADO PARCIALMENTE | [customerAiPersistenceService.ts:74](../../../backend/src/services/customerAiPersistenceService.ts#L74) |

La matriz detallada contiene los 16 campos exigidos por actividad: [MATRIZ_TRAZABILIDAD_IA01_IA14.md](MATRIZ_TRAZABILIDAD_IA01_IA14.md).

## Resultados ALT y relación con AL

| Alerta | Estado | Correspondencia real |
|---|---|---|
| ALT-C01 | NO IMPLEMENTADO | Ninguno. AL-C01 es ficha incompleta. |
| ALT-C02 | NO IMPLEMENTADO | Ninguno. AL-C02 es atención asistida sin cierre documental. |
| ALT-C03 | NO IMPLEMENTADO | Ninguno. AL-C03 es indicación pendiente. |
| ALT-C04 | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | ALT-C04 añadido; AL-C04 conserva solicitud de reprogramación pendiente. |
| ALT-C05 | IMPLEMENTADO PARCIALMENTE | AL-C01 parcialmente equivalente; AL-C05 trata falta de atención enlazada. |
| ALT-C06 | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | ALT-C06 añadido; AL-C03 histórico solo consulta IndicacionesPostatencion. |
| ALT-C07 | NO IMPLEMENTADO | Ninguno |
| ALT-C08 | IMPLEMENTADO PARCIALMENTE | Sin detector/derivador institucional efectivo |

Comparación completa, destinatarios, activación, pruebas y pendientes: [MATRIZ_ALERTAS_ALT_C01_C08.md](MATRIZ_ALERTAS_ALT_C01_C08.md). AL-C04 nunca se redefine como alergia; AL-C05 no se redefine como campos faltantes.

## Arquitectura, permisos y seguridad

React/TypeScript consume REST de Express/TypeScript. Prisma accede a SQL Server OLTP; el mart se actualiza mediante procedimientos SQL y mssql. Gemini propone herramientas del catálogo por rol y el backend valida argumentos. Hay límites de entrada, salida, concurrencia, iteraciones y timeout, con fallback RAG opcional. El nombre de modelo se configura en runtime; no se garantiza su existencia o autorización por aparecer en código. El historial de versiones/modelos no reemplaza validación real del proveedor.

Los tokens HMAC tienen expiración. La identidad de paciente/profesional se comprueba en backend y ahora se rechazan claims incompletos. Los controles clínicos de lectura distinguen propietario, profesional tratante y responsable. Recepción mantiene operaciones de solicitudes y alertas operativas. El rol AUDITOR ya no se transforma automáticamente en ADMIN. Persiste necesidad de RBAC de lectura de auditoría separado, revocación y límites de sesión.

Se hallaron rutas históricas `/api/customer` sin autenticación, con lectura completa de expediente y escrituras. Se añadieron autenticación y restricción ADMIN porque sus contratos actuales no permiten una proyección segura para recepción/paciente. **Consecuencia funcional:** odontología/recepción no pueden usar esas pantallas históricas hasta completar endpoints delimitados; el portal y el copiloto conservan sus APIs específicas. No se presenta esta restricción como cierre funcional del módulo.

En patient-auth se parametrizaron las consultas dinámicas para eliminar interpolación de tokens/datos, se añadió consumo condicional de token de activación y se autenticó la solicitud express vinculándola al paciente. El OTP solo simulado se bloquea fuera de pruebas explícitas; no se afirma envío WhatsApp. Persisten contraseña mínima débil/PBKDF2 heredado y falta de limitación integral de intentos; son bloqueantes de uso productivo, no una certificación de privacidad.

Evidencia: [policies.ts:1](../../../backend/src/modules/customer/ai-agent/policies.ts#L1), [authContext.ts:1](../../../backend/src/modules/customer/ai-agent/authContext.ts#L1), [customer.routes.ts:1](../../../backend/src/routes/customer.routes.ts#L1), [patientAuth.routes.ts:1](../../../backend/src/routes/patientAuth.routes.ts#L1), [patientAuthService.ts:1](../../../backend/src/services/patientAuthService.ts#L1), [staffAuthService.ts:1](../../../backend/src/services/staffAuthService.ts#L1).

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

En el snapshot SELECT: OLTP 728 interacciones, 35 alertas, 56 versiones y 43 raíces de borrador; mart 140 interacciones, 35 alertas, 12 atendidas, 49 borradores generados y 13 aprobados. Hay 164 hechos con KeyTipoInteraccionIA=0 y cero grupos duplicados de la clave de grano inspeccionada. **No existe delta cero actual**. La primera lectura produjo 719 interacciones y lecturas posteriores cambiaron mientras otras tareas seguían activas: no se trata de un snapshot transaccional congelado. No se conoce que ambos cortes temporales sean iguales; el desfase puede incluir cargas pendientes y diferencias del procedimiento desplegado. No se fuerza conciliación manipulando medidas.

Se confirmó por lectura de definición que el ETL desplegado no contiene la lógica de raíces ni de Resuelta que sí figura en el SQL del repositorio. Se preparó código de ETL para contar una generación por raíz, una aprobación vigente por linaje y mantener una alerta resuelta como atendida. Se añaden tipos observados del OLTP a la dimensión sin cambiar códigos; los tipos ambiguos o >60 caracteres se mantienen como anomalías a revisar, sin truncarlos. **Cambios SQL preparados, no desplegados ni ejecutados.**

Tratamientos iniciados/completados dependen de fechas y estados formales. Sesiones planificadas provienen del plan; completadas exigen Realizada/Cerrada. Programadas/realizadas/inasistidas corresponden a la sesión, reprogramaciones a EventosSesion, atenciones realizadas/fichas completas/indicaciones emitidas a evidencias de atención. Leer o emitir un borrador no debe aumentar por sí solo tratamientos/sesiones completados. No se alteran definiciones para alcanzar números deseados. Falta conciliar cada medida con mismo corte, ejecutar ETL dos veces en clon y comprobar joins/versiones/reintentos.

Evidencia: [05_etl_customer.sql:527](../../../database/customer/05_etl_customer.sql#L527), [05_etl_customer.sql:880](../../../database/customer/05_etl_customer.sql#L880), [05_etl_customer.sql:898](../../../database/customer/05_etl_customer.sql#L898), [snapshot SQL](evidencias/sql-readonly.json).

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
| IA01 | Estados derivados podían aparentar sesión cerrada; Reprogramada omitida en próximas sesiones. | C: devolver estados persistidos e incluir Reprogramada en próximas sesiones. B: limitar la afirmación de verificación. | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:88](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L88) |
| IA02 | Se contaba asistencia, cierre o sinónimos como completitud, de forma distinta al ETL. | C/E: alinear completada a Realizada Y Cerrada, plan vigente más reciente y cero sesiones sin denominador ficticio. | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA03 | SP disponible; ausencia de flujo del agente para nuevas sesiones. | D/C pendiente: diseñar contrato de solicitud y adaptar agenda oficial; no duplicar reserva PAYER. No exponer SP incompleto al LLM. | IMPLEMENTADO PARCIALMENTE | [01_migracion_oltp_customer.sql:1093](../../../database/customer/01_migracion_oltp_customer.sql#L1093) |
| IA04 | Mensaje de registro prematuro y posible elección ambigua; reintento de aplicación rechazado. | C/E: eliminar conversión silenciosa de ID a ordinal, rechazar ordinal ambiguo, reintento de aplicación al mismo slot sin otro evento, corregir mensaje PREPARED. | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:122](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L122) |
| IA05 | Diez plantillas se publicaban automáticamente como oficiales; citas generadas no se verifican al finalizar la respuesta. | C/E: desactivar semilla automática, poner v1 autogeneradas identificables en revisión al cargar; exigir publicación humana. D: contenido institucional pendiente. | IMPLEMENTADO PARCIALMENTE | [durableKnowledgeService.ts:46](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L46) |
| IA06 | Vista y herramienta existen; límites de explicación sin prueba clínica ni garantía de salida. | C/B: reforzar instrucción de no alterar dosis/frecuencia/duración y alinear indicador de disponibilidad del portal con aprobación más emisión. | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:175](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L175) |
| IA07 | Contexto básico y datos previos; sin checklist verificable. | C/B: integrar preparación documental del cierre sin ampliar ámbito; explicar que NO_REGISTRADA no significa ausencia clínica. | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:409](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L409) |
| IA08 | Cinco detectores no equivalentes; AL-C05 buscaba sinónimos sin Realizada. | C/E: añadir ALT-C04 y ALT-C06 conservando AL; AL-C05 usa estado canónico Realizada. Mantener códigos históricos. | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) |
| IA09 | Sin asistencia específica; edición manual no satisface IA09. | D/C pendiente: definir contrato y reutilizar versionado con aprobación profesional. No crear hallazgos ni registrar contenido generado automáticamente. | NO IMPLEMENTADO | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA10 | Incluía evolución favorable/cuidados sin fuente y emitir cerraba la sesión. | C/E: quitar cuidados, evolución y contactos inventados; relectura de versión en transacción de emisión y separar emisión de cierre asistencial. D: plantilla autorizada pendiente. | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA11 | Consulta documental existente; validación por tipo de atención incompleta. | B/C pendiente: distinguir consulta de validación efectiva; definir política de campos/consentimientos y cierre único transaccional antes de certificar. | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:451](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L451) |
| IA12 | Varias definiciones de completitud y efecto lateral al emitir. | C/E: fórmula canónica; no considerar emisión documental como sesión atendida. Pendiente refresco sincronizado y test multisesión. | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA13 | Vista de estado no agrupaba un checklist de cierre. | C/B: añadir checklist con referencias a IDs de plan, sesión, atención, validación e indicación. Presentarlo como preparación consultiva. | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:369](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L369) |
| IA14 | RAG añadía una interacción por búsqueda interna; versiones duplicaban medida de borradores en SQL anterior. | C/E: evitar auditoría duplicada del RAG interno, correlacionar y minimizar texto; ETL cuenta raíces y conserva Resuelta como atendida. Pendiente auditoría completa de fallos/roles y despliegue. | IMPLEMENTADO PARCIALMENTE | [customerAiPersistenceService.ts:74](../../../backend/src/services/customerAiPersistenceService.ts#L74) |
| ALT-C01 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | D: propuesta; acordar estado y ventana, sin inferir inasistencia. | NO IMPLEMENTADO | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C02 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | C pendiente: reglas de corte temporal y desenlaces oficiales; no marcar inasistencia. | NO IMPLEMENTADO | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C03 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | D/C: definir estado activo, ordinales faltantes y acción supervisada de programación. | NO IMPLEMENTADO | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C04 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | C: regla determinista de presencia. No certifica verificación clínica ni interacción farmacológica. | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C05 | Cobertura parcial por AL-C01, no AL-C05. | B/C: conservar mapeo ALT-C05 → AL-C01 parcial y completar validador institucional. | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C06 | AL-C03 solo detectaba indicación pendiente, no borrador IA. | C: detectar la entidad correcta sin confundir indicación pendiente y borrador IA; no emisión automática. | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C07 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | D/C: definir excepciones y condición formal; nunca autoalta por conteo. | NO IMPLEMENTADO | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
| ALT-C08 | Ausente o sin equivalencia demostrada con los cinco AL históricos. | B/D: declarar escalamiento efectivo como propuesto y dependiente de protocolo institucional. | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT |
