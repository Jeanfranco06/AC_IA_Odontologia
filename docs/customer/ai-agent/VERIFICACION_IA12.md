# IA12 — Progreso administrativo de sesiones

Coordinación corresponde al perfil institucional `RECEPCION`; `ADMIN` también puede consultar esta vista. No se crea un rol clínico nuevo ni se habilita el expediente a Recepción.

En el espacio institucional, abrir **Progreso de sesiones**, buscar por nombre, apellido o servicio y seleccionar un tratamiento. La búsqueda devuelve hasta 50 opciones con datos administrativos. La consulta puede actualizarse manualmente; también se refresca al recuperar el foco y cada 30 segundos mientras la página está visible.

El backend consulta el plan y las sesiones en una transacción de lectura. Cuenta como completadas únicamente las sesiones `Realizada` y `Cerrada`. Una sesión realizada con cierre pendiente se muestra por separado y sigue pendiente administrativamente. La validación documental de IA11 no equivale al cierre de sesión.

No se persiste un porcentaje redundante. Cada consulta calcula el avance desde los registros oficiales. Sin plan válido, con exceso de completadas o con sesiones de otra versión, el porcentaje y los pendientes son nulos y requieren revisión. El portal del paciente respeta ese resultado sin reconstruir un porcentaje alternativo.

## Prueba funcional

1. Consultar un tratamiento con plan de tres sesiones y una realizada y cerrada: completadas 1, pendientes 2, avance 33,33 %.
2. Registrar una segunda atención realizada mediante el flujo profesional autorizado: mientras la sesión siga sin cierre, el avance permanece en 33,33 % y aumenta el conteo de realizadas pendientes de cierre.
3. Comprobar y registrar la validación documental vigente: eso por sí solo conserva el conteo anterior.
4. El odontólogo confirma **Cerrar sesión con validación** cuando los requisitos institucionales estén satisfechos. Al reconsultar deben aparecer 2 completadas, 1 pendiente y 66,67 %.
5. Completar administrativamente las tres sesiones puede mostrar 100 %, conservando el estado formal del tratamiento hasta la decisión profesional independiente de cierre.

No ejecutar cierres en pacientes reales solo para probar. Si falta una política documental publicada, el flujo profesional debe mantenerse bloqueado; las plantillas de indicaciones no sustituyen esa política.

## Verificación ejecutada

- Compilación de backend y frontend correcta.
- 74 pruebas de trazabilidad, 10 del orquestador y 3 de seguridad correctas.
- 2 pruebas de interfaz de progreso correctas: refresco, 100 % sin alta, nulos y descarte de respuestas antiguas.
- 36 pruebas de regresión del espacio institucional y contratos del frontend correctas (125 pruebas en total).
- Revisión del procedimiento SQL de cierre: actualiza la sesión y registra su evento; no cierra el tratamiento.

Estas verificaciones usan datos simulados en pruebas. No se registraron validaciones ni cierres de pacientes en NexoSaludDB y no se ejecutó una prueba integral de escritura en SQL Server.
