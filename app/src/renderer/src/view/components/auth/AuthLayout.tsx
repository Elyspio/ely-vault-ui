import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { Logo } from "@components/shared/Logo";

type Props = {
	title: string;
	subtitle?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	avatar?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer, avatar }: Readonly<Props>) {
	return (
		<Box
			sx={{
				height: "100%",
				overflow: "auto",
				display: "grid",
				placeItems: "center",
				p: 3,
				background: "radial-gradient(1200px 600px at 50% -10%, rgba(79,210,255,0.08), transparent 60%), var(--surface-0)",
			}}
		>
			<Box sx={{ width: "100%", maxWidth: 400, animation: "fadeIn 200ms ease" }}>
				<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3, textAlign: "center" }}>
					{avatar ?? <Logo size={72} sx={{ mb: 2, filter: "drop-shadow(0 0 28px rgba(79,210,255,0.22))" }} />}
					<Typography variant="h5">{title}</Typography>
					{subtitle && (
						<Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
							{subtitle}
						</Typography>
					)}
				</Box>
				<Paper sx={{ p: 3, borderRadius: 3, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)" }}>{children}</Paper>
				{footer && <Box sx={{ mt: 2, textAlign: "center" }}>{footer}</Box>}
			</Box>
		</Box>
	);
}
