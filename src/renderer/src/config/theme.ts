import { createTheme } from "@mui/material/styles";

export const accent = "#4fd2ff";

export const theme = createTheme({
	palette: {
		mode: "dark",
		primary: { main: accent, contrastText: "#04151c" },
		secondary: { main: "#00ff88" },
		error: { main: "#ff6b6b" },
		warning: { main: "#ffb454" },
		success: { main: "#3ddc97" },
		background: { default: "#0a0a0a", paper: "#141414" },
		text: { primary: "rgba(255,255,255,0.92)", secondary: "rgba(255,255,255,0.5)" },
		divider: "rgba(255,255,255,0.06)",
	},
	shape: { borderRadius: 8 },
	typography: {
		fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
		fontSize: 14,
		h5: { fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em" },
		h6: { fontSize: "0.95rem", fontWeight: 600 },
		overline: { fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", lineHeight: 2 },
		button: { textTransform: "none", fontWeight: 500, letterSpacing: "0.01em" },
	},
	components: {
		MuiPaper: {
			styleOverrides: { root: { backgroundImage: "none" } },
		},
		MuiButton: {
			defaultProps: { disableElevation: true },
			styleOverrides: {
				root: { borderRadius: 6 },
				outlined: {
					borderColor: "rgba(255,255,255,0.12)",
					"&:hover": { borderColor: accent, backgroundColor: "rgba(79, 210, 255, 0.04)" },
				},
			},
		},
		MuiIconButton: {
			styleOverrides: {
				root: { borderRadius: 6, "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" } },
			},
		},
		MuiDialog: {
			styleOverrides: {
				paper: { borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#121212" },
			},
		},
		MuiOutlinedInput: {
			styleOverrides: {
				root: {
					"& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
					"&:hover fieldset": { borderColor: "rgba(255,255,255,0.2)" },
				},
			},
		},
		MuiTooltip: {
			defaultProps: { enterDelay: 400, disableInteractive: true },
			styleOverrides: {
				tooltip: { backgroundColor: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.72rem", fontWeight: 400 },
			},
		},
		MuiChip: {
			styleOverrides: { root: { borderRadius: 6 } },
		},
		MuiDivider: {
			styleOverrides: { root: { borderColor: "rgba(255,255,255,0.06)" } },
		},
		MuiSwitch: {
			styleOverrides: {
				switchBase: {
					"&.Mui-checked": { color: accent, "& + .MuiSwitch-track": { backgroundColor: "rgba(79, 210, 255, 0.3)" } },
				},
			},
		},
	},
});
