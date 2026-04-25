param(
  [Parameter(Mandatory = $false)]
  [string]$DumpFile = $args[0]
)

if (!$DumpFile) {
  $DumpFile = "latest.sql"
}

$ErrorActionPreference = "Stop"

if (!(Test-Path $DumpFile)) {
  Write-Host "[db-restore] Error: Backup file not found: $DumpFile"
  exit 1
}

Write-Host "[db-restore] Restoring from $DumpFile to aittco-db..."

Get-Content $DumpFile -Raw | docker exec -i aittco-db psql -U aittcouser -d aittcodb

if ($LASTEXITCODE -ne 0) {
  throw "psql restore failed with exit code $LASTEXITCODE"
}

Write-Host "[db-restore] Restore complete"
