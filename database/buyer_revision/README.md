# Entrega Buyer: bases de datos, ETL y reportes

**Fecha de cierre:** 2 de noviembre de 2026. **Equipo:** Daniel y Germain. **Rama publicada:** `analysis/buyer-bases-datos`.

La ronda de validacion de Buyer se cerro con las evidencias locales compartidas por Daniel: SQL Server, conversion/reintento, costos, rollback, concurrencia, API, filtros, PDF y CSV. No es una certificacion de todas las rutas operativas del sistema ni de los indicadores de otras fases. El informe academico aun no se modifico; su siguiente actualizacion se limita a Buyer.

## Documentos vigentes

| Necesidad | Documento |
|---|---|
| Instalar o actualizar bases revisadas | [Ejecucion SQL Server](docs/EJECUCION_SQL_SERVER.md) |
| Conocer resultados comprobados y repetir pruebas | [Cierre y validacion](docs/CIERRE_BUYER_Y_VALIDACION_LOCAL.md) |
| Comenzar LEAD en rama propia | [Entrega al equipo LEAD](docs/ENTREGA_A_LEAD.md) |
| Planificar las otras fases | [Recomendaciones](docs/RECOMENDACIONES_OTRAS_FASES.md) |
| Preparar el informe, solo Buyer | [Actualizacion del informe](docs/ACTUALIZACION_INFORME_BUYER_DANIEL.md) |
| Integrar posteriormente operaciones y agente | [Ruta futura del agente](docs/AGENTE_BUYER.md) |
| Ver cambios y limpieza | [Registro de cambios](CAMBIOS_REALIZADOS.md) |

## Contrato vigente

- Captacion: una fila por primera captacion/persona. No crear otro contacto por cada mensaje o solicitud.
- Conversion Buyer a LEAD: evento verificable en EventosEtapa, con solicitud vinculada en operaciones nuevas. Una solicitud por si sola no reemplaza esa evidencia.
- Cinco medidas originales de captacion y tres indicadores B1/B2/B3. B2 representa calidad observada con los atributos que consulta la vista, no un snapshot completo de identidad inicial.
- Segundo hecho: una fila por gasto en `fact_inversion_campana_buyer`, independiente de que tenga contactos.
- B3 por cohorte y CPL de campana tienen alcances distintos. NULL representa ausencia de evidencia o resultado no calculable; cero requiere evidencia de valor cero.
- SQL Server/T-SQL sigue vigente. PostgreSQL y el agente son trabajos futuros separados.

## Archivos activos

| Archivo | Funcion |
|---|---|
| [init_oltp.sql](semana9/init_oltp.sql) | Crear OLTP completo en instalacion nueva. |
| [init_mart.sql](semana9/init_mart.sql) | Crear dimensiones y hechos base en instalacion nueva. |
| [01_catalogos.sql](semana9/01_catalogos.sql) | Catalogos y cohorte sintetica original; no es informacion real de la clinica. |
| [migracion_buyer.sql](semana9/migracion_buyer.sql) | Ruta alternativa para el esquema original de Semana 9. |
| [poblamiento_merge_mart.sql](semana9/poblamiento_merge_mart.sql) | Bloque 1 instala/carga captacion Buyer; bloque 2 carga otras fases con reglas heredadas. |
| [06_segunda_tabla_hecho_inversion_buyer.sql](semana9/06_segunda_tabla_hecho_inversion_buyer.sql) | Instalar y cargar inversion; no inserta gastos de ejemplo. |
| [02_validacion.sql](semana9/02_validacion.sql) | Conciliar origen/destino y revisar evidencia. |
| [03_indicadores_y_reporte_buyer.sql](semana9/03_indicadores_y_reporte_buyer.sql) | B1/B2/B3 y matriz SQL de captacion. |
| [pruebas/](semana9/pruebas/) | Casos sinteticos, limites, repeticion y rollback; no forman parte de la instalacion normal. |

La creacion desde cero y la migracion son rutas alternativas. No borrar bases ni repetir catalogos por actualizar el repositorio. Los SQL del esquema anterior se aislaron en [legacy_pre_buyer](../legacy_pre_buyer/README.md).

## Continuacion del equipo

Daniel y Germain conservan su rama compartida Buyer. Los responsables de LEAD crean su propia rama desde esta entrega; no editar directamente Buyer ni main para implementar la siguiente fase. El historial git conserva las propuestas retiradas, sin mantener varias guias contradictorias en el paquete activo.
