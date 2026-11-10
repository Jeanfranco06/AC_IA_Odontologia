:ON ERROR EXIT
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- INSTALACION UNIFICADA LEAD v2 (SSMS). EJECUTAR 00_PREVUELO_BUYER.sql PRIMERO.
-- Base BUYER instalada; NO ejecutar en base creada solo con archivo destructivo.


-- ===== INICIO 01_MIGRACION_LEAD_ADITIVA.sql =====
/*
 NexoSalud / LEAD v2.0 / esquema aditivo 2026-11-09
 SOLO ejecutar con NexoSaludDB BUYER revisada ya instalada, respaldo y backend detenido.
 NO ejecutar Init_OLTP_actualizada(1).sql: contiene DROP DATABASE.
 SQL Server 2019/2022. Se conservan PK/FK de Buyer, PAYER, CUSTOMER y TURNED.
 Instalacion intencionalmente NO inventa acuerdos/rechazos/preferencias antiguos.
 Este archivo prepara el esquema. Continuar obligatoriamente con 02 y 03.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() IN ('master','model','msdb','tempdb')
 THROW 54001,'Seleccione explicitamente la base OLTP de destino.',1;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.CaptacionesBuyer','U') IS NULL OR
   OBJECT_ID('dbo.EventosEtapa','U') IS NULL OR
   COL_LENGTH('dbo.EventosEtapa','clave_operacion_buyer') IS NULL OR
   OBJECT_ID('dbo.usp_ConvertirBuyerALead','P') IS NULL OR
   OBJECT_ID('dbo.v_DatosCaptacionBuyer','V') IS NULL
 THROW 54002,'BASE NO COMPATIBLE: falta Buyer revisado. Primero resolver con el equipo BUYER.',1;
IF OBJECT_ID('dbo.Opciones','U') IS NULL OR OBJECT_ID('dbo.Solicitudes','U') IS NULL
 OR OBJECT_ID('dbo.Reservas','U') IS NULL OR OBJECT_ID('dbo.Disponibilidad','U') IS NULL
 OR OBJECT_ID('dbo.PersonaPreferencias','U') IS NULL
 THROW 54003,'Falta el modelo OLTP base.',1;
GO
BEGIN TRY
 BEGIN TRANSACTION;

 -- A. Metadatos; fecha de inicio real de trazabilidad historica; no fabricar estados previos.
 IF OBJECT_ID('dbo.ConfiguracionLeadRevision','U') IS NULL
 CREATE TABLE dbo.ConfiguracionLeadRevision (
  version_codigo VARCHAR(30) NOT NULL CONSTRAINT PK_ConfiguracionLeadRevision PRIMARY KEY,
  auditoria_desde_utc DATETIME2(7) NOT NULL CONSTRAINT DF_ConfiguracionLeadRevision_Fecha DEFAULT SYSUTCDATETIME(),
  descripcion NVARCHAR(300) NULL
 );
 EXEC(N'IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionLeadRevision WHERE version_codigo=''LEAD-V2'')
  INSERT dbo.ConfiguracionLeadRevision(version_codigo,descripcion)
  VALUES(''LEAD-V2'',N''Inicio de evidencia de cortes historicos de LEAD; no reconstruye el pasado'');');

 -- B. Catalogos de motivos y promociones. No se cargan valores ficticios.
 IF OBJECT_ID('dbo.PromocionesLead','U') IS NULL
 CREATE TABLE dbo.PromocionesLead (
  id_promocion INT IDENTITY(1,1) CONSTRAINT PK_PromocionesLead PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  tipo_promocion VARCHAR(80) NOT NULL,
  id_servicio INT NULL CONSTRAINT FK_PromocionesLead_Servicio REFERENCES dbo.Servicios(id_servicio),
  activo BIT NOT NULL DEFAULT(1),
  CONSTRAINT CK_PromocionesLead_Nombre CHECK (LEN(LTRIM(RTRIM(nombre)))>0),
  CONSTRAINT CK_PromocionesLead_Tipo CHECK (LEN(LTRIM(RTRIM(tipo_promocion)))>0)
 );
 IF OBJECT_ID('dbo.MotivosRechazoLead','U') IS NULL
 CREATE TABLE dbo.MotivosRechazoLead (
  id_motivo_rechazo INT IDENTITY(1,1) CONSTRAINT PK_MotivosRechazoLead PRIMARY KEY,
  codigo VARCHAR(60) NOT NULL CONSTRAINT UQ_MotivosRechazoLead_Codigo UNIQUE,
  ambito VARCHAR(15) NOT NULL,
  categoria VARCHAR(20) NOT NULL,
  motivo VARCHAR(160) NOT NULL,
  activo BIT NOT NULL DEFAULT(1),
  CONSTRAINT CK_MotivosRechazoLead_Ambito CHECK(ambito IN ('PROPUESTA','ALTERNATIVA')),
  CONSTRAINT CK_MotivosRechazoLead_Categoria CHECK(categoria IN ('ECONOMICO','INCOMPATIBILIDAD','OTROS')),
  CONSTRAINT CK_MotivosRechazoLead_Cruce CHECK (
    (ambito='PROPUESTA' AND categoria IN ('ECONOMICO','OTROS')) OR
    (ambito='ALTERNATIVA' AND categoria IN ('INCOMPATIBILIDAD','OTROS')) ),
  CONSTRAINT CK_MotivosRechazoLead_Nombre CHECK(LEN(LTRIM(RTRIM(motivo)))>0)
 );

 IF COL_LENGTH('dbo.Solicitudes','fecha_ingreso_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD fecha_ingreso_lead DATETIME2 NULL;');
 IF COL_LENGTH('dbo.Solicitudes','archivada_lead_en') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD archivada_lead_en DATETIME2 NULL;');
 IF COL_LENGTH('dbo.Opciones','archivada_lead_en') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD archivada_lead_en DATETIME2 NULL;');

 IF COL_LENGTH('dbo.Solicitudes','clave_registro_web_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD clave_registro_web_lead VARCHAR(36) NULL, hash_registro_web_lead CHAR(64) NULL;');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Solicitudes_RegistroWebLead'
    AND object_id=OBJECT_ID('dbo.Solicitudes'))
  EXEC(N'CREATE UNIQUE INDEX UX_Solicitudes_RegistroWebLead ON dbo.Solicitudes(clave_registro_web_lead)
    WHERE clave_registro_web_lead IS NOT NULL;');

 -- C. Solicitudes existentes. Se usan id_negociador e id_canal_origen del SQL del usuario.
 -- En la baseline Buyer esas dos columnas no estan: se agregan como NULL.
 IF COL_LENGTH('dbo.Solicitudes','id_negociador') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD id_negociador INT NULL;');
 IF COL_LENGTH('dbo.Solicitudes','id_canal_origen') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD id_canal_origen INT NULL;');
 IF COL_LENGTH('dbo.Solicitudes','id_sede_interes_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD id_sede_interes_lead INT NULL;');
 IF COL_LENGTH('dbo.Solicitudes','resultado_comercial_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD resultado_comercial_lead VARCHAR(25) NULL;');
 IF COL_LENGTH('dbo.Solicitudes','fecha_decision_comercial_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD fecha_decision_comercial_lead DATETIME2 NULL;');
 IF COL_LENGTH('dbo.Solicitudes','valor_acordado_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD valor_acordado_lead DECIMAL(14,2) NULL;');
 IF COL_LENGTH('dbo.Solicitudes','id_propuesta_aceptada_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD id_propuesta_aceptada_lead INT NULL;');
 IF COL_LENGTH('dbo.Solicitudes','motivo_cierre_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD motivo_cierre_lead VARCHAR(400) NULL;');
 IF COL_LENGTH('dbo.Solicitudes','fecha_proximo_seguimiento') IS NULL
  EXEC(N'ALTER TABLE dbo.Solicitudes ADD fecha_proximo_seguimiento DATETIME2 NULL;');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Solicitudes_Negociador' AND parent_object_id=OBJECT_ID('dbo.Solicitudes'))
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_Negociador FOREIGN KEY(id_negociador) REFERENCES dbo.Usuarios(id_usuario);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Solicitudes_CanalOrigen' AND parent_object_id=OBJECT_ID('dbo.Solicitudes'))
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_CanalOrigen FOREIGN KEY(id_canal_origen) REFERENCES dbo.Canales(id_canal);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Solicitudes_SedeInteresLead')
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_SedeInteresLead FOREIGN KEY(id_sede_interes_lead) REFERENCES dbo.Sedes(id_sede);');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Solicitudes_ResultadoComercialLead')
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT CK_Solicitudes_ResultadoComercialLead CHECK (
   (resultado_comercial_lead IS NULL AND fecha_decision_comercial_lead IS NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL)
   OR (resultado_comercial_lead=''PENDIENTE'' AND fecha_decision_comercial_lead IS NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL)
   OR (resultado_comercial_lead=''ACEPTADA'' AND fecha_decision_comercial_lead IS NOT NULL AND valor_acordado_lead IS NOT NULL AND id_propuesta_aceptada_lead IS NOT NULL AND motivo_cierre_lead IS NULL)
   OR (resultado_comercial_lead=''CERRADA_SIN_ACUERDO'' AND fecha_decision_comercial_lead IS NOT NULL AND valor_acordado_lead IS NULL AND id_propuesta_aceptada_lead IS NULL AND NULLIF(LTRIM(RTRIM(motivo_cierre_lead)),'''') IS NOT NULL)
  );');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Solicitudes_ValorYFechaLead')
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT CK_Solicitudes_ValorYFechaLead CHECK (
   (valor_acordado_lead IS NULL OR valor_acordado_lead>=0) AND
   (fecha_decision_comercial_lead IS NULL OR fecha_decision_comercial_lead>=fecha_solicitud)
  );');

 -- D. Propuestas: compatible con columnas del Init_OLTP_actualizada del usuario.
 -- Una propuesta LOGICA = raiz + versiones. No se cuentan filas/versiones directamente.
 IF OBJECT_ID('dbo.PropuestasEconomicasLead','U') IS NULL
 CREATE TABLE dbo.PropuestasEconomicasLead (
  id_propuesta INT IDENTITY(1,1) CONSTRAINT PK_PropuestasEconomicasLead PRIMARY KEY,
  id_solicitud INT NOT NULL CONSTRAINT FK_PropuestasLead_Solicitud REFERENCES dbo.Solicitudes(id_solicitud),
  id_servicio INT NOT NULL CONSTRAINT FK_PropuestasLead_Servicio REFERENCES dbo.Servicios(id_servicio),
  id_propuesta_raiz INT NULL,
  numero_version SMALLINT NOT NULL CONSTRAINT DF_PropuestasLead_Version DEFAULT 1,
  precio_cotizado DECIMAL(10,2) NOT NULL,
  promocion_aplicada VARCHAR(150) NULL,
  fecha_presentacion DATETIME2 NOT NULL CONSTRAINT DF_PropuestasLead_Presentacion DEFAULT SYSDATETIME(),
  estado VARCHAR(20) NOT NULL CONSTRAINT DF_PropuestasLead_Estado DEFAULT 'Pendiente',
  fecha_decision DATETIME2 NULL,
  motivo_rechazo VARCHAR(200) NULL,
  tipo_motivo_rechazo VARCHAR(30) NULL,
  CONSTRAINT FK_PropuestasLead_Raiz FOREIGN KEY(id_propuesta_raiz) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta),
  CONSTRAINT CK_PropuestasLead_Precio CHECK(precio_cotizado>=0),
  CONSTRAINT CK_PropuestasLead_Estado CHECK(estado IN ('Pendiente','Aceptada','Rechazada')),
  CONSTRAINT CK_PropuestasLead_Version CHECK(numero_version>=1)
 );
 IF COL_LENGTH('dbo.PropuestasEconomicasLead','id_propuesta_raiz') IS NULL
  THROW 54011,'PropuestasEconomicasLead preexistente con esquema no compatible: requiere reconciliacion manual.',1;
 IF COL_LENGTH('dbo.PropuestasEconomicasLead','numero_version') IS NULL
  THROW 54012,'Falta numero_version: revisar la migracion LEAD anterior antes de continuar.',1;
 IF COL_LENGTH('dbo.PropuestasEconomicasLead','id_sede_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead ADD id_sede_lead INT NULL REFERENCES dbo.Sedes(id_sede);');
 IF COL_LENGTH('dbo.PropuestasEconomicasLead','id_promocion_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead ADD id_promocion_lead INT NULL;');
 IF COL_LENGTH('dbo.PropuestasEconomicasLead','id_motivo_rechazo_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead ADD id_motivo_rechazo_lead INT NULL;');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_PropuestasLead_PromocionLead')
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT FK_PropuestasLead_PromocionLead FOREIGN KEY(id_promocion_lead) REFERENCES dbo.PromocionesLead(id_promocion);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_PropuestasLead_MotivoLead')
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT FK_PropuestasLead_MotivoLead FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_PropuestasLead_ArbolVersion')
  EXEC(N'ALTER TABLE dbo.PropuestasEconomicasLead WITH CHECK ADD CONSTRAINT CK_PropuestasLead_ArbolVersion CHECK (
   (id_propuesta_raiz IS NULL AND numero_version=1) OR
   (id_propuesta_raiz IS NOT NULL AND numero_version>1));');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_PropuestasLead_RaizVersion' AND object_id=OBJECT_ID('dbo.PropuestasEconomicasLead'))
  EXEC(N'CREATE UNIQUE INDEX UX_PropuestasLead_RaizVersion ON dbo.PropuestasEconomicasLead(id_propuesta_raiz,numero_version) WHERE id_propuesta_raiz IS NOT NULL;');
 -- R1 asocia una propuesta concreta a su solicitud, sin cambiar el grano.
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Solicitudes_PropuestaAceptadaLead')
  EXEC(N'ALTER TABLE dbo.Solicitudes WITH CHECK ADD CONSTRAINT FK_Solicitudes_PropuestaAceptadaLead FOREIGN KEY(id_propuesta_aceptada_lead) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta);');

 -- E. Opciones: conservar id_opcion y FK Reservas.id_opcion.
 IF COL_LENGTH('dbo.Opciones','estado_respuesta') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD estado_respuesta VARCHAR(20) NULL;');
 IF COL_LENGTH('dbo.Opciones','fecha_respuesta') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD fecha_respuesta DATETIME2 NULL;');
 IF COL_LENGTH('dbo.Opciones','motivo_rechazo') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD motivo_rechazo VARCHAR(200) NULL;');
 IF COL_LENGTH('dbo.Opciones','tipo_motivo_rechazo') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD tipo_motivo_rechazo VARCHAR(30) NULL;');
 IF COL_LENGTH('dbo.Opciones','id_propuesta_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD id_propuesta_lead INT NULL;');
 IF COL_LENGTH('dbo.Opciones','id_preferencia_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD id_preferencia_lead INT NULL;');
 IF COL_LENGTH('dbo.Opciones','id_motivo_rechazo_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD id_motivo_rechazo_lead INT NULL;');
 IF COL_LENGTH('dbo.Opciones','pref_fecha_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD pref_fecha_lead DATE NULL;');
 IF COL_LENGTH('dbo.Opciones','pref_dia_semana_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD pref_dia_semana_lead TINYINT NULL;');
 IF COL_LENGTH('dbo.Opciones','pref_turno_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD pref_turno_lead VARCHAR(30) NULL;');
 IF COL_LENGTH('dbo.Opciones','pref_hora_inicio_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD pref_hora_inicio_lead TIME NULL;');
 IF COL_LENGTH('dbo.Opciones','pref_hora_fin_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD pref_hora_fin_lead TIME NULL;');
 IF COL_LENGTH('dbo.Opciones','ofr_turno_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.Opciones ADD ofr_turno_lead VARCHAR(30) NULL;');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Opciones_PropuestaLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_PropuestaLead FOREIGN KEY(id_propuesta_lead) REFERENCES dbo.PropuestasEconomicasLead(id_propuesta);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Opciones_PreferenciaLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_PreferenciaLead FOREIGN KEY(id_preferencia_lead) REFERENCES dbo.PersonaPreferencias(id_preferencia);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Opciones_MotivoLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT FK_Opciones_MotivoLead FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Opciones_PreferenciaHorarioLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_PreferenciaHorarioLead CHECK (
   (pref_dia_semana_lead IS NULL OR pref_dia_semana_lead BETWEEN 1 AND 7) AND
   ((pref_hora_inicio_lead IS NULL AND pref_hora_fin_lead IS NULL) OR
    (pref_hora_inicio_lead IS NOT NULL AND pref_hora_fin_lead IS NOT NULL AND pref_hora_inicio_lead<pref_hora_fin_lead))
  );');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Opciones_SeleccionLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_SeleccionLead CHECK (NOT(seleccionada=1 AND estado_respuesta=''Rechazada''));');
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Opciones_FechaRespuestaLead')
  EXEC(N'ALTER TABLE dbo.Opciones WITH CHECK ADD CONSTRAINT CK_Opciones_FechaRespuestaLead CHECK (fecha_respuesta IS NULL OR fecha_respuesta>=fecha_ofrecida);');

 -- F. Bitacora de cambios de alternativa, 1 registro por evento de modificacion.
 IF OBJECT_ID('dbo.CambiosOpcionLead','U') IS NULL
 CREATE TABLE dbo.CambiosOpcionLead (
  id_cambio INT IDENTITY(1,1) CONSTRAINT PK_CambiosOpcionLead PRIMARY KEY,
  id_opcion INT NOT NULL CONSTRAINT FK_CambiosOpcionLead_Opcion REFERENCES dbo.Opciones(id_opcion),
  fecha_cambio DATETIME2 NOT NULL CONSTRAINT DF_CambiosOpcionLead_Fecha DEFAULT SYSDATETIME(),
  campo_modificado VARCHAR(50) NOT NULL,
  motivo_cambio VARCHAR(300) NOT NULL,
  tipo_motivo VARCHAR(30) NOT NULL CONSTRAINT DF_CambiosOpcionLead_Tipo DEFAULT 'Otro',
  valor_anterior VARCHAR(200) NULL,
  valor_nuevo VARCHAR(200) NULL,
  CONSTRAINT CK_CambiosOpcionLead_Tipo CHECK(tipo_motivo IN ('Incompatibilidad','Preferencia','Otro'))
 );
 IF COL_LENGTH('dbo.CambiosOpcionLead','es_pre_reserva_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.CambiosOpcionLead ADD es_pre_reserva_lead BIT NULL;');
 IF COL_LENGTH('dbo.CambiosOpcionLead','fecha_registro_utc_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.CambiosOpcionLead ADD fecha_registro_utc_lead DATETIME2(7) NULL CONSTRAINT DF_CambiosOpcionLead_RegistroUTC DEFAULT SYSUTCDATETIME();');
 -- No marcamos historicos heredados como pre-reserva sin comprobarlos.

 -- G. Enlazar interacciones comerciales sin alterar historial Buyer.
 IF COL_LENGTH('dbo.Interacciones','id_solicitud') IS NULL
  EXEC(N'ALTER TABLE dbo.Interacciones ADD id_solicitud INT NULL;');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_Interacciones_SolicitudLead')
  EXEC(N'ALTER TABLE dbo.Interacciones WITH CHECK ADD CONSTRAINT FK_Interacciones_SolicitudLead FOREIGN KEY(id_solicitud) REFERENCES dbo.Solicitudes(id_solicitud);');

 -- H. Tablas de auditoria independientes; evento de instalacion = evidencia minima actual.
 IF OBJECT_ID('dbo.HistorialSolicitudesLead','U') IS NULL
 CREATE TABLE dbo.HistorialSolicitudesLead (
  id_historial BIGINT IDENTITY(1,1) CONSTRAINT PK_HistorialSolicitudesLead PRIMARY KEY,
  id_solicitud INT NOT NULL,
  fecha_observacion_utc DATETIME2(7) NOT NULL CONSTRAINT DF_HistSolicitudesLead_Fecha DEFAULT SYSUTCDATETIME(),
  accion VARCHAR(10) NOT NULL,
  fecha_solicitud DATETIME2 NOT NULL,
  id_servicio INT NULL,id_negociador INT NULL,id_canal_origen INT NULL,id_sede_interes_lead INT NULL,
  resultado_comercial_lead VARCHAR(25) NULL,
  fecha_decision_comercial_lead DATETIME2 NULL,valor_acordado_lead DECIMAL(14,2) NULL,
  id_propuesta_aceptada_lead INT NULL,
  CONSTRAINT CK_HistSolicitudesLead_Accion CHECK(accion IN ('BASELINE','INSERT','UPDATE','DELETE'))
 );
 IF OBJECT_ID('dbo.HistorialPropuestasLead','U') IS NULL
 CREATE TABLE dbo.HistorialPropuestasLead (
  id_historial BIGINT IDENTITY(1,1) CONSTRAINT PK_HistorialPropuestasLead PRIMARY KEY,
  id_propuesta INT NOT NULL,
  fecha_observacion_utc DATETIME2(7) NOT NULL CONSTRAINT DF_HistPropuestasLead_Fecha DEFAULT SYSUTCDATETIME(),
  accion VARCHAR(10) NOT NULL,
  id_propuesta_raiz INT NULL,numero_version SMALLINT NOT NULL,
  id_solicitud INT NOT NULL,id_servicio INT NOT NULL,
  fecha_presentacion DATETIME2 NOT NULL,precio_cotizado DECIMAL(10,2) NOT NULL,
  id_promocion_lead INT NULL,promocion_aplicada VARCHAR(150) NULL,
  estado VARCHAR(20) NOT NULL,fecha_decision DATETIME2 NULL,id_motivo_rechazo_lead INT NULL,
  CONSTRAINT CK_HistPropuestasLead_Accion CHECK(accion IN ('BASELINE','INSERT','UPDATE','DELETE'))
 );
 IF OBJECT_ID('dbo.HistorialOpcionesLead','U') IS NULL
 CREATE TABLE dbo.HistorialOpcionesLead (
  id_historial BIGINT IDENTITY(1,1) CONSTRAINT PK_HistorialOpcionesLead PRIMARY KEY,
  id_opcion INT NOT NULL,
  fecha_observacion_utc DATETIME2(7) NOT NULL CONSTRAINT DF_HistOpcionesLead_Fecha DEFAULT SYSUTCDATETIME(),
  accion VARCHAR(10) NOT NULL,
  id_solicitud INT NOT NULL,id_disponibilidad INT NOT NULL,
  id_sede INT NOT NULL,id_profesional INT NOT NULL,
  fecha_disponibilidad DATE NOT NULL,hora_inicio TIME NOT NULL,hora_fin TIME NOT NULL,
  fecha_ofrecida DATETIME2 NOT NULL,precio_ofrecido DECIMAL(10,2) NOT NULL,
  id_propuesta_lead INT NULL,id_preferencia_lead INT NULL,
  pref_fecha_lead DATE NULL,pref_dia_semana_lead TINYINT NULL,pref_turno_lead VARCHAR(30) NULL,
  pref_hora_inicio_lead TIME NULL,pref_hora_fin_lead TIME NULL,ofr_turno_lead VARCHAR(30) NULL,
  estado_respuesta VARCHAR(20) NULL,fecha_respuesta DATETIME2 NULL,id_motivo_rechazo_lead INT NULL,
  CONSTRAINT CK_HistOpcionesLead_Accion CHECK(accion IN ('BASELINE','INSERT','UPDATE','DELETE'))
 );

 -- La clasificacion y pertenencia del motivo deben mantenerse para calculos historicos.
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_HistPropuestasLead_Motivo')
  EXEC(N'ALTER TABLE dbo.HistorialPropuestasLead WITH CHECK ADD CONSTRAINT FK_HistPropuestasLead_Motivo FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);');
 IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_HistOpcionesLead_Motivo')
  EXEC(N'ALTER TABLE dbo.HistorialOpcionesLead WITH CHECK ADD CONSTRAINT FK_HistOpcionesLead_Motivo FOREIGN KEY(id_motivo_rechazo_lead) REFERENCES dbo.MotivosRechazoLead(id_motivo_rechazo);');

 IF COL_LENGTH('dbo.HistorialSolicitudesLead','fecha_ingreso_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.HistorialSolicitudesLead ADD fecha_ingreso_lead DATETIME2 NULL;');

 IF COL_LENGTH('dbo.HistorialPropuestasLead','id_sede_lead') IS NULL
  EXEC(N'ALTER TABLE dbo.HistorialPropuestasLead ADD id_sede_lead INT NULL;');

 -- I. Snapshot inicial. Es conocimiento HOY, nunca reconstruccion retroactiva.
 EXEC(N' INSERT dbo.HistorialSolicitudesLead
 (id_solicitud,accion,fecha_solicitud,id_servicio,id_negociador,id_canal_origen,id_sede_interes_lead,
  resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,id_propuesta_aceptada_lead,fecha_ingreso_lead)
 SELECT s.id_solicitud,''BASELINE'',s.fecha_solicitud,s.id_servicio,s.id_negociador,s.id_canal_origen,s.id_sede_interes_lead,
 s.resultado_comercial_lead,s.fecha_decision_comercial_lead,s.valor_acordado_lead,s.id_propuesta_aceptada_lead,s.fecha_ingreso_lead
 FROM dbo.Solicitudes s
 WHERE NOT EXISTS (SELECT 1 FROM dbo.HistorialSolicitudesLead h WHERE h.id_solicitud=s.id_solicitud);');
 EXEC(N' INSERT dbo.HistorialPropuestasLead
 (id_propuesta,accion,id_propuesta_raiz,numero_version,id_solicitud,id_servicio,fecha_presentacion,
  precio_cotizado,id_promocion_lead,promocion_aplicada,estado,fecha_decision,id_motivo_rechazo_lead,id_sede_lead)
 SELECT p.id_propuesta,''BASELINE'',p.id_propuesta_raiz,p.numero_version,p.id_solicitud,p.id_servicio,p.fecha_presentacion,
 p.precio_cotizado,p.id_promocion_lead,p.promocion_aplicada,p.estado,p.fecha_decision,p.id_motivo_rechazo_lead,p.id_sede_lead
 FROM dbo.PropuestasEconomicasLead p
 WHERE NOT EXISTS (SELECT 1 FROM dbo.HistorialPropuestasLead h WHERE h.id_propuesta=p.id_propuesta);');
 EXEC(N' INSERT dbo.HistorialOpcionesLead
 (id_opcion,accion,id_solicitud,id_disponibilidad,id_sede,id_profesional,fecha_disponibilidad,hora_inicio,hora_fin,
  fecha_ofrecida,precio_ofrecido,id_propuesta_lead,id_preferencia_lead,pref_fecha_lead,pref_dia_semana_lead,
  pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead,estado_respuesta,fecha_respuesta,id_motivo_rechazo_lead)
 SELECT o.id_opcion,''BASELINE'',o.id_solicitud,o.id_disponibilidad,d.id_sede,d.id_profesional,d.fecha,d.hora_inicio,d.hora_fin,
 o.fecha_ofrecida,o.precio_ofrecido,o.id_propuesta_lead,o.id_preferencia_lead,o.pref_fecha_lead,o.pref_dia_semana_lead,
 o.pref_turno_lead,o.pref_hora_inicio_lead,o.pref_hora_fin_lead,o.ofr_turno_lead,o.estado_respuesta,o.fecha_respuesta,o.id_motivo_rechazo_lead
 FROM dbo.Opciones o JOIN dbo.Disponibilidad d ON d.id_disponibilidad=o.id_disponibilidad
 WHERE NOT EXISTS (SELECT 1 FROM dbo.HistorialOpcionesLead h WHERE h.id_opcion=o.id_opcion);');

 -- J. Indices: se mantienen tablas Buyer intactas.
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_HistSolicitudesLead_IdFecha' AND object_id=OBJECT_ID('dbo.HistorialSolicitudesLead'))
  EXEC(N'CREATE INDEX IX_HistSolicitudesLead_IdFecha ON dbo.HistorialSolicitudesLead(id_solicitud,fecha_observacion_utc DESC,id_historial DESC);');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_HistPropuestasLead_IdFecha' AND object_id=OBJECT_ID('dbo.HistorialPropuestasLead'))
  EXEC(N'CREATE INDEX IX_HistPropuestasLead_IdFecha ON dbo.HistorialPropuestasLead(id_propuesta,fecha_observacion_utc DESC,id_historial DESC);');
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_HistOpcionesLead_IdFecha' AND object_id=OBJECT_ID('dbo.HistorialOpcionesLead'))
  EXEC(N'CREATE INDEX IX_HistOpcionesLead_IdFecha ON dbo.HistorialOpcionesLead(id_opcion,fecha_observacion_utc DESC,id_historial DESC);');

 COMMIT TRANSACTION;
 PRINT 'LEAD v2: esquema instalado sin reemplazar Buyer; continuar con 02 y 03.';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO

-- ===== FIN 01_MIGRACION_LEAD_ADITIVA.sql =====

-- ===== INICIO 02_AUDITORIA_Y_REGLAS.sql =====
/* Ejecutar despues de 01. REGLAS + HISTORIA + CONSISTENCIA. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID('dbo.HistorialSolicitudesLead','U') IS NULL
 OR OBJECT_ID('dbo.HistorialPropuestasLead','U') IS NULL
 OR OBJECT_ID('dbo.HistorialOpcionesLead','U') IS NULL
 THROW 54101,'Ejecute primero 01_MIGRACION_LEAD_ADITIVA.sql.',1;
GO
CREATE OR ALTER TRIGGER dbo.trg_Lead_Solicitudes_Auditar
ON dbo.Solicitudes AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 -- Un acuerdo comercial solo puede usar una propuesta aceptada de la MISMA solicitud,
 -- sin deducirlo de reservas ni pagos. Comparar precio exactamente a 2 decimales.
 IF EXISTS(
  SELECT 1 FROM inserted i
  LEFT JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=i.id_propuesta_aceptada_lead
  WHERE i.resultado_comercial_lead='ACEPTADA' AND
   (p.id_propuesta IS NULL OR p.id_solicitud<>i.id_solicitud OR
    p.estado<>'Aceptada' OR p.precio_cotizado<>i.valor_acordado_lead OR
    (i.id_servicio IS NOT NULL AND i.id_servicio<>p.id_servicio))
 ) THROW 54111,'Acuerdo sin propuesta aceptada consistente de la misma solicitud y precio.',1;
 INSERT dbo.HistorialSolicitudesLead
 (id_solicitud,accion,fecha_solicitud,id_servicio,id_negociador,id_canal_origen,id_sede_interes_lead,
  resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,id_propuesta_aceptada_lead,fecha_ingreso_lead)
 SELECT i.id_solicitud,CASE WHEN d.id_solicitud IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.fecha_solicitud,i.id_servicio,i.id_negociador,i.id_canal_origen,i.id_sede_interes_lead,
  i.resultado_comercial_lead,i.fecha_decision_comercial_lead,i.valor_acordado_lead,i.id_propuesta_aceptada_lead,i.fecha_ingreso_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_solicitud=i.id_solicitud;
 INSERT dbo.HistorialSolicitudesLead
 (id_solicitud,accion,fecha_solicitud,id_servicio,id_negociador,id_canal_origen,id_sede_interes_lead,
  resultado_comercial_lead,fecha_decision_comercial_lead,valor_acordado_lead,id_propuesta_aceptada_lead,fecha_ingreso_lead)
 SELECT d.id_solicitud,'DELETE',d.fecha_solicitud,d.id_servicio,d.id_negociador,d.id_canal_origen,d.id_sede_interes_lead,
  d.resultado_comercial_lead,d.fecha_decision_comercial_lead,d.valor_acordado_lead,d.id_propuesta_aceptada_lead,d.fecha_ingreso_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_solicitud=d.id_solicitud WHERE i.id_solicitud IS NULL;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Lead_Propuestas_ValidarAuditar
ON dbo.PropuestasEconomicasLead AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 -- Mantener inmutables identidad, raiz, numero de version y solicitud en una edicion.
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_propuesta=i.id_propuesta
  WHERE i.id_solicitud<>d.id_solicitud OR i.id_servicio<>d.id_servicio OR
        i.numero_version<>d.numero_version OR i.fecha_presentacion<>d.fecha_presentacion OR
        ISNULL(i.id_propuesta_raiz,0)<>ISNULL(d.id_propuesta_raiz,0))
  THROW 54120,'No se puede cambiar identidad/raiz/solicitud de una version existente.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_propuesta=i.id_propuesta
  WHERE i.precio_cotizado<>d.precio_cotizado OR
     ISNULL(i.id_promocion_lead,0)<>ISNULL(d.id_promocion_lead,0) OR
     ISNULL(i.promocion_aplicada,'')<>ISNULL(d.promocion_aplicada,''))
  THROW 54130,'Para cambiar precio/promocion crear nueva version, no modificar version existente.',1;

 IF EXISTS (SELECT 1 FROM inserted i
  LEFT JOIN dbo.PropuestasEconomicasLead r ON r.id_propuesta=i.id_propuesta_raiz
  WHERE i.id_propuesta_raiz IS NOT NULL AND
    (r.id_propuesta IS NULL OR r.id_propuesta_raiz IS NOT NULL OR
     r.id_solicitud<>i.id_solicitud OR r.id_servicio<>i.id_servicio OR
     r.numero_version<>1 OR r.id_propuesta=i.id_propuesta))
  THROW 54121,'Version de propuesta con raiz invalida o de otra solicitud/tratamiento.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
  WHERE s.id_servicio IS NOT NULL AND s.id_servicio<>i.id_servicio)
  THROW 54127,'Tratamiento de propuesta incompatible con solicitud.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PromocionesLead pr ON pr.id_promocion=i.id_promocion_lead
  WHERE pr.id_servicio IS NOT NULL AND pr.id_servicio<>i.id_servicio)
  THROW 54128,'Promocion no corresponde al tratamiento de la propuesta.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_propuesta_aceptada_lead=i.id_propuesta
  WHERE s.resultado_comercial_lead='ACEPTADA' AND
     (i.estado<>'Aceptada' OR i.precio_cotizado<>s.valor_acordado_lead))
  THROW 54129,'No invalidar una propuesta ligada a un acuerdo aceptado.',1;
 IF EXISTS (SELECT 1 FROM inserted i
  LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
  WHERE i.estado='Rechazada' AND (m.id_motivo_rechazo IS NULL OR m.ambito<>'PROPUESTA'
          OR i.fecha_decision IS NULL OR i.fecha_decision<i.fecha_presentacion))
  THROW 54122,'Rechazo de propuesta requiere fecha y motivo tipificado de PROPUESTA.',1;
 IF EXISTS (SELECT 1 FROM inserted i WHERE
    (i.estado='Pendiente' AND (i.fecha_decision IS NOT NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado='Aceptada' AND (i.fecha_decision IS NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado NOT IN ('Pendiente','Aceptada','Rechazada'))
 OR (i.fecha_decision IS NOT NULL AND i.fecha_decision<i.fecha_presentacion))
  THROW 54123,'Estado, fecha de decision y motivo de propuesta inconsistentes.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
   WHERE m.ambito<>'PROPUESTA') THROW 54124,'Motivo no corresponde a una propuesta.',1;
 -- Una version posterior requiere una version anterior REAL (sin saltos).
 IF EXISTS (SELECT 1 FROM inserted i WHERE i.id_propuesta_raiz IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead p
   WHERE p.numero_version=i.numero_version-1 AND
    (p.id_propuesta_raiz=i.id_propuesta_raiz OR
     (i.numero_version=2 AND p.id_propuesta=i.id_propuesta_raiz AND p.id_propuesta_raiz IS NULL))))
  THROW 54125,'No se admite saltar numeros de version ni raiz inexistente.',1;
 -- No crear nuevas versiones sobre una propuesta ya vinculada a acuerdo final.
 IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta
  JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
  WHERE d.id_propuesta IS NULL AND i.id_propuesta_raiz IS NOT NULL
        AND s.resultado_comercial_lead='ACEPTADA')
  THROW 54126,'No crear otra version despues del acuerdo comercial definitivo.',1;
 INSERT dbo.HistorialPropuestasLead
 (id_propuesta,accion,id_propuesta_raiz,numero_version,id_solicitud,id_servicio,
  fecha_presentacion,precio_cotizado,id_promocion_lead,promocion_aplicada,estado,fecha_decision,id_motivo_rechazo_lead,id_sede_lead)
 SELECT i.id_propuesta,CASE WHEN d.id_propuesta IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.id_propuesta_raiz,i.numero_version,i.id_solicitud,i.id_servicio,i.fecha_presentacion,
  i.precio_cotizado,i.id_promocion_lead,i.promocion_aplicada,i.estado,i.fecha_decision,i.id_motivo_rechazo_lead,i.id_sede_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_propuesta=i.id_propuesta;
 INSERT dbo.HistorialPropuestasLead
 (id_propuesta,accion,id_propuesta_raiz,numero_version,id_solicitud,id_servicio,
  fecha_presentacion,precio_cotizado,id_promocion_lead,promocion_aplicada,estado,fecha_decision,id_motivo_rechazo_lead,id_sede_lead)
 SELECT d.id_propuesta,'DELETE',d.id_propuesta_raiz,d.numero_version,d.id_solicitud,d.id_servicio,d.fecha_presentacion,
  d.precio_cotizado,d.id_promocion_lead,d.promocion_aplicada,d.estado,d.fecha_decision,d.id_motivo_rechazo_lead,d.id_sede_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_propuesta=d.id_propuesta WHERE i.id_propuesta IS NULL;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Lead_Opciones_ValidarAuditar
ON dbo.Opciones AFTER INSERT,UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
  WHERE i.id_solicitud<>d.id_solicitud)
  THROW 54136,'La alternativa no puede reasignarse a otra solicitud.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=i.id_propuesta_lead
  WHERE p.id_solicitud<>i.id_solicitud)
  THROW 54131,'La propuesta no corresponde a la solicitud de la alternativa.',1;
 IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.PersonaPreferencias pp ON pp.id_preferencia=i.id_preferencia_lead
  JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud WHERE pp.id_persona<>s.id_persona)
  THROW 54132,'La preferencia es de otra persona.',1;
 IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=i.id_motivo_rechazo_lead
  WHERE i.estado_respuesta='Rechazada' AND
   (m.id_motivo_rechazo IS NULL OR m.ambito<>'ALTERNATIVA' OR
    i.fecha_respuesta IS NULL OR i.fecha_respuesta<i.fecha_ofrecida))
  THROW 54133,'Alternativa rechazada requiere fecha y motivo tipificado de ALTERNATIVA.',1;
 IF EXISTS (SELECT 1 FROM inserted i WHERE
    (i.estado_respuesta='Pendiente' AND (i.fecha_respuesta IS NOT NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado_respuesta='Aceptada' AND (i.fecha_respuesta IS NULL OR i.id_motivo_rechazo_lead IS NOT NULL))
 OR (i.estado_respuesta IS NOT NULL AND i.estado_respuesta NOT IN ('Pendiente','Aceptada','Rechazada'))
 OR (i.seleccionada=1 AND i.estado_respuesta='Rechazada')
 OR (i.fecha_respuesta IS NOT NULL AND i.fecha_respuesta<i.fecha_ofrecida))
  THROW 54134,'Estado de respuesta, seleccion, fecha o motivo de alternativa inconsistentes.',1;
 -- Evitar alterar alternativas que ya tienen reserva, incluso si esta cancelada.
 IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
  WHERE (i.id_disponibilidad<>d.id_disponibilidad OR i.precio_ofrecido<>d.precio_ofrecido
   OR ISNULL(i.id_preferencia_lead,0)<>ISNULL(d.id_preferencia_lead,0)
   OR ISNULL(i.pref_fecha_lead,'19000101')<>ISNULL(d.pref_fecha_lead,'19000101')
   OR ISNULL(i.pref_dia_semana_lead,0)<>ISNULL(d.pref_dia_semana_lead,0)
   OR ISNULL(i.pref_turno_lead,'')<>ISNULL(d.pref_turno_lead,'')
   OR ISNULL(i.pref_hora_inicio_lead,'00:00')<>ISNULL(d.pref_hora_inicio_lead,'00:00')
   OR ISNULL(i.pref_hora_fin_lead,'00:00')<>ISNULL(d.pref_hora_fin_lead,'00:00')
   OR ISNULL(i.ofr_turno_lead,'')<>ISNULL(d.ofr_turno_lead,''))
   AND EXISTS (SELECT 1 FROM dbo.Reservas r WHERE r.id_opcion=i.id_opcion))
  THROW 54135,'No editar alternativa despues de reservar: usar flujo de reprogramacion.',1;
 -- Un UPDATE comercial cuenta UN cambio, aun si cambia mas de un atributo.
 INSERT dbo.CambiosOpcionLead(id_opcion,campo_modificado,motivo_cambio,tipo_motivo,
  valor_anterior,valor_nuevo,es_pre_reserva_lead,fecha_registro_utc_lead)
 SELECT i.id_opcion,'CAMBIO_COMERCIAL','Modificacion detectada; causa no declarada por backend','Otro',
  CONCAT('slot=',d.id_disponibilidad,';precio=',d.precio_ofrecido),
  CONCAT('slot=',i.id_disponibilidad,';precio=',i.precio_ofrecido),1,SYSUTCDATETIME()
 FROM inserted i JOIN deleted d ON d.id_opcion=i.id_opcion
 WHERE i.id_disponibilidad<>d.id_disponibilidad OR i.precio_ofrecido<>d.precio_ofrecido
   OR ISNULL(i.id_preferencia_lead,0)<>ISNULL(d.id_preferencia_lead,0)
   OR ISNULL(i.pref_fecha_lead,'19000101')<>ISNULL(d.pref_fecha_lead,'19000101')
   OR ISNULL(i.pref_dia_semana_lead,0)<>ISNULL(d.pref_dia_semana_lead,0)
   OR ISNULL(i.pref_turno_lead,'')<>ISNULL(d.pref_turno_lead,'')
   OR ISNULL(i.pref_hora_inicio_lead,'00:00')<>ISNULL(d.pref_hora_inicio_lead,'00:00')
   OR ISNULL(i.pref_hora_fin_lead,'00:00')<>ISNULL(d.pref_hora_fin_lead,'00:00')
   OR ISNULL(i.ofr_turno_lead,'')<>ISNULL(d.ofr_turno_lead,'');
 INSERT dbo.HistorialOpcionesLead
 (id_opcion,accion,id_solicitud,id_disponibilidad,id_sede,id_profesional,fecha_disponibilidad,
  hora_inicio,hora_fin,fecha_ofrecida,precio_ofrecido,id_propuesta_lead,id_preferencia_lead,
  pref_fecha_lead,pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,
  ofr_turno_lead,estado_respuesta,fecha_respuesta,id_motivo_rechazo_lead)
 SELECT i.id_opcion,CASE WHEN d.id_opcion IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
  i.id_solicitud,i.id_disponibilidad,v.id_sede,v.id_profesional,v.fecha,v.hora_inicio,v.hora_fin,
  i.fecha_ofrecida,i.precio_ofrecido,i.id_propuesta_lead,i.id_preferencia_lead,
  i.pref_fecha_lead,i.pref_dia_semana_lead,i.pref_turno_lead,i.pref_hora_inicio_lead,i.pref_hora_fin_lead,
  i.ofr_turno_lead,i.estado_respuesta,i.fecha_respuesta,i.id_motivo_rechazo_lead
 FROM inserted i LEFT JOIN deleted d ON d.id_opcion=i.id_opcion
 JOIN dbo.Disponibilidad v ON v.id_disponibilidad=i.id_disponibilidad;
 INSERT dbo.HistorialOpcionesLead
 (id_opcion,accion,id_solicitud,id_disponibilidad,id_sede,id_profesional,fecha_disponibilidad,
  hora_inicio,hora_fin,fecha_ofrecida,precio_ofrecido,id_propuesta_lead,id_preferencia_lead,
  pref_fecha_lead,pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,
  ofr_turno_lead,estado_respuesta,fecha_respuesta,id_motivo_rechazo_lead)
 SELECT d.id_opcion,'DELETE',d.id_solicitud,d.id_disponibilidad,v.id_sede,v.id_profesional,v.fecha,v.hora_inicio,v.hora_fin,
  d.fecha_ofrecida,d.precio_ofrecido,d.id_propuesta_lead,d.id_preferencia_lead,d.pref_fecha_lead,d.pref_dia_semana_lead,
  d.pref_turno_lead,d.pref_hora_inicio_lead,d.pref_hora_fin_lead,d.ofr_turno_lead,d.estado_respuesta,
  d.fecha_respuesta,d.id_motivo_rechazo_lead
 FROM deleted d LEFT JOIN inserted i ON i.id_opcion=d.id_opcion
 JOIN dbo.Disponibilidad v ON v.id_disponibilidad=d.id_disponibilidad
 WHERE i.id_opcion IS NULL;
END;
GO
-- Con opciones presentadas, la agenda de esas opciones NO se modifica en sitio.
-- Cambiar el id_disponibilidad de la opcion ANTES de reservar o crear otro slot.
CREATE OR ALTER TRIGGER dbo.trg_Lead_Disponibilidad_InmutableOfertada
ON dbo.Disponibilidad AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id_disponibilidad=i.id_disponibilidad
  WHERE (i.fecha<>d.fecha OR i.hora_inicio<>d.hora_inicio OR i.hora_fin<>d.hora_fin
    OR i.id_sede<>d.id_sede OR i.id_profesional<>d.id_profesional)
  AND EXISTS(SELECT 1 FROM dbo.Opciones o WHERE o.id_disponibilidad=i.id_disponibilidad))
  THROW 54141,'No cambiar fecha/hora/sede/profesional de disponibilidad ya ofertada.',1;
END;
GO
CREATE OR ALTER TRIGGER dbo.trg_Lead_Interacciones_Solicitud
ON dbo.Interacciones AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN dbo.Solicitudes s ON s.id_solicitud=i.id_solicitud
   WHERE i.id_persona<>s.id_persona)
  THROW 54151,'Interaccion vinculada a solicitud de otra persona.',1;
END;
GO
-- El campo fecha_registro_utc_lead deja de ser opcional para NUEVAS inserciones.
-- Las escrituras antiguas sin evidencia temporal conservan NULL y no se cuentan retroactivamente.
PRINT 'LEAD v2: auditoria y validaciones instaladas. Revisar 03 antes de integrar backend.';
GO

CREATE OR ALTER TRIGGER dbo.trg_Lead_Motivos_ClasificacionInmutable
ON dbo.MotivosRechazoLead AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id_motivo_rechazo=i.id_motivo_rechazo
   WHERE (i.ambito<>d.ambito OR i.categoria<>d.categoria) AND
    (EXISTS(SELECT 1 FROM dbo.HistorialPropuestasLead hp WHERE hp.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.HistorialOpcionesLead ho WHERE ho.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.PropuestasEconomicasLead p WHERE p.id_motivo_rechazo_lead=i.id_motivo_rechazo)
     OR EXISTS(SELECT 1 FROM dbo.Opciones o WHERE o.id_motivo_rechazo_lead=i.id_motivo_rechazo)))
  THROW 54161,'No reclasificar motivos ya utilizados: alteraria KPI historicos.',1;
END;
GO

-- ===== FIN 02_AUDITORIA_Y_REGLAS.sql =====

-- ===== INICIO 03_FUENTES_Y_REPORTES.sql =====
/* LEAD v2. 3 granos separados, 8 medidas, R1-R3, fecha de corte real mediante snapshots. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID('dbo.HistorialOpcionesLead','U') IS NULL
 THROW 54201,'Ejecutar 01 y 02 previamente.',1;
GO
CREATE OR ALTER FUNCTION dbo.fn_Lead_Oportunidades_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT h.id_solicitud,COALESCE(conversion.fecha_hora,h.fecha_ingreso_lead) AS fecha_solicitud,
 h.id_servicio,h.id_negociador,COALESCE(h.id_canal_origen,conversion.id_canal) AS id_canal_origen,
 COALESCE(conversion.id_fuente,origen.id_fuente) AS id_fuente,h.id_sede_interes_lead,h.resultado_comercial_lead,h.valor_acordado_lead,
 h.fecha_decision_comercial_lead,h.id_propuesta_aceptada_lead,
 CAST(CASE WHEN h.resultado_comercial_lead='ACEPTADA' THEN 1 ELSE 0 END AS INT) AS oportunidad_aceptada,
 CAST(CASE WHEN h.resultado_comercial_lead='CERRADA_SIN_ACUERDO' THEN 1 ELSE 0 END AS INT) AS oportunidad_cerrada_sin_acuerdo
FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_solicitud
 ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) rn
 FROM dbo.HistorialSolicitudesLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
OUTER APPLY (
 SELECT TOP (1) e.fecha_hora,c.id_canal,COALESCE(c.id_fuente,ca.id_fuente) AS id_fuente
 FROM dbo.EventosEtapa e
 JOIN dbo.CaptacionesBuyer c ON c.id_captacion=e.id_captacion
 LEFT JOIN dbo.Campanas ca ON ca.id_campana=c.id_campana
 JOIN dbo.Etapas b ON b.id_etapa=e.etapa_origen AND b.nombre='BUYER'
 JOIN dbo.Etapas l ON l.id_etapa=e.etapa_destino AND l.nombre='LEAD'
 WHERE e.id_solicitud=h.id_solicitud AND DATEADD(MINUTE,-DATEPART(TZOFFSET,SYSDATETIMEOFFSET()),e.fecha_hora)<=@corte_utc
 ORDER BY e.fecha_hora,e.id_evento_etapa
) conversion
OUTER APPLY (
 SELECT TOP (1) i.id_fuente FROM dbo.Interacciones i
 WHERE i.id_solicitud=h.id_solicitud AND i.id_fuente IS NOT NULL
   AND DATEADD(MINUTE,-DATEPART(TZOFFSET,SYSDATETIMEOFFSET()),i.fecha_hora)<=@corte_utc
 ORDER BY i.fecha_hora,i.id_interaccion
) origen
WHERE h.rn=1 AND h.accion<>'DELETE' AND COALESCE(conversion.fecha_hora,h.fecha_ingreso_lead) IS NOT NULL;
GO
CREATE OR ALTER FUNCTION dbo.fn_Lead_Propuestas_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT v.id_propuesta_logica,v.id_propuesta AS id_version_vigente,
 v.id_solicitud,v.id_servicio,v.id_sede_lead,v.fecha_presentacion_raiz AS fecha_presentacion,
 v.precio_cotizado,v.id_promocion_lead,v.promocion_aplicada,
 v.estado,v.fecha_decision,v.id_motivo_rechazo_lead,m.categoria AS categoria_motivo,
 CAST(CASE WHEN v.estado='Aceptada' THEN 1 ELSE 0 END AS INT) propuesta_aceptada,
 CAST(CASE WHEN v.estado='Rechazada' THEN 1 ELSE 0 END AS INT) propuesta_rechazada,
 CAST(CASE WHEN v.estado='Rechazada' AND m.categoria='ECONOMICO' THEN 1 ELSE 0 END AS INT) propuesta_rechazada_economica
FROM (
 SELECT z.*,
  MAX(CASE WHEN z.id_propuesta_raiz IS NULL THEN z.fecha_presentacion END)
    OVER(PARTITION BY z.id_propuesta_logica) AS fecha_presentacion_raiz,
  ROW_NUMBER() OVER(PARTITION BY z.id_propuesta_logica
    ORDER BY z.numero_version DESC,z.id_propuesta DESC) AS numero_orden
 FROM (
  SELECT h.*,COALESCE(h.id_propuesta_raiz,h.id_propuesta) AS id_propuesta_logica
  FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_propuesta
        ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) AS rn
    FROM dbo.HistorialPropuestasLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
  WHERE h.rn=1 AND h.accion<>'DELETE'
 ) z
) v
LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=v.id_motivo_rechazo_lead
WHERE v.numero_orden=1 AND v.fecha_presentacion_raiz IS NOT NULL;
GO
CREATE OR ALTER FUNCTION dbo.fn_Lead_Alternativas_Corte(@corte_utc DATETIME2(7))
RETURNS TABLE AS RETURN
SELECT h.id_opcion,h.id_solicitud,h.fecha_ofrecida,h.id_disponibilidad,
 h.id_sede,h.id_profesional,h.fecha_disponibilidad,h.hora_inicio,h.hora_fin,
 h.pref_fecha_lead,h.pref_dia_semana_lead,h.pref_turno_lead,
 h.pref_hora_inicio_lead,h.pref_hora_fin_lead,h.ofr_turno_lead,
 h.estado_respuesta,h.fecha_respuesta,h.id_motivo_rechazo_lead,
 m.categoria AS categoria_motivo,
 CAST(CASE WHEN h.estado_respuesta='Aceptada' THEN 1 ELSE 0 END AS INT) alternativa_aceptada,
 CAST(CASE WHEN h.estado_respuesta='Rechazada' THEN 1 ELSE 0 END AS INT) alternativa_rechazada,
 CAST(CASE WHEN h.estado_respuesta='Rechazada' AND m.categoria='INCOMPATIBILIDAD' THEN 1 ELSE 0 END AS INT) alternativa_rechazada_incompatibilidad
FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY a.id_opcion
 ORDER BY a.fecha_observacion_utc DESC,a.id_historial DESC) rn
 FROM dbo.HistorialOpcionesLead a WHERE a.fecha_observacion_utc<=@corte_utc) h
LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=h.id_motivo_rechazo_lead
WHERE h.rn=1 AND h.accion<>'DELETE';
GO
-- Vistas de origen ACTUALES para futuro ETL: se derivan de historia hasta ahora.
-- Todas las medidas son indicadores de 0/1 por entidad logica (nunca por version de propuesta).
CREATE OR ALTER VIEW dbo.v_OrigenMedidasOportunidadLead AS
SELECT * FROM dbo.fn_Lead_Oportunidades_Corte('9999-12-31T23:59:59.9999999');
GO
CREATE OR ALTER VIEW dbo.v_OrigenMedidasPropuestaLead AS
SELECT * FROM dbo.fn_Lead_Propuestas_Corte('9999-12-31T23:59:59.9999999');
GO
CREATE OR ALTER VIEW dbo.v_OrigenMedidasAlternativaLead AS
SELECT * FROM dbo.fn_Lead_Alternativas_Corte('9999-12-31T23:59:59.9999999');
GO
-- Aplicar filtros a TODA la poblacion antes de calcular el KPI; no filtrar estados/motivos del denominador.
CREATE OR ALTER PROCEDURE dbo.usp_Lead_ReporteR1
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,@id_canal INT=NULL,
 @id_sede INT=NULL,@id_negociador INT=NULL,@id_fuente INT=NULL,@desglosar_canal BIT=0
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54211,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54212,'No existe auditoria LEAD suficiente para esa fecha de corte.',1;
 SELECT CAST(GROUPING(sv.nombre) AS BIT) AS EsTotal,
  DATEFROMPARTS(YEAR(o.fecha_solicitud),MONTH(o.fecha_solicitud),1) AS Mes,
  CASE WHEN @desglosar_canal=1 THEN o.id_canal_origen END AS IdCanal,
  CASE WHEN GROUPING(sv.nombre)=1 THEN 'TOTAL' ELSE COALESCE(sv.nombre,'Sin tratamiento') END AS Tratamiento,
  COUNT_BIG(*) AS Ingresadas,
  COALESCE(SUM(o.oportunidad_aceptada),0) AS Aceptadas,
  COALESCE(SUM(o.oportunidad_cerrada_sin_acuerdo),0) AS CerradasSinAcuerdo,
  SUM(CASE WHEN o.resultado_comercial_lead='PENDIENTE' THEN 1 ELSE 0 END) AS Pendientes,
  SUM(CASE WHEN o.resultado_comercial_lead IS NULL THEN 1 ELSE 0 END) AS SinResultadoDocumentado,
  CAST(100.0*SUM(o.oportunidad_aceptada)/NULLIF(SUM(o.oportunidad_aceptada+o.oportunidad_cerrada_sin_acuerdo),0) AS DECIMAL(8,2)) AS AceptacionPorcentaje,
  CAST(COALESCE(SUM(CASE WHEN o.oportunidad_aceptada=1 THEN o.valor_acordado_lead ELSE 0 END),0) AS DECIMAL(18,2)) AS ValorAcordadoSoles
 FROM dbo.fn_Lead_Oportunidades_Corte(@c) o
 LEFT JOIN dbo.Servicios sv ON sv.id_servicio=o.id_servicio
 WHERE o.fecha_solicitud>=@periodo_inicio AND o.fecha_solicitud<@periodo_fin_exclusivo
   AND (@id_servicio IS NULL OR o.id_servicio=@id_servicio)
   AND (@id_canal IS NULL OR o.id_canal_origen=@id_canal)
   AND (@id_sede IS NULL OR o.id_sede_interes_lead=@id_sede)
   AND (@id_negociador IS NULL OR o.id_negociador=@id_negociador)
   AND (@id_fuente IS NULL OR o.id_fuente=@id_fuente)
 GROUP BY GROUPING SETS ((DATEFROMPARTS(YEAR(o.fecha_solicitud),MONTH(o.fecha_solicitud),1),
    CASE WHEN @desglosar_canal=1 THEN o.id_canal_origen END,sv.nombre),())
 ORDER BY EsTotal,Mes,Tratamiento;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_Lead_ReporteR2
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,@con_promocion BIT=NULL,@id_sede INT=NULL,
 @precio_min DECIMAL(10,2)=NULL,@precio_max DECIMAL(10,2)=NULL,
 @id_promocion INT=NULL,@id_motivo INT=NULL,@seccion VARCHAR(10)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54221,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54222,'No hay auditoria LEAD suficiente para ese corte.',1;
 IF @seccion IS NULL OR @seccion='detalle'
 SELECT p.id_propuesta_logica,p.id_version_vigente,p.fecha_presentacion,
  sv.nombre AS Tratamiento,p.id_sede_lead,p.precio_cotizado AS PrecioCotizado,
  CAST(CASE WHEN p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS ConPromocion,
  COALESCE(pr.nombre,NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),''),'Sin promocion') AS PromocionAplicada,
  p.estado AS Resultado,m.motivo AS MotivoRechazo
 FROM dbo.fn_Lead_Propuestas_Corte(@c) p
 LEFT JOIN dbo.Servicios sv ON sv.id_servicio=p.id_servicio
 LEFT JOIN dbo.PromocionesLead pr ON pr.id_promocion=p.id_promocion_lead
 LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=p.id_motivo_rechazo_lead
 WHERE p.fecha_presentacion>=@periodo_inicio AND p.fecha_presentacion<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR p.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR p.id_sede_lead=@id_sede)
  AND (@precio_min IS NULL OR p.precio_cotizado>=@precio_min)
  AND (@precio_max IS NULL OR p.precio_cotizado<=@precio_max)
  AND (@id_promocion IS NULL OR p.id_promocion_lead=@id_promocion)
  AND (@con_promocion IS NULL OR
   (@con_promocion=1 AND (p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL)) OR
   (@con_promocion=0 AND p.id_promocion_lead IS NULL AND NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NULL))
  AND (@id_motivo IS NULL OR p.id_motivo_rechazo_lead=@id_motivo)
 ORDER BY p.fecha_presentacion,p.id_propuesta_logica;
 IF @seccion IS NULL OR @seccion='resumen'
 SELECT COUNT_BIG(*) AS Presentadas,
  COALESCE(SUM(p.propuesta_aceptada),0) AS Aceptadas,
  COALESCE(SUM(p.propuesta_rechazada),0) AS Rechazadas,
  COALESCE(SUM(CASE WHEN p.estado='Pendiente' THEN 1 ELSE 0 END),0) AS Pendientes,
  COALESCE(SUM(p.propuesta_rechazada_economica),0) AS RechazosEconomicos,
  CAST(100.0*SUM(p.propuesta_aceptada)/NULLIF(SUM(p.propuesta_aceptada+p.propuesta_rechazada),0) AS DECIMAL(8,2)) AS AceptacionPorcentaje,
  CAST(AVG(CAST(p.precio_cotizado AS DECIMAL(18,4))) AS DECIMAL(18,2)) AS PrecioPromedio,
  CAST(100.0*SUM(p.propuesta_rechazada_economica)/NULLIF(SUM(p.propuesta_aceptada+p.propuesta_rechazada),0) AS DECIMAL(8,2)) AS L2Porcentaje
 FROM dbo.fn_Lead_Propuestas_Corte(@c) p
 WHERE p.fecha_presentacion>=@periodo_inicio AND p.fecha_presentacion<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR p.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR p.id_sede_lead=@id_sede)
  AND (@precio_min IS NULL OR p.precio_cotizado>=@precio_min)
  AND (@precio_max IS NULL OR p.precio_cotizado<=@precio_max)
  AND (@id_promocion IS NULL OR p.id_promocion_lead=@id_promocion)
  AND (@con_promocion IS NULL OR
   (@con_promocion=1 AND (p.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NOT NULL)) OR
   (@con_promocion=0 AND p.id_promocion_lead IS NULL AND NULLIF(LTRIM(RTRIM(p.promocion_aplicada)),'') IS NULL));
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_Lead_ReporteR3
 @periodo_inicio DATE,@periodo_fin_exclusivo DATE,
 @corte_utc DATETIME2(7)=NULL,@id_servicio INT=NULL,
 @id_sede INT=NULL,@id_profesional INT=NULL,
 @pref_dia TINYINT=NULL,@pref_turno VARCHAR(30)=NULL,
 @ofr_dia TINYINT=NULL,@ofr_turno VARCHAR(30)=NULL,@id_motivo INT=NULL,@seccion VARCHAR(10)=NULL
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @c DATETIME2(7)=COALESCE(@corte_utc,SYSUTCDATETIME());
 IF @periodo_inicio>=@periodo_fin_exclusivo THROW 54231,'Periodo invalido.',1;
 IF @c<(SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2')
  THROW 54232,'No hay auditoria LEAD suficiente para ese corte.',1;
 IF @seccion IS NULL OR @seccion='detalle'
 SELECT a.id_solicitud,a.id_opcion,a.fecha_ofrecida,a.id_sede,a.id_profesional,s.id_servicio,
  a.pref_fecha_lead,a.pref_dia_semana_lead,a.pref_turno_lead,
  a.pref_hora_inicio_lead,a.pref_hora_fin_lead,
  a.fecha_disponibilidad AS FechaAtencionOfrecida,
  ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1 AS DiaOfrecido,
  a.ofr_turno_lead,a.hora_inicio AS HoraInicioOfrecida,a.hora_fin AS HoraFinOfrecida,
  a.estado_respuesta AS Resultado,m.motivo AS MotivoRechazo,
  (SELECT COUNT_BIG(*) FROM dbo.CambiosOpcionLead c WHERE c.id_opcion=a.id_opcion
   AND c.es_pre_reserva_lead=1 AND c.fecha_registro_utc_lead<=@c) AS NumeroCambios
 FROM dbo.fn_Lead_Alternativas_Corte(@c) a
 JOIN dbo.fn_Lead_Oportunidades_Corte(@c) s ON s.id_solicitud=a.id_solicitud
 LEFT JOIN dbo.MotivosRechazoLead m ON m.id_motivo_rechazo=a.id_motivo_rechazo_lead
 WHERE a.fecha_ofrecida>=@periodo_inicio AND a.fecha_ofrecida<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR s.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR a.id_sede=@id_sede)
  AND (@id_profesional IS NULL OR a.id_profesional=@id_profesional)
  AND (@pref_dia IS NULL OR a.pref_dia_semana_lead=@pref_dia)
  AND (@pref_turno IS NULL OR a.pref_turno_lead=@pref_turno)
  AND (@ofr_dia IS NULL OR ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1=@ofr_dia)
  AND (@ofr_turno IS NULL OR a.ofr_turno_lead=@ofr_turno)
  AND (@id_motivo IS NULL OR a.id_motivo_rechazo_lead=@id_motivo)
 ORDER BY a.fecha_ofrecida,a.id_opcion;
 IF @seccion IS NULL OR @seccion='resumen'
 SELECT COUNT_BIG(*) AS Presentadas,
  COALESCE(SUM(a.alternativa_aceptada),0) AS Aceptadas,
  COALESCE(SUM(a.alternativa_rechazada),0) AS Rechazadas,
  COALESCE(SUM(CASE WHEN a.estado_respuesta='Pendiente' THEN 1 ELSE 0 END),0) AS Pendientes,
  COALESCE(SUM(CASE WHEN cambios.id_cambio IS NOT NULL THEN 1 ELSE 0 END),0) AS Modificadas,
  COALESCE(SUM(a.alternativa_rechazada_incompatibilidad),0) AS RechazadasIncompatibilidad,
  CAST(100.0*SUM(a.alternativa_rechazada_incompatibilidad)/NULLIF(SUM(a.alternativa_aceptada+a.alternativa_rechazada),0) AS DECIMAL(8,2)) AS L3Porcentaje
 FROM dbo.fn_Lead_Alternativas_Corte(@c) a
 JOIN dbo.fn_Lead_Oportunidades_Corte(@c) s ON s.id_solicitud=a.id_solicitud
 OUTER APPLY (SELECT TOP (1) c.id_cambio FROM dbo.CambiosOpcionLead c
  WHERE c.id_opcion=a.id_opcion AND c.es_pre_reserva_lead=1 AND c.fecha_registro_utc_lead<=@c
  ORDER BY c.id_cambio DESC) cambios
 WHERE a.fecha_ofrecida>=@periodo_inicio AND a.fecha_ofrecida<@periodo_fin_exclusivo
  AND (@id_servicio IS NULL OR s.id_servicio=@id_servicio)
  AND (@id_sede IS NULL OR a.id_sede=@id_sede)
  AND (@id_profesional IS NULL OR a.id_profesional=@id_profesional)
  AND (@pref_dia IS NULL OR a.pref_dia_semana_lead=@pref_dia)
  AND (@pref_turno IS NULL OR a.pref_turno_lead=@pref_turno)
  AND (@ofr_dia IS NULL OR ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),a.fecha_disponibilidad)%7+7)%7)+1=@ofr_dia)
  AND (@ofr_turno IS NULL OR a.ofr_turno_lead=@ofr_turno);
END;
GO

-- ===== FIN 03_FUENTES_Y_REPORTES.sql =====

-- ===== INICIO 04_PROCEDIMIENTO_ALTERNATIVA.sql =====
/* Insercion de alternativa con preferencias congeladas. Integrar con el backend LEAD. */
CREATE OR ALTER PROCEDURE dbo.usp_Lead_PresentarAlternativa
 @id_solicitud INT,@id_disponibilidad INT,@precio_ofrecido DECIMAL(10,2),
 @id_propuesta_lead INT=NULL,@id_preferencia_lead INT=NULL,
 @pref_fecha DATE=NULL,@pref_dia TINYINT=NULL,@pref_turno VARCHAR(30)=NULL,
 @pref_hora_inicio TIME=NULL,@pref_hora_fin TIME=NULL,@ofr_turno VARCHAR(30),
 @id_opcion INT OUTPUT
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @ofr_turno IS NULL OR LEN(LTRIM(RTRIM(@ofr_turno)))=0
  THROW 54301,'Indicar turno ofrecido; la clasificacion no se adivina por la hora.',1;
 IF @precio_ofrecido<0 THROW 54302,'Precio negativo.',1;
 IF @pref_dia IS NOT NULL AND @pref_dia NOT BETWEEN 1 AND 7
  THROW 54303,'Dia preferido fuera del rango 1..7.',1;
 IF (@pref_hora_inicio IS NULL AND @pref_hora_fin IS NOT NULL)
  OR (@pref_hora_inicio IS NOT NULL AND @pref_hora_fin IS NULL)
  OR (@pref_hora_inicio IS NOT NULL AND @pref_hora_inicio>=@pref_hora_fin)
  THROW 54304,'Intervalo preferido incompleto o invalido.',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @persona INT,@servicio INT,@id_horario INT,@dia_horario TINYINT,@hora_ini TIME,@hora_fin TIME;
 SELECT @persona=id_persona,@servicio=id_servicio FROM dbo.Solicitudes WITH (HOLDLOCK)
 WHERE id_solicitud=@id_solicitud;
 IF @persona IS NULL THROW 54305,'Solicitud inexistente.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Disponibilidad d WHERE d.id_disponibilidad=@id_disponibilidad AND d.estado='Disponible'
    AND d.fecha>=CAST(SYSDATETIME() AS DATE))
  THROW 54306,'Disponibilidad no vigente o no disponible.',1;
 IF @id_preferencia_lead IS NOT NULL
 BEGIN
  SELECT @id_horario=pp.id_horario FROM dbo.PersonaPreferencias pp
  WHERE pp.id_preferencia=@id_preferencia_lead AND pp.id_persona=@persona;
  IF @@ROWCOUNT<>1 THROW 54307,'Preferencia no pertenece al paciente.',1;
  SELECT @dia_horario=dia_semana,@hora_ini=hora_inicio,@hora_fin=hora_fin
  FROM dbo.Horarios WHERE id_horario=@id_horario;
 END;
 SET @pref_dia=COALESCE(@pref_dia,@dia_horario,
  CAST(CASE WHEN @pref_fecha IS NULL THEN NULL ELSE
    ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),@pref_fecha)%7+7)%7)+1 END AS TINYINT));
 SET @pref_hora_inicio=COALESCE(@pref_hora_inicio,@hora_ini);
 SET @pref_hora_fin=COALESCE(@pref_hora_fin,@hora_fin);
 IF @pref_fecha IS NOT NULL AND @pref_dia IS NOT NULL AND
   ((DATEDIFF(DAY,CONVERT(DATE,'19000101',112),@pref_fecha)%7+7)%7)+1<>@pref_dia
  THROW 54308,'La fecha preferida no coincide con el dia de semana.',1;
 IF @id_propuesta_lead IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM dbo.PropuestasEconomicasLead p
   WHERE p.id_propuesta=@id_propuesta_lead AND p.id_solicitud=@id_solicitud
     AND p.precio_cotizado=@precio_ofrecido)
  THROW 54309,'La propuesta y su precio no corresponden a esta solicitud.',1;
 INSERT dbo.Opciones(id_solicitud,id_disponibilidad,precio_ofrecido,fecha_ofrecida,
  seleccionada,estado_respuesta,id_propuesta_lead,id_preferencia_lead,pref_fecha_lead,
  pref_dia_semana_lead,pref_turno_lead,pref_hora_inicio_lead,pref_hora_fin_lead,ofr_turno_lead)
 VALUES(@id_solicitud,@id_disponibilidad,@precio_ofrecido,SYSDATETIME(),0,'Pendiente',
  @id_propuesta_lead,@id_preferencia_lead,@pref_fecha,@pref_dia,@pref_turno,
  @pref_hora_inicio,@pref_hora_fin,@ofr_turno);
 SET @id_opcion=CONVERT(INT,SCOPE_IDENTITY());
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
END;
GO

-- ===== FIN 04_PROCEDIMIENTO_ALTERNATIVA.sql =====
COMMIT TRANSACTION;
GO
