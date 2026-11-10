:r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.fact_oportunidades_lead','U') IS NULL
 CREATE TABLE dbo.fact_oportunidades_lead (
  KeyTiempo int NOT NULL,
  KeyServicio int NOT NULL,
  KeyCanal int NOT NULL,
  KeySede int NOT NULL,
  KeyNegociador int NOT NULL,
  oportunidad_aceptada bigint NOT NULL,
  oportunidad_cerrada_sin_acuerdo bigint NOT NULL,
  CONSTRAINT PK_fact_oportunidades_lead PRIMARY KEY (KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador),
  CONSTRAINT FK_fact_oportunidades_lead_Tiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
  CONSTRAINT FK_fact_oportunidades_lead_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
  CONSTRAINT FK_fact_oportunidades_lead_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.Dim_Canal(KeyCanal),
  CONSTRAINT FK_fact_oportunidades_lead_Sede FOREIGN KEY (KeySede) REFERENCES dbo.Dim_Sede(KeySede),
  CONSTRAINT FK_fact_oportunidades_lead_Negociador FOREIGN KEY (KeyNegociador) REFERENCES dbo.Dim_Negociador(KeyNegociador),
  CONSTRAINT CK_fact_oportunidades_lead_medidas CHECK (oportunidad_aceptada>=0 AND oportunidad_cerrada_sin_acuerdo>=0 AND oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo>0)
 );

IF OBJECT_ID('dbo.fact_propuestas_aceptadas_lead','U') IS NULL
 CREATE TABLE dbo.fact_propuestas_aceptadas_lead (
  KeyTiempo int NOT NULL,
  KeyServicio int NOT NULL,
  KeyPromocion int NOT NULL,
  propuesta_aceptada bigint NOT NULL,
  CONSTRAINT PK_fact_propuestas_aceptadas_lead PRIMARY KEY (KeyTiempo, KeyServicio, KeyPromocion),
  CONSTRAINT FK_fact_propuestas_aceptadas_lead_Tiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
  CONSTRAINT FK_fact_propuestas_aceptadas_lead_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
  CONSTRAINT FK_fact_propuestas_aceptadas_lead_Promocion FOREIGN KEY (KeyPromocion) REFERENCES dbo.Dim_Promocion(KeyPromocion),
  CONSTRAINT CK_fact_propuestas_aceptadas_lead_medidas CHECK (propuesta_aceptada>=0 AND propuesta_aceptada>0)
 );

IF OBJECT_ID('dbo.fact_propuestas_rechazadas_lead','U') IS NULL
 CREATE TABLE dbo.fact_propuestas_rechazadas_lead (
  KeyTiempo int NOT NULL,
  KeyServicio int NOT NULL,
  KeyPromocion int NOT NULL,
  KeyMotivoRechazo int NOT NULL,
  propuesta_rechazada bigint NOT NULL,
  propuesta_rechazada_economica bigint NOT NULL,
  CONSTRAINT PK_fact_propuestas_rechazadas_lead PRIMARY KEY (KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo),
  CONSTRAINT FK_fact_propuestas_rechazadas_lead_Tiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
  CONSTRAINT FK_fact_propuestas_rechazadas_lead_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
  CONSTRAINT FK_fact_propuestas_rechazadas_lead_Promocion FOREIGN KEY (KeyPromocion) REFERENCES dbo.Dim_Promocion(KeyPromocion),
  CONSTRAINT FK_fact_propuestas_rechazadas_lead_MotivoRechazo FOREIGN KEY (KeyMotivoRechazo) REFERENCES dbo.Dim_MotivoRechazo(KeyMotivoRechazo),
  CONSTRAINT CK_fact_propuestas_rechazadas_lead_medidas CHECK (propuesta_rechazada>=0 AND propuesta_rechazada_economica>=0 AND propuesta_rechazada_economica<=propuesta_rechazada AND propuesta_rechazada>0)
 );

IF OBJECT_ID('dbo.fact_alternativas_aceptadas_lead','U') IS NULL
 CREATE TABLE dbo.fact_alternativas_aceptadas_lead (
  KeyTiempo int NOT NULL,
  KeyServicio int NOT NULL,
  KeySede int NOT NULL,
  KeyProfesional int NOT NULL,
  KeyHorarioPreferido int NOT NULL,
  KeyHorarioOfrecido int NOT NULL,
  alternativa_aceptada bigint NOT NULL,
  CONSTRAINT PK_fact_alternativas_aceptadas_lead PRIMARY KEY (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_Tiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_Sede FOREIGN KEY (KeySede) REFERENCES dbo.Dim_Sede(KeySede),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_Profesional FOREIGN KEY (KeyProfesional) REFERENCES dbo.Dim_Profesional(KeyProfesional),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_HorarioPreferido FOREIGN KEY (KeyHorarioPreferido) REFERENCES dbo.Dim_Horario(KeyHorario),
  CONSTRAINT FK_fact_alternativas_aceptadas_lead_HorarioOfrecido FOREIGN KEY (KeyHorarioOfrecido) REFERENCES dbo.Dim_Horario(KeyHorario),
  CONSTRAINT CK_fact_alternativas_aceptadas_lead_medidas CHECK (alternativa_aceptada>=0 AND alternativa_aceptada>0)
 );

IF OBJECT_ID('dbo.fact_alternativas_rechazadas_lead','U') IS NULL
 CREATE TABLE dbo.fact_alternativas_rechazadas_lead (
  KeyTiempo int NOT NULL,
  KeyServicio int NOT NULL,
  KeySede int NOT NULL,
  KeyProfesional int NOT NULL,
  KeyHorarioPreferido int NOT NULL,
  KeyHorarioOfrecido int NOT NULL,
  KeyMotivoRechazo int NOT NULL,
  alternativa_rechazada bigint NOT NULL,
  alternativa_rechazada_incompatibilidad bigint NOT NULL,
  CONSTRAINT PK_fact_alternativas_rechazadas_lead PRIMARY KEY (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_Tiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_Sede FOREIGN KEY (KeySede) REFERENCES dbo.Dim_Sede(KeySede),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_Profesional FOREIGN KEY (KeyProfesional) REFERENCES dbo.Dim_Profesional(KeyProfesional),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_HorarioPreferido FOREIGN KEY (KeyHorarioPreferido) REFERENCES dbo.Dim_Horario(KeyHorario),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_HorarioOfrecido FOREIGN KEY (KeyHorarioOfrecido) REFERENCES dbo.Dim_Horario(KeyHorario),
  CONSTRAINT FK_fact_alternativas_rechazadas_lead_MotivoRechazo FOREIGN KEY (KeyMotivoRechazo) REFERENCES dbo.Dim_MotivoRechazo(KeyMotivoRechazo),
  CONSTRAINT CK_fact_alternativas_rechazadas_lead_medidas CHECK (alternativa_rechazada>=0 AND alternativa_rechazada_incompatibilidad>=0 AND alternativa_rechazada_incompatibilidad<=alternativa_rechazada AND alternativa_rechazada>0)
 );

COMMIT TRANSACTION;
