:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN (N'NexoSalud_LeadPruebas',N'NexoSalud_LeadEnsayoFinal',N'NexoSalud_LeadVerificacion')
 THROW 54400,'Esta prueba solo se ejecuta en copias LEAD autorizadas para pruebas.',1;

DECLARE @persona int=(SELECT TOP(1) id_persona FROM dbo.Personas ORDER BY id_persona);
DECLARE @servicio int=(SELECT TOP(1) id_servicio FROM dbo.Servicios WHERE activo=1 ORDER BY id_servicio);
DECLARE @slot int=(SELECT TOP(1) id_disponibilidad FROM dbo.Disponibilidad ORDER BY id_disponibilidad);
IF @persona IS NULL OR @servicio IS NULL OR @slot IS NULL
 THROW 54401,'La copia necesita una persona, servicio y disponibilidad de referencia.',1;

BEGIN TRY
 BEGIN TRAN;
 DECLARE @now datetime2=SYSDATETIME(), @sol int,@pending int,@p int,@v int,@o int,@m2 int,@m3 int;
 DECLARE @suffix varchar(36)=CONVERT(varchar(36),NEWID());
 INSERT dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES(CONCAT('QA-P-',@suffix),'PROPUESTA','ECONOMICO','Caso QA de presupuesto');
 SET @m2=SCOPE_IDENTITY();
 INSERT dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES(CONCAT('QA-A-',@suffix),'ALTERNATIVA','INCOMPATIBILIDAD','Caso QA de horario');
 SET @m3=SCOPE_IDENTITY();

 INSERT dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@now,@now,'PENDIENTE');
 SET @sol=SCOPE_IDENTITY();
 INSERT dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@now,@now,'PENDIENTE');
 SET @pending=SCOPE_IDENTITY();
 INSERT dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion)
 VALUES(@sol,@servicio,200,@now);
 SET @p=SCOPE_IDENTITY();
 DECLARE @cut_before_version datetime2(7)=SYSUTCDATETIME();
 WAITFOR DELAY '00:00:00.015';
 DECLARE @promotion int;
 INSERT dbo.PromocionesLead(nombre,tipo_promocion,id_servicio)
 VALUES(CONCAT('Promoción QA ',@suffix),'QA',@servicio);
 SET @promotion=SCOPE_IDENTITY();
 INSERT dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
  id_propuesta_raiz,numero_version,id_promocion_lead)
 VALUES(@sol,@servicio,150,@now,@p,2,@promotion);
 SET @v=SCOPE_IDENTITY();
 UPDATE dbo.PropuestasEconomicasLead SET estado='Rechazada',fecha_decision=@now,id_motivo_rechazo_lead=@m2 WHERE id_propuesta=@v;
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta)
 VALUES(@sol,@slot,150,@now,'Pendiente');
 SET @o=SCOPE_IDENTITY();
 UPDATE dbo.Opciones SET precio_ofrecido=145 WHERE id_opcion=@o;
 UPDATE dbo.Opciones SET estado_respuesta='Rechazada',fecha_respuesta=@now,id_motivo_rechazo_lead=@m3 WHERE id_opcion=@o;
 UPDATE dbo.Solicitudes SET resultado_comercial_lead='CERRADA_SIN_ACUERDO',
  fecha_decision_comercial_lead=@now,motivo_cierre_lead='Caso QA de cierre' WHERE id_solicitud=@sol;
 DECLARE @cut datetime2(7)=SYSUTCDATETIME();

 IF (SELECT COUNT(*) FROM dbo.fn_Lead_Oportunidades_Corte(@cut)
     WHERE id_solicitud IN(@sol,@pending) AND oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo=1)<>1
  THROW 54411,'L1 debe excluir los pendientes.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Propuestas_Corte(@cut_before_version)
   WHERE id_propuesta_logica=@p AND id_version_vigente=@p AND precio_cotizado=200 AND estado='Pendiente' AND id_promocion_lead IS NULL)
  THROW 54418,'El corte previo debe mostrar la propuesta original pendiente.',1;
 IF (SELECT COUNT(*) FROM dbo.fn_Lead_Propuestas_Corte(@cut) WHERE id_propuesta_logica=@p)<>1
  OR NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Propuestas_Corte(@cut)
      WHERE id_propuesta_logica=@p AND id_version_vigente=@v AND precio_cotizado=150 AND id_promocion_lead=@promotion
        AND id_motivo_rechazo_lead=@m2 AND propuesta_rechazada_economica=1)
  THROW 54412,'L2 debe contar la propuesta vigente una sola vez.',1;
 IF (SELECT COUNT(*) FROM dbo.fn_Lead_Alternativas_Corte(@cut) WHERE id_opcion=@o)<>1
  OR NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(@cut)
      WHERE id_opcion=@o AND alternativa_rechazada_incompatibilidad=1)
  OR (SELECT COUNT(*) FROM dbo.CambiosOpcionLead WHERE id_opcion=@o AND es_pre_reserva_lead=1)<>1
  THROW 54413,'L3 debe preservar el cambio sin duplicar la alternativa.',1;
 UPDATE dbo.Opciones SET archivada_lead_en=SYSUTCDATETIME() WHERE id_opcion=@o;
 IF NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME()) WHERE id_opcion=@o)
  THROW 54414,'Archivar no debe borrar la evidencia de L3.',1;
 DECLARE @other_reason int,@other_option int,@pending_option int;
 INSERT dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES(CONCAT('QA-O-',@suffix),'ALTERNATIVA','OTROS','Caso QA de otro motivo');
 SET @other_reason=SCOPE_IDENTITY();
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
  pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@sol,@slot,150,@now,'Pendiente','01:00','02:00','QA');
 SET @pending_option=SCOPE_IDENTITY();
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta)
 VALUES(@sol,@slot,150,@now,'Pendiente');
 SET @other_option=SCOPE_IDENTITY();
 UPDATE dbo.Opciones SET estado_respuesta='Rechazada',fecha_respuesta=@now,id_motivo_rechazo_lead=@other_reason
 WHERE id_opcion=@other_option;
 IF NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME())
  WHERE id_opcion=@pending_option AND alternativa_rechazada=0 AND alternativa_rechazada_incompatibilidad=0)
 OR NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME())
  WHERE id_opcion=@other_option AND alternativa_rechazada=1 AND alternativa_rechazada_incompatibilidad=0)
  THROW 54419,'M8 exige rechazo con motivo INCOMPATIBILIDAD; otros motivos y diferencias de horario no cuentan.',1;

 DECLARE @accepted_option int,@reservation int;
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta)
 VALUES(@pending,@slot,150,@now,'Pendiente');
 SET @accepted_option=SCOPE_IDENTITY();
 UPDATE dbo.Opciones SET seleccionada=1,estado_respuesta='Aceptada',fecha_respuesta=@now
 WHERE id_opcion=@accepted_option;
 INSERT dbo.Reservas(id_persona,id_solicitud,id_opcion,estado)
 VALUES(@persona,@pending,@accepted_option,'Pendiente');
 SET @reservation=SCOPE_IDENTITY();
 INSERT dbo.Pagos(id_persona,id_reserva,importe,canal_pago,estado)
 VALUES(@persona,@reservation,150,'Efectivo en clínica','Pendiente');
 IF NOT EXISTS(SELECT 1 FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME())
               WHERE id_opcion=@accepted_option AND alternativa_aceptada=1)
    OR EXISTS(SELECT 1 FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME())
              WHERE id_solicitud=@pending AND oportunidad_aceptada=1)
  THROW 54417,'Reservar debe conservar la alternativa aceptada sin inferir aceptación comercial.',1;

 DECLARE @buyer int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='BUYER');
 DECLARE @lead int=(SELECT id_etapa FROM dbo.Etapas WHERE nombre='LEAD');
 DECLARE @qa_persona int,@qa_captacion int;
 DECLARE @conversion TABLE(id_evento_etapa int,id_solicitud int,ya_convertido bit);
 INSERT dbo.Personas(nombres,apellidos,email,autoriza_contacto,estado_calidad,id_etapa_actual)
 VALUES('QA','Lead',CONCAT('lead-',@suffix,'@example.invalid'),1,'Valido',@buyer);
 SET @qa_persona=SCOPE_IDENTITY();
 INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,estado_calidad,autoriza_contacto,origen_datos)
 VALUES(@qa_persona,@now,'Valido',1,'REGISTRO_DIRECTO');
 SET @qa_captacion=SCOPE_IDENTITY();
 INSERT @conversion EXEC dbo.usp_ConvertirBuyerALead @qa_captacion,@servicio,N'Consulta QA';
 INSERT @conversion EXEC dbo.usp_ConvertirBuyerALead @qa_captacion,@servicio,N'Consulta QA';
 IF (SELECT COUNT(DISTINCT id_solicitud) FROM @conversion)<>1
    OR NOT EXISTS(SELECT 1 FROM @conversion WHERE ya_convertido=0)
    OR NOT EXISTS(SELECT 1 FROM @conversion WHERE ya_convertido=1)
    OR NOT EXISTS(SELECT 1 FROM dbo.Personas WHERE id_persona=@qa_persona AND id_etapa_actual=@lead)
  THROW 54415,'La conversion BUYER debe conservar su idempotencia.',1;
 IF NOT EXISTS (SELECT 1 FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME()) f
                JOIN @conversion c ON c.id_solicitud=f.id_solicitud)
  THROW 54416,'R1 no reconoce el ingreso originado por BUYER.',1;

 DECLARE @start date=CONVERT(date,@now),@end date=DATEADD(day,1,CONVERT(date,@now));
 EXEC dbo.usp_Lead_ReporteR1 @start,@end,@id_servicio=@servicio;
 EXEC dbo.usp_Lead_ReporteR2 @start,@end,@id_servicio=@servicio,@seccion='resumen';
 EXEC dbo.usp_Lead_ReporteR3 @start,@end,@id_servicio=@servicio,@seccion='resumen';
 ROLLBACK TRAN;
 PRINT 'Pruebas SQL de LEAD aprobadas; cambios de la prueba revertidos.';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRAN;
 THROW;
END CATCH;
