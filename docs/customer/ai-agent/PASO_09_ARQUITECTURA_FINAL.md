# PASO 9 — ARQUITECTURA TÉCNICA FINAL DEL AGENTE INTELIGENTE CUSTOMER
## NEXOSALUD — ASISTENCIA AL PACIENTE Y COPILOTO CLÍNICO-DOCUMENTAL

**Documento:** Especificación Arquitectónica y Diagramas del Sistema  
**Rama de Trabajo:** `customer`  
**Fecha de Publicación:** 2026-11-11  
**Versión:** 1.0.0-final  

---

## 1. VISIÓN GENERAL DE LA ARQUITECTURA

El Agente Inteligente CUSTOMER se inserta dentro de la plataforma empresarial de NexoSalud como un sistema de asistencia y copiloto híbrido, orquestando capacidades conversacionales basadas en LLM (Gemini), recuperación de documentos autorizados mediante RAG (BM25), persistencia transaccional de auditoría clínica en Microsoft SQL Server (OLTP) y consolidación analítica en el Data Mart institucional.

```mermaid
flowchart TD
    subgraph Frontend["Frontend React + TypeScript (Vite)"]
        UI_Patient["Portal Paciente\n(/portal/customer/patient)"]
        UI_Staff["Workspace Staff / Copiloto\n(/staff/customer/ai-workspace)"]
    end

    subgraph API_Gateway["Backend Node.js + Express (TypeScript)"]
        Auth_Middleware["Middleware Autenticación & RBAC\n(JWT + Scopes de Recurso)"]
        Orchestrator["CustomerAiOrchestrator\n(Gemini 2.5 Flash / Fallback)"]
        ToolRegistry["Tool Registry\n(11 Herramientas Tipadas)"]
        QueryService["CustomerAiQueryService\n(Consultas Clínicas de Solo Lectura)"]
        ActionService["CustomerAiActionService\n(Acciones Supervisadas Transaccionales)"]
        RAG_Engine["DurableKnowledgeService\n(Lexical BM25 Engine)"]
        Health_Monitoring["Health & Metrics API\n(/health/*, /metrics)"]
    end

    subgraph Storage_Layer["Capa de Persistencia e Integración"]
        OLTP["SQL Server 2022 (OLTP)\nNexoSaludDB_Test\n[Tratamientos, Sesiones, InteraccionesIA,\nAlertasIA, BorradoresIA, Solicitudes]"]
        DataMart["SQL Server 2022 (Data Mart)\nNexoSalud_Mart_Test\n[Fact_TratamientoCustomer, Fact_SesionCustomer,\nFact_AtencionCustomer_V2, Fact_InteraccionIACustomer]"]
        RAG_Disk["Almacenamiento Persistente RAG\n(/backend/storage/rag)"]
    end

    UI_Patient -->|HTTP / REST| Auth_Middleware
    UI_Staff -->|HTTP / REST| Auth_Middleware
    Auth_Middleware --> Orchestrator
    Auth_Middleware --> QueryService
    Auth_Middleware --> ActionService
    Auth_Middleware --> Health_Monitoring
    Orchestrator --> ToolRegistry
    ToolRegistry --> QueryService
    ToolRegistry --> RAG_Engine
    ActionService --> OLTP
    QueryService --> OLTP
    Health_Monitoring --> OLTP
    Health_Monitoring --> DataMart
    RAG_Engine --> RAG_Disk
    OLTP -.->|ETL Sincronización\nusp_ETL_SincronizarCustomerMart| DataMart
```

---

## 2. COMPONENTES Y RESPONSABILIDADES

### 2.1. Frontend React & Experiencia de Usuario
- **Portal Paciente:** Diseñado para autogestión de citas, seguimiento de avance operativo de tratamientos, lectura de indicaciones aprobadas y diálogo contextual con el asistente.
- **Workspace Clínico (Odontólogo):** Panel de alta eficiencia médica para inspección de atenciones realizadas, atención justificada de alertas clínicas y ciclo de vida documental de borradores (preparación -> revisión -> aprobación explícita -> emisión oficial).
- **Consola de Recepción:** Panel operativo para revisión de agendas, visualización de slots disponibles y confirmación oficial de reprogramaciones.

### 2.2. Capa de Aplicación y Orquestación (Backend)
- **CustomerAiOrchestrator:** Gestiona el ciclo conversacional del LLM. Aplica system instructions con restricciones de abstención clínica y orquesta la ejecución determinística de tools. Implementa resiliencia activa con fallback determinístico si Gemini excede el timeout de 10 segundos.
- **ToolRegistry:** Catálogo de 11 herramientas de function calling autorizadas, tipadas con JSON Schema y gobernadas por permisos de rol (`PACIENTE`, `ODONTOLOGO`, `RECEPCION`, `ADMIN`).
- **DurableKnowledgeService & BM25:** Motor de recuperación lexical que opera sobre documentos institucionales autorizados en formato Markdown/JSON, persistidos en disco y controlados por listas de acceso (ACL).
- **Health & Metrics Collector:** Módulo desacoplado en memoria que expone endpoints de liveness, readiness y telemetría de percentiles p50/p95 para observabilidad operativa continua.

### 2.3. Capa de Datos y Persistencia
- **NexoSaludDB (OLTP):** Base de datos relacional transaccional que contiene las entidades clínicas fundamentales y las cuatro tablas operativas del agente (`InteraccionesIA`, `AlertasIA`, `BorradoresIA`, `SolicitudesReprogramacionCustomer`). Protegida por constraints relacionales CHECK anti-diagnóstico.
- **NexoSalud_Mart (Data Mart):** Almacén analítico dimensional en esquema estrella, sincronizado mediante el procedimiento almacenado idempotente `dbo.usp_ETL_SincronizarCustomerMart`.

---

## 3. FLUJO TRANSACCIONAL DE ACCIONES SUPERVISADAS

```mermaid
sequenceDiagram
    autonumber
    actor Paciente as Paciente
    actor Recepcion as Personal Recepción
    participant Backend as Backend ActionService
    participant BD as SQL Server (OLTP)

    Note over Paciente,BD: Flujo de Reprogramación Supervisada
    Paciente->>Backend: Solicitar reprogramación (sesionId, fechaPreferida, motivo)
    Backend->>Backend: Generar Token HMAC de confirmación (15 min exp)
    Backend-->>Paciente: Token de confirmación
    Paciente->>Backend: Confirmar solicitud con Token HMAC
    Backend->>BD: BEGIN TRANSACTION (Serializable)<br/>Insert InteraccionesIA<br/>Insert SolicitudesReprogramacion ('Pendiente')<br/>COMMIT
    Backend-->>Paciente: Solicitud registrada (requestId)
    
    Recepcion->>Backend: Consultar solicitudes pendientes y disponibilidad de agenda
    Backend->>BD: Select Disponibilidad ('Disponible')
    Recepcion->>Backend: Aplicar reprogramación (requestId, slotId, motivo)
    Backend->>BD: BEGIN TRANSACTION (Serializable)<br/>Update SesionesTratamiento ('Reprogramada')<br/>Update Disponibilidad ('Ocupado')<br/>Update SolicitudesReprogramacion ('Aplicada')<br/>Insert InteraccionesIA (Auditoría)<br/>COMMIT
    Backend-->>Recepcion: Reprogramación confirmada y aplicada
```

---

## 4. GOBERNANZA CLÍNICA Y TRIPLE BARRERA ANTI-DIAGNÓSTICO

La integridad asistencial está blindada en tres capas independientes:
1. **Capa LLM:** System prompt con regla taxativa de abstención ante solicitudes de diagnóstico o prescripción médica.
2. **Capa Lógica de Negocio:** Servicios de TypeScript que exigen revisión y firma humana obligatoria (`requiresHumanReview: true`).
3. **Capa Motor de Base de Datos:** Restricción CHECK en SQL Server (`CK_InteraccionesIA_NoDiagnostico` y `CK_BorradoresIA_NoDiagnostico`) que aborta a nivel de transacción cualquier intento de registro diagnóstico por la IA.
