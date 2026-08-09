<#
.SYNOPSIS
  Build -> tag -> push -> deploy the FC Sandbox (E2B-compatible) image to
  Alibaba Cloud Container Registry (ACR) + Function Compute.

.DESCRIPTION
  No credentials are hardcoded. Everything identity/secret-shaped comes from
  environment variables, which you set beforehand (or via a .env you source
  into the shell / a secrets manager — never committed):

    ACR_REGISTRY    e.g. registry.ap-southeast-1.aliyuncs.com
    ACR_NAMESPACE   your ACR namespace
    ACR_USERNAME    ACR login username (often your Alibaba Cloud account)
    ACR_PASSWORD    ACR login password / access token

  `s deploy` itself authenticates against Alibaba Cloud (RAM AK/SK or STS)
  via whatever credential profile you've configured with `s config add` —
  that step is intentionally NOT scripted here (it's an interactive,
  one-time machine setup step, not something to automate with secrets in a
  script).

.EXAMPLE
  $env:ACR_REGISTRY  = "registry.ap-southeast-1.aliyuncs.com"
  $env:ACR_NAMESPACE = "advan-ai"
  $env:ACR_USERNAME  = "your-acr-username"
  $env:ACR_PASSWORD  = "your-acr-password"
  ./deploy-fc.ps1
#>

$ErrorActionPreference = "Stop"

$ImageName = "advan-sandbox-e2b"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Require-EnvVar([string]$Name) {
    $value = [System.Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name. See the header of this script for the full list."
    }
    return $value
}

Write-Host "== FC Sandbox deploy: $ImageName ==" -ForegroundColor Cyan

$Registry  = Require-EnvVar "ACR_REGISTRY"
$Namespace = Require-EnvVar "ACR_NAMESPACE"
$Username  = Require-EnvVar "ACR_USERNAME"
$Password  = Require-EnvVar "ACR_PASSWORD"

# <registry>/<namespace>/advan-sandbox-e2b:latest
$ImageTag = "$Registry/$Namespace/$($ImageName):latest"
Write-Host "Target image: $ImageTag"

# Guard: the local image built in Phase 2 must already exist.
$localImage = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -eq "$($ImageName):latest" }
if (-not $localImage) {
    throw "Local image '$ImageName`:latest' not found. Build it first:`n  docker build -f `"$ScriptDir\Dockerfile`" -t $ImageName ."
}

# 1. Log into Alibaba Cloud Container Registry — password piped via stdin,
#    never passed as a CLI argument or written to disk/history.
Write-Host "`n[1/4] Logging into ACR ($Registry)..." -ForegroundColor Cyan
$Password | docker login $Registry -u $Username --password-stdin
if ($LASTEXITCODE -ne 0) { throw "docker login failed (exit $LASTEXITCODE)" }

# 2. Tag the locally built image for ACR.
Write-Host "`n[2/4] Tagging $ImageName`:latest -> $ImageTag" -ForegroundColor Cyan
docker tag "$($ImageName):latest" $ImageTag
if ($LASTEXITCODE -ne 0) { throw "docker tag failed (exit $LASTEXITCODE)" }

# 3. Push to ACR.
Write-Host "`n[3/4] Pushing $ImageTag..." -ForegroundColor Cyan
docker push $ImageTag
if ($LASTEXITCODE -ne 0) { throw "docker push failed (exit $LASTEXITCODE)" }

# 4. Deploy via Serverless Devs — s.yaml's customContainerConfig.image
#    resolves ${env(ACR_IMAGE_TAG)}, set here so the manifest picks up the
#    exact tag just pushed rather than a hardcoded value.
Write-Host "`n[4/4] Running s deploy..." -ForegroundColor Cyan
$env:ACR_IMAGE_TAG = $ImageTag
Push-Location $ScriptDir
try {
    s deploy
    if ($LASTEXITCODE -ne 0) { throw "s deploy failed (exit $LASTEXITCODE)" }
}
finally {
    Pop-Location
}

Write-Host "`nDone. Deployed $ImageTag via fc-sandbox/s.yaml." -ForegroundColor Green
