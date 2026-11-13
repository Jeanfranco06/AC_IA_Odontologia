# IA01 — Consultar cronograma

Revisión: 12 de noviembre de 2026.

## Contrato de la actividad

El paciente solicita su cronograma. El backend consulta sesiones propias en NexoSaludDB y devuelve fechas vigentes y estados registrados. La consulta no modifica la agenda; puede registrar auditoría de la interacción. El asistente interpreta y explica los resultados, sin inventar citas ni deducir asistencia desde una confirmación.

“Próximas sesiones” incluye fechas desde el instante de consulta, con programación Programada, Confirmada o Reprogramada y sin realización y cierre completos. El cronograma del tratamiento puede incluir historial; una sesión pasada pendiente no debe presentarse como próxima.

## Correcciones

- Los resúmenes de tratamientos y el detalle ya no presentan fechas pasadas o canceladas como próxima sesión.
- La herramienta de próximas sesiones incluye identificador y número de sesión, confirmación del paciente, estado asistencial y cierre. Conserva `status` para los consumidores existentes.
- Las instrucciones del asistente requieren consultar la fuente vigente, identificarla, distinguir estados, mostrar la hora en America/Lima y reconocer los errores de consulta.

## Verificación ejecutada

- `npm --prefix backend run build`: correcto.
- `npm --prefix backend test -- tests/customerAcademicTraceability.test.ts`: 30 pruebas correctas, incluidas las regresiones IA01.
- `npm --prefix backend run test:ai-agent`: 23 pruebas correctas.

Alcance: pruebas con dobles de base de datos/proveedor. No se ejecutó en esta revisión una conversación con Gemini ni una integración SQL real. Las instrucciones al modelo no garantizan por sí solas la fidelidad de todas las respuestas generadas.

## Prueba guiada en el portal

1. Iniciar sesión como paciente con sesiones registradas y preguntar: «¿Cuáles son mis próximas sesiones? Muéstrame las fechas y sus estados».
2. Comparar contra el cronograma autorizado: número, fecha/hora de Lima, sede, profesional y estados. La respuesta debe identificar NexoSaludDB como fuente y no cambiar la agenda.
3. Preguntar por el cronograma completo de un tratamiento propio. Si hay varios, resolver la selección sin pedir IDs internos.
4. Intentar consultar un tratamiento de otra persona: no debe revelar sesiones ni confirmar datos personales.
5. Con un paciente sin próximas sesiones, informar la ausencia de resultados sin inventar fechas.
6. Ante un fallo de consulta, informar que no se pudo verificar; no afirmar que no existen sesiones.

La validación manual queda pendiente hasta observar estos resultados en el entorno de ejecución.
