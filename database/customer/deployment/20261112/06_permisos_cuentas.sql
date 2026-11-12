-- PLANTILLA, no crea logins ni contiene secretos. DBA suministra identidades existentes.
USE [NexoSalud_Mart];
-- CREATE USER [$(BiReader)] FOR LOGIN [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Fact_TratamientoCustomer TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Fact_SesionCustomer TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Fact_AtencionCustomer_V2 TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Fact_InteraccionIACustomer TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Dim_Tiempo TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Dim_Sede TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Dim_Servicio TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.Dim_Profesional TO [$(BiReader)];
GRANT SELECT ON OBJECT::dbo.ETL_EjecucionLog TO [$(BiReader)];
DENY INSERT,UPDATE,DELETE,EXECUTE ON SCHEMA::dbo TO [$(BiReader)];
-- Cuenta OLTP y cuenta ETL distintas: no sysadmin, no db_owner, sin cadena entre bases.
-- Permisos OLTP de negocio se revisan por objetos utilizados; no otorgar DDL a la aplicación.
