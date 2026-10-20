; Extra Start menu shortcut so that Windows search also finds the app with "Coexya" / "Coexya Vault".
; Same AppUserModelID as the main shortcut (app.setAppUserModelId) to keep taskbar grouping and notifications.
!macro customInstall
	CreateShortCut "$SMPROGRAMS\Coexya Vault.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
	ClearErrors
	WinShell::SetLnkAUMI "$SMPROGRAMS\Coexya Vault.lnk" "${APP_ID}"
!macroend

!macro customUnInstall
	WinShell::UninstShortcut "$SMPROGRAMS\Coexya Vault.lnk"
	Delete "$SMPROGRAMS\Coexya Vault.lnk"
!macroend
