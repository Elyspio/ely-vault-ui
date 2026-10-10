import { type ReactNode, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, Select, Switch, TextField, Typography } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setSettingsOpen } from "@modules/ui/ui.reducer";
import { saveConfig } from "@modules/config/config.async.actions";
import { logout } from "@modules/session/session.async.actions";
import type { AppConfig, AutoTypeAfter } from "@shared/config/app.config";
import { validateAutoTypeSequence } from "@shared/autotype/autotype.sequence";
import { useAutoTypeAvailability } from "@hooks/useAutoType";
import { formatDateTime } from "@view/utils/date.utils";
import { CertificatesSection } from "./CertificatesSection";

const autoLockOptions = [
	{ value: 1, label: "1 minute" },
	{ value: 5, label: "5 minutes" },
	{ value: 15, label: "15 minutes" },
	{ value: 30, label: "30 minutes" },
	{ value: 60, label: "1 heure" },
	{ value: 240, label: "4 heures" },
	{ value: 0, label: "Jamais" },
];

const clipboardOptions = [
	{ value: 10, label: "10 secondes" },
	{ value: 20, label: "20 secondes" },
	{ value: 30, label: "30 secondes" },
	{ value: 60, label: "1 minute" },
	{ value: 120, label: "2 minutes" },
	{ value: 0, label: "Jamais" },
];

const afterTypingOptions: { value: AutoTypeAfter; label: string }[] = [
	{ value: "minimized", label: "Rester réduite" },
	{ value: "restore", label: "Revenir au premier plan" },
	{ value: "lock", label: "Verrouiller le coffre" },
];

export function SettingsDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.settingsOpen);
	const config = useAppSelector((state) => state.config.current);
	const account = useAppSelector((state) => state.session.current);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync);
	const [confirmLogout, setConfirmLogout] = useState(false);
	const autoType = useAutoTypeAvailability();

	const close = () => {
		setConfirmLogout(false);
		dispatch(setSettingsOpen(false));
	};

	const update = (updater: (config: AppConfig) => AppConfig) => void dispatch(saveConfig(updater(config)));

	return (
		<Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center" }}>
				<Box sx={{ flex: 1 }}>Paramètres</Box>
				<IconButton size="small" onClick={close}>
					<CloseRounded fontSize="small" />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ pb: 3 }}>
				<Section title="Sécurité">
					<Setting label="Verrouillage automatique" description="Après une période d'inactivité de l'ordinateur">
						<Select
							size="small"
							value={config.security.autoLockMinutes ?? 0}
							onChange={(event) => update((c) => ({ ...c, security: { ...c.security, autoLockMinutes: Number(event.target.value) || null } }))}
							sx={{ minWidth: 150 }}
						>
							{autoLockOptions.map((o) => (
								<MenuItem key={o.value} value={o.value}>
									{o.label}
								</MenuItem>
							))}
						</Select>
					</Setting>
					<Setting label="Verrouiller avec la session" description="Quand l'ordinateur est verrouillé ou mis en veille">
						<Switch
							checked={config.security.lockOnSystemLock}
							onChange={(_, checked) => update((c) => ({ ...c, security: { ...c.security, lockOnSystemLock: checked } }))}
						/>
					</Setting>
					<Setting label="Effacer le presse-papiers" description="Après la copie d'une valeur, si elle y est encore">
						<Select
							size="small"
							value={config.security.clipboardClearSeconds ?? 0}
							onChange={(event) => update((c) => ({ ...c, security: { ...c.security, clipboardClearSeconds: Number(event.target.value) || null } }))}
							sx={{ minWidth: 150 }}
						>
							{clipboardOptions.map((o) => (
								<MenuItem key={o.value} value={o.value}>
									{o.label}
								</MenuItem>
							))}
						</Select>
					</Setting>
				</Section>

				<Section title="Affichage">
					<Setting label="Icônes des sites" description="Récupérées via le service d'icônes de votre serveur">
						<Switch checked={config.display.showFavicons} onChange={(_, checked) => update((c) => ({ ...c, display: { ...c.display, showFavicons: checked } }))} />
					</Setting>
				</Section>

				<Section title="Saisie automatique">
					{autoType?.available === false && (
						<Setting label="Indisponible" description={autoType.reason}>
							{null}
						</Setting>
					)}
					<Setting
						label="Séquence par défaut"
						description="{USERNAME} {PASSWORD} {TOTP} {TAB} {ENTER} {DELAY n}. Un champ personnalisé « autotype » la remplace pour un élément."
					>
						<SequenceInput
							key={config.autoType.defaultSequence}
							value={config.autoType.defaultSequence}
							onSave={(defaultSequence) => update((c) => ({ ...c, autoType: { ...c.autoType, defaultSequence } }))}
						/>
					</Setting>
					<Setting label="Valider avec Entrée" description="Appuie sur Entrée après la séquence par défaut">
						<Switch checked={config.autoType.pressEnter} onChange={(_, checked) => update((c) => ({ ...c, autoType: { ...c.autoType, pressEnter: checked } }))} />
					</Setting>
					<Setting label="Après la saisie" description="Fenêtre de Vault une fois la séquence tapée">
						<Select
							size="small"
							value={config.autoType.afterTyping}
							onChange={(event) => update((c) => ({ ...c, autoType: { ...c.autoType, afterTyping: event.target.value } }))}
							sx={{ minWidth: 150 }}
						>
							{afterTypingOptions.map((o) => (
								<MenuItem key={o.value} value={o.value}>
									{o.label}
								</MenuItem>
							))}
						</Select>
					</Setting>
				</Section>

				<Section title="Certificats approuvés">
					<CertificatesSection />
				</Section>

				<Section title="Compte">
					<Setting label={account?.email ?? ""} description={`${account?.serverUrl ?? ""}${lastSync ? ` · synchronisé le ${formatDateTime(lastSync)}` : ""}`}>
						<Button
							color={confirmLogout ? "error" : "inherit"}
							variant={confirmLogout ? "contained" : "outlined"}
							size="small"
							startIcon={<LogoutRounded />}
							onClick={() => {
								if (!confirmLogout) {
									setConfirmLogout(true);
									return;
								}
								close();
								void dispatch(logout());
							}}
						>
							{confirmLogout ? "Confirmer" : "Se déconnecter"}
						</Button>
					</Setting>
				</Section>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Saved when leaving the field, only when the sequence is valid
 */
function SequenceInput({ value, onSave }: Readonly<{ value: string; onSave: (value: string) => void }>) {
	const [draft, setDraft] = useState(value);
	const error = validateAutoTypeSequence(draft);

	return (
		<TextField
			size="small"
			value={draft}
			error={Boolean(error)}
			helperText={error}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={() => {
				if (!error && draft !== value) onSave(draft);
			}}
			slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: "var(--font-mono)", fontSize: "0.8rem" } } }}
			sx={{ width: 240 }}
		/>
	);
}

function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
	return (
		<Box sx={{ mb: 2.5 }}>
			<Typography variant="overline" component="div" sx={{ color: "var(--text-faint)", mb: 0.5 }}>
				{title}
			</Typography>
			<Box sx={{ borderRadius: 2.5, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)" }}>{children}</Box>
		</Box>
	);
}

function Setting({ label, description, children }: Readonly<{ label: string; description: string; children: ReactNode }>) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, py: 1.5, "&:not(:last-of-type)": { borderBottom: "1px solid var(--border-subtle)" } }}>
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography sx={{ fontSize: "0.88rem", fontWeight: 500 }}>{label}</Typography>
				<Typography sx={{ fontSize: "0.75rem", color: "var(--text-muted)", overflowWrap: "anywhere" }}>{description}</Typography>
			</Box>
			{children}
		</Box>
	);
}
