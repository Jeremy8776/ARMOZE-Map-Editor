Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

AppDir = FSO.GetParentFolderName(WScript.ScriptFullName)
PackageJson = FSO.BuildPath(AppDir, "package.json")

If Not FSO.FileExists(PackageJson) Then
    MsgBox "Could not find package.json at:" & vbCrLf & PackageJson, vbCritical, "ARMOZE Launch Error"
    WScript.Quit 1
End If

WshShell.CurrentDirectory = AppDir
WshShell.Run "cmd.exe /c npm start", 0, False
