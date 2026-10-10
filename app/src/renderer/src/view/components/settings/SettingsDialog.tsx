import { type ReactNode, type Ref, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, MenuItem, Select, Switch, TextField, Typography } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setSettingsOpen } from "@modules/ui/ui.reducer";
import { saveConfig } from "@modules/config/config.async.actions";
import { logout } from "@modules/session/session.async.actions";
import type { AppConfig, AutoTypeAfter, UpdateChannel } from "@shared/config/app.config";
import { validateAutoTypeSequence } from "@shared/autotype/autotype.sequence";
import { useAutoTypeAvailability } from "@hooks/useAutoType";
import { formatDateTime } from "@view/utils/date.utils";
import { CertificatesSection } from "./CertificatesSection";
import { UpdatesSection } from "./UpdatesSection";
import { selectPendingUpdate } from "@modules/update/update.selectors";

const autoLockOptions = [
	{ value: 1, label: "1 minute" },
	{ value: 5, label: "5 minutes" },
	{ value: 15, label: "15 minutes" },
	{ value: 30, label: "30 minutes" },
	{ value: 60, label: "1 hour" },
	{ value: 240, label: "4 hours" },
	{ value: 0, label: "Never" },
];

const clipboardOptions = [
	{ value: 10, label: "10 seconds" },
	{ value: 20, label: "20 seconds" },
	{ value: 30, label: "30 seconds" },
	{ value: 60, label: "1 minute" },
	{ value: 120, label: "2 minutes" },
	{ value: 0, label: "Never" },
];

const channelOptions: { value: UpdateChannel; label: string }[] = [
	{ value: "stable", label: "Stable" },
	{ value: "beta", label: "Beta" },
	{ value: "dev", label: "Dev" },
];

const afterTypingOptions: { value: AutoTypeAfter; label: string }[] = [
	{ value: "minimized", label: "Stay minimized" },
	{ value: "restore", label: "Come back to the front" },
	{ value: "lock", label: "Lock the vault" },
];

export function SettingsDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.settingsOpen);
	const config = useAppSelector((state) => state.config.current);
	const account = useAppSelector((state) => state.session.current);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync);
	const [confirmLogout, setConfirmLogout] = useState(false);
	const autoType = useAutoTypeAvailability();
	const pendingUpdate = useAppSelector(selectPendingUpdate);
	const updatesRef = useRef<HTMLDivElement>(null);

	const close = () => {
		setConfirmLogout(false);
		dispatch(setSettingsOpen(false));
	};

	const update = (updater: (config: AppConfig) => AppConfig) => void dispatch(saveConfig(updater(config)));

	return (
		<Dialog
			open={open}
			onClose={close}
			maxWidth="sm"
			fullWidth
			// Opened from the titlebar badge: show the update waiting for the user
			slotProps={{ transition: { onEntered: () => pendingUpdate && updatesRef.current?.scrollIntoView({ block: "start" }) } }}
		>
			<DialogTitle sx={{ display: "flex", alignItems: "center" }}>
				<Box sx={{ flex: 1 }}>Settings</Box>
				<IconButton size="small" onClick={close}>
					<CloseRounded fontSize="small" />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ pb: 3 }}>
				<Section title="Security">
					<Setting label="Auto-lock" description="After a period of computer inactivity">
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
					<Setting label="Lock with the session" description="When the computer is locked or goes to sleep">
						<Switch
							checked={config.security.lockOnSystemLock}
							onChange={(_, checked) => update((c) => ({ ...c, security: { ...c.security, lockOnSystemLock: checked } }))}
						/>
					</Setting>
					<Setting label="Clear the clipboard" description="After copying a value, if it is still there">
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

				<Section title="Display">
					<Setting label="Website icons" description="Fetched through your server's icon service">
						<Switch checked={config.display.showFavicons} onChange={(_, checked) => update((c) => ({ ...c, display: { ...c.display, showFavicons: checked } }))} />
					</Setting>
				</Section>

				<Section title="Auto-type">
					{autoType?.available === false && (
						<Setting label="Unavailable" description={autoType.reason}>
							{null}
						</Setting>
					)}
					<Setting label="Default sequence" description="{USERNAME} {PASSWORD} {TOTP} {TAB} {ENTER} {DELAY n}. An autotype custom field replaces it for an item.">
						<SequenceInput
							key={config.autoType.defaultSequence}
							value={config.autoType.defaultSequence}
							onSave={(defaultSequence) => update((c) => ({ ...c, autoType: { ...c.autoType, defaultSequence } }))}
						/>
					</Setting>
					<Setting label="Press Enter" description="Presses Enter after the default sequence">
						<Switch checked={config.autoType.pressEnter} onChange={(_, checked) => update((c) => ({ ...c, autoType: { ...c.autoType, pressEnter: checked } }))} />
					</Setting>
					<Setting label="After typing" description="Vault window once the sequence is typed">
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

				<Section title="Updates" ref={updatesRef}>
					<UpdatesSection />
					<Setting label="Automatic updates" description="Checks for a new version at startup then every hour, and downloads it">
						<Switch checked={config.updates.autoCheck} onChange={(_, checked) => update((c) => ({ ...c, updates: { ...c.updates, autoCheck: checked } }))} />
					</Setting>
					<Setting
						label="Channel"
						description="Stable releases, also the betas, or the development builds. An older version of the new channel is only installed on request"
					>
						<Select
							size="small"
							value={config.updates.channel}
							onChange={(event) => update((c) => ({ ...c, updates: { ...c.updates, channel: event.target.value } }))}
							sx={{ minWidth: 150 }}
						>
							{channelOptions.map((o) => (
								<MenuItem key={o.value} value={o.value}>
									{o.label}
								</MenuItem>
							))}
						</Select>
					</Setting>
				</Section>

				<Section title="Approved certificates">
					<CertificatesSection />
				</Section>

				<Section title="Account">
					<Setting label={account?.email ?? ""} description={`${account?.serverUrl ?? ""}${lastSync ? ` · synced on ${formatDateTime(lastSync)}` : ""}`}>
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
							{confirmLogout ? "Confirm" : "Log out"}
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

function Section({ title, children, ref }: Readonly<{ title: string; children: ReactNode; ref?: Ref<HTMLDivElement> }>) {
	return (
		<Box ref={ref} sx={{ mb: 2.5 }}>
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
