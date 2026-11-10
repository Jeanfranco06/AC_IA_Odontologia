:r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql
:r .\database\lead_revision\mart_dimensiones\02_FUENTES.sql

IF EXISTS (SELECT id_fecha FROM #Fechas EXCEPT SELECT id_fecha FROM dbo.Dim_Tiempo)
 OR EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE Anio<>YEAR(id_fecha) OR Trimestre<>DATEPART(quarter,id_fecha)
  OR Mes<>MONTH(id_fecha) OR Dia<>DAY(id_fecha))
 THROW 54720,'Conciliación de fechas o jerarquía incorrecta.',1;

IF EXISTS (SELECT id_servicio,nombre FROM [$(Origen)].dbo.Servicios EXCEPT SELECT id_servicio,ServicioOdontologico FROM dbo.Dim_Servicio)
 OR EXISTS (SELECT id_canal,nombre FROM [$(Origen)].dbo.Canales EXCEPT SELECT id_canal,NombreCanal FROM dbo.Dim_Canal)
 OR EXISTS (SELECT id_sede,nombre,NULLIF(TRIM(zona),'') FROM [$(Origen)].dbo.Sedes EXCEPT SELECT id_sede,Sede,Zona FROM dbo.Dim_Sede)
 OR EXISTS (SELECT id_usuario,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100) FROM [$(Origen)].dbo.Usuarios
  EXCEPT SELECT id_usuario,NombreNegociador FROM dbo.Dim_Negociador)
 OR EXISTS (SELECT id_profesional,LEFT(TRIM(CONCAT(TRIM(nombres),' ',TRIM(apellidos))),100),NULLIF(TRIM(especialidad),'')
  FROM [$(Origen)].dbo.Profesionales EXCEPT SELECT id_profesional,Odontologo,EspecialidadPrincipal FROM dbo.Dim_Profesional)
 THROW 54721,'No se conciliaron las dimensiones compartidas con sus catálogos.',1;

IF EXISTS (SELECT id_promocion,CONVERT(nvarchar(150),nombre) COLLATE Latin1_General_100_BIN2,tipo_promocion,id_servicio,activo
 FROM #Promocion EXCEPT SELECT id_promocion,PromocionAplicada,TipoPromocion,id_servicio,Activo FROM dbo.Dim_Promocion WHERE Origen='CATALOGO')
 OR EXISTS (SELECT Texto FROM #PromocionTexto EXCEPT SELECT PromocionAplicada FROM dbo.Dim_Promocion WHERE Origen='TEXTO')
 OR (SELECT COUNT(*) FROM dbo.Dim_Promocion WHERE
  (KeyPromocion=0 AND Origen='DESCONOCIDO') OR (KeyPromocion=-1 AND Origen='SIN_PROMOCION')
  OR (KeyPromocion=-2 AND Origen='NO_ESPECIFICADO') OR (KeyPromocion=-3 AND Origen='NO_APLICA'))<>4
 THROW 54722,'No se conciliaron las promociones o sus miembros controlados.',1;
IF EXISTS (SELECT id_motivo_rechazo,codigo,ambito,categoria,motivo,activo FROM #Motivo
 EXCEPT SELECT id_motivo_rechazo,Codigo,Ambito,TipoMotivoRechazo,MotivoRechazo,Activo FROM dbo.Dim_MotivoRechazo)
 OR (SELECT COUNT(*) FROM dbo.Dim_MotivoRechazo WHERE KeyMotivoRechazo IN(0,-2,-3)
  AND id_motivo_rechazo IS NULL AND TipoMotivoRechazo IS NULL AND Ambito IS NULL)<>3
 THROW 54723,'No se conciliaron los motivos y sus categorías.',1;
IF EXISTS (SELECT NumeroDiaSemana,Turno,HoraInicio,HoraFin FROM #Horario
 EXCEPT SELECT NumeroDiaSemana,Turno,HoraInicio,HoraFin FROM dbo.Dim_Horario WHERE TipoMiembro='OBSERVADO')
 OR (SELECT COUNT(*) FROM dbo.Dim_Horario WHERE
  (KeyHorario=0 AND TipoMiembro='DESCONOCIDO') OR (KeyHorario=-2 AND TipoMiembro='NO_ESPECIFICADO') OR
  (KeyHorario=-3 AND TipoMiembro='NO_APLICA'))<>3
 THROW 54724,'No se conciliaron los horarios y sus miembros controlados.',1;

DECLARE @d TABLE(tabla sysname,k sysname,n sysname NULL);
INSERT @d VALUES('Dim_Tiempo','KeyTiempo','id_fecha'),('Dim_Servicio','KeyServicio','id_servicio'),
 ('Dim_Canal','KeyCanal','id_canal'),('Dim_Sede','KeySede','id_sede'),
 ('Dim_Negociador','KeyNegociador','id_usuario'),('Dim_Profesional','KeyProfesional','id_profesional'),
 ('Dim_Promocion','KeyPromocion',NULL),('Dim_MotivoRechazo','KeyMotivoRechazo',NULL),('Dim_Horario','KeyHorario',NULL);
CREATE TABLE #Conteos(Dimension sysname,Filas bigint,MiembrosControlados bigint);
DECLARE @t sysname,@k sysname,@n sysname,@sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tabla,k,n FROM @d;
OPEN c;
FETCH NEXT FROM c INTO @t,@k,@n;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @sql=N'INSERT #Conteos SELECT @t,COUNT_BIG(*),COUNT_BIG(CASE WHEN '+QUOTENAME(@k)+N'<=0 THEN 1 END) FROM dbo.'+QUOTENAME(@t)+N';';
 IF @n IS NOT NULL SET @sql+=N'
 IF NOT EXISTS(SELECT 1 FROM dbo.'+QUOTENAME(@t)+N' WHERE '+QUOTENAME(@k)+N'=0)
 OR EXISTS(SELECT '+QUOTENAME(@n)+N' FROM dbo.'+QUOTENAME(@t)+N' WHERE '+QUOTENAME(@n)+N' IS NOT NULL
 GROUP BY '+QUOTENAME(@n)+N' HAVING COUNT_BIG(*)>1) THROW 54725,''Clave natural duplicada o falta miembro desconocido.'',1;';
 EXEC sys.sp_executesql @sql,N'@t sysname',@t;
 FETCH NEXT FROM c INTO @t,@k,@n;
END;
CLOSE c;
DEALLOCATE c;
SELECT * FROM #Conteos ORDER BY Dimension;
SELECT (SELECT COUNT(*) FROM #Fechas) AS FechasFuente,
 (SELECT COUNT(*) FROM #Promocion) AS PromocionesCatalogo,
 (SELECT COUNT(*) FROM #PromocionTexto) AS PromocionesTexto,
 (SELECT COUNT(*) FROM #Motivo) AS MotivosCatalogo,
 (SELECT COUNT(*) FROM #Horario) AS HorariosObservados;
SELECT 'Conciliación de dimensiones aprobada' AS Resultado;
