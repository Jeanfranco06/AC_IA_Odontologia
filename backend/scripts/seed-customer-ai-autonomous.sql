-- ====================================================================
-- ARCHIVO: seed-customer-ai-autonomous.sql
-- FASE: CUSTOMER — Fixture Sintético Autónomo y Reproducible
-- BASE DE DATOS REQUERIDA: NexoSaludDB_Test (EXCLUSIVA)
-- ====================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- 1. SALVAGUARDA DE SEGURIDAD ESTRICTA
IF DB_NAME() <> N'NexoSaludDB_Test'
BEGIN
    THROW 55091, 'EJECUCION BLOQUEADA: Este script solo puede ejecutarse en la base NexoSaludDB_Test.', 1;
END;

IF IS_SRVROLEMEMBER(N'sysadmin') = 1
BEGIN
    THROW 55092, 'EJECUCION BLOQUEADA: No se permite ejecutar el fixture con credenciales de sysadmin. Use NexoSaludCustomerTest.', 1;
END;

BEGIN TRANSACTION;

-- 2. LIMPIEZA IDEMPOTENTE PREVENTIVA DE DATOS SINTETICOS PREVIOS
DECLARE @DnisSinteticos TABLE (dni VARCHAR(20));
INSERT INTO @DnisSinteticos VALUES ('99000001'), ('99000002'), ('99000003'), ('99000004'), ('99000005');

-- Borrar registros de IA derivados
DELETE FROM dbo.SolicitudesReprogramacionCustomer WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.BorradoresIA WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.AlertasIA WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.InteraccionesIA WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));

-- Borrar registros asistenciales y clínicos
DELETE FROM dbo.IndicacionesPostatencion WHERE id_atencion IN (SELECT id_atencion FROM dbo.Atenciones WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));

DISABLE TRIGGER dbo.TR_ValidacionesFicha_InmutabilidadRev1 ON dbo.ValidacionesFicha;
DELETE FROM dbo.ValidacionesFicha WHERE id_atencion IN (SELECT id_atencion FROM dbo.Atenciones WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));
ENABLE TRIGGER dbo.TR_ValidacionesFicha_InmutabilidadRev1 ON dbo.ValidacionesFicha;

DELETE FROM dbo.DetalleProcedimiento WHERE id_atencion IN (SELECT id_atencion FROM dbo.Atenciones WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));
DELETE FROM dbo.EventosSesion WHERE id_sesion IN (SELECT id_sesion FROM dbo.SesionesTratamiento WHERE id_tratamiento IN (SELECT id_tratamiento FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos))));
DELETE FROM dbo.Atenciones WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.SesionesTratamiento WHERE id_tratamiento IN (SELECT id_tratamiento FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));

DISABLE TRIGGER dbo.TR_PlanTratamiento_ProtegerHistorial ON dbo.PlanTratamiento;
DELETE FROM dbo.PlanTratamiento WHERE id_tratamiento IN (SELECT id_tratamiento FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));
ENABLE TRIGGER dbo.TR_PlanTratamiento_ProtegerHistorial ON dbo.PlanTratamiento;
DELETE FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.Pagos WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.Reservas WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.Opciones WHERE id_solicitud IN (SELECT id_solicitud FROM dbo.Solicitudes WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos)));
DELETE FROM dbo.Solicitudes WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos));
DELETE FROM dbo.Personas WHERE dni IN (SELECT dni FROM @DnisSinteticos);

-- Limpiar disponibilidades sintéticas de prueba
DELETE FROM dbo.Disponibilidad WHERE fecha BETWEEN '2026-12-01' AND '2026-12-31';

-- 3. VERIFICAR / ASEGURAR CATALOGOS BASE
DECLARE @id_sede INT = (SELECT TOP 1 id_sede FROM dbo.Sedes WHERE activo = 1);
IF @id_sede IS NULL
BEGIN
    INSERT INTO dbo.Sedes (nombre, direccion, activo) VALUES ('Sede Miraflores Test', 'Av. Larco 1000', 1);
    SET @id_sede = SCOPE_IDENTITY();
END;

DECLARE @id_servicio INT = (SELECT TOP 1 id_servicio FROM dbo.Servicios WHERE activo = 1);
IF @id_servicio IS NULL
BEGIN
    INSERT INTO dbo.Servicios (nombre, descripcion, activo) VALUES ('Ortodoncia Integral Test', 'Tratamiento correctivo multisesión', 1);
    SET @id_servicio = SCOPE_IDENTITY();
END;

DECLARE @id_profesional INT = (SELECT TOP 1 id_profesional FROM dbo.Profesionales WHERE activo = 1 AND numero_colegiatura IS NOT NULL);
IF @id_profesional IS NULL
BEGIN
    INSERT INTO dbo.Profesionales (nombres, apellidos, numero_colegiatura, especialidad, activo)
    VALUES ('Carlos Alberto', 'Mendoza Quispe', 'COP-25410', 'Ortodoncia', 1);
    SET @id_profesional = SCOPE_IDENTITY();
END;

DECLARE @id_profesional_2 INT = (SELECT TOP 1 id_profesional FROM dbo.Profesionales WHERE activo = 1 AND id_profesional <> @id_profesional);
IF @id_profesional_2 IS NULL
BEGIN
    INSERT INTO dbo.Profesionales (nombres, apellidos, numero_colegiatura, especialidad, activo)
    VALUES ('Ana Maria', 'Flores Soto', 'COP-30112', 'Rehabilitacion Oral', 1);
    SET @id_profesional_2 = SCOPE_IDENTITY();
END;

DECLARE @id_rol_recepcion INT = (SELECT id_rol FROM dbo.Roles WHERE nombre IN ('Recepcion', 'RECEPCION', 'Recepcionista'));
IF @id_rol_recepcion IS NULL
BEGIN
    INSERT INTO dbo.Roles (nombre) VALUES ('Recepcion');
    SET @id_rol_recepcion = SCOPE_IDENTITY();
END;

DECLARE @id_usuario_recepcion INT = (SELECT id_usuario FROM dbo.Usuarios WHERE email = 'recepcion.test@nexosalud.pe');
IF @id_usuario_recepcion IS NULL
BEGIN
    INSERT INTO dbo.Usuarios (nombres, apellidos, email, password_hash, id_rol, activo)
    VALUES ('Recepcionista', 'TurnoMañana', 'recepcion.test@nexosalud.pe', 'pbkdf2$120000$abcdef1234567890abcdef1234567890$0000000000000000000000000000000000000000000000000000000000000000', @id_rol_recepcion, 1);
    SET @id_usuario_recepcion = SCOPE_IDENTITY();
END;

DECLARE @id_rol_odontologo INT = (SELECT id_rol FROM dbo.Roles WHERE nombre = 'Odontologo');
IF @id_rol_odontologo IS NULL
BEGIN
    INSERT INTO dbo.Roles (nombre) VALUES ('Odontologo');
    SET @id_rol_odontologo = SCOPE_IDENTITY();
END;

DECLARE @id_usuario_odontologo INT = (SELECT id_usuario FROM dbo.Usuarios WHERE id_profesional = @id_profesional);
IF @id_usuario_odontologo IS NULL
BEGIN
    INSERT INTO dbo.Usuarios (nombres, apellidos, email, password_hash, id_rol, id_profesional, activo)
    VALUES ('Carlos', 'Mendoza', 'carlos.mendoza@nexosalud.pe', 'pbkdf2$120000$abcdef1234567890abcdef1234567890$0000000000000000000000000000000000000000000000000000000000000000', @id_rol_odontologo, @id_profesional, 1);
    SET @id_usuario_odontologo = SCOPE_IDENTITY();
END;

DECLARE @id_rol_admin INT = (SELECT id_rol FROM dbo.Roles WHERE nombre IN ('Administrador', 'Admin'));
IF @id_rol_admin IS NULL
BEGIN
    INSERT INTO dbo.Roles (nombre) VALUES ('Administrador');
    SET @id_rol_admin = SCOPE_IDENTITY();
END;

DECLARE @id_usuario_admin INT = (SELECT id_usuario FROM dbo.Usuarios WHERE id_rol = @id_rol_admin AND activo = 1);
IF @id_usuario_admin IS NULL
BEGIN
    INSERT INTO dbo.Usuarios (nombres, apellidos, email, password_hash, id_rol, activo)
    VALUES ('Admin', 'Sistema', 'admin.test@nexosalud.pe', 'pbkdf2$120000$abcdef1234567890abcdef1234567890$0000000000000000000000000000000000000000000000000000000000000000', @id_rol_admin, 1);
    SET @id_usuario_admin = SCOPE_IDENTITY();
END;

-- 4. ETAPAS
DECLARE @id_etapa_customer INT = (SELECT id_etapa FROM dbo.Etapas WHERE nombre = 'CUSTOMER');
DECLARE @id_etapa_payer INT = (SELECT id_etapa FROM dbo.Etapas WHERE nombre = 'PAYER');

-- 5. CREACION DE PACIENTE 1 SINTETICO (Flujo Completo CUSTOMER)
DECLARE @p1_persona INT, @p1_disp INT, @p1_sol INT, @p1_opc INT, @p1_res INT, @p1_pago INT;
DECLARE @p1_trat INT, @p1_plan INT, @p1_ses1 INT, @p1_ses2 INT, @p1_ses3 INT;
DECLARE @p1_aten1 INT;

INSERT INTO dbo.Personas (nombres, apellidos, dni, email, numero, zona, autoriza_contacto, estado_calidad, id_etapa_actual)
VALUES ('Juan', 'Perez Sintetico', '99000001', 'juan.perez.test@nexosalud.pe', '991111111', 'Lima Moderna', 1, 'Valido', @id_etapa_customer);
SET @p1_persona = SCOPE_IDENTITY();

INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
VALUES (@id_profesional, @id_sede, '2026-12-05', '09:00:00', '10:00:00', 'Ocupado');
SET @p1_disp = SCOPE_IDENTITY();

INSERT INTO dbo.Solicitudes (id_persona, id_servicio, estado, fecha_solicitud)
VALUES (@p1_persona, @id_servicio, 'Convertida', '2026-11-01T09:00:00');
SET @p1_sol = SCOPE_IDENTITY();

INSERT INTO dbo.Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
VALUES (@p1_sol, @p1_disp, 800.00, '2026-11-01T09:30:00', 1);
SET @p1_opc = SCOPE_IDENTITY();

INSERT INTO dbo.Reservas (id_persona, id_solicitud, id_opcion, estado, fecha_reserva)
VALUES (@p1_persona, @p1_sol, @p1_opc, 'Confirmada', '2026-11-01T10:00:00');
SET @p1_res = SCOPE_IDENTITY();

INSERT INTO dbo.Pagos (id_persona, id_reserva, estado, importe, fecha_registro, canal_pago)
VALUES (@p1_persona, @p1_res, 'Validado', 800.00, '2026-11-01T10:05:00', 'Transferencia');
SET @p1_pago = SCOPE_IDENTITY();

INSERT INTO dbo.TratamientosContratados (id_persona, id_solicitud, id_reserva_origen, id_servicio, id_profesional_responsable, id_sede, precio_pactado, fecha_contratacion, estado_tratamiento)
VALUES (@p1_persona, @p1_sol, @p1_res, @id_servicio, @id_profesional, @id_sede, 800.00, '2026-11-01T10:10:00', 'Activado');
SET @p1_trat = SCOPE_IDENTITY();

INSERT INTO dbo.PlanTratamiento (id_tratamiento, version_plan, sesiones_planificadas, id_profesional_aprobador, estado_plan)
VALUES (@p1_trat, 1, 3, @id_profesional, 'Aprobado');
SET @p1_plan = SCOPE_IDENTITY();

INSERT INTO dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre, fecha_cierre_sesion)
VALUES (@p1_trat, @p1_plan, 1, @id_profesional, @id_sede, '2026-11-05T09:00:00', 'Programada', 'Realizada', 'Cerrada', '2026-11-05T10:00:00');
SET @p1_ses1 = SCOPE_IDENTITY();

INSERT INTO dbo.Atenciones (id_persona, id_reserva, id_servicio, id_profesional, id_sede, fecha_atencion, asistencia, estado_servicio, id_tratamiento, id_sesion, estado_cierre_documental, motivo_consulta, evaluacion)
VALUES (@p1_persona, @p1_res, @id_servicio, @id_profesional, @id_sede, '2026-11-05T09:00:00', 'Asistió', 'Realizado', @p1_trat, @p1_ses1, 'Cerrada', 'Primera sesion ortodoncia', 'Instalacion de brackets superiores');
SET @p1_aten1 = SCOPE_IDENTITY();

INSERT INTO dbo.ValidacionesFicha (id_atencion, numero_revision, fecha_revision, resultado_validacion, campos_pendientes, id_profesional_validador)
VALUES (@p1_aten1, 1, '2026-11-05T10:00:00', 'Completa', NULL, @id_profesional);

-- Indicación Postatención Vigente, Aprobada y Emitida
INSERT INTO dbo.IndicacionesPostatencion (id_documento_raiz, id_atencion, version, es_version_vigente, estado, contenido_indicaciones, origen_documento, id_profesional_aprobador, fecha_aprobacion, fecha_emision, fecha_creacion)
VALUES (1, @p1_aten1, 1, 1, 'Documento emitido', 'Evitar alimentos duros durante las primeras 48 horas. Usar cera dental en brackets que rocen la mucosa. Higiene bucal con cepillo ortodoncico despues de cada comida.', 'PROFESIONAL', @id_profesional, '2026-11-05T10:05:00', '2026-11-05T10:05:00', '2026-11-05T10:00:00');

-- Sesión 2: Programada futura
INSERT INTO dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
VALUES (@p1_trat, @p1_plan, 2, @id_profesional, @id_sede, '2026-12-10T11:00:00', 'Programada', 'Pendiente', 'Pendiente');
SET @p1_ses2 = SCOPE_IDENTITY();

-- Sesión 3: Pendiente de programación futura
INSERT INTO dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
VALUES (@p1_trat, @p1_plan, 3, @id_profesional, @id_sede, '2026-12-24T11:00:00', 'Programada', 'Pendiente', 'Pendiente');
SET @p1_ses3 = SCOPE_IDENTITY();


-- 6. CREACION DE PACIENTE 2 SINTETICO (Aislamiento y no interferencia)
DECLARE @p2_persona INT, @p2_disp INT, @p2_sol INT, @p2_opc INT, @p2_res INT, @p2_pago INT;
DECLARE @p2_trat INT, @p2_plan INT, @p2_ses1 INT;
DECLARE @p2_aten1 INT;

INSERT INTO dbo.Personas (nombres, apellidos, dni, email, numero, zona, autoriza_contacto, estado_calidad, id_etapa_actual)
VALUES ('Maria', 'Lopez Sintetica', '99000002', 'maria.lopez.test@nexosalud.pe', '992222222', 'Lima Sur', 1, 'Valido', @id_etapa_customer);
SET @p2_persona = SCOPE_IDENTITY();

INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
VALUES (@id_profesional_2, @id_sede, '2026-12-06', '10:00:00', '11:00:00', 'Ocupado');
SET @p2_disp = SCOPE_IDENTITY();

INSERT INTO dbo.Solicitudes (id_persona, id_servicio, estado, fecha_solicitud)
VALUES (@p2_persona, @id_servicio, 'Convertida', '2026-11-02T10:00:00');
SET @p2_sol = SCOPE_IDENTITY();

INSERT INTO dbo.Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
VALUES (@p2_sol, @p2_disp, 600.00, '2026-11-02T10:15:00', 1);
SET @p2_opc = SCOPE_IDENTITY();

INSERT INTO dbo.Reservas (id_persona, id_solicitud, id_opcion, estado, fecha_reserva)
VALUES (@p2_persona, @p2_sol, @p2_opc, 'Confirmada', '2026-11-02T11:00:00');
SET @p2_res = SCOPE_IDENTITY();

INSERT INTO dbo.Pagos (id_persona, id_reserva, estado, importe, fecha_registro, canal_pago)
VALUES (@p2_persona, @p2_res, 'Validado', 600.00, '2026-11-02T11:05:00', 'Yape');
SET @p2_pago = SCOPE_IDENTITY();

INSERT INTO dbo.TratamientosContratados (id_persona, id_solicitud, id_reserva_origen, id_servicio, id_profesional_responsable, id_sede, precio_pactado, fecha_contratacion, estado_tratamiento)
VALUES (@p2_persona, @p2_sol, @p2_res, @id_servicio, @id_profesional_2, @id_sede, 600.00, '2026-11-02T11:10:00', 'Activado');
SET @p2_trat = SCOPE_IDENTITY();

INSERT INTO dbo.PlanTratamiento (id_tratamiento, version_plan, sesiones_planificadas, id_profesional_aprobador, estado_plan)
VALUES (@p2_trat, 1, 2, @id_profesional_2, 'Aprobado');
SET @p2_plan = SCOPE_IDENTITY();

INSERT INTO dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
VALUES (@p2_trat, @p2_plan, 1, @id_profesional_2, @id_sede, '2026-12-15T15:00:00', 'Programada', 'Pendiente', 'Pendiente');
SET @p2_ses1 = SCOPE_IDENTITY();

INSERT INTO dbo.Atenciones (id_persona, id_reserva, id_servicio, id_profesional, id_sede, fecha_atencion, asistencia, estado_servicio, id_tratamiento, id_sesion, estado_cierre_documental)
VALUES (@p2_persona, @p2_res, @id_servicio, @id_profesional_2, @id_sede, '2026-12-15T15:00:00', 'Pendiente', 'Programado', @p2_trat, @p2_ses1, 'Pendiente');
SET @p2_aten1 = SCOPE_IDENTITY();


-- 7. CREACION DE PACIENTE 3 SINTETICO (Para detectores de alertas AL-C01 y AL-C02)
DECLARE @p3_persona INT, @p3_disp INT, @p3_sol INT, @p3_opc INT, @p3_res INT, @p3_pago INT;
DECLARE @p3_trat INT, @p3_plan INT, @p3_ses1 INT, @p3_aten1 INT;

INSERT INTO dbo.Personas (nombres, apellidos, dni, email, numero, zona, autoriza_contacto, estado_calidad, id_etapa_actual)
VALUES ('Roberto', 'Gomez Alertas', '99000003', 'roberto.alertas.test@nexosalud.pe', '993333333', 'Lima Centro', 1, 'Valido', @id_etapa_customer);
SET @p3_persona = SCOPE_IDENTITY();

INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
VALUES (@id_profesional, @id_sede, '2026-12-07', '09:00:00', '10:00:00', 'Ocupado');
SET @p3_disp = SCOPE_IDENTITY();

INSERT INTO dbo.Solicitudes (id_persona, id_servicio, estado, fecha_solicitud)
VALUES (@p3_persona, @id_servicio, 'Convertida', '2026-11-03T09:00:00');
SET @p3_sol = SCOPE_IDENTITY();

INSERT INTO dbo.Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, fecha_ofrecida, seleccionada)
VALUES (@p3_sol, @p3_disp, 500.00, '2026-11-03T09:15:00', 1);
SET @p3_opc = SCOPE_IDENTITY();

INSERT INTO dbo.Reservas (id_persona, id_solicitud, id_opcion, estado, fecha_reserva)
VALUES (@p3_persona, @p3_sol, @p3_opc, 'Confirmada', '2026-11-03T10:00:00');
SET @p3_res = SCOPE_IDENTITY();

INSERT INTO dbo.Pagos (id_persona, id_reserva, estado, importe, fecha_registro, canal_pago)
VALUES (@p3_persona, @p3_res, 'Validado', 500.00, '2026-11-03T10:05:00', 'Efectivo');
SET @p3_pago = SCOPE_IDENTITY();

INSERT INTO dbo.TratamientosContratados (id_persona, id_solicitud, id_reserva_origen, id_servicio, id_profesional_responsable, id_sede, precio_pactado, fecha_contratacion, estado_tratamiento)
VALUES (@p3_persona, @p3_sol, @p3_res, @id_servicio, @id_profesional, @id_sede, 500.00, '2026-11-03T10:10:00', 'Activado');
SET @p3_trat = SCOPE_IDENTITY();

INSERT INTO dbo.PlanTratamiento (id_tratamiento, version_plan, sesiones_planificadas, id_profesional_aprobador, estado_plan)
VALUES (@p3_trat, 1, 1, @id_profesional, 'Aprobado');
SET @p3_plan = SCOPE_IDENTITY();

INSERT INTO dbo.SesionesTratamiento (id_tratamiento, id_plan, numero_sesion, id_profesional, id_sede, fecha_programada_vigente, estado_programacion, estado_asistencial, estado_cierre)
VALUES (@p3_trat, @p3_plan, 1, @id_profesional, @id_sede, '2026-11-06T09:00:00', 'Programada', 'Realizada', 'Pendiente');
SET @p3_ses1 = SCOPE_IDENTITY();

INSERT INTO dbo.Atenciones (id_persona, id_reserva, id_servicio, id_profesional, id_sede, fecha_atencion, asistencia, estado_servicio, id_tratamiento, id_sesion, estado_cierre_documental)
VALUES (@p3_persona, @p3_res, @id_servicio, @id_profesional, @id_sede, '2026-11-06T09:00:00', 'Asistió', 'Realizado', @p3_trat, @p3_ses1, 'Pendiente');
SET @p3_aten1 = SCOPE_IDENTITY();

INSERT INTO dbo.ValidacionesFicha (id_atencion, numero_revision, fecha_revision, resultado_validacion, campos_pendientes, id_profesional_validador)
VALUES (@p3_aten1, 1, '2026-11-06T10:00:00', 'Incompleta', 'evaluacion_clinica,diagnostico_cie10', @id_profesional);


-- 8. HORARIOS DISPONIBLES FUTUROS
INSERT INTO dbo.Disponibilidad (id_profesional, id_sede, fecha, hora_inicio, hora_fin, estado)
VALUES 
(@id_profesional, @id_sede, '2026-12-18', '14:00:00', '15:00:00', 'Disponible'),
(@id_profesional, @id_sede, '2026-12-18', '15:00:00', '16:00:00', 'Disponible'),
(@id_profesional, @id_sede, '2026-12-19', '10:00:00', '11:00:00', 'Disponible'),
(@id_profesional_2, @id_sede, '2026-12-18', '16:00:00', '17:00:00', 'Disponible');

COMMIT TRANSACTION;

PRINT 'Fixture sintético autónomo CUSTOMER insertado con éxito en NexoSaludDB_Test.';
SELECT 
    'NexoSaludDB_Test' AS Base,
    (SELECT COUNT(*) FROM dbo.Personas WHERE dni IN ('99000001','99000002','99000003')) AS PacientesSinteticos,
    (SELECT COUNT(*) FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN ('99000001','99000002','99000003'))) AS TratamientosSinteticos,
    (SELECT COUNT(*) FROM dbo.SesionesTratamiento WHERE id_tratamiento IN (SELECT id_tratamiento FROM dbo.TratamientosContratados WHERE id_persona IN (SELECT id_persona FROM dbo.Personas WHERE dni IN ('99000001','99000002','99000003')))) AS TotalSesionesSinteticas,
    (SELECT COUNT(*) FROM dbo.Disponibilidad WHERE estado = 'Disponible' AND fecha >= '2026-12-01') AS SlotsDisponiblesFuturos;
