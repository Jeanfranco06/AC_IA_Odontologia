-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Solo lecturas. Los bloqueos no reparan datos automáticamente.
IF EXISTS(SELECT 1 FROM dbo.TratamientosContratados WHERE estado_tratamiento NOT IN('Contratado','Activado',N'En ejecución','Suspendido','Completado','Cancelado')) THROW 56501,'Estados de tratamiento no compatibles; requiere decisión histórica explícita.',1;
IF EXISTS(SELECT 1 FROM dbo.Atenciones WHERE asistencia NOT IN('Pendiente','Confirmada',N'Asistió',N'No asistió','Asiste','No asiste')) THROW 56502,'Estados de asistencia no compatibles.',1;
IF EXISTS(SELECT 1 FROM dbo.InteraccionesIA WHERE actor_orientado NOT IN('PACIENTE','ODONTOLOGO','RECEPCION','ADMIN')) THROW 56503,'Actor histórico no compatible.',1;
IF EXISTS(SELECT id_tratamiento,numero_sesion FROM dbo.SesionesTratamiento GROUP BY id_tratamiento,numero_sesion HAVING COUNT(*)>1) THROW 56504,'Ordinales de sesión duplicados.',1;
IF EXISTS(SELECT id_tratamiento FROM dbo.PlanTratamiento WHERE es_vigente=1 GROUP BY id_tratamiento HAVING COUNT(*)>1) THROW 56505,'Más de un plan vigente.',1;
SELECT @@SERVERNAME serverName,DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') administrativeExecutor;
SELECT OBJECT_NAME(parent_object_id) tableName,name,is_not_trusted FROM sys.check_constraints WHERE is_not_trusted=1 OR is_disabled=1;
SELECT OBJECT_NAME(parent_object_id) tableName,name,is_not_trusted FROM sys.foreign_keys WHERE is_not_trusted=1 OR is_disabled=1;
USE [$(MartDatabase)];
IF EXISTS(SELECT ClaseEventoIA,id_origen_ia FROM dbo.Fact_InteraccionIACustomer GROUP BY ClaseEventoIA,id_origen_ia HAVING COUNT(*)>1) THROW 56506,'Grano de eventos duplicado.',1;
SELECT ClaseEventoIA,COUNT(*) unknownFacts FROM dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0 GROUP BY ClaseEventoIA;

USE [$(OltpDatabase)];
BEGIN TRANSACTION;
GO

-- Aplicar por administración únicamente; la aplicación no requiere DDL.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
-- El ejecutor de certificación rechaza referencias a bases operativas.
IF OBJECT_ID('dbo.PoliticasCustomerIA','U') IS NULL
CREATE TABLE dbo.PoliticasCustomerIA (
 id_politica INT IDENTITY PRIMARY KEY, codigo VARCHAR(60) NOT NULL, version INT NOT NULL,
 id_servicio INT NULL, estado VARCHAR(25) NOT NULL DEFAULT 'Borrador', configuracion NVARCHAR(MAX) NOT NULL,
 id_usuario_creador INT NOT NULL REFERENCES dbo.Usuarios(id_usuario),
 id_profesional_revisor INT NULL REFERENCES dbo.Profesionales(id_profesional),
 fecha_revision DATETIME2 NULL, fecha_publicacion DATETIME2 NULL,
 CONSTRAINT UQ_PoliticaCustomer UNIQUE(codigo,version),
 CONSTRAINT CK_PoliticaCustomer_JSON CHECK(ISJSON(configuracion)=1),
 CONSTRAINT CK_PoliticaCustomer_Publicacion CHECK(estado<>'Publicada' OR (id_profesional_revisor IS NOT NULL AND fecha_revision IS NOT NULL AND fecha_publicacion IS NOT NULL))
);
IF OBJECT_ID('dbo.SolicitudesCustomerIA','U') IS NULL
CREATE TABLE dbo.SolicitudesCustomerIA (
 id_solicitud INT IDENTITY PRIMARY KEY, tipo VARCHAR(30) NOT NULL,
 id_persona INT NOT NULL REFERENCES dbo.Personas(id_persona),
 id_tratamiento INT NULL REFERENCES dbo.TratamientosContratados(id_tratamiento),
 id_atencion INT NULL REFERENCES dbo.Atenciones(id_atencion),
 id_profesional INT NULL REFERENCES dbo.Profesionales(id_profesional),
 estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente', payload NVARCHAR(MAX) NOT NULL,
 clave_idempotencia VARCHAR(120) NOT NULL UNIQUE, id_correlacion VARCHAR(64) NOT NULL,
 fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(), fecha_revision DATETIME2 NULL,
 id_usuario_responsable INT NULL REFERENCES dbo.Usuarios(id_usuario), evidencia VARCHAR(500) NULL,
 CONSTRAINT CK_SolicitudCustomer_JSON CHECK(ISJSON(payload)=1),
 CONSTRAINT CK_SolicitudCustomer_Tipo CHECK(tipo IN ('AGENDAMIENTO','DERIVACION','CIERRE')),
 CONSTRAINT CK_SolicitudCustomer_Estado CHECK(estado IN ('Pendiente','En_Revision','Aprobada','Aplicada','Rechazada','Cancelada','Atendida','Resuelta'))
);
IF COL_LENGTH('dbo.SesionesTratamiento','confirmacion_paciente') IS NULL
 ALTER TABLE dbo.SesionesTratamiento ADD confirmacion_paciente VARCHAR(20) NOT NULL DEFAULT 'No_Solicitada', fecha_confirmacion DATETIME2 NULL;
IF COL_LENGTH('dbo.BorradoresIA','fecha_transferencia_ficha') IS NULL
 ALTER TABLE dbo.BorradoresIA ADD fecha_transferencia_ficha DATETIME2 NULL;
IF COL_LENGTH('dbo.ValidacionesFicha','id_politica_ia') IS NULL
 ALTER TABLE dbo.ValidacionesFicha ADD id_politica_ia INT NULL REFERENCES dbo.PoliticasCustomerIA(id_politica), huella_documental VARCHAR(64) NULL;
IF COL_LENGTH('dbo.Atenciones','revision_ficha') IS NULL ALTER TABLE dbo.Atenciones ADD revision_ficha INT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.ValidacionesFicha','revision_ficha') IS NULL ALTER TABLE dbo.ValidacionesFicha ADD revision_ficha INT NOT NULL DEFAULT 0;
-- Auditoría de staff sin inventar un paciente para satisfacer una FK.
ALTER TABLE dbo.InteraccionesIA ALTER COLUMN id_persona INT NULL;
IF COL_LENGTH('dbo.InteraccionesIA','id_usuario_actor') IS NULL
 ALTER TABLE dbo.InteraccionesIA ADD id_usuario_actor INT NULL REFERENCES dbo.Usuarios(id_usuario);
DECLARE @check SYSNAME;
DECLARE actor_checks CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.InteraccionesIA') AND definition LIKE '%actor_orientado%';
OPEN actor_checks; FETCH NEXT FROM actor_checks INTO @check;
WHILE @@FETCH_STATUS=0 BEGIN EXEC('ALTER TABLE dbo.InteraccionesIA DROP CONSTRAINT ['+@check+']'); FETCH NEXT FROM actor_checks INTO @check; END;
CLOSE actor_checks; DEALLOCATE actor_checks;
ALTER TABLE dbo.InteraccionesIA ADD CONSTRAINT CK_InteraccionesIA_ActorCompletion CHECK(actor_orientado IN ('PACIENTE','ODONTOLOGO','RECEPCION','ADMIN'));
IF OBJECT_ID('dbo.SesionesAccesoIA','U') IS NULL
CREATE TABLE dbo.SesionesAccesoIA (
 id_sesion VARCHAR(64) PRIMARY KEY, fecha_expiracion DATETIME2 NOT NULL, fecha_revocacion DATETIME2 NULL
);


GO

-- Reinstala los contratos de estado del DDL canónico con codificación UTF-8.
-- WITH CHECK rechaza datos históricos no equivalentes: no los reclasifica silenciosamente.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Tratamientos_Estado') ALTER TABLE dbo.TratamientosContratados DROP CONSTRAINT CK_Tratamientos_Estado;
ALTER TABLE dbo.TratamientosContratados WITH CHECK ADD CONSTRAINT CK_Tratamientos_Estado CHECK(estado_tratamiento IN('Contratado','Activado',N'En ejecución','Suspendido','Completado','Cancelado'));
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Atenciones_Asistencia') ALTER TABLE dbo.Atenciones DROP CONSTRAINT CK_Atenciones_Asistencia;
ALTER TABLE dbo.Atenciones WITH CHECK ADD CONSTRAINT CK_Atenciones_Asistencia CHECK(asistencia IN('Pendiente','Confirmada',N'Asistió',N'No asistió','Asiste','No asiste'));
COMMIT;


GO

CREATE OR ALTER PROCEDURE dbo.usp_ProgramarSesionTratamiento
    @id_tratamiento             INT,
    @numero_sesion              INT,
    @id_profesional             INT,
    @id_sede                    INT,
    @fecha_programada           DATETIME2,
    @duracion_min               INT = 45,
    @id_disponibilidad          INT = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @numero_sesion<=1 OR @duracion_min<=0 OR @fecha_programada<=SYSUTCDATETIME()
          THROW 55910,'Ordinal, duración o fecha no elegibles para nueva sesión CUSTOMER.',1;
        IF EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WITH(UPDLOCK,HOLDLOCK) WHERE id_tratamiento=@id_tratamiento AND numero_sesion=@numero_sesion)
          THROW 55911,'El ordinal ya está programado.',1;
        IF @id_disponibilidad IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.Disponibilidad WITH(UPDLOCK,HOLDLOCK) WHERE id_disponibilidad=@id_disponibilidad AND estado='Disponible' AND disponible=1 AND id_profesional=@id_profesional AND id_sede=@id_sede AND CAST(fecha AS DATE)=CAST(@fecha_programada AS DATE) AND CAST(hora_inicio AS TIME)=CAST(@fecha_programada AS TIME) AND DATEDIFF(MINUTE,hora_inicio,hora_fin)>=@duracion_min)
          THROW 55912,'Horario inexistente, incompatible o no disponible.',1;
        IF EXISTS(SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion=r.id_opcion WHERE o.id_disponibilidad=@id_disponibilidad)
          THROW 55913,'El horario pertenece a la reserva inicial PAYER.',1;


        DECLARE @estado_trat VARCHAR(30), @id_plan INT, @max_sesiones INT, @id_persona INT, @id_reserva_origen INT, @id_servicio INT;
        SELECT
            @estado_trat = t.estado_tratamiento,
            @id_persona = t.id_persona,
            @id_reserva_origen = t.id_reserva_origen,
            @id_servicio = t.id_servicio
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @estado_trat IS NULL
            THROW 55220, 'El tratamiento no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado', 'Completado')
            THROW 55221, 'No se pueden programar sesiones en un tratamiento Suspendido, Cancelado o Completado.', 1;

        SELECT TOP (1)
            @id_plan = id_plan,
            @max_sesiones = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @id_plan IS NULL OR @numero_sesion > @max_sesiones
            THROW 55222, 'El número de sesión excede las sesiones planificadas en el plan clínico vigente.', 1;

        -- R05: Validar que el profesional no tenga otra sesión activa solapada en el mismo horario
        DECLARE @fin_propuesto DATETIME2 = DATEADD(MINUTE, @duracion_min, @fecha_programada);

        IF EXISTS (
            SELECT 1
            FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.id_profesional = @id_profesional
              AND s.estado_programacion IN ('Programada', 'Reprogramada')
              AND s.estado_asistencial <> 'Inasistida'
              AND @fecha_programada < DATEADD(MINUTE, s.duracion_programada_min, s.fecha_programada_vigente)
              AND @fin_propuesto > s.fecha_programada_vigente
        )
        BEGIN
            THROW 55223, 'CONFLICTO DE AGENDA (R05): El profesional ya tiene una sesión asignada que se solapa con el horario solicitado.', 1;
        END;

        IF @id_disponibilidad IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM dbo.Disponibilidad WITH (UPDLOCK, HOLDLOCK)
                WHERE id_disponibilidad = @id_disponibilidad AND estado <> 'Disponible'
            )
            BEGIN
                THROW 55224, 'CONFLICTO DE SILLÓN (R05): El turno de disponibilidad seleccionado ya no se encuentra Disponible.', 1;
            END;

            UPDATE dbo.Disponibilidad
            SET estado = 'Ocupado'
            WHERE id_disponibilidad = @id_disponibilidad;
        END;

        DECLARE @id_sesion INT, @id_atencion INT;

        INSERT INTO dbo.SesionesTratamiento (
            id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede,
            id_disponibilidad, fecha_programada_vigente, duracion_programada_min,
            estado_programacion, estado_asistencial, estado_cierre
        )
        VALUES (
            @id_tratamiento, @id_plan, @numero_sesion, @id_profesional, @id_sede,
            @id_disponibilidad, @fecha_programada, @duracion_min,
            'Programada', 'Pendiente', 'Pendiente'
        );
        SET @id_sesion = SCOPE_IDENTITY();

        INSERT INTO dbo.EventosSesion (
            id_sesion, tipo_cambio, fecha_anterior, fecha_nueva,
            estado_anterior, estado_nuevo, motivo, id_usuario_responsable
        )
        VALUES (
            @id_sesion, 'CREACION', NULL, @fecha_programada,
            NULL, 'Programada', 'Programación de sesión #' + CAST(@numero_sesion AS VARCHAR(10)) + ' del tratamiento',
            @id_usuario_responsable
        );

        -- Crear registro de Atención programada vinculada a la sesión y a la reserva origen del contrato (sin duplicar Reservas: R03, R04)
        INSERT INTO dbo.Atenciones (
            id_persona, id_reserva, id_tratamiento, id_sesion, id_servicio,
            id_profesional, id_sede, fecha_atencion, asistencia,
            estado_servicio, estado_cierre_documental
        )
        VALUES (
            @id_persona, @id_reserva_origen, @id_tratamiento, @id_sesion, @id_servicio,
            @id_profesional, @id_sede, @fecha_programada, 'Pendiente',
            'Programado', 'Pendiente'
        );
        SET @id_atencion = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO

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


GO

CREATE OR ALTER TRIGGER dbo.TR_Atenciones_RevisionFicha ON dbo.Atenciones AFTER UPDATE AS
BEGIN
 SET NOCOUNT ON;
 IF UPDATE(motivo_consulta) OR UPDATE(antecedentes) OR UPDATE(alergias) OR UPDATE(evaluacion) OR UPDATE(procedimiento) OR UPDATE(observaciones) OR UPDATE(indicaciones_finales)
  UPDATE a SET revision_ficha=a.revision_ficha+1 FROM dbo.Atenciones a JOIN inserted i ON i.id_atencion=a.id_atencion;
END;


GO

CREATE OR ALTER PROCEDURE dbo.usp_CerrarTratamientoYTransicionarTurned
    @id_tratamiento             INT,
    @id_profesional_cierre      INT,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ahora DATETIME2 = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_persona INT, @estado_actual VARCHAR(30), @fecha_inicio DATETIME2;
        DECLARE @sesiones_plan INT, @sesiones_cerradas INT, @sesiones_pendientes_cierre INT;

        SELECT
            @id_persona = t.id_persona,
            @estado_actual = t.estado_tratamiento,
            @fecha_inicio = t.fecha_inicio_real
        FROM dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK)
        WHERE t.id_tratamiento = @id_tratamiento;

        IF @id_persona IS NULL
            THROW 55260, 'El tratamiento indicado no existe.', 1;

        IF NOT EXISTS(SELECT 1 FROM dbo.Profesionales p JOIN dbo.TratamientosContratados t ON t.id_profesional_responsable=p.id_profesional WHERE t.id_tratamiento=@id_tratamiento AND p.id_profesional=@id_profesional_cierre AND p.activo=1 AND p.numero_colegiatura IS NOT NULL)
            THROW 55920,'El cierre requiere al profesional responsable activo y colegiado.',1;
        IF @estado_actual = 'Completado'
        BEGIN
            COMMIT TRANSACTION;
            SELECT @id_tratamiento AS id_tratamiento, 'Completado' AS estado_tratamiento, 1 AS ya_cerrado;
            RETURN;
        END;

        IF @estado_actual <> 'En ejecución' OR @fecha_inicio IS NULL
            THROW 55261, 'CIERRE DE TRATAMIENTO (R13): Solo puede cerrarse como Completado un tratamiento que haya iniciado efectivamente.', 1;

        SELECT TOP (1) @sesiones_plan = sesiones_planificadas
        FROM dbo.PlanTratamiento
        WHERE id_tratamiento = @id_tratamiento AND es_vigente = 1;

        IF @sesiones_plan IS NULL OR @sesiones_plan<1
            THROW 55921,'Cierre sin plan vigente válido.',1;
        IF (SELECT COUNT(*) FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento)<>@sesiones_plan
           OR EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento AND (estado_asistencial<>'Realizada' OR estado_cierre<>'Cerrada' OR numero_sesion<1 OR numero_sesion>@sesiones_plan))
            THROW 55922,'Existen sesiones pendientes o excepciones que requieren revisión profesional.',1;
        IF EXISTS(SELECT 1 FROM dbo.Atenciones a OUTER APPLY(SELECT TOP(1) v.* FROM dbo.ValidacionesFicha v WHERE v.id_atencion=a.id_atencion ORDER BY numero_revision DESC)v WHERE a.id_tratamiento=@id_tratamiento AND (v.id_validacion IS NULL OR v.resultado_validacion<>'Completa' OR v.revision_ficha<>a.revision_ficha OR NOT EXISTS(SELECT 1 FROM dbo.PoliticasCustomerIA p WHERE p.id_politica=v.id_politica_ia AND p.estado='Publicada' AND p.codigo='DOCUMENTACION' AND p.id_servicio=a.id_servicio)))
            THROW 55923,'Validación documental no vigente para el cierre formal.',1;
        SELECT
            @sesiones_cerradas = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Cerrada' THEN 1 ELSE 0 END),
            @sesiones_pendientes_cierre = SUM(CASE WHEN estado_asistencial = 'Realizada' AND estado_cierre = 'Pendiente' THEN 1 ELSE 0 END)
        FROM dbo.SesionesTratamiento
        WHERE id_tratamiento = @id_tratamiento;

        IF ISNULL(@sesiones_pendientes_cierre, 0) > 0
            THROW 55262, 'CIERRE DE TRATAMIENTO (R13): Existen sesiones realizadas con cierre documental pendiente.', 1;

        IF ISNULL(@sesiones_cerradas, 0) < ISNULL(@sesiones_plan, 1)
            THROW 55263, 'CIERRE DE TRATAMIENTO (R12/R13): No se han completado todas las sesiones planificadas del plan clínico vigente.', 1;

        UPDATE dbo.TratamientosContratados
        SET estado_tratamiento = 'Completado',
            fecha_cierre_real = @ahora,
            id_profesional_cierre = @id_profesional_cierre,
            fecha_actualizacion = @ahora
        WHERE id_tratamiento = @id_tratamiento;

        -- Verificar si la persona tiene algún otro tratamiento activo antes de pasar su estado global a TURNED (Sección 12)
        DECLARE @otros_activos INT;
        SELECT @otros_activos = COUNT(*)
        FROM dbo.TratamientosContratados
        WHERE id_persona = @id_persona
          AND id_tratamiento <> @id_tratamiento
          AND estado_tratamiento IN ('Contratado', 'Activado', 'En ejecución');

        DECLARE @etapa_customer INT, @etapa_turned INT, @etapa_actual_persona INT;
        SELECT @etapa_customer = id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER';
        SELECT @etapa_turned = id_etapa FROM dbo.Etapas WHERE nombre = 'TURNED';
        SELECT @etapa_actual_persona = id_etapa_actual FROM dbo.Personas WITH (UPDLOCK) WHERE id_persona = @id_persona;

        IF @otros_activos = 0 AND @etapa_turned IS NOT NULL AND @etapa_actual_persona <> @etapa_turned
        BEGIN
            UPDATE dbo.Personas
            SET id_etapa_actual = @etapa_turned,
                fecha_actualizacion = @ahora
            WHERE id_persona = @id_persona;

            INSERT INTO dbo.EventosEtapa (
                id_persona, etapa_origen, etapa_destino, fecha_hora,
                id_usuario, motivo, evidencia
            )
            VALUES (
                @id_persona, @etapa_actual_persona, @etapa_turned, @ahora,
                @id_usuario_responsable, 'Tratamiento odontológico formalmente completado y cerrado',
                'Tratamiento #' + CAST(@id_tratamiento AS VARCHAR(20)) + ' (' + CAST(@sesiones_cerradas AS VARCHAR(10)) + ' sesiones cerradas)'
            );
        END;

        COMMIT TRANSACTION;
        SELECT
            @id_tratamiento AS id_tratamiento,
            'Completado' AS estado_tratamiento,
            @sesiones_cerradas AS sesiones_completadas,
            CASE WHEN @otros_activos = 0 THEN 'TURNED' ELSE 'CUSTOMER' END AS etapa_resultante,
            0 AS ya_cerrado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO

CREATE OR ALTER PROCEDURE dbo.usp_RegistrarEventoAsistencialSesion
    @id_sesion                  INT,
    @accion                     VARCHAR(30), -- 'CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION', 'CONFIRMAR_INASISTENCIA'
    @fecha_evento               DATETIME2 = NULL,
    @motivo_inasistencia        VARCHAR(300) = NULL,
    @procedimiento_principal    VARCHAR(200) = NULL,
    @evaluacion_clinica         VARCHAR(500) = NULL,
    @id_usuario_responsable     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @fecha_evento = ISNULL(@fecha_evento, SYSUTCDATETIME());

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @id_tratamiento INT, @id_reserva INT, @estado_trat VARCHAR(30), @es_habilitado INT, @motivo_guardian VARCHAR(100);
        DECLARE @estado_asist_ant VARCHAR(30), @id_atencion INT, @id_servicio INT, @id_prof INT;

        SELECT
            @id_tratamiento = s.id_tratamiento,
            @estado_asist_ant = s.estado_asistencial,
            @id_prof = s.id_profesional,
            @id_reserva = t.id_reserva_origen,
            @estado_trat = t.estado_tratamiento,
            @id_servicio = t.id_servicio
        FROM dbo.SesionesTratamiento s WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.TratamientosContratados t WITH (UPDLOCK, HOLDLOCK) ON t.id_tratamiento = s.id_tratamiento
        WHERE s.id_sesion = @id_sesion;

        IF @id_tratamiento IS NULL
            THROW 55240, 'La sesión indicada no existe.', 1;

        IF @estado_trat IN ('Suspendido', 'Cancelado')
            THROW 55241, 'El tratamiento se encuentra Suspendido o Cancelado; no puede ejecutarse la sesión.', 1;

        -- R02: Verificar siempre el guardián financiero antes de iniciar atención
        SELECT @es_habilitado = es_habilitado_customer, @motivo_guardian = motivo_guardian
        FROM dbo.fn_VerificarGuardianFinancieroCustomer(@id_reserva);

        IF @accion IN ('CONFIRMAR_LLEGADA', 'INICIAR_ATENCION', 'FINALIZAR_ATENCION') AND @es_habilitado <> 1
        BEGIN
            DECLARE @err VARCHAR(300) = 'GUARDIÁN FINANCIERO (R02): Atención bloqueada por incumplimiento financiero (' + ISNULL(@motivo_guardian, 'SIN_VALIDACION') + ').';
            THROW 55242, @err, 1;
        END;

        SELECT TOP (1) @id_atencion = id_atencion FROM dbo.Atenciones WHERE id_sesion = @id_sesion;

        IF @accion = 'CONFIRMAR_LLEGADA'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = @fecha_evento,
                estado_asistencial = 'Confirmada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'Confirmada'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'CONFIRMACION_ASISTENCIA', @estado_asist_ant, 'Confirmada', 'Llegada del paciente a sala de espera', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'INICIAR_ATENCION'
        BEGIN
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = ISNULL(fecha_llegada, @fecha_evento),
                fecha_inicio_atencion = @fecha_evento,
                estado_asistencial = 'Realizada'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = @fecha_evento,
                asistencia = 'Asistió',
                estado_servicio = 'En proceso'
            WHERE id_atencion = @id_atencion;

            -- Si es la primera atención efectiva del tratamiento, marcar fecha_inicio_real y estado 'En ejecución'
            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, @fecha_evento),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INICIO_ATENCION', @estado_asist_ant, 'Realizada', 'Ingreso del paciente a sillón odontológico', @id_usuario_responsable, @fecha_evento);
        END
        ELSE IF @accion = 'FINALIZAR_ATENCION'
        BEGIN
            -- R09: Una sesión realizada puede quedar pendiente de cierre documental
            UPDATE dbo.SesionesTratamiento
            SET fecha_llegada = fecha_llegada,
                fecha_inicio_atencion = fecha_inicio_atencion,
                estado_asistencial = 'Realizada',
                estado_cierre = 'Pendiente'
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET fecha_inicio = fecha_inicio,
                fecha_fin = @fecha_evento,
                asistencia = 'Asistió',
                estado_servicio = 'Realizado',
                procedimiento = COALESCE(@procedimiento_principal, procedimiento),
                procedimiento_realizado = COALESCE(@procedimiento_principal, procedimiento_realizado),
                evaluacion = COALESCE(@evaluacion_clinica, evaluacion),
                estado_cierre_documental = 'Pendiente'
            WHERE id_atencion = @id_atencion;

            IF @procedimiento_principal IS NOT NULL AND @id_atencion IS NOT NULL
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM dbo.DetalleProcedimiento WHERE id_atencion = @id_atencion AND procedimiento_realizado = @procedimiento_principal)
                BEGIN
                    INSERT INTO dbo.DetalleProcedimiento (id_atencion, id_servicio, procedimiento_realizado, fecha_registro, id_profesional)
                    VALUES (@id_atencion, @id_servicio, @procedimiento_principal, @fecha_evento, @id_prof);
                END;
            END;

            UPDATE dbo.TratamientosContratados
            SET fecha_inicio_real = ISNULL(fecha_inicio_real, DATEADD(MINUTE, -20, @fecha_evento)),
                estado_tratamiento = CASE WHEN estado_tratamiento IN ('Contratado', 'Activado') THEN 'En ejecución' ELSE estado_tratamiento END,
                fecha_actualizacion = @fecha_evento
            WHERE id_tratamiento = @id_tratamiento;
        END
        ELSE IF @accion = 'CONFIRMAR_INASISTENCIA'
        BEGIN
            IF NULLIF(LTRIM(RTRIM(@motivo_inasistencia)), '') IS NULL
                SET @motivo_inasistencia = 'Paciente no se presentó a la sesión programada (No-Show confirmado)';

            UPDATE dbo.SesionesTratamiento
            SET estado_asistencial = 'Inasistida',
                estado_cierre = 'No Aplica',
                motivo_inasistencia = @motivo_inasistencia
            WHERE id_sesion = @id_sesion;

            UPDATE dbo.Atenciones
            SET asistencia = 'No asistió',
                estado_servicio = 'Cancelado'
            WHERE id_atencion = @id_atencion;

            INSERT INTO dbo.EventosSesion (id_sesion, tipo_cambio, estado_anterior, estado_nuevo, motivo, id_usuario_responsable, fecha_operacion)
            VALUES (@id_sesion, 'INASISTENCIA', @estado_asist_ant, 'Inasistida', @motivo_inasistencia, @id_usuario_responsable, @fecha_evento);
        END
        ELSE
        BEGIN
            THROW 55243, 'Acción asistencial no reconocida.', 1;
        END;

        COMMIT TRANSACTION;
        SELECT @id_sesion AS id_sesion, @id_atencion AS id_atencion, @accion AS accion_ejecutada;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;


GO

USE [$(MartDatabase)];
GO

-- Migración del grano de evento: las versiones permanecen, solo la raíz genera una unidad.
-- Sin plan vigente el denominador es 0; no se inventa una sesión para satisfacer el CHECK.
ALTER TABLE dbo.Fact_TratamientoCustomer DROP CONSTRAINT CK_FactTrat_Sesiones;
ALTER TABLE dbo.Fact_TratamientoCustomer WITH CHECK ADD CONSTRAINT CK_FactTrat_Sesiones CHECK(sesiones_planificadas>=0 AND sesiones_completadas>=0);
ALTER TABLE dbo.Fact_InteraccionIACustomer DROP CONSTRAINT CK_FactIA_MedidasMutuamenteExcluyentes;
ALTER TABLE dbo.Fact_InteraccionIACustomer ALTER COLUMN id_persona INT NULL;
ALTER TABLE dbo.Fact_InteraccionIACustomer ADD CONSTRAINT CK_FactIA_MedidasMutuamenteExcluyentes CHECK (
 (ClaseEventoIA='INTERACCION' AND interacciones_registradas=1 AND alertas_generadas=0 AND alertas_atendidas=0 AND borradores_generados=0 AND borradores_aprobados=0)
 OR (ClaseEventoIA='ALERTA' AND interacciones_registradas=0 AND alertas_generadas=1 AND alertas_atendidas IN(0,1) AND borradores_generados=0 AND borradores_aprobados=0)
 OR (ClaseEventoIA='BORRADOR' AND interacciones_registradas=0 AND alertas_generadas=0 AND alertas_atendidas=0 AND borradores_generados IN(0,1) AND borradores_aprobados IN(0,1))
);
INSERT dbo.Dim_TipoUsuarioIA(CodigoTipoUsuarioIA,ActorOrientado,RolClinicoOperativo,CanalInteraccion)
SELECT c.codigo,c.codigo,c.codigo,'Aplicación autorizada' FROM (VALUES('PACIENTE'),('ODONTOLOGO'),('RECEPCION'),('ADMIN')) c(codigo)
WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_TipoUsuarioIA d WHERE d.CodigoTipoUsuarioIA=c.codigo);


GO


CREATE OR ALTER PROCEDURE dbo.usp_ETL_SincronizarCustomerMart
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FechaInicio DATETIME2 = SYSDATETIME();
    DECLARE @FilasOrigen INT = 0;
    DECLARE @FilasDestino INT = 0;
    DECLARE @AppLockResult INT;

    BEGIN TRANSACTION;

    EXEC @AppLockResult = sp_getapplock
        @Resource = 'ETL_NexoSalud_Customer_Lock',
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 30000;

    IF @AppLockResult < 0
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 56101, 'No se pudo obtener el bloqueo exclusivo para usp_ETL_SincronizarCustomerMart.', 1;
    END;

    BEGIN TRY
        -- --------------------------------------------------------------------
        -- 2.1. SINCRONIZACIÓN DE DIMENSIONES CONFORMADAS DESDE OLTP
        -- --------------------------------------------------------------------
        ;WITH FechasCustomerOLTP AS (
            SELECT CAST(fecha_contratacion AS DATE) AS fecha FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_contratacion IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_real AS DATE) FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_inicio_real IS NOT NULL
            UNION
            SELECT CAST(fecha_cierre_real AS DATE) FROM [$(OltpDatabase)].dbo.TratamientosContratados WHERE fecha_cierre_real IS NOT NULL
            UNION
            SELECT CAST(fecha_programada_vigente AS DATE) FROM [$(OltpDatabase)].dbo.SesionesTratamiento WHERE fecha_programada_vigente IS NOT NULL
            UNION
            SELECT CAST(fecha_inicio_atencion AS DATE) FROM [$(OltpDatabase)].dbo.SesionesTratamiento WHERE fecha_inicio_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_atencion AS DATE) FROM [$(OltpDatabase)].dbo.Atenciones WHERE fecha_atencion IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.InteraccionesIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.AlertasIA WHERE fecha_hora IS NOT NULL
            UNION
            SELECT CAST(fecha_hora AS DATE) FROM [$(OltpDatabase)].dbo.BorradoresIA WHERE fecha_hora IS NOT NULL
        )
        INSERT INTO dbo.Dim_Tiempo (KeyTiempo, id_fecha, Anio, Trimestre, Mes, Dia)
        SELECT
            YEAR(f.fecha) * 10000 + MONTH(f.fecha) * 100 + DAY(f.fecha),
            f.fecha,
            YEAR(f.fecha),
            DATEPART(QUARTER, f.fecha),
            MONTH(f.fecha),
            DAY(f.fecha)
        FROM FechasCustomerOLTP f
        WHERE f.fecha IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo dt WHERE dt.id_fecha = f.fecha);

        -- Sincronizar Dim_Sede por id_sede
        INSERT INTO dbo.Dim_Sede (id_sede, Sede, Distrito, Zona)
        SELECT s.id_sede, s.nombre, ISNULL(s.zona, 'Lima'), ISNULL(s.zona, 'Lima Metropolitana')
        FROM [$(OltpDatabase)].dbo.Sedes s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Sede ds WHERE ds.id_sede = s.id_sede);

        -- Sincronizar Dim_Servicio por id_servicio
        INSERT INTO dbo.Dim_Servicio (id_servicio, ServicioOdontologico, Categoria, Procedimiento)
        SELECT sv.id_servicio, sv.nombre, ISNULL(sv.descripcion, 'Odontología General'), sv.nombre
        FROM [$(OltpDatabase)].dbo.Servicios sv
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Servicio dsv WHERE dsv.id_servicio = sv.id_servicio);

        -- Sincronizar Dim_Profesional por id_profesional
        INSERT INTO dbo.Dim_Profesional (id_profesional, Odontologo, EspecialidadPrincipal)
        SELECT p.id_profesional, p.nombres + ' ' + p.apellidos, ISNULL(p.especialidad, 'Odontología General')
        FROM [$(OltpDatabase)].dbo.Profesionales p
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Profesional dp WHERE dp.id_profesional = p.id_profesional);

        -- Sincronizar combinaciones nuevas de Dim_EstadoAtencion
        INSERT INTO dbo.Dim_EstadoAtencion (EstadoFinal, Asistencia, EstadoCierreDocumental)
        SELECT DISTINCT
            a.estado_servicio,
            a.asistencia,
            ISNULL(a.estado_cierre_documental, 'Pendiente')
        FROM [$(OltpDatabase)].dbo.Atenciones a
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.Dim_EstadoAtencion da
            WHERE da.EstadoFinal = a.estado_servicio
              AND da.Asistencia = a.asistencia
        );

        -- --------------------------------------------------------------------
        -- 2.2. CARGA HECHO 1: dbo.Fact_TratamientoCustomer (Análisis A)
        -- Grano: 1 fila por id_tratamiento
        -- --------------------------------------------------------------------
        ;WITH SesionesCompletadasPorTratamiento AS (
            SELECT
                s.id_tratamiento,
                SUM(CASE WHEN s.estado_asistencial = 'Realizada' AND s.estado_cierre = 'Cerrada' THEN 1 ELSE 0 END) AS sesiones_completadas
            FROM [$(OltpDatabase)].dbo.SesionesTratamiento s
            GROUP BY s.id_tratamiento
        ),
        PlanVigentePorTratamiento AS (
            SELECT
                pt.id_tratamiento,
                pt.version_plan,
                pt.sesiones_planificadas,
                ROW_NUMBER() OVER (PARTITION BY pt.id_tratamiento ORDER BY pt.version_plan DESC) AS rn
            FROM [$(OltpDatabase)].dbo.PlanTratamiento pt
            WHERE pt.es_vigente = 1
        ),
        SourceTratamiento AS (
            SELECT
                t.id_tratamiento,
                t.id_persona,
                t.id_reserva_origen,
                ISNULL(pv.version_plan, 1) AS version_plan_vigente,
                ISNULL(dt_con.KeyTiempo, 0) AS KeyTiempoContratacion,
                ISNULL(dt_ini.KeyTiempo, 0) AS KeyTiempoInicio,
                ISNULL(dt_cie.KeyTiempo, 0) AS KeyTiempoCierre,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(det.KeyEstadoTratamiento, 0) AS KeyEstadoTratamiento,
                CASE
                    WHEN t.fecha_inicio_real IS NOT NULL OR t.estado_tratamiento IN ('En ejecución', 'Completado') THEN 1
                    ELSE 0
                END AS tratamientos_iniciados,
                CASE
                    WHEN t.estado_tratamiento = 'Completado'
                         AND t.fecha_inicio_real IS NOT NULL
                         AND t.fecha_cierre_real IS NOT NULL
                         AND t.fecha_cierre_real >= t.fecha_inicio_real
                    THEN 1
                    ELSE 0
                END AS tratamientos_completados,
                ISNULL(pv.sesiones_planificadas, 0) AS sesiones_planificadas,
                ISNULL(sc.sesiones_completadas, 0) AS sesiones_completadas,
                CASE
                    WHEN t.estado_tratamiento = 'Completado'
                         AND t.fecha_inicio_real IS NOT NULL
                         AND t.fecha_cierre_real IS NOT NULL
                         AND t.fecha_cierre_real >= t.fecha_inicio_real
                    THEN DATEDIFF(DAY, t.fecha_inicio_real, t.fecha_cierre_real)
                    ELSE NULL
                END AS dias_duracion_real
            FROM [$(OltpDatabase)].dbo.TratamientosContratados t
            LEFT JOIN PlanVigentePorTratamiento pv ON pv.id_tratamiento = t.id_tratamiento AND pv.rn = 1
            LEFT JOIN SesionesCompletadasPorTratamiento sc ON sc.id_tratamiento = t.id_tratamiento
            LEFT JOIN dbo.Dim_Tiempo dt_con ON dt_con.id_fecha = CAST(t.fecha_contratacion AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_ini ON dt_ini.id_fecha = CAST(t.fecha_inicio_real AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_cie ON dt_cie.id_fecha = CAST(t.fecha_cierre_real AS DATE)
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = t.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = t.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = t.id_profesional_responsable
            LEFT JOIN dbo.Dim_EstadoTratamiento det ON det.EstadoTratamiento = t.estado_tratamiento
        )
        MERGE dbo.Fact_TratamientoCustomer AS target
        USING SourceTratamiento AS src
        ON target.id_tratamiento = src.id_tratamiento
        WHEN MATCHED THEN
            UPDATE SET
                target.id_persona = src.id_persona,
                target.id_reserva_origen = src.id_reserva_origen,
                target.version_plan_vigente = src.version_plan_vigente,
                target.KeyTiempoContratacion = src.KeyTiempoContratacion,
                target.KeyTiempoInicio = src.KeyTiempoInicio,
                target.KeyTiempoCierre = src.KeyTiempoCierre,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoTratamiento = src.KeyEstadoTratamiento,
                target.tratamientos_iniciados = src.tratamientos_iniciados,
                target.tratamientos_completados = src.tratamientos_completados,
                target.sesiones_planificadas = src.sesiones_planificadas,
                target.sesiones_completadas = src.sesiones_completadas,
                target.dias_duracion_real = src.dias_duracion_real,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_tratamiento, id_persona, id_reserva_origen, version_plan_vigente,
                KeyTiempoContratacion, KeyTiempoInicio, KeyTiempoCierre,
                KeySede, KeyServicio, KeyProfesional, KeyEstadoTratamiento,
                tratamientos_iniciados, tratamientos_completados,
                sesiones_planificadas, sesiones_completadas, dias_duracion_real,
                fecha_corte_etl
            )
            VALUES (
                src.id_tratamiento, src.id_persona, src.id_reserva_origen, src.version_plan_vigente,
                src.KeyTiempoContratacion, src.KeyTiempoInicio, src.KeyTiempoCierre,
                src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoTratamiento,
                src.tratamientos_iniciados, src.tratamientos_completados,
                src.sesiones_planificadas, src.sesiones_completadas, src.dias_duracion_real,
                SYSDATETIME()
            );

        -- --------------------------------------------------------------------
        -- 2.3. CARGA HECHO 2: dbo.Fact_SesionCustomer (Análisis B)
        -- Grano: 1 fila por id_sesion
        -- --------------------------------------------------------------------
        ;WITH ReprogramacionesPorSesion AS (
            SELECT
                ev.id_sesion,
                SUM(CASE WHEN ev.tipo_cambio = 'REPROGRAMACION' THEN 1 ELSE 0 END) AS cant_reprogramaciones
            FROM [$(OltpDatabase)].dbo.EventosSesion ev
            GROUP BY ev.id_sesion
        ),
        SourceSesion AS (
            SELECT
                s.id_sesion,
                s.id_tratamiento,
                t.id_persona,
                s.numero_sesion,
                ISNULL(dt_prog.KeyTiempo, 0) AS KeyTiempoProgramada,
                ISNULL(dt_ejec.KeyTiempo, 0) AS KeyTiempoEjecucion,
                ISNULL(dh.KeyHora, 0) AS KeyHoraProgramada,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(des.KeyEstadoSesion, 0) AS KeyEstadoSesion,
                CASE WHEN s.estado_programacion IN ('Programada', 'Reprogramada') THEN 1 ELSE 0 END AS sesiones_programadas,
                CASE WHEN s.estado_asistencial = 'Realizada' THEN 1 ELSE 0 END AS sesiones_realizadas,
                CASE WHEN s.estado_asistencial = 'Inasistida' THEN 1 ELSE 0 END AS sesiones_inasistidas,
                ISNULL(rp.cant_reprogramaciones, 0) AS reprogramaciones_acumuladas,
                -- Prohibido inventar tiempo de espera cuando falta fecha_llegada o fecha_inicio_atencion
                CASE
                    WHEN s.fecha_llegada IS NOT NULL
                         AND s.fecha_inicio_atencion IS NOT NULL
                         AND s.fecha_inicio_atencion >= s.fecha_llegada
                    THEN DATEDIFF(MINUTE, s.fecha_llegada, s.fecha_inicio_atencion)
                    ELSE NULL
                END AS minutos_espera,
                -- Sesiones futuras pendientes no contaminan denominadores de asistencia (T16)
                CASE
                    WHEN s.estado_asistencial IN ('Realizada', 'Inasistida', 'En sala de espera', 'En atención') THEN 1
                    WHEN s.estado_programacion IN ('Programada', 'Reprogramada') AND s.fecha_programada_vigente <= SYSDATETIME() THEN 1
                    ELSE 0
                END AS sesion_evaluable,
                CASE
                    WHEN s.fecha_llegada IS NOT NULL
                         AND s.fecha_inicio_atencion IS NOT NULL
                         AND s.fecha_inicio_atencion >= s.fecha_llegada
                    THEN 1
                    ELSE 0
                END AS tiene_espera_medible
            FROM [$(OltpDatabase)].dbo.SesionesTratamiento s
            INNER JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = s.id_tratamiento
            LEFT JOIN ReprogramacionesPorSesion rp ON rp.id_sesion = s.id_sesion
            LEFT JOIN dbo.Dim_Tiempo dt_prog ON dt_prog.id_fecha = CAST(s.fecha_programada_vigente AS DATE)
            LEFT JOIN dbo.Dim_Tiempo dt_ejec ON dt_ejec.id_fecha = CAST(COALESCE(s.fecha_inicio_atencion, s.fecha_cierre_sesion) AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, s.fecha_programada_vigente) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = s.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = t.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = s.id_profesional
            LEFT JOIN dbo.Dim_EstadoSesion des ON des.EstadoProgramacion = s.estado_programacion
                                              AND des.EstadoAsistencial = s.estado_asistencial
                                              AND des.EstadoCierre = s.estado_cierre
        )
        MERGE dbo.Fact_SesionCustomer AS target
        USING SourceSesion AS src
        ON target.id_sesion = src.id_sesion
        WHEN MATCHED THEN
            UPDATE SET
                target.id_tratamiento = src.id_tratamiento,
                target.id_persona = src.id_persona,
                target.numero_sesion = src.numero_sesion,
                target.KeyTiempoProgramada = src.KeyTiempoProgramada,
                target.KeyTiempoEjecucion = src.KeyTiempoEjecucion,
                target.KeyHoraProgramada = src.KeyHoraProgramada,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoSesion = src.KeyEstadoSesion,
                target.sesiones_programadas = src.sesiones_programadas,
                target.sesiones_realizadas = src.sesiones_realizadas,
                target.sesiones_inasistidas = src.sesiones_inasistidas,
                target.reprogramaciones_acumuladas = src.reprogramaciones_acumuladas,
                target.minutos_espera = src.minutos_espera,
                target.sesion_evaluable = src.sesion_evaluable,
                target.tiene_espera_medible = src.tiene_espera_medible,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_sesion, id_tratamiento, id_persona, numero_sesion,
                KeyTiempoProgramada, KeyTiempoEjecucion, KeyHoraProgramada,
                KeySede, KeyServicio, KeyProfesional, KeyEstadoSesion,
                sesiones_programadas, sesiones_realizadas, sesiones_inasistidas,
                reprogramaciones_acumuladas, minutos_espera,
                sesion_evaluable, tiene_espera_medible, fecha_corte_etl
            )
            VALUES (
                src.id_sesion, src.id_tratamiento, src.id_persona, src.numero_sesion,
                src.KeyTiempoProgramada, src.KeyTiempoEjecucion, src.KeyHoraProgramada,
                src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoSesion,
                src.sesiones_programadas, src.sesiones_realizadas, src.sesiones_inasistidas,
                src.reprogramaciones_acumuladas, src.minutos_espera,
                src.sesion_evaluable, src.tiene_espera_medible, SYSDATETIME()
            );

        -- --------------------------------------------------------------------
        -- 2.4. CARGA HECHO 3: dbo.Fact_AtencionCustomer_V2 (Análisis C)
        -- Grano: 1 fila por id_atencion
        -- --------------------------------------------------------------------
        ;WITH ProcedimientosPorAtencion AS (
            SELECT
                dp.id_atencion,
                COUNT(dp.id_detalle_procedimiento) AS cant_procedimientos
            FROM [$(OltpDatabase)].dbo.DetalleProcedimiento dp
            GROUP BY dp.id_atencion
        ),
        IndicacionesPorAtencion AS (
            SELECT
                ind.id_atencion,
                SUM(CASE WHEN ind.es_version_vigente = 1 AND ind.estado = 'Documento emitido' THEN 1 ELSE 0 END) AS cant_indicaciones_emitidas
            FROM [$(OltpDatabase)].dbo.IndicacionesPostatencion ind
            GROUP BY ind.id_atencion
        ),
        PrimeraRevisionFicha AS (
            SELECT
                vf.id_atencion,
                vf.resultado_validacion
            FROM [$(OltpDatabase)].dbo.ValidacionesFicha vf
            WHERE vf.numero_revision = 1
        ),
        SourceAtencionV2 AS (
            SELECT
                a.id_atencion,
                a.id_sesion,
                a.id_tratamiento,
                a.id_persona,
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempoAtencion,
                ISNULL(dh.KeyHora, 0) AS KeyHoraAtencion,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(dea.KeyEstadoAtencion, 0) AS KeyEstadoAtencion,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste') AND a.estado_servicio IN ('Realizado', 'Finalizado') THEN 1
                    ELSE 0
                END AS atenciones_realizadas,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN DATEDIFF(MINUTE, a.fecha_inicio, a.fecha_fin)
                    ELSE NULL
                END AS minutos_consulta,
                -- C6: Evalúa estrictamente la primera revisión (numero_revision = 1) en ValidacionesFicha
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND vf1.resultado_validacion = 'Completa'
                    THEN 1
                    ELSE 0
                END AS fichas_completas,
                ISNULL(ind.cant_indicaciones_emitidas, 0) AS indicaciones_emitidas,
                ISNULL(proc_a.cant_procedimientos, 0) AS procedimientos_registrados,
                CASE
                    WHEN a.asistencia IN ('Asistió', 'Asiste')
                         AND a.estado_servicio IN ('Realizado', 'Finalizado')
                         AND a.fecha_inicio IS NOT NULL
                         AND a.fecha_fin IS NOT NULL
                         AND a.fecha_fin > a.fecha_inicio
                    THEN 1
                    ELSE 0
                END AS tiene_duracion_medible,
                CASE
                    WHEN ISNULL(ind.cant_indicaciones_emitidas, 0) >= 1 THEN 1
                    ELSE 0
                END AS atencion_con_indicacion_emitida
            FROM [$(OltpDatabase)].dbo.Atenciones a
            LEFT JOIN ProcedimientosPorAtencion proc_a ON proc_a.id_atencion = a.id_atencion
            LEFT JOIN IndicacionesPorAtencion ind ON ind.id_atencion = a.id_atencion
            LEFT JOIN PrimeraRevisionFicha vf1 ON vf1.id_atencion = a.id_atencion
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(a.fecha_atencion AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, COALESCE(a.fecha_inicio, a.fecha_atencion)) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = a.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = a.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = a.id_profesional
            LEFT JOIN dbo.Dim_EstadoAtencion dea ON dea.KeyEstadoAtencion = (
                SELECT TOP 1 d2.KeyEstadoAtencion
                FROM dbo.Dim_EstadoAtencion d2
                WHERE d2.EstadoFinal = a.estado_servicio AND d2.Asistencia = a.asistencia
                ORDER BY d2.KeyEstadoAtencion ASC
            )
        )
        MERGE dbo.Fact_AtencionCustomer_V2 AS target
        USING SourceAtencionV2 AS src
        ON target.id_atencion = src.id_atencion
        WHEN MATCHED THEN
            UPDATE SET
                target.id_sesion = src.id_sesion,
                target.id_tratamiento = src.id_tratamiento,
                target.id_persona = src.id_persona,
                target.KeyTiempoAtencion = src.KeyTiempoAtencion,
                target.KeyHoraAtencion = src.KeyHoraAtencion,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyEstadoAtencion = src.KeyEstadoAtencion,
                target.atenciones_realizadas = src.atenciones_realizadas,
                target.minutos_consulta = src.minutos_consulta,
                target.fichas_completas = src.fichas_completas,
                target.indicaciones_emitidas = src.indicaciones_emitidas,
                target.procedimientos_registrados = src.procedimientos_registrados,
                target.tiene_duracion_medible = src.tiene_duracion_medible,
                target.atencion_con_indicacion_emitida = src.atencion_con_indicacion_emitida,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                id_atencion, id_sesion, id_tratamiento, id_persona,
                KeyTiempoAtencion, KeyHoraAtencion, KeySede, KeyServicio, KeyProfesional, KeyEstadoAtencion,
                atenciones_realizadas, minutos_consulta, fichas_completas,
                indicaciones_emitidas, procedimientos_registrados,
                tiene_duracion_medible, atencion_con_indicacion_emitida, fecha_corte_etl
            )
            VALUES (
                src.id_atencion, src.id_sesion, src.id_tratamiento, src.id_persona,
                src.KeyTiempoAtencion, src.KeyHoraAtencion, src.KeySede, src.KeyServicio, src.KeyProfesional, src.KeyEstadoAtencion,
                src.atenciones_realizadas, src.minutos_consulta, src.fichas_completas,
                src.indicaciones_emitidas, src.procedimientos_registrados,
                src.tiene_duracion_medible, src.atencion_con_indicacion_emitida, SYSDATETIME()
            );

        -- --------------------------------------------------------------------
        -- 2.5. CARGA HECHO 4: dbo.Fact_InteraccionIACustomer (Análisis D)
        -- Grano: 1 fila por (ClaseEventoIA, id_origen_ia)
        -- --------------------------------------------------------------------
        -- Incorporar códigos realmente observados; no convertirlos en códigos académicos.
        -- Se conserva la granularidad (ClaseEventoIA, id_origen_ia) del hecho.
        ;WITH TiposObservados AS (
            SELECT tipo_evento AS Codigo, 'INTERACCION' AS Clase FROM [$(OltpDatabase)].dbo.InteraccionesIA
            UNION SELECT tipo_evento, 'ALERTA' FROM [$(OltpDatabase)].dbo.AlertasIA
            UNION SELECT tipo_evento, 'BORRADOR' FROM [$(OltpDatabase)].dbo.BorradoresIA
        ), TiposUnivocos AS (
            SELECT Codigo, MIN(Clase) AS Clase FROM TiposObservados
            WHERE LEN(Codigo) <= 60
            GROUP BY Codigo HAVING COUNT(DISTINCT Clase) = 1
        )
        INSERT INTO dbo.Dim_TipoInteraccionIA (
            CodigoTipoInteraccionIA, ClaseEventoIA, TipoInteraccionIA,
            PropositoOperativo, RequiereAprobacionHumana
        )
        SELECT s.Codigo, s.Clase, s.Codigo, 'Evento operativo observado en OLTP',
               CASE WHEN s.Clase = 'INTERACCION' THEN 0 ELSE 1 END
        FROM TiposUnivocos s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_TipoInteraccionIA d WHERE d.CodigoTipoInteraccionIA = s.Codigo);

        ;WITH EventosIAUnificados AS (
            -- A) InteraccionesIA
            SELECT
                'INTERACCION' AS ClaseEventoIA,
                i.id_interaccion_ia AS id_origen_ia,
                i.id_persona,
                i.id_tratamiento,
                i.id_sesion,
                i.id_atencion,
                COALESCE(i.id_profesional, t.id_profesional_responsable) AS id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                i.fecha_hora,
                i.tipo_evento AS CodigoTipoInteraccionIA,
                i.actor_orientado AS CodigoTipoUsuarioIA,
                CASE
                    WHEN i.estado = 'Aprobada' THEN 'INTERACCION_APROBADA'
                    WHEN i.estado = 'Derivada_Personal' THEN 'INTERACCION_DERIVADA_PERSONAL'
                    WHEN i.estado = 'En_Revision' THEN 'INTERACCION_EN_REVISION'
                    WHEN i.estado = 'Rechazada' THEN 'INTERACCION_RECHAZADA'
                    ELSE 'INTERACCION_COMPLETADA'
                END AS CodigoResultadoIA,
                1 AS interacciones_registradas,
                0 AS alertas_generadas,
                0 AS alertas_atendidas,
                0 AS borradores_generados,
                0 AS borradores_aprobados
            FROM [$(OltpDatabase)].dbo.InteraccionesIA i
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = i.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = i.id_atencion

            UNION ALL

            -- B) AlertasIA
            SELECT
                'ALERTA' AS ClaseEventoIA,
                al.id_alerta_ia AS id_origen_ia,
                al.id_persona,
                al.id_tratamiento,
                al.id_sesion,
                al.id_atencion,
                COALESCE(al.id_profesional, al.id_profesional_revisor, t.id_profesional_responsable) AS id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                al.fecha_hora,
                al.tipo_evento AS CodigoTipoInteraccionIA,
                'AUDITOR_CLINICO' AS CodigoTipoUsuarioIA,
                CASE
                    WHEN al.estado IN ('Atendida', 'Resuelta') THEN 'ALERTA_ATENDIDA'
                    WHEN al.estado = 'Descartada_Justificada' THEN 'ALERTA_DESCARTADA'
                    ELSE 'ALERTA_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                1 AS alertas_generadas,
                CASE WHEN al.estado IN ('Atendida', 'Resuelta') THEN 1 ELSE 0 END AS alertas_atendidas,
                0 AS borradores_generados,
                0 AS borradores_aprobados
            FROM [$(OltpDatabase)].dbo.AlertasIA al
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = al.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = al.id_atencion

            UNION ALL

            -- C) BorradoresIA
            SELECT
                'BORRADOR' AS ClaseEventoIA,
                b.id_borrador_ia AS id_origen_ia,
                b.id_persona,
                b.id_tratamiento,
                b.id_sesion,
                b.id_atencion,
                b.id_profesional,
                COALESCE(t.id_sede, a.id_sede) AS id_sede,
                COALESCE(t.id_servicio, a.id_servicio) AS id_servicio,
                b.fecha_hora,
                b.tipo_evento AS CodigoTipoInteraccionIA,
                'ODONTOLOGO' AS CodigoTipoUsuarioIA,
                CASE
                    WHEN b.estado = 'Aprobado' THEN 'BORRADOR_APROBADO'
                    WHEN b.estado = 'Corregido_Y_Aprobado' THEN 'BORRADOR_CORREGIDO_Y_APROBADO'
                    WHEN b.estado = 'Rechazado' THEN 'BORRADOR_RECHAZADO'
                    ELSE 'BORRADOR_PENDIENTE'
                END AS CodigoResultadoIA,
                0 AS interacciones_registradas,
                0 AS alertas_generadas,
                0 AS alertas_atendidas,
                CASE WHEN b.id_borrador_raiz IS NULL OR b.id_borrador_raiz = b.id_borrador_ia THEN 1 ELSE 0 END AS borradores_generados,
                CASE WHEN b.es_version_actual = 1 AND b.estado IN ('Aprobado', 'Corregido_Y_Aprobado') THEN 1 ELSE 0 END AS borradores_aprobados
            FROM [$(OltpDatabase)].dbo.BorradoresIA b
            LEFT JOIN [$(OltpDatabase)].dbo.TratamientosContratados t ON t.id_tratamiento = b.id_tratamiento
            LEFT JOIN [$(OltpDatabase)].dbo.Atenciones a ON a.id_atencion = b.id_atencion
        ),
        SourceIA AS (
            SELECT
                ev.ClaseEventoIA,
                ev.id_origen_ia,
                ev.id_persona,
                ev.id_tratamiento,
                ev.id_sesion,
                ev.id_atencion,
                ISNULL(dt.KeyTiempo, 0) AS KeyTiempoEvento,
                ISNULL(dh.KeyHora, 0) AS KeyHoraEvento,
                ISNULL(ds.KeySede, 0) AS KeySede,
                ISNULL(dsv.KeyServicio, 0) AS KeyServicio,
                ISNULL(dp.KeyProfesional, 0) AS KeyProfesional,
                ISNULL(dti.KeyTipoInteraccionIA, 0) AS KeyTipoInteraccionIA,
                ISNULL(dtu.KeyTipoUsuarioIA, 0) AS KeyTipoUsuarioIA,
                ISNULL(dr.KeyResultadoIA, 0) AS KeyResultadoIA,
                ev.interacciones_registradas,
                ev.alertas_generadas,
                ev.alertas_atendidas,
                ev.borradores_generados,
                ev.borradores_aprobados
            FROM EventosIAUnificados ev
            LEFT JOIN dbo.Dim_Tiempo dt ON dt.id_fecha = CAST(ev.fecha_hora AS DATE)
            LEFT JOIN dbo.Dim_Hora dh ON dh.KeyHora = (
                SELECT TOP 1 h2.KeyHora
                FROM dbo.Dim_Hora h2
                WHERE h2.Hora = DATEPART(HOUR, ev.fecha_hora) AND h2.KeyHora > 0
                ORDER BY h2.KeyHora ASC
            )
            LEFT JOIN dbo.Dim_Sede ds ON ds.id_sede = ev.id_sede
            LEFT JOIN dbo.Dim_Servicio dsv ON dsv.id_servicio = ev.id_servicio
            LEFT JOIN dbo.Dim_Profesional dp ON dp.id_profesional = ev.id_profesional
            LEFT JOIN dbo.Dim_TipoInteraccionIA dti ON dti.CodigoTipoInteraccionIA = ev.CodigoTipoInteraccionIA
            LEFT JOIN dbo.Dim_TipoUsuarioIA dtu ON dtu.CodigoTipoUsuarioIA = ev.CodigoTipoUsuarioIA
            LEFT JOIN dbo.Dim_ResultadoIA dr ON dr.CodigoResultadoIA = ev.CodigoResultadoIA
        )
        MERGE dbo.Fact_InteraccionIACustomer AS target
        USING SourceIA AS src
        ON target.ClaseEventoIA = src.ClaseEventoIA AND target.id_origen_ia = src.id_origen_ia
        WHEN MATCHED THEN
            UPDATE SET
                target.id_persona = src.id_persona,
                target.id_tratamiento = src.id_tratamiento,
                target.id_sesion = src.id_sesion,
                target.id_atencion = src.id_atencion,
                target.KeyTiempoEvento = src.KeyTiempoEvento,
                target.KeyHoraEvento = src.KeyHoraEvento,
                target.KeySede = src.KeySede,
                target.KeyServicio = src.KeyServicio,
                target.KeyProfesional = src.KeyProfesional,
                target.KeyTipoInteraccionIA = src.KeyTipoInteraccionIA,
                target.KeyTipoUsuarioIA = src.KeyTipoUsuarioIA,
                target.KeyResultadoIA = src.KeyResultadoIA,
                target.interacciones_registradas = src.interacciones_registradas,
                target.alertas_generadas = src.alertas_generadas,
                target.alertas_atendidas = src.alertas_atendidas,
                target.borradores_generados = src.borradores_generados,
                target.borradores_aprobados = src.borradores_aprobados,
                target.fecha_corte_etl = SYSDATETIME()
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (
                ClaseEventoIA, id_origen_ia, id_persona, id_tratamiento, id_sesion, id_atencion,
                KeyTiempoEvento, KeyHoraEvento, KeySede, KeyServicio, KeyProfesional,
                KeyTipoInteraccionIA, KeyTipoUsuarioIA, KeyResultadoIA,
                interacciones_registradas, alertas_generadas, alertas_atendidas,
                borradores_generados, borradores_aprobados, fecha_corte_etl
            )
            VALUES (
                src.ClaseEventoIA, src.id_origen_ia, src.id_persona, src.id_tratamiento, src.id_sesion, src.id_atencion,
                src.KeyTiempoEvento, src.KeyHoraEvento, src.KeySede, src.KeyServicio, src.KeyProfesional,
                src.KeyTipoInteraccionIA, src.KeyTipoUsuarioIA, src.KeyResultadoIA,
                src.interacciones_registradas, src.alertas_generadas, src.alertas_atendidas,
                src.borradores_generados, src.borradores_aprobados, SYSDATETIME()
            );

        -- --------------------------------------------------------------------
        -- 2.6. COMPATIBILIDAD CON dbo.fact_atencion_customer (SECCIÓN 8.6, H08)
        -- --------------------------------------------------------------------
        -- Hecho agregado legado preservado; sin reconstrucción destructiva.
        DECLARE @OLTP_Trat INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.TratamientosContratados);
        DECLARE @Mart_Trat INT = (SELECT COUNT(*) FROM dbo.Fact_TratamientoCustomer);

        DECLARE @OLTP_Ses INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.SesionesTratamiento);
        DECLARE @Mart_Ses INT = (SELECT COUNT(*) FROM dbo.Fact_SesionCustomer);

        DECLARE @OLTP_Aten INT = (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.Atenciones);
        DECLARE @Mart_Aten INT = (SELECT COUNT(*) FROM dbo.Fact_AtencionCustomer_V2);

        DECLARE @OLTP_IA INT = (
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.InteraccionesIA) +
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.AlertasIA) +
            (SELECT COUNT(*) FROM [$(OltpDatabase)].dbo.BorradoresIA)
        );
        DECLARE @Mart_IA INT = (SELECT COUNT(*) FROM dbo.Fact_InteraccionIACustomer);

        IF @OLTP_Trat <> @Mart_Trat OR @OLTP_Ses <> @Mart_Ses OR @OLTP_Aten <> @Mart_Aten OR @OLTP_IA <> @Mart_IA
        BEGIN
            THROW 56102, 'Error de reconciliación en usp_ETL_SincronizarCustomerMart: Conteos OLTP y Data Mart no coinciden.', 1;
        END;

        SET @FilasOrigen = @OLTP_Trat + @OLTP_Ses + @OLTP_Aten + @OLTP_IA;
        SET @FilasDestino = @Mart_Trat + @Mart_Ses + @Mart_Aten + @Mart_IA;

        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES (
            'usp_ETL_SincronizarCustomerMart',
            @FechaInicio,
            SYSDATETIME(),
            'EXITOSO',
            @FilasOrigen,
            @FilasDestino,
            'Reconciliación exacta: Tratamientos=' + CAST(@Mart_Trat AS VARCHAR(10))
                + ', Sesiones=' + CAST(@Mart_Ses AS VARCHAR(10))
                + ', Atenciones=' + CAST(@Mart_Aten AS VARCHAR(10))
                + ', EventosIA=' + CAST(@Mart_IA AS VARCHAR(10))
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsgCustomer NVARCHAR(4000) = ERROR_MESSAGE();
        INSERT INTO dbo.ETL_EjecucionLog (proceso, fecha_inicio, fecha_fin, estado, filas_origen, filas_destino, mensaje)
        VALUES ('usp_ETL_SincronizarCustomerMart', @FechaInicio, SYSDATETIME(), 'ERROR', @FilasOrigen, @FilasDestino, LEFT(@ErrMsgCustomer, 500));

        THROW;
    END CATCH;
END;


GO
COMMIT TRANSACTION;
GO
