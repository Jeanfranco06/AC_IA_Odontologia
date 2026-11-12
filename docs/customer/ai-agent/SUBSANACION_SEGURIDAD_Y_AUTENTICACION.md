# Seguridad y autenticación

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

## Entorno y credenciales

Instancia efectiva JEAC, conexión local localhost; OLTP NexoSaludDB_Test y Mart NexoSalud_Mart_Test. Aprovisionamiento administrativo separado por Windows integrado: [provision-customer-certification.ps1:1](../../../backend/scripts/provision-customer-certification.ps1#L1). Cuenta de ejecución SQL aleatoria, no sysadmin, con DML/lectura/EXECUTE y VIEW DEFINITION solo en Test; ALTER=0. HAS_DBACCESS de ambas operativas=0. TRUSTWORTHY y DB_CHAINING deshabilitados; no se confía solo en sufijo Test. El login se creó para este laboratorio y no sustituye el diseño de mínimos permisos por endpoint de una implantación institucional.

La configuración privada backend/.env.customer-cert.local y storage/certification están ignorados por Git. No se entregan contraseñas, tokens ni fixture privado del navegador. Los scripts verifican servidor/base/privilegios antes de escribir. Se inspeccionan módulos SQL para detectar referencias operativas; el instalador transforma nombres únicamente para Test. No copia datos de producción. Requiere bases Test con esquema previo, no constituye clonador completo de infraestructura vacía.

## Identidad y recursos

[authContext.ts:1](../../../backend/src/modules/customer/ai-agent/authContext.ts#L1) valida firma HMAC, formato exacto de dos segmentos, caducidad e identidad obligatoria. Revocación durable por hash del token: [securityControls.ts:1](../../../backend/src/modules/customer/ai-agent/securityControls.ts#L1). Inserción concurrente protegida con UPDLOCK/HOLDLOCK; evita fallo de clave primaria en las consultas paralelas iniciales del portal. Logout revoca en SQL; sufijos agregados no eluden la revocación. El middleware verifica usuario/rol actual y profesional activo/colegiado en operación real; las pruebas reales activan este control explícitamente.

Paciente: solo recursos propios. Odontólogo: atención asignada o tratamiento bajo su responsabilidad. Recepción: agenda, solicitudes y metadatos operativos; no expediente clínico completo. ADMIN: gobierno técnico; no puede suplantar aprobación del odontólogo. AUDITOR dejó de convertirse automáticamente a ADMIN.

## Contraseñas y sesión

Paciente: PBKDF2 versionado de 120000 iteraciones, sal aleatoria, comparación segura y actualización oportunista del formato heredado tras verificar contraseña. Nuevas claves de 12 a 200 caracteres. Personal mantiene PBKDF2. Login cuenta con límite de intentos por IP/ruta; su almacenamiento es local al proceso y exige un almacén compartido para despliegue multinodo. OTP de demostración queda bloqueado fuera de habilitación de prueba explícita; no se acredita entrega real de OTP.

React persiste sesión en sessionStorage, elimina copia local al guardar y solicita revocación al salir. Sigue admitiendo lectura de sesión heredada; el despliegue institucional debe gestionar rotación/migración y transporte TLS. No se implementó recuperación institucional de cuenta, MFA ni revocación global de todos los dispositivos; no se declara que formen parte de esta certificación CUSTOMER.

## Rutas heredadas

[customer.routes.ts:1](../../../backend/src/routes/customer.routes.ts#L1) conserva barrera ADMIN para accesos históricos amplios. Cierres/cambios de estado heredados que eludían validación responden 409 y remiten al flujo seguro; el profesional dispone de rutas equivalentes acotadas por recurso en [completionRoutes.ts:1](../../../backend/src/modules/customer/ai-agent/completionRoutes.ts#L1). No se abrió el listado clínico completo a recepción ni se eliminó autorización para resolver un error de UI.

## Verificación

Login HTTP real, ocho consultas paralelas, desactivación del usuario, logout/reutilización 401, sufijo inválido 401 y SELECT operativo denegado: [customerCompletionIntegration.test.ts:171](../../../backend/tests/customerCompletionIntegration.test.ts#L171). Contratos de autorización y errores: suites customerAiAgentSecurity/customerAiAgentHttp/customerAcademicTraceability. El navegador inicia sesión de cada rol por sus formularios reales, sin inyectar tokens.
