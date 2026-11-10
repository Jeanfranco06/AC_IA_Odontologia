:r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=[$(Origen)].sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
  @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000,@DbPrincipal='public';
 IF @lock<0 THROW 54712,'No se obtuvo el bloqueo compartido con BUYER.',1;
 IF OBJECT_ID('dbo.Dim_Horario','U') IS NULL OR OBJECT_ID('dbo.Dim_Promocion','U') IS NULL
    OR OBJECT_ID('dbo.Dim_MotivoRechazo','U') IS NULL THROW 54716,'Ejecutar 01_MIGRAR_DIMENSIONES.sql.',1;
:r .\database\lead_revision\mart_dimensiones\02_FUENTES.sql

 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Tiempo WHERE KeyTiempo=0)
  INSERT dbo.Dim_Tiempo(KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia) VALUES(0,'19000101',1900,1,1,1);

 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Servicio WHERE KeyServicio=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Servicio ON;
  INSERT dbo.Dim_Servicio(KeyServicio,id_servicio,ServicioOdontologico,Categoria,Procedimiento)
   VALUES(0,0,'No especificado','No especificada','No especificado');
  SET IDENTITY_INSERT dbo.Dim_Servicio OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Canal WHERE KeyCanal=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Canal ON;
  INSERT dbo.Dim_Canal(KeyCanal,id_canal,NombreCanal,TipoMedio) VALUES(0,0,'No especificado','No especificado');
  SET IDENTITY_INSERT dbo.Dim_Canal OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Sede WHERE KeySede=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Sede ON;
  INSERT dbo.Dim_Sede(KeySede,id_sede,Sede,Distrito,Zona) VALUES(0,0,'No especificada','No especificado','No especificada');
  SET IDENTITY_INSERT dbo.Dim_Sede OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Negociador WHERE KeyNegociador=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Negociador ON;
  INSERT dbo.Dim_Negociador(KeyNegociador,id_usuario,NombreNegociador) VALUES(0,0,'No especificado');
  SET IDENTITY_INSERT dbo.Dim_Negociador OFF;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Profesional WHERE KeyProfesional=0)
 BEGIN
  SET IDENTITY_INSERT dbo.Dim_Profesional ON;
  INSERT dbo.Dim_Profesional(KeyProfesional,id_profesional,Odontologo,EspecialidadPrincipal)
   VALUES(0,0,'No especificado',NULL);
  SET IDENTITY_INSERT dbo.Dim_Profesional OFF;
 END;

 -- Se preserva cualquier clave sustituta ya asignada a la fecha.
 MERGE dbo.Dim_Tiempo WITH (HOLDLOCK) AS d USING #Fechas AS s ON d.id_fecha=s.id_fecha
 WHEN NOT MATCHED THEN INSERT(KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia)
 VALUES (CONVERT(int,CONVERT(char(8),s.id_fecha,112)),s.id_fecha,YEAR(s.id_fecha),
  DATEPART(quarter,s.id_fecha),MONTH(s.id_fecha),DAY(s.id_fecha));

 MERGE dbo.Dim_Servicio WITH (HOLDLOCK) AS d USING [$(Origen)].dbo.Servicios AS s ON d.id_servicio=s.id_servicio
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.ServicioOdontologico)
  THEN UPDATE SET ServicioOdontologico=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_servicio,ServicioOdontologico,Categoria,Procedimiento)
 VALUES(s.id_servicio,s.nombre,NULL,LEFT(NULLIF(TRIM(s.descripcion),''),100));

 MERGE dbo.Dim_Canal WITH (HOLDLOCK) AS d USING [$(Origen)].dbo.Canales AS s ON d.id_canal=s.id_canal
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.NombreCanal) THEN UPDATE SET NombreCanal=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_canal,NombreCanal,TipoMedio) VALUES(s.id_canal,s.nombre,NULL);

 MERGE dbo.Dim_Sede WITH (HOLDLOCK) AS d
 USING (SELECT id_sede,nombre,NULLIF(TRIM(zona),'') AS zona FROM [$(Origen)].dbo.Sedes) AS s ON d.id_sede=s.id_sede
 WHEN MATCHED AND EXISTS(SELECT s.nombre,s.zona EXCEPT SELECT d.Sede,d.Zona) THEN UPDATE SET Sede=s.nombre,Zona=s.zona
 WHEN NOT MATCHED THEN INSERT(id_sede,Sede,Distrito,Zona) VALUES(s.id_sede,s.nombre,NULL,s.zona);

 MERGE dbo.Dim_Negociador WITH (HOLDLOCK) AS d
 USING (SELECT id_usuario,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100) AS nombre
 FROM [$(Origen)].dbo.Usuarios) AS s ON d.id_usuario=s.id_usuario
 WHEN MATCHED AND EXISTS(SELECT s.nombre EXCEPT SELECT d.NombreNegociador) THEN UPDATE SET NombreNegociador=s.nombre
 WHEN NOT MATCHED THEN INSERT(id_usuario,NombreNegociador) VALUES(s.id_usuario,s.nombre);

 MERGE dbo.Dim_Profesional WITH (HOLDLOCK) AS d
 USING (SELECT id_profesional,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100) AS nombre,
  NULLIF(TRIM(especialidad),'') AS especialidad FROM [$(Origen)].dbo.Profesionales) AS s ON d.id_profesional=s.id_profesional
 WHEN MATCHED AND EXISTS(SELECT s.nombre,s.especialidad EXCEPT SELECT d.Odontologo,d.EspecialidadPrincipal)
  THEN UPDATE SET Odontologo=s.nombre,EspecialidadPrincipal=s.especialidad
 WHEN NOT MATCHED THEN INSERT(id_profesional,Odontologo,EspecialidadPrincipal) VALUES(s.id_profesional,s.nombre,s.especialidad);

 SET IDENTITY_INSERT dbo.Dim_Promocion ON;
 INSERT dbo.Dim_Promocion(KeyPromocion,Origen,PromocionAplicada)
 SELECT v.Id,v.Origen,v.Nombre FROM (VALUES (0,'DESCONOCIDO',N'Desconocida'),
  (-1,'SIN_PROMOCION',N'Sin promoción'),(-2,'NO_ESPECIFICADO',N'No especificada'),(-3,'NO_APLICA',N'No aplica')) v(Id,Origen,Nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Promocion d WHERE d.KeyPromocion=v.Id);
 SET IDENTITY_INSERT dbo.Dim_Promocion OFF;

 MERGE dbo.Dim_Promocion WITH (HOLDLOCK) AS d USING #Promocion AS s ON d.id_promocion=s.id_promocion
 WHEN MATCHED AND EXISTS(SELECT CONVERT(nvarchar(150),s.nombre) COLLATE Latin1_General_100_BIN2,s.tipo_promocion,s.id_servicio,s.activo
  EXCEPT SELECT d.PromocionAplicada,d.TipoPromocion,d.id_servicio,d.Activo)
  THEN UPDATE SET PromocionAplicada=s.nombre,TipoPromocion=s.tipo_promocion,id_servicio=s.id_servicio,Activo=s.activo
 WHEN NOT MATCHED THEN INSERT(id_promocion,Origen,PromocionAplicada,TipoPromocion,id_servicio,Activo)
  VALUES(s.id_promocion,'CATALOGO',s.nombre,s.tipo_promocion,s.id_servicio,s.activo);

 MERGE dbo.Dim_Promocion WITH (HOLDLOCK) AS d USING #PromocionTexto AS s
 ON d.Origen='TEXTO' AND d.PromocionAplicada=s.Texto
 WHEN NOT MATCHED THEN INSERT(Origen,PromocionAplicada) VALUES('TEXTO',s.Texto);

 SET IDENTITY_INSERT dbo.Dim_MotivoRechazo ON;
 INSERT dbo.Dim_MotivoRechazo(KeyMotivoRechazo,MotivoRechazo)
 SELECT v.Id,v.Nombre FROM (VALUES (0,N'Desconocido'),(-2,N'No especificado'),(-3,N'No aplica')) v(Id,Nombre)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_MotivoRechazo d WHERE d.KeyMotivoRechazo=v.Id);
 SET IDENTITY_INSERT dbo.Dim_MotivoRechazo OFF;
 MERGE dbo.Dim_MotivoRechazo WITH (HOLDLOCK) AS d USING #Motivo AS s ON d.id_motivo_rechazo=s.id_motivo_rechazo
 WHEN MATCHED AND EXISTS(SELECT s.codigo,s.ambito,s.categoria,s.motivo,s.activo
  EXCEPT SELECT d.Codigo,d.Ambito,d.TipoMotivoRechazo,d.MotivoRechazo,d.Activo)
  THEN UPDATE SET Codigo=s.codigo,Ambito=s.ambito,TipoMotivoRechazo=s.categoria,MotivoRechazo=s.motivo,Activo=s.activo
 WHEN NOT MATCHED THEN INSERT(id_motivo_rechazo,Codigo,Ambito,TipoMotivoRechazo,MotivoRechazo,Activo)
  VALUES(s.id_motivo_rechazo,s.codigo,s.ambito,s.categoria,s.motivo,s.activo);

 SET IDENTITY_INSERT dbo.Dim_Horario ON;
 INSERT dbo.Dim_Horario(KeyHorario,TipoMiembro)
 SELECT v.Id,v.Tipo FROM (VALUES (0,'DESCONOCIDO'),(-2,'NO_ESPECIFICADO'),(-3,'NO_APLICA')) v(Id,Tipo)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Horario d WHERE d.KeyHorario=v.Id);
 SET IDENTITY_INSERT dbo.Dim_Horario OFF;
 MERGE dbo.Dim_Horario WITH (HOLDLOCK) AS d USING #Horario AS s ON d.TipoMiembro='OBSERVADO'
  AND EXISTS(SELECT s.NumeroDiaSemana,s.Turno,s.HoraInicio,s.HoraFin INTERSECT
             SELECT d.NumeroDiaSemana,d.Turno,d.HoraInicio,d.HoraFin)
 WHEN NOT MATCHED THEN INSERT(TipoMiembro,NumeroDiaSemana,Turno,HoraInicio,HoraFin)
  VALUES('OBSERVADO',s.NumeroDiaSemana,s.Turno,s.HoraInicio,s.HoraFin);

 IF N'$(ProvocarError)'=N'SI'
 BEGIN
  IF DB_NAME() NOT IN (N'NexoSalud_Mart_LeadQA',N'NexoSalud_Mart_LeadPreQA') THROW 54717,'La inyección de fallos se limita a la copia.',1;
  THROW 54718,'Error de prueba posterior a las escrituras; se espera rollback.',1;
 END;
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
