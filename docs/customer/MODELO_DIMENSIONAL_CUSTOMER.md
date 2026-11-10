# MODELAMIENTO DIMENSIONAL — FASE CUSTOMER DE NEXOSALUD

**Proyecto:** Inteligencia de Negocios para Clínica Odontológica — NexoSalud  
**Fase:** CUSTOMER (Ejecución de Tratamientos, Sesiones, Prestación Clínica y Copiloto IA)  
**Bases de datos:** `NexoSaludDB` (OLTP) → `NexoSalud_Mart` (Data Mart)  
**Metodología:** Secuencia de 7 pasos de Kimball adaptada a procesos clínicos multisesión  

---

## PASO 1: DEFINICIÓN DE LA HOJA DE GESTIÓN (PROCESOS DE NEGOCIO)

La fase **CUSTOMER** no es un evento aislado de una sola cita, sino el ciclo clínico completo desde la activación de un tratamiento contratado (tras superar el guardián financiero de PAYER) hasta su cierre clínico formal y pase a TURNED.

Se definen cuatro procesos analíticos diferenciados en la Hoja de Gestión:

| Código | Proceso Analítico (Hoja de Gestión) | Objetivo de Gestión | Pregunta Clave de Negocio |
|---|---|---|---|
| **Análisis A** | **Gestión de Tratamientos** | Controlar el avance, culminación y duración real de los tratamientos odontológicos contratados. | ¿Cuántos tratamientos iniciados llegan a completarse formalmente, con qué adherencia al plan de sesiones y en cuántos días reales? |
| **Análisis B** | **Gestión de Sesiones** | Optimizar el cumplimiento de la agenda de sesiones clínicas, reduciendo inasistencias, reprogramaciones y tiempos de espera en sala. | ¿Cuál es la tasa real de cumplimiento sobre las sesiones evaluables (excluyendo futuras) y cuánto esperan los pacientes antes de ingresar al sillón? |
| **Análisis C** | **Prestación Clínica y Calidad Documental** | Asegurar la ejecución efectiva en sillón dental, la completitud de la historia clínica desde la primera revisión y la entrega oportuna de indicaciones postatención aprobadas. | ¿Qué porcentaje de atenciones realizadas cuenta con ficha completa en su primera revisión y con indicaciones postatención aprobadas y emitidas? |
| **Análisis D** | **Intervenciones del Agente Inteligente (Copiloto IA)** | Auditar el desempeño del Agente Inteligente en su rol de asistencia al paciente y copiloto clínico-documental bajo supervisión profesional. | ¿Cuántas interacciones, alertas preventivas y borradores genera la IA, y qué proporción de alertas y borradores es atendida/aprobada por los odontólogos? |

---

## PASO 2: IDENTIFICACIÓN DE INDICADORES Y MEDIDAS

### 2.1. Indicadores Clave de Desempeño (KPIs de CUSTOMER)

| ID | Indicador | Proceso | Fórmula Metodológica | Regla deCohorte / Exclusión | Meta (Verde / Ámbar / Rojo) |
|---|---|---|---|---|---|
| **C1** | **Tasa de Culminación de Tratamientos** | Análisis A | $\frac{\sum \text{tratamientos\_completados}}{\sum \text{tratamientos\_iniciados}} \times 100$ | Solo tratamientos con inicio efectivo (`tratamientos_iniciados = 1`). | $\ge 80\%$ Verde / $60\text{–}79.9\%$ Ámbar / $< 60\%$ Rojo |
| **C2** | **Avance de Sesiones vs. Plan Vigente** | Análisis A | $\frac{\sum \text{sesiones\_completadas}}{\sum \text{sesiones\_planificadas}} \times 100$ | Tratamientos activos o completados; no sumar planes históricos reemplazados. | $\ge 85\%$ Verde / $70\text{–}84.9\%$ Ámbar / $< 70\%$ Rojo |
| **C3** | **Duración Real Promedio de Tratamientos Completados (Días)** | Análisis A | $\frac{\sum \text{dias\_duracion\_real}}{\sum \text{tratamientos\_completados}}$ | Exclusivo para tratamientos con `tratamientos_completados = 1` y `fecha_cierre_real >= fecha_inicio_real`. | $\le 45\text{ d}$ Verde / $46\text{–}75\text{ d}$ Ámbar / $> 75\text{ d}$ Rojo |
| **C4** | **Tasa de Cumplimiento de Sesiones Evaluables** | Análisis B | $\frac{\sum \text{sesiones\_realizadas}}{\sum \text{sesiones\_evaluables}} \times 100$ | **Excluye sesiones futuras** (`fecha_programada_vigente > @fecha_corte`) y sesiones canceladas por causa clínica/administrativa antes de la fecha. | $\ge 85\%$ Verde / $70\text{–}84.9\%$ Ámbar / $< 70\%$ Rojo |
| **C5** | **Tiempo Promedio de Espera en Sala (Min)** | Análisis B | $\frac{\sum \text{minutos\_espera}}{\sum \text{sesiones\_con\_espera\_medible}}$ | Solo sesiones realizadas con `fecha_llegada` y `fecha_inicio_atencion` reales registradas. | $\le 15\text{ min}$ Verde / $16\text{–}30\text{ min}$ Ámbar / $> 30\text{ min}$ Rojo |
| **C6** | **Calidad Documental a Primera Revisión** | Análisis C | $\frac{\sum \text{fichas\_completas}}{\sum \text{atenciones\_realizadas}} \times 100$ | Evalúa estrictamente `numero_revision = 1` en `ValidacionesFicha`. | $\ge 90\%$ Verde / $75\text{–}89.9\%$ Ámbar / $< 75\%$ Rojo |
| **C7** | **Cobertura de Indicaciones Postatención Emitidas** | Análisis C | $\frac{\sum \text{atenciones\_con\_indicacion\_emitida}}{\sum \text{atenciones\_realizadas}} \times 100$ | Numerador cuenta atenciones únicas con $\ge 1$ indicación aprobada y emitida (evita inflar si una atención tiene 2 documentos). | $\ge 95\%$ Verde / $80\text{–}94.9\%$ Ámbar / $< 80\%$ Rojo |
| **C8** | **Tasa de Aprobación Profesional de Borradores IA y Atención de Alertas** | Análisis D | $\text{C8a} = \frac{\sum \text{borradores\_aprobados}}{\sum \text{borradores\_generados}} \times 100$<br>$\text{C8b} = \frac{\sum \text{alertas\_atendidas}}{\sum \text{alertas\_generadas}} \times 100$ | Contabiliza cada borrador raíz (`id_borrador`) y cada alerta (`id_alerta`) una única vez, sin inflar por versiones intermedias. | $\ge 85\%$ Verde / $70\text{–}84.9\%$ Ámbar / $< 70\%$ Rojo |

---

### 2.2. Catálogo de las 20 Medidas Oficiales Requeridas

#### Análisis A: Gestión de Tratamientos
1. `tratamientos_iniciados` (`INT`): `1` cuando el tratamiento tiene `fecha_inicio_real IS NOT NULL` (al menos primera atención iniciada/realizada); `0` si solo está contratado/activado sin inicio clínico.
2. `tratamientos_completados` (`INT`): `1` únicamente cuando `estado_tratamiento = 'Completado'` y cuenta con `fecha_cierre_real IS NOT NULL`.
3. `sesiones_planificadas` (`INT`): Cantidad total de sesiones del plan clínico vigente aprobado (`PlanTratamiento.es_vigente = 1`).
4. `sesiones_completadas` (`INT`): Cantidad de sesiones del tratamiento que tienen ejecución efectiva (`estado_asistencial = 'Realizada'`) y cierre documental válido (`estado_cierre = 'Cerrada'`).
5. `dias_duracion_real` (`INT NULL`): `DATEDIFF(DAY, CAST(fecha_inicio_real AS DATE), CAST(fecha_cierre_real AS DATE))` calculado **únicamente** cuando `estado_tratamiento = 'Completado'`; `NULL` para tratamientos en curso, suspendidos o cancelados.

#### Análisis B: Gestión de Sesiones
6. `sesiones_programadas` (`INT`): `1` por cada sesión única registrada en `SesionesTratamiento` (jamás se multiplica por sus reprogramaciones).
7. `sesiones_realizadas` (`INT`): `1` cuando la sesión cuenta con evidencia de atención efectiva (`estado_asistencial = 'Realizada'` y atención asociada con inicio real).
8. `sesiones_inasistidas` (`INT`): `1` cuando la inasistencia ha sido confirmada (`estado_asistencial = 'Inasistida'`).
9. `reprogramaciones_acumuladas` (`INT`): Conteo de eventos válidos con `tipo_cambio = 'REPROGRAMACION'` en `EventosSesion` para esa sesión.
10. `minutos_espera` (`INT NULL`): `DATEDIFF(MINUTE, fecha_llegada, fecha_inicio_atencion)` cuando ambas fechas existen y `fecha_inicio_atencion >= fecha_llegada`; `NULL` cuando falta cualquiera de las dos fechas (prohibido inventar minutos).
- *Medida auxiliar de cohorte:* `sesion_evaluable` (`INT`): `1` si `CAST(fecha_programada_vigente AS DATE) <= CAST(@fecha_corte AS DATE)` y `estado_programacion NOT IN ('Cancelada')`, `0` si es fecha futura.

#### Análisis C: Prestación Clínica
11. `atenciones_realizadas` (`INT`): `1` cuando la atención tiene ejecución clínica efectiva (`estado_servicio IN ('Realizado', 'Finalizado')` y `asistencia IN ('Asistió', 'Asiste', 'Confirmada')`).
12. `minutos_consulta` (`INT NULL`): `DATEDIFF(MINUTE, fecha_inicio, fecha_fin)` cuando ambas marcas existen y `fecha_fin >= fecha_inicio`; `NULL` en caso contrario.
13. `fichas_completas` (`INT`): `1` si la revisión inicial (`ValidacionesFicha.numero_revision = 1`) tuvo `resultado_validacion = 'Completa'` (permanece inmutable aunque revisiones posteriores 2, 3... corrijan campos pendientes).
14. `indicaciones_emitidas` (`INT`): Conteo de documentos raíz únicos en `IndicacionesPostatencion` asociados a la atención que alcanzaron `estado_documento = 'Emitido'` con aprobación profesional (`id_profesional_aprobador IS NOT NULL`).
15. `procedimientos_registrados` (`INT`): Conteo de registros en `DetalleProcedimiento` asociados a la atención.
- *Medida auxiliar de cobertura:* `atencion_con_indicacion_emitida` (`INT`): `1` si `indicaciones_emitidas >= 1`, `0` en caso contrario (para que el indicador de cobertura no supere el 100% cuando una atención emite más de un documento).

#### Análisis D: Intervenciones del Agente Inteligente
16. `interacciones_registradas` (`INT`): `1` si el evento atómico corresponde a una interacción registrada en `InteraccionesIA`, `0` en otro caso.
17. `alertas_generadas` (`INT`): `1` si el evento atómico corresponde a una alerta preventiva única en `AlertasIA`, `0` en otro caso.
18. `alertas_atendidas` (`INT`): `1` si la alerta en `AlertasIA` fue revisada/atendida por el profesional (`estado_alerta IN ('Atendida', 'Descartada_Justificada')` y `id_usuario_revisor IS NOT NULL`), `0` en otro caso.
19. `borradores_generados` (`INT`): `1` por cada documento borrador raíz único en `BorradoresIA` (sin multiplicar por sus ediciones o versiones previas a la aprobación), `0` en otro caso.
20. `borradores_aprobados` (`INT`): `1` si el borrador en `BorradoresIA` cuenta con aprobación formal del odontólogo (`estado_borrador = 'Aprobado'` e `id_profesional_aprobador IS NOT NULL` y `fecha_aprobacion IS NOT NULL`), `0` en otro caso.

---

## PASO 3: IDENTIFICACIÓN DE FORMATOS Y FUENTES DE ORIGEN OLTP

| Proceso | Entidades OLTP Fuente (`NexoSaludDB`) | Clave Primaria de Origen | Eventos / Campos Críticos de Origen |
|---|---|---|---|
| **Análisis A (Tratamientos)** | `dbo.TratamientosContratados` + `dbo.PlanTratamiento` (vigente) + resumen de `dbo.SesionesTratamiento` | `id_tratamiento` | `fecha_contratacion`, `fecha_activacion`, `fecha_inicio_real`, `fecha_cierre_real`, `estado_tratamiento`, `sesiones_planificadas` (de `PlanTratamiento` con `es_vigente = 1`). |
| **Análisis B (Sesiones)** | `dbo.SesionesTratamiento` + conteo de `dbo.EventosSesion` | `id_sesion` | `numero_sesion`, `fecha_programada_vigente`, `fecha_llegada`, `fecha_inicio_atencion`, `fecha_cierre_sesion`, `estado_programacion`, `estado_asistencial`, `estado_cierre`. |
| **Análisis C (Prestación Clínica)** | `dbo.Atenciones` + `dbo.ValidacionesFicha` (`numero_revision = 1`) + agregados de `dbo.DetalleProcedimiento` e `dbo.IndicacionesPostatencion` | `id_atencion` | `fecha_atencion`, `fecha_inicio`, `fecha_fin`, `asistencia`, `estado_servicio`, `estado_cierre_documental`, `resultado_validacion` (rev. 1). |
| **Análisis D (Agente IA)** | `dbo.InteraccionesIA`, `dbo.AlertasIA`, `dbo.BorradoresIA` | `(tipo_registro_origen, id_origen_ia)` | `fecha_evento`, `tipo_evento`, `actor_orientado` (`PACIENTE`/`ODONTOLOGO`), `estado`, `resultado`, `requiere_revision_humana`, `id_usuario_aprobador`, `version_agente`. |

---

## PASO 4: IDENTIFICACIÓN DE DIMENSIONES LEGÍTIMAS

### 4.1. Dimensiones Conformadas Reutilizadas (`NexoSalud_Mart`)
1. `dbo.Dim_Tiempo` (`KeyTiempo`): Usada con múltiples roles temporales (`KeyTiempoContratacion`, `KeyTiempoInicio`, `KeyTiempoCierre`, `KeyTiempoProgramada`, `KeyTiempoAtencion`, `KeyTiempoEvento`). Miembro desconocido: `KeyTiempo = 0`.
2. `dbo.Dim_Hora` (`KeyHora`): Minuto y turno de la cita/sesión/atención/interacción. Miembro desconocido: `KeyHora = 0`.
3. `dbo.Dim_Sede` (`KeySede`): Sede clínica de ejecución. Miembro desconocido: `KeySede = 0`.
4. `dbo.Dim_Servicio` (`KeyServicio`): Servicio odontológico contratado/prestado. Miembro desconocido: `KeyServicio = 0`.
5. `dbo.Dim_Profesional` (`KeyProfesional`): Odontólogo responsable o ejecutor. Miembro desconocido: `KeyProfesional = 0`.
6. `dbo.Dim_EstadoAtencion` (`KeyEstadoAtencion`): Estado operativo, asistencia y cierre documental de la atención. Miembro desconocido: `KeyEstadoAtencion = 0`.

### 4.2. Nuevas Dimensiones Especializadas de CUSTOMER (`NexoSalud_Mart`)
7. `dbo.Dim_EstadoTratamiento` (`KeyEstadoTratamiento`):
   - Atributos: `CodigoEstado`, `EstadoTratamiento` (`Contratado`, `Activado`, `En ejecución`, `Suspendido`, `Completado`, `Cancelado`), `CategoriaCiclo` (`Abierto`, `Pausado`, `Cerrado Exitoso`, `Cerrado Anulado`), `PermiteTransicionTurned` (`SI`/`NO`).
8. `dbo.Dim_EstadoSesion` (`KeyEstadoSesion`):
   - Atributos: `EstadoProgramacion` (`Programada`, `Reprogramada`, `Cancelada`), `EstadoAsistencial` (`Pendiente`, `Confirmada`, `Realizada`, `Inasistida`), `EstadoCierre` (`Pendiente`, `Cerrada`, `No Aplica`), `EsEvaluableCumplimiento` (`SI`/`NO`).
9. `dbo.Dim_TipoInteraccionIA` (`KeyTipoInteraccionIA`):
   - Atributos: `ClaseEventoIA` (`INTERACCION`, `ALERTA`, `BORRADOR`), `SubtipoEventoIA` (ej. `CONSULTA_ESTADO_TRATAMIENTO`, `SOLICITUD_REPROGRAMACION`, `ALERTA_ANTECEDENTE_CRITICO`, `BORRADOR_INDICACIONES_POSTATENCION`, `VERIFICACION_FICHA`), `RequiereAprobacionHumana` (`SI`/`NO`).
10. `dbo.Dim_TipoUsuarioIA` (`KeyTipoUsuarioIA`):
    - Atributos: `RolActor` (`PACIENTE`, `ODONTOLOGO`, `AUDITOR_CLINICO`, `SISTEMA`), `CanalInterfaz` (`PORTAL_PACIENTE`, `COPILOTO_SILLON`, `CONSOLA_AUDITORIA`).
11. `dbo.Dim_ResultadoIA` (`KeyResultadoIA`):
    - Atributos: `EstadoResolucionIA` (`Generado`, `En_Revision`, `Aprobado`, `Corregido_Y_Aprobado`, `Rechazado`, `Atendida`, `Derivado_Personal`), `DecisionHumana` (`Aprobado_Sin_Cambios`, `Aprobado_Con_Edicion`, `Rechazado`, `Pendiente_Revision`, `No_Requiere`).

---

## PASO 5: MATRIZ DE MEDIDAS Y DIMENSIONES (BUS MATRIX DE CUSTOMER)

| Tabla de Hechos / Grupo de Medidas | `Dim_Tiempo` (Roles) | `Dim_Hora` | `Dim_Sede` | `Dim_Servicio` | `Dim_Profesional` | `Dim_EstadoTratamiento` | `Dim_EstadoSesion` | `Dim_EstadoAtencion` | `Dim_TipoInteraccionIA` | `Dim_TipoUsuarioIA` | `Dim_ResultadoIA` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. `Fact_TratamientoCustomer`** (Análisis A: `tratamientos_iniciados`, `tratamientos_completados`, `sesiones_planificadas`, `sesiones_completadas`, `dias_duracion_real`) | **X** (Contratación, Inicio, Cierre) | | **X** | **X** | **X** | **X** | | | | | |
| **2. `Fact_SesionCustomer`** (Análisis B: `sesiones_programadas`, `sesiones_realizadas`, `sesiones_inasistidas`, `reprogramaciones_acumuladas`, `minutos_espera`) | **X** (Programada, Ejecución) | **X** | **X** | **X** | **X** | | **X** | | | | |
| **3. `Fact_AtencionCustomer_V2`** (Análisis C: `atenciones_realizadas`, `minutos_consulta`, `fichas_completas`, `indicaciones_emitidas`, `procedimientos_registrados`) | **X** (Atención) | **X** | **X** | **X** | **X** | | | **X** | | | |
| **4. `Fact_InteraccionIACustomer`** (Análisis D: `interacciones_registradas`, `alertas_generadas`, `alertas_atendidas`, `borradores_generados`, `borradores_aprobados`) | **X** (Evento IA) | **X** | **X** | **X** | **X** | | | | **X** | **X** | **X** |

---

## PASO 6: AGRUPACIÓN POR GRANULARIDAD Y REGLAS DE ADITIVIDAD

### 6.1. Justificación de Separación en 4 Hechos Especializados
1. **Imposibilidad de combinar Tratamientos (A) con Sesiones (B):** Un tratamiento tiene $1..N$ sesiones. Si se almacenaran `sesiones_planificadas` o `tratamientos_iniciados` al grano de sesión, un tratamiento de 5 sesiones sumaría $5 \times 5 = 25$ sesiones planificadas y 5 tratamientos iniciados (Fan-Trap clásico).
2. **Separación entre Sesiones (B) y Prestación Clínica/Atenciones (C):** Una sesión puede ser inasistida o reprogramada sin llegar a producir una atención clínica efectiva, mientras que una atención realizada tiene una relación $1:N$ con `DetalleProcedimiento`, $1:N$ con `ValidacionesFicha` y $1:N$ con `IndicacionesPostatencion`. En `Fact_AtencionCustomer_V2` el grano es estrictamente **1 fila por `id_atencion`**, pre-agregando sus procedimientos, la 1ra revisión de ficha y sus indicaciones aprobadas/emitidas para impedir la multiplicación de `atenciones_realizadas`.
3. **Separación de Intervenciones de IA (D):** Una atención o sesión puede involucrar 0, 1 o múltiples interacciones del paciente, alertas clínicas y borradores de indicaciones. Almacenar los eventos del agente en `Fact_InteraccionIACustomer` con grano **1 fila por evento atómico de IA (`ClaseEventoIA`, `id_origen_ia`)** evita multiplicar atenciones o sesiones y permite analizar cada clase de evento (`INTERACCION`, `ALERTA`, `BORRADOR`) sin colisiones.

### 6.2. Reglas de Aditividad y Cortes Temporales
- **Hecho de Snapshot Acumulativo (`Fact_TratamientoCustomer`):**
  - Cada fila representa el ciclo de vida de un `id_tratamiento` con tres llaves temporales de rol: `KeyTiempoContratacion`, `KeyTiempoInicio` y `KeyTiempoCierre`.
  - `tratamientos_iniciados` se agrupa por `KeyTiempoInicio`.
  - `tratamientos_completados` y `dias_duracion_real` se agrupan por `KeyTiempoCierre`.
  - `sesiones_planificadas` y `sesiones_completadas` son medidas del estado vigente del tratamiento; son aditivas entre tratamientos distintos en un corte dado, pero **no deben sumarse dos veces si se consulta el mismo tratamiento en múltiples cortes**.
- **Medidas No Aditivas (Promedios y Tasas):**
  - `minutos_espera`, `minutos_consulta` y `dias_duracion_real` nunca se promedian mediante `AVG` de promedios precalculados. En los hechos se almacenan la suma numerador y la bandera/conteo de casos válidos con fecha real para calcular $\frac{\sum \text{numerador}}{\sum \text{denominador\_valido}}$ en cualquier nivel de agregación.

---

## PASO 7: ESPECIFICACIÓN DE LAS TABLAS DE HECHOS Y COMPATIBILIDAD

### 7.1. `dbo.Fact_TratamientoCustomer` (Análisis A)
- **Grano:** 1 fila por tratamiento contratado (`id_tratamiento` UNIQUE / PK).
- **Claves dimensionales:** `KeyTiempoContratacion`, `KeyTiempoInicio` (0 si no iniciado), `KeyTiempoCierre` (0 si no cerrado), `KeySede`, `KeyServicio`, `KeyProfesional`, `KeyEstadoTratamiento`.
- **Medidas:** `tratamientos_iniciados`, `tratamientos_completados`, `sesiones_planificadas`, `sesiones_completadas`, `dias_duracion_real`.

### 7.2. `dbo.Fact_SesionCustomer` (Análisis B)
- **Grano:** 1 fila por sesión de tratamiento (`id_sesion` UNIQUE / PK).
- **Claves dimensionales:** `KeyTiempoProgramada`, `KeyTiempoEjecucion` (0 si no realizada), `KeyHoraProgramada`, `KeySede`, `KeyServicio`, `KeyProfesional`, `KeyEstadoSesion`.
- **Medidas:** `sesiones_programadas` (`=1`), `sesion_evaluable` (`0/1` según fecha de corte), `sesiones_realizadas`, `sesiones_inasistidas`, `reprogramaciones_acumuladas`, `minutos_espera`, `tiene_espera_medible` (`0/1`).

### 7.3. `dbo.Fact_AtencionCustomer_V2` (Análisis C)
- **Grano:** 1 fila por atención odontológica (`id_atencion` UNIQUE / PK).
- **Claves dimensionales:** `KeyTiempoAtencion`, `KeyHoraAtencion`, `KeySede`, `KeyServicio`, `KeyProfesional`, `KeyEstadoAtencion`.
- **Medidas:** `atenciones_realizadas`, `minutos_consulta`, `tiene_duracion_medible`, `fichas_completas` (evaluado en `numero_revision = 1`), `indicaciones_emitidas` (total documentos emitidos), `atencion_con_indicacion_emitida` (`0/1` para cobertura sin sobreconteo), `procedimientos_registrados`.

### 7.4. `dbo.Fact_InteraccionIACustomer` (Análisis D)
- **Grano:** 1 fila por registro único de intervención del Agente Inteligente (`ClaseEventoIA`, `id_origen_ia` PK compuesta).
- **Claves dimensionales:** `KeyTiempoEvento`, `KeyHoraEvento`, `KeySede`, `KeyServicio`, `KeyProfesional`, `KeyTipoInteraccionIA`, `KeyTipoUsuarioIA`, `KeyResultadoIA`.
- **Medidas:** `interacciones_registradas`, `alertas_generadas`, `alertas_atendidas`, `borradores_generados`, `borradores_aprobados`.

### 7.5. Estrategia de Compatibilidad para `dbo.fact_atencion_customer`
- La tabla heredada `dbo.fact_atencion_customer` (y su sinónimo `dbo.Fact_AtencionCustomer`) se conserva y se recalcula dentro de `dbo.usp_ETL_SincronizarCustomerMart` a partir de `Fact_AtencionCustomer_V2` y `Fact_SesionCustomer`, asegurando que:
  1. `cita_evaluable` excluya sesiones/citas futuras (`fecha_atencion <= @fecha_corte`).
  2. `atencion_realizada`, `cita_inasistencia`, `tiempo_sillon_dental_minuto` y `atencion_finalizada_conforme` coincidan matemáticamente con `Fact_AtencionCustomer_V2`.
  3. Ningún endpoint existente en `report.routes.ts` se rompa.
