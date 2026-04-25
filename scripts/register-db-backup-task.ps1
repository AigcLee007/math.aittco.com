param(
  [string]$ProjectRoot = "D:\math",
  [string]$TaskName = "Math Database Backup",
  [string]$StartTime = "03:30",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $ProjectRoot "scripts\db-backup.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Backup script not found: $scriptPath"
}

$taskCommand = "powershell.exe -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectRoot `"$ProjectRoot`" -RetentionDays $RetentionDays"

schtasks /Create /TN $TaskName /SC DAILY /ST $StartTime /TR $taskCommand /F | Out-Null

Write-Host "[db-backup] Scheduled task created: $TaskName at $StartTime"
