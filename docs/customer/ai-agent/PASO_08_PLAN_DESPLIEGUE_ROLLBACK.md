# PASO 8 — PLAN DE DESPLIEGUE CONTROLADO, VERIFICACIÓN Y PROCEDIMIENTOS DE ROLLBACK
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Plan de Despliegue y Recuperación Operativa  
**Entorno de Aplicación:** Preproducción / Staging (`NexoSaludDB_Test`, `NexoSalud_Mart_Test`)  
**Fecha:** 2026-11-11  
**Versión:** 1.0.0-staging  

---

## 1. OBJETIVO Y ALCANCE

Este documento define la metodología, secuencia de pasos, validaciones y planes de contingencia requeridos para desplegar de manera reproducible el Agente Inteligente CUSTOMER en el entorno de preproducción de NexoSalud, asegurando la no afectación de módulos previos (BUYER, LEAD, PAYER) y garantizando la recuperación instantánea ante fallas críticas.

---

## 2. ARQUITECTURA DEL ENTORNO DE STAGING

El entorno de staging reproduce fielmente la topología de producción bajo un estricto aislamiento físico y lógico:

```
[ FRONTEND REACT + VITE ]  --->  [ BACKEND NODE.JS + EXPRESS ]  --->  [ SQL SERVER 2022 ]
   - Portal Paciente                 - Orquestador Gemini                - NexoSaludDB_Staging (OLTP)
   - Workspace Staff                 - Lexical BM25 RAG                  - NexoSalud_Mart_Staging (Data Mart)
   - Auth SessionStorage             - Health & Metrics Endpoints        - CHECK Constraints Anti-Diagnóstico
```

- **Aislamiento de Datos:** Utiliza exclusivamente esquemas de prueba/staging (`NexoSaludDB_Test` / `NexoSalud_Mart_Test`), garantizando que ninguna consulta o mutación interactúe con las bases productivas.
- **Seguridad de Credenciales:** Prohibición absoluta de credenciales en texto claro en repositorios. Las contraseñas de staging son rotadas y cargadas dinámicamente mediante variables de entorno del sistema (`backend/.env.staging.local` o gestor de secretos).

---

## 3. PROCEDIMIENTO DE DESPLIEGUE PASO A PASO

El despliegue en Staging se encuentra automatizado a través del script [`deploy-staging.ps1`](file:///d:/Proyects/AC_IA_Odontologia/backend/scripts/deploy-staging.ps1) y comprende los siguientes pasos mandatorios:

### Paso 1: Verificación de Prerrequisitos y Secretos
- Comprobación de existencia del archivo de entorno protegido.
- Verificación de variables requeridas: `DATABASE_URL`, `DATA_MART_DATABASE_URL`, `SESSION_SECRET`, `GEMINI_API_KEY`.
- Verificación de conectividad a la instancia de SQL Server mediante autenticación integrada o credenciales de staging autorizadas.

### Paso 2: Compilación y Verificación de Tipos (Backend)
- Ejecución de `npm run build --prefix backend` (`tsc`).
- Garantiza que el código TypeScript compile sin errores de tipado, dependencias circulares o contratos rotos.

### Paso 3: Compilación y Empaquetado de Activos Estáticos (Frontend)
- Ejecución de `npm run build --prefix frontend` (`tsc && vite build`).
- Generación de artefactos optimizados en `frontend/dist/`.
- Validación de que los bundles cumplan con las restricciones de empaquetado de producción.

### Paso 4: Inicialización y Migraciones de Base de Datos
- Verificación del estado de sincronización de Prisma ORM:
  ```bash
  npx prisma migrate status --schema=backend/prisma/schema.prisma
  ```
- Comprobación de existencia de las restricciones de integridad clínica:
  - `CK_InteraccionesIA_NoDiagnostico`
  - `CK_BorradoresIA_NoDiagnostico`
  - Tablas operativas: `InteraccionesIA`, `BorradoresIA`, `AlertasIA`, `SolicitudesReprogramacionIA`.

### Paso 5: Indexación y Carga de Conocimiento RAG
- Creación y verificación del directorio persistente `backend/storage/rag/`.
- Carga de documentos institucionales autorizados (Políticas de Citas, Horarios, Higiene Oral, etc.).
- Verificación del índice lexical BM25 en memoria/disco.

### Paso 6: Verificación de Health Checks y Humo
- Validación de los endpoints de observabilidad técnica:
  - `GET /health/live` -> HTTP 200 `{"status": "ALIVE"}`
  - `GET /health/ready` -> HTTP 200 `{"status": "READY", "checks": {"database": "OK", "dataMart": "OK", "ragIndex": "OK"}}`
  - `GET /metrics` -> HTTP 200 con telemetría operativa.

---

## 4. PLAN DE ROLLBACK Y CONTINGENCIA

Si durante o posterior al despliegue se detecta cualquiera de las siguientes condiciones de fallo crítico, se declarará el estado de Rollback Inmediato:
1. Fallo en el endpoint `GET /health/ready` por desconexión de base de datos superior a 30 segundos.
2. Fuga o discrepancia dimensional en Data Mart (`Delta > 0`).
3. Alteración involuntaria de registros financieros de `PAYER`.
4. Incidente de seguridad o denegación de servicio no controlada.

### Procedimiento de Rollback Operativo

El procedimiento de respaldo y restauración rápida se encuentra implementado en [`backup-restore-test.ps1`](file:///d:/Proyects/AC_IA_Odontologia/backend/scripts/backup-restore-test.ps1):

1. **Aislamiento de Tráfico:**  
   Detener temporalmente el balanceador o servicio Node.js en staging:
   ```powershell
   Stop-Process -Name node -Force
   ```
2. **Restauración de Base de Datos Transaccional:**  
   Ejecutar la restauración del último backup íntegro verificado:
   ```sql
   ALTER DATABASE [NexoSaludDB_Test] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
   RESTORE DATABASE [NexoSaludDB_Test] FROM DISK = N'D:\Backups\NexoSalud_Staging\NexoSaludDB_Test_PreDeploy.bak' WITH REPLACE, RECOVERY;
   ALTER DATABASE [NexoSaludDB_Test] SET MULTI_USER;
   ```
3. **Restauración de Versión de Código:**  
   Regresar la rama `customer` al commit estable previo verificado mediante git checkout/reset.
4. **Reinicio de Servicios y Verificación:**  
   Reiniciar servicios y constatar HTTP 200 en `/health/live` y `/health/ready`.
