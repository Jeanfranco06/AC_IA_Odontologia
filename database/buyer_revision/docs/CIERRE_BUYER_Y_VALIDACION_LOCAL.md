# Cierre de los bloques 2, 3 y 4 de Buyer

Rama compartida: `analysis/buyer-bases-datos`. Estas mejoras no implementan el agente ni redisenan las otras fases.

## 1. Reglas vigentes y cambios

- **B1:** contactos utilizables convertidos mediante evento BUYER a LEAD dentro de 14 dias exactos, dividido entre contactos utilizables de la cohorte. No contar limites con DATEDIFF(DAY) ni sustituir eventos por existencia de solicitud.
- **B2:** calidad y consentimiento almacenados en CaptacionesBuyer y datos basicos actuales de Personas, tal como consulta la vista. Es calidad observada al corte, no un snapshot completo e inmutable de identidad/contacto inicial. No se fabrican nombres/telefonos historicos. Conservar este alcance en la explicacion; un snapshot completo requeriria nueva captura de esos atributos y migracion explicita. La revocacion actual bloquea operativamente nuevas conversiones.
- **B3 del informe original:** costo atribuido a la cohorte / conversiones de esa cohorte, con NULL cuando falta evidencia de costo. Sigue en [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql). No se sustituye automaticamente su definicion por crear otro hecho.
- **Reporte 2 / CPL de campana:** inversion registrada / LEADs de la campana y canal. En el filtro mensual se usa mes de gasto y mes de captacion de los contactos; no mes del evento de conversion. El historico incorpora todos los periodos. No es CAC ni un nuevo indicador semaforico B3 aprobado.
- Cada celda, fila, subtotal y total CPL se obtiene dividiendo sumas de sus componentes. El gasto de campanas sin conversiones participa en el total; su CPL individual es NULL. Si una campana del resultado no tiene evidencia de gasto, sus resultados monetarios y los consolidados afectados se muestran no calculables. Un gasto explicito cero con LEADs produce CPL cero.
- La API conserva NULL, la tabla y tarjeta muestran una raya, CSV exporta celda vacia y PDF muestra una raya. Los ratios no tienen participacion porcentual ni se suman.
- [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql), **bloque 1**, instala `NexoSaludDB.dbo.usp_SincronizarCaptacionBuyer` y lo ejecuta. Su cuerpo es el ETL canonico anterior, con dimensiones, eventos, corte y atribucion de centimos; se elimina la variante duplicada del backend y de las pruebas de Germain.
- El backend ejecuta ambos procedimientos Buyer en una transaccion exterior. Solo registra exito al terminar; los errores se propagan. Solicitudes simultaneas de carga dentro del mismo proceso comparten la operacion en curso. Los bloqueos SQL coordinan sesiones independientes; esa concurrencia requiere validacion real en SQL Server.
- `syncAll` conserva su nombre por compatibilidad, pero carga exclusivamente los dos hechos Buyer. Las otras fases usan el bloque 2 del ETL; la API no certifica ni recarga sus hechos.

## 2. Instalar en las bases revisadas existentes

No eliminar bases ni repetir init_oltp/init_mart/catalogos. Usar copia de pruebas y detener backend durante la instalacion.

1. Actualizar la rama local sin descartar trabajo propio.
2. En SSMS abrir [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) y ejecutar **solo el bloque 1 completo**, incluidos CREATE OR ALTER PROCEDURE, GO y EXEC final. No seleccionar solo el interior del procedimiento.
3. Ejecutar [06_segunda_tabla_hecho_inversion_buyer.sql](../semana9/06_segunda_tabla_hecho_inversion_buyer.sql). No introduce gastos simulados.
4. Ejecutar [02_validacion.sql](../semana9/02_validacion.sql) y [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql). El 02 incluye comprobaciones de otras fases: si hay solicitudes nuevas sin recargar esas fases, el responsable debe ejecutar el bloque 2 antes de interpretar su conciliacion. Una diferencia por desfase de cargas no demuestra por si sola un error de formula.
5. Ejecutar [06_pruebas_confiabilidad_inversion.sql](../semana9/pruebas/06_pruebas_confiabilidad_inversion.sql), con reversion, y [07_prueba_rollback_buyer.sql](../semana9/pruebas/07_prueba_rollback_buyer.sql), que provoca un fallo controlado y comprueba conservacion del hecho. Solo en copia aislada de pruebas.
6. Si se desea verificar el flujo operativo completo, ejecutar [05_pruebas_operativas_germain.sql](../semana9/05_pruebas_operativas_germain.sql). Deja datos sinteticos identificados; usa el procedimiento canonico y no exige conteos globales fijos. Recargar inversion y, si corresponde, otras fases tras crear nuevas solicitudes.
7. Iniciar backend, sincronizar y revisar reportes de captacion, inversion y CPL con historico y mes especifico. Ante error de procedimiento inexistente, revisar pasos 2 y 3, no recrear las bases.

Para instalar desde cero siguen vigentes las instrucciones de [EJECUCION_SQL_SERVER.md](EJECUCION_SQL_SERVER.md); despues del ETL base ejecutar el 06. Si se usa una cuenta SQL restringida, debe tener los permisos necesarios para ejecutar procedimientos y consultar/escribir entre ambas bases; no se conceden permisos automaticamente.

## 3. Comprobacion de concurrencia en dos ventanas SSMS

Solo en copia de pruebas, sin backend. En ventana A:

```sql
USE NexoSaludDB;
BEGIN TRANSACTION;
DECLARE @r INT;
EXEC @r=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
    @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
SELECT @r AS resultado_bloqueo;
-- Mantener abierta esta transaccion hasta probar la ventana B.
```

En B ejecutar `EXEC NexoSaludDB.dbo.usp_SincronizarCaptacionBuyer;`: debe rechazar por bloqueo, sin borrar el hecho. Volver a A y ejecutar `ROLLBACK TRANSACTION;`. Repetir B: debe cargar normalmente. Comprobar el 02. Cerrar la transaccion A incluso si la prueba se interrumpe.

## 4. Comprobaciones sin SQL Server

Desde raiz: `npm ci`, `npm test`, `npm run build`. Para backend: `cd backend`, `npm ci`, `npm run prisma:generate`, `npm run build`. Generar Prisma no migra ni modifica la base.

La suite incluye ratios ponderados, gasto sin LEADs, costo ausente frente a cero, valores desconocidos, formato NULL y coordinacion/error/reintento del servicio mediante mocks. Los mocks no prueban transacciones SQL reales.

## 5. Estado y limites de entrega

Validado durante esta entrega: **23 pruebas automaticas aprobadas**, compilacion frontend (TypeScript y Vite) y backend (TypeScript), analisis sintactico T-SQL de los archivos modificados, enlaces Markdown y conservacion exacta del bloque ETL de las otras fases. Vite conserva una advertencia de tamano del bundle; no impide compilar.

El codigo de estos bloques queda preparado para aplicar. Registrar el resultado real de los pasos de SQL Server antes de afirmar que todos los criterios estan certificados. Pendiente en el entorno local del equipo: instalacion de procedimientos, conciliaciones, rollback, concurrencia entre sesiones y recorrido de API/interfaz contra sus datos.

Los importes introducidos por semillas anteriores son sinteticos mientras no exista respaldo de negocio. No presentarlos como facturacion real ni atribuir semaforos B3 al CPL descriptivo nuevo. Tampoco se certifica la semantica de las otras fases solo porque sus sumas coincidan.

Para LEAD/PAYER/CUSTOMER/TURNED: [recomendaciones](RECOMENDACIONES_OTRAS_FASES.md) y apartado 7 de [entrega de Germain](ENTREGA_GERMAIN_AVANCE.md). Sus equipos pueden avanzar desde esta rama sin esperar la implementacion del agente.

## 6. Configuracion local del backend

Prisma requiere **SQLSERVER_URL**, como define `backend/prisma/schema.prisma`. Copiar `backend/.env.example` a `backend/.env` solo si este ultimo no existe; si ya existe, incorporar las variables faltantes sin borrar las demas. El ejemplo usa autenticacion integrada de Windows contra localhost:1433 y ODBC Driver 17. Ajustar host/puerto/driver a la instalacion local; una conexion SSMS por memoria compartida no demuestra que TCP este disponible para Prisma.

Para pruebas Buyer mantener `DUNNING_ENABLED=false`: desactiva el ciclo automatico inicial y periodico de cobranza, que puede cancelar reservas, liberar disponibilidad y enviar avisos. Sin configurar esta variable se conserva el comportamiento previo. No modifica los procedimientos Buyer ni las reglas manuales de PAYER. Tras editar .env, reiniciar el servidor con Ctrl+C y `npm run dev`. No subir .env al repositorio.

Con el servidor activo comprobar primero `/api/ping` (conexion Prisma OLTP), luego `/api/reports/status` (conexion Mart) y finalmente POST `/api/reports/sync`. Este ajuste paso 25 pruebas automaticas y compilacion backend; la conexion a la instancia Windows del equipo debe comprobarse localmente.
