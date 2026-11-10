-- ====================================================================
-- ARCHIVO: 01_oltp_payer_extension.sql
-- FASE: PAYER (Transaccional - NexoSaludDB)
-- AUTORES: Mario y Marck
-- DESCRIPCIÓN: Extensión aditiva e idempotente sobre NexoSaludDB.
-- No borra datos, no altera identificadores ni rompe tablas compartidas.
-- ====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_NAME() NOT IN ('NexoSaludDB', 'NexoSalud_LeadEnsayoFinal', 'NexoSalud_PayerPruebas')
BEGIN
    PRINT 'AVISO: Verifique que la sesión apunte a la base OLTP autorizada (ej. NexoSaludDB).';
END
GO

BEGIN TRANSACTION;

-- 1. EXTENSIÓN DE TABLA Pagos
-- --------------------------------------------------------------------
IF COL_LENGTH('dbo.Pagos', 'fecha_declaracion') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD fecha_declaracion DATETIME2 NULL;
    PRINT 'Columna Pagos.fecha_declaracion agregada.';
END

IF COL_LENGTH('dbo.Pagos', 'fecha_rechazo_reversion') IS NULL
BEGIN
    ALTER TABLE dbo.Pagos ADD fecha_rechazo_reversion DATETIME2 NULL;
    PRINT 'Columna Pagos.fecha_rechazo_reversion agregada.';
END

-- 2. HOMOLOGACIÓN DE ESTADOS EN Pagos
-- Admite estados oficiales en español y compatibilidad con interfaces web
-- --------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Pagos_Estado_Oficial')
    ALTER TABLE dbo.Pagos DROP CONSTRAINT CK_Pagos_Estado_Oficial;

ALTER TABLE dbo.Pagos WITH CHECK ADD CONSTRAINT CK_Pagos_Estado_Oficial CHECK (
    estado IN (
        'Pendiente', 'En_Revision', 'Validado', 'Rechazado', 'Revertido',
        'PENDING', 'IN_REVIEW', 'VALIDATED', 'REJECTED', 'REVERTED',
        'Confirmado', 'Fallido'
    )
);
PRINT 'Restricción CK_Pagos_Estado_Oficial verificada/actualizada.';

-- 3. EXTENSIÓN DE TABLA Incidencias (Para auditoría de rechazos >= 10 caracteres)
-- --------------------------------------------------------------------
IF COL_LENGTH('dbo.Incidencias', 'motivo_tipificado') IS NULL
BEGIN
    ALTER TABLE dbo.Incidencias ADD motivo_tipificado VARCHAR(100) NULL;
    PRINT 'Columna Incidencias.motivo_tipificado agregada.';
END

-- 4. EXTENSIÓN DE TABLA Reservas (Cadencia Dunning y Scoring IA)
-- --------------------------------------------------------------------
IF COL_LENGTH('dbo.Reservas', 'ultima_alerta_dunning') IS NULL
BEGIN
    ALTER TABLE dbo.Reservas ADD ultima_alerta_dunning VARCHAR(50) NULL DEFAULT 'SIN_ALERTA';
    PRINT 'Columna Reservas.ultima_alerta_dunning agregada.';
END

IF COL_LENGTH('dbo.Reservas', 'score_riesgo_impago') IS NULL
BEGIN
    ALTER TABLE dbo.Reservas ADD score_riesgo_impago INT NULL;
    PRINT 'Columna Reservas.score_riesgo_impago agregada.';
END

-- 5. ÍNDICES DE RENDIMIENTO PARA COBRANZA Y AUDITORÍA
-- --------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagos_Reserva_Estado' AND object_id = OBJECT_ID('dbo.Pagos'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Pagos_Reserva_Estado 
    ON dbo.Pagos (id_reserva, estado)
    INCLUDE (importe, canal_pago, fecha_registro, fecha_validacion);
    PRINT 'Índice IX_Pagos_Reserva_Estado creado.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reservas_Cadencia_Estado' AND object_id = OBJECT_ID('dbo.Reservas'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Reservas_Cadencia_Estado
    ON dbo.Reservas (estado, fecha_reserva)
    INCLUDE (id_persona, id_solicitud, id_opcion, fecha_vencimiento_bloqueo);
    PRINT 'Índice IX_Reservas_Cadencia_Estado creado.';
END

COMMIT TRANSACTION;
PRINT 'Extensiones OLTP de PAYER aplicadas exitosamente.';
GO

