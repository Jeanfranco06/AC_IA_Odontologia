# Ejecutar y comprobar el paquete de SQL Server

Volver a la [guía principal de Germain](../README.md). Para cerrar los casos que faltan, seguir [Pendientes de Buyer BD](PENDIENTES_BUYER_BD.md).

## Elegir una sola ruta

| Estado de tu copia | Ruta |
|---|---|
| Ya ejecutaste los scripts revisados y ves `CaptacionesBuyer` y `fact_captacion_buyer.id_persona` | A: verificar/continuar. No recrear. |
| No tienes las bases o preparas una instancia local vacía | B: crear desde cero. |
| Tienes el esquema original de Semana 9 con el Buyer agregado | C: migración, en copia de pruebas. |
| Tu esquema proviene del DDL PascalCase de `main` o de `OportunidadesCaptacion` del refactor | Comparar primero tablas/columnas. Esta migración no cubre automáticamente esos esquemas. |

Trabajar con nombres `NexoSaludDB` y `NexoSalud_Mart`, en la misma instancia. Los scripts contienen referencias entre ambas; no basta renombrar solo una base. Mantener detenido el backend durante la instalacion. El servicio revisado requiere instalar los procedimientos de captacion (bloque 1 del ETL) e inversion (archivo 06); ver [cierre y validacion local](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

## A. Continuar sobre las bases revisadas

1. Descargar o actualizar la rama indicada en la [guía](../README.md).
2. Abrir [02_validacion.sql](../semana9/02_validacion.sql) en SSMS y ejecutar con F5.
3. Revisar resultados según la sección de verificación de este documento.
4. Para recargar, ejecutar [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql). Recalcula las cinco fases.
5. Si solo necesitas una parte, seleccionar el bloque completo delimitado en ese mismo archivo:
   - **BLOQUE 1 DE 2: BUYER REVISADO:** desde su `USE NexoSaludDB` hasta el `GO` anterior al marcador del bloque 2.
   - **BLOQUE 2 DE 2: OTRAS FASES HEREDADAS:** desde su marcador/`USE` hasta el final.
   - Incluir `BEGIN TRY`, transacción, `COMMIT`, `CATCH` y `GO`; no ejecutar un `DELETE` aislado.
6. Ejecutar de nuevo validación, [indicadores/reporte](../semana9/03_indicadores_y_reporte_buyer.sql) y [pruebas de reglas](../semana9/04_pruebas_reglas_buyer.sql).

No existe ya una copia independiente `05_poblamiento_otras_fases.sql`: su contenido estaba duplicado y quedó únicamente en el bloque 2 del archivo canónico. Quien ya lo ejecutó no debe eliminar sus datos ni repetir la instalación por esta limpieza.

## B. Crear desde cero

Conservar respaldos si hay datos que se quieren retener. Si se decidió reconstruir una copia local, eliminar primero `NexoSalud_Mart` y luego `NexoSaludDB` desde SSMS, comprobando los nombres y cerrando sus conexiones.

Abrir cada archivo con **Archivo → Abrir → Archivo**, ejecutar con **F5**, y detenerse si aparece un error en **Mensajes**:

| Orden | Archivo | Acción |
|---|---|---|
| 1 | [init_oltp.sql](../semana9/init_oltp.sql) | Crear OLTP, captura Buyer, vista y procedimiento. |
| 2 | [01_catalogos.sql](../semana9/01_catalogos.sql) | Cargar una sola vez los datos sintéticos originales. |
| 3 | [init_mart.sql](../semana9/init_mart.sql) | Crear las dimensiones y los cinco hechos. |
| 4 | [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) | Cargar Buyer revisado y las otras fases heredadas. |
| 5 | [02_validacion.sql](../semana9/02_validacion.sql) | Contrastar datos de ambas bases. |
| 6 | [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql) | Consultar los tres indicadores y la matriz. |
| 7 | [04_pruebas_reglas_buyer.sql](../semana9/04_pruebas_reglas_buyer.sql) | Probar límites y conservación de céntimos sin escribir datos permanentes. |

No ejecutar la migración en esta ruta. No ejecutar archivos `.md`. No usar además el poblamiento antiguo de `database/` raíz o de otra rama.

## C. Migrar el esquema original de Semana 9

1. Verificar el respaldo y comparar el esquema. El guard del script rechaza el esquema PascalCase de `main`.
2. Ejecutar [migracion_buyer.sql](../semana9/migracion_buyer.sql) **por bloques** y detenerse ante cualquier error. Sus `GO` separan lotes: un error no garantiza que SSMS omita automáticamente todos los lotes siguientes.
3. Verificar que el hecho anterior se conservó como `fact_captacion_buyer_legacy_semana9`.
4. Ejecutar el poblamiento completo y los pasos 5 a 7 de la ruta B.
5. No ejecutar nuevamente `init_oltp.sql` ni `01_catalogos.sql` sobre una base poblada.

## Interpretar las verificaciones

- Consultas de personas sin etapa, pagos sin reserva y otras relaciones inválidas: **cero filas**. Cero filas no prueba un caso si la tabla de origen está vacía.
- Buyer: una fila por persona, cantidades iguales y sin discrepancias en evento, fecha o duración.
- Tabla final de totales de las cinco fases: `diferencia = 0`. Comprobar también el importe validado de PAYER.
- Baseline sintético intacto: 805 contactos; 680 utilizables; 310 conversiones; 310 solicitudes; 124 pagos; 110 pagos validados; 219 citas; 80 seguimientos; S/ 19 100 validados. Con nuevos casos de prueba los totales cambian: comparar origen/destino, no forzar estos números.
- `KeySede=0` o `KeyServicio=0`: desconocidos conservados, no pérdida de filas. El baseline tiene 805 así.
- Sin filas de `GastosCampana`, no hay conciliación financiera que demostrar y B3 puede ser `NULL`. No interpretarlo como costo cero.
- Una repetición de ETL puede cambiar `fecha_corte_etl`. La idempotencia se comprueba sobre claves, evidencia y medidas con el mismo origen, no sobre el timestamp de carga.

El análisis sintáctico realizado durante la preparación no equivale a una ejecución del motor. Daniel aportó evidencia de las conciliaciones básicas; las pruebas operativas pendientes están detalladas por separado.

## Inversion y backend revisado

Despues de instalar el ETL base, ejecutar `semana9/06_segunda_tabla_hecho_inversion_buyer.sql`. Para bases existentes y pruebas de cierre seguir [la guia de cierre](CIERRE_BUYER_Y_VALIDACION_LOCAL.md). No repetir los scripts de creacion para actualizar estos procedimientos.
