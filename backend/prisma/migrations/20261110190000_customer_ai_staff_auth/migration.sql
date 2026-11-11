SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF COL_LENGTH('dbo.Usuarios', 'id_profesional') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD id_profesional INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Usuarios_Profesional')
BEGIN
    ALTER TABLE dbo.Usuarios ADD CONSTRAINT FK_Usuarios_Profesional
      FOREIGN KEY (id_profesional) REFERENCES dbo.Profesionales(id_profesional);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Usuarios_Profesional' AND object_id = OBJECT_ID('dbo.Usuarios'))
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_Usuarios_Profesional ON dbo.Usuarios(id_profesional) WHERE id_profesional IS NOT NULL');
END;
