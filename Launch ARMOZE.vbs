Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
Quote = Chr(34)

AppDir = FSO.GetParentFolderName(WScript.ScriptFullName)
ElectronCmd = FSO.BuildPath(AppDir, "node_modules\.bin\electron.cmd")

If Not FSO.FileExists(ElectronCmd) Then
    MsgBox "Could not find the local Electron launcher at:" & vbCrLf & ElectronCmd, vbCritical, "ARMOZE Launch Error"
    WScript.Quit 1
End If

WshShell.CurrentDirectory = AppDir
LaunchCommand = "cmd.exe /d /s /c " & Quote & Quote & ElectronCmd & Quote & " " & Quote & AppDir & Quote & Quote
WshShell.Run LaunchCommand, 0, False
