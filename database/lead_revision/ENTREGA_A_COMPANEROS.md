# Entrega de BUYER y LEAD para el equipo

Esta es la guía principal para continuar **PAYER, CUSTOMER y TURNED**. La OLTP de BUYER y LEAD está instalada en **`NexoSaludDB`** e incluye la captación, la conversión trazable, la negociación comercial y las consultas R1–R3. Las **nueve dimensiones y los cinco hechos de LEAD** están instalados en **`NexoSalud_Mart`**. [Estado, dependencias y orden de ejecución del Mart](#7-data-mart-de-lead).

La rama `lead` publica el paquete SQL y su documentación. El código de aplicación de BUYER y LEAD se probó localmente y quedó fuera del commit SQL. Coordinen su integración antes de asumir que una copia de la rama incluye esas rutas y pantallas.

## 1. Qué cambió en la base

La migración fue aditiva. Conservó las tablas y los identificadores existentes y agregó estos objetos de negocio y auditoría.

| Tabla nueva | Para qué sirve |
| --- | --- |
| `CaptacionesBuyer` | Guarda una captación inicial por persona. Conserva fecha, canal, fuente, campaña, sede, servicio, motivo, calidad y autorización cuando hay evidencia. |
| `PropuestasEconomicasLead` | Guarda las cotizaciones de una solicitud, con tratamiento, sede opcional, precio, promoción, fechas y resultado. La raíz identifica la propuesta y cada revisión tiene su propio ID y número de versión. |
| `PromocionesLead` y `MotivosRechazoLead` | Catalogan promociones y motivos tipificados. Los motivos se separan por ámbito, propuesta o alternativa, y por categoría. |
| `CambiosOpcionLead` | Registra modificaciones comerciales a una opción sin crear otra alternativa para el conteo. Identifica los cambios previos a una reserva. |
| `HistorialSolicitudesLead`, `HistorialPropuestasLead` e `HistorialOpcionesLead` | Guardan los estados observados y sus fechas UTC. El historial de opciones conserva también la fecha, horario, sede y profesional que se ofrecieron. |
| `ConfiguracionLeadRevision` | Fija el inicio de la auditoría para saber desde cuándo se pueden consultar cortes históricos de LEAD. |

En las **tablas compartidas** quedaron estas extensiones:

- `EventosEtapa` enlaza la transición BUYER → LEAD con `id_captacion`, `id_solicitud` y una `clave_operacion_buyer` única cuando se registra. `DecisionesIA` puede referenciar una captación y una interacción.
- `Solicitudes` conserva el ID de la oportunidad. Se añadieron fecha de ingreso a LEAD, canal de origen, sede de interés, negociador, próximo seguimiento y los campos de decisión comercial, importe, propuesta aceptada y motivo de cierre. También se añadieron la marca de archivo y la clave y huella para los reintentos web.
- `Opciones` conserva el ID de la alternativa y su disponibilidad. Se añadieron el resultado y su fecha, el motivo de rechazo, las referencias a la propuesta y la preferencia, los datos de horario preferido y turno ofrecido, y la marca de archivo. `Interacciones.id_solicitud` permite vincular comunicaciones a una oportunidad de la misma persona.

## 2. De BUYER a LEAD

1. El alta habitual registra `Personas` y la captación en una transacción. Si hay una coincidencia inequívoca de identidad, el flujo de alta reutiliza a la persona. La restricción única sobre `CaptacionesBuyer.id_persona` impide duplicar su captación.
2. `dbo.usp_ConvertirBuyerALead` recibe la captación, el servicio y el motivo. Verifica calidad, contacto utilizable, autorización y servicio activo. Crea la solicitud, enlaza el evento BUYER → LEAD y actualiza la etapa de la persona en una transacción. Un reintento devuelve los identificadores de la conversión existente. Los registros históricos sin vínculo comprobado no deben completarse por inferencia.
3. El formulario web probado vincula el ingreso a su solicitud. Repetir el mismo contenido con la misma clave de idempotencia devuelve esa solicitud. Una consulta nueva puede abrir otra oportunidad de la misma persona sin duplicar su identidad.

## 3. Cómo funciona LEAD

- **Oportunidad.** Se trabaja por `id_solicitud`. El resultado comercial puede ser `PENDIENTE`, `ACEPTADA` o `CERRADA_SIN_ACUERDO`. `NULL` indica que no hay resultado documentado. Aceptar exige evidencia comercial expresa y una propuesta aceptada de la misma solicitud con el importe acordado. Cerrar sin acuerdo exige fecha y motivo. Reservar o pagar no acredita por sí solo un acuerdo.
- **Propuesta.** La raíz tiene versión 1 y `id_propuesta_raiz` nulo. Un cambio de precio o promoción crea una nueva versión ligada a la misma raíz. Una decisión guarda estado y fecha. El rechazo usa el motivo tipificado de ámbito `PROPUESTA`. Para R2 se toma la versión vigente al corte y se cuenta la raíz una sola vez.
- **Alternativa.** Se usa una disponibilidad vigente y se guardan los datos preferidos y ofrecidos. `dbo.usp_Lead_PresentarAlternativa` permite registrar la oferta en SQL y valida sus vínculos. El rechazo requiere fecha y motivo de ámbito `ALTERNATIVA`. Una modificación previa a la reserva conserva el mismo `id_opcion` y deja evidencia. Para cambiar el horario, se referencia otra disponibilidad. Los disparadores protegen el horario ya ofrecido y las condiciones de opciones con reserva.
- **Historial.** Los disparadores capturan las escrituras desde el inicio de la auditoría. El archivo lógico permite retirar una solicitud u opción de la mesa sin perder su evidencia. Los históricos sin datos suficientes se mantienen sin clasificar. Cambiar el ámbito o la categoría de un motivo ya usado alteraría el KPI histórico y está bloqueado.

## 4. Contrato con PAYER, CUSTOMER y TURNED

| Etapa | Cómo continuar con las tablas existentes |
| --- | --- |
| **PAYER** | Usar `Reservas.id_persona`, `id_solicitud` e `id_opcion` para conservar el vínculo con la negociación y la opción elegida. Verificar que las tres referencias correspondan entre sí. Registrar pagos en `Pagos` vinculados a la reserva. Mantener separados el importe cobrado, el precio ofrecido y el valor del acuerdo comercial. |
| **CUSTOMER** | Usar `Atenciones.id_reserva` y conservar la persona, servicio, sede y profesional de la atención. Registrar asistencia y prestación en `Atenciones`. Actualizar esos estados clínicos sin reescribir la solicitud, la oferta ni el pago anterior. |
| **TURNED** | Conservar `id_persona` y `id_atencion` al registrar seguimientos en `Seguimientos`. Usar `EventosEtapa` para documentar transiciones. Si se abre otra solicitud para la misma persona, vincularla a su identidad existente. `Incidencias` conserva sus referencias a reserva, pago o atención según corresponda. |

**Al extender el esquema**, mantengan las claves primarias y foráneas, los campos de fecha y los disparadores de auditoría. Una reprogramación debe conservar la evidencia del horario original. Eviten borrar solicitudes u opciones con historia, cambiar sus IDs o reclasificar motivos para corregir resultados. Usen migraciones incrementales y prueben en una restauración las escrituras nuevas, las restricciones y el resultado de los reportes.

La validación de las etapas posteriores sigue a cargo de sus equipos. En las pruebas exploratorias se detectaron estados que las rutas existentes intentaban escribir y que las restricciones no admitían. En la copia, `Pagos.estado` admitía `Confirmado` y rechazó `Validado`. En `Atenciones`, se rechazó `Confirmada` como asistencia y `Finalizado` como estado del servicio. También se detectó que una reactivación desde TURNED podía crear otra persona antes de fallar al crear la solicitud. Revisen esos contratos en copia antes de reutilizar esas rutas.

## 5. Medidas e indicadores desde la OLTP

| Grano | Medidas binarias por registro | Indicador |
| --- | --- | --- |
| Una solicitud ingresada a LEAD | **M1** oportunidad aceptada, **M2** oportunidad cerrada sin acuerdo. | **L1** = 100 × ΣM1 / (ΣM1 + ΣM2) |
| Una propuesta raíz, con su versión vigente al corte | **M3** propuesta aceptada, **M4** propuesta rechazada, **M5** propuesta rechazada por motivo económico. | **L2** = 100 × ΣM5 / (ΣM3 + ΣM4) |
| Una opción ofrecida, con independencia de sus modificaciones | **M6** alternativa aceptada, **M7** alternativa rechazada, **M8** alternativa rechazada por incompatibilidad. | **L3** = 100 × ΣM8 / (ΣM6 + ΣM7) |

Los pendientes y los casos sin evidencia quedan fuera de los denominadores. El resultado sin denominador es `NULL` («No calculable»). M5 y M8 requieren un rechazo y su motivo tipificado. Una diferencia de horario no constituye por sí sola una incompatibilidad rechazada.

Las vistas `dbo.v_OrigenMedidasOportunidadLead`, `dbo.v_OrigenMedidasPropuestaLead` y `dbo.v_OrigenMedidasAlternativaLead` exponen el estado actual. Las funciones `dbo.fn_Lead_Oportunidades_Corte`, `dbo.fn_Lead_Propuestas_Corte` y `dbo.fn_Lead_Alternativas_Corte` reconstruyen el estado observado a un corte UTC. `dbo.usp_Lead_ReporteR1`, `dbo.usp_Lead_ReporteR2` y `dbo.usp_Lead_ReporteR3` consultan, respectivamente, negociaciones, propuestas y alternativas. En R2 y R3 el filtro de motivo acota el detalle. El KPI conserva todos los motivos de la población delimitada por los demás filtros.

## 6. Qué ejecutar y qué quedó validado

- **Para continuar sobre `NexoSaludDB`**, usen el esquema instalado. [`VERIFICAR_OLTP_INSTALADO.sql`](VERIFICAR_OLTP_INSTALADO.sql) comprueba medidas y restricciones. Los scripts de comparación de catálogo y filas sirven para contrastar con una restauración de referencia.
- **Para instalar en una copia compatible todavía sin migrar**, el punto de entrada aprobado es [`APLICAR_BUYER_LEAD.sql`](APLICAR_BUYER_LEAD.sql). Para el ensayo, el instalador admite `NexoSalud_LeadEnsayoFinal` como destino explícito. Ejecuta [`01_BUYER_OLTP.sql`](01_BUYER_OLTP.sql) y [`INSTALAR_LEAD_COMPLETO.sql`](INSTALAR_LEAD_COMPLETO.sql), en ese orden y en una transacción. Sigan el [procedimiento de instalación, huellas y recuperación](PROCEDIMIENTO_INSTALACION_OLTP.md). No repitan el instalador sobre la base ya actualizada ni ejecuten los inicializadores de la base para incorporar cambios de otras etapas.
- **Pruebas.** Se verificaron el respaldo y su restauración, la conservación de las filas originales de 31 tablas, el esquema y las restricciones. En una restauración posterior a la instalación pasaron la conversión idempotente, el corte de versiones, la conservación de alternativas y sus modificaciones, M1–M8 y R1–R3. [`PRUEBA_INTEGRACION_LEAD.sql`](PRUEBA_INTEGRACION_LEAD.sql) usa datos sintéticos con rollback y rechaza la base principal. El [informe de instalación](RESULTADOS_INSTALACION_OLTP.md) registra los resultados reales.
- **Pendientes.** En la principal aún no había conversiones documentadas ni casos resueltos al corte de verificación. Falta observar la primera conversión real, validar el poblamiento con los primeros resultados comerciales acreditados y completar las pruebas de PAYER, CUSTOMER y TURNED.

## 7. Data Mart de LEAD

El **9 de noviembre de 2026** se instalaron nueve dimensiones. Se reutilizaron `Dim_Tiempo`, `Dim_Servicio`, `Dim_Canal`, `Dim_Sede`, `Dim_Negociador` y `Dim_Profesional`, y se agregaron `Dim_Promocion`, `Dim_MotivoRechazo` y `Dim_Horario`. Horario representa los roles preferido y ofrecido. [Diseño y pruebas](mart_dimensiones/README.md) · [Informe de instalación de dimensiones](mart_dimensiones/RESULTADO_DESPLIEGUE_MART_LEAD.md).

El **10 de noviembre de 2026** se instalaron los cinco hechos agregados con claves primarias compuestas y 25 claves foráneas. El ETL usa las unidades y medidas de la [sección 5](#5-medidas-e-indicadores-desde-la-oltp) y suma las operaciones por combinación dimensional. [Grano, claves y consultas de verificación](mart_hechos/README.md).

| Hecho instalado | Medidas |
| --- | --- |
| `fact_oportunidades_lead` | M1, M2 |
| `fact_propuestas_aceptadas_lead` | M3 |
| `fact_propuestas_rechazadas_lead` | M4, M5 |
| `fact_alternativas_aceptadas_lead` | M6 |
| `fact_alternativas_rechazadas_lead` | M7, M8 |

Al instalar, M1–M8 conciliaron en cero en ambas bases porque todavía no había resultados comerciales acreditados. Las dimensiones y los cinco hechos heredados conservaron sus filas y medidas. El informe corresponde a la carga inicial. La integración del código de aplicación, la programación de cargas periódicas y los dashboards quedan fuera de esta entrega. [Informe de instalación de hechos](mart_hechos/RESULTADO_DESPLIEGUE_HECHOS_LEAD.md).

**Dependencias entre etapas.** LEAD usa el ingreso BUYER documentado y las dimensiones compartidas. La actualización del hecho BUYER, su hecho de inversión y su ETL completo se coordinan por separado. PAYER consume las referencias de reservas y pagos descritas en la sección 4. Su nuevo paquete dimensional tampoco es un prerrequisito de LEAD y su despliegue sigue separado. Si se programan cargas concurrentes, coordinen la ventana. BUYER y LEAD usan el mismo recurso de bloqueo en la OLTP. El recurso auditado de PAYER está en el Mart y no los serializa. [Auditoría de compatibilidad](auditoria_dimensional/DIAGNOSTICO_INTEGRACION.md).

**Orden aplicado.** En una restauración compatible que aún necesite la instalación, reproducir **OLTP BUYER → LEAD**, luego **dimensiones** y después **hechos**, siguiendo las guardas de cada entorno. En las bases principales ya actualizadas, usar los controles de lectura. Las guías de ventana documentan la instalación inicial y el procedimiento de recuperación.

1. OLTP con [`APLICAR_BUYER_LEAD.sql`](APLICAR_BUYER_LEAD.sql) y su [procedimiento](PROCEDIMIENTO_INSTALACION_OLTP.md).
2. Dimensiones con [`09_APLICAR_DIMENSIONES.sql`](mart_dimensiones/09_APLICAR_DIMENSIONES.sql), según el [procedimiento dimensional](mart_dimensiones/PRE_DESPLIEGUE_MART_LEAD.md).
3. Hechos con [`08_APLICAR_HECHOS.sql`](mart_hechos/08_APLICAR_HECHOS.sql) y su [procedimiento de ventana](mart_hechos/PRE_DESPLIEGUE_HECHOS_LEAD.md). La conciliación posterior se puede reproducir con [`04_VALIDAR_HECHOS.sql`](mart_hechos/04_VALIDAR_HECHOS.sql), usando los parámetros del entorno.
