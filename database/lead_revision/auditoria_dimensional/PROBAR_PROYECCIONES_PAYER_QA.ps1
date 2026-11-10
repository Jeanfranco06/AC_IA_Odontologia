$ErrorActionPreference = 'Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$commit='14b4e0b2060e5f7b3ab532ca9e606c75e12e8382'
function ReadSql($name) {
    $r=git show "${commit}:database/payer_revision/sql/$name"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo leer $name" }
    $r -join "`n"
}
$etl=ReadSql '04_etl_poblamiento_payer.sql'
$ddl=ReadSql '02_mart_dimensiones_payer.sql'
$sql=@"
SET NOCOUNT ON;
IF DB_NAME()<>'NexoSalud_Mart_LeadQA' OR DB_ID('NexoSaludDB_MartLeadQA') IS NULL
 THROW 54800,'Solo las copias de auditoría.',1;
SELECT id_reserva,id_opcion,id_solicitud,fecha_reserva,estado,
 CAST(NULL AS varchar(50)) AS ultima_alerta_dunning,CAST(NULL AS int) AS score_riesgo_impago
 INTO #Reservas FROM NexoSaludDB_MartLeadQA.dbo.Reservas;
SELECT id_pago+0 AS id_pago,id_reserva,estado,importe,canal_pago,fecha_registro,fecha_validacion
 INTO #Pagos FROM NexoSaludDB_MartLeadQA.dbo.Pagos;
SELECT id_incidencia+0 AS id_incidencia,id_pago,tipo INTO #Incidencias FROM NexoSaludDB_MartLeadQA.dbo.Incidencias;
SELECT id_atencion+0 AS id_atencion,id_reserva INTO #Atenciones FROM NexoSaludDB_MartLeadQA.dbo.Atenciones;
"@
foreach ($dim in @('Dim_Incidencia','Dim_NotificacionCobranza','Dim_RiesgoImpago')) {
    $ddlPart=[regex]::Match($ddl,"(?s)CREATE TABLE dbo\.$dim\s*\(.*?\);")
    $seedPart=[regex]::Match($ddl,"(?s)INSERT INTO dbo\.$dim\s*\(.*?;")
    if (!$ddlPart.Success -or !$seedPart.Success) { throw "No se encontró la dimensión $dim" }
    $sql+="`n"+$ddlPart.Value.Replace("dbo.$dim","#$dim")+"`n"+$seedPart.Value.Replace("dbo.$dim","#$dim")
}
$queries=@{}
foreach ($n in 1..3) {
    $m=[regex]::Match($etl,"(?s);WITH SourceF$n AS \(.*?\)(?=\s*MERGE dbo\.)")
    if (!$m.Success) { throw "No se encontró la proyección F$n" }
    $s=$m.Value
    foreach ($t in @('Reservas','Pagos','Incidencias','Atenciones')) { $s=$s.Replace("[NexoSaludDB].dbo.$t","#$t") }
    foreach ($t in @('Dim_Incidencia','Dim_NotificacionCobranza','Dim_RiesgoImpago')) { $s=$s.Replace("dbo.$t","#$t") }
    $s=$s.Replace('[NexoSaludDB].dbo.','NexoSaludDB_MartLeadQA.dbo.')
    if ($s -match '(?i)\b(USE|MERGE|UPDATE|DELETE|DROP|INSERT|EXEC)\s') { throw 'Proyección inesperada' }
    $queries[$n]=$s
    $sql+="`n"+$s+"`nSELECT * INTO #F$n FROM SourceF$n;"
}
$sql+=@"

SELECT 'F1' AS Prueba,(SELECT COUNT(*) FROM #Pagos) AS PagosOLTP,SUM(PagosRegistrados) AS PagosProyeccion,
 (SELECT SUM(importe) FROM #Pagos WHERE estado='Confirmado') AS BrutoOLTP,SUM(IngresosBrutosRecaudados) AS BrutoProyeccion,
 SUM(CASE WHEN dt.KeyTiempo IS NULL THEN f.PagosRegistrados ELSE 0 END) AS PagosFechaHuerfana
FROM #F1 f LEFT JOIN dbo.Dim_Tiempo dt ON dt.KeyTiempo=f.KeyTiempo;
SELECT 'F2' AS Prueba,(SELECT COUNT(*) FROM #Pagos WHERE estado='Confirmado') AS ConfirmadosOLTP,
 SUM(PagosValidados) AS ValidadosProyeccion,SUM(TiempoTotalValidacionMin) AS MinutosProyeccion FROM #F2;
SELECT 'F3' AS Prueba,(SELECT COUNT(*) FROM #Reservas) AS ReservasOLTP,SUM(ReservasPreagendadas) AS ReservasProyeccion,
 (SELECT COUNT(*) FROM #Reservas r WHERE EXISTS(SELECT 1 FROM #Atenciones a WHERE a.id_reserva=r.id_reserva)) AS ReservasConAtencion,
 SUM(ConversionesACustomer) AS ConversionesProyeccion,
 (SELECT COUNT(*) FROM #Pagos) AS PagosOLTP,SUM(PagosRegistrados) AS PagosProyeccion FROM #F3;
SELECT f.KeyCobro,c.EstadoPago,SUM(f.PagosValidados) AS Validados,SUM(f.PagosPendientes) AS Pendientes,
 SUM(f.PagosRechazados) AS Rechazados FROM #F1 f
 LEFT JOIN dbo.Dim_Cobro c ON c.KeyCobro=f.KeyCobro GROUP BY f.KeyCobro,c.EstadoPago ORDER BY f.KeyCobro;
SELECT 'Lookup' AS Prueba,
 (SELECT COUNT(*) FROM #Pagos p WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Tiempo d WHERE d.id_fecha=CONVERT(date,p.fecha_registro))) AS FechaSinMatch,
 (SELECT COUNT(*) FROM #Pagos p WHERE NOT EXISTS(SELECT 1 FROM dbo.Dim_Pasarela d WHERE d.MetodoPago=p.canal_pago)) AS PasarelaSinMatch,
 (SELECT COUNT(*) FROM (SELECT MetodoPago FROM dbo.Dim_Pasarela GROUP BY MetodoPago HAVING COUNT(*)>1) d) AS MetodosAmbiguosAhora;
SELECT TipoIncidencia,COUNT(*) AS MiembrosSemilla FROM #Dim_Incidencia GROUP BY TipoIncidencia HAVING COUNT(*)>1;

SELECT TOP(1) * INTO #ReservaCaso FROM #Reservas ORDER BY id_reserva;
SELECT TOP(0) * INTO #PagoCaso FROM #Pagos;
INSERT #PagoCaso SELECT v.id,r.id_reserva,'Validado',v.importe,'Yape',
 CAST(r.fecha_reserva AS datetime2),DATEADD(minute,25,r.fecha_reserva)
 FROM #ReservaCaso r CROSS JOIN (VALUES(1,100.00),(2,80.00)) v(id,importe);
SELECT TOP(0) * INTO #IncidenciaCaso FROM #Incidencias;
INSERT #IncidenciaCaso VALUES(1,1,'RECHAZO_VOUCHER'),(2,1,'RECHAZO_VOUCHER');
SELECT TOP(0) * INTO #AtencionCaso FROM #Atenciones;
INSERT #AtencionCaso SELECT v.id,r.id_reserva FROM #ReservaCaso r CROSS JOIN (VALUES(1),(2),(3)) v(id);
"@
foreach ($n in 1..3) {
    $q=$queries[$n].Replace('#Reservas','#ReservaCaso').Replace('#Pagos','#PagoCaso').Replace('#Incidencias','#IncidenciaCaso').Replace('#Atenciones','#AtencionCaso')
    $sql+="`n"+$q+"`nSELECT * INTO #CasoF$n FROM SourceF$n;"
}
$sql+=@"

SELECT 'Caso F1' AS Prueba,SUM(PagosRegistrados) AS Pagos,SUM(IngresosBrutosRecaudados) AS Bruto FROM #CasoF1;
SELECT 'Caso F2' AS Prueba,SUM(PagosValidados) AS Validados,SUM(TiempoTotalValidacionMin) AS Minutos,
 SUM(CantidadIncidencias) AS Incidencias FROM #CasoF2;
SELECT 'Caso F3' AS Prueba,SUM(ReservasPreagendadas) AS Reservas,SUM(PagosRegistrados) AS Pagos,
 SUM(ConversionesACustomer) AS Conversiones FROM #CasoF3;
SELECT * INTO #DestinoF1 FROM #CasoF1;
UPDATE #PagoCaso SET estado='Pendiente';
"@
$changed=$queries[1].Replace('#Reservas','#ReservaCaso').Replace('#Pagos','#PagoCaso')
$merge=[regex]::Match($etl,'(?s)MERGE dbo\.Fact_RecaudacionPayer AS target.*?;')
if (!$merge.Success) { throw 'No se encontró MERGE F1' }
$sql+="`n"+$changed+"`n"+$merge.Value.Replace('dbo.Fact_RecaudacionPayer','#DestinoF1')
$sql+="`nSELECT 'Cambio estado F1' AS Prueba,SUM(PagosRegistrados) AS ProyeccionAcumulada,(SELECT COUNT(*) FROM #PagoCaso) AS Fuente FROM #DestinoF1;"
$old="estado IN ('Revertido','Fallido','Confirmado','Pendiente')"
$oltp=ReadSql '01_oltp_payer_extension.sql'
$c=[regex]::Match($oltp,'(?s)ADD CONSTRAINT CK_Pagos_Estado_Oficial CHECK \((.*?)\);')
if (!$c.Success) { throw 'No se encontró el CHECK PAYER' }
$sql+="`nCREATE TABLE #Estado(estado varchar(20), CHECK($old), CHECK("+$c.Groups[1].Value+"));"
$sql+=@"

BEGIN TRY
 INSERT #Estado VALUES('Validado');
 THROW 54801,'Se esperaba rechazo por CHECK.',1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>547 THROW;
 SELECT 'Ambos CHECK activos: Validado rechazado' AS Resultado,ERROR_NUMBER() AS Error;
END CATCH;
GO
"@
$sql | sqlcmd -S localhost -E -C -I -b -d NexoSalud_Mart_LeadQA -W -s '|' -f 65001
exit $LASTEXITCODE
