# Entrega al equipo LEAD

[Inicio](../README.md) · [Resultados Buyer](CIERRE_BUYER_Y_VALIDACION_LOCAL.md) · [Orden SQL y sistema](EJECUCION_SQL_SERVER.md) · [Cohorte 10k](POBLAMIENTO_BUYER_10K.md) · [Recomendaciones por fase](RECOMENDACIONES_OTRAS_FASES.md).

## 1. Desde que version partir

La base incorpora la entrega original, la simulacion 10k (`04f7b44`) y la correccion del promedio Buyer (`626ee9b`), ambas comprobadas localmente por Daniel. Los cambios documentales posteriores no sustituyen estos scripts. Partir del HEAD actual de `analysis/buyer-bases-datos`, no de main ni del refactor antiguo.

Con el clon limpio, cada equipo crea su propia rama. El nombre siguiente es una propuesta, no una rama ya creada:

```bash
git fetch origin
git switch -c analysis/lead-bases-datos origin/analysis/buyer-bases-datos
git push -u origin analysis/lead-bases-datos
```

Si ya tienen una rama LEAD, integrar la base mediante un merge revisado en esa rama, sin recrearla ni forzar el historial. Daniel/Germain mantienen su rama Buyer compartida. No implementar LEAD directamente en ella ni en main.

## 2. Que se recibe

- OLTP completo de Semana 9 y CaptacionesBuyer; procedimiento transaccional de conversion Buyer a LEAD.
- Captacion e inversion con ETL canonicos, reporte de captacion y CPL, validaciones y casos sinteticos.
- Las otras cuatro fases siguen disponibles con su ETL heredado en el bloque 2. La correccion PAYER del JOIN que triplicaba pagos se conserva.
- Las recomendaciones LEAD/PAYER/CUSTOMER/TURNED son propuestas: Germain no implemento esos redisenos. No confundir totales conciliados con semantica final aprobada.

## 3. Contrato de salida Buyer que LEAD debe conservar

| Elemento | Contrato |
|---|---|
| Persona | id_persona identifica a la persona; varias solicitudes no deben crear varias primeras captaciones. |
| Captacion | id_captacion y fecha_captacion permanecen como origen de la cohorte. No reemplazarlos por la ultima interaccion o solicitud. |
| Conversion nueva | usp_ConvertirBuyerALead recibe id_captacion, id_servicio, motivo y usuario opcional; crea Solicitudes con estado Abierta, evento BUYER a LEAD y actualiza etapa actual en una transaccion. |
| Resultado | Devuelve id_evento_etapa, id_solicitud y ya_convertido. El reintento devuelve la operacion existente. En eventos historicos id_solicitud puede ser NULL; no inventar una solicitud para completarlo. |
| EventosEtapa | Conservar id_captacion/id_solicitud cuando existan y su pertenencia a la misma persona. No reutilizar clave_operacion_buyer para transiciones de otra fase. |
| B1 Buyer | Conversion obtenida del evento real; no usar estado actual de persona ni presencia de pago/solicitud como sustituto. |
| Dimensiones | Claves naturales unicas, miembros desconocidos y fechas por rol. No asumir IDs fijos como usuario=1 o sede=1. |
| Sincronizacion | API/CLI actuales sincronizan solo Buyer. La nueva carga LEAD debe tener su propia rutina y reglas, sin sobrescribir los hechos Buyer. |

## 4. Trabajo recomendado para LEAD

Crear su paquete separado, por ejemplo `database/lead_revision/`, con README, migracion aditiva, ETL, validacion y pruebas. No copiar todos los SQL Buyer como nueva fuente paralela.

1. Contrastar requerimientos, indicadores y reportes LEAD con la pestaña principal Informe IN final. No actualizar el informe grupal de otras fases desde la entrega Buyer.
2. Documentar el grano: cada solicitud/negociacion operativa tiene identidad propia; el Mart actual esta agregado. Si pasan a detalle por solicitud, preparar migracion y adaptar consumidores/reporte.
3. Revisar Solicitudes: ya existen fecha_solicitud, fecha_primera_respuesta, fecha_cierre, estado e id_servicio. Verificar su uso antes de agregar columnas redundantes. Registrar respuesta realmente util, resultado y responsable verificables cuando falten.
4. Acordar que evidencia define la conversion a PAYER segun el informe: reserva, pago registrado y pago validado son hechos distintos. Relacionar la evidencia con la solicitud correcta, no solo con la persona.
5. Calcular 14 dias exactos y 15 minutos habiles segun calendario de atencion; definir tratamiento fuera de horario, ausencia de respuesta y cohortes aun no evaluables.
6. Revisar denominador de abandono y cierre: Convertida no representa automaticamente todas las negociaciones terminadas. Conservar estados anteriores y no reconstruir fechas inexistentes.
7. Construir una rutina canonica con transaccion, claves unicas, conciliacion y reintento. Conservar NULL cuando falte evidencia y no promediar promedios de grupos.
8. Adaptar backend/Prisma/rutas solo con migraciones revisadas; generar cliente no modifica la base. No ejecutar db push como sustituto de diseno.

## 5. Evitar dos cargas LEAD incompatibles

Mientras se experimenta con un nuevo hecho, el bloque 2 heredado puede seguir poblando el anterior solo si los destinos son distintos. Antes de integrar, reemplazar o desactivar coordinadamente la seccion LEAD heredada: no dejar dos ETL escribiendo el mismo hecho con granos o formulas diferentes. No cambiar las secciones PAYER/CUSTOMER/TURNED para hacer pasar LEAD.

Compartir dimensiones exige coordinar sus cambios. Los ETL actuales usan el recurso ETL_BUYER_SEMANA9 en NexoSaludDB para serializar cargas que comparten dimensiones. Si se cambia la estrategia de bloqueo, probar concurrencia entre fases; no asumir que una nueva etiqueta de bloqueo coordina con la anterior.

## 6. Aceptacion e integracion

- Dos solicitudes de la misma persona, varias opciones/reservas, ausencia de pago, respuesta fuera de horario, conversion tardia y abandono sin conversion.
- Conciliacion por solicitud y por dimensiones, ademas del total; carga repetida, reclasificacion, rollback y bloqueo.
- Regresion Buyer: conservar medidas/evidencia con origen sin cambios y no duplicar captaciones; no comparar fecha_corte_etl como si fuera dato de negocio inmutable.
- Repetir reportes por mes/historico y revisar CSV/PDF si sus consultas cambian.
- Entregar commit/PR con orden de instalacion, cambios de contrato y resultados realmente ejecutados. Integrar mediante revision del equipo; la publicacion Buyer no integra automaticamente nada en main.

El informe Buyer es la unica actualizacion academica pendiente de Daniel en este cierre. El equipo LEAD actualizara su propia seccion cuando valide su implementacion.

## 7. Preparar la base que LEAD va a utilizar

### 7.1 Instalacion nueva o ya existente

Seguir **una sola ruta** de [Ejecucion SQL Server, secciones 1 y 7](EJECUCION_SQL_SERVER.md). La ruta nueva requiere init_oltp, init_mart, 01_catalogos, bloque 1, 06, 08, bloque 2, 09 y 02, en ese orden. En bases revisadas con 10k ya cargados no repetir los init ni los catalogos. Detener backend durante DDL/carga y conservar una copia de la baseline.

### 7.2 Que aporta realmente el poblamiento

| Entrada V1 para LEAD | Cantidad / significado |
|---|---|
| Buyers / utilizables | 10000 / 8500 adicionales, no total global. |
| Buyer a LEAD | 2550 personas con 2550 solicitudes Abierta y 2550 eventos vinculados; fecha entre 1 y 13 dias mas minutos tras captacion. |
| Siguen en BUYER | 7450; no crearles solicitudes solo para alcanzar 10000 LEAD. |
| Contexto | Captacion con campaña/canal, sedes y servicios declarados o desconocidos segun el caso. IDs resueltos por catalogos. |
| Interacciones | 20000 mensajes sinteticos Buyer. No equivalen automaticamente a evidencia de primera respuesta util de una negociacion. |
| Gastos | 60 registros, S/60000. No son pagos del paciente ni ingresos de PAYER. |
| No incluido | No se generan nuevas opciones, reservas, pagos, atenciones ni seguimientos para esos LEAD. |

Las conversiones se cargan historicamente por conjuntos, no mediante 2550 llamadas al procedimiento operativo. La prueba de conversion en vivo/reintento esta separada. Los nuevos LEAD ofrecen volumen e identidades para comenzar, pero **no cubren por si solos los tres indicadores LEAD**. Las solicitudes no tienen primera respuesta/cierre/reserva simulados; el equipo debe crear casos de su fase con esas evidencias.

### 7.3 Consulta de entrada: conservar IDs reales

Ejecutar despues de 08 y antes de modificar casos. Se esperan 2550 filas V1, sin presuponer valores de IDENTITY:

```sql
USE NexoSaludDB;
SELECT p.id_persona,c.id_captacion,s.id_solicitud,e.id_evento_etapa,
       c.fecha_captacion,s.fecha_solicitud,s.estado,s.id_servicio,
       e.fecha_hora AS fecha_conversion
FROM dbo.Personas p
JOIN dbo.CaptacionesBuyer c ON c.id_persona=p.id_persona
JOIN dbo.EventosEtapa e ON e.id_captacion=c.id_captacion AND e.id_persona=p.id_persona
JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
JOIN dbo.Solicitudes s ON s.id_solicitud=e.id_solicitud AND s.id_persona=p.id_persona
WHERE RIGHT(p.email,25)='@sim-buyer-10k-v1.invalid'
ORDER BY s.id_solicitud;
```

En la base original con 310 solicitudes, la suma global pasa a 2860. Si tambien se cargaron las pruebas de Germain con una solicitud adicional, pasa a 2861. Son referencias condicionadas al escenario, no constantes para programar.

### 7.4 Baseline y casos nuevos

Ejecutar [09](../semana9/simulacion/09_validacion_buyer_10k.sql) y guardar el OK antes de probar LEAD. 09 verifica la V1 inicial, incluidos exactamente 20000 mensajes; al agregar nuevas interacciones o alterar intencionalmente esa cohorte puede dejar de cumplir sus cifras. No borrar operaciones validas para forzar ese OK ni volver a ejecutar 08 como restaurador. Para una regresion exacta conservar copia de la baseline; para pruebas evolutivas documentar deltas y comparar reglas por registro.

Los 2550 LEAD son historicos y tienen ventanas maduras. Para ensayar negociacion actual, generar casos de fase nuevos y marcados, con fechas y disponibilidad coherentes; no mover las fechas de V1 al dia actual. No cambiar fechas/eventos Buyer para hacer madurar el denominador LEAD.

## 8. Orden de implementacion en SQL Server

1. **Definicion:** cerrar grano solicitud, indicadores y evidencia de PAYER con el informe principal. Consultar [recomendaciones LEAD](RECOMENDACIONES_OTRAS_FASES.md#2-lead--responsables-indicados-vigo-y-ventura).
2. **Origen:** migracion aditiva revisada sobre [OLTP](../semana9/init_oltp.sql). Registrar responsable, respuesta util/cierre/evidencia faltantes sin duplicar columnas ya presentes. Crear fixtures propios con varios intentos, conversion, abandono y plazos.
3. **Destino:** migracion Mart segun grano acordado. [init_mart](../semana9/init_mart.sql) muestra el legado; no volver a ejecutarlo para actualizar una tabla.
4. **ETL:** implementar e instalar rutina canonica LEAD. Resolver dimensiones por claves naturales y coordinar bloqueo. Sustituir la seccion heredada segun seccion 5 antes de escribir al mismo destino.
5. **Carga:** cargar primero Buyer si cambio su origen; despues LEAD; despues fases dependientes segun sus contratos. No esperar que la sincronizacion Buyer actual ejecute la nueva rutina LEAD.
6. **Validacion:** conciliar solicitudes/medidas por ID, periodo, sede y servicio; exactitud temporal, denominadores y casos NULL. Probar dos ejecuciones, cambio de estado, eliminaciones segun politica, rollback y concurrencia.
7. **Integracion:** adaptar consultas/reportes cuando cambie el grano. Si 02 usa medidas/grano que reemplazaron, actualizar su seccion LEAD junto al cambio o proveer validacion equivalente explicitamente; no dar por valido un comparador antiguo incompatible.

Los nombres de nuevos archivos LEAD deben numerarse en su README (por ejemplo migracion OLTP, migracion Mart, ETL, validacion y pruebas). Son una estructura propuesta, no scripts existentes que se puedan ejecutar ahora. No incorporar copias divergentes de los init Buyer como segunda fuente oficial.

## 9. Integracion con el sistema

### 9.1 Archivos reales que deben revisar

| Capa | Archivos y funcion |
|---|---|
| Backend operativo | [lead.routes.ts](../../../backend/src/routes/lead.routes.ts): listado, detalle, alternativas, reserva y abandono. [index.ts](../../../backend/src/index.ts) monta /api/lead y el alias /api/leads. |
| Modelo de acceso | [schema.prisma](../../../backend/prisma/schema.prisma): compatibilidad de campos/relaciones con las migraciones. Generar cliente no altera SQL. |
| Acceso frontend | [lead.service.ts](../../../src/modules/lead/services/lead.service.ts) y [useLeadQueries.ts](../../../src/modules/lead/hooks/useLeadQueries.ts): peticiones y refresco de datos. |
| Pantallas | [LeadPage.tsx](../../../src/modules/lead/pages/LeadPage.tsx), [LeadDetailPage.tsx](../../../src/modules/lead/pages/LeadDetailPage.tsx) y [LeadNegotiationPage.tsx](../../../src/modules/lead/pages/LeadNegotiationPage.tsx). |
| Analitica | [report.routes.ts](../../../backend/src/routes/report.routes.ts), [configuracion de medidas](../../../src/modules/reports/config/stages.ts), [ReportsPage.tsx](../../../src/modules/reports/pages/ReportsPage.tsx). |

### 9.2 Compatibilidades pendientes observadas

- El listado actual obtiene personas en LEAD o PAYER y toma Solicitudes[0]. No garantiza una fila por solicitud ni el orden de esa coleccion. Al agregar negociaciones por persona, revisar identidad, seleccion y rutas; no usar id_persona como sustituto universal de id_solicitud.
- La ruta de abandono actual intenta asignar Personas.estado_calidad='Descartado'. El CHECK revisado solo admite Valido, Incompleto, Duplicado y Rechazado. Esa escritura es incompatible. Ademas la solicitud se modifica antes y fuera de una transaccion conjunta: puede quedar un cambio parcial si falla Persona. Resolver el resultado de negociacion en su entidad y con transaccion; no ampliar la calidad Buyer ni eliminar restricciones solo para que pase la ruta.
- No confundir POST /api/reports/sync con operaciones comerciales ni con carga del Mart LEAD. Tener 2550 solicitudes nuevas en OLTP no garantiza que aparezcan en un hecho LEAD aun sin cargar.

Estas observaciones son revision de codigo, no fallos reproducidos en la instancia local durante esta entrega ni cambios ya aplicados. Se documentan para el equipo LEAD; el cierre Buyer valido reportes, no todo el flujo operativo de otras fases.

### 9.3 Prueba minima de extremo a extremo

1. Seguir [arranque SQL y sistema](EJECUCION_SQL_SERVER.md#74-encender-y-comprobar-el-sistema). Primero leer GET /api/lead y detalle de un id_persona obtenido en 7.3; comprobar las solicitudes contra SQL.
2. En una copia, elegir un caso marcado y realizar una sola accion de negocio. Verificar solicitud correcta, fecha, responsable y evento; errores deben revertir la operacion completa. No ejecutar automaticamente negociadores/agentes ni cobranza para demostrar una lectura.
3. Ejecutar el ETL LEAD propio; abrir Reportes > Negociacion con el mismo periodo. Comparar medidas con SQL, no filas del hecho agregado. Probar filtros, NULL, cocientes y promedios ponderados; el problema corregido en Buyer demuestra por que no sumar promedios ni ratios.
4. Exportar PDF/CSV del periodo, repetir sincronizacion y verificar que no se multiplican operaciones. Documentar nuevos endpoints de carga si los crean; no anunciar como disponible una ruta propuesta.
5. Repetir regresion Buyer de costos, eventos y promedio. El promedio V1 de noviembre 2025 es aproximadamente 7,022594 dias; UI/PDF 7,0 y CSV 7,02 por formatos distintos.

## 10. Entrega del equipo LEAD

PR/commit con: orden de scripts nuevos/existentes, contratos modificados, instalacion limpia y migracion realmente probadas, volumen de fixtures propios, consultas de conciliacion, capturas API/UI/exportaciones, pruebas aprobadas y pendientes. Cada responsable de fase conserva su rama; integrar mediante revision, sin sobrescribir Buyer ni trabajo ajeno.
