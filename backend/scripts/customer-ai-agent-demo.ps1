param(
  [string]$BaseUrl = 'http://localhost:3001',
  [string]$PatientToken = $env:AI_AGENT_PATIENT_TOKEN,
  [string]$StaffToken = $env:AI_AGENT_STAFF_TOKEN,
  [int]$TreatmentId = 0,
  [int]$AttentionId = 0
)

$ErrorActionPreference = 'Stop'

Write-Host 'A: acceso sin autenticación (debe responder 401)'
try { Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/me/treatments" -Method Get } catch { Write-Host $_.Exception.Response.StatusCode }

if ($PatientToken) {
  $headers = @{ Authorization = "Bearer $PatientToken" }
  Write-Host 'B: tratamientos propios'
  Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/me/treatments" -Headers $headers -Method Get | ConvertTo-Json -Depth 8
  if ($TreatmentId -gt 0) {
    Write-Host 'C: sesiones y progreso del tratamiento autorizado'
    Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/treatments/$TreatmentId/sessions?page=1&pageSize=20" -Headers $headers -Method Get | ConvertTo-Json -Depth 8
    Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/treatments/$TreatmentId/progress" -Headers $headers -Method Get | ConvertTo-Json -Depth 8
  }
  if ($AttentionId -gt 0) {
    Write-Host 'D: indicaciones aprobadas y emitidas'
    Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/attentions/$AttentionId/approved-instructions" -Headers $headers -Method Get | ConvertTo-Json -Depth 8
  }
}

if ($StaffToken -and $AttentionId -gt 0) {
  Write-Host 'E: contexto clínico del odontólogo autorizado'
  Invoke-RestMethod "$BaseUrl/api/customer/ai-agent/clinical/$AttentionId/context" -Headers @{ Authorization = "Bearer $StaffToken" } -Method Get | ConvertTo-Json -Depth 8
}
