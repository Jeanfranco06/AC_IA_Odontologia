# Entrega PAYER: Bases de Datos, Data Mart (3 Hechos), Motor Dunning y Reportes

**Fecha de entrega:** 9 de noviembre de 2026.  
**Equipo responsable:** Mario y Marck (Fase PAYER).  
**Base de datos transaccional:** `NexoSaludDB` (SQL Server).  
**Data Mart dimensional:** `NexoSalud_Mart` (SQL Server).  

Esta carpeta contiene la documentación integral, especificaciones formales, scripts DDL/ETL y contratos de integración para la etapa **PAYER** (Pago, Conciliación y Cadencia de Cobranza), completando la transición desde **LEAD** y preparando el pase formal hacia **CUSTOMER**.

---

## 1. Documentos Vigentes

| Documento | Propósito |
|---|---|
| [Entrega a Compañeros (CUSTOMER y TURNED)](ENTREGA_A_COMPANEROS.md) | Guía técnica principal para los equipos que continuarán con la atención médica y postventa. |
| [Requerimientos y Especificación](docs/REQUERIMIENTOS_Y_ESPECIFICACION_PAYER.md) | Especificación exhaustiva de los requerimientos funcionales RQ-PAYER-01 a RQ-PAYER-05, objetivos y estrategias. |
| [Modelo Dimensional: Tres Hechos](docs/MODELO_DIMENSIONAL_PAYER_TRES_HECHOS.md) | Justificación y arquitectura de los hechos especializados `F1 (Recaudación)`, `F2 (Validación/Incidencias)` y `F3 (Conversión/Cadencia)`. |
| [Cadencia Dunning y Agente IA](docs/CADENCIA_DUNNING_SCHEDULER.md) | Funcionamiento del motor de cobranza en 3 etapas (T-48h, T-24h, T-00:00), scoring Groq IA y consola de auditoría. |
| [Contrato de Transición a CUSTOMER](docs/CONTRATO_TRANSICION_CUSTOMER.md) | Guardián de dominio: reglas estrictas para el bloqueo de citas, emisión de constancia PDF y pase a sillón dental. |

---

## 2. Scripts SQL Activos

Los scripts se ubican en la subcarpeta [`sql/`](sql/) y siguen el estándar modular e idempotente de la clínica:

| Archivo SQL | Función y Alcance |
|---|---|
| [`01_oltp_payer_extension.sql`](sql/01_oltp_payer_extension.sql) | Extensiones aditivas a `NexoSaludDB` (homologación de estados en `Pagos`, soporte de motivos en `Incidencias` y campos de cadencia en `Reservas`). No borra datos ni rompe PK/FK existentes. |
| [`02_mart_dimensiones_payer.sql`](sql/02_mart_dimensiones_payer.sql) | Creación de dimensiones especializadas en `NexoSalud_Mart`: `Dim_Incidencia`, `Dim_NotificacionCobranza` y `Dim_RiesgoImpago`. |
| [`03_mart_facts_payer.sql`](sql/03_mart_facts_payer.sql) | Creación de las tres tablas de hechos: `Fact_RecaudacionPayer`, `Fact_ValidacionIncidenciaPayer` y `Fact_ConversionCobranzaPayer` con llaves primarias compuestas. |
| [`04_etl_poblamiento_payer.sql`](sql/04_etl_poblamiento_payer.sql) | Rutina ETL idempotente con control de concurrencia (`sp_getapplock`) y `MERGE` para cargar los 3 hechos desde la OLTP. |
| [`05_indicadores_y_reportes_payer.sql`](sql/05_indicadores_y_reportes_payer.sql) | Consultas SQL de KPIs P1–P4 con semáforos y las vistas/procedimientos que alimentan los reportes R1, R2 y R3. |
| [`06_pruebas_integracion_rollback.sql`](sql/06_pruebas_integracion_rollback.sql) | Suite de pruebas de validación con datos sintéticos y reversión automática (`ROLLBACK TRANSACTION`). |

---

## 3. Contrato Vigente de la Etapa PAYER

1. **Grano Transaccional Independiente:**
   - En PAYER no se asume "una persona = un registro". Cada pago (`Pagos`) y cada reserva (`Reservas`) mantiene su propia identidad, permitiendo auditoría sobre pacientes con múltiples reservas o reintentos de pago.
2. **Separación de Importes:**
   - Se mantienen desacoplados:
     - `precio_lista` (de la tarifa activa en el catálogo).
     - `precio_ofrecido` (descuento comercial pactado en la mesa de negociación LEAD).
     - `importe` (monto efectivamente abonado y conciliado en tesorería).
3. **Cadencia Automatizada (Protección del Sillón Dental):**
   - El scheduler en segundo plano evalúa reservas en tres cortes temporales referenciados a la zona horaria de Perú (`America/Lima`):
     - **T - 48h:** Recordatorio preventivo por correo con Orden de Pago PDF y pasarelas web.
     - **T - 24h:** Alerta de urgencia de vencimiento a las 23:59 hrs.
     - **T = 00:00 hrs:** Cancelación automática, notificación de cupo expirado y liberación inmediata del sillón dental (`Disponibilidad.disponible = 1`).
4. **Guardián de Transición Hacia CUSTOMER:**
   - La cita odontológica presencial, la historia clínica inicial y la transferencia al módulo CUSTOMER **solo se desbloquean si el pago alcanza el estado formal `VALIDADO`**.
   - Ante la validación, el sistema emite la **Constancia de Pago Oficial (PDF tipo RECEIPT)** con sello de agua "PAGADO" y número de operación.
5. **Justificación Obligatoria de Incidencias:**
   - Todo pago rechazado o revertido exige obligatoriamente una justificación tipificada de al menos 10 caracteres registrada en la tabla `Incidencias`.

