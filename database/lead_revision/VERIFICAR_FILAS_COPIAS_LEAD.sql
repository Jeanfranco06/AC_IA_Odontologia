:ON ERROR EXIT
SET NOCOUNT ON;
IF N'$(Referencia)' NOT IN (N'NexoSalud_LeadReferencia',N'NexoSalud_LeadPreinstalacion',N'NexoSalud_LeadVentana')
 OR N'$(Destino)' NOT IN (N'NexoSalud_LeadPruebas',N'NexoSalud_LeadEnsayoFinal',N'NexoSaludDB')
 THROW 54611,'Los nombres de bases no corresponden a esta revisión.',1;
IF DB_NAME() <> N'master' OR DB_ID(N'$(Referencia)') IS NULL
    OR DB_ID(N'$(Destino)') IS NULL
 THROW 54502,'Solo comparar las dos copias, desde master.',1;

CREATE TABLE #Control(tabla sysname, filas_respaldo bigint, filas_copia bigint, filas_originales_sin_coincidencia bigint);
DECLARE @tabla sysname,@cols nvarchar(max),@sql nvarchar(max);
DECLARE tablas CURSOR LOCAL FAST_FORWARD FOR
 SELECT t.name FROM $(Referencia).sys.tables t
 JOIN $(Referencia).sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='dbo' AND EXISTS (
  SELECT 1 FROM $(Destino).sys.tables n
  JOIN $(Destino).sys.schemas ns ON ns.schema_id=n.schema_id
  WHERE ns.name='dbo' AND n.name=t.name);
OPEN tablas;
FETCH NEXT FROM tablas INTO @tabla;
WHILE @@FETCH_STATUS=0
BEGIN
 SELECT @cols=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),',') WITHIN GROUP(ORDER BY c.column_id)
 FROM $(Referencia).sys.columns c
 JOIN $(Referencia).sys.tables t ON t.object_id=c.object_id
 JOIN $(Referencia).sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='dbo' AND t.name=@tabla;
 SET @sql=N'INSERT #Control SELECT @t,
 (SELECT COUNT_BIG(*) FROM $(Referencia).dbo.'+QUOTENAME(@tabla)+N'),
 (SELECT COUNT_BIG(*) FROM $(Destino).dbo.'+QUOTENAME(@tabla)+N'),
 (SELECT COUNT_BIG(*) FROM (SELECT '+@cols+N' FROM $(Referencia).dbo.'+QUOTENAME(@tabla)+N'
 EXCEPT SELECT '+@cols+N' FROM $(Destino).dbo.'+QUOTENAME(@tabla)+N') d);';
 EXEC sys.sp_executesql @sql,N'@t sysname',@t=@tabla;
 FETCH NEXT FROM tablas INTO @tabla;
END;
CLOSE tablas;
DEALLOCATE tablas;
SELECT * FROM #Control ORDER BY tabla;
IF EXISTS (SELECT 1 FROM #Control WHERE filas_originales_sin_coincidencia>0)
 THROW 54503,'Hay filas del respaldo que no coinciden en la copia.',1;
