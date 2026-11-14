# IA13 — Preparar cierre del tratamiento

## Uso

1. Iniciar sesión como odontólogo responsable del tratamiento.
2. Abrir **Atención & Documentación** y seleccionar una atención vinculada al tratamiento.
3. Consultar **Checklist consultivo de cierre** y abrir **Evidencias por sesión**. Usar **Actualizar checklist de cierre** para reconsultar sin alterar la ficha.
4. En el copiloto, con esa atención seleccionada, también puede pedirse: «Prepara el cierre del tratamiento: resume evidencias y pendientes, sin cerrarlo».
5. Resolver los pendientes mediante sus flujos autorizados. La revisión de requisitos no registra una conclusión clínica.
6. Solo el odontólogo puede declarar su decisión en **Continuidad y revisión supervisada → Decisión formal de cierre del tratamiento**, aportar evidencia y marcar la confirmación específica de conclusión. El backend vuelve a comprobar los registros en una transacción antes del cierre formal.

## Alcance y correcciones

La preparación es de solo lectura. Un único evaluador reúne el checklist y determina los bloqueos documentales del cierre formal, evitando discrepancias entre la vista y la acción. No determina éxito clínico ni recomienda el alta.

Se comprueban el estado formal e inicio real, plan vigente con total positivo, cantidad y versión de sesiones, números duplicados, realización y cierre, excepciones, atención vinculada al mismo paciente y tratamiento, realización asistencial registrada y vigencia de la validación documental. Esta última debe coincidir con política, huella de documentos y revisión de la ficha actuales, además de tener resultado Completa sin campos pendientes.

Las evidencias incluyen la identificación de validación, política y revisión de ficha, y los documentos de indicaciones vigentes, aprobados y emitidos. La ausencia de indicaciones se considera pendiente solo cuando la política documental aplicable las exige. Las revisiones humanas Atendida siguen pendientes hasta Resuelta. También se muestran borradores clínicos vigentes sin transferir y borradores de indicaciones pendientes de resolución.

El chat dispone de una herramienta de consulta específica y presenta el resultado verificado sin una segunda generación que pueda convertir la ausencia de pendientes documentales en una conclusión clínica. No tiene herramientas de cierre.

La confirmación de conclusión es independiente de las confirmaciones de otras acciones clínicas; exige evidencia y confirmación booleana explícita. El responsable profesional se comprueba de nuevo dentro de la transacción. Ni preparar el checklist ni alcanzar 100 % de avance ejecutan el cierre.

## Verificación

- Backend: compilación y 93 pruebas correctas (trazabilidad, orquestador y seguridad).
- Frontend: compilación y 41 pruebas correctas, incluyendo evidencias, actualización, fallo de consulta y confirmación independiente de cierre.
- Total: 134 pruebas. Se verificaron las acciones de cierre con persistencia simulada, sin escribir datos clínicos en SQL Server.
- Consulta real de solo lectura en NexoSaludDB, paciente DNI 40000315, tratamiento 1: 1 de 3 sesiones completadas; estado Activado; falta política DOCUMENTACION publicada, dos sesiones pendientes y un borrador sin resolver. El resultado requiere revisión y no habilita cierre.

No se crearon políticas ni aprobaciones institucionales, no se validaron fichas y no se cerraron sesiones o tratamientos reales. La prueba integral del cierre formal con SQL Server queda para un caso de prueba autorizado que cumpla sus requisitos profesionales.
