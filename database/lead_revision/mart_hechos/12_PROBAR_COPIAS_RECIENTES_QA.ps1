# Ejecutar desde la raíz. Usa solo las dos copias del ensayo reciente.
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$p = 'database/lead_revision/mart_hechos'
$d = 'database/lead_revision/mart_dimensiones'
$fixture = Get-Content "$p/06_PROBAR_HECHOS_QA.sql" -Raw -Encoding UTF8
$include = ':r .\database\lead_revision\mart_dimensiones\03_CARGAR_DIMENSIONES.sql'
$carga = Get-Content "$d/03_CARGAR_DIMENSIONES.sql" -Raw -Encoding UTF8
$guarda = ':r .\database\lead_revision\mart_dimensiones\00_CONTEXTO.sql'
if (!$fixture.Contains($include) -or !$carga.StartsWith($guarda)) {
    throw 'Revisar las inclusiones de la prueba antes de ejecutarla.'
}
# Sustituir en memoria solo la guarda histórica de dimensiones por la guarda
# QA que reconoce el par reciente. El cuerpo dimensional sigue sin cambios.
$cuerpo = $carga.Substring($guarda.Length).TrimStart()
$contexto = ':r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql'
$prueba = $fixture.Replace($include, $contexto + [Environment]::NewLine + $cuerpo)
$prueba | & sqlcmd -S localhost -E -C -I -b -f 65001 -d NexoSalud_Mart_LeadFactsQA `
    -v Origen=NexoSaludDB_LeadFactsQA AutorizarPrincipal=NO ProvocarError=NO
if ($LASTEXITCODE -ne 0) { throw "Falló la prueba sintética ($LASTEXITCODE)." }
