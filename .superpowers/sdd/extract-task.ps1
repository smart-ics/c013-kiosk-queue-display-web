param(
  [Parameter(Mandatory = $true)] [int] $TaskNumber,
  [Parameter(Mandatory = $true)] [string] $PlanPath
)

$ErrorActionPreference = 'Stop'

$lines = Get-Content -LiteralPath $PlanPath
$inFence = $false
$inTask = $false
$out = New-Object System.Collections.Generic.List[string]
$pattern = "^#+\s+Task\s+$TaskNumber(\b|$)"

foreach ($line in $lines) {
  if ($line -match '^```') {
    $inFence = -not $inFence
    $out.Add($line)
    continue
  }
  if (-not $inFence -and $line -match $pattern) {
    $inTask = $true
  }
  elseif (-not $inFence -and $line -match '^#+\s+Task\s+\d+') {
    if ($inTask) { break }
  }
  if ($inTask) { $out.Add($line) }
}

if ($out.Count -eq 0) {
  throw "task $TaskNumber not found in $PlanPath"
}

$planFull = (Resolve-Path -LiteralPath $PlanPath).Path
$repoRoot = Split-Path -Parent $planFull
while ($repoRoot -ne '') {
  if (Test-Path -LiteralPath (Join-Path $repoRoot '.git')) { break }
  $repoRoot = Split-Path -Parent $repoRoot
}
if ($repoRoot -eq '') { throw "could not locate repo root from $PlanPath" }

$outPath = Join-Path $repoRoot ".superpowers/sdd/task-$TaskNumber-brief.md"
Set-Content -LiteralPath $outPath -Value $out -Encoding utf8
Write-Host "wrote $outPath"
