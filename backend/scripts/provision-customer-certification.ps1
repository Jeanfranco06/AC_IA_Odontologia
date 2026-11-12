param([string]$Server = 'localhost')
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$localConfig = Join-Path $workspace 'backend/.env.customer-cert.local'
if (Test-Path -LiteralPath $localConfig) { Write-Output 'Configuración aislada existente; no se rotan credenciales.'; exit 0 }
$random = [Guid]::NewGuid().ToString('N')
$login = 'NexoSaludCert_' + $random.Substring(0, 10)
$password = [Guid]::NewGuid().ToString('N') + 'aA!9'
$secret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$staging = Join-Path $workspace 'backend/storage/certification'
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$sqlPath = Join-Path $staging 'provision-private.sql'
$sql = @"
USE master;
IF DB_ID('NexoSaludDB_Test') IS NULL OR DB_ID('NexoSalud_Mart_Test') IS NULL
 THROW 55900, 'Faltan las dos bases aisladas; no se clonan datos operativos.', 1;
CREATE LOGIN [$login] WITH PASSWORD=N'$password', CHECK_POLICY=ON, DEFAULT_DATABASE=[NexoSaludDB_Test];
USE NexoSaludDB_Test;
IF EXISTS(SELECT 1 FROM dbo.Personas WHERE dni NOT LIKE '99%')
 THROW 55901, 'La base de prueba contiene identidades fuera del fixture sintético.', 1;
CREATE USER [$login] FOR LOGIN [$login];
ALTER ROLE db_datareader ADD MEMBER [$login];
ALTER ROLE db_datawriter ADD MEMBER [$login];
GRANT EXECUTE TO [$login];
GRANT VIEW DEFINITION TO [$login];
USE NexoSalud_Mart_Test;
CREATE USER [$login] FOR LOGIN [$login];
ALTER ROLE db_datareader ADD MEMBER [$login];
ALTER ROLE db_datawriter ADD MEMBER [$login];
GRANT EXECUTE TO [$login];
GRANT VIEW DEFINITION TO [$login];
"@
try {
 Set-Content -LiteralPath $sqlPath -Value $sql -Encoding UTF8
 & sqlcmd -S $Server -E -C -b -i $sqlPath | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Falló el aprovisionamiento aislado.' }
 $instance = (& sqlcmd -S $Server -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128));" | Where-Object { $_.Trim() }) -join ''
 @"
SQLSERVER_URL="sqlserver://${Server}:1433;database=NexoSaludDB_Test;user=$login;password=$password;encrypt=true;trustServerCertificate=true"
DB_SERVER=$Server
DB_USER=$login
DB_PASSWORD=$password
OLTP_DATABASE=NexoSaludDB_Test
MART_DATABASE=NexoSalud_Mart_Test
AI_AGENT_TEST_SQLSERVER_INSTANCE=$($instance.Trim())
AI_AGENT_SQLSERVER_INTEGRATION=true
AI_AGENT_SESSION_SECRET=$secret
SESSION_SECRET=$secret
AI_AGENT_LLM_ENABLED=false
AI_AGENT_EXTERNAL_DATA_AUTHORIZED=false
AI_AGENT_RAG_FALLBACK_ENABLED=false
PATIENT_OTP_SIMULATION_ENABLED=false
CUSTOMER_ALERT_SCHEDULER_ENABLED=false
PORT=3101
"@ | Set-Content -LiteralPath $localConfig -Encoding UTF8
 Write-Output 'Credencial DML/EXECUTE creada solo en las dos bases Test; configuración privada guardada sin imprimir secretos.'
} finally {
 if (Test-Path -LiteralPath $sqlPath) { Remove-Item -LiteralPath $sqlPath }
}
