param(
  [Parameter(Mandatory = $true)][ValidateSet('csv', 'xlsx')][string]$Kind,
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Folder = ''
)

# Opens the Windows Save dialog for a table export, above other windows, and
# writes the chosen path to stdout as UTF-8. Writes nothing when cancelled.
# The dialog asks before replacing a file that is already there.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Windows does not let a background process take the foreground, so the
# dialog would open behind Claude Code. An owner that is shown, on top of
# every window and see-through, lifts the dialog above them with it.
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $true
$owner.Text = $dialogTitle = "Save the table as $($Kind.ToUpper())"
$owner.FormBorderStyle = 'None'
$owner.Opacity = 0
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Show()
$owner.Activate()

$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = $dialogTitle
$dialog.Filter = if ($Kind -eq 'csv') { 'CSV (*.csv)|*.csv' } else { 'Excel workbook (*.xlsx)|*.xlsx' }
$dialog.DefaultExt = $Kind
$dialog.AddExtension = $true
$dialog.OverwritePrompt = $true
$dialog.FileName = $Name
if ($Folder -ne '' -and (Test-Path -LiteralPath $Folder -PathType Container)) {
  $dialog.InitialDirectory = (Resolve-Path -LiteralPath $Folder).Path
}

try {
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write($dialog.FileName)
  }
} finally {
  $dialog.Dispose()
  $owner.Dispose()
}
