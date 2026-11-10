# Cinco hechos dimensionales de LEAD

El [preflight y procedimiento de la ventana principal](PRE_DESPLIEGUE_HECHOS_LEAD.md) reúne el ensayo más reciente, sus respaldos y los comandos aprobados. El [informe de instalación](RESULTADO_DESPLIEGUE_HECHOS_LEAD.md) registra la ejecución autorizada del 10 de noviembre de 2026.

El patrón del Mart agrupa por claves dimensionales, con una PK compuesta por el grano y una FK por cada rol dimensional. El cálculo primero identifica la unidad transaccional en las funciones OLTP aprobadas y después agrega las medidas al grano del Mart.

| Hecho | Grano de negocio | PK física y dimensiones referenciadas | Medidas |
| --- | --- | --- | --- |
| `fact_oportunidades_lead` | Una solicitud con ingreso LEAD | Día de ingreso, servicio, canal de origen, sede de interés y negociador | M1 aceptadas y M2 cerradas sin acuerdo |
| `fact_propuestas_aceptadas_lead` | Una propuesta raíz, con la última versión vigente | Día de presentación de la raíz, servicio y promoción vigente | M3 aceptadas |
| `fact_propuestas_rechazadas_lead` | Una propuesta raíz, con la última versión vigente | Día de presentación de la raíz, servicio, promoción vigente y motivo | M4 rechazadas y M5 rechazadas por motivo económico |
| `fact_alternativas_aceptadas_lead` | Una opción ofrecida, con su último historial al corte | Día de oferta, servicio de la oportunidad, sede y profesional ofrecidos, horario preferido y horario ofrecido | M6 aceptadas |
| `fact_alternativas_rechazadas_lead` | Una opción ofrecida, con su último historial al corte | Mismo grano dimensional que las aceptadas más el motivo | M7 rechazadas y M8 rechazadas por incompatibilidad |

## Correspondencia con la OLTP

- F1 usa `fn_Lead_Oportunidades_Corte`, que identifica la solicitud mediante `HistorialSolicitudesLead` y recupera la conversión, el canal y el origen documentados en `EventosEtapa`, `CaptacionesBuyer` e `Interacciones`. F2 y F3 usan `fn_Lead_Propuestas_Corte`, que elige la versión vigente en `HistorialPropuestasLead` y conserva la fecha de la raíz. F4 y F5 usan `fn_Lead_Alternativas_Corte`, que devuelve una fila por opción de `HistorialOpcionesLead`, con su horario ofrecido capturado y su preferencia. Los rechazos especiales se clasifican por motivo de catálogo, mediante `MotivosRechazoLead`.
- La opción no tiene su propio servicio. R3 lo toma de la oportunidad al corte. En el corte base de QA hay 310 opciones históricas sin ingreso LEAD asociado y todas carecen de un resultado acreditado. Permanecen fuera de las medidas. Si una opción resuelta carece de oportunidad al corte, se aborta la carga para revisar la evidencia, porque asignarle un servicio o excluirla alteraría la conciliación. Se reutiliza `Dim_Horario` para sus dos roles, tal como se definió en el paquete dimensional. El día preferido explícito tiene prioridad sobre la fecha preferida. El día ofrecido proviene de la fecha de atención ofrecida. Un intervalo sin día sigue siendo parcial.
- Los faltantes usan miembros existentes de la dimensión, resueltos mediante su identidad de negocio o etiqueta de control. En promoción, el ID identifica el catálogo y el texto sin ID conserva el origen `TEXTO`. Sin ID ni texto, corresponde «No especificada». La OLTP carece de un campo que registre explícitamente que se decidió no aplicar promoción, por lo que el ETL deja «Sin promoción» reservado. R2 sigue usando su convención de presentación para campos vacíos. Un rechazo histórico sin motivo queda «No especificado» y cuenta solo en M4 o M7. Una clave explícita sin correspondencia, o una combinación de horario observada sin miembro, detiene la carga.
- Los roles compartidos sin ID (servicio, canal, sede, negociador y profesional) reutilizan su miembro desconocido de origen, con etiqueta heredada «No especificado» o «No especificada». Cuando faltan todos los campos de un rol horario se usa `NO_ESPECIFICADO`. Un horario parcial documentado conserva su propia combinación. Los controles `DESCONOCIDO` de promoción, motivo y horario quedan disponibles en el catálogo. La carga exige resolver la evidencia que sí existe en la OLTP.
- La carga representa un corte completo en UTC. Los cinco hechos reflejan el último corte cargado, sin acumular cortes. Se agrupa por PK con `COUNT_BIG` y `SUM`. El `MERGE` elimina los grupos que dejaron de existir dentro de los cinco hechos nuevos, para que reclasificar una operación no duplique las medidas. El detalle histórico permanece en la OLTP.

## Scripts y demostración en QA

1. [01_CREAR_HECHOS.sql](01_CREAR_HECHOS.sql) declara las cinco PK compuestas, las FK y los controles de medidas no negativas, con M5 ≤ M4 y M8 ≤ M7.
2. [02_POBLAR_HECHOS.sql](02_POBLAR_HECHOS.sql) lee un corte común, comprueba las identidades, resuelve las claves del Mart y agrupa. Antes de confirmar compara los grupos completos mediante `EXCEPT` en ambas direcciones y ejecuta la conciliación de totales.
3. [03_COMPARAR_MEDIDAS.sql](03_COMPARAR_MEDIDAS.sql) contiene las consultas de verificación para los cinco hechos. La OLTP cuenta estados y categorías con `COUNT_BIG(CASE …)` directamente sobre las funciones de corte, sin utilizar las banderas de carga ni los joins dimensionales. El Mart suma cada una de las ocho columnas almacenadas. [04_VALIDAR_HECHOS.sql](04_VALIDAR_HECHOS.sql) ejecuta la comparación por separado. Usarlo con las fuentes estables, porque toma el corte al iniciarse.
4. [05_APLICAR_HECHOS_QA.sql](05_APLICAR_HECHOS_QA.sql) ejecuta creación y carga en una sola transacción. [06_PROBAR_HECHOS_QA.sql](06_PROBAR_HECHOS_QA.sql) prueba el corte base vacío, agrega casos sintéticos y sus miembros dimensionales dentro de una transacción y revierte ambos al terminar.
5. [07_CONSULTAS_REVISION_QA.sql](07_CONSULTAS_REVISION_QA.sql) permite demostrar los estados grabados, contar identidades vigentes sin dimensiones, reconciliar M1–M8 y agrupar rechazos por día y motivo.

Desde la raíz del repositorio, sobre el par que ya tiene las nueve dimensiones:

```powershell
$p = 'database/lead_revision/mart_hechos'
$qa = @('-S','localhost','-E','-C','-I','-b','-f','65001','-d','NexoSalud_Mart_LeadPreQA',
  '-v','Origen=NexoSaludDB_LeadPreQA','AutorizarPrincipal=NO','ProvocarError=NO')
sqlcmd @qa -i "$p/05_APLICAR_HECHOS_QA.sql"
# Continuar solo si el código de salida es 0.
sqlcmd @qa -i "$p/06_PROBAR_HECHOS_QA.sql"
# Continuar solo si el código de salida es 0.
sqlcmd @qa -i "$p/04_VALIDAR_HECHOS.sql"
sqlcmd @qa -i "$p/07_CONSULTAS_REVISION_QA.sql"
```

Las claves se pueden examinar, por ejemplo, uniendo `fact_oportunidades_lead` con `Dim_Tiempo` por `KeyTiempo` y sumando M1 y M2 por `Anio` y `Mes`. L2 se calcula con las sumas de F2 y F3 y L3 con las de F4 y F5. Para comparar ambos lados de cada indicador por dimensión, primero se agregan por el mismo filtro de dimensiones comunes. Unir los hechos en bruto o aplicar un filtro de motivo al denominador duplicaría o excluiría operaciones. [Fórmulas aprobadas de L1–L3](../ENTREGA_A_COMPANEROS.md#5-medidas-e-indicadores-desde-la-oltp).

## Resultado de QA del 10 de noviembre de 2026

Par `NexoSaludDB_LeadPreQA` → `NexoSalud_Mart_LeadPreQA`. Conciliación final a las 00:16:08 de Lima.

| Caso | Resultado idéntico en OLTP y Mart, de M1 a M8 |
| --- | --- |
| Datos reales | 0, 0, 0, 0, 0, 0, 0, 0 |
| Datos sintéticos | 1, 1, 2, 2, 1, 1, 2, 1 |
| Reejecución con los mismos datos sintéticos | 1, 1, 2, 2, 1, 1, 2, 1 |
| Una propuesta rechazada por motivo económico y una opción rechazada por incompatibilidad pasan a aceptadas | 1, 1, 3, 1, 0, 2, 1, 0 |
| Tras el rollback del caso | 0, 0, 0, 0, 0, 0, 0, 0 |

- Cada hecho quedó con cero filas operativas. La prueba verificó que dos propuestas aceptadas del mismo grupo se almacenen en una fila con M3 = 2. Dos versiones rechazadas de una raíz contaron como una, por la fecha de la raíz y la promoción de la versión vigente. Se verificaron ambos roles de horario, un intervalo preferido sin día, el motivo OTROS y la exclusión de pendientes. La segunda ejecución conservó cada grupo exacto. La reclasificación eliminó los grupos anteriores.
- El destino incorrecto se rechazó con `54900`. Al intentar cargar un caso sin sus dimensiones, se obtuvo `54906` y se revirtieron los datos sintéticos. Los avisos de nulos omitidos en agregados del caso no impidieron la conciliación. Se comprobó que los catálogos sintéticos y sus miembros ya no estaban presentes.
- Se verificaron las cinco PK, las 25 FK nuevas habilitadas y confiables, `DBCC CHECKDB` y `DBCC CHECKCONSTRAINTS` sin infracciones. Los hechos heredados conservaron sus filas y sumas frente a `NexoSalud_Mart_LeadPreRef` (BUYER 449, LEAD 58, PAYER 103, CUSTOMER 140 y TURNED 29). Al cierre de ese ensayo aún no se habían instalado los cinco hechos en el Mart principal.

## Revisión final del 10 de noviembre de 2026

**Por qué reutilizar las funciones OLTP.** Una consulta sobre la tabla actual no reconstruye lo que se conocía en un corte anterior. Oportunidades elige la última observación por solicitud e incorpora el ingreso y canal de una conversión BUYER acreditada. Propuestas elige primero la última observación de cada versión y luego la última versión vigente por raíz, manteniendo la fecha de presentación original. Alternativas elige la última observación por opción y recupera las condiciones ofrecidas del historial, aunque cambie la disponibilidad. Las funciones usan la hora de observación y el ID de historial para desempatar. Sus definiciones en QA coincidieron con las instaladas. Los hechos reutilizan esas reglas y calculan sus propios grupos con `JOIN`, `GROUP BY` y `SUM`.

**Día de negocio y corte.** El día de F1 es el ingreso LEAD (conversión BUYER si está acreditada), el de F2/F3 es la presentación de la raíz y el de F4/F5 es la fecha de oferta. Se convierten a `date` tal como fueron grabados, como en R1–R3. La fecha de atención ofrecida determina el día del rol de horario, mientras la marca UTC filtra qué observación estaba disponible. El servidor del ensayo coincidió con Lima (UTC−05:00). Los casos de 23:59 y 00:01 conservaron sus días de negocio aunque el primer instante corresponda al día siguiente en UTC. Las tres funciones excluyeron las observaciones cuando se consultó con un corte UTC anterior a su creación. Los campos `datetime2` de negocio carecen de zona incorporada. La función de oportunidades interpreta eventos e interacciones con el desplazamiento actual del servidor. La verificación aplica a las fechas locales de la OLTP y a ese desplazamiento. Escritores que almacenen horas UTC en esos mismos campos requerirían conciliar la convención en el origen.

**Ceros comprobados desde el origen.** En QA se observaron 310 solicitudes sin ingreso LEAD ni estado terminal, cero propuestas y 310 opciones sin estado de respuesta. En los historiales hubo 310 observaciones de solicitudes, cero de propuestas y 310 de opciones, sin estados terminales. Al ejecutar las funciones sin joins dimensionales, se obtuvieron cero oportunidades, cero raíces y 310 opciones, todas sin resultado. Por ello los ceros aparecen antes de asignar claves o agrupar.

**Corrección y repetición.** Se cambió la asignación de promoción vacía de «Sin promoción» a «No especificada». Se volvieron a ejecutar la carga, las pruebas sintéticas y la conciliación. Las ocho sumas coincidieron con las de la tabla de resultados anterior, incluidas reejecución, reclasificación y rollback. También pasaron el control de horario ausente, la selección del miembro compartido sin ID, la integridad y la conservación de los cinco hechos heredados. El corte final fue a las 00:21:14 de Lima.
