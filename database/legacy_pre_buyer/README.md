# SQL anteriores a la revision Buyer

Estos cuatro archivos pertenecen al modelo anterior del sistema. Se conservan como referencia para comparar estructuras y recuperar comportamiento previo; no son duplicados intercambiables con Semana 9.

No usarlos para instalar, migrar o poblar las bases revisadas. El unico paquete activo esta en [buyer_revision](../buyer_revision/README.md). Ningun comando de ETL activo de esta entrega apunta a esta carpeta.

La suite `backend/src/scripts/test-certification-suite.ts` se retiro porque utiliza nombres de medidas anteriores y modifica pagos con identificadores fijos. Su version completa sigue disponible en el historial de `ee29743`. Las pruebas actuales se describen en la guia de validacion del paquete activo; no se afirma una certificacion automatica de las cinco fases.
