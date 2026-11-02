# Bases de datos de NexoSalud

El paquete vigente de esta rama es [buyer_revision](buyer_revision/README.md): incluye las estructuras completas de Semana 9, Buyer revisado, las otras fases con reglas heredadas y la inversion publicitaria.

- Instalacion y actualizacion: [ejecucion SQL Server](buyer_revision/docs/EJECUCION_SQL_SERVER.md).
- Resultados y pruebas: [validacion Buyer](buyer_revision/docs/CIERRE_BUYER_Y_VALIDACION_LOCAL.md).
- Continuacion por el equipo LEAD: [entrega a LEAD](buyer_revision/docs/ENTREGA_A_LEAD.md).
- [legacy_pre_buyer](legacy_pre_buyer/README.md) contiene los cuatro SQL del esquema anterior, conservados como referencia. No mezclarlos con el paquete vigente.

El CLI `npm run etl:buyer`, desde backend, y POST `/api/reports/sync` invocan los procedimientos Buyer instalados. No recargan LEAD/PAYER/CUSTOMER/TURNED: sus cargas heredadas permanecen en el bloque 2 del ETL de Semana 9.
