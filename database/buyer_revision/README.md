# Guía de trabajo para Germain — cierre de Buyer

**Fecha de preparación:** 1 de noviembre de 2026.  
**Responsables de Buyer:** Germain y Daniel.  
**Rama de trabajo:** `analysis/buyer-bases-datos`.  
**Prioridad:** terminar y verificar las BD transaccional, dimensional y el ETL de Buyer. El agente se aborda después.

> Entrega del [bloque 1 de confiabilidad](docs/REVISION_BLOQUE1_CONFIABILIDAD.md): sintaxis revisada; pruebas de ejecucion SQL Server pendientes.

## 1. Qué recibirás y por dónde empezar

Este paquete revisa los SQL de **Semana 9**. No es la integración terminada del backend ni un reemplazo automático de los scripts de `database/` en la raíz del repositorio.

Daniel ya creó las bases revisadas y mostró que las conciliaciones básicas coinciden en SQL Server. **No elimines ni vuelvas a crear esas bases solo por descargar este commit.** Empieza registrando el estado de la copia con la que trabajarás.

Lee y trabaja en este orden:

| Orden | Documento | Resultado que debes conseguir |
|---|---|---|
| 1 | [Ejecución de SQL Server](docs/EJECUCION_SQL_SERVER.md) | Identificar tu ruta: bases ya revisadas, creación desde cero o migración del esquema antiguo. |
| 2 | [Pendientes de Buyer en las BD](docs/PENDIENTES_BUYER_BD.md) | Completar datos y probar operaciones nuevas, costos, trazabilidad y repetición del ETL. Es tu trabajo principal. |
| 3 | [Recomendaciones para las otras fases](docs/RECOMENDACIONES_OTRAS_FASES.md) | Entregar recomendaciones a cada responsable, sin rediseñar ni ejecutar cambios de esas fases por tu cuenta en esta tarea. |
| 4 | [Ruta futura del agente Buyer](docs/AGENTE_BUYER.md) | Preparar la integración del sistema y luego el agente, cuando se cierre la parte de BD. |
| Consulta | [Cambios realizados](CAMBIOS_REALIZADOS.md) | Distinguir cambios implementados, evidencia observada y trabajo pendiente. |

## 2. Trabajar directamente en la rama compartida

Desde una copia local limpia del repositorio:

```bash
git fetch origin
git switch analysis/buyer-bases-datos
git pull --ff-only origin analysis/buyer-bases-datos
```

Germain y Daniel trabajarán directamente en **`analysis/buyer-bases-datos`**; no crear otra rama para Germain. Si tienes cambios locales, consérvalos antes de cambiar de rama. Si aún no existe la copia local de esta misma rama, usa `git switch --track origin/analysis/buyer-bases-datos` en lugar del segundo comando. Antes de editar o publicar, actualiza y coordina con el compañero para evitar cambios simultáneos sobre los mismos archivos. No sobrescribir commits con un push forzado.

No mezcles toda `refactor/buyer-impulse-integral` ni copies su Word como fuente normativa. Esa rama se revisó hasta `f76e252` y contiene propuestas que no coinciden con la versión mínima actual. La base de `main` revisada fue `09f680e` ("cambios en el buyer"); no se afirma que esos hashes sean la versión más reciente futura de cada rama.

## 3. Fuente funcional que debes respetar

La referencia es la pestaña **«Informe IN final»** del informe del equipo. La revisión inicial utilizó la copia exportada adjunta de Google Docs, no una lectura en vivo del documento. Las pestañas posteriores contienen material antiguo: úsalo únicamente si concuerda con la principal. Si el equipo cambia esa pestaña, contrasta la nueva versión antes de modificar reglas.

Para Buyer se conservan:

- **Cinco medidas:** `contacto_registrado`, `contacto_utilizable`, `conversion_lead`, `tiempo_conversion_dia`, `costo_atribuido_captacion`.
- **Tres indicadores:** B1 conversión a LEAD dentro de 14 días; B2 contactos utilizables; B3 costo por LEAD atribuible.
- **Reporte:** año/mes de captación; fuente y canal en filas; sede en columnas; contactos registrados en las celdas.
- **Grano:** una primera captación por persona. Una interacción o consulta recurrente no se cuenta como otra persona nueva.

No agregues indicadores o medidas persistidas por conveniencia técnica. Los filtros de ventana temporal se calculan con las fechas del hecho. Si una necesidad exige cambiar el grano o el reporte, justifícala primero frente al requerimiento.

## 4. Mapa mínimo del código

| Componente | Archivo canónico | Qué debes revisar/modificar si hace falta |
|---|---|---|
| OLTP, captura y conversión | [init_oltp.sql](semana9/init_oltp.sql) | `CaptacionesBuyer`, ampliación de `EventosEtapa`, vista `v_DatosCaptacionBuyer` y procedimiento `usp_ConvertirBuyerALead`. |
| Mart | [init_mart.sql](semana9/init_mart.sql) | `fact_captacion_buyer`: una fila por persona/captación y fechas/evidencia de conversión. |
| ETL | [poblamiento_merge_mart.sql](semana9/poblamiento_merge_mart.sql) | Bloque 1 Buyer revisado; bloque 2 otras fases heredadas. Es la única fuente activa de su poblamiento. |
| Datos base | [01_catalogos.sql](semana9/01_catalogos.sql) | Datos sintéticos originales. No repetir sobre una base ya poblada ni modificar para forzar indicadores. |
| Conciliación | [02_validacion.sql](semana9/02_validacion.sql) | Fuente frente a destino, evidencia, dimensiones, costos y totales de las cinco fases. |
| Indicadores/reporte | [03_indicadores_y_reporte_buyer.sql](semana9/03_indicadores_y_reporte_buyer.sql) | B1/B2/B3 y matriz; no ocultar desconocidos ni valores no calculables. |
| Pruebas locales | [04_pruebas_reglas_buyer.sql](semana9/04_pruebas_reglas_buyer.sql) | Casos de 14 días y céntimos con datos de sesión. No es una prueba integral del flujo. |
| Actualización del esquema anterior | [migracion_buyer.sql](semana9/migracion_buyer.sql) | Solo para una copia del esquema original de Semana 9, no para las bases ya revisadas. |

### Carpeta de trabajo y SQL que deben conservarse

- Trabajamos en **`database/buyer_revision/` y sus subcarpetas**: documentación en `docs/`, SQL revisados en `semana9/`.
- `semana9/init_oltp.sql` y `semana9/init_mart.sql` son necesarios: crean las estructuras de las dos bases. Deben conservarse aunque no se vuelvan a ejecutar sobre bases ya instaladas.
- Los archivos `database/init_oltp.sql`, `database/init_mart.sql`, `database/poblamiento_dimensional.sql` y `database/poblamiento_transaccional.sql` están fuera de esta revisión y pertenecen al paquete anterior. El backend todavía referencia el poblamiento dimensional anterior, por ejemplo desde `backend/src/scripts/run-etl.ts` y `test-certification-suite.ts`. No eliminarlos ni mezclarlos con el paquete revisado antes de adaptar esas dependencias.
- El poblamiento vigente para esta revisión es **`semana9/poblamiento_merge_mart.sql`**. Los datos base revisados se cargan desde `semana9/01_catalogos.sql`.

La creación nueva y la migración son **rutas alternativas**. Sus definiciones Buyer deben permanecer equivalentes cuando cambies una vista, tabla o procedimiento; no se ejecutan ambas para instalar desde cero.

## 5. Qué sabemos que pasó y qué no

Capturas aportadas por Daniel:

| Comprobación | Observado |
|---|---:|
| Contactos / utilizables / conversiones | 805 / 680 / 310 en origen y Mart |
| Solicitudes / pagos / pagos validados | 310 / 124 / 110 en origen y Mart |
| Citas / seguimientos | 219 / 80 en origen y Mart |
| Importe validado | S/ 19 100 en ambas bases |
| Discrepancias de eventos/tiempos y duplicados mostrados | Ninguna fila |
| Sede y servicio desconocidos | Los 805 contactos |
| `GastosCampana` / `Interacciones` | 0 registros |
| Captaciones `HISTORICO_OBSERVADO` | 805 |

Los resultados prueban esas conciliaciones, no una certificación de todos los indicadores. Los tiempos límite, conversiones nuevas, rechazos, concurrencia y costos con datos no vacíos requieren las pruebas de la guía de pendientes.

## 6. Entrega esperada de Germain

1. Completar la lista de aceptación de [Buyer BD](docs/PENDIENTES_BUYER_BD.md), anotando resultado y evidencia real.
2. Commit de los SQL nuevos o corregidos directamente en `analysis/buyer-bases-datos`, con orden de ejecución y diferencias respecto de las cinco medidas y tres indicadores originales —si no cambian, indicarlo—.
3. No marcar como resueltos sede, servicio o gasto históricos sin evidencia. Los datos sintéticos se identifican como prueba.
4. Entregar la matriz de recomendaciones de las otras fases a sus responsables. Son propuestas hasta que ellos las validen con el informe.
5. Revisar y compartir los commits publicados en `analysis/buyer-bases-datos`; no integrar directamente a `main` ni ejecutar cambios de producción dentro de este cierre.

**PostgreSQL:** es una posibilidad futura para producción. Los scripts y las pruebas de esta entrega siguen siendo **SQL Server / T-SQL**. No cambiar dialecto ni conectar el sistema a PostgreSQL en este trabajo; conservar el contrato de negocio para una futura migración separada.
