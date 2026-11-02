# Proxima actualizacion del informe: solo Buyer

[Inicio](../README.md) · [Resultados comprobados](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

Este documento prepara el trabajo academico posterior. No se ha editado el Google Docs del equipo. La referencia sigue siendo la pestaña principal Informe IN final; la revision inicial uso la copia exportada aportada, no una lectura actualizada en vivo. Verificar la version vigente antes de editar y no trasladar contenido de pestañas antiguas que la contradiga.

## 1. Analisis dimensional

Explicar los dos procesos y granos:

| Hecho | Grano | Medidas y origen |
|---|---|---|
| fact_captacion_buyer | Primera captacion por persona | contacto_registrado, contacto_utilizable, conversion_lead, tiempo_conversion_dia y costo_atribuido_captacion. CaptacionesBuyer/Personas, evento de conversion y costo atribuido de GastosCampana. |
| fact_inversion_campana_buyer | Un registro de gasto por id_gasto | monto_inversion desde GastosCampana. Puede existir sin contactos. Es un hecho transaccional, no un snapshot periodico. |

Tiempo, Fuente/campana y Canal son dimensiones compartidas. Captacion incorpora tambien sede, servicio, tipo de persona y estado del registro. La campana esta representada en Dim_Fuente; no afirmar que existe una Dim_Campana independiente. Impresiones y clics estan reservados en NULL, sin fuente actual y no son medidas disponibles.

La separacion conserva inversion original y costo atribuido con significados distintos. Un reparto documentado y conciliado no es incorrecto por si mismo. No justificar tablas adicionales solo por querer aumentar su numero. No se implemento un hecho de interacciones/agente.

## 2. Indicadores y reportes

- Mantener B1, B2 y B3 del alcance acordado. B1 usa ventana exacta de 14 dias y contactos utilizables; B2 es calidad observada al corte, no snapshot completo inicial.
- B3 es costo atribuido a la cohorte / conversiones de esa cohorte. Sin evidencia completa o sin conversiones, no calculable. Umbrales heredados: verde <=S/50, ambar >S/50 y <=S/100, rojo >S/100. NULL no recibe semaforo verde.
- Reporte 1: periodo de captacion, fuente/canal en filas y sede en columnas; conserva desconocidos y el formato acordado.
- Reporte 2: inversion registrada y CPL por campana/canal. El CPL usa inversion y conversiones agregadas al mismo ambito de reporte; cada subtotal/total se recalcula desde sus componentes. Su filtro mensual usa mes de gasto y mes de captacion; no mes del evento de conversion.
- No llamar CAC al CPL ni sustituir automaticamente B3 por el cociente de inversion total. Reportar la regla temporal y los costos faltantes.

## 3. Evidencias que se pueden incorporar

Usar las capturas finales y los resultados de la guia de cierre. Identificar expresamente el conjunto sintetico: 808 contactos, 682 utilizables, 311 conversiones; dos gastos de prueba por S/150, de los que S/100 se atribuyen y S/50 quedan sin contactos en su campana/mes.

Ejemplo CPL de WhatsApp: octubre S/100 por 1 LEAD; historico S/0.40 por 251 LEADs. No comparar esos resultados sin mencionar el periodo ni presentarlos como rendimiento financiero real de la clinica. Mantener los no calculables como tales.

Describir conversion/reintento, transacciones, origen de eventos, limites temporales, conservacion de centimos, rollback, bloqueo y paridad SQL/API/reportes. Las sumas de otras fases son controles de regresion; no demuestran que todos sus indicadores esten redisenados.

## 4. Lista de edicion posterior

1. Actualizar exclusivamente las secciones Buyer: requerimientos que necesiten precision, cuadro de medidas/dimensiones, granos, indicadores, diagrama y reportes.
2. Incorporar el segundo hecho y reporte con su justificacion; conservar los indicadores existentes segun las reglas anteriores.
3. Sustituir capturas antiguas por las finales, etiquetadas por periodo y como pruebas sinteticas.
4. En anexos, enlazar scripts canonicos y orden de ejecucion. Revisar numeracion de paginas/secciones en la version vigente; no usar numeros fijos de una exportacion antigua.
5. No describir como implementados el agente, un snapshot historico completo de identidad ni la migracion PostgreSQL.
6. No editar secciones LEAD/PAYER/CUSTOMER/TURNED como parte de esta actualizacion Buyer.
