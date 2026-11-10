# Especificación de Requerimientos y Reportes – Etapa PAYER

Este documento establece las especificaciones funcionales, operativas y analíticas de la etapa **PAYER (Pago, Conciliación y Cadencia de Cobranza)** dentro del modelo de ciclo de vida del paciente odontológico.

---

## 1. Requerimientos del Sistema (RQ-PAYER-01 a RQ-PAYER-05)

### RQ-PAYER-01. Emisión de proformas y habilitación de canales de pago
- **Requerimiento:** La clínica necesita emitir proformas oficiales y ofrecer múltiples opciones de pago integradas tras la reserva médica.
- **Especificación:** Al registrar un cobro en estado `PENDIENTE`, el sistema debe emitir la proforma oficial (Orden de Pago en PDF vectorial) y habilitar pasarelas de pago como MercadoPago y Yape en tiempo real, así como transferencias bancarias o carga manual de comprobantes digitales.
- **Sustento:** Permite asegurar financieramente el compromiso del paciente antes de movilizar recursos operativos de la clínica, alineado con la fase de Pago y Validación del modelo IMPULSE.

### RQ-PAYER-02. Registro, conciliación y validación de comprobantes
- **Requerimiento:** La clínica necesita verificar que el importe abonado por el paciente coincida exactamente con las condiciones económicas pactadas en la reserva.
- **Especificación:** Cuando el paciente declara el pago, el registro debe pasar a estado `EN_REVISION`, capturando metadatos como monto, fecha, canal, número de operación y archivo adjunto (hasta 5 MB en formato JPG, PNG o PDF). El agente o personal de tesorería comparará esta información contra el importe de la reserva para dictaminar su actualización al estado `VALIDADO` o `RECHAZADO`.
- **Sustento:** Las discrepancias entre el monto declarado y la proforma deben detectarse oportunamente para evitar descuadres contables y asegurar la correcta recaudación.

### RQ-PAYER-03. Gestión de incidencias y reversiones de pago
- **Requerimiento:** La clínica debe mantener estricta trazabilidad sobre los cobros que no proceden exitosamente.
- **Especificación:** Ante rechazos o anulaciones (estado `REVERTIDO`), el sistema exigirá obligatoriamente el registro de una incidencia en la tabla `Incidencias` con justificación obligatoria de un mínimo de 10 caracteres.
- **Sustento:** Esto garantiza la auditoría de incidencias transaccionales y permite registrar el motivo exacto del rechazo para solicitar su subsanación al paciente.

### RQ-PAYER-04. Cadencia de cobranza automatizada y liberación de agenda
- **Requerimiento:** La clínica necesita monitorear los plazos de pago para evitar que las reservas no pagadas bloqueen turnos médicos injustificadamente.
- **Especificación:** El sistema debe ejecutar una monitorización automática en tres etapas: recordatorio preventivo a T-48h con proforma PDF, alerta de urgencia clínica a T-24h, y cancelación automática a las 00:00 hrs para liberar el sillón dental de forma inmediata ante la falta de pago.
- **Sustento:** Minimiza la inasistencia y la ociosidad de los sillones dentales, reduciendo las pérdidas asociadas a los costos fijos de la clínica.

### RQ-PAYER-05. Control de transición protegida hacia la atención clínica
- **Requerimiento:** La clínica debe garantizar que ningún paciente ingrese a la fase de atención presencial sin haber concretado y conciliado su abono.
- **Especificación:** La confirmación definitiva de la cita, la transferencia del paciente al módulo de atención clínica (`CUSTOMER`) y la emisión de la Constancia de Pago PDF oficial solo se habilitarán cuando el cobro alcance el estado formal de `VALIDADO`.
- **Sustento:** Constituye el validador de dominio principal de la etapa PAYER, asegurando que la cita quede bloqueada definitivamente en la agenda únicamente con el respaldo financiero correspondiente.

---

## 2. Objetivos y Estrategias del Módulo

### Objetivos de Negocio:
1. Formalizar la contratación del servicio odontológico pre-agendado en la fase LEAD mediante la recepción, validación y conciliación exitosa del abono o seña inicial.
2. Gestionar eficientemente el cronograma y la cadencia de pagos mediante un monitoreo preventivo y alertas de vencimiento para asegurar la recaudación antes del acto médico.
3. Liberar oportunamente los sillones dentales de la agenda médica ante situaciones de impago, optimizando la capacidad instalada y la ocupación del establecimiento.

### Estrategias Operativas:
1. **Cadencia automatizada y multicanal:** Ejecución del motor *Dunning Scheduler* que despacha correos automáticos con proformas vectoriales y cancela reservas vencidas sin intervención humana.
2. **Pasarelas de cobro web y verificación estricta:** Integración de MercadoPago y Yape dinámico con código OTP y QR, exigiendo comprobantes de hasta 5 MB y justificaciones obligatorias ($\ge 10$ caracteres) ante incidencias.
3. **Scoring de Riesgo IA y Rescate del 50%:** Cálculo predictivo del riesgo de fuga con Groq AI / Llama 3 para aplicar acciones de mitigación sugeridas, como la propuesta de rescate con seña del 50% para congelar la tarifa preferencial.

---

## 3. Especificación de los Reportes de Gestión PAYER

### R1. Reporte de Recaudación y Estados de Pago
- **Contenido:** Cantidad de cobros registrados, validados, pendientes, rechazados y revertidos; ingresos brutos recaudados e importes por canal.
- **Filtros:** Período de registro del pago (Año y Mes), pasarela/modalidad (bancarizado o billeteras digitales), estado del pago, sede y servicio.
- **Análisis:** Modalidad/canal (Yape, Plin, Transferencia BCP/BBVA, Tarjeta Web) cruzado con el estado del pago (`VALIDADO`, `PENDIENTE`, `RECHAZADO`, `EN_REVISION`).
- **Finalidad:** Monitorear la salud financiera, cuantificar el flujo transaccional y evaluar cuántos cobros han sido conciliados exitosamente, continúan pendientes o han fallado.
- **Unidad de análisis:** Transacción o registro de pago.
- **Fact asociada:** `Fact_RecaudacionPayer` (F1).

### R2. Reporte de Tiempos de Validación e Incidencias de Recaudación
- **Contenido:** Tiempo promedio transcurrido desde que se adjunta el comprobante hasta su validación contable; cantidad de incidencias generadas y motivos de rechazo/reversión.
- **Filtros:** Período de pago, prioridad de la incidencia, pasarela utilizada y sede física.
- **Análisis:** Por tipo de pasarela y estado de conciliación, evaluando los tiempos de respuesta del área de tesorería y los motivos principales de rechazo.
- **Finalidad:** Medir la agilidad del proceso de verificación bancaria, detectar cuellos de botella en tesorería e identificar los errores más comunes de los pacientes al pagar.
- **Unidad de análisis:** Comprobante de pago con su respectiva incidencia de revisión.
- **Fact asociada:** `Fact_ValidacionIncidenciaPayer` (F2).

### R3. Reporte de Efectividad de Conversión y Cadencia de Cobranza
- **Contenido:** Proporción de reservas pre-agendadas que logran consolidar el pago frente a las reservas que son canceladas automáticamente (liberando el sillón dental) tras vencer el plazo límite.
- **Filtros:** Período, servicio, nivel de riesgo de impago (score del Agente de Cobranza) y sede.
- **Análisis:** Por estado final de la reserva (confirmada vs. cancelada) y efectividad de las notificaciones automáticas preventivas y de urgencia.
- **Finalidad:** Evaluar cuántas oportunidades cierran su ciclo de facturación y qué impacto tiene la cancelación automática de citas por falta de pago sobre la disponibilidad de la agenda.
- **Unidad de análisis:** Reserva médica con solicitud de pago.
- **Fact asociada:** `Fact_ConversionCobranzaPayer` (F3).

---

## 4. Cuadro de Indicadores de Gestión – Etapa PAYER

| Elemento | P1. Tasa de pagos validados | P2. Tiempo promedio de validación | P3. Tasa de pagos rechazados | P4. Tasa de conversión a atención clínica |
| :--- | :--- | :--- | :--- | :--- |
| **Descripción** | Porcentaje de transacciones de pago registradas que son conciliadas y aprobadas exitosamente por tesorería. | Tiempo promedio en minutos transcurrido entre el registro del comprobante de pago por el paciente y su validación contable. | Porcentaje de pagos registrados que resultan inválidos, erróneos o fallidos durante el proceso de revisión. | Porcentaje de pagos registrados que logran concretarse, habilitando el pase del paciente al sillón dental (etapa CUSTOMER). |
| **Medidas base** | `pago_validado`, `pago_registrado` | `tiempo_validacion_minuto`, `pago_validado` | `pago_rechazado`, `pago_registrado` | `conversion_customer`, `pago_registrado` |
| **Fórmula KPI** | `[Σ pago_validado / Σ pago_registrado] × 100` | `Σ tiempo_validacion_minuto / Σ pago_validado` | `[Σ pago_rechazado / Σ pago_registrado] × 100` | `[Σ conversion_customer / Σ pago_registrado] × 100` |
| **Tablas BD** | **OLTP:** `Pagos` (`estado='Validado'`)<br>**Mart:** `Fact_RecaudacionPayer` | **OLTP:** `Pagos` (`DATEDIFF(MIN, fecha_registro, fecha_validacion)`)<br>**Mart:** `Fact_ValidacionIncidenciaPayer` | **OLTP:** `Pagos`, `Incidencias`<br>**Mart:** `Fact_RecaudacionPayer` o `Fact_ValidacionIncidenciaPayer` | **OLTP:** `Pagos`, `Reservas`, `EventosEtapa`<br>**Mart:** `Fact_ConversionCobranzaPayer` |
| **Dimensiones** | Tiempo, Sede, Pasarela, Cobro | Tiempo, Sede, Pasarela, Cobro, Incidencia | Tiempo, Sede, Pasarela, Cobro, Incidencia | Tiempo, Sede, Servicio, Cobro, Notificacion, Riesgo |
| **Periodicidad** | Cálculo diario; revisión semanal y consolidación mensual. | Cálculo continuo; revisión diaria y mensual. | Cálculo diario; revisión semanal y consolidación mensual. | Cálculo diario sobre cohortes; revisión semanal y consolidación mensual. |
| **Semáforo** | 🟢 $\ge 80\%$ · 🟡 $60-79\%$ · 🔴 $<60\%$ | 🟢 $\le 60\text{ min}$ · 🟡 $61-120\text{ min}$ · 🔴 $>120\text{ min}$ | 🟢 $\le 5\%$ · 🟡 $6-10\%$ · 🔴 $>10\%$ | 🟢 $\ge 90\%$ · 🟡 $75-89\%$ · 🔴 $<75\%$ |

