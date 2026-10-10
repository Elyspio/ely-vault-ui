import type { ReactNode } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";

type Props = {
	label: string;
	children: ReactNode;
	/** Copies the value: whole row clickable */
	onCopy?: () => void;
	actions?: ReactNode;
	mono?: boolean;
	multiline?: boolean;
};

/**
 * A labelled value of an item; click anywhere on the row to copy it
 */
export function FieldRow({ label, children, onCopy, actions, mono, multiline }: Readonly<Props>) {
	return (
		<Box
			onClick={() => {
				// Selecting text must not copy the whole value
				if (window.getSelection()?.toString()) return;
				onCopy?.();
			}}
			sx={{
				position: "relative",
				display: "flex",
				alignItems: multiline ? "flex-start" : "center",
				gap: 1,
				px: 2,
				py: 1.25,
				cursor: onCopy ? "pointer" : "default",
				transition: "background-color 120ms ease",
				"&:not(:last-of-type)": { borderBottom: "1px solid var(--border-subtle)" },
				"&:hover": { bgcolor: onCopy ? "rgba(255,255,255,0.025)" : undefined },
				"&:hover .FieldRow__actions": { opacity: 1 },
			}}
		>
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography sx={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--text-faint)", mb: 0.25 }}>{label}</Typography>
				<Box
					className={mono ? "mono" : undefined}
					sx={{
						fontSize: mono ? "0.88rem" : "0.9rem",
						lineHeight: 1.5,
						overflowWrap: "anywhere",
						whiteSpace: multiline ? "pre-wrap" : "normal",
						userSelect: "text",
						cursor: "text",
					}}
				>
					{children}
				</Box>
			</Box>
			<Box
				className="FieldRow__actions"
				onClick={(event) => event.stopPropagation()}
				sx={{ display: "flex", gap: 0.25, opacity: 0.35, transition: "opacity 120ms ease", flexShrink: 0 }}
			>
				{actions}
				{onCopy && (
					<Tooltip title="Copy">
						<IconButton size="small" onClick={onCopy}>
							<ContentCopyRounded sx={{ fontSize: 16 }} />
						</IconButton>
					</Tooltip>
				)}
			</Box>
		</Box>
	);
}

export function FieldCard({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
	return (
		<Box sx={{ mb: 2.5 }}>
			{title && (
				<Typography variant="overline" component="div" sx={{ color: "var(--text-faint)", px: 0.5, mb: 0.5 }}>
					{title}
				</Typography>
			)}
			<Box sx={{ borderRadius: 2.5, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)", overflow: "hidden" }}>{children}</Box>
		</Box>
	);
}
