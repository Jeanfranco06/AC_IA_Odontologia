# Bloque 1: confiabilidad de inversion Buyer

Base revisada: `281537d` en `analysis/buyer-bases-datos`. Entrega del bloque de confiabilidad autorizada por Daniel. Sintaxis SQL y TypeScript revisada; ejecucion de las pruebas en SQL Server pendiente. B3 y sincronizacion general de captaciones siguen pendientes de los bloques 2 y 3.

## Alcance y archivos

| Archivo | Cambio |
|---|---|
| [06 principal](../semana9/06_segunda_tabla_hecho_inversion_buyer.sql) | No inserta gastos; actualiza la tabla existente, retira DEFAULT 0 de impresiones/clics e instala una unica rutina de carga con transaccion, bloqueo y conciliacion. |
| [Servicio del backend](../../../backend/src/services/martSyncService.ts) | Invoca esa rutina en lugar de duplicar DDL/ETL. Los fallos de inversion se propagan al llamador. |
| [05 pruebas Germain](../semana9/05_pruebas_operativas_germain.sql) | Corrige las dos busquedas del marcador con CHARINDEX literal. Los otros pendientes de ese archivo siguen abiertos. |
| [Datos simulados opcionales](../semana9/pruebas/06_datos_inversion_simulados.sql) | Ejemplos monetarios separados e identificados. Solo para catalogos originales y copia de pruebas. |
| [Pruebas de confiabilidad](../semana9/pruebas/06_pruebas_confiabilidad_inversion.sql) | Ejecuta la rutina real y revierte sus datos al finalizar. |

El procedimiento nuevo es `NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer`.
Usa MERGE, tablas temporales, TRY/CATCH y una transaccion. Prepara fechas, fuente/campana y canales desde el origen. El bloqueo se solicita en NexoSaludDB con el recurso del ETL Buyer base para coordinar ambos procesos.

No se cambian aqui las formulas de B1/B2/B3 ni los totales CPL del reporte. Las consultas de CPL que permanecen al final del 06 son las anteriores y se revisaran en el bloque 2.

## Decisiones para revisar antes del commit

- La tabla de inversion es un espejo completo de GastosCampana. Si se elimina un gasto del origen, su fila tambien se elimina del Mart. No es un archivo historico independiente del OLTP.
- Impresiones y clics se conservan como columnas NULL por compatibilidad; la fuente no proporciona esas metricas. La carga reemplaza tambien los ceros derivados del ETL anterior por NULL. No usar estas columnas para introducir mediciones manuales mientras no exista una fuente formal.
- Los gastos introducidos por el script anterior permanecen en OLTP. No se borran ni reclasifican automaticamente porque su descripcion no demuestra si son reales o simulados. Revisarlos con Germain antes de presentar evidencia financiera.
- El ejemplo opcional nuevo no detecta automaticamente las semillas antiguas sin marcador. Ejecutarlo sobre una copia que ya contenga esos importes puede aumentar el total: no se promete un total fijo de S/ 3250.
- Instalar el 06 actualizado antes de iniciar el backend modificado. El usuario del backend necesita permiso de ejecucion y acceso entre ambas bases acorde con su configuracion; este cambio no concede permisos automaticamente.
- No se modifican la sincronizacion anterior de captaciones ni su manejo de errores: corresponden al bloque 3.

## Revision en Antigravity

1. Actualizar la rama compartida solo si el clon esta limpio: `git pull --ff-only origin analysis/buyer-bases-datos`.
2. Si se entrega un parche, comprobarlo con `git apply --check "ruta/al/parche.patch"` y aplicarlo con `git apply "ruta/al/parche.patch"`. No usar opciones para forzar su aplicacion si existe conflicto.
3. Abrir Control de codigo fuente y revisar los archivos de la tabla anterior. Los archivos nuevos aparecen como no rastreados; abrirlos tambien.
4. Consultar `git diff --check` y `git diff`. No hacer commit ni push hasta revisar el resultado y las pruebas con Daniel.

## Ejecucion en SQL Server: bases revisadas existentes

1. Usar una copia de pruebas de NexoSaludDB y NexoSalud_Mart en la misma instancia. Detener el backend mientras se instala. No eliminar bases ni repetir init_oltp, init_mart o catalogos.
2. Abrir el 06 principal actualizado en SSMS y ejecutarlo. Crea/actualiza el hecho y el procedimiento, carga exclusivamente gastos existentes y muestra una conciliacion. Las diferencias de cantidad e importe deben ser cero. Si no hay gastos, ambos lados quedan en cero; eso no significa que el negocio no gasto.
3. Abrir y ejecutar `pruebas/06_pruebas_confiabilidad_inversion.sql`. Crea una campana sin contactos y gastos de S/100.01 y S/0, usa una fecha nueva, carga dos veces, compara cada gasto, prueba una eliminacion y revierte todo. Debe terminar con `OK` y sin error. Pueden quedar saltos IDENTITY, pues SQL Server no revierte esos contadores.
4. Reejecutar el 06 principal y confirmar diferencias cero. Revisar los gastos existentes sin atribuirles procedencia real si son simulados.
5. Iniciar el backend y usar la sincronizacion habitual. Confirmar que no aparece error del procedimiento y que la conciliacion de inversion sigue en cero.
6. Si se desean ejemplos monetarios persistentes, ejecutar por separado el archivo opcional solo en la copia de pruebas. No es necesario para la prueba con rollback del paso 3.

No se ha ejecutado SQL Server en el entorno de preparacion del borrador. La validacion de sintaxis no reemplaza estas pruebas. Tampoco se certifica aqui concurrencia real entre sesiones ni recuperacion ante todos los fallos.

## Criterios de aceptacion

- [ ] Instalacion sin insertar gastos de ejemplo en OLTP.
- [ ] Fecha nueva cargada y campana sin contactos conservada.
- [ ] Importe explicito cero conservado, impresiones/clics desconocidos en NULL.
- [ ] Dos cargas sin duplicacion y conciliacion gasto a gasto e importes.
- [ ] Eliminacion reflejada segun la politica de espejo aprobada.
- [ ] Prueba revertida y gastos ajenos al marcador no seleccionados por la limpieza.
- [ ] Backend invoca la misma rutina y comunica el fallo si la carga no termina.
- [ ] Diferencias revisadas antes de hacer commit en la rama compartida.

## Estado de entrega

Se publica este bloque para permitir que el equipo continue trabajando. Pasaron el analisis sintactico T-SQL de los cuatro SQL implicados, la transpilacion del servicio TypeScript, los enlaces de esta guia y la comprobacion de aplicacion del parche contra el commit base. No se ejecutaron las pruebas SQL en el entorno de preparacion. No presentar los criterios pendientes como completados. Para las otras fases, consultar [recomendaciones](RECOMENDACIONES_OTRAS_FASES.md) y la matriz del apartado 7 de [entrega de Germain](ENTREGA_GERMAIN_AVANCE.md); son propuestas, no modificaciones de sus modelos implementadas por Germain.
