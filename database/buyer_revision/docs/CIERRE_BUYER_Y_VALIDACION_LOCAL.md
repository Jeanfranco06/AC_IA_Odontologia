# Cierre y evidencia de validacion Buyer

**Cierre revisado:** 2 de noviembre de 2026. [Inicio](../README.md) · [Instalacion](EJECUCION_SQL_SERVER.md) · [Entrega a LEAD](ENTREGA_A_LEAD.md).

## 1. Estado de la entrega

La ronda acordada de validacion Buyer queda cerrada sobre el conjunto sintetico y las evidencias de la instancia local de Daniel. El asistente reviso capturas, videos y el CSV exportado; no se conecto directamente a esa instancia. Las pruebas automaticas y compilaciones se ejecutaron en el entorno de desarrollo. Esto no acredita produccion, todas las rutas operativas del sistema ni todos los KPI de otras fases.

## 2. Resultados observados

| Comprobacion | Evidencia observada |
|---|---|
| Base inicial | 805 contactos, 680 utilizables y 310 conversiones en origen y Mart. |
| Casos operativos agregados | 808 contactos, 682 utilizables y 311 conversiones; 805 historicos observados y 3 registros directos. |
| Trazabilidad y duplicados | Consultas de discrepancias mostradas sin filas; reintento devuelve el mismo evento y solicitud. |
| Otras fases: conciliacion basica | 311 solicitudes tras recarga; 124 pagos, 110 validados, 219 citas, 80 seguimientos; S/19100 validados. Coincidir totales no certifica todas sus reglas. |
| Gastos de prueba | Dos gastos, S/150, en OLTP y hecho de inversion. S/100 atribuidos; S/50 sin contactos en su campana/mes. |
| Limites y centimos | Casos de 14 dias esperados/obtenidos coincidentes; reparto 34/33/33 centimos. |
| Rollback | Fallo provocado tras INSERT del hecho, estado anterior conservado y trigger de prueba revertido. |
| Concurrencia ETL | Bloqueo adquirido en A; errores 51200 y 51500 en B; liberacion deja @@TRANCOUNT=0; recarga posterior correcta. |
| API | /api/ping conectado; /api/reports/status online; dos POST de sincronizacion exitosos conservan medidas. |
| Captacion en interfaz | 808 historicos; 3 en octubre; 311 conversiones historicas. |
| CPL | WhatsApp octubre S/100 = 100/1; historico S/0.40 = 100/251. |
| Costo desconocido corregido | Rayas en grupos y consolidados con evidencia incompleta; importes conocidos conservados. |
| PDF | Exportacion de CPL historico coherente con matriz y periodo. |
| CSV | Archivo nexosalud-embudo-captacion-2026-10.csv: octubre de 2026, seis columnas, CPL 100 y resultados no calculables vacios. |

El CSV usa comas. Si Excel muestra una sola columna, importar desde Datos > Desde texto/CSV con delimitador Coma; no es un defecto de las cifras exportadas.

## 3. Reglas que explican los resultados

- B1: contactos utilizables convertidos mediante evento dentro de 14 dias exactos, dividido entre utilizables de la cohorte. El control de cohortes inmaduras no es un cuarto KPI.
- B2: calidad y consentimiento de CaptacionesBuyer y datos basicos actuales de Personas. No es un snapshot completo e inmutable de identidad inicial. La revocacion actual bloquea la conversion operativa.
- B3: costo atribuido a la cohorte / conversiones de esa cohorte. NULL si falta evidencia de costo o el denominador es cero.
- CPL del reporte 2: inversion registrada / LEADs de la campana y canal; mes de gasto y mes de captacion. No mide CAC ni reemplaza automaticamente B3. Recalcular cada subtotal/total con sus componentes, sin sumar ratios.
- Ausencia de evidencia no equivale a cero. Los resultados monetarios incompletos y consolidados afectados quedan no calculables. Los gastos sin contactos permanecen en el hecho de inversion.
- Los datos de demostracion no son evidencia financiera real de la clinica. Las 806 captaciones sin sede/servicio verificable siguen visibles como desconocidas.

## 4. Repetir las pruebas cuando cambie una fase

1. Instalar/actualizar segun la guia de ejecucion; cargar primero Buyer y luego las fases modificadas.
2. Ejecutar [02_validacion.sql](../semana9/02_validacion.sql) y [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql). Con nuevos datos comparar origen/destino; no forzar 808 como constante de negocio.
3. [04_pruebas_reglas_buyer.sql](../semana9/pruebas/04_pruebas_reglas_buyer.sql): limites y centimos locales.
4. [05_pruebas_operativas_germain.sql](../semana9/pruebas/05_pruebas_operativas_germain.sql): conversion, reintento, rechazo e interacciones; deja casos sinteticos. Los IDs de catalogo corresponden al conjunto original, comprobarlos si se cambia ese conjunto.
5. [06_pruebas_confiabilidad_inversion.sql](../semana9/pruebas/06_pruebas_confiabilidad_inversion.sql): fecha nueva, campana sin contactos, cero explicito, NULL, repeticion y conciliacion.
6. [07_prueba_rollback_buyer.sql](../semana9/pruebas/07_prueba_rollback_buyer.sql): fallo controlado; solo en copia aislada.
7. Concurrencia en dos ventanas SSMS: A adquiere un applock exclusivo, recurso ETL_BUYER_SEMANA9, propietario Transaction en NexoSaludDB y deja BEGIN TRANSACTION abierto. B ejecuta cada procedimiento de sincronizacion Buyer por separado y debe rechazar tras el timeout. A ejecuta ROLLBACK, luego B carga normalmente. No dejar transacciones abiertas.
8. Dos POST de sincronizacion y consulta de estado; revisar filtros historico/mes, costos NULL, CPL y exportaciones. No iniciar cobranza automatica durante estas pruebas: DUNNING_ENABLED=false.

Desde raiz: `npm test` y `npm run build`. Desde backend: `npm run prisma:generate` y `npm run build`. La ultima revision de codigo paso **27 tests** y ambas compilaciones en sus revisiones correspondientes. La reorganizacion documental y del CLI paso nuevamente 27 tests, compilaciones frontend/backend y 66 enlaces verificados. Los mocks de coordinacion del servicio no reemplazan la concurrencia SQL real ya aportada por Daniel.

## 5. Limites que siguen vigentes

El agente no esta implementado. Las rutas de alta/conversion del sistema deben integrar explicitamente CaptacionesBuyer y usp_ConvertirBuyerALead antes de atribuirles el mismo contrato probado por SQL; las pruebas de reportes no acreditan ese recorrido completo. La migracion desde todo esquema antiguo y una futura migracion a PostgreSQL requieren validacion propia. El informe queda pendiente de actualizar solo en Buyer.
