import { alpha, createTheme } from "@mui/material/styles";
import { enUS, frFR } from "@mui/material/locale";
import type { Language } from "@shared/i18n/i18n.languages";

export type ColorMode = "dark" | "light";

/**
 * MUI theme of a color mode. Overlays are the palette ink (white on dark, black on light) at a given opacity,
 * so the same component overrides work in both modes. The CSS variables of main.css follow the same values.
 * The locale translates the built-in texts of the MUI components.
 */
export function createAppTheme(mode: ColorMode, language: Language) {
	const dark = mode === "dark";
	const ink = dark ? "#ffffff" : "#000000";
	/** Ink at the opacity of the dark mode, or the light one */
	const overlay = (darkOpacity: number, lightOpacity: number) => alpha(ink, dark ? darkOpacity : lightOpacity);
	const accent = dark ? "#4fd2ff" : "#0a84b8";

	return createTheme(
		{
			palette: {
				mode,
				primary: { main: accent, contrastText: dark ? "#04151c" : "#ffffff" },
				secondary: { main: dark ? "#00ff88" : "#00a35c" },
				error: { main: dark ? "#ff6b6b" : "#d32f2f" },
				warning: { main: dark ? "#ffb454" : "#b26a00" },
				success: { main: dark ? "#3ddc97" : "#15803d" },
				background: dark ? { default: "#0a0a0a", paper: "#141414" } : { default: "#f6f7f9", paper: "#ffffff" },
				text: { primary: alpha(ink, dark ? 0.92 : 0.87), secondary: alpha(ink, dark ? 0.5 : 0.6) },
				divider: overlay(0.06, 0.08),
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
							borderColor: overlay(0.12, 0.16),
							"&:hover": { borderColor: accent, backgroundColor: alpha(accent, 0.04) },
						},
					},
				},
				MuiIconButton: {
					styleOverrides: {
						root: { borderRadius: 6, "&:hover": { backgroundColor: overlay(0.06, 0.05) } },
					},
				},
				MuiDialog: {
					styleOverrides: {
						paper: { borderRadius: 12, border: `1px solid ${overlay(0.08, 0.1)}`, backgroundColor: dark ? "#121212" : "#ffffff" },
					},
				},
				MuiOutlinedInput: {
					styleOverrides: {
						root: {
							"& fieldset": { borderColor: overlay(0.1, 0.16) },
							"&:hover fieldset": { borderColor: overlay(0.2, 0.3) },
						},
					},
				},
				MuiTooltip: {
					defaultProps: { enterDelay: 400, disableInteractive: true },
					styleOverrides: {
						tooltip: {
							backgroundColor: dark ? "#1e1e1e" : "#2b2f36",
							border: `1px solid ${overlay(0.08, 0.1)}`,
							fontSize: "0.72rem",
							fontWeight: 400,
						},
					},
				},
				MuiChip: {
					styleOverrides: { root: { borderRadius: 6 } },
				},
				MuiDivider: {
					styleOverrides: { root: { borderColor: overlay(0.06, 0.08) } },
				},
				MuiSwitch: {
					styleOverrides: {
						switchBase: {
							"&.Mui-checked": { color: accent, "& + .MuiSwitch-track": { backgroundColor: alpha(accent, 0.3) } },
						},
					},
				},
			},
		},
		language === "fr" ? frFR : enUS
	);
}
