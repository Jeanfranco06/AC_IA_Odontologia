# Conciliación OLTP y Data Mart

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

## Cambio dimensional

[05_etl_customer.sql:1](../../../database/customer/05_etl_customer.sql#L1) se instala y ejecuta solo en Mart Test, con referencias a OLTP Test. El instalador deriva el contenido actual del repositorio; no se reutiliza una definición desplegada antigua. La misma ejecución concilia con aislamiento SERIALIZABLE. Los números históricos de la auditoría operativa no se mezclan con este universo sintético ni se presentan como pérdidas de datos.

Grano de Fact_InteraccionIACustomer: (ClaseEventoIA, id_origen_ia). INTERACCION representa filas persistidas de InteraccionesIA, incluidas conversaciones y auditoría; no significa que todas sean conversaciones. ALERTA conserva una unidad por identidad. BORRADOR conserva versiones como eventos, pero borradores_generados suma solo raíces; borradores_aprobados suma versiones vigentes aprobadas de cada linaje. Atendida y Resuelta contribuyen a alertas_atendidas. Los actos de revisión no crean otra alerta.

Se permite id_persona nulo para eventos de personal auténticos y se incorporan sus tipos de usuario. Eventos válidos observados, de clase inequívoca y longitud compatible se incorporan a Dim_TipoInteraccionIA; no se fuerzan a otra categoría. Las claves desconocidas se verifican explícitamente. Los 164 desconocidos operativos previos no se modificaron: esta entrega corrige el mecanismo y demuestra cero en Test, no afirma reparar producción.

Plan ausente devuelve sesiones_planificadas=0; se ajustó también CK_FactTrat_Sesiones para admitir ese valor real, sin inventar una sesión. Fichas_completas conserva la definición histórica de primera validación completa para atención realizada; la última validación efectiva de cierre es otro concepto y no altera esa medida.

## Mismo corte y universo

Prueba: [customerCompletionMart.test.ts:1](../../../backend/tests/customerCompletionMart.test.ts#L1). Corte UTC: 2026-11-12T12:44:57.955Z. Universo: ambas bases Test completas en la transacción. Se comprueba identidad de eventos y ausencia de grupos duplicados; se reejecuta ETL dentro del mismo corte y se comparan conteos/sumas.

| Medida | Valor OLTP | Valor Mart | Diferencia | Causa | Resultado |
|---|---|---|---|---|---|
| tratamientos_iniciados | 29 | 29 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| tratamientos_completados | 6 | 6 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| sesiones_planificadas | 72 | 72 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| sesiones_completadas | 38 | 38 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| dias_duracion_real | 0 | 0 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| sesiones_programadas | 65 | 65 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| sesiones_realizadas | 40 | 40 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| sesiones_inasistidas | 0 | 0 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| reprogramaciones_acumuladas | 16 | 16 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| minutos_espera | 0 | 0 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| atenciones_realizadas | 7 | 7 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| minutos_consulta | 0 | 0 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| fichas_completas | 5 | 5 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| indicaciones_emitidas | 51 | 51 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| procedimientos_registrados | 5 | 5 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| interacciones_registradas | 3054 | 3054 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| alertas_generadas | 186 | 186 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| alertas_atendidas | 123 | 123 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| borradores_generados | 71 | 71 | 0 | Mismo filtro y corte transaccional | COINCIDE |
| borradores_aprobados | 49 | 49 | 0 | Mismo filtro y corte transaccional | COINCIDE |


| Grano / dimensión comprobada | Filas divergentes |
|---|---|
| tratamiento | 0 |
| sesion_fecha_sede | 0 |
| atencion | 0 |
| evento_fecha_tipo | 0 |


Tipos desconocidos: 0. Grupos duplicados: 0. Antes/después: [{"rows": 3344, "interactions": 3054, "drafts": 71, "attended": 123}] / [{"rows": 3344, "interactions": 3054, "drafts": 71, "attended": 123}]. Evidencia agregada sin datos clínicos: [conciliacion-bi.json](evidencias/subsanacion/conciliacion-bi.json).

El helper syncCertificationMart limpia únicamente hechos Test huérfanos de fixtures borrados por suites históricas; no elimina fuentes operativas ni redefine medidas para ocultar diferencias. La instalación de las bases originales queda pendiente de despliegue institucional autorizado.

## Regresión

Suites históricas CUSTOMER, PAYER/guardas financieras, dunningScheduler y martSyncService se ejecutan como parte de backend. Se ejecuta ETL PAYER en Test y se conserva resumen financiero [{"reservations": 20, "customers": 19}]. La prueba compara antes/después del ETL reservas, suma de precio pactado, importe y checksum de estados de pagos; resultado [{"reservations": 33, "agreedPrice": "4800", "payments": "4900", "paymentStateChecksum": -252459332}] / [{"reservations": 33, "agreedPrice": "4800", "payments": "4900", "paymentStateChecksum": -252459332}]. No se modifican procedimientos de pago/dunning. No existe en esta entrega certificación visual integral de BUYER/LEAD ni regresión productiva de sus operaciones; los tests de módulos auxiliares no deben presentarse como tal.
