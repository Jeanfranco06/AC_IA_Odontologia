-- Bloque OLTP de database/buyer_revision/semana9/migracion_buyer.sql.
-- Se ejecuta exclusivamente desde APLICAR_BUYER_LEAD.sql. No incluye el tramo Mart.
IF @@TRANCOUNT <> 1 OR ISNULL(TRY_CONVERT(int,SESSION_CONTEXT(N'instalacion_buyer_lead')),0) <> 1
 THROW 54610,'Ejecute el punto de entrada APLICAR_BUYER_LEAD.sql.',1;
GO
IF OBJECT_ID('dbo.CaptacionesBuyer','U') IS NULL
CREATE TABLE dbo.CaptacionesBuyer (
    id_captacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CaptacionesBuyer PRIMARY KEY,
    id_persona INT NOT NULL,
    fecha_captacion DATETIME2 NOT NULL,
    id_canal INT NULL REFERENCES dbo.Canales(id_canal),
    id_fuente INT NULL REFERENCES dbo.Fuentes(id_fuente),
    id_campana INT NULL REFERENCES dbo.Campanas(id_campana),
    id_sede INT NULL REFERENCES dbo.Sedes(id_sede),
    id_servicio INT NULL REFERENCES dbo.Servicios(id_servicio),
    motivo_consulta NVARCHAR(500) NULL,
    estado_calidad VARCHAR(20) NOT NULL,
    autoriza_contacto BIT NOT NULL CONSTRAINT DF_CaptacionesBuyer_Autoriza DEFAULT 0,
    fecha_autorizacion DATETIME2 NULL,
    origen_datos VARCHAR(30) NOT NULL,
    fecha_observacion DATETIME2 NOT NULL CONSTRAINT DF_CaptacionesBuyer_Observacion DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_CaptacionesBuyer_Persona UNIQUE (id_persona),
    CONSTRAINT FK_CaptacionesBuyer_Persona FOREIGN KEY (id_persona) REFERENCES dbo.Personas(id_persona),
    CONSTRAINT CK_CaptacionesBuyer_Calidad CHECK
        (estado_calidad IN ('Valido','Incompleto','Duplicado','Rechazado')),
    CONSTRAINT CK_CaptacionesBuyer_Origen CHECK
        (origen_datos IN ('REGISTRO_DIRECTO','HISTORICO_OBSERVADO'))
);
GO
IF COL_LENGTH('dbo.EventosEtapa','id_captacion') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD id_captacion INT NULL
        CONSTRAINT FK_EventosEtapa_CaptacionBuyer REFERENCES dbo.CaptacionesBuyer(id_captacion);
GO
IF COL_LENGTH('dbo.EventosEtapa','id_solicitud') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD id_solicitud INT NULL
        CONSTRAINT FK_EventosEtapa_SolicitudBuyer REFERENCES dbo.Solicitudes(id_solicitud);
GO
IF COL_LENGTH('dbo.EventosEtapa','clave_operacion_buyer') IS NULL
    ALTER TABLE dbo.EventosEtapa ADD clave_operacion_buyer VARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.EventosEtapa')
               AND name='UQ_EventosEtapa_OperacionBuyer')
    CREATE UNIQUE INDEX UQ_EventosEtapa_OperacionBuyer
    ON dbo.EventosEtapa(clave_operacion_buyer) WHERE clave_operacion_buyer IS NOT NULL;
GO
-- Campos opcionales para enlazar las recomendaciones futuras del agente.
IF COL_LENGTH('dbo.DecisionesIA','id_captacion') IS NULL
    ALTER TABLE dbo.DecisionesIA ADD id_captacion INT NULL
        CONSTRAINT FK_DecisionesIA_CaptacionBuyer REFERENCES dbo.CaptacionesBuyer(id_captacion);
GO
IF COL_LENGTH('dbo.DecisionesIA','id_interaccion') IS NULL
    ALTER TABLE dbo.DecisionesIA ADD id_interaccion INT NULL
        CONSTRAINT FK_DecisionesIA_InteraccionBuyer REFERENCES dbo.Interacciones(id_interaccion);
GO
-- Consulta de preparacion: no usa Solicitudes ni etapa actual para convertir.
CREATE OR ALTER VIEW dbo.v_DatosCaptacionBuyer AS
SELECT c.id_captacion,c.id_persona,c.fecha_captacion,c.id_canal,COALESCE(c.id_fuente,ca.id_fuente) AS id_fuente,
       c.id_campana,c.id_sede,c.id_servicio,c.estado_calidad,c.autoriza_contacto,
       c.origen_datos,ev.id_evento_etapa AS id_evento_conversion,
       ev.fecha_hora AS fecha_conversion,
       contacto_registrado=1,
       contacto_utilizable=CASE WHEN c.estado_calidad='Valido' AND c.autoriza_contacto=1
           AND NULLIF(LTRIM(RTRIM(p.nombres)),'') IS NOT NULL
           AND NULLIF(LTRIM(RTRIM(p.apellidos)),'') IS NOT NULL
           AND (NULLIF(LTRIM(RTRIM(p.numero)),'') IS NOT NULL
                OR NULLIF(LTRIM(RTRIM(p.email)),'') IS NOT NULL)
           THEN 1 ELSE 0 END
FROM dbo.CaptacionesBuyer c
JOIN dbo.Personas p ON p.id_persona=c.id_persona
LEFT JOIN dbo.Campanas ca ON ca.id_campana=c.id_campana
OUTER APPLY (
    SELECT TOP (1) e.id_evento_etapa,e.fecha_hora
    FROM dbo.EventosEtapa e
    JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen AND eo.nombre='BUYER'
    JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino AND ed.nombre='LEAD'
    WHERE e.id_persona=c.id_persona AND e.fecha_hora>=c.fecha_captacion
      AND (e.id_captacion=c.id_captacion OR e.id_captacion IS NULL)
    ORDER BY e.fecha_hora,e.id_evento_etapa
) ev;
GO
-- Operacion futura del backend: escritura atomica y reintentos idempotentes.
-- No la invoca automaticamente el ETL ni concede autorizacion.
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.usp_ConvertirBuyerALead
    @id_captacion INT,
    @id_servicio INT,
    @motivo NVARCHAR(200),
    @id_usuario INT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @persona INT,@buyer INT,@lead INT,@actual INT,@solicitud INT,
                @evento INT,@fecha DATETIME2=SYSDATETIME(),@captacion DATETIME2;
        SELECT @persona=c.id_persona,@captacion=c.fecha_captacion
        FROM dbo.CaptacionesBuyer c WITH (UPDLOCK,HOLDLOCK)
        WHERE c.id_captacion=@id_captacion;
        IF @persona IS NULL THROW 51001,'Captacion inexistente.',1;
        IF @captacion>@fecha THROW 51008,'La captacion tiene fecha futura.',1;
        SELECT @buyer=id_etapa FROM dbo.Etapas WHERE nombre='BUYER';
        SELECT @lead=id_etapa FROM dbo.Etapas WHERE nombre='LEAD';
        IF @buyer IS NULL OR @lead IS NULL THROW 51002,'Faltan etapas BUYER/LEAD.',1;
        SELECT TOP (1) @evento=id_evento_etapa,@solicitud=id_solicitud
        FROM dbo.EventosEtapa WHERE id_persona=@persona
          AND etapa_origen=@buyer AND etapa_destino=@lead
          AND fecha_hora>=@captacion AND fecha_hora<=@fecha
          AND (id_captacion=@id_captacion OR id_captacion IS NULL)
        ORDER BY fecha_hora,id_evento_etapa;
        IF @evento IS NOT NULL
        BEGIN
            COMMIT;
            SELECT @evento AS id_evento_etapa,@solicitud AS id_solicitud,1 AS ya_convertido;
            RETURN;
        END;
        SELECT @actual=id_etapa_actual FROM dbo.Personas WITH (UPDLOCK,HOLDLOCK)
        WHERE id_persona=@persona;
        IF @actual<>@buyer THROW 51003,'La persona no esta en BUYER; no retroceder fases.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.v_DatosCaptacionBuyer
                       WHERE id_captacion=@id_captacion AND contacto_utilizable=1)
            THROW 51004,'Captacion sin datos minimos o autorizacion verificable.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Personas WHERE id_persona=@persona
                       AND autoriza_contacto=1 AND estado_calidad='Valido')
            THROW 51005,'Autorizacion revocada o calidad actual no valida.',1;
        IF NULLIF(LTRIM(RTRIM(@motivo)),'') IS NULL
            THROW 51006,'Se requiere motivo de intencion concreta.',1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE id_servicio=@id_servicio AND activo=1)
            THROW 51007,'Servicio no valido.',1;
        INSERT dbo.Solicitudes (id_persona,id_servicio,motivo,estado,fecha_solicitud)
        VALUES (@persona,@id_servicio,@motivo,'Abierta',@fecha);
        SET @solicitud=SCOPE_IDENTITY();
        INSERT dbo.EventosEtapa
            (id_persona,etapa_origen,etapa_destino,fecha_hora,id_usuario,motivo,evidencia,
             id_captacion,id_solicitud,clave_operacion_buyer)
        VALUES (@persona,@buyer,@lead,@fecha,@id_usuario,@motivo,
                'Conversion validada desde captacion inicial',@id_captacion,@solicitud,
                'BUYER_LEAD:'+CAST(@id_captacion AS VARCHAR(20)));
        SET @evento=SCOPE_IDENTITY();
        UPDATE dbo.Personas SET id_etapa_actual=@lead,fecha_actualizacion=@fecha
        WHERE id_persona=@persona;
        COMMIT;
        SELECT @evento AS id_evento_etapa,@solicitud AS id_solicitud,0 AS ya_convertido;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK;
        THROW;
    END CATCH;
END;
GO
