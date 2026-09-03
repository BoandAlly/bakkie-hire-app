# Build the Android APK on this machine, with no GitHub involved.
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -WithBackend
#
# Without -WithBackend the app is built with no Supabase config at all: Vite
# compiles it out, so the APK saves only to the phone it is on and cannot reach
# shared data. That is the safe one to pass around for trying things out.
#
# The toolchain lives outside the project so it survives a re-clone:
#   JDK 21       C:\Program Files\Eclipse Adoptium\jdk-21*
#   Android SDK  C:\Android

param([switch]$WithBackend)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# --- Toolchain ---------------------------------------------------------------

# The JDK lives under C:\Android alongside the SDK rather than in Program
# Files, because unpacking a zip there needs no administrator prompt - the
# installer route stalls waiting for one that never gets answered.
$jdk = @(
  (Get-ChildItem "C:\Android" -Filter "jdk-21*" -Directory -ErrorAction SilentlyContinue),
  (Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Filter "jdk-21*" -Directory -ErrorAction SilentlyContinue)
) | ForEach-Object { $_ } | Select-Object -First 1

if (-not $jdk) {
  throw "JDK 21 not found. Unpack the Temurin 21 zip into C:\Android (no admin needed)."
}

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = 'C:\Android'
$env:ANDROID_SDK_ROOT = 'C:\Android'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "JDK:     $env:JAVA_HOME"
Write-Host "Android: $env:ANDROID_HOME"

# --- Web build ---------------------------------------------------------------

Push-Location $root
try {
  if (-not (Test-Path "$root\node_modules")) {
    Write-Host "`nInstalling dependencies..."
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  }

  if ($WithBackend) {
    # Read the values from .env so they are never written into this script.
    if (-not (Test-Path "$root\.env")) { throw "-WithBackend needs a .env file. See .env.example" }
    Get-Content "$root\.env" | ForEach-Object {
      if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') {
        Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
      }
    }
    if (-not $env:VITE_SUPABASE_URL) { throw ".env has no VITE_SUPABASE_URL" }
    Write-Host "`nBuilding WITH the shared backend."
  } else {
    # Explicitly cleared: a stale value in the shell would silently connect the
    # APK to real data, which is the one outcome this switch exists to prevent.
    Remove-Item env:VITE_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item env:VITE_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Write-Host "`nBuilding WITHOUT a backend - this APK saves only to the phone it is on."
  }

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "vite build failed" }

  Write-Host "`nSyncing Capacitor..."
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }

  Write-Host "`nBuilding APK (first run downloads Gradle, give it a few minutes)..."
  Push-Location "$root\android"
  try {
    & .\gradlew.bat assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "gradle build failed" }
  } finally { Pop-Location }

  $apk = "$root\android\app\build\outputs\apk\debug\app-debug.apk"
  if (-not (Test-Path $apk)) { throw "Gradle reported success but no APK at $apk" }

  $size = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  Write-Host "`nDone: $apk  ($size MB)"
} finally { Pop-Location }
