# Trabajo futuro: operacion del sistema y agente Buyer

[Inicio](../README.md) · [Contrato entregado a LEAD](ENTREGA_A_LEAD.md) · [Validacion](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

El agente no esta implementado. La sincronizacion Buyer y sus reportes si estan integrados y comprobados en el alcance documentado. El recorrido de alta/conversion desde todas las rutas de la interfaz no se acredita solo por esas pruebas.

## 1. Integracion operativa antes de IA

Revisar [buyer.routes.ts](../../../backend/src/routes/buyer.routes.ts), [schema.prisma](../../../backend/prisma/schema.prisma) y el contrato de [init_oltp.sql](../semana9/init_oltp.sql). El alta debe persistir persona y CaptacionesBuyer con datos realmente declarados y consentimiento verificable. Una consulta recurrente no crea otra primera captacion.

Integrar la conversion mediante usp_ConvertirBuyerALead con parametros validados. No convertir toda alta web automaticamente a LEAD. Probar duplicados, reintentos, autorizacion revocada, persona en otra fase y errores transaccionales. No usar db push para sustituir una migracion revisada.

La sincronizacion ya usa los procedimientos canonicos desde MartSyncService; reutilizarla despues de confirmar la operacion OLTP. Un fallo del Mart debe poder reintentarse sin repetir el alta/conversion. No copiar el ETL dentro de cada ruta ni cargar las cinco fases por mensaje.

## 2. Alcance del agente a acordar

Validar completitud, sugerir posibles duplicados, clasificar interes/preferencias contra catalogos e identificar origen con evidencia. Ante ambiguedad mantener revision/Buyer. No inferir consentimiento, fabricar sede/campana/gasto ni realizar diagnostico clinico.

Empezar con reglas deterministas y salida estructurada. Si se incorpora un proveedor externo, guardar credenciales en backend, enviar los datos minimos pertinentes y validar formato, rangos e IDs. No ejecutar SQL/instrucciones propuestas por el modelo. Un fallo o salida invalida debe identificarse como revision/fallback, sin exito ficticio.

## 3. Auditoria y aceptacion

Usar DecisionesIA, con referencias a captacion e interaccion de la misma persona. Las FK simples no demuestran por si solas esa correspondencia conjunta. Proponer migracion si faltan proveedor/modelo/version o resultado estructurado; no asumir columnas por aparecer en una rama antigua. Distinguir sugerencia, aprobacion y accion ejecutada. EventosEtapa sigue siendo la evidencia de transicion.

Casos minimos: datos completos, falta/revocacion de autorizacion, intencion ambigua, servicio inexistente, consulta recurrente, conversion simultanea/reintento, timeout y costo desconocido. Demostrar la cadena operativa completa, no solo una respuesta del modelo.

No se requiere ahora un hecho analitico del agente. Solo reconsiderarlo si un reporte aprobado exige analizar interacciones y se define su grano (mensaje, conversacion o atencion).

## 4. PostgreSQL

Es una posible migracion posterior. Conservar reglas y pruebas de paridad; revisar proveedor Prisma, drivers, identidades, funciones temporales, procedimientos, indices y bloqueos. No mezclar ese cambio con el cierre SQL Server ni con el rediseño de otra fase.
