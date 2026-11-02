# Entrega al equipo LEAD

[Inicio](../README.md) · [Resultados Buyer](CIERRE_BUYER_Y_VALIDACION_LOCAL.md) · [Recomendaciones por fase](RECOMENDACIONES_OTRAS_FASES.md).

## 1. Desde que version partir

El codigo Buyer validado llega hasta `ee29743`; los commits posteriores de entrega consolidan guias, separan legado y ordenan herramientas. Partir del HEAD actual de `analysis/buyer-bases-datos`, no de main ni del refactor antiguo.

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
