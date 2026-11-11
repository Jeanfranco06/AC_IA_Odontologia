SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF COL_LENGTH(N'dbo.AlertasIA', N'clave_deduplicacion') IS NULL
BEGIN
    ALTER TABLE dbo.AlertasIA ADD clave_deduplicacion VARCHAR(64) NULL;
END;

IF COL_LENGTH(N'dbo.AlertasIA', N'id_correlacion') IS NULL
BEGIN
    ALTER TABLE dbo.AlertasIA ADD id_correlacion VARCHAR(64) NULL;
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AlertasIA_Estado' AND parent_object_id = OBJECT_ID(N'dbo.AlertasIA'))
BEGIN
    ALTER TABLE dbo.AlertasIA DROP CONSTRAINT CK_AlertasIA_Estado;
END;
ALTER TABLE dbo.AlertasIA WITH CHECK ADD CONSTRAINT CK_AlertasIA_Estado
    CHECK (estado IN ('Generada', 'En_Revision', 'Atendida', 'Resuelta', 'Descartada_Justificada'));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AlertasIA_EvidenciaAtencion' AND parent_object_id = OBJECT_ID(N'dbo.AlertasIA'))
BEGIN
    ALTER TABLE dbo.AlertasIA DROP CONSTRAINT CK_AlertasIA_EvidenciaAtencion;
END;
ALTER TABLE dbo.AlertasIA WITH CHECK ADD CONSTRAINT CK_AlertasIA_EvidenciaAtencion
    CHECK (estado NOT IN ('Atendida', 'Resuelta', 'Descartada_Justificada') OR ((id_profesional_revisor IS NOT NULL OR id_usuario_revisor IS NOT NULL) AND fecha_atencion_alerta IS NOT NULL));

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_AlertasIA_ClaveDeduplicacion'
      AND object_id = OBJECT_ID(N'dbo.AlertasIA')
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_AlertasIA_ClaveDeduplicacion ON dbo.AlertasIA(clave_deduplicacion) WHERE clave_deduplicacion IS NOT NULL');
END;
