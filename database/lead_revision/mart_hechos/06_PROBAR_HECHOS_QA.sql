:r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql
IF EXISTS (SELECT 1 FROM dbo.fact_oportunidades_lead)
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_aceptadas_lead)
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead)
 OR EXISTS (SELECT 1 FROM dbo.fact_alternativas_aceptadas_lead)
 OR EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead)
 THROW 54910,'Este caso exige el corte QA base sin resultados operativos.',1;

BEGIN TRANSACTION;
DECLARE @corteAnterior datetime2(7)=SYSUTCDATETIME();
WAITFOR DELAY '00:00:00.025';
-- Fechas de negocio a ambos lados de medianoche en Lima. Las observaciones
-- se registran ahora en UTC, con independencia de estas fechas de negocio.
DECLARE @inicioDia datetime2=DATEADD(day,-2,CONVERT(date,SYSDATETIME()));
DECLARE @hoy datetime2=DATEADD(minute,1439,@inicioDia);
DECLARE @diaSiguiente datetime2=DATEADD(minute,2,@hoy),@raizFecha datetime2=DATEADD(day,-1,@hoy);
DECLARE @persona int=(SELECT MIN(id_persona) FROM [$(Origen)].dbo.Personas),
 @servicio int=(SELECT MIN(id_servicio) FROM [$(Origen)].dbo.Servicios WHERE activo=1),
 @slot int=(SELECT MIN(id_disponibilidad) FROM [$(Origen)].dbo.Disponibilidad);
DECLARE @s1 int,@s2 int,@s3 int,@acuerdo int,@raiz int,@version int,@promo int,@me int,@mp int,@mi int,@ma int,@opcion int;
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s1=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s2=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.Solicitudes(id_persona,id_servicio,fecha_solicitud,fecha_ingreso_lead,resultado_comercial_lead)
 VALUES(@persona,@servicio,@hoy,@hoy,'PENDIENTE');
SET @s3=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PromocionesLead(nombre,tipo_promocion,id_servicio)
 VALUES(N'QA hechos catálogo','QA',@servicio);
SET @promo=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-PE','PROPUESTA','ECONOMICO','Caso QA económico');
SET @me=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-PO','PROPUESTA','OTROS','Caso QA otro de propuesta');
SET @mp=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-AI','ALTERNATIVA','INCOMPATIBILIDAD','Caso QA incompatibilidad');
SET @mi=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.MotivosRechazoLead(codigo,ambito,categoria,motivo)
 VALUES('QA-HECHOS-AO','ALTERNATIVA','OTROS','Caso QA otro de alternativa');
SET @ma=SCOPE_IDENTITY();

-- Dos raíces aceptadas con la misma combinación deben formar un solo grupo.
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,
 fecha_presentacion,promocion_aplicada,estado,fecha_decision)
 VALUES(@s1,@servicio,100,@hoy,N'QA hechos texto','Aceptada',@hoy);
SET @acuerdo=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,
 fecha_presentacion,promocion_aplicada,estado,fecha_decision)
 VALUES(@s3,@servicio,100,@hoy,N'QA hechos texto','Aceptada',@hoy);
UPDATE [$(Origen)].dbo.Solicitudes
 SET resultado_comercial_lead='ACEPTADA',fecha_decision_comercial_lead=@hoy,
 valor_acordado_lead=100,id_propuesta_aceptada_lead=@acuerdo WHERE id_solicitud=@s1;
UPDATE [$(Origen)].dbo.Solicitudes
 SET resultado_comercial_lead='CERRADA_SIN_ACUERDO',fecha_decision_comercial_lead=@hoy,motivo_cierre_lead='QA'
 WHERE id_solicitud=@s2;

INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,200,@raizFecha,'Rechazada',@hoy,@me);
SET @raiz=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 id_propuesta_raiz,numero_version,id_promocion_lead,estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,150,@hoy,@raiz,2,@promo,'Rechazada',@hoy,@me);
SET @version=SCOPE_IDENTITY();
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion,
 estado,fecha_decision,id_motivo_rechazo_lead)
 VALUES(@s2,@servicio,170,@hoy,'Rechazada',@hoy,@mp);
INSERT [$(Origen)].dbo.PropuestasEconomicasLead(id_solicitud,id_servicio,precio_cotizado,fecha_presentacion)
 VALUES(@s3,@servicio,175,@hoy);

-- Opción con intervalo preferido sin día y dos cambios en la misma identidad.
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
 pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@s2,@slot,150,@hoy,'Pendiente','09:00','10:00','QA');
SET @opcion=SCOPE_IDENTITY();
UPDATE [$(Origen)].dbo.Opciones SET precio_ofrecido=145 WHERE id_opcion=@opcion;
UPDATE [$(Origen)].dbo.Opciones SET estado_respuesta='Rechazada',fecha_respuesta=@hoy,id_motivo_rechazo_lead=@mi
 WHERE id_opcion=@opcion;
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,
 fecha_respuesta,id_motivo_rechazo_lead,pref_dia_semana_lead)
 VALUES(@s2,@slot,170,@diaSiguiente,'Rechazada',@diaSiguiente,@ma,3),
       (@s1,@slot,100,@hoy,'Aceptada',@hoy,NULL,NULL);
INSERT [$(Origen)].dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,estado_respuesta,pref_dia_semana_lead)
 VALUES(@s3,@slot,175,@hoy,'Pendiente',4);
IF CONVERT(date,@hoy)<>DATEADD(day,-1,CONVERT(date,SWITCHOFFSET(@hoy AT TIME ZONE 'SA Pacific Standard Time','+00:00')))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 OR EXISTS (SELECT 1 FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corteAnterior) WHERE id_solicitud IN(@s1,@s2,@s3))
 THROW 54915,'El caso no reprodujo el cambio de día o una observación ingresó antes de su corte UTC.',1;
SELECT @version AS id_version,@opcion AS id_opcion,CONVERT(date,@raizFecha) AS fecha_raiz,
 CONVERT(date,@hoy) AS dia_negocio,CONVERT(date,@diaSiguiente) AS dia_siguiente,
 @promo AS id_promocion INTO #Caso;
GO

-- Agregar en QA los miembros que corresponden al caso sintético.
:r .\database\lead_revision\mart_dimensiones\03_CARGAR_DIMENSIONES.sql
GO
:r .\database\lead_revision\mart_hechos\02_POBLAR_HECHOS.sql

IF NOT EXISTS (SELECT 1 FROM dbo.fact_oportunidades_lead f JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
                JOIN dbo.Dim_Canal d ON d.KeyCanal=f.KeyCanal
                JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE f.oportunidad_aceptada=1 AND f.oportunidad_cerrada_sin_acuerdo=1 AND d.id_canal=0)
 OR (SELECT COUNT(*) FROM dbo.fact_oportunidades_lead)<>1
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_aceptadas_lead)<>1
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_aceptadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE f.propuesta_aceptada=2 AND p.Origen='TEXTO')
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_rechazadas_lead)<>2
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo
                JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                JOIN #Caso c ON c.fecha_raiz=t.id_fecha AND c.id_promocion=p.id_promocion
                WHERE f.propuesta_rechazada=1 AND f.propuesta_rechazada_economica=1)
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
                WHERE p.Origen='NO_ESPECIFICADO' AND f.propuesta_rechazada=1 AND f.propuesta_rechazada_economica=0)
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead f JOIN dbo.Dim_Promocion p ON p.KeyPromocion=f.KeyPromocion
            WHERE p.Origen IN('SIN_PROMOCION','DESCONOCIDO'))
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_aceptadas_lead f JOIN dbo.Dim_Horario h ON h.KeyHorario=f.KeyHorarioPreferido
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_negocio=t.id_fecha
                WHERE h.TipoMiembro='NO_ESPECIFICADO' AND f.alternativa_aceptada=1)
 OR (SELECT COUNT(*) FROM dbo.fact_alternativas_rechazadas_lead)<>2
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead f
                JOIN dbo.Dim_Horario hp ON hp.KeyHorario=f.KeyHorarioPreferido
                JOIN dbo.Dim_Horario ho ON ho.KeyHorario=f.KeyHorarioOfrecido
                WHERE f.alternativa_rechazada=1 AND f.alternativa_rechazada_incompatibilidad=1
                 AND hp.NumeroDiaSemana IS NULL AND hp.HoraInicio='09:00' AND hp.HoraFin='10:00'
                 AND ho.NumeroDiaSemana IS NOT NULL AND ho.Turno='QA')
 OR NOT EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead f JOIN dbo.Dim_MotivoRechazo m ON m.KeyMotivoRechazo=f.KeyMotivoRechazo
                JOIN dbo.Dim_Tiempo t ON t.KeyTiempo=f.KeyTiempo JOIN #Caso c ON c.dia_siguiente=t.id_fecha
                WHERE m.TipoMotivoRechazo='OTROS' AND f.alternativa_rechazada=1 AND f.alternativa_rechazada_incompatibilidad=0)
 THROW 54911,'Falló el grano o la asignación dimensional del caso QA.',1;
GO

-- La segunda carga debe conservar exactamente los mismos grupos.
SELECT * INTO #Antes1 FROM dbo.fact_oportunidades_lead;
SELECT * INTO #Antes2 FROM dbo.fact_propuestas_aceptadas_lead;
SELECT * INTO #Antes3 FROM dbo.fact_propuestas_rechazadas_lead;
SELECT * INTO #Antes4 FROM dbo.fact_alternativas_aceptadas_lead;
SELECT * INTO #Antes5 FROM dbo.fact_alternativas_rechazadas_lead;
GO
:r .\database\lead_revision\mart_hechos\02_POBLAR_HECHOS.sql

IF EXISTS (SELECT * FROM #Antes1 EXCEPT SELECT * FROM dbo.fact_oportunidades_lead)
 OR EXISTS (SELECT * FROM dbo.fact_oportunidades_lead EXCEPT SELECT * FROM #Antes1)
 THROW 54913,'La reejecución cambió los grupos de F1.',1;
IF EXISTS (SELECT * FROM #Antes2 EXCEPT SELECT * FROM dbo.fact_propuestas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_aceptadas_lead EXCEPT SELECT * FROM #Antes2)
 THROW 54913,'La reejecución cambió los grupos de F2.',1;
IF EXISTS (SELECT * FROM #Antes3 EXCEPT SELECT * FROM dbo.fact_propuestas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_rechazadas_lead EXCEPT SELECT * FROM #Antes3)
 THROW 54913,'La reejecución cambió los grupos de F3.',1;
IF EXISTS (SELECT * FROM #Antes4 EXCEPT SELECT * FROM dbo.fact_alternativas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_aceptadas_lead EXCEPT SELECT * FROM #Antes4)
 THROW 54913,'La reejecución cambió los grupos de F4.',1;
IF EXISTS (SELECT * FROM #Antes5 EXCEPT SELECT * FROM dbo.fact_alternativas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_rechazadas_lead EXCEPT SELECT * FROM #Antes5)
 THROW 54913,'La reejecución cambió los grupos de F5.',1;

-- Reclasificar las mismas operaciones. El grupo anterior debe desaparecer.
UPDATE p SET estado='Aceptada',id_motivo_rechazo_lead=NULL
 FROM [$(Origen)].dbo.PropuestasEconomicasLead p JOIN #Caso c ON c.id_version=p.id_propuesta;
UPDATE o SET estado_respuesta='Aceptada',id_motivo_rechazo_lead=NULL
 FROM [$(Origen)].dbo.Opciones o JOIN #Caso c ON c.id_opcion=o.id_opcion;
GO
:r .\database\lead_revision\mart_hechos\02_POBLAR_HECHOS.sql

IF (SELECT SUM(propuesta_aceptada) FROM dbo.fact_propuestas_aceptadas_lead)<>3
 OR (SELECT COUNT(*) FROM dbo.fact_propuestas_rechazadas_lead)<>1
 OR EXISTS (SELECT 1 FROM dbo.fact_propuestas_rechazadas_lead WHERE propuesta_rechazada_economica<>0)
 OR (SELECT SUM(alternativa_aceptada) FROM dbo.fact_alternativas_aceptadas_lead)<>2
 OR (SELECT COUNT(*) FROM dbo.fact_alternativas_rechazadas_lead)<>1
 OR EXISTS (SELECT 1 FROM dbo.fact_alternativas_rechazadas_lead WHERE alternativa_rechazada_incompatibilidad<>0)
 THROW 54912,'La reclasificación dejó grupos obsoletos o duplicó operaciones.',1;
ROLLBACK TRANSACTION;
SELECT N'Casos sintéticos validados y revertidos' AS Resultado;
GO
