CREATE OR ALTER TRIGGER dbo.TR_Atenciones_RevisionFicha ON dbo.Atenciones AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF UPDATE(motivo_consulta) OR UPDATE(antecedentes) OR UPDATE(alergias) OR UPDATE(evaluacion) OR UPDATE(procedimiento) OR UPDATE(observaciones) OR UPDATE(indicaciones_finales)
  UPDATE a SET revision_ficha=a.revision_ficha+1 FROM dbo.Atenciones a JOIN inserted i ON i.id_atencion=a.id_atencion;
END;
