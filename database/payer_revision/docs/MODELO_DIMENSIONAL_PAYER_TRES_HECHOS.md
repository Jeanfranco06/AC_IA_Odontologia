# Arquitectura Dimensional de PAYER: Modelo de Tres Hechos

Este documento detalla la estructura dimensional de la etapa **PAYER** en el Data Mart **`NexoSalud_Mart`**. Siguiendo las directrices del modelado dimensional de Ralph Kimball, se descarta el enfoque de una única tabla de hechos genérica y se formaliza la división en **tres tablas de hechos especializadas (`F1`, `F2`, `F3`)**, cada una orientada a un proceso de negocio específico y con un grano atómico claramente delimitado.

---

## 1. Justificación Metodológica: ¿Por qué 3 Tablas de Hechos?

En el diseño anterior, la tabla `Fact_GestionPayer` intentaba representar simultáneamente:
1. El cobro financiero del dinero.
2. La auditoría contable del comprobante e incidencias.
3. La cadencia de recordatorios y cancelación de la cita en agenda.

Esta mezcla provocaba problemas de inconsistencia dimensional:
- **Disparidad de granos:** Un paciente puede tener una sola reserva pero dos comprobantes subidos (uno rechazado y uno aprobado), o varias notificaciones de cadencia enviadas sin que exista un pago aún.
- **Métricas no aditivas forzadas:** El tiempo promedio de validación (`tiempo_validacion_minuto`) solo existe cuando hay un comprobante revisado, pero al cruzarse con reservas impagas generaba valores artificiales o nulos confusos.
- **Riesgo de multiplicación por JOIN:** Al unir reservas con pagos y fuentes en una sola consulta agregada, los importes se duplicaban o triplicaban si la reserva tenía varios registros de pago asociados.

### La Solución de Tres Hechos:
Cada hecho representa un **evento de negocio diferenciado**:
- **`Fact_RecaudacionPayer` (F1):** Flujo de caja e ingresos brutos (Caja / Pasarela).
- **`Fact_ValidacionIncidenciaPayer` (F2):** Agilidad y errores en la revisión de comprobantes (Tesorería / Backoffice).
- **`Fact_ConversionCobranzaPayer` (F3):** Eficacia de la cadencia de cobranza y protección del sillón médico (Scheduler / Agente IA).

---

## 2. Matriz de Medidas y Dimensiones

| Dimensión / Medida | F1: `Fact_RecaudacionPayer` | F2: `Fact_ValidacionIncidenciaPayer` | F3: `Fact_ConversionCobranzaPayer` |
|---|:---:|:---:|:---:|
| `Dim_Tiempo` (Día de corte) | **X** | **X** | **X** |
| `Dim_Sede` (Sede clínica) | **X** | **X** | **X** |
| `Dim_Servicio` (Tratamiento) | **X** | | **X** |
| `Dim_Pasarela` (Medio/Canal) | **X** | **X** | |
| `Dim_Cobro` (Estado conciliación) | **X** | **X** | |
| `Dim_Incidencia` (Motivo de fallo) | | **X** | |
| `Dim_NotificacionCobranza` (Etapa Dunning) | | | **X** |
| `Dim_RiesgoImpago` (Score IA) | | | **X** |

---

## 3. Detalle de los Tres Hechos

### F1. `Fact_RecaudacionPayer` (Recaudación y Estados de Pago)
- **Proceso de negocio:** Registro y confirmación financiera de las transacciones.
- **Grano:** Un registro por `Día (KeyTiempo)` × `Sede (KeySede)` × `Servicio (KeyServicio)` × `Pasarela (KeyPasarela)` × `Estado de Cobro (KeyCobro)`.
- **Medidas cuantitativas:**
  - `PagosRegistrados` (Aditiva): Total de intentos de pago recibidos.
  - `PagosValidados` (Aditiva): Cobros conformes con comprobante verificado.
  - `PagosPendientes` (Aditiva): Cobros en espera de pago o en revisión.
  - `PagosRechazados` (Aditiva): Cobros declarados inválidos por tesorería.
  - `PagosRevertidos` (Aditiva): Cobros previamente validados que sufrieron anulación o contracargo.
  - `IngresosBrutosRecaudados` (Aditiva): Suma en Soles (PEN) de los pagos en estado `Validado`.
  - `CostoTransaccionPasarela` (Aditiva): Costo financiero atribuido por el uso de pasarelas web.
- **Alimenta directamente:** Reporte **R1** y los KPIs **P1 (Tasa de pagos validados)** y **P3 (Tasa de pagos rechazados)**.

---

### F2. `Fact_ValidacionIncidenciaPayer` (Validación e Incidencias)
- **Proceso de negocio:** Carga operativa del equipo de tesorería y gestión de discrepancias/errores en vouchers.
- **Grano:** Un registro por `Día (KeyTiempo)` × `Sede (KeySede)` × `Pasarela (KeyPasarela)` × `Estado de Cobro (KeyCobro)` × `Incidencia (KeyIncidencia)`.
- **Medidas cuantitativas:**
  - `TiempoTotalValidacionMin` (Aditiva): Acumulador de minutos transcurridos desde que el paciente sube el comprobante hasta que tesorería lo dictamina (`DATEDIFF(MINUTE, fecha_declaracion, fecha_validacion)`).
  - `PagosValidados` (Aditiva): Conteo de comprobantes aprobados para servir como denominador.
  - `CantidadIncidencias` (Aditiva): Total de incidencias y discrepancias tipificadas.
  - `PagosRechazados` (Aditiva): Conteo de comprobantes desestimados.
  - `PagosRevertidos` (Aditiva): Conteo de operaciones devueltas.
- **Alimenta directamente:** Reporte **R2** y el KPI **P2 (Tiempo promedio de validación)**:
  $$\text{P2} = \frac{\sum \text{TiempoTotalValidacionMin}}{\sum \text{PagosValidados}}$$

---

### F3. `Fact_ConversionCobranzaPayer` (Conversión y Cadencia de Cobranza)
- **Proceso de negocio:** Monitoreo del ciclo de vida de la reserva, efectividad del Cron Job de cobranza y protección de la capacidad instalada de la clínica frente a inasistencias.
- **Grano:** Un registro por `Día (KeyTiempo)` × `Sede (KeySede)` × `Servicio (KeyServicio)` × `Etapa Cadencia (KeyNotificacion)` × `Nivel de Riesgo IA (KeyRiesgoImpago)`.
- **Medidas cuantitativas:**
  - `ReservasPreagendadas` (Aditiva): Total de reservas formalizadas desde LEAD sujetas a cobranza.
  - `ReservasConfirmadas` (Aditiva): Reservas que alcanzaron el estado validado antes del vencimiento.
  - `ReservasCanceladasImpago` (Aditiva): Citas canceladas automáticamente a las 00:00 hrs que **liberaron el sillón dental**.
  - `ConversionesACustomer` (Aditiva): Pacientes efectivamente transferidos a la etapa de atención presencial (`CUSTOMER`).
  - `PagosRegistrados` (Aditiva): Pagos asociados a las reservas de la cohorte.
- **Alimenta directamente:** Reporte **R3** y el KPI **P4 (Tasa de conversión a CUSTOMER)**:
  $$\text{P4} = \frac{\sum \text{ConversionesACustomer}}{\sum \text{ReservasPreagendadas}} \times 100$$

---

## 4. Dimensiones Complementarias Creadas

Para dar soporte a este modelo, se añaden tres dimensiones en `NexoSalud_Mart`:

1. **`Dim_Incidencia`:**
   - Atributos: `KeyIncidencia`, `TipoIncidencia` ('RECHAZO_VOUCHER', 'REVERSION_PAGO', 'ERROR_OPERATIVO'), `Prioridad` ('Baja', 'Media', 'Alta', 'Crítica'), `MotivoEstandar` ('Monto incompleto', 'Voucher ilegible', 'Cuenta errónea', 'Comprobante duplicado').
2. **`Dim_NotificacionCobranza`:**
   - Atributos: `KeyNotificacion`, `EtapaCadencia` ('T-48h Preventivo', 'T-24h Urgencia', 'T-00:00 Cancelación', 'Sin Notificación'), `CanalNotificacion` ('Email + PDF', 'WhatsApp Bot', 'Manual').
3. **`Dim_RiesgoImpago`:**
   - Atributos: `KeyRiesgoImpago`, `NivelRiesgo` ('BAJO', 'MODERADO', 'ALTO'), `RangoProbabilidad` ('0% - 39%', '40% - 64%', '65% - 100%').

