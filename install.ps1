[CmdletBinding()]
param(
    [ValidateSet('max', 'minimal', 'dev', 'research', 'security')]
    [string]$Profile = 'max',
    [ValidateSet('quick', 'full', 'none')]
    [string]$Verify = 'quick',
    [switch]$NoPath,
    [switch]$NoFont,
    [switch]$NoExtensions
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repository = 'Imjac1/dove-pi'
$ReleaseBaseUrl = "https://github.com/$Repository/releases/latest/download/"
$ManifestUrl = $ReleaseBaseUrl + 'release.json'

function Get-DoveCommandPath([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { return $null }
    if ($command.Source) { return [string]$command.Source }
    if ($command.Path) { return [string]$command.Path }
    return $null
}

function Get-DovePowerShellPath {
    foreach ($name in @('powershell.exe', 'pwsh.exe', 'pwsh')) {
        $path = Get-DoveCommandPath $name
        if ($path) { return $path }
    }
    return $null
}

function Get-DoveRuntime {
    param(
        [string]$Name,
        [version]$Minimum,
        [string[]]$VersionArguments,
        [string]$RequiredCompanion = ''
    )

    $path = Get-DoveCommandPath $Name
    if (-not $path) { return $null }
    try {
        # Do not pipe a native process into Select-Object here. In both modern
        # PowerShell and Windows PowerShell that pipeline can hide/reset the
        # native LASTEXITCODE, causing a healthy runtime to look missing.
        $lines = @(& $path @VersionArguments 2>$null)
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0 -or $lines.Count -eq 0) { return $null }
        $raw = $lines[0]
        $match = [regex]::Match(([string]$raw).Trim(), '\d+\.\d+(?:\.\d+)?')
        if (-not $match.Success) { return $null }
        $version = [version]$match.Value
    }
    catch {
        return $null
    }

    $reason = ''
    $compatible = $version -ge $Minimum
    if ($compatible -and $RequiredCompanion -and -not (Get-DoveCommandPath $RequiredCompanion)) {
        $compatible = $false
        $reason = "$RequiredCompanion was not found in PATH"
    }
    return [pscustomobject]@{
        Path = $path
        Version = $version.ToString()
        Compatible = $compatible
        Reason = $reason
    }
}

function Refresh-DoveProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = Join-DoveProcessPath $machine $user
}

function Join-DoveProcessPath([string]$MachinePath, [string]$UserPath) {
    $entries = @($MachinePath, $UserPath) | Where-Object { $_ }
    return $entries -join ';'
}

function Get-DoveWingetInstallArguments([string]$Package) {
    return @(
        'install', '--id', $Package, '--exact', '--source', 'winget', '--silent',
        '--accept-source-agreements', '--accept-package-agreements'
    )
}

function Get-DoveWingetInstallCommand([string]$Package) {
    return 'winget ' + ((Get-DoveWingetInstallArguments $Package) -join ' ')
}

function Invoke-DoveWingetInstall([string]$WingetPath, [string]$Package) {
    $arguments = Get-DoveWingetInstallArguments $Package
    & $WingetPath @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "winget exited with code $LASTEXITCODE"
    }
}

function Ensure-DovePrerequisite {
    param(
        [string]$DisplayName,
        [string]$CommandName,
        [version]$Minimum,
        [string[]]$VersionArguments,
        [string]$WingetPackage,
        [string]$RequiredCompanion = '',
        [scriptblock]$ResolveRuntime = $null,
        [scriptblock]$FindWinget = $null,
        [scriptblock]$InstallRuntime = $null,
        [scriptblock]$RefreshPath = $null
    )

    if ($null -eq $ResolveRuntime) {
        $ResolveRuntime = { param($name, $minimum, $arguments, $companion) Get-DoveRuntime $name $minimum $arguments $companion }
    }
    if ($null -eq $FindWinget) {
        $FindWinget = { Get-DoveCommandPath 'winget' }
    }
    if ($null -eq $InstallRuntime) {
        $InstallRuntime = { param($winget, $package) Invoke-DoveWingetInstall $winget $package }
    }
    if ($null -eq $RefreshPath) {
        $RefreshPath = { Refresh-DoveProcessPath }
    }

    $runtime = & $ResolveRuntime $CommandName $Minimum $VersionArguments $RequiredCompanion
    if ($runtime -and $runtime.Compatible) {
        Write-Host "  $DisplayName $($runtime.Version)"
        return $runtime
    }

    if ($runtime) {
        $detail = if ($runtime.Reason) { $runtime.Reason } else { "minimum is $Minimum" }
        Write-Host "  $DisplayName $($runtime.Version) is not usable ($detail); installing $WingetPackage"
    }
    else {
        Write-Host "  $DisplayName is missing; installing $WingetPackage"
    }

    $installCommand = Get-DoveWingetInstallCommand $WingetPackage
    $winget = & $FindWinget
    if (-not $winget) {
        throw "[Prerequisites] winget is unavailable. Install Microsoft App Installer, run '$installCommand', then retry the Dove Pi bootstrap."
    }
    try {
        & $InstallRuntime $winget $WingetPackage
    }
    catch {
        throw "[Prerequisites] Unable to install $DisplayName. Run '$installCommand', then retry the Dove Pi bootstrap. $($_.Exception.Message)"
    }
    & $RefreshPath
    $runtime = & $ResolveRuntime $CommandName $Minimum $VersionArguments $RequiredCompanion
    if (-not $runtime -or -not $runtime.Compatible) {
        throw "[Prerequisites] $DisplayName is still missing or too old after installation. Open a new terminal, run '$installCommand', then retry the Dove Pi bootstrap."
    }
    Write-Host "  $DisplayName $($runtime.Version) ready"
    return $runtime
}

function Read-DoveReleaseManifest([string]$Path) {
    try {
        $manifest = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "[Release] release.json is not valid JSON: $($_.Exception.Message)"
    }
    if ([int]$manifest.schemaVersion -ne 1) { throw '[Release] release.json has an unsupported schemaVersion.' }
    $version = [string]$manifest.version
    $releaseId = [string]$manifest.releaseId
    if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
        throw '[Release] release.json has an invalid version.'
    }
    if ($releaseId -notmatch '^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$' -or -not $releaseId.StartsWith($version + '+')) {
        throw '[Release] release.json has an invalid releaseId for its version.'
    }
    if ([string]$manifest.platform -ne 'windows') {
        throw "[Release] release.json targets $($manifest.platform), not windows."
    }
    return $manifest
}

function Get-DoveResponseUri($Response, [string]$Fallback) {
    if ($Response -and $Response.BaseResponse) {
        if ($Response.BaseResponse.ResponseUri) { return [string]$Response.BaseResponse.ResponseUri.AbsoluteUri }
        if ($Response.BaseResponse.RequestMessage -and $Response.BaseResponse.RequestMessage.RequestUri) {
            return [string]$Response.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
        }
    }
    return $Fallback
}

function Get-DoveResolvedReleaseBase([string]$FinalManifestUrl, [string]$ExpectedTag, [string]$FallbackBase) {
    $match = [regex]::Match($FinalManifestUrl, '/releases/download/([^/]+)/release\.json(?:\?.*)?$')
    if ($match.Success) {
        $resolvedTag = [Uri]::UnescapeDataString($match.Groups[1].Value)
        if ($resolvedTag -ne $ExpectedTag) {
            throw "[Release] GitHub resolved tag $resolvedTag but release.json requires $ExpectedTag. Retry the bootstrap."
        }
        $lastSlash = $FinalManifestUrl.LastIndexOf('/')
        if ($lastSlash -lt 0) { throw '[Release] GitHub returned an invalid release manifest URL.' }
        return $FinalManifestUrl.Substring(0, $lastSlash + 1)
    }
    # Invoke-WebRequest may expose the final signed object-storage URL. Its
    # sibling paths are not other release assets; keep using latest/download.
    return $FallbackBase
}

function Read-DoveExpectedSha256([string]$Path) {
    $token = ((Get-Content -LiteralPath $Path -Raw -Encoding UTF8).Trim() -split '\s+')[0].ToLowerInvariant()
    if ($token -notmatch '^[0-9a-f]{64}$') { throw '[Verify] Release checksum asset is invalid.' }
    return $token
}

function Get-DoveSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $algorithm.ComputeHash($stream)
        return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Expand-DoveArchiveSafely([string]$Archive, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $root = [IO.Path]::GetFullPath($Destination).TrimEnd('\')
    $boundary = $root + '\'
    $bundle = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        foreach ($entry in $bundle.Entries) {
            $target = [IO.Path]::GetFullPath((Join-Path $root $entry.FullName))
            if ($target -ne $root -and -not $target.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) {
                throw "[Verify] Unsafe release archive entry: $($entry.FullName)"
            }
        }
    }
    finally {
        $bundle.Dispose()
    }
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Destination)
}

function Assert-DoveManifestIdentity($Expected, $Actual, [string]$ExpectedPath = '', [string]$ActualPath = '') {
    if ([int]$Actual.schemaVersion -ne [int]$Expected.schemaVersion -or
        [string]$Actual.version -ne [string]$Expected.version -or
        [string]$Actual.releaseId -ne [string]$Expected.releaseId -or
        [string]$Actual.platform -ne [string]$Expected.platform) {
        throw '[Verify] The archive release.json does not match the downloaded release manifest.'
    }
    if ($ExpectedPath -and $ActualPath) {
        $expectedHash = Get-DoveSha256 $ExpectedPath
        $actualHash = Get-DoveSha256 $ActualPath
        if ($expectedHash -ne $actualHash) {
            throw '[Verify] The archive release.json does not exactly match the downloaded release manifest.'
        }
    }
}

function Get-DoveManagedRoot {
    if ($env:DOVE_PI_HOME) { return [IO.Path]::GetFullPath($env:DOVE_PI_HOME) }
    return Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DovePi'
}

function Get-DoveReusableLauncher(
    [string]$Version,
    [string]$ReleaseId,
    [string]$SelectedProfile,
    $ExpectedManifest = $null,
    [string]$ExpectedManifestPath = ''
) {
    $managedRoot = Get-DoveManagedRoot
    $statePath = Join-Path $managedRoot 'state\install.json'
    $launcher = Join-Path $managedRoot 'bin\dove-pi.ps1'
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $launcher -PathType Leaf)) { return $null }
    try {
        $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([int]$state.schemaVersion -ne 2 -or [string]$state.profile -ne $SelectedProfile -or
            [string]$state.current.version -ne $Version -or
            [string]$state.current.releaseId -ne $ReleaseId) { return $null }
        $versionsRoot = [IO.Path]::GetFullPath((Join-Path $managedRoot 'app\versions')).TrimEnd('\')
        $installPath = [IO.Path]::GetFullPath([string]$state.current.installPath)
        if (-not $installPath.StartsWith($versionsRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { return $null }
        foreach ($required in @('dove_pi.py', 'release.json', 'node_modules')) {
            if (-not (Test-Path -LiteralPath (Join-Path $installPath $required))) { return $null }
        }
        if ($ExpectedManifest -and $ExpectedManifestPath) {
            $installedManifestPath = Join-Path $installPath 'release.json'
            $installedManifest = Read-DoveReleaseManifest $installedManifestPath
            Assert-DoveManifestIdentity $ExpectedManifest $installedManifest $ExpectedManifestPath $installedManifestPath
        }
        return $launcher
    }
    catch {
        return $null
    }
}

function Add-DoveUserPath([string]$Directory) {
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($current -split ';' | Where-Object { $_ })
    if (-not ($entries | Where-Object { $_.TrimEnd('\') -eq $Directory.TrimEnd('\') })) {
        [Environment]::SetEnvironmentVariable('Path', (($entries + $Directory) -join ';'), 'User')
    }
    Refresh-DoveProcessPath
}

function Invoke-DoveBootstrap {
    if ($env:OS -ne 'Windows_NT') { throw '[Prerequisites] The managed Dove Pi bootstrap currently supports Windows only.' }
    if ($PSVersionTable.PSVersion -lt [version]'5.1') { throw '[Prerequisites] PowerShell 5.1 or newer is required.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    Write-Host '[1/5] Prerequisites'
    $python = Ensure-DovePrerequisite 'Python' 'python' ([version]'3.10.0') @('-c', 'import platform; print(platform.python_version())') 'Python.Python.3.12'
    $null = Ensure-DovePrerequisite 'Node.js' 'node' ([version]'22.19.0') @('--version') 'OpenJS.NodeJS.LTS' 'npm'

    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    $work = Join-Path $tempBase ("dove-pi-bootstrap-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $work | Out-Null
    try {
        $headers = @{ Accept = 'application/json'; 'User-Agent' = 'dove-pi-installer' }
        Write-Host '[2/5] Release'
        $manifestPath = Join-Path $work 'release.json'
        $manifestResponse = Invoke-WebRequest -UseBasicParsing -Uri $ManifestUrl -Headers $headers -OutFile $manifestPath -PassThru
        $manifest = Read-DoveReleaseManifest $manifestPath
        $releaseTag = 'v' + [string]$manifest.version
        $finalManifestUrl = Get-DoveResponseUri $manifestResponse $ManifestUrl
        $resolvedBase = Get-DoveResolvedReleaseBase $finalManifestUrl $releaseTag $ReleaseBaseUrl

        Write-Host '[3/5] Verify'
        $reusableLauncher = Get-DoveReusableLauncher ([string]$manifest.version) ([string]$manifest.releaseId) $Profile $manifest $manifestPath
        if ($reusableLauncher) {
            Write-Host '  Current release matches; archive download and npm ci are not needed.'
            Write-Host '[4/5] Install'
            $hostPowerShell = Get-DovePowerShellPath
            if (-not $hostPowerShell) {
                throw '[Install] PowerShell is unavailable for same-version repair. Open a new terminal and retry the Dove Pi bootstrap.'
            }
            $repairArguments = @('repair', '--verify', $Verify)
            if ($NoExtensions) { $repairArguments += '--no-extensions' }
            & $hostPowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $reusableLauncher @repairArguments
            if ($LASTEXITCODE -ne 0) {
                throw "[Install] Same-version repair exited with $LASTEXITCODE. Retry the Dove Pi bootstrap."
            }
            $managedBin = Split-Path -Parent $reusableLauncher
            if (-not $NoPath) { Add-DoveUserPath $managedBin }
            if (-not $NoFont) {
                & $hostPowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $reusableLauncher icons setup
                if ($LASTEXITCODE -ne 0) { Write-Warning "Icon setup failed; Dove Pi remains usable with ASCII icons." }
            }
            Write-Host '[5/5] Ready'
            Write-Host "  Dove Pi $($manifest.version) is ready. Open a new terminal and run: dove-pi doctor"
            return
        }

        $archive = Join-Path $work 'dove-pi-windows.zip'
        $checksum = Join-Path $work 'dove-pi-windows.zip.sha256'
        Invoke-WebRequest -UseBasicParsing -Uri ($resolvedBase + 'dove-pi-windows.zip') -Headers $headers -OutFile $archive
        Invoke-WebRequest -UseBasicParsing -Uri ($resolvedBase + 'dove-pi-windows.zip.sha256') -Headers $headers -OutFile $checksum
        $expected = Read-DoveExpectedSha256 $checksum
        $actual = Get-DoveSha256 $archive
        if ($actual -ne $expected) { throw "[Verify] Release checksum mismatch: expected $expected, got $actual." }

        $extract = Join-Path $work 'release'
        Expand-DoveArchiveSafely $archive $extract
        $entries = @(Get-ChildItem -LiteralPath $extract -Filter 'dove_pi.py' -File -Recurse)
        if ($entries.Count -ne 1) { throw '[Verify] Release archive must contain exactly one dove_pi.py entry.' }
        $releaseRoot = $entries[0].Directory.FullName
        $embeddedPath = Join-Path $releaseRoot 'release.json'
        if (-not (Test-Path -LiteralPath $embeddedPath -PathType Leaf)) { throw '[Verify] Release archive is missing release.json.' }
        $embedded = Read-DoveReleaseManifest $embeddedPath
        Assert-DoveManifestIdentity $manifest $embedded $manifestPath $embeddedPath

        Write-Host '[4/5] Install'
        $installArguments = @('install', '--profile', $Profile, '--verify', $Verify)
        if ($NoPath) { $installArguments += '--no-path' }
        if ($NoFont) { $installArguments += '--no-font' }
        if ($NoExtensions) { $installArguments += '--no-extensions' }
        $installArguments += @('--source-archive', $archive, '--source-checksum', $checksum, '--source-tag', $releaseTag)
        & $python.Path (Join-Path $releaseRoot 'dove_pi.py') @installArguments
        if ($LASTEXITCODE -ne 0) { throw "[Install] Dove Pi installer exited with $LASTEXITCODE. Run 'dove-pi repair' if a previous release is installed." }

        Write-Host '[5/5] Ready'
        Write-Host "  Dove Pi $($manifest.version) is ready. Open a new terminal and run: dove-pi doctor"
    }
    finally {
        $resolvedWork = [IO.Path]::GetFullPath($work)
        if ($resolvedWork.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and $resolvedWork -ne $tempBase.TrimEnd('\')) {
            Remove-Item -LiteralPath $resolvedWork -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Tests dot-source the helper functions with this explicit process-only switch.
if ($env:DOVE_PI_BOOTSTRAP_TEST_ONLY -ne '1') {
    Invoke-DoveBootstrap
}
