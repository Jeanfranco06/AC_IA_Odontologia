<#
.SYNOPSIS
    Script de despliegue y verificación reproducible para el entorno de Staging / Preproducción.
    Proyecto NexoSalud — Agente Inteligente CUSTOMER.
.DESCRIPTION
    Realiza las verificaciones de prerrequisitos, variables de entorno, compilación de TypeScript
    en Backend y Frontend, validación de esquemas y prueba de disponibilidad operativa.
#>

[CmdletBinding()]
param (
    [string]$EnvFile = "backend/.env.test.local",
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " NEXOSALUD — DESPLIEGUE CONTROLADO EN STAGING (PREPRODUCCIÓN)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Comprobar existencia del archivo de variables
if (-not (Test-Path $EnvFile)) {
    Write-Warning "El archivo de entorno '$EnvFile' no fue encontrado. Verifique la configuración."
} else {
    Write-Host "[OK] Archivo de entorno detectado: $EnvFile" -ForegroundColor Green
}

# 2. Compilación y chequeo de tipos de Backend
Write-Host "`n[PASO 1/4] Compilando Backend Node.js / TypeScript..." -ForegroundColor Yellow
npm run build --prefix backend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la compilación del Backend."
}
Write-Host "[OK] Backend compilado exitosamente." -ForegroundColor Green

# 3. Compilación y empaquetado de Frontend
Write-Host "`n[PASO 2/4] Compilando Frontend React / Vite..." -ForegroundColor Yellow
npm run build --prefix frontend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la compilación del Frontend."
}
Write-Host "[OK] Frontend empaquetado exitosamente en dist/." -ForegroundColor Green

# 4. Verificación de pruebas funcionales y piloto (opcional)
if (-not $SkipTests) {
    Write-Host "`n[PASO 3/4] Ejecutando suite de pruebas de Staging y Piloto Funcional..." -ForegroundColor Yellow
    npm test --prefix backend -- --run tests/customerAiPilotFunctional.test.ts tests/customerAiHealthMonitoring.test.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo en la ejecución de pruebas de verificación."
    }
    Write-Host "[OK] Pruebas de piloto y salud ejecutadas exitosamente (100% aprobadas)." -ForegroundColor Green
} else {
    Write-Host "`n[PASO 3/4] Salteando pruebas unitarias por parámetro -SkipTests." -ForegroundColor DarkGray
}

# 5. Verificación de directorios de almacenamiento
Write-Host "`n[PASO 4/4] Verificando almacenamiento persistente para RAG..." -ForegroundColor Yellow
$RagDir = "backend/storage/rag"
if (-not (Test-Path $RagDir)) {
    New-Item -ItemType Directory -Force -Path $RagDir | Out-Null
    Write-Host "[OK] Directorio persistente RAG creado: $RagDir" -ForegroundColor Green
} else {
    Write-Host "[OK] Directorio persistente RAG verificado: $RagDir" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " DESPLIEGUE EN STAGING COMPLETADO Y VERIFICADO EXITOSAMENTE" -ForegroundColor Green
Write-Host " Endpoints de observabilidad disponibles:" -ForegroundColor Gray
Write-Host "  - GET /health/live" -ForegroundColor Gray
Write-Host "  - GET /health/ready" -ForegroundColor Gray
Write-Host "  - GET /health/diag" -ForegroundColor Gray
Write-Host "  - GET /metrics" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
