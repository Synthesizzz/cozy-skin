param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Target
)

# Zips the folder at -Source into -Target (an .xlsx) with forward-slash entry
# names, [Content_Types].xml first. The folder is removed afterwards, also on
# failure, because the mod API cannot delete files. Exits non-zero on failure.
$ErrorActionPreference = 'Stop'
$code = 0

try {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $root = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\', '/')
  $files = Get-ChildItem -LiteralPath $root -Recurse -File |
    Sort-Object @{ Expression = { if ($_.Name -eq '[Content_Types].xml') { 0 } else { 1 } } }, FullName

  if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Force }

  $zip = [System.IO.Compression.ZipFile]::Open($Target, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  } finally {
    $zip.Dispose()
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  $code = 1
} finally {
  if (Test-Path -LiteralPath $Source) { Remove-Item -LiteralPath $Source -Recurse -Force -ErrorAction SilentlyContinue }
}

exit $code
