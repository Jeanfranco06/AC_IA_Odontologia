# Actividad complementaria: recomendaciones para las otras fases

[Guía principal](../README.md) · [Entrega a LEAD](ENTREGA_A_LEAD.md) · [Cambios realizados](../CAMBIOS_REALIZADOS.md).

**Estado:** Buyer tiene su ronda de validacion cerrada. Estas recomendaciones para las otras fases siguen siendo propuestas; Germain no implemento esos redisenos. Cada equipo debe contrastarlas con Informe IN final y sus reportes, implementarlas en su propia rama y aportar pruebas. Para comenzar LEAD, seguir la guia de entrega enlazada.

## 1. Punto de partida

El bloque 2 de [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) incorpora las cuatro fases con las reglas heredadas de Semana 9. La corrección puntual de PAYER evita multiplicar pagos al relacionarlos con la fuente. Las conciliaciones aportadas por Daniel muestran totales iguales; no demuestran por sí solas que todos los KPI estén bien definidos.

Consultar el esquema en [init_oltp.sql](../semana9/init_oltp.sql), [init_mart.sql](../semana9/init_mart.sql) y las medidas del bloque 2. Comparar cada una con su tabla de indicadores, descripción y reporte de la pestaña principal del informe. No trasladar el grano «una persona» de Buyer a fases con múltiples solicitudes, pagos, citas o seguimientos por persona.

## 2. LEAD — responsables indicados: Vigo y Ventura

**Informe:** conversión a PAYER en 14 días, primera respuesta útil en 15 minutos hábiles y abandono de negociaciones.

| Capa | Recomendación para evaluar |
|---|---|
| OLTP | Identificar cada negociación mediante `id_solicitud`; preservar fechas de apertura, primera respuesta útil, cierre y resultado. Vincular eventos a la solicitud correspondiente, no únicamente a persona. |
| Mart | Evaluar detalle por solicitud, con dimensiones/fechas pertinentes y medidas agregables. No contar a una persona una sola vez si tiene negociaciones distintas. |
| ETL | Evitar duplicación por múltiples reservas/opciones. Comprobar la evidencia que realmente define PAYER; la existencia de una reserva no prueba un abono. Comparar fechas con ventana exacta. |
| Indicadores/reporte | Determinar cohortes evaluables, qué cuenta como respuesta útil y cómo se computa tiempo hábil. Definir el denominador de abandono: el código actual cuenta `Convertida` como `negociacion_finalizada`, que puede no corresponder al universo de negociaciones terminadas. |

También revisar el negociador fijo `id_usuario=1` y los valores de respaldo a dimensiones reales. Proponer un dato operativo verificable, no otro ID fijo.

**Pruebas sugeridas:** dos reservas para una solicitud, negociación sin respuesta, respuesta fuera de horario, conversión después de 14 días y abandono sin conversión. Los filtros deben aplicarse al mismo conjunto de solicitudes.

## 3. PAYER — responsables indicados: Mario y Marck

**Informe:** pagos validados, tiempo promedio de validación, pagos rechazados y conversión a CUSTOMER.

| Capa | Recomendación para evaluar |
|---|---|
| OLTP | Mantener identidad de cada pago, reserva/persona, estados y marcas de validación/reversión. Si existen comisiones, registrar la fuente del costo real. Acordar cómo se representan anticipos, cuotas y devoluciones. |
| Mart | Evaluar grano por pago y roles de fecha de registro/validación. Preservar pagador, campaña y hora sin asignar `MIN()` a un grupo que contiene varios valores. |
| ETL | Conservar la corrección del JOIN por campaña. Revisar el lookup de pasarela, los tiempos de pagos no validados y el cálculo `importe * 0.03`, que es una estimación fija heredada. No presentarlo como comisión observada sin fuente. |
| Indicadores/reporte | Definir CUSTOMER de forma coherente: el recorrido general del informe lo relaciona con pago validado/cita confirmada, pero la descripción de P4 menciona atención en sillón. Acordar el evento y la denominación antes de cambiar la fórmula. |

**Pruebas sugeridas:** varios pagos de una reserva, pago pendiente con fecha de validación nula, rechazo, reversión, campaña con varias filas en la dimensión y paciente con más de una operación. Cantidad de pagos, pacientes y reservas no son intercambiables.

## 4. CUSTOMER — responsable indicado: Jeanfranco

**Informe:** asistencia efectiva, no-show, tiempo promedio en sillón y conformidad asistencial.

| Capa | Recomendación para evaluar |
|---|---|
| OLTP | Registrar citas evaluables, llegada/asistencia, cancelación/reprogramación, inicio, fin y contenido clínico de cierre. Definir la relación de la cita con la atención. |
| Mart | Evaluar un detalle por cita/atención según el evento medido; no agrupar perdiendo hora o identidad del acto. Las duraciones abiertas deben ser desconocidas, no ceros que distorsionan promedios. |
| ETL | Revisar si contar solo `Atenciones` omite reservas que todavía no tienen atención. Separar cancelación de inasistencia según la regla acordada. Comprobar duración no negativa y no sumar promedios. |
| Indicadores/reporte | `estado_servicio='Realizado'` no demuestra ficha completa. Definir los campos exigidos para conformidad y verificar contenido no vacío. Validar denominadores de asistencia/no-show y la comparación con duración objetivo. |

El seed original anunció 25 inasistencias y 9 cancelaciones, mientras las consultas sobre el campo de asistencia contabilizaron 34 «No asistió». Investigar su representación y la regla del negocio; no cambiar el dato o la consulta solo para reproducir el mensaje impreso.

**Pruebas sugeridas:** cita sin atención, cancelada, reprogramada, paciente ausente, atención en curso y atención finalizada con ficha incompleta. No reconstruir estados clínicos solo desde la etapa actual de la persona.

## 5. TURNED — responsable de la fase a confirmar con el equipo

**Informe:** contacto posterior en 48 horas, resolución de incidencias en 24 horas, retorno a 90 días y activación preventiva.

| Capa | Recomendación para evaluar |
|---|---|
| OLTP | Relacionar seguimiento con su atención; registrar contacto efectivo, incidencia y fecha real de resolución. Definir episodio/base de retorno y evidencia de nueva atención o solicitud. |
| Mart | Diferenciar grano seguimiento, incidencia y paciente/cohorte. Un hecho de incidencias separado puede justificarse si se necesita analizar resolución sin multiplicar datos por cada seguimiento. No agregarlo por rutina. |
| ETL | El código actual de `incidencia_resuelta_24_hora` cuenta `incidencia=1`; no verifica resolución. Usar fechas/estado de `Incidencias`. Para retorno, evitar contar el mismo paciente una vez por seguimiento o sumar distintos por grupos como si fueran únicos globales. |
| Indicadores/reporte | Comprobar realmente las 48/24/90 horas o días, madurez de cohortes y consistencia entre numerador/denominador. Revisar si la fórmula de activación preventiva mide una acción efectiva de activación o solo elegibilidad. |

**Pruebas sugeridas:** varios seguimientos de una atención, una incidencia vinculada a varios contactos, resolución después del plazo, paciente sin retorno, retorno dentro/fuera de 90 días y cohorte aún inmadura. Cero incidencias en el seed no valida la regla de resolución.

## 6. Recomendaciones transversales

- Preservar `EventosEtapa` como historia de transiciones, pero obtener pagos, ejecución clínica y seguimiento de sus entidades operativas. El evento no reemplaza el comprobante o acto que lo sustenta.
- Resolver las etapas por nombre y las dimensiones por su clave natural única. Usar miembro desconocido, no una sede/persona/campaña real como valor de respaldo.
- Distinguir hechos, medidas e indicadores. Conservar los indicadores del informe, aclarando una definición solo cuando la contradicción lo haga necesario.
- Mantener una fuente canónica de extracción por fase y transacciones de carga. Si se ofrecen variantes MERGE e INSERT, demostrar equivalencia.
- Probar por dimensiones y por registro, además del total general; un total correcto puede estar mal atribuido.
- No mezclar directamente hechos de diferentes granos: agregar por dimensiones comunes antes de relacionarlos.
- Mantener SQL Server/T-SQL en esta entrega. La futura migración a PostgreSQL no resuelve problemas de grano o de reglas del negocio.

## 7. Entrega requerida a los responsables

Cada equipo documentara y contrastara su propuesta por fase con esta estructura:

| Campo | Contenido requerido |
|---|---|
| Requerimiento | Indicador/reporte y sección de la pestaña principal del informe. |
| Regla actual | Tabla, columna y bloque SQL que la implementa. |
| Problema | Ejemplo de registro o escenario que muestra la inconsistencia. |
| Cambio OLTP propuesto | Datos, relación, restricción o evento necesarios; no inventar fechas históricas. |
| Cambio Mart/ETL propuesto | Grano, claves, medidas y transformación. |
| Impacto | Resultado esperado y cambios mínimos del reporte si son indispensables. |
| Prueba de aceptación | Consulta/caso y resultado esperado, con estado pendiente hasta ejecutarlo. |
| Responsable | Integrante que validará y afinará la fase. |

Cada equipo decide y prueba la implementación en su propia rama. La guía no sustituye la validación del dueño de la fase ni instruye modificar `main` directamente.
