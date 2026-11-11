SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF COL_LENGTH(N'dbo.BorradoresIA', N'clave_idempotencia') IS NULL
BEGIN
    ALTER TABLE dbo.BorradoresIA ADD clave_idempotencia VARCHAR(120) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BorradoresIA_Idempotencia' AND object_id = OBJECT_ID(N'dbo.BorradoresIA'))
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_BorradoresIA_Idempotencia ON dbo.BorradoresIA(id_atencion, clave_idempotencia) WHERE clave_idempotencia IS NOT NULL');
END;
