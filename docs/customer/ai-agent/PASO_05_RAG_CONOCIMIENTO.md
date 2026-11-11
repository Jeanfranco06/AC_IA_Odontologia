# Paso 5 — Base de conocimiento y RAG local

## Estado

**PARCIAL: infraestructura RAG local implementada; RAG no integrado ni habilitado institucionalmente.** La certificación 4.1 continúa parcial. En JEAC existen bases aisladas `NexoSaludDB_Test` y `NexoSalud_Mart_Test`, con esquemas CUSTOMER/PAYER y ETL inicial validado; no contienen datos clínicos reales. El validador SQL integral CUSTOMER abortó por un defecto del harness, así que no hay certificación de flujos de aplicación.

No se encontraron documentos institucionales con aprobación y permisos verificables. Los documentos presentes en `docs/customer/ai-agent` describen la arquitectura del software y las pruebas; no se consideran protocolos ni políticas de NexoSalud. El único corpus de esta implementación son cadenas sintéticas dentro de tests, sin pacientes ni contenido clínico real.

## Arquitectura implementada

`LocalKnowledgeBase` es un componente TypeScript sin persistencia ni conexiones externas. Está en [knowledgeBase.ts](../../../backend/src/modules/customer/knowledge-base/knowledgeBase.ts). Sus capacidades son:

- Lectura UTF-8 confinada a un directorio raíz real; acepta únicamente `.md` y `.txt`. Resuelve rutas reales para impedir escapes por `..` o symlinks.
- Normalización de Markdown y texto, eliminación de bloques `script`/`style`, separación por encabezados y párrafos, y división limitada por caracteres. No ejecuta contenido, HTML, macros ni OCR.
- Validación de categoría, versión, permisos, vigencia y metadatos de aprobación; rechaza documentos vacíos, tamaños excesivos, duplicados y patrones comunes de email, DNI peruano y teléfono.
- Versiones monotónicas por código; publicar una nueva versión sustituye la anterior. Una versión revocada deja de ser recuperable de inmediato dentro de la instancia.
- Filtrado de estado, vigencia y roles antes del ranking. Referencias verificadas por código, versión, título, sección e ID de fragmento generado por backend.
- Resultado explícito `NO_AUTHORIZED_EVIDENCE` cuando no hay evidencia publicada, vigente y autorizada.
- Auditoría volátil mínima con correlación, perfil y fragmentos; no guarda el texto de búsqueda. No correlaciona todavía con `InteraccionesIA`.

## Recuperación y tecnología

Se eligió búsqueda lexical determinista tipo BM25 simplificado sobre tokens normalizados. No se afirma búsqueda semántica, no se usan embeddings, SQL Full-Text ni servicios externos. Esto evita exponer documentos a otro proveedor y permite comprobar el comportamiento con tests reproducibles sin instalar infraestructura adicional. La calidad semántica es inferior a una búsqueda híbrida y el índice vive solo en memoria: se pierde al reiniciar el proceso.

El modelo de documentos y fragmentos es actualmente un contrato TypeScript y un índice en memoria; no se creó esquema Prisma ni migración. Tampoco hay API HTTP de ingesta, administración autenticada ni conexión con el orquestador. La aprobación recibida por la función de ingesta es metadato declarativo, no una firma institucional autenticada; por ello el componente no debe aceptar corpus operativo hasta implementar un flujo de aprobación confiable.

## Permisos, privacidad y límites clínicos

Los documentos indican `allowedRoles`, categoría, estado y fechas. La búsqueda filtra por el perfil autenticado antes de calcular resultados. La API no devuelve evidencia si el documento está en borrador, revisión, aprobado sin publicar, vencido, sustituido o revocado.

La comprobación de PII solo detecta patrones comunes de email, DNI y teléfono; no es una garantía de anonimización y puede tener falsos negativos/positivos. La declaración `declaredNoPersonalData` tampoco reemplaza revisión humana. No se indexaron historias clínicas. El contenido recuperado debe tratarse como dato no confiable y nunca como instrucción del sistema.

No se añadieron herramientas `searchApprovedKnowledge` o `getKnowledgeDocumentReference` al registro Gemini. El prompt del agente conserva su prohibición de usar RAG. El Paso 4 no certificado y la falta de entorno/documentos autorizados impiden integrar o enviar contenido a Gemini de forma segura. OLTP continúa siendo la fuente de datos personales y transaccionales.

## Evaluación sintética

El corpus de evaluación se declara sintético en [customerKnowledgeBase.test.ts](../../../backend/tests/customerKnowledgeBase.test.ts). Incluye permisos de paciente/odontólogo, insuficiencia, versiones, revocación, duplicados, citas, límites, rutas de archivos, auditoría mínima e instrucciones maliciosas como texto. En la pregunta sintética etiquetada se obtuvo Recall@1 = 1/1 (1,0); este único caso no es una estimación estadística de calidad institucional.

Matriz de pruebas del RAG (estado según evidencia local):

| Pruebas | Estado | Evidencia / límite |
|---|---|---|
| P01–P06 ingesta y versionado | APROBADAS en unidad | Markdown/TXT, rechazo de PDF, hash duplicado, versiones, referencia y revocación. Sin almacenamiento persistente. |
| P07–P12 recuperación | APROBADAS en unidad | Pregunta conocida, insuficiencia, ACL, límite, vigencia y versión más reciente; corpus sintético. |
| P13–P18 Gemini/citas/respuesta | NO EJECUTADAS | Sin integración Gemini ni referencias incorporadas a respuestas generadas. |
| P19, P23 privacidad de fuentes | APROBADAS parcialmente en unidad | ACL por rol; sin pruebas HTTP/DB ni multi-tenant real. |
| P20 publicación por LLM | NO EJECUTADA | No hay herramienta RAG conectada; no equivale a prueba integral de Gemini. |
| P21 prompt injection | NO EJECUTADA con LLM | El contenido malicioso permanece texto y no se ejecuta; falta prueba del orquestador con documento recuperado. |
| P22 PII | PARCIAL en unidad | Detección de patrones conocidos y declaración; no demuestra ausencia total de PII. |
| P24 auditoría/logs | APROBADA parcialmente en unidad | No persiste consulta; auditoría volátil, sin datos personales. |
| P25–P28 integración/regresión | BLOQUEADAS | Sin Gemini RAG ni entorno SQL aislado; no se alteraron pagos/reservas en esta implementación. |
| P29–P30 reproducibilidad/duplicados | APROBADAS en unidad | Ingesta determinista y rechazo de contenido duplicado; índice solo en memoria. |
| P31 trazabilidad OLTP | BLOQUEADA | Correlación local existe, no hay relación persistida con `InteraccionesIA`. |
| P32 distinguir OLTP/RAG/mixto | NO IMPLEMENTADA | No existe orquestación combinada ni respuesta con procedencia multi-fuente. |

## Pruebas ejecutadas

`npm run test:rag` — 11 pruebas unitarias aprobadas. `npm test` — 47 aprobadas y 12 de persistencia omitidas por el guard de integración. `npm run build` — TypeScript compila. No se ejecutaron Gemini real, SQL Server, migraciones, ETL ni tests de escritura. Las pruebas RAG no requieren `.env` ni credenciales.

## Pendiente para habilitación

1. Rotar/provisionar credenciales restringidas utilizables para las bases de integración y verificar permisos efectivos sin `sysadmin`.
2. Corregir el harness de validación CUSTOMER, crear fixtures sintéticos autónomos y completar la certificación 4.1; revisar por separado posibles registros históricos de pruebas en producción sin borrarlos automáticamente.
3. Obtener documentos reales, aprobación, clasificación y alcance de acceso; revisar privacidad antes de ingesta.
4. Implementar almacenamiento/versionado durable, publicación autenticada, administración, auditoría persistente y operación de reindexado.
5. Elegir con pruebas una estrategia lexical/SQL Full-Text o híbrida; implementar retrieval/citas como herramientas autorizadas del Gemini y probar inyección, abstención y consultas mixtas.
6. Medir Precision@K/Recall@K en un conjunto aprobado más amplio y probar regresión PAYER/CUSTOMER en el entorno aislado.

**Conclusión:** infraestructura RAG local implementada y pruebas sintéticas aprobadas; RAG no verificado de extremo a extremo y no habilitado institucionalmente. No avanzar al Paso 6.
