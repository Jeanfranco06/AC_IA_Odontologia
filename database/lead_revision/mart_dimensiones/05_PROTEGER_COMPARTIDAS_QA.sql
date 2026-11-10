:r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql
IF NOT (
 (DB_NAME()=N'NexoSalud_Mart_LeadQA' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadRef')
 OR (DB_NAME()=N'NexoSalud_Mart_LeadPreQA' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadPreRef')
 OR (DB_NAME()=N'NexoSalud_Mart' AND N'$(Referencia)'=N'NexoSalud_Mart_LeadVentanaRef')
) OR DB_ID(N'$(Referencia)') IS NULL
 THROW 54730,'Se requiere la referencia correspondiente, restaurada sin migrar.',1;

-- Compara íntegros los hechos y dimensiones fuera del alcance. En las seis
-- compartidas compara las claves y los atributos que LEAD no debe sobrescribir.
DECLARE @objetos table (tabla sysname, proyeccion nvarchar(max) NULL, igualConteo bit);
INSERT @objetos VALUES
 ('Dim_Tiempo','KeyTiempo,id_fecha,Anio,Trimestre,Mes,Dia',0),
 ('Dim_Servicio','KeyServicio,id_servicio,Categoria,Procedimiento',0),
 ('Dim_Canal','KeyCanal,id_canal,TipoMedio',0),('Dim_Sede','KeySede,id_sede,Distrito',0),
 ('Dim_Negociador','KeyNegociador,id_usuario',0),('Dim_Profesional','KeyProfesional,id_profesional',0);
INSERT @objetos
 SELECT t.name,NULL,1 FROM [$(Referencia)].sys.tables t
 JOIN [$(Referencia)].sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='dbo' AND (t.name LIKE 'Fact[_]%' OR t.name LIKE 'Dim[_]%')
 AND NOT EXISTS(SELECT 1 FROM @objetos d WHERE d.tabla=t.name);

-- La forma de las columnas existentes se compara en ambas direcciones.
SELECT t.name AS Tabla,c.column_id,c.name AS Columna,c.system_type_id,c.max_length,c.precision,c.scale,
 c.is_nullable,c.is_identity,c.is_computed,c.collation_name INTO #ColumnasAntes
FROM [$(Referencia)].sys.tables t JOIN [$(Referencia)].sys.columns c ON c.object_id=t.object_id
JOIN @objetos o ON o.tabla=t.name
WHERE t.schema_id=(SELECT schema_id FROM [$(Referencia)].sys.schemas WHERE name='dbo');
SELECT t.name AS Tabla,c.column_id,c.name AS Columna,c.system_type_id,c.max_length,c.precision,c.scale,
 c.is_nullable,c.is_identity,c.is_computed,c.collation_name INTO #ColumnasDespues
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
JOIN @objetos o ON o.tabla=t.name WHERE t.schema_id=SCHEMA_ID('dbo');
IF EXISTS(SELECT * FROM #ColumnasAntes EXCEPT SELECT * FROM #ColumnasDespues)
 OR EXISTS(SELECT * FROM #ColumnasDespues EXCEPT SELECT * FROM #ColumnasAntes)
 THROW 54766,'Cambió la estructura de columnas de un objeto existente.',1;

SELECT f.name AS Restriccion,t.name AS Hijo,p.name AS Padre,c.constraint_column_id,
 a.name AS ColumnaHija,b.name AS ColumnaPadre,f.delete_referential_action,f.update_referential_action,
 f.is_disabled,f.is_not_trusted INTO #FkAntes
FROM [$(Referencia)].sys.foreign_keys f
JOIN [$(Referencia)].sys.foreign_key_columns c ON c.constraint_object_id=f.object_id
JOIN [$(Referencia)].sys.tables t ON t.object_id=c.parent_object_id
JOIN [$(Referencia)].sys.tables p ON p.object_id=c.referenced_object_id
JOIN [$(Referencia)].sys.columns a ON a.object_id=t.object_id AND a.column_id=c.parent_column_id
JOIN [$(Referencia)].sys.columns b ON b.object_id=p.object_id AND b.column_id=c.referenced_column_id
JOIN @objetos o ON o.tabla=t.name;
SELECT f.name AS Restriccion,t.name AS Hijo,p.name AS Padre,c.constraint_column_id,
 a.name AS ColumnaHija,b.name AS ColumnaPadre,f.delete_referential_action,f.update_referential_action,
 f.is_disabled,f.is_not_trusted INTO #FkDespues
FROM sys.foreign_keys f JOIN sys.foreign_key_columns c ON c.constraint_object_id=f.object_id
JOIN sys.tables t ON t.object_id=c.parent_object_id JOIN sys.tables p ON p.object_id=c.referenced_object_id
JOIN sys.columns a ON a.object_id=t.object_id AND a.column_id=c.parent_column_id
JOIN sys.columns b ON b.object_id=p.object_id AND b.column_id=c.referenced_column_id
JOIN @objetos o ON o.tabla=t.name;
IF EXISTS(SELECT * FROM #FkAntes EXCEPT SELECT * FROM #FkDespues)
 OR EXISTS(SELECT * FROM #FkDespues EXCEPT SELECT * FROM #FkAntes)
 THROW 54767,'Cambió una clave foránea existente.',1;

CREATE TABLE #Hechos (Hecho sysname,Antes nvarchar(max),Despues nvarchar(max));
DECLARE @tabla sysname,@cols nvarchar(max),@sql nvarchar(max),@igual bit;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tabla,proyeccion,igualConteo FROM @objetos;
OPEN c;
FETCH NEXT FROM c INTO @tabla,@cols,@igual;
WHILE @@FETCH_STATUS=0
BEGIN
 IF @cols IS NULL
  SELECT @cols=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),',') WITHIN GROUP (ORDER BY c.column_id)
  FROM [$(Referencia)].sys.columns c JOIN [$(Referencia)].sys.tables t ON t.object_id=c.object_id
  JOIN [$(Referencia)].sys.schemas s ON s.schema_id=t.schema_id WHERE t.name=@tabla AND s.name='dbo';
 SET @sql=N'IF EXISTS (SELECT '+@cols+N' FROM [$(Referencia)].dbo.'+QUOTENAME(@tabla)+N'
  EXCEPT SELECT '+@cols+N' FROM dbo.'+QUOTENAME(@tabla)+N')
  OR (@igual=1 AND (SELECT COUNT_BIG(*) FROM [$(Referencia)].dbo.'+QUOTENAME(@tabla)+N')
  <>(SELECT COUNT_BIG(*) FROM dbo.'+QUOTENAME(@tabla)+N'))
  THROW 54731,@mensaje,1;';
 DECLARE @mensaje nvarchar(2048)=N'Diferencia en '+@tabla;
 EXEC sys.sp_executesql @sql,N'@igual bit,@mensaje nvarchar(2048)',@igual,@mensaje;
 IF @tabla LIKE 'Fact[_]%'
 BEGIN
  DECLARE @sumas nvarchar(max);
  SELECT @sumas=STRING_AGG(CONVERT(nvarchar(max),N'SUM(CONVERT(decimal(38,6),'+
   QUOTENAME(c.name)+N')) AS '+QUOTENAME(c.name)),N',') WITHIN GROUP(ORDER BY c.column_id)
  FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.'+@tabla)
   AND c.system_type_id IN (48,52,56,59,60,62,106,108,122,127) AND c.name NOT LIKE 'Key%';
  DECLARE @agregado nvarchar(max)=N'SELECT COUNT_BIG(*) AS Filas'+COALESCE(N','+@sumas,N'');
  SET @sql=N'INSERT #Hechos SELECT @t,('+@agregado+N' FROM [$(Referencia)].dbo.'+QUOTENAME(@tabla)+
   N' FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES),('+@agregado+N' FROM dbo.'+QUOTENAME(@tabla)+
   N' FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);';
  EXEC sys.sp_executesql @sql,N'@t sysname',@t=@tabla;
 END;
 FETCH NEXT FROM c INTO @tabla,@cols,@igual;
END;
CLOSE c;
DEALLOCATE c;

IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 THROW 54732,'Hay relaciones deshabilitadas o no confiables en el Mart.',1;
IF EXISTS(SELECT 1 FROM #Hechos WHERE Antes<>Despues) THROW 54768,'Cambió una suma o conteo de hechos.',1;
SELECT Hecho,Antes,Despues FROM #Hechos ORDER BY Hecho;
SELECT COUNT(*) AS ObjetosComparados,(SELECT COUNT(*) FROM #FkAntes) AS ColumnasFKComparadas FROM @objetos;
SELECT 'Claves originales, atributos protegidos, Dim_Hora y hechos conservados' AS Resultado;
