-- Incluir únicamente dentro de una transacción en el Mart QA. La OLTP QA
-- recibe casos sintéticos, que se revierten junto con la carga de prueba.
IF @@TRANCOUNT=0 OR NOT (
 (DB_NAME()=N'NexoSalud_Mart_LeadQA' AND N'$(Origen)'=N'NexoSaludDB_MartLeadQA')
 OR (DB_NAME()=N'NexoSalud_Mart_LeadPreQA' AND N'$(Origen)'=N'NexoSaludDB_LeadPreQA'))
 THROW 54740,'Caso sintético fuera de la copia o sin transacción.',1;

INSERT [$(Origen)].dbo.Profesionales(nombres,apellidos,especialidad)
 VALUES('QA Mart','Sin especialidad',NULL);
INSERT [$(Origen)].dbo.Sedes(nombre,direccion,zona)
 VALUES('QA Mart sede sin zona','Dirección de prueba',NULL);
DECLARE @qaPersona int=(SELECT MIN(id_persona) FROM [$(Origen)].dbo.Personas),
 @qaServicio int=(SELECT MIN(id_servicio) FROM [$(Origen)].dbo.Servicios),
 @qaSlot int=(SELECT MIN(id_disponibilidad) FROM [$(Origen)].dbo.Disponibilidad),
 @qaSolicitud int,@qaPromocion int,@qaPropuesta int;
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@qaPersona,@qaServicio,'20420106','20420106','PENDIENTE');
SET @qaSolicitud=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PromocionesLead(nombre,tipo_promocion,id_servicio)
 VALUES('QA Mart LEAD promoción','QA',@qaServicio);
SET @qaPromocion=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,id_promocion_lead)
 VALUES(@qaSolicitud,@qaServicio,100,'20420106',@qaPromocion);
SET @qaPropuesta=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 id_promocion_lead,id_propuesta_raiz,numero_version)
 VALUES(@qaSolicitud,@qaServicio,95,'20420107',@qaPromocion,@qaPropuesta,2);
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,promocion_aplicada)
 VALUES(@qaSolicitud,@qaServicio,100,'20420107','QA Mart LEAD promoción');
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-MART-ECON','PROPUESTA','ECONOMICO','QA presupuesto'),
 ('QA-MART-INCOMP','ALTERNATIVA','INCOMPATIBILIDAD','QA agenda'),
 ('QA-MART-OTRO','ALTERNATIVA','OTROS','QA otro');

INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
 pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@qaSolicitud,@qaSlot,100,'20420106','Pendiente',2,'QA Mañana','09:00','11:00','QA Tarde'),
 (@qaSolicitud,@qaSlot,100,'20420106','Pendiente',3,'QA Mañana','09:00','11:00','QA Tarde'),
 (@qaSolicitud,@qaSlot,100,'20420106','Pendiente',2,'QA Mañana',NULL,NULL,'QA Tarde');
