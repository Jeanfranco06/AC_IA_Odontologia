# REPORTE DE VALIDACIÓN FINAL Y EJECUCIÓN — FASE CUSTOMER DE NEXOSALUD

**Proyecto:** NexoSalud (`BUYER → LEAD → PAYER → CUSTOMER → TURNED`)  
**Rama Git Activa:** `customer` (creada desde `payer` @ `14b4e0b`)  
**Bases de Datos Auditadas y Validadas:** `NexoSaludDB` (OLTP) y `NexoSalud_Mart` (Data Mart Dimensional)  
**Estado Global de Validación:** **22 / 22 Pruebas Obligatorias APROBADAS (`T01` a `T22`)**

---

## 1. Verificación de Rama Git y Continuidad desde PAYER

Se verificó el estado del repositorio antes y después de la implementación:
- **Rama base preservada:** `payer` (`14b4e0b feat: Payer phase`).
- **Rama activa creada:** `customer` (`git switch -c customer`), conservando íntegramente el historial de commits de `BUYER`, `LEAD` y `PAYER` y sin ejecutar operaciones destructivas (`reset --hard`, `clean`, `push`).

---

## 2. Inventario y Orden de Ejecución de Entregables SQL (`database/customer/`)

Todos los scripts son 100 % aditivos, transaccionales e idempotentes, compatibles con SQL Server 2016 / 2019 / 2022:

| Orden | Script SQL | Base Destino | Propósito Técnico y Reglas Implementadas | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **0** | [`00_preflight_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/00_preflight_customer.sql) | `NexoSaludDB` / `NexoSalud_Mart` | Diagnóstico pre-migración de objetos, conteos base y detección de inconsistencias `H01`–`H08`. | Ejecutado (Exit Code `0`) |
| **1** | [`01_migracion_oltp_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/01_migracion_oltp_customer.sql) | `NexoSaludDB` | Resuelve `H01`, `H02`, `H09`. Crea las 10 entidades OLTP de CUSTOMER (`6.1`–`6.10`), triggers de inmutabilidad (`R07`, `R14`, `T10`), función guardián financiero y 8 procedimientos transaccionales (`R01`–`R18`). | Ejecutado 2 veces (Idempotente, Exit Code `0`) |
| **2** | [`02_catalogos_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/02_catalogos_customer.sql) | `NexoSaludDB` | Inserta roles clínicos, clasifica pagos históricos `Confirmado` sin equipararlos falsamente con `Validado` (`H01`), y migra 110 tratamientos, 110 planes, 229 sesiones, 185 procedimientos, 370 validaciones de ficha, 185 indicaciones, 110 antecedentes y 47 eventos de IA sin inventar datos. | Ejecutado 2 veces (Idempotente, Exit Code `0`) |
| **3** | [`03_dimensiones_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/03_dimensiones_customer.sql) | `NexoSalud_Mart` | Inserta miembros desconocidos explícitos (`Key = 0`) en todas las dimensiones (`H04`), extiende `Dim_Pasarela` (`H07`), normaliza `Dim_Cobro` y `Dim_EstadoAtencion`, y crea/puebla las 5 dimensiones nuevas de CUSTOMER. | Ejecutado 2 veces (Idempotente, Exit Code `0`) |
| **4** | [`04_hechos_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/04_hechos_customer.sql) | `NexoSalud_Mart` | Crea `ETL_EjecucionLog`, extiende `Fact_RecaudacionPayer` (`H07`) y `Fact_ValidacionIncidenciaPayer` (`H06`), crea los 4 hechos especializados de CUSTOMER (20 medidas) y la vista `v_Compatibilidad_Fact_AtencionCustomer` (`H08`). | Ejecutado 2 veces (Idempotente, Exit Code `0`) |
| **5** | [`05_etl_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/05_etl_customer.sql) | `NexoSalud_Mart` | Implementa y ejecuta `usp_ETL_SincronizarPayerMart` (corrigiendo `H04`–`H07`) y `usp_ETL_SincronizarCustomerMart` (con `sp_getapplock`, `MERGE` atómico y reconciliación OLTP vs Mart). | Ejecutado 2 veces (Idempotente, Exit Code `0`) |
| **6** | [`06_kpis_reportes_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/06_kpis_reportes_customer.sql) | `NexoSalud_Mart` | Crea `v_Indicadores_Customer_Oficial` (`C1`–`C8` + 20 medidas), las 4 vistas analíticas (`A`, `B`, `C`, `D`) y actualiza `v_Indicadores_Payer_Oficial`. | Ejecutado (Exit Code `0`) |
| **7** | [`07_validaciones_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/07_validaciones_customer.sql) | `NexoSaludDB` / `NexoSalud_Mart` | Ejecuta las 22 pruebas automatizadas obligatorias (`T01`–`T22`), verifica sus resultados y restaura los registros sintéticos dejando la base reconciliada. | Ejecutado (22/22 `APROBADO`, Exit Code `0`) |

---

## 3. Resultados Reales de la Suite de 22 Pruebas Obligatorias (`T01` a `T22`)

Salida obtenida de la ejecución real de [`07_validaciones_customer.sql`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/database/customer/07_validaciones_customer.sql) en SQL Server:

| Código | Prueba Ejecutada | Resultado | Evidencia Cuantitativa Verificada en SQL Server |
| :--- | :--- | :--- | :--- |
| **T01** | Bloqueo de atención y activación sin pago validado | **APROBADO** | `Bloqueo error 55202 verificado=1 \| MotivoGuardian=SIN_PAGO_OFICIAL_VALIDADO` |
| **T02** | Rechazo de pago con anticipo insuficiente (<30%) o estado inválido | **APROBADO** | `BloqueoAnticipo=1 (ANTICIPO_MINIMO_NO_CUBIERTO) \| BloqueoCheckEstado=1` |
| **T03** | Activación atómica de primera cita, plan y tratamiento al validar pago | **APROBADO** | `id_tratamiento=3002 \| id_sesion1=3002 \| Etapa=CUSTOMER \| Reserva=Confirmada` |
| **T04** | Creación de múltiples sesiones (1, 2, 3) dentro de un mismo tratamiento | **APROBADO** | `SesionesCreadas=3 para id_tratamiento=3002` |
| **T05** | Nueva sesión o abono parcial no crea nuevo registro comercial (`Solicitud`/`Opción`/`Reserva`) | **APROBADO** | `ObjetosComercialesAntes=5 \| ObjetosComercialesDespues=5 (Delta=0)` |
| **T06** | Reprogramación de sesión conservando fecha anterior y motivo en `EventosSesion` | **APROBADO** | `FechaAnteriorConservada=2025-01-17 11:00:00 -> FechaNueva=2025-01-18 16:00:00` |
| **T07** | Prevención de doble asignación de profesional y horario (solapamiento) | **APROBADO** | `BloqueoSolapamientoHorario=1 (Error 55233 CONFLICTO DE AGENDA R05)` |
| **T08** | Registro de inasistencia diferenciado de reprogramación y cancelación | **APROBADO** | `EstadoProgramacion=Programada \| EstadoAsistencial=Inasistida` |
| **T09** | Validación de ficha clínica incompleta y bloqueo de cierre documental de sesión | **APROBADO** | `BloqueoCierreError55254=1 (Revisión 1 Incompleta impide cerrar sesión)` |
| **T10** | Conservación inmutable de primera revisión (`Incompleta`) tras subsanar en revisión 2 (`Completa`) | **APROBADO** | `TriggerInmutabilidad=1 \| Rev1=Incompleta \| Rev2=Completa` |
| **T11** | Versionado de indicaciones post-atención sin sobrescritura de versión anterior | **APROBADO** | `VersionesConservadas=2 (v1 histórica y v2 vigente) para id_atencion=2220` |
| **T12** | Trazabilidad de IA: bloqueo de diagnóstico autónomo (`R17`) y aprobación humana obligatoria (`R18`) | **APROBADO** | `BloqueoDiagnosticoIA=1 \| BloqueoBorradorSinProfesional=1` |
| **T13** | Bloqueo de transición a `TURNED` cuando existen sesiones planificadas pendientes | **APROBADO** | `BloqueoTurnedError55263=1 (Sesiones completadas 1 de 3)` |
| **T14** | Transición atómica válida a `TURNED` al completar todas las sesiones planificadas | **APROBADO** | `EstadoTratamiento=Completado \| EtapaPersona=TURNED (3/3 sesiones cerradas)` |
| **T15** | Tratamiento suspendido o cancelado exige motivo y no transiciona indebidamente a `TURNED` | **APROBADO** | `EstadoTratamiento=Suspendido \| EtapaPersonaPermanece=CUSTOMER` |
| **T16** | Sesiones futuras programadas no contaminan denominadores de asistencia (`sesion_evaluable=0`) | **APROBADO** | `id_sesion_futura=3006 (+25 días) -> sesion_evaluable=0 \| inasistidas=0` |
| **T17** | Ausencia de duplicación (`Fan-Trap`) en hechos ante múltiples sesiones, revisiones y versiones | **APROBADO** | `Fact_Tratamiento=1 fila \| Fact_Sesion=3 filas \| Fact_AtencionV2=1 fila` |
| **T18** | Integridad referencial estricta entre los 4 hechos de CUSTOMER y todas las dimensiones | **APROBADO** | `ClavesForaneasHuerfanas=0 (100% resueltas con claves válidas o miembro desconocido Key=0)` |
| **T19** | Idempotencia del ETL en ejecuciones consecutivas (`MERGE` + `sp_getapplock`) | **APROBADO** | `ChecksumMedidasCorrida1=1812 \| ChecksumMedidasCorrida2=1812 (Delta=0)` |
| **T20** | Conciliación numérica exacta entre OLTP (`NexoSaludDB`) y Data Mart (`NexoSalud_Mart`) | **APROBADO** | `DiscrepanciaAcumuladaOLTPvsMart=0 (Tratamientos=110, Sesiones=229, Atenciones=219, EventosIA=47)` |
| **T21** | No regresión de hechos y contratos de `BUYER`, `LEAD` y `PAYER` | **APROBADO** | `FactBuyer=805 \| FactLead=58 \| F1_Pagos=124 \| F3_Reservas=124` |
| **T22** | Reversión financiera en `CUSTOMER` suspende tratamiento, cancela citas futuras y preserva historial | **APROBADO** | `Tratamiento=Suspendido \| Sesion1Realizada=Realizada \| Sesion2Futura=Cancelada \| Incidencias=1` |

---

## 4. Conciliación Numérica Antes vs. Después (OLTP y Data Mart)

### 4.1. Corrección de Hechos PAYER (`H01`, `H04`, `H05`, `H06`, `H07`)

| Métrica / Tabla en `NexoSalud_Mart` | Valor Pre-Auditoría (Con Errores `H04`–`H07`) | Valor Post-Implementación (Reconciliado con OLTP) | Explicación Técnica |
| :--- | :---: | :---: | :--- |
| `Fact_ConversionCobranzaPayer.ReservasPreagendadas` | `243` (Inflado por `Fan-Trap`) | **`124`** (Exacto a `dbo.Reservas`) | Eliminado `LEFT JOIN dbo.Atenciones` sin pre-agregación (`H05`). |
| `Fact_ConversionCobranzaPayer.ConversionesACustomer` | `219` (Contaba sesiones, no reservas) | **`110`** (Reservas únicas con tratamiento/atención) | Pre-agregado 1:1 por `id_reserva` (`H05`). |
| `Fact_ValidacionIncidenciaPayer.TiempoTotalValidacionMin` | `-12,120` min (Negativo + `ELSE 15` ficticio) | **`0`** (`PagosConTiempoMedible = 0` en lote histórico sin evidencia) | Excluidos tiempos negativos y prohibido el sustituto artificial de 15 min (`H06`). |
| `Fact_RecaudacionPayer.CostoTransaccionPasarela` | `S/ 519.75` (3.5 % supuesto como real) | **`S/ 0.00`** (`CostoPasarelaEstimadoNoContractual = S/ 519.75` separado) | Separado el costo verificado contractualmente de la estimación referencial (`H07`). |

### 4.2. Conciliación de los 4 Nuevos Hechos de CUSTOMER y sus 20 Medidas

| Análisis | Tabla de Hechos (`NexoSalud_Mart`) | Filas Conciliadas | Medidas Oficiales Verificadas en `v_Indicadores_Customer_Oficial` |
| :--- | :--- | :---: | :--- |
| **Análisis A (Tratamientos)** | `dbo.Fact_TratamientoCustomer` | **110** (`= dbo.TratamientosContratados`) | `tratamientos_iniciados = 90`, `tratamientos_completados = 79`, `sesiones_planificadas = 207`, `sesiones_completadas = 185`, `dias_duracion_real = 6.33` |
| **Análisis B (Sesiones)** | `dbo.Fact_SesionCustomer` | **229** (`= dbo.SesionesTratamiento`) | `sesiones_programadas = 229`, `sesiones_realizadas = 185`, `sesiones_inasistidas = 34`, `reprogramaciones_acumuladas = 0`, `minutos_espera = NULL` (no inventado en históricos) |
| **Análisis C (Prestación Clínica)** | `dbo.Fact_AtencionCustomer_V2` | **219** (`= dbo.Atenciones`) | `atenciones_realizadas = 185`, `minutos_consulta = 45.00`, `fichas_completas = 0` (histórico sin `motivo_consulta` en `Atenciones`), `indicaciones_emitidas = 185`, `procedimientos_registrados = 185` |
| **Análisis D (Copiloto IA)** | `dbo.Fact_InteraccionIACustomer` | **47** (`= 20 + 12 + 15`) | `interacciones_registradas = 20`, `alertas_generadas = 12`, `alertas_atendidas = 9`, `borradores_generados = 15`, `borradores_aprobados = 12` |

---

## 5. Integración del Backend (`backend/src/`)

Se integraron y compilaron sin errores los servicios y rutas de backend:
- [`backend/src/routes/payer.routes.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/routes/payer.routes.ts) y [`backend/src/routes/payment.routes.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/routes/payment.routes.ts): Transición atómica con `prisma.$transaction`, validación del guardián financiero (estado `Validado` y anticipo mínimo del 30 %), registro en `EventosEtapa` e invocación de `dbo.usp_ActivarTratamientoDesdePayer`.
- [`backend/src/routes/customer.routes.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/routes/customer.routes.ts): Re-verificación del guardián financiero antes de iniciar atención clínica (`POST /:id/start-attention`), bloqueo de transición prematura a `TURNED` cuando existen sesiones pendientes del tratamiento (`POST /:id/convert-turned`), y consulta integral de tratamientos, planes, sesiones, antecedentes y eventos de IA (`GET /:id/treatments`).
- [`backend/src/routes/turned.routes.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/routes/turned.routes.ts): Corrección de `POST /:id/new-request` (`H10`) para reutilizar `id_persona` sin duplicar identidades en `dbo.Personas`.
- [`backend/src/services/martSyncService.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/services/martSyncService.ts) y [`backend/src/routes/report.routes.ts`](file:///c:/Proyects/Proyecto-IN-Odontolog-a-/backend/src/routes/report.routes.ts): Soporte para sincronización del Mart de PAYER y CUSTOMER (`syncPayer`, `syncCustomer`), soporte matricial para las 20 medidas de los 4 hechos de CUSTOMER, y endpoint `GET /api/reports/customer-kpis`.
