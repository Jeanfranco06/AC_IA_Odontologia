# PASO 1 — INFRAESTRUCTURA Y CAPA DE PERSISTENCIA DEL AGENTE INTELIGENTE CUSTOMER

**Proyecto:** NexoSalud — Agente Inteligente de Atención y Seguimiento Odontológico  
**Fase:** CUSTOMER  
**Fecha:** 2026-11-10  
**Autor:** Arquitecto de Software Senior  

---

## A. Qué existía inicialmente

Al comenzar la auditoría del proyecto en la rama `customer` (commit inicial `273a0a6`), se identificó:

1. **Stack Tecnológico Real:**
   - Backend en Node.js + Express con TypeScript (`tsx`, `ts-node`).
   - Prisma ORM (`v5.22.0`).
   - Base de Datos Transaccional OLTP en Microsoft SQL Server (`NexoSaludDB`).
   - Base de Datos Dimensional Data Mart en SQL Server (`NexoSalud_Mart`).
   - Motor de pruebas unitarias/integración configurado con `vitest`.

2. **Entidades Previas en SQL Server (`NexoSaludDB`):**
   - Dominio Base y Comercial: `Personas` (805 registros), `Usuarios`, `Roles`, `Canales`, `Fuentes`, `Servicios`, `Tarifas`, `Profesionales`, `Sedes`, `Disponibilidad`.
   - Fase LEAD: `Solicitudes`, `Opciones`, `PropuestasEconomicasLead`, `PromocionesLead`, etc.
   - Fase PAYER: `Reservas` (124 registros), `Pagos` (124 registros).
   - Estructuras previas de IA: `DecisionesIA` (utilizada en fases tempranas como bitácora de reglas duras).
   - Entidad `Atenciones` (219 registros): existía originalmente orientada a citas individuales 1:1, ampliada recientemente con campos clínicos (`fecha_inicio`, `fecha_fin`, `motivo_consulta`, `evaluacion`, etc.).

---

## B. Qué problemas se detectaron

Durante la verificación estricta de base de datos y esquemas se identificaron los siguientes hallazgos:

1. **Desalineación entre scripts de migración y la instancia activa de `NexoSaludDB`:**
   - La tabla `dbo.TratamientosContratados` y las entidades multisesión (`PlanTratamiento`, `SesionesTratamiento`, `ValidacionesFicha`, `IndicacionesPostatencion`) estaban definidas en los scripts DDL de `database/customer/` pero aún no habían sido aplicadas de forma definitiva en la base de datos local `NexoSaludDB`.
2. **Conflicto de codificación UTF-8 en validaciones CHECK:**
   - La restricción `CK_Atenciones_Asistencia` fallaba al ejecutarse con `sqlcmd` predeterminado debido a caracteres acentuados (`'Asistió'`, `'No asistió'`). Se requirió ejecución con code page UTF-8 (`-f 65001`).
3. **Ausencia de variables de correlación y trazabilidad en el modelo preliminar de IA:**
   - `InteraccionesIA` no disponía de una clave de correlación (`id_correlacion`) para trazabilidad de llamadas asíncronas con el backend y clientes externos.
   - `AlertasIA` y `BorradoresIA` carecían de clave foránea explícita hacia `InteraccionesIA(id_interaccion_ia)` (`id_interaccion_origen`), lo cual impedía trazar qué interacción originó una alerta o borrador.
4. **Falta del archivo `backend/.env` y `node_modules`:**
   - El entorno local requería la configuración de `.env` desde `.env.example` y la instalación de dependencias vía `npm install` para que Prisma CLI y Vitest ejecutaran sin errores.

---

## C. Qué se implementó

### 1. Migración SQL Aditiva y Prisma
- **Archivo de migración:** `backend/prisma/migrations/20261110161000_customer_ai_persistence/migration.sql`.
- **Estructuras consolidadas en `NexoSaludDB`:**
  - `dbo.InteraccionesIA`:
    - PK `id_interaccion_ia` IDENTITY.
    - FKs a `dbo.Personas`, `dbo.TratamientosContratados`, `dbo.SesionesTratamiento`, `dbo.Atenciones`, `dbo.Profesionales`, `dbo.Usuarios`.
    - Clave `id_correlacion VARCHAR(64)` para trazabilidad unívoca de turnos y llamadas del agente.
    - Restricción `CK_InteraccionesIA_NoDiagnostico`: garantiza a nivel de motor de BD que `es_diagnostico_o_prescripcion = 0`.
    - Restricción `CK_InteraccionesIA_Actor`: actor orientado en `('PACIENTE', 'ODONTOLOGO')`.
  - `dbo.AlertasIA`:
    - PK `id_alerta_ia` IDENTITY.
    - FK `id_interaccion_origen` referenciando `dbo.InteraccionesIA(id_interaccion_ia)`.
    - FKs a `dbo.Personas`, `dbo.TratamientosContratados`, `dbo.SesionesTratamiento`, `dbo.Atenciones`, `dbo.Profesionales`, `dbo.Usuarios`.
    - Restricción `CK_AlertasIA_EvidenciaAtencion`: una alerta no puede marcarse como `Atendida` o `Descartada_Justificada` sin evidencia de revisión (`id_profesional_revisor` o `id_usuario_revisor`) y `fecha_atencion_alerta`.
    - Severidad tipificada: `'Baja'`, `'Media'`, `'Alta'`, `'Crítica'`.
  - `dbo.BorradoresIA`:
    - PK `id_borrador_ia` IDENTITY.
    - FK `id_interaccion_origen` referenciando `dbo.InteraccionesIA(id_interaccion_ia)`.
    - Campos de versionado: `id_borrador_raiz INT`, `version_borrador INT`, `es_version_actual BIT`.
    - Restricción `CK_BorradoresIA_EvidenciaAprobacion`: ningún borrador puede transicionar a `'Aprobado'` o `'Corregido_Y_Aprobado'` sin un odontólogo colegiado activo (`id_profesional_aprobador`) y `fecha_aprobacion`.
    - Regla obligatoria: un borrador generado **no** equivale a una indicación clínica oficialmente emitida (`IndicacionesPostatencion`).

### 2. Actualización de Prisma ORM
- Esquema actualizado con `prisma db pull` incorporando los modelos `InteraccionesIA`, `AlertasIA` y `BorradoresIA` junto con sus relaciones a `Personas`, `Profesionales`, `TratamientosContratados`, `SesionesTratamiento` y `Atenciones`.
- Regeneración exitosa de `@prisma/client` (`npx prisma generate`).

### 3. Servicio de Persistencia Autorizada
- Implementación en `backend/src/services/customerAiPersistenceService.ts`:
  - `registrarInteraccion()`: valida existencia de la persona, verifica que el tratamiento y la sesión pertenezcan exclusivamente al paciente, e inserta la auditoría de interacción sin almacenar historiales sensibles.
  - `registrarAlerta()`: registra alertas tipificadas asociadas opcionalmente a interacciones origen.
  - `atenderAlerta()`: valida que la alerta pueda pasar por revisión intermedia (`En_Revision`) sin forzar resolución, y exige profesional colegiado o usuario al resolverla.
  - `registrarBorrador()`: maneja el árbol de versiones (`id_borrador_raiz`), garantizando que las nuevas revisiones marquen las anteriores como no actuales.
  - `aprobarBorrador()`: exige obligatoriamente un odontólogo activo y colegiado. Rechaza aprobaciones de pacientes o usuarios no médicos.
  - `consultarHistorialPacienteAutorizado()`: valida que un paciente solo pueda consultar su propio expediente, bloqueando intentos de acceso a terceros.
  - `obtenerMetricasIA()`: computa de forma exacta las 5 medidas requeridas:
    1. `interacciones_registradas`: conteo total de interacciones significativas.
    2. `alertas_generadas`: conteo total de alertas creadas.
    3. `alertas_atendidas`: conteo de alertas en estado `Atendida` o `Descartada_Justificada`.
    4. `borradores_generados`: conteo por `id_borrador_raiz` (no duplicado por versiones).
    5. `borradores_aprobados`: conteo de borradores únicos que alcanzaron aprobación.

---

## D. Cómo funciona

### Flujo 1: Paciente consulta estado de tratamiento (Ejemplo Ficticio de Flujo Futuro)
1. El paciente autenticado (ID 1) solicita al agente conocer su próxima sesión programada.
2. La capa de servicios autorizados verifica que el paciente solicita su propia información.
3. Se invoca `CustomerAiPersistenceService.registrarInteraccion(...)` con `actorOrientado = 'PACIENTE'`, `tipoEvento = 'CONSULTA_PROXIMA_CITA'`, vinculando su `id_tratamiento` y `id_sesion`.
4. El registro queda persistido con estado `'Completada'` y `es_diagnostico_o_prescripcion = false`.

### Flujo 2: Odontólogo utiliza asistencia documental (Ejemplo Ficticio de Flujo Futuro)
1. Tras culminar una atención clínica en sillón, el agente propone un borrador de recomendaciones post-operatorias para el paciente.
2. Se registra mediante `CustomerAiPersistenceService.registrarBorrador(...)` con estado `'Generado'` y `requiere_revision_humana = true`.
3. El odontólogo colegiado tratante revisa el borrador en la interfaz. Puede solicitar ajustes (lo que generará la versión 2 manteniendo el mismo `id_borrador_raiz`).
4. El odontólogo aprueba el documento formalmente invocando `CustomerAiPersistenceService.aprobarBorrador(...)`.
5. El estado transiciona a `'Aprobado'` (o `'Corregido_Y_Aprobado'`), registrando su colegiatura y marca de tiempo. Solo a partir de este momento puede emitirse como indicación médica oficial.

---

## E. Cómo comprobarlo

### 1. Verificación de Tablas y Restricciones en SQL Server
```powershell
sqlcmd -S localhost -E -d NexoSaludDB -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('InteraccionesIA', 'AlertasIA', 'BorradoresIA');"
```
*Resultado esperado:* 3 filas retornadas.

### 2. Verificación de Integridad en Prisma Client
```powershell
cd backend
npx prisma validate
```
*Resultado esperado:* `The schema is valid`.

### 3. Ejecución de Pruebas Automatizadas (P01–P12)
```powershell
cd backend
npx vitest run tests/customerAiPersistence.test.ts
```
*Resultado esperado:* 12 pruebas pasando exitosamente (P01 a P12).

### 4. Ejecución de la Suite Completa del Backend
```powershell
cd backend
npx vitest run
```
*Resultado esperado:* 7 suites de pruebas y 28 pruebas pasando (100% éxito).

---

## F. Qué falta para el siguiente paso

Para el Paso 2 (Diseño e Implementación de la Capa de Servicios y Herramientas del Agente):
1. Definir los contratos de las herramientas de consulta (Read-only tools) para agenda, sesiones y planes de tratamiento.
2. Implementar los endpoints seguros en Express con autenticación por token/sesión para perfiles Paciente y Odontólogo.
3. Preparar los adaptadores de prompts y validación de seguridad de contenidos (guardrails clínicos para no emitir diagnósticos autónomos).
