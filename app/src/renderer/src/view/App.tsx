import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress, StyledEngineProvider, ThemeProvider, Typography, useMediaQuery } from "@mui/material";
import { type ColorMode, createAppTheme } from "@/config/theme";
import { i18n, languageOfSetting } from "@/config/i18n";
import { store, useAppSelector } from "@store";
import { closeEditor } from "@modules/vault/vault.reducer";
import { Titlebar } from "@components/frame/Titlebar";
import { Toaster } from "@components/shared/Toaster";
import { LoginScreen } from "@components/auth/LoginScreen";
import { UnlockScreen } from "@components/auth/UnlockScreen";
import { VaultScreen } from "@components/vault/VaultScreen";
import { SettingsDialog } from "@components/settings/SettingsDialog";
import { RepromptProvider } from "@hooks/useVaultActions";

export function App() {
	// Closing the window (Alt+F4, titlebar, system menu) with unsaved changes: the window stays open and the unsaved changes dialog opens
	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!store.getState().vault.editorDirty) return;
			event.preventDefault();
			event.returnValue = "";
			store.dispatch(closeEditor());
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, []);

	const themeSetting = useAppSelector((state) => state.config.current.display.theme);
	const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
	const mode: ColorMode = themeSetting === "system" ? (systemDark ? "dark" : "light") : themeSetting;
	const languageSetting = useAppSelector((state) => state.config.current.display.language);
	const language = languageOfSetting(languageSetting);
	const theme = useMemo(() => createAppTheme(mode, language), [mode, language]);
	// main.css variables of the mode (data-theme), see :root[data-theme="light"]
	useEffect(() => {
		document.documentElement.dataset.theme = mode;
	}, [mode]);
	// The interface re-renders in the new language; spell check and screen readers follow it
	useEffect(() => {
		if (i18n.language !== language) void i18n.changeLanguage(language);
		document.documentElement.lang = language;
	}, [language]);

	return (
		<StyledEngineProvider injectFirst>
			<ThemeProvider theme={theme}>
				<RepromptProvider>
					<Box sx={{ height: "100%", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", bgcolor: "var(--surface-0)", color: "text.primary" }}>
						<Titlebar />
						<Box component="main" sx={{ minHeight: 0, position: "relative", overflow: "hidden" }}>
							<Box sx={{ position: "absolute", inset: 0 }}>
								<Screen />
							</Box>
						</Box>
					</Box>
					<SettingsDialog />
					<Toaster />
				</RepromptProvider>
			</ThemeProvider>
		</StyledEngineProvider>
	);
}

function Screen() {
	const { t } = useTranslation("auth");
	const status = useAppSelector((state) => state.session.current?.status);
	const fatalError = useAppSelector((state) => state.session.fatalError);

	if (fatalError) {
		return (
			<Box sx={{ height: "100%", display: "grid", placeItems: "center", p: 4 }}>
				<Box sx={{ textAlign: "center", maxWidth: 480 }}>
					<Typography variant="h6" gutterBottom>
						{t("app.fatalErrorTitle")}
					</Typography>
					<Typography variant="body2" sx={{ color: "text.secondary" }}>
						{fatalError}
					</Typography>
				</Box>
			</Box>
		);
	}

	switch (status) {
		case "unauthenticated":
			return <LoginScreen />;
		case "locked":
			return <UnlockScreen />;
		case "unlocked":
			return <VaultScreen />;
		default:
			return (
				<Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
					<CircularProgress size={22} />
				</Box>
			);
	}
}
