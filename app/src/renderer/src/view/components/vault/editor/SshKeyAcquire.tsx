import { type KeyboardEvent, useState } from "react";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import FileOpenRounded from "@mui/icons-material/FileOpenRounded";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Kbd } from "@components/shared/Kbd";

type Props = {
	busy: boolean;
	/** Focus the generate button (create mode: the first thing to do) */
	autoFocus: boolean;
	onGenerate: () => void;
	onImportFile: () => void;
	/** Text pasted by the user; the component forgets it once the parent unmounts it (key ready) */
	onConvert: (text: string) => void;
};

/**
 * The ways to get a key: generate, import from a file, or paste a private key
 */
export function SshKeyAcquire({ busy, autoFocus, onGenerate, onImportFile, onConvert }: Readonly<Props>) {
	const { t } = useTranslation("editor");
	const [pasting, setPasting] = useState(false);
	const [text, setText] = useState("");

	const convert = () => {
		if (text.trim() !== "") onConvert(text);
	};

	// Ctrl+Enter converts: a plain Enter starts a new line of the key
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
		event.preventDefault();
		convert();
	};

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
				<Button size="small" variant="contained" startIcon={<AutoAwesomeRounded />} autoFocus={autoFocus} disabled={busy} onClick={onGenerate}>
					{t("ssh.generate")}
				</Button>
				<Button size="small" variant="outlined" color="inherit" startIcon={<FileOpenRounded />} disabled={busy} onClick={onImportFile}>
					{t("ssh.importFile")}
				</Button>
				<Button
					size="small"
					variant="outlined"
					color="inherit"
					startIcon={<ContentPasteRounded />}
					disabled={busy}
					aria-expanded={pasting}
					onClick={() => setPasting((open) => !open)}
				>
					{t("ssh.paste")}
				</Button>
			</Box>

			{pasting && (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
					<TextField
						autoFocus
						multiline
						minRows={4}
						fullWidth
						size="small"
						label={t("ssh.privateKey")}
						placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
						value={text}
						disabled={busy}
						autoComplete="off"
						spellCheck={false}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={onKeyDown}
						slotProps={{ input: { className: "mono" } }}
					/>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
						<Button size="small" variant="contained" disabled={busy || text.trim() === ""} onClick={convert}>
							{t("ssh.convert")}
						</Button>
						<Kbd>Ctrl</Kbd>
						<Kbd>Enter</Kbd>
						<Typography sx={{ fontSize: "0.75rem", color: "var(--text-faint)", ml: 0.5 }}>{t("ssh.formats")}</Typography>
					</Box>
				</Box>
			)}
		</Box>
	);
}
