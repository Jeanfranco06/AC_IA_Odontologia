# Dimensiones LEAD en el Mart

Este paquete crea tres dimensiones y carga las nueve dimensiones conformadas o específicas de LEAD. Se conserva el grano de las dimensiones de Daniel. La instalación en el Mart principal del 9 de noviembre de 2026 consta en el [informe de despliegue](RESULTADO_DESPLIEGUE_MART_LEAD.md).

El [preflight del 9 de noviembre de 2026 y procedimiento de despliegue](PRE_DESPLIEGUE_MART_LEAD.md) contiene el ensayo reciente, los respaldos verificados, las huellas y los comandos aprobados de la ventana. Para repetir ese ensayo en las copias recientes, ejecutar `08_EJECUTAR_PRUEBAS_QA.ps1 -VentanaNueva` desde la raíz.

## Orden de ejecución

Ejecutar desde la raíz del repositorio con SQLCMD. Las copias usadas en la prueba son `NexoSalud_Mart_LeadQA`, `NexoSaludDB_MartLeadQA` y `NexoSalud_Mart_LeadRef`. Las dos copias del Mart deben venir del mismo respaldo. Conservar la referencia sin migrar.

1. Leer [el diagnóstico](DIAGNOSTICO_DIMENSIONAL.md). Validar que OLTP y Mart correspondan al mismo entorno y que el Mart contenga las seis dimensiones compartidas.
2. Ejecutar [01_MIGRAR_DIMENSIONES.sql](01_MIGRAR_DIMENSIONES.sql). Agrega índices por clave natural y las tres dimensiones nuevas dentro de una transacción. [00_CONTEXTO.sql](00_CONTEXTO.sql) valida el par de bases y establece las opciones de SQL Server.
3. Ejecutar [03_CARGAR_DIMENSIONES.sql](03_CARGAR_DIMENSIONES.sql). [02_FUENTES.sql](02_FUENTES.sql) extrae y transforma los datos compartidos con la conciliación. Los `MERGE` usan claves naturales y preservan las claves sustitutas existentes. Las actualizaciones comparan valores y las nuevas filas se insertan con columnas explícitas. La carga toma el bloqueo `ETL_BUYER_SEMANA9`, revierte ante un error y no escribe en la OLTP.
4. Ejecutar [04_VALIDAR_DIMENSIONES.sql](04_VALIDAR_DIMENSIONES.sql). Para repetir toda la prueba, usar [08_EJECUTAR_PRUEBAS_QA.ps1](08_EJECUTAR_PRUEBAS_QA.ps1). El ejecutor incluye la comparación con la referencia, los casos sintéticos, rollback, dos reejecuciones y pruebas de concurrencia y compatibilidad. [Ver los resultados reales](RESULTADOS_PRUEBAS.md).

```powershell
$sql = @('-S','localhost','-E','-C','-I','-b','-d','NexoSalud_Mart_LeadQA','-f','65001',
         '-v','Origen=NexoSaludDB_MartLeadQA','AutorizarPrincipal=NO','ProvocarError=NO')
sqlcmd @sql -i database/lead_revision/mart_dimensiones/01_MIGRAR_DIMENSIONES.sql
# Continuar solo si el código de salida es 0.
sqlcmd @sql -i database/lead_revision/mart_dimensiones/03_CARGAR_DIMENSIONES.sql
sqlcmd @sql -i database/lead_revision/mart_dimensiones/04_VALIDAR_DIMENSIONES.sql
```

La prueba sintética se revierte. Las secuencias IDENTITY de una copia pueden avanzar aun con rollback. Ante un error de origen, corregir o reconciliar la fuente con su responsable y volver a ejecutar. Si las dimensiones compartidas ya tienen claves naturales duplicadas, el índice único falla y la migración se revierte. No deduplicar por borrado ni sustituir tablas. Mantener la carga de hechos heredados fuera de este procedimiento.

## Medidas reservadas para la siguiente fase

| Indicador | Medidas y fórmula sobre las sumas |
| --- | --- |
| **L1** Aceptación de oportunidades | **M1** `oportunidad_aceptada`, **M2** `oportunidad_cerrada_sin_acuerdo`. 100 × ΣM1 / (ΣM1 + ΣM2). |
| **L2** Rechazo económico de propuestas | **M3** `propuesta_aceptada`, **M4** `propuesta_rechazada`, **M5** `propuesta_rechazada_economica`. 100 × ΣM5 / (ΣM3 + ΣM4). |
| **L3** Rechazo de alternativas por incompatibilidad | **M6** `alternativa_aceptada`, **M7** `alternativa_rechazada`, **M8** `alternativa_rechazada_incompatibilidad`. 100 × ΣM8 / (ΣM6 + ΣM7). |

Los casos pendientes no pertenecen al denominador y un denominador cero se presenta como «No calculable». `fact_negociacion_lead` conserva la definición anterior. Este paquete no crea, puebla ni sustituye hechos, indicadores o reportes. Los hechos, sus granos definitivos y los cinco análisis del cuadro aprobado se revisarán en la siguiente fase. Los dos roles de horario deben apuntar a la misma dimensión y los roles de fecha a `Dim_Tiempo`.
