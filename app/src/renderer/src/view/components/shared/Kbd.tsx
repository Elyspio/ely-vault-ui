import { Box } from "@mui/material";

/**
 * Keyboard key hint, ex: <Kbd>Ctrl</Kbd><Kbd>K</Kbd>
 */
export function Kbd({ children }: Readonly<{ children: string }>) {
	return (
		<Box
			component="kbd"
			sx={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				minWidth: 20,
				height: 20,
				px: 0.6,
				borderRadius: 1,
				border: "1px solid var(--border-medium)",
				borderBottomWidth: 2,
				bgcolor: "var(--surface-2)",
				color: "var(--text-muted)",
				fontFamily: "var(--font-mono)",
				fontSize: "0.68rem",
				lineHeight: 1,
			}}
		>
			{children}
		</Box>
	);
}
