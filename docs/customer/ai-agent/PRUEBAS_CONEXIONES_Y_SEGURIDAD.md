# Pruebas de Conexión, Seguridad y Autorización

**Certificación de Seguridad, Control de Acceso y Resiliencia**  
**Fecha:** 12 de noviembre de 2026  
**Resultado Global:** Certificación Técnica Completa en Entorno Test Aislado

---

## 1. Matriz de Control de Acceso por Rol (RBAC)

Se implementó una barrera de cuatro niveles que combina autenticación JWT con firma de sesión, validación de perfil en capa de aplicación y filtrado en la consulta SQL Server:

| Perfil / Rol | Actividades Operacionales (OLTP) | Actividades Analíticas (Mart) | Restricción Dimensional en SQL |
|---|---|---|---|
| **PACIENTE** | IA01, IA02, IA03, IA04, IA05, IA06, IA12, IA14. | **Ninguna (Acceso Bloqueado HTTP 403).** | Acceso a Mart revocado por software y por contrato. |
| **ODONTOLOGO** | IA05, IA07, IA08, IA09, IA10, IA11, IA12, IA13, IA14; Alertas ALT-C01 a C08. | IA15, IA16, IA17, IA18. | **Ámbito Profesional Propio:** Cláusula `AND f.KeyProfesional IN (SELECT KeyProfesional FROM Dim_Profesional WHERE id_profesional = @idProfesional)`. No visualiza métricas de otros médicos. |
| **RECEPCION** | IA03, IA04, IA05, IA08, IA14; Alertas ALT-C01, C02, C03. | IA15, IA16 (Exclusivamente). | Bloqueo estricto de IA17 (documentación médica) e IA18 (desempeño de IA). |
| **ADMINISTRADOR** | Todas las operacionales bajo supervisión. | IA15, IA16, IA17, IA18. | Ámbito Institucional Agregado Global. |

---

## 2. Seguridad de Conexión a la Base de Datos Analítica

La identidad analítica para consultar `NexoSalud_Mart` cumple con los principios de seguridad defensiva:
1. **Solo SELECT:** Concede permisos `GRANT SELECT` únicamente sobre las 4 tablas de hechos (`Fact_TratamientoCustomer`, `Fact_SesionCustomer`, `Fact_AtencionCustomer_V2`, `Fact_InteraccionIACustomer`), las dimensiones vinculadas y la bitácora `ETL_EjecucionLog`.
2. **Denegación Explícita:** `DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::dbo TO [NexoSaludBIRead]`.
3. **Imposibilidad de DDL:** La cuenta no posee privilegios para alterar tablas, compilar vistas ni modificar la estructura.
4. **Sin Cadena de Propiedad:** Las credenciales OLTP y Mart son independientes; no se utiliza suplantación cruzada de identidad ni llamadas RPC arbitrarias entre bases.

---

## 3. Resultados de Pruebas Automatizadas

El conjunto de pruebas ejecutadas de forma automatizada sobre el entorno aislado certificó la estabilidad del sistema:

### A. Pruebas Backend (Vitest — 249 Pruebas Pasadas)
- `customerAcademicTraceability.test.ts` (27 pruebas): Verificación de contratos, aislamiento de roles y trazabilidad de IA01 a IA18.
- `customerAnalyticsIntegration.test.ts` (13 pruebas): Consultas reales en Mart, validación de parámetros, agregaciones, roles y orquestador BI.
- `customerCompletionIntegration.test.ts` (28 pruebas): Concurrencia real, programación segura, cierres transaccionales y bloqueo de bypass SQL.
- `customerCompletionMart.test.ts` (1 prueba): Conciliación determinista de las 20 medidas dimensionales al mismo corte transaccional.
- `customerAiCertificationP01P32.test.ts` (32 pruebas): Certificación exhaustiva de políticas de negocio P01 a P32.
- `customerAiPilotFunctional.test.ts` (14 pruebas): Escenarios piloto funcionales PIL-01 a PIL-14.
- `customerKnowledgeBaseCertificationP01P32.test.ts` (32 pruebas): RAG determinista y corpus institucional.
- `customerAiPerformance.test.ts` (8 pruebas): Benchmarks de latencia y pruebas de resiliencia ante caída del proveedor LLM.
- `customerAiSecurityEvaluation.test.ts` (8 pruebas): Verificación de restricciones CHECK anti-diagnóstico y protección contra SQL injection.

### B. Pruebas Frontend (Vitest — 49 Pruebas Pasadas)
- Certificación de interfaces F01 a F30.
- Renderizado seguro de componentes sin exposición de identificadores clínicos sensibles.
- Generación y descarga de constancias en formato PDF.

### C. Pruebas de Extremo a Extremo (Playwright E2E — 6 Pruebas Pasadas)
1. **Portal del Paciente:** Autenticación, visualización de cronograma y solicitud de programación asistida.
2. **Recepción:** Revisión y aplicación transaccional de solicitudes de sesión.
3. **Reprogramación:** Flujo completo de solicitud y aplicación de cambio de agenda.
4. **Copiloto Clínico:** Flujo del odontólogo: asistencia documental por secciones, versionado de borradores y transferencia explícita a ficha.
5. **Portal Móvil:** Verificación de responsive design en viewport estrecho (390x844) sin desbordamiento horizontal.
6. **Análisis Inteligente BI:** Selección de filtros, consulta de indicadores multidimensionales y explicación interactiva por rol.

---

## 4. Benchmarks de Rendimiento

Mediciones obtenidas en pruebas de estrés y latencia (`customerAiPerformance.test.ts`):
- **Emisión / Validación de Tokens:** p50 = 0.01 ms, p95 = 0.03 ms.
- **Consulta de Tratamientos:** p50 = 1.76 ms, p95 = 4.12 ms.
- **Consulta de Sesiones Próximas:** p50 = 1.64 ms, p95 = 2.91 ms.
- **Búsqueda RAG Léxica (BM25):** p50 = 1.66 ms, p95 = 4.45 ms.
- **Orquestación Conversacional (Simulada):** p50 = 1.84 ms, p95 = 2.98 ms.
