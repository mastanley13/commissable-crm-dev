Param(
  [string]$PortPreference = "3001"
)

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host $msg -ForegroundColor Red }

Set-Location "$PSScriptRoot\.." | Out-Null

Write-Step "Checking Cloud SQL Proxy on 127.0.0.1:5432"
$tcp = $null
try { $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue } catch {}
if (-not $tcp -or -not $tcp.TcpTestSucceeded) {
  Write-Err "TCP to 127.0.0.1:5432 failed. Start the Cloud SQL Proxy and retry."
  Write-Warn "Example: cd C:\\cloud-sql-proxy; .\\cloud_sql_proxy.exe -instances=groovy-design-471709-d1:us-central1:commissable-sql=tcp:5432"
  exit 1
}
Write-Ok "Proxy reachable."

Write-Step "Initializing database schema (migrate deploy)"
$env:NODE_OPTIONS = ''
try {
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed" }
  Write-Ok "Migrations applied."
} catch {
  Write-Warn "migrate deploy failed; attempting prisma db push --skip-generate"
  npx prisma db push --skip-generate --accept-data-loss
  if ($LASTEXITCODE -ne 0) { Write-Err "Schema push failed."; exit 1 }
  Write-Ok "Schema pushed."
}

Write-Step "Seeding database"
npm run db:seed
if ($LASTEXITCODE -ne 0) { Write-Err "Seeding failed"; exit 1 }
Write-Ok "Seeding complete."

Write-Step "Detecting running dev server port"
$ports = @($PortPreference, '3000', '3001', '3002') | Select-Object -Unique
$baseUrl = $null
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$p/api/__dbcheck" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $baseUrl = "http://localhost:$p"; break }
  } catch {}
}
if (-not $baseUrl) {
  Write-Warn "Dev server not reachable. Start it with: npm run dev"
  exit 0
}
Write-Ok "Dev server detected at $baseUrl"

Write-Step "DB health check"
try {
  $r = Invoke-WebRequest -Uri "$baseUrl/api/__dbcheck" -UseBasicParsing -TimeoutSec 5
  Write-Host $r.Content
} catch { Write-Err $_.Exception.Message; exit 1 }

Write-Step "Auth login + me"
try {
  $loginBody = @{ email = 'admin@commissable.test'; password = 'password123' } | ConvertTo-Json
  $login = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -UseBasicParsing -SessionVariable sess
  Write-Ok "Login status: $($login.StatusCode)"
  $me = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" -WebSession $sess -UseBasicParsing
  Write-Ok "Me status: $($me.StatusCode)"
  Write-Host $me.Content
} catch {
  Write-Err ("Auth verification failed: " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

