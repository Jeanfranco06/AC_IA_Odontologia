# Actividad complementaria: recomendaciones para las otras fases

[Guía principal](../README.md) · [Entrega a LEAD](ENTREGA_A_LEAD.md) · [Cambios realizados](../CAMBIOS_REALIZADOS.md) · [Orden SQL y sistema](EJECUCION_SQL_SERVER.md) · [Poblamiento 10k](POBLAMIENTO_BUYER_10K.md).

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

## 8. Aprovechar la cohorte 10k sin inventar operaciones posteriores

### 8.1 Base y alcance comun

Partir de HEAD de analysis/buyer-bases-datos en rama propia por equipo. [Entrega LEAD, seccion 1](ENTREGA_A_LEAD.md#1-desde-que-version-partir) muestra como crearla; cambiar el nombre segun fase. Una rama propia no crea otra BD en la instancia: conservar copia local de baseline y evitar que varios equipos ejecuten migraciones incompatibles sobre la misma base compartida.

Seguir el [orden de instalacion nueva](EJECUCION_SQL_SERVER.md#11-orden-completo-con-o-sin-cohorte-de-10k) o la [ruta para bases existentes](EJECUCION_SQL_SERVER.md#72-elegir-segun-el-estado-local), nunca ambas. 08 agrega datos, no reemplaza el seed original; 09 controla solo V1 y 02 compara el conjunto global con los hechos heredados.

| Fase | Lo que recibe de 08 | Lo que su equipo debe preparar |
|---|---|---|
| LEAD | 2550 solicitudes Abierta y eventos de conversion coherentes con captacion. | Respuesta util y responsable, opciones, agenda, resultados, cierres, conversion a PAYER y casos de plazos. |
| PAYER | Las personas y solicitudes V1; **sin nuevos pagos ni reservas**. | Opciones/disponibilidad y reservas coherentes antes de los pagos; estados, validaciones, reversiones y costos verificables. |
| CUSTOMER | Las identidades V1; **sin nuevas citas/atenciones**. | Reserva y evidencia operativa del paso anterior segun regla acordada; asistencia, servicio, profesional/sede, inicio/fin y ficha clinica. |
| TURNED | Las identidades V1; **sin nuevos seguimientos/incidencias**. | Atenciones y sus seguimientos, incidencias/resolucion, retornos y ventanas maduras. |

Los 60 gastos por S/60000 son inversion de captacion. No reutilizarlos como importe de cobros, comision de pasarela, ingreso clinico ni costo de seguimiento. Las cantidades 10000/8500/2550 son parametros de un escenario, no constantes ni metas que deban imponer a sus fases.

### 8.2 Orden para los fixtures dependientes

1. Validar Buyer y seleccionar IDs reales del conjunto con la [consulta de entrada LEAD](ENTREGA_A_LEAD.md#73-consulta-de-entrada-conservar-ids-reales).
2. Preparar disponibilidad/agenda, servicio, profesional y sede reales del catalogo. Las pocas disponibilidades originales no son agenda suficiente para 2550 reservas. Para pruebas actuales crear slots futuros propios sin mover la historia de Buyer; para analitica historica crear una agenda historica de prueba coherente.
3. Crear opciones de la solicitud y reservas que apunten a opcion/solicitud/persona correctas. La FK de cada campo por separado no demuestra que todos pertenezcan al mismo recorrido; validar tambien esa correspondencia.
4. Incorporar pagos de reservas para PAYER, respetando estados y fechas. La decision de que evento habilita CUSTOMER se acuerda con el informe; no inferirla solo de la etapa actual.
5. Incorporar atenciones de reservas con servicio, sede y profesional coherentes, manteniendo casos de cancelacion/ausencia separados.
6. Incorporar seguimientos vinculados a la atencion correcta e incidencias/retornos con evidencia temporal.
7. Cargar ETL en orden de dependencias acordado y validar cada fase antes de continuar. Con la implementacion heredada, bloque 2 recarga las cuatro juntas; con rutinas nuevas documentar los destinos y sustituir secciones incompatibles.

Comenzar por pocos casos controlados (por ejemplo 5 a 20 por fase) antes de ampliar volumen. No es necesario convertir los 2550 LEAD en pagos, atenciones y retornos para demostrar coherencia. Separar fixtures de limites, de volumen y de operaciones actuales; los porcentajes futuros deben justificarse como simulacion.

### 8.3 Versionar datos de prueba y evidencias

El SQL de fixtures de cada fase debe tener marca propia, resolver claves por catalogos, no borrar V1 ni datos ajenos, describir reejecucion y transacciones y conservar el enlace a la operacion origen. Las nuevas acciones pueden cambiar conteos e interacciones: [baseline y deltas](ENTREGA_A_LEAD.md#74-baseline-y-casos-nuevos). No ejecutar 08/09 como restauracion de una cohorte que ya se transformo intencionalmente.

## 9. Archivos del sistema y pruebas por equipo

### 9.1 Mapa de codigo existente

| Fase / capa | Punto de entrada |
|---|---|
| LEAD | [Guia detallada de integracion](ENTREGA_A_LEAD.md#9-integracion-con-el-sistema), [rutas](../../../backend/src/routes/lead.routes.ts), [pagina](../../../src/modules/lead/pages/LeadPage.tsx). |
| PAYER | [payer.routes.ts](../../../backend/src/routes/payer.routes.ts), [payment.routes.ts](../../../backend/src/routes/payment.routes.ts), [PayerPage.tsx](../../../src/modules/payer/pages/PayerPage.tsx), [usePayerQueries.ts](../../../src/modules/payer/hooks/usePayerQueries.ts). |
| CUSTOMER | [customer.routes.ts](../../../backend/src/routes/customer.routes.ts), [CustomerPage.tsx](../../../src/modules/customer/pages/CustomerPage.tsx), [customer.service.ts](../../../src/modules/customer/services/customer.service.ts). |
| TURNED | [turned.routes.ts](../../../backend/src/routes/turned.routes.ts), [TurnedPage.tsx](../../../src/modules/turned/pages/TurnedPage.tsx), [turned.service.ts](../../../src/modules/turned/services/turned.service.ts). |
| Persistencia y API | [schema.prisma](../../../backend/prisma/schema.prisma), [montaje de rutas](../../../backend/src/index.ts), [ejemplo de entorno](../../../backend/.env.example). |
| Reportes compartidos | [report.routes.ts](../../../backend/src/routes/report.routes.ts), [configuracion de medidas](../../../src/modules/reports/config/stages.ts), [servicio de reportes](../../../src/shared/services/report.service.ts). |
| Referencia de agregacion | [buyerCampaignMatrix.ts](../../../backend/src/services/buyerCampaignMatrix.ts) para cocientes y [buyerDurationMatrix.ts](../../../backend/src/services/buyerDurationMatrix.ts) para promedios ponderados. Aplicar el principio a sus componentes, no copiar formulas Buyer a otros KPI. |

Los archivos existen, pero su presencia no significa que cada flujo haya sido adaptado al modelo revisado. Revisar contratos/estados y restricciones SQL antes de usar botones que escriben datos. Por ejemplo, [la incompatibilidad de abandono LEAD](ENTREGA_A_LEAD.md#92-compatibilidades-pendientes-observadas) esta identificada y pendiente de resolver por ese equipo.

### 9.2 Orden de cambios y comprobacion en el sistema

1. Baseline SQL valida y definicion de negocio/grano de la fase.
2. Migraciones OLTP/Mart de la fase, datos de prueba y ETL canonico, con validacion propia.
3. Modelo Prisma y backend operativo: mismas identidades, estados permitidos, transaccion, errores y reintentos. Usar VITE_USE_API=true donde aplique y comprobar peticiones contra API; un fallback local no demuestra persistencia SQL.
4. Frontend: listar, abrir, editar y completar solo la operacion seleccionada; invalidar consultas para ver el resultado sin duplicar operaciones. Mostrar errores sin anunciar exito de una escritura parcial.
5. ETL de fase y consultas de reportes: filtro temporal consistente, fechas por rol, desconocidos NULL, divisores cero y denominadores correctos. Si cambia el grano, adaptar API, tarjetas, matriz y exportaciones en conjunto.
6. Comparacion SQL/API/UI del mismo caso y periodo; dos ejecuciones de carga, cambio de estado y casos limite. PDF/CSV deben conservar promedio/cociente recalculado por nivel y formatos legibles.
7. Regresion Buyer con origen preservado y deltas documentados cuando se creen nuevos buyers. No esperar que un boton de sincronizacion Buyer cargue su fase sin una integracion explicita.

Para levantar los procesos y configurar conexiones seguir [Ejecucion SQL Server, seccion 7.4](EJECUCION_SQL_SERVER.md#74-encender-y-comprobar-el-sistema). Mantener DUNNING_ENABLED=false durante pruebas de base; no activar envios o agentes como requisito de estas comprobaciones. No migrar a PostgreSQL dentro de esta actualizacion documental.

## 10. Checklist de entrega por fase

- Rama y commit base usados; seccion vigente del informe contrastada por el responsable.
- README con rutas nueva/existente y orden exacto, incluidos pasos que se omiten. Enlaces a los SQL reales; propuestas diferenciadas de archivos ejecutables existentes.
- Migraciones revisadas, claves/grano, contrato de entrada/salida, fuente de cada medida y cambio de consumidores.
- Fixtures marcados y volumen realmente generado; origen sin sobrescrituras, conciliacion por operacion/dimension/periodo y deltas respecto de Buyer.
- Pruebas SQL y sistema realmente ejecutadas, errores pendientes y resultados de compilacion/tests.
- Capturas y PDF/CSV correspondientes al mismo periodo/medida, con NULL y ceros explicitos diferenciados.

El equipo de fase decide su implementacion a partir de su informe; esta documentacion establece una base y un orden, sin aprobar automaticamente sus KPI ni realizar sus cambios.
