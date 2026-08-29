[CmdletBinding()]
param(
    [ValidateSet('max', 'minimal', 'dev', 'research', 'security')]
    [string]$Profile = 'max',
    [ValidateSet('quick', 'full', 'none')]
    [string]$Verify = 'quick'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repository = 'Imjac1/dove-pi'
$ApiUrl = "https://api.github.com/repos/$Repository/releases/latest"

function Get-CommandPath([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { throw "$Name is required but was not found in PATH." }
    return $command.Source
}

function Get-ReleaseAsset($Release, [string]$Name) {
    $asset = @($Release.assets | Where-Object { $_.name -eq $Name })
    if ($asset.Count -ne 1) { throw "Release $($Release.tag_name) is missing exactly one $Name asset." }
    return [string]$asset[0].browser_download_url
}

if ($env:OS -ne 'Windows_NT') { throw 'The managed Dove Pi bootstrap currently supports Windows only.' }
if ($PSVersionTable.PSVersion.Major -lt 5) { throw 'PowerShell 5.1 or newer is required.' }
$Python = Get-CommandPath 'python'
$Node = Get-CommandPath 'node'
$pythonVersion = (& $Python -c "import platform; print(platform.python_version())").Trim()
if ([version]$pythonVersion -lt [version]'3.10.0') { throw "Python 3.10 or newer is required; found $pythonVersion." }
$nodeVersion = (& $Node --version).TrimStart('v')
if ([version]$nodeVersion -lt [version]'22.19.0') { throw "Node.js 22.19.0 or newer is required; found $nodeVersion." }

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$work = Join-Path $tempBase ("dove-pi-bootstrap-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    Write-Host '[1/4] Resolving latest stable Dove Pi release'
    $headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'dove-pi-installer' }
    $release = Invoke-RestMethod -Uri $ApiUrl -Headers $headers
    if ($release.prerelease -or $release.draft) { throw 'GitHub latest release is not a stable published release.' }
    $archiveUrl = Get-ReleaseAsset $release 'dove-pi-windows.zip'
    $checksumUrl = Get-ReleaseAsset $release 'dove-pi-windows.zip.sha256'

    Write-Host '[2/4] Downloading and verifying release'
    $archive = Join-Path $work 'dove-pi-windows.zip'
    $checksum = Join-Path $work 'dove-pi-windows.zip.sha256'
    Invoke-WebRequest -Uri $archiveUrl -Headers $headers -OutFile $archive
    Invoke-WebRequest -Uri $checksumUrl -Headers $headers -OutFile $checksum
    $expected = ((Get-Content -LiteralPath $checksum -Raw -Encoding UTF8).Trim() -split '\s+')[0].ToLowerInvariant()
    if ($expected -notmatch '^[0-9a-f]{64}$') { throw 'Release checksum asset is invalid.' }
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Release checksum mismatch: expected $expected, got $actual." }

    Write-Host '[3/4] Preparing managed release'
    $extract = Join-Path $work 'release'
    Expand-Archive -LiteralPath $archive -DestinationPath $extract
    $entries = @(Get-ChildItem -LiteralPath $extract -Filter 'dove_pi.py' -File -Recurse)
    if ($entries.Count -ne 1) { throw 'Release archive must contain exactly one dove_pi.py entry.' }
    $releaseRoot = $entries[0].Directory.FullName
    if (-not (Test-Path -LiteralPath (Join-Path $releaseRoot 'release.json') -PathType Leaf)) { throw 'Release archive is missing release.json.' }

    Write-Host '[4/4] Installing and activating Dove Pi'
    $releaseTag = [string]$release.tag_name
    & $Python (Join-Path $releaseRoot 'dove_pi.py') install --profile $Profile --verify $Verify --source-archive $archive --source-checksum $checksum --source-tag $releaseTag
    if ($LASTEXITCODE -ne 0) { throw "Dove Pi installer exited with $LASTEXITCODE." }
}
finally {
    $resolvedWork = [IO.Path]::GetFullPath($work)
    if ($resolvedWork.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and $resolvedWork -ne $tempBase.TrimEnd('\')) {
        Remove-Item -LiteralPath $resolvedWork -Recurse -Force -ErrorAction SilentlyContinue
    }
}
