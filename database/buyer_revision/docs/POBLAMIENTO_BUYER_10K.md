# Poblamiento opcional: 10 000 buyers con costos y conversiones

[Inicio](../README.md) · [Instalacion SQL Server](EJECUCION_SQL_SERVER.md) · [Cierre previo](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

## 1. Alcance del escenario V1

Esta ampliacion agrega **10 000 buyers sinteticos** a la copia de pruebas; conserva las personas y gastos anteriores. No es una migracion ni un requisito para instalar el sistema. No borra bases. El conjunto se identifica por emails `@sim-buyer-10k-v1.invalid` y cinco campanas con prefijo `SIM_BUYER_10K_V1:`. No usar estos emails para envios.

| Concepto | Resultado esperado en la cohorte V1 |
|---|---:|
| Personas / primeras captaciones | 10 000 |
| Utilizables con consentimiento simulado | 8 500 |
| No utilizables, incompletos y sin consentimiento | 1 500 |
| Solicitudes y eventos BUYER a LEAD | 2 550 de cada uno |
| Conversiones dentro de 14 dias | 2 550 |
| Buyers que permanecen en BUYER | 7 450 |
| Interacciones | 20 000 |
| Campanas / meses / gastos | 5 / 12 / 60 |
| Inversion y costo atribuido | S/ 60 000 |
| Contactos con costo / sin costo | 10 000 / 0 |
| B1 / B2 | 30 % / 85 % |
| B3 | S/ 23,529411... por LEAD |

Los importes son **supuestos educativos**, no presupuesto recomendado ni evidencia de gasto de la clinica. Tambien se simula gestion de canales organicos. El costo se distribuye por campana/mes con el ETL existente, no se fija en el hecho. Los costos individuales varian. Se mantiene la regla NULL para evidencia ausente y divisor cero.

Se usan las primeras cinco campanas activas con fuente/canal activos como plantillas y se crean cinco campanas propias. En el catalogo de Semana 9 corresponden a WhatsApp, Instagram, Facebook, Web y Maps. No se presuponen IDs. El escenario distribuye aproximadamente 40/25/15/12/8 % de contactos; presupuesto por campana 42/28/16/9/5 %. Los doce pesos mensuales de gasto son 8/7/8/7/8/9/8/8/9/9/9/10 %. Esto permite comparar costos distintos sin asignar cero artificial a organicos.

Se declaran tres sedes y servicios activos variados; 500 contactos mantienen sede desconocida y 1 000 servicio desconocido. No se confunde contexto desconocido con costo desconocido. Las identidades, autorizaciones, fechas y mensajes estan marcados como simulacion.

El periodo se calcula en la primera ejecucion: doce meses completos anteriores al mes que contiene la fecha actual menos 14 dias. Si se ejecuta el 2 de noviembre de 2026, abarca octubre de 2025 a septiembre de 2026. Se conserva al repetir el script; no avanza el calendario ni duplica la cohorte. Todas las ventanas estan maduras.

## 2. Actualizar en Antigravity

Detener `npm run dev` con Ctrl+C antes de cargar los datos. En la raiz del clon:

```powershell
git status
git switch analysis/buyer-bases-datos
git pull --ff-only origin analysis/buyer-bases-datos
```

Si Git informa cambios locales, revisarlos y guardarlos antes de continuar; no usar reset ni borrar .env. Los archivos nuevos estan dentro de `database/buyer_revision/semana9/simulacion/`.

## 3. Requisitos y orden en SSMS

Usar la copia local de pruebas y guardar una copia de seguridad si se quiere volver al estado anterior. El script deja datos persistentes identificables. No incluye purga automatica, porque las solicitudes pueden ser utilizadas despues por otras fases.

1. Las bases revisadas `NexoSaludDB` y `NexoSalud_Mart` deben existir, con catalogos, tres sedes y servicios. Si ya completaste las pruebas anteriores, no repetir init, catalogos ni migracion. En instalacion nueva seguir primero la [guia de ejecucion](EJECUCION_SQL_SERVER.md).
2. Tener instalados el bloque 1 de [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) y el [06 de inversion](../semana9/06_segunda_tabla_hecho_inversion_buyer.sql). Si faltan o estan antiguos, ejecutar esos bloques completos antes del escenario. Ambos procedimientos se reutilizan, no se copia su logica.
3. Abrir y ejecutar **completo** [08_poblamiento_buyer_10k.sql](../semana9/simulacion/08_poblamiento_buyer_10k.sql). Esperar hasta el mensaje `OK: cohorte V1 cargada/sin duplicados`. El script genera origen y sincroniza ambos hechos en una transaccion; si ocurre un error, revierte la carga. Los contadores IDENTITY pueden dejar saltos.
4. Ejecutar completo [09_validacion_buyer_10k.sql](../semana9/simulacion/09_validacion_buyer_10k.sql). Debe terminar con `OK: 10k, B1/B2/B3, eventos, costos por campana/mes y ambos hechos conciliados`. Revisar las cantidades de la tabla anterior y las 60 conciliaciones con diferencia cero. Un error 516xx requiere revisar el mensaje; no basta con que algunas consultas devuelvan resultados.
5. Repetir 08 y luego 09 en la misma ventana o en otra. Las cifras V1 deben conservarse. Una cohorte parcial o modificada detiene la carga: no se borra ni se reescribe automaticamente. Si el equipo empieza a avanzar esos LEAD a otras fases, usar 08/09 como referencia del escenario inicial, no como restaurador de datos.
6. Guardar capturas de los dos origenes, B1/B2/B3, conciliacion, segundo hecho y mensaje final. Compartir errores completos si aparecen.

El script carga las conversiones **historicas por conjuntos**: solicitud, evento, captacion y etapa coherentes, con fecha entre 1 y 13 dias mas minutos. No llama 2 550 veces al procedimiento operativo porque este usa la hora actual y no permite fecha historica. No se cambia ese procedimiento para facilitar la simulacion. Su conversion/reintento/rechazo se siguen probando con [05 de pruebas operativas](../semana9/pruebas/05_pruebas_operativas_germain.sql), que es otro conjunto. No usar esta carga como evidencia de concurrencia ni rendimiento del procedimiento operativo.

## 4. Que pasa con los datos anteriores y las otras fases

Si tenias 805 contactos, el total puede pasar a **10 805**; con las tres pruebas de Germain, a **10 808**. Los resultados exactos de 10 000/8 500/2 550 son del filtro V1 en 09. Los 310/311 LEAD anteriores permanecen adicionales a los 2 550 nuevos.

**03_indicadores_y_reporte_buyer.sql consulta toda la historia**, por lo que sus porcentajes no seran necesariamente 30/85. Su B3 puede seguir NULL si la cohorte anterior carece de gastos. Eso es correcto. No se inventan gastos retroactivos para ocultarlo. Para demostrar valores calculables usar 09 o filtrar las campanas V1 en el reporte del sistema, cuando permita ese filtro. Filtrar solo el mes puede mezclar los dos conjuntos.

08 sincroniza solo los dos hechos Buyer. Las nuevas solicitudes no aparecen automaticamente en el hecho LEAD: si se necesita la comparacion de todas las fases, ejecutar despues **solo el bloque 2** del ETL y luego [02_validacion.sql](../semana9/02_validacion.sql). Conserva las reglas heredadas de las otras fases, sin simular pagos/atenciones/seguimientos nuevos ni redisenar su modelo. No combinar esta semilla con la semilla opcional de inversion para intentar lograr los valores exactos de V1.

## 5. Verificacion con el sistema

Despues de validar SQL:

1. Mantener `DUNNING_ENABLED=false` en backend/.env para estas pruebas.
2. Iniciar el backend y consultar `/api/ping` y `/api/reports/status`.
3. Ejecutar dos veces POST `/api/reports/sync` y repetir 09. No deben aumentar los registros ni cambiar los indicadores V1.
4. Verificar matrices/exportaciones por campanas V1 si el reporte ofrece ese filtro; el costo conocido debe tener valor y los casos desconocidos anteriores deben conservar su representacion. No comparar un total global de la UI con el subtotal V1 sin igualar filtros.

El nuevo poblamiento y su validacion se revisaron estaticamente al prepararlos. Su ejecucion real en SQL Server queda pendiente en tu instancia; los resultados esperados no se presentan como una prueba ya superada. No hubo modificaciones del informe ni de las reglas de B1/B2/B3.

## 6. Correccion del promedio en el reporte Buyer

La revision del video de noviembre detecto que el reporte sumaba promedios parciales (108,1 dias como total). Se corrigio el backend para transportar suma de duraciones y cantidad de valores conocidos por grupo y dividirlos en cada celda, fila, subtotal, columna y promedio general. Los contactos sin conversion no aportan duracion ni denominador. Un grupo sin duraciones queda NULL; una conversion observada de cero dias conserva cero. No se redondean componentes antes de consolidar. La comparacion mensual, CSV y PDF consumen el mismo resultado corregido.

Para aplicar: detener el backend con Ctrl+C, actualizar la rama con git pull --ff-only origin analysis/buyer-bases-datos y volver a ejecutar npm run dev desde backend. Mantener el frontend abierto y recargar el navegador. No repetir el poblamiento, ni DDL, ni ETL por esta correccion.

En Captacion, elegir noviembre de 2025 y tiempo_conversion_dia. El promedio general esperado es aproximadamente 7,02 dias (la interfaz muestra 7,0 por su formato de un decimal), en vez de 108,1. Las celdas sin conversion deben aparecer como raya, no como 0,0. Comparar con:

```sql
USE NexoSalud_Mart;
SELECT COUNT(tiempo_conversion_dia) AS conversiones_con_tiempo,
       AVG(tiempo_conversion_dia) AS promedio_dias
FROM dbo.fact_captacion_buyer
WHERE fecha_captacion >= '20251101'
  AND fecha_captacion < '20251201';
```

Para el escenario V1 sin otros registros del mes: 213 duraciones y promedio aproximado de 7,022594. Exportar PDF y CSV seleccionando esta medida y comprobar que el promedio general coincide, admitiendo la precision de cada formato. Confirmar tambien que costo atribuido e inversion siguen en S/4200 y CPL en S/19,72. El backend cuenta con pruebas de promedios ponderados, ausencia de datos, cero real y regresion del escenario V1; la comprobacion visual local de la correccion queda pendiente.
