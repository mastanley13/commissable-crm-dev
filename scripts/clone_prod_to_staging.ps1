<#
Requires: pg_dump, pg_restore, psql in PATH
Usage (PowerShell):
  .\scripts\clone_prod_to_staging.ps1 \
    -ProdUrl "$env:PROD_URL" \
    -StagingAdminUrl "$env:STAGING_ADMIN_URL" \
    -StagingDbName "commissable_crm_staging" \
    -StagingAppUser "commissable_staging" \
    -StagingAppPassword "<strong-password>" \
    -OutFile "backups/backup_$(Get-Date -Format 'yyyyMMdd_HHmm')_prod.dump"
#>

[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [Parameter(Mandatory=$true)] [string] $ProdUrl,
  [Parameter(Mandatory=$true)] [string] $StagingAdminUrl,
  [Parameter(Mandatory=$true)] [string] $StagingDbName,
  [Parameter(Mandatory=$true)] [string] $StagingAppUser,
  [Parameter(Mandatory=$true)] [string] $StagingAppPassword,
  [Parameter()] [string] $OutFile = $(Join-Path (Resolve-Path '.') ("backups/backup_{0}_prod.dump" -f (Get-Date -Format 'yyyyMMdd_HHmm'))),
  [switch] $DropExisting,
  [switch] $SkipCreateUser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null

Write-Host "[1/5] Backing up prod -> $OutFile"
& pg_dump "$ProdUrl" --format=custom --no-owner --no-privileges --file="$OutFile"

Write-Host "[2/5] Creating staging database: $StagingDbName"
$dropSql = ""
if ($DropExisting.IsPresent) {
  $dropSql = "DROP DATABASE IF EXISTS `"$StagingDbName`";"
}
$createSql = @"
${dropSql}
CREATE DATABASE "$StagingDbName" WITH TEMPLATE template0 ENCODING 'UTF8';
"@
& psql "$StagingAdminUrl" -v ON_ERROR_STOP=1 -c "$createSql"

if (-not $SkipCreateUser) {
  Write-Host "[3/5] Ensuring staging app user exists + privileges"
  $userSql = @"
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$StagingAppUser') THEN
    CREATE USER "$StagingAppUser" WITH PASSWORD '$StagingAppPassword';
  END IF;
END$$;
GRANT ALL PRIVILEGES ON DATABASE "$StagingDbName" TO "$StagingAppUser";
"@
  & psql "$StagingAdminUrl" -v ON_ERROR_STOP=1 -c "$userSql"
}

Write-Host "[4/5] Restoring backup into staging"
$stagingDbUrl = ($StagingAdminUrl -replace '^postgres://', 'postgresql://')
# Replace the last path segment (or append) with the staging DB name
if ($stagingDbUrl -match '/[^/]*$') {
  $stagingDbUrl = ($stagingDbUrl -replace '/[^/]*$', "/$StagingDbName")
} else {
  if ($stagingDbUrl.EndsWith('/')) {
    $stagingDbUrl += $StagingDbName
  } else {
    $stagingDbUrl += "/$StagingDbName"
  }
}
& pg_restore --dbname="$stagingDbUrl" --clean --if-exists --no-owner --no-privileges "$OutFile"

Write-Host "[5/5] Done. Example .env.local entries:" -ForegroundColor Green
Write-Host ("DATABASE_URL=postgresql://{0}:{1}@<staging-host>:5432/{2}" -f $StagingAppUser, $StagingAppPassword, $StagingDbName)
Write-Host ("DIRECT_URL=postgresql://{0}:{1}@<staging-host>:5432/{2}" -f $StagingAppUser, $StagingAppPassword, $StagingDbName)
