:r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=[$(Origen)].sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
  @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000,@DbPrincipal='public';
 IF @lock<0 THROW 54712,'No se obtuvo el bloqueo compartido con BUYER.',1;

 -- Ninguna columna se añade a las dimensiones compartidas. Sus niveles ya existen.
 DECLARE @shared TABLE (tabla sysname, clave sysname, indice sysname, filtrado bit);
 INSERT @shared VALUES
 ('Dim_Tiempo','id_fecha','UX_Lead_Tiempo_Fecha',0),
 ('Dim_Servicio','id_servicio','UX_Lead_Servicio_Origen',1),
 ('Dim_Canal','id_canal','UX_Lead_Canal_Origen',1),
 ('Dim_Sede','id_sede','UX_Lead_Sede_Origen',1),
 ('Dim_Negociador','id_usuario','UX_Lead_Negociador_Origen',1),
 ('Dim_Profesional','id_profesional','UX_Lead_Profesional_Origen',1);
 DECLARE @tabla sysname,@clave sysname,@indice sysname,@filtrado bit,@sql nvarchar(max);
 DECLARE dims CURSOR LOCAL FAST_FORWARD FOR SELECT tabla,clave,indice,filtrado FROM @shared;
 OPEN dims;
 FETCH NEXT FROM dims INTO @tabla,@clave,@indice,@filtrado;
 WHILE @@FETCH_STATUS=0
 BEGIN
  IF COL_LENGTH(N'dbo.'+@tabla,@clave) IS NULL THROW 54713,'Falta una dimensión compartida del modelo de Daniel.',1;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.'+@tabla) AND name=@indice)
  BEGIN
   SET @sql=N'CREATE UNIQUE INDEX '+QUOTENAME(@indice)+N' ON dbo.'+QUOTENAME(@tabla)+
     N'('+QUOTENAME(@clave)+N')'+CASE WHEN @filtrado=1 THEN N' WHERE '+QUOTENAME(@clave)+N' IS NOT NULL' ELSE N'' END;
   EXEC sys.sp_executesql @sql;
  END;
  FETCH NEXT FROM dims INTO @tabla,@clave,@indice,@filtrado;
 END;
 CLOSE dims;
 DEALLOCATE dims;

 IF OBJECT_ID('dbo.Dim_Promocion','U') IS NULL
 BEGIN
  CREATE TABLE dbo.Dim_Promocion (
   KeyPromocion int IDENTITY(1,1) CONSTRAINT PK_DimPromocion PRIMARY KEY,
   id_promocion int NULL,
   Origen varchar(16) NOT NULL,
   PromocionAplicada nvarchar(150) COLLATE Latin1_General_100_BIN2 NOT NULL,
   TipoPromocion nvarchar(80) NULL,
   id_servicio int NULL,
   Activo bit NULL,
   CONSTRAINT CK_DimPromocion_Origen CHECK(
     (Origen='CATALOGO' AND id_promocion IS NOT NULL AND id_promocion>0) OR
     (Origen IN ('TEXTO','SIN_PROMOCION','DESCONOCIDO','NO_ESPECIFICADO','NO_APLICA') AND id_promocion IS NULL))
  );
  CREATE UNIQUE INDEX UX_DimPromocion_Catalogo ON dbo.Dim_Promocion(id_promocion) WHERE id_promocion IS NOT NULL;
  CREATE UNIQUE INDEX UX_DimPromocion_Texto ON dbo.Dim_Promocion(PromocionAplicada) WHERE Origen='TEXTO';
 END;

 IF OBJECT_ID('dbo.Dim_MotivoRechazo','U') IS NULL
 BEGIN
  CREATE TABLE dbo.Dim_MotivoRechazo (
   KeyMotivoRechazo int IDENTITY(1,1) CONSTRAINT PK_DimMotivoRechazo PRIMARY KEY,
   id_motivo_rechazo int NULL,
   Codigo varchar(60) NULL,
   Ambito varchar(15) NULL,
   TipoMotivoRechazo varchar(20) NULL,
   MotivoRechazo nvarchar(160) NOT NULL,
   Activo bit NULL,
   CONSTRAINT CK_DimMotivoRechazo_Clasificacion CHECK (
    (id_motivo_rechazo IS NULL AND Ambito IS NULL AND TipoMotivoRechazo IS NULL) OR
    (id_motivo_rechazo IS NOT NULL AND Ambito IS NOT NULL AND TipoMotivoRechazo IS NOT NULL AND
     ((Ambito='PROPUESTA' AND TipoMotivoRechazo IN ('ECONOMICO','OTROS')) OR
      (Ambito='ALTERNATIVA' AND TipoMotivoRechazo IN ('INCOMPATIBILIDAD','OTROS')))))
  );
  CREATE UNIQUE INDEX UX_DimMotivoRechazo_Origen ON dbo.Dim_MotivoRechazo(id_motivo_rechazo) WHERE id_motivo_rechazo IS NOT NULL;
 END;

 IF OBJECT_ID('dbo.Dim_Horario','U') IS NULL
 BEGIN
  CREATE TABLE dbo.Dim_Horario (
   KeyHorario int IDENTITY(1,1) CONSTRAINT PK_DimHorario PRIMARY KEY,
   TipoMiembro varchar(16) NOT NULL,
   NumeroDiaSemana tinyint NULL,
   DiaSemana AS CONVERT(nvarchar(10),CASE NumeroDiaSemana
      WHEN 1 THEN N'Lunes' WHEN 2 THEN N'Martes' WHEN 3 THEN N'Miércoles'
      WHEN 4 THEN N'Jueves' WHEN 5 THEN N'Viernes' WHEN 6 THEN N'Sábado' WHEN 7 THEN N'Domingo' END) PERSISTED,
   Turno nvarchar(30) NULL,
   HoraInicio time(7) NULL,
   HoraFin time(7) NULL,
   IntervaloHorario AS (CASE WHEN HoraInicio IS NOT NULL AND HoraFin IS NOT NULL
    THEN CONVERT(varchar(16),HoraInicio)+'–'+CONVERT(varchar(16),HoraFin) END),
   CONSTRAINT CK_DimHorario_Dia CHECK (NumeroDiaSemana IS NULL OR NumeroDiaSemana BETWEEN 1 AND 7),
   CONSTRAINT CK_DimHorario_Intervalo CHECK ((HoraInicio IS NULL AND HoraFin IS NULL)
    OR (HoraInicio IS NOT NULL AND HoraFin IS NOT NULL AND HoraInicio<HoraFin)),
   CONSTRAINT CK_DimHorario_Miembro CHECK (
    (TipoMiembro='OBSERVADO' AND (NumeroDiaSemana IS NOT NULL OR Turno IS NOT NULL OR HoraInicio IS NOT NULL))
    OR (TipoMiembro IN ('DESCONOCIDO','NO_ESPECIFICADO','NO_APLICA') AND NumeroDiaSemana IS NULL AND Turno IS NULL AND HoraInicio IS NULL))
  );
  CREATE UNIQUE INDEX UX_DimHorario_Grano ON dbo.Dim_Horario(TipoMiembro,NumeroDiaSemana,Turno,HoraInicio,HoraFin);
 END;
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
