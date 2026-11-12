$ErrorActionPreference='Stop'
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$config=Join-Path $workspace 'backend/.env.customer-analytics.local'
if(Test-Path -LiteralPath $config){Write-Output 'Credencial analítica Test existente; no se modifica.';exit 0}
$login='NexoSaludBIRead_'+[Guid]::NewGuid().ToString('N').Substring(0,10)
$password=[Guid]::NewGuid().ToString('N')+'aA!9'
$sqlFile=Join-Path $workspace 'backend/storage/certification/provision-bi-private.sql'
$objects=@('Fact_TratamientoCustomer','Fact_SesionCustomer','Fact_AtencionCustomer_V2','Fact_InteraccionIACustomer','Dim_Tiempo','Dim_Sede','Dim_Servicio','Dim_Profesional','ETL_EjecucionLog')
$grants=($objects|ForEach-Object {"GRANT SELECT ON OBJECT::dbo.[$_] TO [$login];"}) -join "`r`n"
$sql=@"
USE master;
IF DB_ID('NexoSalud_Mart_Test') IS NULL THROW 55900,'Falta Mart Test.',1;
CREATE LOGIN [$login] WITH PASSWORD=N'$password', CHECK_POLICY=ON,DEFAULT_DATABASE=NexoSalud_Mart_Test;
USE NexoSalud_Mart_Test;
IF DB_NAME()<>'NexoSalud_Mart_Test' THROW 55901,'Destino no autorizado.',1;
CREATE USER [$login] FOR LOGIN [$login];
$grants
DENY INSERT,UPDATE,DELETE,EXECUTE ON SCHEMA::dbo TO [$login];
"@
try{
 Set-Content -LiteralPath $sqlFile -Value $sql -Encoding UTF8
 & sqlcmd -S localhost -E -C -b -i $sqlFile | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Falló aprovisionamiento BI Test.'}
 Set-Content -LiteralPath $config -Value "MART_READ_URL=`"sqlserver://localhost:1433;database=NexoSalud_Mart_Test;user=$login;password=$password;encrypt=true;trustServerCertificate=true`"" -Encoding UTF8
 Write-Output 'Cuenta BI creada exclusivamente en Mart Test: SELECT de nueve objetos y DENY DML/EXECUTE; sin acceso principal.'
}finally{if(Test-Path -LiteralPath $sqlFile){Remove-Item -LiteralPath $sqlFile}}
