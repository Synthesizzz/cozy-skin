param(
  [Parameter(Mandatory = $true)][string]$Path
)

# Prints, as one JSON array on stdout (UTF-8), each prompt the person typed in
# a session's transcript with when it was sent: [{ "t": "<ISO time>", "text":
# "<prompt>" }]. Only those rows are parsed: a transcript can be far larger
# than a mod may read in one go, and most of it is tool output.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$found = New-Object System.Collections.Generic.List[object]

foreach ($line in [System.IO.File]::ReadLines($Path, [System.Text.Encoding]::UTF8)) {
  # A cheap test before parsing: the person's prompts are user rows of human origin.
  if (-not $line.Contains('"type":"user"') -or -not $line.Contains('"kind":"human"')) {
    continue
  }
  try {
    $row = $line | ConvertFrom-Json
  } catch {
    continue
  }
  if ($row.type -ne 'user' -or $row.origin.kind -ne 'human' -or -not $row.timestamp) {
    continue
  }
  $content = $row.message.content
  if ($content -is [string]) {
    $text = $content
  } else {
    $text = (@($content) | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n"
  }
  if ($text) {
    if ($text.Length -gt 4000) {
      $text = $text.Substring(0, 4000)
    }
    $found.Add([pscustomobject]@{ t = [string]$row.timestamp; text = $text })
  }
}

# Always an array, even with one prompt or none.
Write-Output (ConvertTo-Json -InputObject @($found.ToArray()) -Compress -Depth 3)
