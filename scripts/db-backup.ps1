param(
  [string]$ProjectRoot = "D:\math",
  [string]$BackupDir = "",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BackupDir)) {
  $BackupDir = Join-Path $ProjectRoot "backups\postgres"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpFile = Join-Path $BackupDir "aittcodb-$timestamp.sql"
$latestFile = Join-Path $BackupDir "latest.sql"

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

Write-Host "[db-backup] Writing backup to $dumpFile"

$dump = docker exec aittco-db pg_dump -U aittcouser -d aittcodb --clean --if-exists --no-owner --no-privileges
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

[System.IO.File]::WriteAllText($dumpFile, ($dump -join [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
Copy-Item $dumpFile $latestFile -Force

Get-ChildItem $BackupDir -File -Filter "mathdb-*.sql" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Host "[db-backup] Backup complete"
Write-Host "[db-backup] Latest backup: $dumpFile"
