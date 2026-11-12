"""Solo despliegue a Test por conexión administrativa integrada, sin copiar datos."""
from pathlib import Path
import re, subprocess
root=Path(__file__).resolve().parents[2]
private=root/'backend/storage/certification';private.mkdir(parents=True,exist_ok=True)
def install(database, content):
 assert database in ('NexoSaludDB_Test','NexoSalud_Mart_Test')
 content=re.sub(r'\bNexoSaludDB\b','NexoSaludDB_Test',content)
 content=re.sub(r'\bNexoSalud_Mart\b','NexoSalud_Mart_Test',content)
 assert not re.search(r'\bNexoSalud(?:DB|_Mart)\b',content)
 path=private/'install-test.sql';path.write_text(content,encoding='utf-8-sig')
 subprocess.run(['sqlcmd','-S','localhost','-E','-C','-I','-b','-f','65001','-d',database,'-i',str(path)],check=True)
config=(root/'backend/.env.customer-cert.local').read_text(encoding='utf-8-sig')
login=re.search(r'^DB_USER=([A-Za-z0-9_]+)$',config,re.M).group(1)
for database in ('NexoSaludDB_Test','NexoSalud_Mart_Test'):install(database,f'GRANT VIEW DEFINITION TO [{login}];')
install('NexoSaludDB_Test',(root/'backend/prisma/migrations/20261112060000_customer_completion/migration.sql').read_text(encoding='utf-8'))
install('NexoSaludDB_Test',"""IF DB_NAME()<>'NexoSaludDB_Test' THROW 55990,'Reparación de fixture fuera de Test.',1;
UPDATE dbo.Atenciones SET asistencia=N'Asisti'+NCHAR(243) WHERE CAST(asistencia AS NVARCHAR(40))=N'Asisti'+NCHAR(195)+NCHAR(179);
UPDATE dbo.Atenciones SET asistencia=N'No asisti'+NCHAR(243) WHERE CAST(asistencia AS NVARCHAR(40))=N'No asisti'+NCHAR(195)+NCHAR(179);
""")
install('NexoSaludDB_Test',(root/'database/customer/12_catalogos_estados_utf8.sql').read_text(encoding='utf-8'))
ddl=(root/'database/customer/01_migracion_oltp_customer.sql').read_text(encoding='utf-8')
program=next(b for b in re.split(r'^GO\s*$',ddl,flags=re.M) if re.search(r'CREATE PROCEDURE dbo\.usp_ProgramarSesionTratamiento\b',b))
program=program.replace('CREATE PROCEDURE','CREATE OR ALTER PROCEDURE',1).replace('SYSDATETIME()', 'SYSUTCDATETIME()')
guard="""
        IF @numero_sesion<=1 OR @duracion_min<=0 OR @fecha_programada<=SYSUTCDATETIME()
          THROW 55910,'Ordinal, duración o fecha no elegibles para nueva sesión CUSTOMER.',1;
        IF EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WITH(UPDLOCK,HOLDLOCK) WHERE id_tratamiento=@id_tratamiento AND numero_sesion=@numero_sesion)
          THROW 55911,'El ordinal ya está programado.',1;
        IF @id_disponibilidad IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.Disponibilidad WITH(UPDLOCK,HOLDLOCK) WHERE id_disponibilidad=@id_disponibilidad AND estado='Disponible' AND disponible=1 AND id_profesional=@id_profesional AND id_sede=@id_sede AND CAST(fecha AS DATE)=CAST(@fecha_programada AS DATE) AND CAST(hora_inicio AS TIME)=CAST(@fecha_programada AS TIME) AND DATEDIFF(MINUTE,hora_inicio,hora_fin)>=@duracion_min)
          THROW 55912,'Horario inexistente, incompatible o no disponible.',1;
        IF EXISTS(SELECT 1 FROM dbo.Reservas r JOIN dbo.Opciones o ON o.id_opcion=r.id_opcion WHERE o.id_disponibilidad=@id_disponibilidad)
          THROW 55913,'El horario pertenece a la reserva inicial PAYER.',1;
"""
program=program.replace('        BEGIN TRANSACTION;','        BEGIN TRANSACTION;\n'+guard,1)
program=program.replace('IF @numero_sesion > @max_sesiones','IF @id_plan IS NULL OR @numero_sesion > @max_sesiones')
target=root/'database/customer/09_programacion_sesion_segura.sql';target.write_text(program.strip()+'\n',encoding='utf-8')
install('NexoSaludDB_Test',program)
formal=next(b for b in re.split(r'^GO\s*$',ddl,flags=re.M) if re.search(r'CREATE PROCEDURE dbo\.usp_CerrarTratamientoYTransicionarTurned\b',b))
formal=formal.replace('CREATE PROCEDURE','CREATE OR ALTER PROCEDURE',1).replace('SYSDATETIME()', 'SYSUTCDATETIME()')
formal=formal.replace("        IF @estado_actual = 'Completado'", """        IF NOT EXISTS(SELECT 1 FROM dbo.Profesionales p JOIN dbo.TratamientosContratados t ON t.id_profesional_responsable=p.id_profesional WHERE t.id_tratamiento=@id_tratamiento AND p.id_profesional=@id_profesional_cierre AND p.activo=1 AND p.numero_colegiatura IS NOT NULL)
            THROW 55920,'El cierre requiere al profesional responsable activo y colegiado.',1;
        IF @estado_actual = 'Completado'""")
formal=formal.replace('        SELECT\n            @sesiones_cerradas', """        IF @sesiones_plan IS NULL OR @sesiones_plan<1
            THROW 55921,'Cierre sin plan vigente válido.',1;
        IF (SELECT COUNT(*) FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento)<>@sesiones_plan
           OR EXISTS(SELECT 1 FROM dbo.SesionesTratamiento WHERE id_tratamiento=@id_tratamiento AND (estado_asistencial<>'Realizada' OR estado_cierre<>'Cerrada' OR numero_sesion<1 OR numero_sesion>@sesiones_plan))
            THROW 55922,'Existen sesiones pendientes o excepciones que requieren revisión profesional.',1;
        IF EXISTS(SELECT 1 FROM dbo.Atenciones a OUTER APPLY(SELECT TOP(1) v.* FROM dbo.ValidacionesFicha v WHERE v.id_atencion=a.id_atencion ORDER BY numero_revision DESC)v WHERE a.id_tratamiento=@id_tratamiento AND (v.id_validacion IS NULL OR v.resultado_validacion<>'Completa' OR v.revision_ficha<>a.revision_ficha OR NOT EXISTS(SELECT 1 FROM dbo.PoliticasCustomerIA p WHERE p.id_politica=v.id_politica_ia AND p.estado='Publicada' AND p.codigo='DOCUMENTACION' AND p.id_servicio=a.id_servicio)))
            THROW 55923,'Validación documental no vigente para el cierre formal.',1;
        SELECT
            @sesiones_cerradas""")
(root/'database/customer/13_cierre_tratamiento_seguro.sql').write_text(formal.strip()+'\n',encoding='utf-8')
install('NexoSaludDB_Test',formal)
outcome=next(b for b in re.split(r'^GO\s*$',ddl,flags=re.M) if re.search(r'CREATE PROCEDURE dbo\.usp_RegistrarEventoAsistencialSesion\b',b))
outcome=outcome.replace('CREATE PROCEDURE','CREATE OR ALTER PROCEDURE',1).replace('SYSDATETIME()', 'SYSUTCDATETIME()')
# Registrar finalización no permite inventar llegada ni duración retrospectiva.
outcome=outcome.replace('fecha_llegada = ISNULL(fecha_llegada, DATEADD(MINUTE, -30, @fecha_evento)),','fecha_llegada = fecha_llegada,').replace('fecha_inicio_atencion = ISNULL(fecha_inicio_atencion, DATEADD(MINUTE, -20, @fecha_evento)),','fecha_inicio_atencion = fecha_inicio_atencion,').replace('fecha_inicio = ISNULL(fecha_inicio, DATEADD(MINUTE, -20, @fecha_evento)),','fecha_inicio = fecha_inicio,')
(root/'database/customer/14_evento_asistencial_utc.sql').write_text(outcome.strip()+'\n',encoding='utf-8')
install('NexoSaludDB_Test',outcome)
install('NexoSaludDB_Test',(root/'database/customer/08_cierre_documental_seguro.sql').read_text(encoding='utf-8'))
install('NexoSaludDB_Test',(root/'database/customer/11_version_ficha_clinica.sql').read_text(encoding='utf-8'))
install('NexoSalud_Mart_Test',(root/'database/customer/10_ajustes_dimensionales_ia.sql').read_text(encoding='utf-8'))
install('NexoSalud_Mart_Test',(root/'database/customer/05_etl_customer.sql').read_text(encoding='utf-8'))
