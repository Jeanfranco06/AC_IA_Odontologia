# Plan de Migración Controlada — NexoSaludDB y NexoSalud_Mart

**Entorno de Destino:** Bases de Datos Principales (`NexoSaludDB` y `NexoSalud_Mart`)  
**Fecha:** 12 de noviembre de 2026  
**Estado:** Paquete Preparado y Verificado en Test (`PREPARED_NOT_AUTHORIZED`)  
**Ubicación del Paquete:** `database/customer/deployment/20261112/`

---

## 1. Inventario de Diferencias Detectadas

La inspección en modo solo lectura (`backend/scripts/inspect-principal-readonly.cjs`) sobre las bases principales reveló las siguientes discrepancias respecto a la estructura certificada en Test:

### A. Diferencias en NexoSaludDB (OLTP)
1. **Columnas Faltantes en Tablas Existentes:**
   - `dbo.Atenciones.revision_ficha` (`int`, NOT NULL, default 1).
   - `dbo.BorradoresIA.fecha_transferencia_ficha` (`datetime2`, NULL).
   - `dbo.InteraccionesIA.id_usuario_actor` (`int`, NULL, FK hacia `dbo.Usuarios`).
   - `dbo.SesionesTratamiento.confirmacion_paciente` (`varchar(20)`, NOT NULL, default 'No_Requerida').
   - `dbo.SesionesTratamiento.fecha_confirmacion` (`datetime2`, NULL).
2. **Tablas Faltantes:**
   - `dbo.PoliticasCustomerIA` (Almacén de reglas de validación documental, confirmación y derivación).
   - `dbo.SesionesAccesoIA` (Almacén de revocación de sesiones JWT y control de concurrencia).
   - `dbo.SolicitudesCustomerIA` (Bandeja unificada de programación de sesiones y derivaciones humanas).
3. **Procedimientos Almacenados y Reglas de Negocio:**
   - Se requiere instalar versiones seguras y parametrizadas de:
     - `dbo.usp_ProgramarSesionTratamiento` (Validación transaccional de disponibilidad y prevención de colisiones).
     - `dbo.usp_RegistrarEventoAsistencialSesion` (Registro estricto de eventos asistenciales en tiempo UTC).
     - `dbo.usp_CerrarSesionClinica` (Cierre condicionado a validación documental).
     - `dbo.usp_CerrarTratamientoYTransicionarTurned` (Cierre formal con checklist clínico y transición supervisada).
4. **Restricciones CHECK:**
   - `CK_Tratamientos_Estado`: Homologación de estados UTF-8 (`Contratado`, `Activado`, `En ejecución`, `Suspendido`, `Completado`, `Cancelado`).
   - `CK_Atenciones_Asistencia`: Homologación de valores (`Pendiente`, `Confirmada`, `Asistió`, `No asistió`, `Asiste`, `No asiste`).
   - `CK_InteraccionesIA_NoDiagnostico`: Garantía a nivel de base de datos de que ninguna interacción constituya diagnóstico o prescripción autónoma.

### B. Diferencias en NexoSalud_Mart (Data Mart)
1. **Ampliación Dimensional:**
   - `dbo.Dim_TipoInteraccionIA.CodigoTipoInteraccionIA`: Longitud actual insuficiente (`varchar(30)`). Debe ampliarse a `varchar(60)` para soportar códigos como `REVISION_ALERTA_SEGUIMIENTO_POST_TRATAMIENTO` (44 caracteres).
   - Incorporación de los 12 códigos de evento identificados en las alertas, interacciones y borradores de CUSTOMER.
2. **Procedimiento ETL Conservador:**
   - `dbo.usp_ETL_SincronizarCustomerMart`: El procedimiento anterior incluía cláusulas destructivas (`WHEN NOT MATCHED BY SOURCE THEN DELETE` y `DELETE FROM Fact_AtencionCustomer`). Se reemplaza por la versión conservadora `15_etl_customer_conservador.sql`, que preserva hechos legados y utiliza operadores `MERGE` aditivos.

---

## 2. Paquete de Despliegue Preparado (`manifest.json`)

Los scripts SQL han sido generados por `prepare-principal-deployment.py` y se encuentran inmutables bajo control de hashes SHA-256:

| Orden | Script de Migración | Hash SHA-256 | Propósito Operativo |
|---|---|---|---|
| 00 | `00_respaldo_y_restauracion.sql` | `e668f9facca68735a9f597495602ef335dfd651b2942295c896fab7652af8607` | Plantilla de backup CHECKSUM y verificación de restauración para DBA. |
| 01 | `01_preflight.sql` | `7f222801c637b30d7d9f85758019f91e7ead4d2321422cf5eb715984cca0ad64` | Verificación de solo lectura de restricciones, claves huérfanas y estados. |
| 02 | `02_incremental.sql` | `e178d7d6638c3d3fbcd36755319fdfc9a4b016171834b8625ae2cd35e11d7fb6` | Transacción DDL: crea tablas, añade columnas, instala SPs seguros y dimensiones. |
| 03 | `03_postflight.sql` | `792db35cc953c9b2b92098d62c22daace87dee822c96ffa2c75c0838111cb5f5` | Validación de solo lectura posterior para verificar presencia de objetos. |
| 04 | `04_carga_customer_aprobada.sql` | `494d65960f8c552d13046a43e4b5362945711de5bf10a7f75ccd1901c6b49a07` | Ejecución explícitamente autorizada del ETL conservador sincronizado. |
| 05 | `05_reversion_modulos.sql` | `78d8af2282030291f93c73e5c4029e7b9979c4786460b8057c51460de81f8742` | Rollback aditivo de módulos y procedimientos almacenados sin pérdida de datos. |
| 06 | `06_permisos_cuentas.sql` | `130c5f700c3054735c5603fe32993f4c26c124ee746b879ab9b3d03941b81d7e` | Asignación estricta de permisos de solo lectura al usuario analítico. |
| 15 | `15_etl_customer_conservador.sql` | `21d0068e8bad15373106247f2053cf6e5c27e0e44416239a2abff5e06a896e3b` | Código fuente del ETL conservador libre de sentencias DELETE/TRUNCATE. |

---

## 3. Protocolo de Ejecución en Ventana de Mantenimiento

Para desplegar sobre `NexoSaludDB` y `NexoSalud_Mart`, se debe seguir estrictamente la siguiente secuencia de 6 pasos:

### Paso 1: Notificación y Aislamiento de Tráfico
- Pausar los servicios de ingesta de la aplicación (`PORT=3001`).
- Asegurar que no existan transacciones activas de usuarios.

### Paso 2: Respaldo Completo Verificado
```sql
-- Ejecutar plantilla 00_respaldo_y_restauracion.sql definiendo variables:
BACKUP DATABASE [NexoSaludDB] TO DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH COPY_ONLY, CHECKSUM, COMPRESSION;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH COPY_ONLY, CHECKSUM, COMPRESSION;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH CHECKSUM;
```

### Paso 3: Comprobación Previa (Pre-flight)
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/01_preflight.sql -b
```
*Si este paso arroja error 56501 a 56506, el despliegue se detiene de inmediato sin haber realizado modificaciones.*

### Paso 4: Migración Incremental Transaccional
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/02_incremental.sql -b
```
*Aplica cambios dentro de `BEGIN TRANSACTION ... COMMIT TRANSACTION` con `SET XACT_ABORT ON`.*

### Paso 5: Comprobación Posterior (Post-flight) y Permisos
```bash
sqlcmd -S localhost -d NexoSaludDB -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/03_postflight.sql -b
sqlcmd -S localhost -d NexoSalud_Mart -v BiReader="NexoSaludBIRead" -i database/customer/deployment/20261112/06_permisos_cuentas.sql -b
```

### Paso 6: Carga Sincronizada y Conciliación
```bash
sqlcmd -S localhost -d NexoSalud_Mart -v Mode="APPROVED_MAIN" OltpDatabase="NexoSaludDB" MartDatabase="NexoSalud_Mart" -i database/customer/deployment/20261112/04_carga_customer_aprobada.sql -b
```

---

## 4. Plan de Reversión y Mitigación de Riesgos (Rollback)

1. **Reversión de Procedimientos Almacenados:** Si el aplicativo presenta anomalías tras la migración, se ejecuta `05_reversion_modulos.sql`, que reinstala las firmas anteriores de los módulos sin eliminar columnas ni datos recolectados.
2. **Reversión por Restauración de Copia de Seguridad:** Si se requiere un retroceso integral del estado del motor, el DBA restaurará las copias `_$(ReleaseId).bak` en una ubicación verificada.
3. **Punto de Recuperación (RPO / RTO):**
   - **RPO Objetivo:** 0 minutos (el respaldo previo se toma con el tráfico web pausado).
   - **RTO Objetivo:** Menor a 15 minutos (tiempo estimado de compilación y verificación post-vuelo).
