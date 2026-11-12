-- Contrato único: no genera una validación Completa implícita.
CREATE OR ALTER PROCEDURE dbo.usp_CerrarSesionClinica
 @id_sesion INT, @id_profesional_validador INT, @id_usuario_responsable INT = NULL
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @atencion INT,@servicio INT,@tratamiento INT,@asistencial VARCHAR(30),@cierre VARCHAR(30),@json NVARCHAR(MAX),@politica INT,@config NVARCHAR(MAX),@ultima VARCHAR(30),@politica_validada INT;
  SELECT @tratamiento=id_tratamiento,@asistencial=estado_asistencial,@cierre=estado_cierre FROM dbo.SesionesTratamiento WITH(UPDLOCK,HOLDLOCK) WHERE id_sesion=@id_sesion;
  IF @asistencial IS NULL OR @asistencial<>'Realizada' THROW 55920,'La sesión requiere realización oficial.',1;
  SELECT TOP(1) @atencion=id_atencion,@servicio=id_servicio FROM dbo.Atenciones WITH(UPDLOCK,HOLDLOCK) WHERE id_sesion=@id_sesion ORDER BY id_atencion DESC;
  IF NOT EXISTS(SELECT 1 FROM dbo.Profesionales WHERE id_profesional=@id_profesional_validador AND activo=1 AND numero_colegiatura IS NOT NULL) THROW 55921,'Profesional no habilitado.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Atenciones a JOIN dbo.TratamientosContratados t ON t.id_tratamiento=a.id_tratamiento WHERE a.id_atencion=@atencion AND (a.id_profesional=@id_profesional_validador OR t.id_profesional_responsable=@id_profesional_validador)) THROW 55922,'Profesional fuera del ámbito de la atención.',1;
  SELECT TOP(1) @politica=id_politica,@config=configuracion FROM dbo.PoliticasCustomerIA WHERE codigo='DOCUMENTACION' AND id_servicio=@servicio AND estado='Publicada' ORDER BY version DESC;
  IF @politica IS NULL THROW 55923,'Falta política documental publicada.',1;
  SELECT @json=(SELECT motivo_consulta,antecedentes,alergias,evaluacion,procedimiento,observaciones,indicaciones_finales FROM dbo.Atenciones WHERE id_atencion=@atencion FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
  IF EXISTS(SELECT 1 FROM OPENJSON(@config,'$.requiredFields') f WHERE NULLIF(LTRIM(RTRIM(JSON_VALUE(@json,'$.'+CAST(f.value AS NVARCHAR(100))))),'') IS NULL) THROW 55924,'Campos requeridos incompletos.',1;
  IF JSON_VALUE(@config,'$.requiresProcedure')='true' AND NOT EXISTS(SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion=@atencion) AND NULLIF(JSON_VALUE(@json,'$.procedimiento'),'') IS NULL THROW 55925,'Falta procedimiento registrado.',1;
  IF JSON_VALUE(@config,'$.requiresInstructions')='true' AND NOT EXISTS(SELECT 1 FROM dbo.IndicacionesPostatencion WHERE id_atencion=@atencion AND es_version_vigente=1 AND fecha_aprobacion IS NOT NULL AND fecha_emision IS NOT NULL) THROW 55926,'Faltan indicaciones aprobadas y emitidas.',1;
  SELECT TOP(1) @ultima=resultado_validacion,@politica_validada=id_politica_ia FROM dbo.ValidacionesFicha WHERE id_atencion=@atencion ORDER BY numero_revision DESC;
  IF @ultima IS NULL OR @ultima<>'Completa' OR @politica_validada IS NULL OR @politica_validada<>@politica THROW 55927,'Falta revisión profesional conforme a política vigente.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.Atenciones a WHERE a.id_atencion=@atencion AND a.revision_ficha=(SELECT TOP(1) revision_ficha FROM dbo.ValidacionesFicha WHERE id_atencion=@atencion ORDER BY numero_revision DESC)) THROW 55928,'La ficha cambió después de la validación profesional.',1;
  IF @cierre='Cerrada' BEGIN COMMIT; SELECT @id_sesion AS id_sesion,'Cerrada' AS estado_cierre_sesion; RETURN; END;
  UPDATE dbo.Atenciones SET estado_cierre_documental='Cerrada',id_profesional_validador_cierre=@id_profesional_validador,fecha_validacion_cierre=SYSUTCDATETIME() WHERE id_atencion=@atencion;
  UPDATE dbo.SesionesTratamiento SET estado_cierre='Cerrada',fecha_cierre_sesion=SYSUTCDATETIME() WHERE id_sesion=@id_sesion;
  INSERT dbo.EventosSesion(id_sesion,tipo_cambio,estado_anterior,estado_nuevo,motivo,id_usuario_responsable) VALUES(@id_sesion,'CIERRE_SESION','Pendiente','Cerrada','Validación profesional con política publicada',@id_usuario_responsable);
  COMMIT;
  SELECT @id_sesion AS id_sesion,@tratamiento AS id_tratamiento,'Cerrada' AS estado_cierre_sesion;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK; THROW;
 END CATCH
END;
