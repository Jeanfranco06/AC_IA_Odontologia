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
