"""Genera un paquete revisable. Nunca se conecta a SQL ni ejecuta los archivos generados."""
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[2]
folder=root/'database/customer/deployment/20261112';folder.mkdir(parents=True,exist_ok=True)
inspection=json.loads((root/'backend/storage/principal-integration/inspection.private.json').read_text(encoding='utf-8'))
def read(p):return (root/p).read_text(encoding='utf-8-sig')
def write(n,s):(folder/n).write_text(s.strip()+'\n',encoding='utf-8')
guard="""-- Requiere sqlcmd -b -I -f 65001 y variables explícitas; sin destino por defecto.
USE [$(OltpDatabase)];
IF NOT (('$(Mode)'='CERT_TEST' AND DB_NAME()='NexoSaludDB_Test' AND '$(MartDatabase)'='NexoSalud_Mart_Test') OR ('$(Mode)'='APPROVED_MAIN' AND DB_NAME()='NexoSaludDB' AND '$(MartDatabase)'='NexoSalud_Mart')) THROW 56500,'Destino o modalidad no autorizados.',1;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
"""
preflight="""-- Solo lecturas. Los bloqueos no reparan datos automáticamente.
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
"""
write('01_preflight.sql',guard+preflight)
parts=[guard,preflight,"USE [$(OltpDatabase)];\nBEGIN TRANSACTION;\nGO\n",read('backend/prisma/migrations/20261112060000_customer_completion/migration.sql'),'\nGO\n']
for p in ['12_catalogos_estados_utf8.sql','09_programacion_sesion_segura.sql','08_cierre_documental_seguro.sql','11_version_ficha_clinica.sql','13_cierre_tratamiento_seguro.sql','14_evento_asistencial_utc.sql']:
 parts.extend([read('database/customer/'+p),'\nGO\n'])
parts.extend(['USE [$(MartDatabase)];\nGO\n',read('database/customer/10_ajustes_dimensionales_ia.sql'),'\nGO\n'])
etl=next(b for b in re.split(r'^GO\s*$',read('database/customer/05_etl_customer.sql'),flags=re.M) if re.search(r'CREATE PROCEDURE dbo\.usp_ETL_SincronizarCustomerMart\b',b))
etl=etl.replace('CREATE PROCEDURE','CREATE OR ALTER PROCEDURE',1).replace('[NexoSaludDB]','[$(OltpDatabase)]').replace('[NexoSalud_Mart]','[$(MartDatabase)]')
# Se preservan filas históricas huérfanas; el control de conciliación las detecta y bloquea la carga.
etl=re.sub(r'\s*WHEN NOT MATCHED BY SOURCE THEN\s*DELETE;', ';', etl)
start=etl.index('        DELETE FROM dbo.fact_atencion_customer;')
end=etl.index('        DECLARE @OLTP_Trat',start)
etl=etl[:start]+"        -- Hecho agregado legado preservado; sin reconstrucción destructiva.\n"+etl[end:]
assert not re.search(r'\b(DELETE|TRUNCATE|DROP TABLE)\b',etl,re.I)
write('15_etl_customer_conservador.sql',etl)
parts.extend([etl,'\nGO\nCOMMIT TRANSACTION;\nGO\n'])
write('02_incremental.sql','\n'.join(parts))
write('03_postflight.sql',guard+"""
IF COL_LENGTH('dbo.Atenciones','revision_ficha') IS NULL OR COL_LENGTH('dbo.InteraccionesIA','id_usuario_actor') IS NULL OR OBJECT_ID('dbo.SolicitudesCustomerIA','U') IS NULL OR OBJECT_ID('dbo.SesionesAccesoIA','U') IS NULL THROW 56510,'Esquema CUSTOMER incompleto.',1;
SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints WHERE name IN('CK_Tratamientos_Estado','CK_Atenciones_Asistencia','CK_InteraccionesIA_ActorCompletion');
SELECT COUNT(*) publishedPolicies FROM dbo.PoliticasCustomerIA WHERE estado='Publicada';
USE [$(MartDatabase)];
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.usp_ETL_SincronizarCustomerMart')) definition;
SELECT COUNT(*) unknownFacts FROM dbo.Fact_InteraccionIACustomer WHERE KeyTipoInteraccionIA=0;
-- Ejecutar conciliación de las 20 medidas por separado; estas lecturas no ejecutan ETL.
""")
write('04_carga_customer_aprobada.sql',guard+"""
USE [$(MartDatabase)];
-- Escritura adicional separada: requiere autorización para carga y conciliación del clon.
EXEC dbo.usp_ETL_SincronizarCustomerMart;
""")
rollback=[guard,'-- Reversión aditiva: no borra tablas, columnas ni eventos nuevos. Pausar aplicación primero.']
for database,names in [('NexoSaludDB',['usp_ProgramarSesionTratamiento','usp_RegistrarEventoAsistencialSesion','usp_CerrarSesionClinica','usp_CerrarTratamientoYTransicionarTurned']),('NexoSalud_Mart',['usp_ETL_SincronizarCustomerMart'])]:
 rollback.append('USE [$(OltpDatabase)];\nGO' if database=='NexoSaludDB' else 'USE [$(MartDatabase)];\nGO')
 for name in names:
  module=next(m for m in inspection['schemas'][database]['modules'] if m['name']==name)
  definition=re.sub(r'\bCREATE\s+PROCEDURE\b','CREATE OR ALTER PROCEDURE',module['definition'],count=1,flags=re.I)
  rollback.extend([definition,'\nGO\n'])
rollback.append('-- Las medidas modificadas por una carga NO se revierten con estos módulos. Restauración de respaldo requiere aprobación separada y evaluación de RPO. No habilitar cierres legados vulnerables sin control de aplicación.')
write('05_reversion_modulos.sql','\n'.join(rollback))
write('00_respaldo_y_restauracion.sql',r"""-- PLANTILLA DBA, NO EJECUTADA. Rutas, nombres y ventana requieren aprobación.
-- ReleaseId debe ser único; no se usa REPLACE ni se sobrescriben bases existentes.
BACKUP DATABASE [NexoSaludDB] TO DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH COPY_ONLY,CHECKSUM,COMPRESSION,NOINIT;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH COPY_ONLY,CHECKSUM,COMPRESSION,NOINIT;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak' WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak' WITH CHECKSUM;
-- VERIFYONLY no sustituye restauración de prueba.
RESTORE FILELISTONLY FROM DISK=N'$(BackupDir)\NexoSaludDB_$(ReleaseId).bak';
RESTORE FILELISTONLY FROM DISK=N'$(BackupDir)\NexoSalud_Mart_$(ReleaseId).bak';
-- DBA prepara MOVE de cada archivo lógico a rutas aisladas para dos clones autorizados.
-- Nunca ejecutar RESTORE ... WITH REPLACE sobre la base activa para ensayar.
-- Documentar restauración real, consistencia CHECKDB y conciliación antes de habilitar despliegue.
""")
write('06_permisos_cuentas.sql',"""-- PLANTILLA, no crea logins ni contiene secretos. DBA suministra identidades existentes.
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
""")
manifest={'release':'customer-20261112','state':'PREPARED_NOT_AUTHORIZED','inspectionCut':inspection['timestamp'],'principalTargets':['NexoSaludDB','NexoSalud_Mart'],'preservesLegacyFacts':True,'payerModulesExcluded':True,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.glob('*.sql'))}}
write('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2))
print('Paquete generado. Ninguna conexión ni escritura SQL ejecutada.')
