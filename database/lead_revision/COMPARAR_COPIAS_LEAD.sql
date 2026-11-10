:ON ERROR EXIT
SET NOCOUNT ON;
IF N'$(Referencia)' NOT IN (N'NexoSalud_LeadReferencia',N'NexoSalud_LeadPreinstalacion',N'NexoSalud_LeadVentana')
 OR N'$(Destino)' NOT IN (N'NexoSalud_LeadPruebas',N'NexoSalud_LeadEnsayoFinal',N'NexoSaludDB')
 THROW 54611,'Los nombres de bases no corresponden a esta revisión.',1;
IF DB_NAME() <> N'master' OR DB_ID(N'$(Referencia)') IS NULL
    OR DB_ID(N'$(Destino)') IS NULL
 THROW 54501,'Ejecutar desde master con las dos copias de LEAD.',1;

CREATE TABLE #Inventario (
 base sysname NOT NULL, clase nvarchar(60) NOT NULL, objeto nvarchar(400) NOT NULL,
 firma nvarchar(max) NULL
);
DECLARE @base sysname,@sql nvarchar(max);
DECLARE bases CURSOR LOCAL FAST_FORWARD FOR
 SELECT nombre FROM (VALUES(N'$(Referencia)'),(N'$(Destino)')) b(nombre);
OPEN bases;
FETCH NEXT FROM bases INTO @base;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @sql=N'USE '+QUOTENAME(@base)+N';
 INSERT #Inventario
 SELECT DB_NAME(), o.type_desc,
   QUOTENAME(s.name)+N''.''+COALESCE(QUOTENAME(p.name)+N''.'',N'''')+
   CASE WHEN d.is_system_named=1 THEN N''DEFAULT(''+COL_NAME(o.parent_object_id,d.parent_column_id)+N'')''
   ELSE QUOTENAME(o.name) END,
   COALESCE(m.definition,d.definition,k.definition)
 FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
 LEFT JOIN sys.objects p ON p.object_id=o.parent_object_id
 LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id
 LEFT JOIN sys.default_constraints d ON d.object_id=o.object_id
 LEFT JOIN sys.check_constraints k ON k.object_id=o.object_id
 WHERE o.is_ms_shipped=0;
 INSERT #Inventario
 SELECT DB_NAME(),N''COLUMNA'',QUOTENAME(SCHEMA_NAME(t.schema_id))+N''.''+QUOTENAME(t.name)+N''.''+QUOTENAME(c.name),
   CONCAT(TYPE_NAME(c.user_type_id),N'' bytes='',c.max_length,N'' precisión='',c.precision,N'' escala='',c.scale,
    N'' nullable='',c.is_nullable,N'' identidad='',c.is_identity,N'' collation='',c.collation_name)
 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id WHERE t.is_ms_shipped=0;
 INSERT #Inventario
 SELECT DB_NAME(),N''INDICE'',QUOTENAME(SCHEMA_NAME(t.schema_id))+N''.''+QUOTENAME(t.name)+N''.''+QUOTENAME(i.name),
   CONCAT(i.type_desc,N'' único='',i.is_unique,N'' filtro='',i.filter_definition,N'' columnas='',
    (SELECT STRING_AGG(CONVERT(nvarchar(max),CONCAT(COL_NAME(ic.object_id,ic.column_id),
      N''/'',ic.key_ordinal,N''/'',ic.is_descending_key,N''/'',ic.is_included_column)),N'','')
      WITHIN GROUP(ORDER BY ic.index_column_id)
     FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id))
 FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id
 WHERE t.is_ms_shipped=0 AND i.name IS NOT NULL AND i.is_primary_key=0 AND i.is_unique_constraint=0;';
 EXEC sys.sp_executesql @sql;
 FETCH NEXT FROM bases INTO @base;
END;
CLOSE bases;
DEALLOCATE bases;
SELECT CASE WHEN a.objeto IS NULL THEN 'FALTA_EN_REFERENCIA' WHEN b.objeto IS NULL THEN 'SOLO_EN_REFERENCIA'
            ELSE 'FIRMA_DISTINTA' END AS diferencia,
       COALESCE(a.clase,b.clase) AS clase,COALESCE(a.objeto,b.objeto) AS objeto,
       CASE WHEN COALESCE(a.clase,b.clase) IN ('COLUMNA','INDICE','DEFAULT_CONSTRAINT') THEN b.firma END AS firma_pruebas
FROM (SELECT * FROM #Inventario WHERE base=N'$(Referencia)') a
FULL JOIN (SELECT * FROM #Inventario WHERE base=N'$(Destino)') b
 ON a.clase=b.clase AND a.objeto=b.objeto
WHERE a.objeto IS NULL OR b.objeto IS NULL
   OR ISNULL(HASHBYTES('SHA2_256',a.firma),0x0)<>ISNULL(HASHBYTES('SHA2_256',b.firma),0x0)
ORDER BY diferencia,clase,objeto;
