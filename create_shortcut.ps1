$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "ARMOZE.lnk"
$WorkspacePath = $PWD.Path
$Target = Join-Path $WorkspacePath "Launch ARMOZE.vbs"
$IconPath = Join-Path $WorkspacePath "logo-icon.png"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Target
$Shortcut.WorkingDirectory = $WorkspacePath
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath, 0"
}
$Shortcut.Save()

Write-Host "Shortcut created at: $ShortcutPath"
