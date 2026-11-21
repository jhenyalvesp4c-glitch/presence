' Liga a ponte do WhatsApp escondida (sem janela). Chamado por whatsapp-fundo.cmd e, depois, sozinho quando o Windows inicia.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
logDir = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.presence\whatsapp"
If Not fso.FolderExists(sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.presence") Then fso.CreateFolder sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.presence"
If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
sh.CurrentDirectory = base & "\whatsapp-bridge"
sh.Run "cmd /c node src/index.ts >> """ & logDir & "\ponte.log"" 2>&1", 0, False
