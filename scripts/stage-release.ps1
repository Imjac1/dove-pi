<#
.SYNOPSIS
Stage the tree a Dove Pi release archive is built from.

.DESCRIPTION
**This script is the one place that says what a release archive contains.** It exists because the include list used to
live inside the release workflow while the local replay re-typed it by hand, which is the shape that drifts - and drift
here is not cosmetic: a root missing from one copy and present in the other produces an archive whose contents differ
between the machine that tested it and the machine that shipped it.

The other half of the same rule is `scripts/check_release_readiness.py`, which refuses an archive carrying a cache. That
is enforcement, not a second definition: it fails when this list is edited carelessly, and a change to either half without
the other is exactly what it catches.

**Caches are excluded here by name.** Measured 2026-10-16 on the published v0.2.4: seventeen `.pyc` files reached the
archive, present in no commit, embedding the CI builder's absolute path, while `sourceDigest` deliberately skips
`__pycache__` - so the manifest covered a smaller scope than the archive delivered. None of them is tracked (`__pycache__/`
and `*.pyc` are in `.gitignore`), which is why they were invisible until an archive was compared against a commit.

.PARAMETER Stage
Directory to fill. Created if missing, cleared if it already holds anything.

.PARAMETER Ref
Optional git ref to stage instead of the working tree.

**Measured, and against my first expectation, so read this rather than the intuition**: the published v0.2.4 archive
stores LF, while staging from a ref here produced CRLF for every text file - content identical after normalising, bytes
different. The step in this pipeline that converts them was **not** isolated, so a byte-identical local reproduction of a
published archive was not achieved by either path, and `-Ref` should be chosen for reproducibility of **content** rather
than of bytes. `-GeneratedAssets` exists because `release.json` is generated rather than committed and must still be
inside the archive.

.PARAMETER GeneratedAssets
Optional paths copied into the stage root as-is. The release workflow passes the `release.json` it just wrote, which is
generated rather than committed and must be inside the archive.
#>
param(
    [Parameter(Mandatory = $true)][string]$Stage,
    [string]$Ref,
    [string[]]$GeneratedAssets = @()
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    # The roots a release ships, from `RELEASE_SOURCE_ROOTS` in `.trellis/spec/backend/personal-agent-managed-install.md`
    # plus the licence files. `tests/release-manifest.test.ts` holds this list against those roots.
    $include = @(
        'bin', 'installer', 'scripts', 'src', 'tests', 'modes', '.pi',
        'LICENSE', 'NOTICE', 'dove_pi.py', 'package.json', 'package-lock.json', 'tsconfig.json',
        'README.md', 'README.en.md'
    )
    # Staged from `.trellis` on purpose, and only these two: a recipient needs the specification index and the workflow
    # document, not the task corpus this repository keeps for itself.
    $trellisInclude = @('.trellis/spec', '.trellis/workflow.md')

    if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
    New-Item -ItemType Directory -Path $Stage -Force | Out-Null

    if ($Ref) {
        $archive = Join-Path ([System.IO.Path]::GetTempPath()) "dove-stage-$([System.Guid]::NewGuid().ToString('n')).zip"
        try {
            git archive --format=zip -o $archive $Ref
            Expand-Archive -LiteralPath $archive -DestinationPath $Stage -Force
            # `git archive` ships the whole tree; the include list decides what stays.
            Get-ChildItem -LiteralPath $Stage -Force | Where-Object { $_.Name -notin ($include + @('.trellis')) } |
                Remove-Item -Recurse -Force
            $trellisStage = Join-Path $Stage '.trellis'
            Get-ChildItem -LiteralPath $trellisStage -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notin @('spec', 'workflow.md') } | Remove-Item -Recurse -Force
        } finally {
            Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
        }
    } else {
        foreach ($entry in $include + $trellisInclude) {
            if (-not (Test-Path -LiteralPath $entry)) { throw "The include list names $entry, which does not exist." }
            $destination = if ($entry -like '.trellis/*') { Join-Path $Stage '.trellis' } else { $Stage }
            New-Item -ItemType Directory -Path $destination -Force | Out-Null
            Copy-Item -LiteralPath $entry -Destination $destination -Recurse
        }
    }

    foreach ($asset in $GeneratedAssets) {
        Copy-Item -LiteralPath $asset -Destination (Join-Path $Stage (Split-Path -Leaf $asset)) -Force
    }

    # The exclusion, by name, after everything has been copied - so it holds for the working tree, for a ref, and for
    # whatever a future caller adds to the list above.
    $caches = Get-ChildItem -LiteralPath $Stage -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -in @('__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache') }
    foreach ($cache in $caches) { Remove-Item -LiteralPath $cache.FullName -Recurse -Force -ErrorAction SilentlyContinue }

    $files = @(Get-ChildItem -LiteralPath $Stage -Recurse -File -Force)
    $remaining = @($files | Where-Object { $_.Directory.Name -eq '__pycache__' -or $_.Name -like '*.pyc' })
    if ($remaining.Count -gt 0) { throw "Staging left $($remaining.Count) cache files behind, which the readiness check would refuse." }
    Write-Output "Staged $($files.Count) files into $Stage ($($caches.Count) cache director$(if ($caches.Count -eq 1) { 'y' } else { 'ies' }) removed)."
} finally {
    Pop-Location
}
