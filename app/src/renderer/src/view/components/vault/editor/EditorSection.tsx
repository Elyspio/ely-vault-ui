import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/**
 * Titled group of the editor, same look as the detail cards
 */
export function EditorSection({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
	return (
		<Box sx={{ mb: 3 }}>
			{title && (
				<Typography variant="overline" component="div" sx={{ color: "var(--text-faint)", px: 0.5, mb: 0.5 }}>
					{title}
				</Typography>
			)}
			<Box sx={{ borderRadius: 2.5, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)", p: 2 }}>{children}</Box>
		</Box>
	);
}
