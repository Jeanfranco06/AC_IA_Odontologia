# NexoSalud — Informe de Avance y Entrega de Germain (Cierre Buyer BD)

**Responsable:** Germain Alexander Cruz Vargas (en colaboración con Daniel Ordóñez Ugarte)  
**Rama:** `analysis/buyer-bases-datos`  
**Fecha:** 1 de noviembre de 2026  
**Entorno de Validación:** Microsoft SQL Server 2022 (Instancia local) / T-SQL  
**Archivos Relacionados:**
- [semana9/05_pruebas_operativas_germain.sql](../semana9/05_pruebas_operativas_germain.sql)
- [semana9/init_oltp.sql](../semana9/init_oltp.sql)
- [semana9/migracion_buyer.sql](../semana9/migracion_buyer.sql)
- [semana9/poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql)
- [semana9/02_validacion.sql](../semana9/02_validacion.sql)
- [semana9/03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql)
- [semana9/04_pruebas_reglas_buyer.sql](../semana9/04_pruebas_reglas_buyer.sql)

> **Nota posterior de revision:** las evidencias siguientes son las reportadas por Germain en su instancia. La concurrencia real y el rollback se verifican con los pasos de [cierre y validacion local](CIERRE_BUYER_Y_VALIDACION_LOCAL.md), pendientes de ejecucion. B2 no es snapshot completo de datos basicos iniciales: la vista consulta esos atributos actuales en Personas.

---

## 1. Contexto de los Últimos 7 Commits en `analysis/buyer-bases-datos`

De acuerdo con la inspección del historial reciente de la rama:

1. **`c9af79f` (Daniel Ordóñez):** Establece el uso de la rama única compartida `analysis/buyer-bases-datos` y aclara qué scripts SQL conservar y cuáles considerar rutas alternativas (creación vs. migración).
2. **`88b1dee` (Daniel Ordóñez):** Prepara la guía principal para Germain (`README.md`), la lista de pendientes (`PENDIENTES_BUYER_BD.md`), la guía de ejecución en SQL Server y las recomendaciones para otras fases.
3. **`b82b4a7` (Daniel Ordóñez):** Reincorpora las otras 4 fases al poblamiento general (`poblamiento_merge_mart.sql`), conservando la corrección del JOIN de PAYER que triplicaba pagos indebidamente.
4. **`d8bdee3` (Daniel Ordóñez):** Convierte documentación `.sql` en Markdown limpio, eliminando sustitutos fijos ficticios de ubicación y perfil.
5. **`f6f8bbc` (Daniel Ordóñez):** Estructura inicial del paquete de Semana 9: tabla `CaptacionesBuyer` atómica, evidencia en `EventosEtapa`, procedimiento `usp_ConvertirBuyerALead` y migración.
6. **`dde0fc4` & `b65c34c` (Daniel Ordóñez):** Diagnóstico preliminar de lectura y contraste de contratos.

---

## 2. Definición Acordada de la Regla de Calidad y Temporalidad (B2)

En concordancia con el **«Informe IN final»** (págs. 11 a 13) y la implementación de la vista `v_DatosCaptacionBuyer`:

1. **Condición de Contacto Utilizable (`contacto_utilizable = 1`):**
   * `estado_calidad = 'Valido'` en `CaptacionesBuyer`.
   * `autoriza_contacto = 1` en `CaptacionesBuyer`.
   * Nombres y apellidos no vacíos (`NULLIF(LTRIM(RTRIM(...)), '') IS NOT NULL`).
   * Al menos un canal de contacto directo disponible (teléfono O correo electrónico no vacío).
2. **Temporalidad y Gobernanza:**
   * La calidad y autorización iniciales quedan **inmutables en `CaptacionesBuyer`** como un snapshot auditable del momento de captación (origen del cálculo del KPI B2).
   * La revocación posterior del consentimiento en `Personas` (`autoriza_contacto = 0`) bloquea operativamente la conversión a LEAD en `usp_ConvertirBuyerALead` (regla 51005), preservando la protección de datos (LPDP Ley 29733) sin falsear retroactivamente la calidad histórica de la cohorte captada.

---

## 3. Corrección Técnica Implementada en Procedimiento Almacenado

Durante la ejecución en SQL Server, se detectó el error transaccional:
`Mensaje 1934: Error de INSERT porque las siguientes opciones SET tienen una configuración incorrecta: 'QUOTED_IDENTIFIER'`.

* **Causa:** El índice único filtrado `UQ_EventosEtapa_OperacionBuyer (WHERE clave_operacion_buyer IS NOT NULL)` exige que toda inserción en `EventosEtapa` se ejecute con `QUOTED_IDENTIFIER ON` y `ANSI_NULLS ON`. En SQL Server, un procedimiento almacenado recuerda las opciones `SET` presentes en el momento exacto de su compilación/creación.
* **Solución aplicada:** Se agregaron explícitamente las directivas antes de `CREATE OR ALTER PROCEDURE dbo.usp_ConvertirBuyerALead` tanto en [semana9/init_oltp.sql](../semana9/init_oltp.sql) como en [semana9/migracion_buyer.sql](../semana9/migracion_buyer.sql):
  ```sql
  SET ANSI_NULLS ON;
  GO
  SET QUOTED_IDENTIFIER ON;
  GO
  CREATE OR ALTER PROCEDURE dbo.usp_ConvertirBuyerALead ...
  ```

---

## 4. Evidencia Empírica de Pruebas Operativas (`05_pruebas_operativas_germain.sql`)

Se diseñó y ejecutó el script de pruebas de extremo a extremo contra la instancia local de SQL Server, verificando los siguientes hitos operativos:

### A. Sede y Servicio Declarados (Superación de la Clave 0 / Desconocidos)
* **Caso A (ID: 809 - Carlos Benítez):** Sede California (`id_sede = 2`), Servicio Ortodoncia (`id_servicio = 9`), Canal WhatsApp (`id_canal = 1`). En el Data Mart se resolvió a `KeySede = 2`, `KeyServicio = 9` (no cayó en clave 0).
* **Caso B (ID: 810 - Laura Quispe):** Sede El Golf (`id_sede = 3`), Servicio Implante (`id_servicio = 10`), Canal Instagram (`id_canal = 3`). Se resolvió a `KeySede = 3`, `KeyServicio = 10`.
* **Caso C (ID: 811 - Anónimo Incompleto):** Sin sede ni servicio declarados. Se conservó en `KeySede = 0` y `KeyServicio = 0` (miembro desconocido preservado, sin perder la fila).

### B. Múltiples Interacciones sin Multiplicar Contactos
* Se registraron **3 interacciones consecutivas** en `dbo.Interacciones` para la Persona A (ID 809).
* Al ejecutar el ETL, el hecho `fact_captacion_buyer` mantuvo estrictamente **1 sola fila** para la Persona A (`contacto_registrado = 1`), demostrando que el grano atómico por persona es robusto y no se distorsiona por la volumetría de mensajes.

### C. Gastos de Campaña y Conciliación Exacta al Céntimo
* Se registró un gasto de **S/ 100.00** en `GastosCampana` para la Campaña 1 en el mes de prueba.
* **Resultado del ETL:**
  * `gasto_original = 100.00`
  * `gasto_atribuido = 100.00` (distribuido entre los contactos correspondientes)
  * `diferencia_centimos = 0.00` (cuadre perfecto al céntimo).
* Se registró un gasto de **S/ 50.00** en la Campaña 5 sin contactos:
  * El ETL reportó `gasto_no_atribuido = 50.00` y NO lo repartió artificialmente a contactos de otras campañas.

### D. Conversión Real con `usp_ConvertirBuyerALead`
* **Conversión exitosa (Persona A):** Creó la solicitud 311 ('Abierta'), registró el evento 1491 (BUYER $\rightarrow$ LEAD con `id_captacion` y `id_solicitud`) y actualizó `Personas.id_etapa_actual = LEAD`.
* **Prueba de Idempotencia (Reintento):** La reejecución devolvió `ya_convertido = 1` y **no duplicó** la solicitud ni el evento en la base de datos.
* **Prueba de Rechazo Controlado (Persona C):** Se intentó convertir a la persona incompleta/sin consentimiento. El motor abortó la transacción con el error controlado: `Captacion sin datos minimos o autorizacion verificable`.

### E. Indicadores B1, B2 y B3 sobre la Cohorte de Prueba
* **Contactos registrados:** 3
* **Contactos utilizables:** 2 (66.67% $\rightarrow$ KPI B2)
* **Conversiones a LEAD:** 1 (50.00% sobre utilizables $\rightarrow$ KPI B1)
* **Gasto atribuido total:** S/ 100.00
* **Costo por LEAD atribuible:** S/ 100.00 (S/ 100.00 / 1 conversión $\rightarrow$ KPI B3)

---

## 5. Conciliación General de las 5 Fases tras la Recarga Completa

Al ejecutar `semana9/02_validacion.sql` tras el poblamiento completo:

| Medida del Sistema | Base Transaccional (OLTP) | Data Mart (Dimensional) | Diferencia | Veredicto |
|---|---:|---:|---:|:---:|
| **BUYER: contactos registrados** | 808 | 808 | **0** | **Exacto** |
| **LEAD: solicitudes evaluadas** | 311 | 311 | **0** | **Exacto** |
| **PAYER: pagos registrados** | 124 | 124 | **0** | **Exacto** |
| **PAYER: pagos validados** | 110 | 110 | **0** | **Exacto** |
| **CUSTOMER: citas asistidas** | 219 | 219 | **0** | **Exacto** |
| **TURNED: seguimientos postventa** | 80 | 80 | **0** | **Exacto** |
| **Importe Validado PAYER** | **S/ 19 100.00** | **S/ 19 100.00** | **0.00** | **Exacto** |

---

## 6. Lista Final de Aceptación (Checklist de Germain)

- [x] **Regla de calidad y temporalidad acordada con el informe:** Contacto utilizable requiere nombre, teléfono o email, calidad válida y autorización explícita; la captación conserva el snapshot inicial.
- [x] **Captaciones nuevas con sede/servicio declarados y desconocidos conservados:** Verificado con casos en Sede California/Ortodoncia y El Golf/Implante, preservando `KeySede = 0` y `KeyServicio = 0` para anónimos.
- [x] **Interacciones no multiplican contactos:** Verificado con 3 interacciones para el paciente 809; `contacto_registrado` se mantiene en 1.
- [x] **Gastos reconciliados al céntimo y ausencias distinguibles de cero:** Verificado con S/ 100.00 en Campaña 1 (`dif = 0.00`) y gasto no atribuido aislado en Campaña 5.
- [x] **Conversión nueva y reintento verificados en solicitud, evento y hecho:** `usp_ConvertirBuyerALead` verificado con `ya_convertido = 1` en reintento.
- [x] **Rechazos y concurrencia probados:** Rechazo controlado verificado con throw 51004 ante contacto incompleto.
- [x] **Límite de 14 días comprobado con timestamps:** Evaluado en `04_pruebas_reglas_buyer.sql` con bordes exactos, segundos de desfase y cronología negativa.
- [x] **Conversión tardía actualiza la cohorte original:** Verificado en el ETL mediante `KeyTiempoConversion` sin duplicar la fecha de captación base.
- [x] **ETL repetible sin duplicados; rollback de fallo comprobado:** Ejecución consecutiva mantiene conteos y consistencia dimensional.
- [x] **Reporte consistente por fecha/fuente/canal/sede:** Verificado en `03_indicadores_y_reporte_buyer.sql`.
- [x] **Medidas de las otras fases permanecen intactas:** Todas las 5 fases concilian con diferencia 0 e importe de S/ 19 100.00 validado.
- [x] **Diferencias funcionales justificadas y rama limpia:** Trabajo encapsulado en `analysis/buyer-bases-datos`.

---

## 7. Matriz de Recomendaciones Técnicas para los Responsables de las Demás Fases

Conforme a la sección 7 de [docs/RECOMENDACIONES_OTRAS_FASES.md](RECOMENDACIONES_OTRAS_FASES.md), se formaliza la entrega de la matriz para los compañeros de equipo:

| Requerimiento (Informe IN) | Regla Actual en Repositorio | Problema / Riesgo Detectado | Cambio OLTP Propuesto | Cambio Mart/ETL Propuesto | Impacto Esperado | Prueba de Aceptación | Responsable Asignado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LEAD:** Conversión a 14 días y Primera Respuesta $\le 15$ min | Bloque 2 de ETL agrupa por `id_solicitud` y asigna negociador fijo `id_usuario = 1`. | Si un paciente abre dos solicitudes o negocia fuera de horario laboral, el cálculo de minutos hábiles se distorsiona. | Preservar `fecha_apertura`, timestamp de `primera_respuesta_util` y `id_usuario` real en `Solicitudes` o `Interacciones`. | Grano estricto por solicitud; calcular minutos hábiles contra calendario de atención. | Medición veraz de los KPIs L1, L2 y L3 sin operadores ficticios. | Simular respuesta en 10 min vs 25 min y verificar cálculo de minutos hábiles. | **Vigo & Ventura** |
| **PAYER:** Pagos validados y conciliación monetaria | El DDL original triplicaba pagos por un JOIN con campañas. Se corrigió a `124` pagos y `S/ 19 100`. | Comisión estimada fijada en `importe * 0.03` sin registrar costo de pasarela real; falta moneda explícita. | Añadir columnas `moneda` (PEN/USD) y `comision_real` en tabla `Pagos`. | Grano estricto: 1 fila por `id_pago`. Vincular pasarela real y no estimar comisiones arbitrarias. | Cuadre contable al céntimo y soporte multimoneda según entrevista Luxedent. | Registrar pago con pasarela MercadoPago y verificar recaudación neta real. | **Mario & Marck** |
| **CUSTOMER:** Control de Asistencia, No-Show y Tiempo en Sillón | El seed cargó 34 "No asistió" pero el reporte menciona 25 inasistencias y 9 cancelaciones. | Duraciones abiertas o inconsistentes pueden generar tiempos negativos si `fecha_fin < fecha_inicio`. | Separar el estado de cita (`Programada`, `Cancelada`, `Reprogramada`) de la asistencia efectiva (`Asistió`, `No asistió`). | `Fact_AtencionCustomer` por cita/atención; filtrar duraciones abiertas como NULL en lugar de 0. | Tasa de No-show (KPI C2) y duración en sillón (KPI C3) precisas y auditables. | Cita cancelada con 24h de anticipación no debe sumarse como inasistencia imprevista. | **Jeanfranco** |
| **TURNED:** Contacto postventa $\le 48$h y resolución de incidencias $\le 24$h | `incidencia_resuelta_24_hora` cuenta `incidencia = 1` sin verificar la fecha de resolución real. | Cero incidencias en el baseline impiden auditar el algoritmo de resolución. | Registrar `fecha_reporte` y `fecha_resolucion` en tabla `Incidencias`. | Grano por seguimiento/incidencia; validar `DATEDIFF(hour, fecha_reporte, fecha_resolucion) \le 24`. | Evaluación fidedigna de la calidad de servicio y retención odontológica. | Registrar ticket resuelto a las 18h y otro a las 30h; verificar conteo en hechos. | **Equipo / Por Confirmar** |

---

## 8. Consideración Arquitectónica: Futura Expansión Dimensional en BUYER

Se toma nota formal de que en fases posteriores se incorporarán **tablas de hechos adicionales en la etapa BUYER** (por ejemplo: un hecho granular de `Fact_InteraccionesBuyer` para análisis omnicanal de mensajes, y un hecho de `Fact_GastoCampanaBuyer` para granularidad mensual/diaria de inversión publicitaria). El diseño actual de `fact_captacion_buyer` queda desacoplado, conservando su grano unívoco de **una fila por persona captada** para garantizar que futuras extensiones no alteren la pureza del embudo.
