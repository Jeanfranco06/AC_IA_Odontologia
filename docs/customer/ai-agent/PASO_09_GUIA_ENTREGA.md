# PASO 9 — GUÍA DE ENTREGA, CONFIGURACIÓN Y EJECUCIÓN DEL SISTEMA
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Instrucciones de Puesta en Marcha y Verificación  
**Fecha:** 2026-11-11  

---

## 1. REQUISITOS DEL SISTEMA

- **Sistema Operativo:** Windows 10/11, macOS o Linux.
- **Node.js:** Versión 20.x LTS o superior.
- **Base de Datos:** Microsoft SQL Server 2019/2022 o Azure SQL Database.
- **Gestor de Paquetes:** npm v10+.

---

## 2. INSTALACIÓN Y CONFIGURACIÓN INICIAL

### 2.1. Clonación del Repositorio y Rama
```bash
git clone <URL_REPOSITORIO>
cd AC_IA_Odontologia
git checkout customer
```

### 2.2. Instalación de Dependencias
```bash
# Instalar dependencias del Backend
npm install --prefix backend

# Instalar dependencias del Frontend
npm install --prefix frontend
```

### 2.3. Configuración de Variables de Entorno
1. En la carpeta `backend`, copie el archivo de ejemplo:
   ```bash
   cp backend/.env.staging.example backend/.env.staging.local
   ```
2. Configure sus cadenas de conexión y credenciales de prueba en `backend/.env.staging.local`:
   - `DATABASE_URL`: Cadena SQL Server para `NexoSaludDB_Test`.
   - `DATA_MART_DATABASE_URL`: Cadena SQL Server para `NexoSalud_Mart_Test`.
   - `GEMINI_API_KEY`: Clave API de Google AI Studio (o simulador de pruebas).
   - `SESSION_SECRET`: Secreto criptográfico para firma HMAC de tokens.

---

## 3. INICIALIZACIÓN DE BASES DE DATOS Y DATOS SINTÉTICOS

1. **Generación de Clientes Prisma:**
   ```bash
   npx prisma generate --schema=backend/prisma/schema.prisma
   ```
2. **Poblado de Datos Sintéticos y Validaciones:**
   ```powershell
   sqlcmd -S . -E -C -i backend/scripts/seed-customer-ai-test-data.sql
   ```
3. **Sincronización del Data Mart (ETL):**
   ```sql
   USE [NexoSalud_Mart_Test];
   EXEC dbo.usp_ETL_SincronizarCustomerMart;
   ```

---

## 4. EJECUCIÓN DE PRUEBAS DE VERIFICACIÓN

Para comprobar que todos los componentes se encuentran en perfecto estado de funcionamiento:
```powershell
# Ejecutar todas las suites de prueba en backend (180 tests)
npm test --prefix backend

# Ejecutar todas las suites de prueba en frontend (49 tests)
npm test --prefix frontend
```

---

## 5. PUESTA EN MARCHA DE LOS SERVICIOS

### Iniciar Backend en Modo Desarrollo / Staging:
```bash
npm run dev --prefix backend
# El servidor iniciará en http://localhost:3001
# Endpoints de verificación:
#   http://localhost:3001/health/live
#   http://localhost:3001/health/ready
#   http://localhost:3001/metrics
```

### Iniciar Frontend React:
```bash
npm run dev --prefix frontend
# La aplicación abrirá en http://localhost:5173
```

### Acceso a las Interfaces de Usuario:
- **Portal Paciente:** `http://localhost:5173/portal/customer/patient`
- **Workspace Clínico Odontológico:** `http://localhost:5173/staff/customer/ai-workspace`
- **Login Staff / Recepción:** `http://localhost:5173/staff/login`
