import { Box, CircularProgress, StyledEngineProvider, ThemeProvider, Typography } from "@mui/material";
import { theme } from "@/config/theme";
import { useAppSelector } from "@store";
import { Titlebar } from "@components/frame/Titlebar";
import { Toaster } from "@components/shared/Toaster";
import { LoginScreen } from "@components/auth/LoginScreen";
import { UnlockScreen } from "@components/auth/UnlockScreen";
import { VaultScreen } from "@components/vault/VaultScreen";
import { RepromptProvider } from "@hooks/useVaultActions";

export function App() {
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
					<Toaster />
				</RepromptProvider>
			</ThemeProvider>
		</StyledEngineProvider>
	);
}

function Screen() {
	const status = useAppSelector((state) => state.session.current?.status);
	const fatalError = useAppSelector((state) => state.session.fatalError);

	if (fatalError) {
		return (
			<Box sx={{ height: "100%", display: "grid", placeItems: "center", p: 4 }}>
				<Box sx={{ textAlign: "center", maxWidth: 480 }}>
					<Typography variant="h6" gutterBottom>
						Cannot start the Bitwarden client
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
