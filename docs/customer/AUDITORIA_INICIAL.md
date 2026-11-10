# AUDITORÍA TÉCNICA INICIAL — FASE CUSTOMER DE NEXOSALUD

**Proyecto:** Inteligencia de Negocios y Gestión Clínica Odontológica — NexoSalud  
**Rama de trabajo:** `customer` (creada a partir de `payer` @ `14b4e0b`)  
**Bases de datos auditadas:** `NexoSaludDB` (OLTP) y `NexoSalud_Mart` (Data Mart Dimensional)  
**Motor:** Microsoft SQL Server 2019 / 2022  
**Fecha de auditoría:** 2026-11-10  

---

## 1. INVENTARIO DEL ESTADO ACTUAL (OLTP Y DATA MART)

### 1.1. Base de Datos Transaccional (`NexoSaludDB`)

El esquema transaccional vigente hasta el cierre de la fase **PAYER** consta de las siguientes entidades agrupadas por dominio:

| Dominio / Fase | Tabla / Objeto | Clave Primaria | Estado en Repositorio | Observaciones de Auditoría |
|---|---|---|---|---|
| **Catálogos Base** | `dbo.Etapas` | `id_etapa` (IDENTITY) | Activo | 5 etapas: `BUYER`, `LEAD`, `PAYER`, `CUSTOMER`, `TURNED`. |
| **Catálogos Base** | `dbo.Canales` | `id_canal` (IDENTITY) | Activo | WhatsApp, Facebook, Instagram, Página Web, etc. |
| **Catálogos Base** | `dbo.Fuentes` | `id_fuente` (IDENTITY) | Activo | Fuentes de captación de marketing. |
| **Catálogos Base** | `dbo.Horarios` | `id_horario` (IDENTITY) | Activo | Bloques horarios (`CK_Horarios_Dia`, `CK_Horarios_Hora`). |
| **Catálogos Base** | `dbo.Modalidades` | `id_modalidad` (IDENTITY) | Activo | Presencial, Virtual. |
| **Seguridad / Staff** | `dbo.Roles`, `dbo.Usuarios` | `id_rol`, `id_usuario` | Activo | Roles administrativos y operativos. |
| **Catálogo Clínico** | `dbo.Servicios` | `id_servicio` (IDENTITY) | Activo | Catálogo comercial de servicios odontológicos. |
| **Catálogo Clínico** | `dbo.Tarifas` | `id_tarifa` (IDENTITY) | Activo | Precios de lista vigentes por servicio (`CK_Tarifas_Precio`). |
| **Catálogo Clínico** | `dbo.Profesionales` | `id_profesional` (IDENTITY) | Activo | Odontólogos, colegiatura y especialidad. |
| **Catálogo Clínico** | `dbo.Sedes` | `id_sede` (IDENTITY) | Activo | Sedes físicas de atención clínica. |
| **Catálogo Clínico** | `dbo.ProfesionalServicio` | `(id_profesional, id_servicio)` | Activo | Relación muchos-a-muchos de competencia clínica. |
| **Agenda Clínica** | `dbo.Disponibilidad` | `id_disponibilidad` (IDENTITY) | Con inconsistencia documental (H02) | Usa `estado VARCHAR(20)` (`'Disponible'`, `'Bloqueado'`, `'Ocupado'`), mientras docs de PAYER citan `disponible = 1`. |
| **Pacientes / BUYER** | `dbo.Personas` | `id_persona` (IDENTITY) | Activo | Identidad única del paciente (`UQ_Personas_DNI_NotNull`) y `id_etapa_actual`. |
| **Pacientes / BUYER** | `dbo.DatosAcademicos`, `dbo.DatosLaborales`, `dbo.PersonaPreferencias` | PK IDENTITY | Activo | Perfilamiento demográfico y preferencias de atención. |
| **Salud / Antecedentes** | `dbo.PersonaSaludOdontologica` | `id_salud_odonto` (IDENTITY) | Básico | Cuestionario preliminar de triaje; carece de verificación clínica por odontólogo y nivel de alerta por atención. |
| **BUYER Revisado** | `dbo.CaptacionesBuyer`, `dbo.usp_ConvertirBuyerALead` | `id_captacion` (IDENTITY) | Activo | Una captación inicial por persona (`UQ_CaptacionesBuyer_Persona`), transición idempotente a LEAD. |
| **LEAD Comercial** | `dbo.Solicitudes`, `dbo.Opciones` | `id_solicitud`, `id_opcion` | Activo | Intención comercial y opciones de horario/precio ofrecido. |
| **LEAD Extensión** | `dbo.PropuestasEconomicasLead`, `dbo.PromocionesLead`, `dbo.MotivosRechazoLead`, `dbo.CambiosOpcionLead`, `dbo.Historial*Lead` | PKs IDENTITY | Activo | Versionamiento de propuestas, descuentos y auditoría de negociación M1–M8. |
| **PAYER Financiero** | `dbo.Reservas` | `id_reserva` (IDENTITY) | Activo con extensión PAYER | Terna `(id_persona, id_solicitud, id_opcion)`, `ultima_alerta_dunning`, `score_riesgo_impago`. |
| **PAYER Financiero** | `dbo.Pagos` | `id_pago` (IDENTITY) | Con conflicto de CHECK (H01) | Colisión entre `CK_Pagos_Estado` (base) y `CK_Pagos_Estado_Oficial` (PAYER). |
| **CUSTOMER Actual** | `dbo.Atenciones` | `id_atencion` (IDENTITY) | Insuficiente para tratamientos | Asume relación 1:1 con reserva inicial; no soporta tratamientos multisesión, planes versionados ni cierre documental separado. |
| **TURNED / Postventa** | `dbo.Seguimientos` | `id_seguimiento` (IDENTITY) | Activo | Seguimientos vinculados a `id_atencion` e `id_persona`. |
| **Transversal** | `dbo.Interacciones`, `dbo.EventosEtapa`, `dbo.Incidencias`, `dbo.DecisionesIA` | PKs IDENTITY | Activo | Trazabilidad de eventos, incidencias y bitácora preliminar de IA. |

---

### 1.2. Base de Datos Dimensional (`NexoSalud_Mart`)

| Tipo Objeto | Nombre en `NexoSalud_Mart` | Grano / Propósito | Estado |
|---|---|---|---|
| **Dimensión Conformada** | `dbo.Dim_Tiempo` | Día calendario (`KeyTiempo = YYYYMMDD`, miembro `0 = 1900-01-01`). | Activa |
| **Dimensión Conformada** | `dbo.Dim_Hora` | Minuto del día (`id_hora = HHMM`) y turno. | Activa |
| **Dimensión Conformada** | `dbo.Dim_Sede` | Sede física (`id_sede`, miembro desconocido `KeySede = 0`). | Activa |
| **Dimensión Conformada** | `dbo.Dim_Servicio` | Servicio comercial y categoría (`KeyServicio = 0` desconocido). | Activa |
| **Dimensión Conformada** | `dbo.Dim_Profesional` | Odontólogo y especialidad (`id_profesional`). | Falta miembro `0` garantizado |
| **Dimensión Conformada** | `dbo.Dim_Canal`, `dbo.Dim_Fuente`, `dbo.Dim_TipoPersona`, `dbo.Dim_EstadoRegistro` | Dimensiones de captación y seguimiento. | Activas |
| **Dimensión PAYER** | `dbo.Dim_Pasarela`, `dbo.Dim_Cobro`, `dbo.Dim_Pagador` | Medios de pago, estado de cobro y perfil pagador. | Sin tasa contractual explícita (H07) |
| **Dimensión PAYER Nueva** | `dbo.Dim_Incidencia`, `dbo.Dim_NotificacionCobranza`, `dbo.Dim_RiesgoImpago` | Dimensiones para el modelo de 3 hechos de PAYER. | Activas |
| **Dimensión CUSTOMER Heredada** | `dbo.Dim_EstadoAtencion` | Combinación `(EstadoFinal, Asistencia)` de `Atenciones`. | Activa |
| **Hechos BUYER** | `dbo.fact_captacion_buyer`, `dbo.fact_inversion_campana_buyer` | Grano atómico por captación y por campaña/día. | Activos y validados |
| **Hecho LEAD Heredado** | `dbo.fact_negociacion_lead` | Agregado por Día × Sede × Servicio × Profesional × Negociador. | Activo (Semana 9) |
| **Hechos PAYER (3 Hechos)** | `dbo.Fact_RecaudacionPayer` (F1), `dbo.Fact_ValidacionIncidenciaPayer` (F2), `dbo.Fact_ConversionCobranzaPayer` (F3) | Grano agregado diario por dimensiones financieras y de cobranza. | Con defectos ETL (H04, H05, H06, H07) |
| **Hecho CUSTOMER Heredado** | `dbo.fact_atencion_customer` (`Fact_AtencionCustomer`) | Agregado por Día × Sede × Servicio × Profesional × EstadoAtención. | Insuficiente para Análisis A–D (H08) |
| **Hecho TURNED Heredado** | `dbo.fact_seguimiento_turned` | Agregado por Día × Sede × Servicio × Profesional × Canal. | Activo (Semana 9) |

---

## 2. AUDITORÍA DETALLADA DE INCONSISTENCIAS (H01–H10)

### H01. Estados de pago incompatibles en `dbo.Pagos`
* **Objeto afectado:** `NexoSaludDB.dbo.Pagos` (restricciones `CK_Pagos_Estado` vs `CK_Pagos_Estado_Oficial`) y `NexoSalud_Mart.dbo.Fact_RecaudacionPayer` / `Fact_ValidacionIncidenciaPayer`.
* **Evidencia:**
  1. En `01_OLTP_base.sql` (`init_oltp.sql`, línea 479), la tabla `Pagos` se crea con:
     `CONSTRAINT CK_Pagos_Estado CHECK (estado IN ('Pendiente','Confirmado','Fallido','Revertido'))`.
  2. En `05_OLTP_payer_extension.sql` (`01_oltp_payer_extension.sql`, líneas 38–47), solo se elimina `CK_Pagos_Estado_Oficial` si existe y se vuelve a crear `CK_Pagos_Estado_Oficial`, **dejando activa `CK_Pagos_Estado`**.
  3. Dado que SQL Server evalúa todas las restricciones `CHECK` con `AND`, cualquier `INSERT` o `UPDATE` con `estado = 'Validado'`, `'En_Revision'` o `'Rechazado'` falla con error de restricción `CK_Pagos_Estado`.
  4. Adicionalmente, en `11_MART_payer_etl.sql` (`04_etl_poblamiento_payer.sql`), el hecho F1 (línea 42) agrupa `'CONFIRMADO'` junto con `'VALIDADO'`, mientras que el hecho F2 (línea 109) excluye `'CONFIRMADO'` de los validados y lo envía a `ELSE 2` (Pendiente), provocando discrepancia entre `F1.PagosValidados` y `F2.PagosValidados`.
* **Impacto:** Bloqueo operativo al validar pagos en SQL Server con el esquema base instalado y distorsión de indicadores cuando existen pagos históricos con estado `'Confirmado'` sin evidencia de conciliación.
* **Solución implementada:**
  1. En `01_migracion_oltp_customer.sql`, se elimina de forma segura `CK_Pagos_Estado` y se consolida `CK_Pagos_Estado_Oficial`.
  2. Se añade la columna de trazabilidad `origen_estado_validacion VARCHAR(40) NULL` en `dbo.Pagos`.
  3. Los registros históricos en `'Confirmado'` **no se equiparan automáticamente a `'Validado'`** salvo que posean evidencia verificable de conciliación (`fecha_validacion IS NOT NULL AND referencia_pago IS NOT NULL AND importe > 0` con reserva confirmada), quedando registrados en `Dim_Cobro` con su estado real documentado.

---

### H02. Inconsistencia de representación en `dbo.Disponibilidad`
* **Objeto afectado:** `NexoSaludDB.dbo.Disponibilidad`, documentación de PAYER (`00_GUIA_ENTREGA_PAYER.md`, `00_MOTOR_DUNNING_CADENCIA.md`).
* **Evidencia:**
  1. La documentación de PAYER indica `Disponibilidad.disponible = 1`.
  2. El DDL real (`init_oltp.sql`, líneas 333–339), el esquema Prisma (`schema.prisma`, línea 228) y el scheduler (`dunningScheduler.ts`, línea 111) utilizan exclusivamente `Disponibilidad.estado VARCHAR(20)` con valores `'Disponible'`, `'Bloqueado'`, `'Ocupado'`.
* **Impacto:** Cualquier consulta o procedimiento que intente filtrar o actualizar `Disponibilidad.disponible` falla por columna inexistente, o si se agregara como columna mutable separada crearía dos fuentes de verdad contradictorias.
* **Solución implementada:**
  1. Se establece `Disponibilidad.estado` (`'Disponible'`, `'Bloqueado'`, `'Ocupado'`) como **única fuente de verdad transaccional**.
  2. Para compatibilidad con consultas analíticas o scripts que lean `disponible`, se expone únicamente como columna calculada determinista no editable (`disponible AS CAST(CASE WHEN estado = 'Disponible' THEN 1 ELSE 0 END AS BIT) PERSISTED`), garantizando que jamás existan dos estados divergentes.

---

### H03. Transición PAYER → CUSTOMER no atómica ni verificada en puntos de entrada
* **Objeto afectado:** `backend/src/routes/payer.routes.ts` (`POST /:id/validate`, `POST /:id/convert-customer`), `backend/src/routes/payment.routes.ts` (`validateAndPromotePayer`), `backend/src/routes/customer.routes.ts` (`POST /:id/start-attention`, `PUT /:id/attention-details`).
* **Evidencia:**
  1. En `payer.routes.ts` (líneas 434–490) y `payment.routes.ts` (líneas 45–105), las 4 operaciones (confirmar reserva, validar pago, cambiar `Personas.id_etapa_actual` a `CUSTOMER` y crear `Atenciones`) se ejecutan fuera de `prisma.$transaction`, sin bloqueo de concurrencia y sin insertar el registro obligatorio en `EventosEtapa`.
  2. En `payer.routes.ts` (línea 448), si una reserva no tiene pago, el endpoint crea un pago con `importe: 1.00` y lo marca `'Validado'` sin verificar que cubra el precio pactado o anticipo mínimo.
  3. En `customer.routes.ts` (líneas 168–186 y 204–250), se permite iniciar una atención o crear un registro en `Atenciones` verificando únicamente `person.Etapa.nombre === 'CUSTOMER'`, sin comprobar que la reserva asociada tenga efectivamente un pago en estado `'Validado'` que cumpla la política financiera vigente.
* **Impacto:** Riesgo de atenciones clínicas sin respaldo financiero válido (violación del Guardián de Dominio), estados inconsistentes ante fallos a mitad de ejecución y ausencia de creación del tratamiento (`TratamientosContratados`).
* **Solución implementada:**
  1. Creación de la función verificadora `dbo.fn_VerificarGuardianFinancieroCustomer` y del procedimiento transaccional e idempotente `dbo.usp_ActivarTratamientoDesdePayer` en `NexoSaludDB`.
  2. Refactorización de `payer.routes.ts`, `payment.routes.ts` y `customer.routes.ts` para ejecutar la transición dentro de una transacción atómica, validar el guardián financiero en todos los puntos de entrada de CUSTOMER y activar formalmente el tratamiento, su plan inicial y su primera sesión sin duplicar la reserva origen.

---

### H04. Identificadores dimensionales asumidos (`Key = 1`) en el ETL de PAYER
* **Objeto afectado:** `database/payer_revision/sql/04_etl_poblamiento_payer.sql` (`11_MART_payer_etl.sql`).
* **Evidencia:**
  1. En las líneas 37–47, 105–114 y 171–175 de `04_etl_poblamiento_payer.sql`, se utiliza `ISNULL(dt.KeyTiempo, 1)`, `ISNULL(ds.KeySede, 1)`, `ISNULL(dserv.KeyServicio, 1)`, `ISNULL(dp.KeyPasarela, 1)`, y un `CASE` que devuelve claves fijas `1, 2, 3, 4` para `KeyCobro`.
  2. En `Dim_Tiempo`, las claves válidas son `YYYYMMDD` (ej. `20261110`) y el miembro desconocido creado en Semana 9 es `KeyTiempo = 0` (`1900-01-01`), **no `1`**. Si `dt.KeyTiempo` es `NULL`, `ISNULL(dt.KeyTiempo, 1)` viola la clave foránea hacia `Dim_Tiempo`.
  3. Usar `KeySede = 1` o `KeyServicio = 1` asigna silenciosamente registros sin sede/servicio a una sede física real (`Sede Centro Histórico`) y a un servicio real (`Evaluación odontológica`), distorsionando las métricas por sede y servicio.
  4. Asumir que `KeyCobro` tiene los IDs `1, 2, 3, 4` en ese orden exacto depende del orden fortuito de inserción en una columna `IDENTITY`.
* **Impacto:** Falla de integridad referencial o atribución falsa de ingresos e incidencias a sedes, servicios y estados de cobro equivocados.
* **Solución implementada:**
  1. Garantizar miembros desconocidos explícitos (`Key = 0`) en todas las dimensiones conformadas y específicas (`Dim_Tiempo`, `Dim_Hora`, `Dim_Sede`, `Dim_Servicio`, `Dim_Profesional`, `Dim_Pasarela`, `Dim_Cobro`, `Dim_EstadoAtencion`, `Dim_Incidencia`, `Dim_NotificacionCobranza`, `Dim_RiesgoImpago` y las 5 nuevas dimensiones de CUSTOMER).
  2. Reemplazar los IDs fijos por búsquedas por clave natural (`JOIN dbo.Dim_Cobro dc ON ...`) con fallback exclusivo al miembro desconocido `0`.

---

### H05. Multiplicación de conteos (Fan-Trap / Chasm-Trap) en hechos PAYER
* **Objeto afectado:** `database/payer_revision/sql/04_etl_poblamiento_payer.sql` (Hechos F2 y F3).
* **Evidencia:**
  1. En `SourceF2` (líneas 124–131): `FROM Pagos p ... LEFT JOIN Incidencias inc ON inc.id_pago = p.id_pago`. Si un pago tiene 2 incidencias registradas, `PagosValidados`, `PagosRechazados`, `PagosRevertidos` y `TiempoTotalValidacionMin` se duplican.
  2. En `SourceF3` (líneas 181–186): `FROM Reservas r LEFT JOIN Pagos p ON p.id_reserva = r.id_reserva LEFT JOIN Atenciones aten ON aten.id_reserva = r.id_reserva`. Si una reserva tiene 2 intentos de pago y 2 atenciones asociadas, `COUNT(r.id_reserva)` (`ReservasPreagendadas`) cuenta 4 reservas en lugar de 1, y `ConversionesACustomer` suma 4 en lugar de 1.
* **Impacto:** Sobreestimación grave de reservas preagendadas, pagos validados y conversiones a CUSTOMER.
* **Solución implementada:**
  1. En F2, agregar primero las incidencias por `id_pago` (identificando la incidencia principal/más reciente para la dimensión y el conteo exacto de incidencias del pago) antes de sumar las medidas del pago.
  2. En F3, pre-agregar `Pagos` y `Atenciones`/`TratamientosContratados` por `id_reserva` mediante CTEs con grano `1 fila por id_reserva`, garantizando que `ReservasPreagendadas`, `ReservasConfirmadas` y `ConversionesACustomer` jamás se multipliquen.

---

### H06. Tiempo de validación artificial (`ELSE 15`) en ETL de PAYER
* **Objeto afectado:** `database/payer_revision/sql/04_etl_poblamiento_payer.sql` (líneas 115–119).
* **Evidencia:**
  ```sql
  SUM(CASE 
      WHEN p.fecha_validacion IS NOT NULL AND p.fecha_registro IS NOT NULL
      THEN DATEDIFF(MINUTE, p.fecha_registro, p.fecha_validacion)
      ELSE 15
  END) AS TiempoTotalValidacionMin
  ```
  Todo pago sin `fecha_validacion` (incluyendo pagos pendientes o rechazados) suma artificialmente 15 minutos al numerador de `P2_TiempoPromedioValidacion_Min`.
* **Impacto:** Falsificación del indicador P2 (Tiempo Promedio de Validación).
* **Solución implementada:**
  1. Calcular los minutos de validación únicamente para pagos efectivamente validados que cuenten con marcas temporales reales y consistentes (`p.fecha_validacion >= COALESCE(p.fecha_declaracion, p.fecha_registro)`).
  2. Si un registro histórico carece de `fecha_validacion`, aporta `0` a la suma acumulada y se excluye del denominador de casos con tiempo medible, documentando la regla en la vista `v_Indicadores_Payer_Oficial`.

---

### H07. Costo de pasarela supuesto (3.5% fijo vs 3.0% heredado)
* **Objeto afectado:** `database/payer_revision/sql/04_etl_poblamiento_payer.sql` (línea 54) y `poblamiento_merge_mart.sql` (línea 590).
* **Evidencia:**
  1. `04_etl_poblamiento_payer.sql` multiplica todos los pagos (incluso pendientes, rechazados y pagos en efectivo en clínica) por `0.035` (3.5%).
  2. `poblamiento_merge_mart.sql` multiplica todos los pagos por `0.03` (3.0%).
  3. No existe atributo en `Dim_Pasarela` que distinga medios sin comisión (efectivo/transferencia directa) de pasarelas con comisión contractual verificable.
* **Impacto:** Reporte de costos financieros ficticios sobre cobros no realizados o en efectivo.
* **Solución implementada:**
  1. Se añaden a `Dim_Pasarela` las columnas `TasaComisionContractual DECIMAL(6,4) NULL` y `EstadoTasa VARCHAR(30) NOT NULL DEFAULT 'SIN_CONTRATO_VERIFICADO'`.
  2. El costo de transacción en F1 solo se calcula sobre pagos en estado `'Validado'` cuando `TasaComisionContractual IS NOT NULL`; en caso contrario se registra `0.00` (y se expone en auditoría que no hay tarifa contractual aplicable).

---

### H08. Hecho `fact_atencion_customer` heredado insuficiente
* **Objeto afectado:** `NexoSalud_Mart.dbo.fact_atencion_customer`.
* **Evidencia:**
  1. Su grano es un agregado diario (`KeyTiempo, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion`) con solo 5 columnas numéricas (`cita_evaluable`, `atencion_realizada`, `cita_inasistencia`, `tiempo_sillon_dental_minuto`, `atencion_finalizada_conforme`).
  2. En `poblamiento_merge_mart.sql` (línea 629), `cita_evaluable = COUNT(a.id_atencion)` incluye citas futuras pendientes, distorsionando la tasa de cumplimiento.
  3. No permite responder a las 4 hojas de gestión requeridas en CUSTOMER:
     - **Análisis A (Tratamientos):** `tratamientos_iniciados`, `tratamientos_completados`, `sesiones_planificadas`, `sesiones_completadas`, `dias_duracion_real`.
     - **Análisis B (Sesiones):** `sesiones_programadas`, `sesiones_realizadas`, `sesiones_inasistidas`, `reprogramaciones_acumuladas`, `minutos_espera`.
     - **Análisis C (Prestación Clínica):** `atenciones_realizadas`, `minutos_consulta`, `fichas_completas` (en 1ra revisión), `indicaciones_emitidas`, `procedimientos_registrados`.
     - **Análisis D (Agente Inteligente):** `interacciones_registradas`, `alertas_generadas`, `alertas_atendidas`, `borradores_generados`, `borradores_aprobados`.
* **Impacto:** Imposibilidad de auditar tratamientos multisesión, adherencia clínica, calidad documental e intervenciones del copiloto IA.
* **Solución implementada:**
  1. Se conserva `dbo.fact_atencion_customer` (`dbo.Fact_AtencionCustomer`) actualizado desde el nuevo modelo para no romper `report.routes.ts` ni dashboards de Semana 9, corrigiendo `cita_evaluable` para excluir fechas futuras (`fecha_atencion <= @corte`).
  2. Se diseñan e implementan 4 tablas de hechos atómicas especializadas para CUSTOMER (`Fact_TratamientoCustomer`, `Fact_SesionCustomer`, `Fact_AtencionCustomer_V2`, `Fact_InteraccionIACustomer`) con trazabilidad a sus claves de origen OLTP.

---

### H09. Desalineación de restricciones CHECK en `Atenciones` e `Incidencias` frente al Backend
* **Objeto afectado:** `NexoSaludDB.dbo.Atenciones` (`CK_Atenciones_Asistencia`, `CK_Atenciones_Estado`), `NexoSaludDB.dbo.Incidencias` (`CK_Incidencias_Estado`) y `backend/src/routes/customer.routes.ts` / `dunningScheduler.ts`.
* **Evidencia:**
  1. `CK_Atenciones_Asistencia` solo permite `('Pendiente', 'Asistió', 'No asistió')`, pero `customer.routes.ts` (líneas 150, 152, 179) escribe `'Confirmada'`, `'Asiste'` y `'No asiste'`.
  2. `CK_Atenciones_Estado` solo permite `('Programado', 'En proceso', 'Realizado', 'Cancelado')`, pero `customer.routes.ts` (líneas 179, 196) escribe `'En curso'` y `'Finalizado'`.
  3. `CK_Incidencias_Estado` solo permite `('Abierta', 'En proceso', 'Resuelta', 'Cerrada')`, pero `dunningScheduler.ts` (líneas 124, 213, 270) escribe `'CLOSED'` y `'OPEN'`.
* **Impacto:** Error 500 en el backend al confirmar asistencia, iniciar/finalizar atención o registrar incidencias de Dunning sobre una base con las restricciones originales activas.
* **Solución implementada:**
  Homologación controlada de `CK_Atenciones_Asistencia`, `CK_Atenciones_Estado` y `CK_Incidencias_Estado` en `01_migracion_oltp_customer.sql`, admitiendo los valores canónicos y sus equivalentes del backend, y normalizándolos en las vistas y en el ETL hacia el Data Mart.

---

### H10. Duplicación de identidad de paciente en `turned.routes.ts` (`POST /:id/new-request`) y transición prematura a TURNED
* **Objeto afectado:** `backend/src/routes/turned.routes.ts` (líneas 263–273) y `backend/src/routes/customer.routes.ts` (líneas 275–330).
* **Evidencia:**
  1. En `turned.routes.ts` (línea 263), cuando un paciente en `TURNED` solicita un nuevo tratamiento, el código ejecuta `prisma.personas.create(...)` con el mismo DNI, lo cual viola el índice único `UQ_Personas_DNI_NotNull` y contradice el contrato de negocio (`00_GUIA_ENTREGA_PAYER.md` sección 5.3: *"se reutiliza su `id_persona` existente y se crea una nueva `Solicitud`, reiniciando el ciclo sin duplicar la identidad física"*).
  2. En `customer.routes.ts` (`POST /:id/convert-turned`), finalizar una única atención mueve inmediatamente al paciente a `TURNED`, sin verificar si el tratamiento contratado tiene sesiones pendientes o si el tratamiento fue cerrado formalmente (`R11`, `R12`, `R13`).
* **Impacto:** Fallo por clave duplicada de DNI al reactivar pacientes y paso prematuro a postventa de pacientes con tratamientos activos de múltiples sesiones.
* **Solución implementada:**
  1. En `customer.routes.ts` y en `dbo.usp_CerrarTratamientoYTransicionarTurned`, se bloquea el pase a `TURNED` mientras existan sesiones pendientes o el tratamiento no esté formalmente cerrado (`estado_tratamiento = 'Completado'`).
  2. En `turned.routes.ts`, se reutiliza el `id_persona` existente al crear una nueva `Solicitud` de reactivación, preservando todo su historial clínico y financiero.

---

## 3. RIESGOS DE MIGRACIÓN Y DECISIONES DE COMPATIBILIDAD

1. **No destructividad e idempotencia:**
   - Ninguna tabla existente (`Personas`, `Solicitudes`, `Opciones`, `Reservas`, `Pagos`, `Atenciones`, `Seguimientos`, `Incidencias`, `DecisionesIA`) se elimina ni se recrea.
   - Todas las columnas nuevas en `Atenciones` y `Pagos` se agregan como `NULL` o con `DEFAULT` explícito mediante bloques `IF COL_LENGTH(...) IS NULL`.
2. **Retrocompatibilidad con `Atenciones` y `Reservas` históricas:**
   - Las reservas que ya cuentan con pago en estado `'Validado'` (o `'Confirmado'` conciliado con atención registrada) se migran en `02_catalogos_customer.sql` hacia `dbo.TratamientosContratados`, `dbo.PlanTratamiento` (versión 1) y `dbo.SesionesTratamiento` (sesión 1), enlazando `Atenciones.id_tratamiento` y `Atenciones.id_sesion`.
3. **Coexistencia controlada en `NexoSalud_Mart`:**
   - Se mantiene `dbo.fact_atencion_customer` (`dbo.Fact_AtencionCustomer`) para que el endpoint `/api/reports/executive/customer` existente continúe operando sin interrupción.
   - Las 4 nuevas tablas de hechos (`Fact_TratamientoCustomer`, `Fact_SesionCustomer`, `Fact_AtencionCustomer_V2`, `Fact_InteraccionIACustomer`) constituyen la fuente analítica oficial de grano fino para los Análisis A, B, C y D de la fase CUSTOMER.
