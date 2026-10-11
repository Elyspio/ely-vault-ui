import { type ReactNode, useRef, useState } from "react";
import { alpha, Box, Button, Dialog, IconButton, MenuItem, Select, Switch, TextField, Typography } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import PaletteRounded from "@mui/icons-material/PaletteRounded";
import KeyboardRounded from "@mui/icons-material/KeyboardRounded";
import SystemUpdateAltRounded from "@mui/icons-material/SystemUpdateAltRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { setSettingsOpen } from "@modules/ui/ui.reducer";
import { saveConfig } from "@modules/config/config.async.actions";
import { logout } from "@modules/session/session.async.actions";
import type { AppConfig, AutoTypeAfter, ThemeMode, UpdateChannel } from "@shared/config/app.config";
import { validateAutoTypeSequence } from "@shared/autotype/autotype.sequence";
import { useAutoTypeAvailability } from "@hooks/useAutoType";
import { formatDateTime } from "@view/utils/date.utils";
import { CertificatesSection } from "./CertificatesSection";
import { HelloUnlockSetting } from "./HelloUnlockSetting";
import { UpdatesSection } from "./UpdatesSection";
import { selectPendingUpdate } from "@modules/update/update.selectors";
import { useDialogFocus } from "@hooks/useDialogFocus";

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

const themeOptions: { value: ThemeMode; label: string }[] = [
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
	{ value: "system", label: "System" },
];

const afterTypingOptions: { value: AutoTypeAfter; label: string }[] = [
	{ value: "minimized", label: "Stay minimized" },
	{ value: "restore", label: "Come back to the front" },
	{ value: "lock", label: "Lock the vault" },
];

type SectionKey = "security" | "display" | "autoType" | "updates" | "certificates" | "account";

const sections: { key: SectionKey; label: string; description: string; icon: ReactNode }[] = [
	{ key: "security", label: "Security", description: "Locking and clipboard", icon: <ShieldRounded /> },
	{ key: "display", label: "Display", description: "Vault appearance", icon: <PaletteRounded /> },
	{ key: "autoType", label: "Auto-type", description: "Sequence typed into the previous window (Ctrl V)", icon: <KeyboardRounded /> },
	{ key: "updates", label: "Updates", description: "Releases published on GitHub", icon: <SystemUpdateAltRounded /> },
	{ key: "certificates", label: "Certificates", description: "Authorities approved for your server", icon: <VerifiedUserRounded /> },
	{ key: "account", label: "Account", description: "Server and login", icon: <PersonRounded /> },
];

export function SettingsDialog() {
	const dispatch = useAppDispatch();
	const open = useAppSelector((state) => state.ui.settingsOpen);
	const config = useAppSelector((state) => state.config.current);
	const account = useAppSelector((state) => state.session.current);
	const lastSync = useAppSelector((state) => state.vault.snapshot?.lastSync);
	const currentVersion = useAppSelector((state) => state.update.status?.currentVersion);
	const [confirmLogout, setConfirmLogout] = useState(false);
	const autoType = useAutoTypeAvailability();
	const pendingUpdate = useAppSelector(selectPendingUpdate);
	const [active, setActive] = useState<SectionKey>("security");

	// On opening (state adjusted during render): an update waiting for the user (titlebar badge) opens its section
	const [wasOpen, setWasOpen] = useState(open);
	if (wasOpen !== open) {
		setWasOpen(open);
		setConfirmLogout(false);
		if (open) setActive(pendingUpdate ? "updates" : "security");
	}

	const close = () => dispatch(setSettingsOpen(false));
	// Focus goes to the first control of the active section (the section changes while the dialog is open: read at focus time)
	const contentRef = useRef<HTMLDivElement>(null);
	const focus = useDialogFocus(() => contentRef.current?.querySelector<HTMLElement>('[role="combobox"], button, input:not([tabindex="-1"]), [role="switch"]'));

	const update = (updater: (config: AppConfig) => AppConfig) => void dispatch(saveConfig(updater(config)));
	const section = sections.find((s) => s.key === active)!;

	return (
		<Dialog open={open} onClose={close} maxWidth="md" fullWidth slotProps={{ transition: focus, paper: { sx: { height: "min(70vh, 640px)", minHeight: 420 } } }}>
			<Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
				<Box
					component="nav"
					sx={{
						width: 184,
						flexShrink: 0,
						display: "flex",
						flexDirection: "column",
						gap: 0.25,
						p: 1,
						pt: 2,
						borderRight: "1px solid var(--border-subtle)",
						bgcolor: "var(--surface-0)",
					}}
				>
					<Typography sx={{ px: 1.25, pb: 1.5, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>Settings</Typography>
					{sections.map((s) => (
						<SidebarItem
							key={s.key}
							label={s.label}
							icon={s.icon}
							active={s.key === active}
							badge={s.key === "updates" && pendingUpdate !== null}
							onClick={() => setActive(s.key)}
						/>
					))}
					<Box sx={{ flex: 1 }} />
					{currentVersion && (
						<Typography className="mono" sx={{ px: 1.25, fontSize: "0.68rem", color: "var(--text-faint)" }}>
							{window.preload.config.appName} {currentVersion}
						</Typography>
					)}
				</Box>

				<Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
					<Box sx={{ display: "flex", alignItems: "flex-start", px: 3, pt: 2.5, pb: 2 }}>
						<Box sx={{ flex: 1 }}>
							<Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>{section.label}</Typography>
							<Typography sx={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{section.description}</Typography>
						</Box>
						<IconButton size="small" onClick={close} sx={{ color: "var(--text-muted)" }}>
							<CloseRounded fontSize="small" />
						</IconButton>
					</Box>
					<Box ref={contentRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 2 }}>
						{active === "security" && (
							<Group>
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
								<HelloUnlockSetting
									render={(control) => (
										<Setting label="Unlock with Windows Hello" description="Face, fingerprint or PIN instead of the master password">
											{control}
										</Setting>
									)}
								/>
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
							</Group>
						)}
						{active === "display" && (
							<Group>
								<Setting label="Theme" description="Dark, light, or the same as the operating system">
									<Select
										size="small"
										value={config.display.theme}
										onChange={(event) => update((c) => ({ ...c, display: { ...c.display, theme: event.target.value } }))}
										sx={{ minWidth: 150 }}
									>
										{themeOptions.map((o) => (
											<MenuItem key={o.value} value={o.value}>
												{o.label}
											</MenuItem>
										))}
									</Select>
								</Setting>
								<Setting label="Website icons" description="Fetched through your server's icon service">
									<Switch
										checked={config.display.showFavicons}
										onChange={(_, checked) => update((c) => ({ ...c, display: { ...c.display, showFavicons: checked } }))}
									/>
								</Setting>
							</Group>
						)}
						{active === "autoType" && (
							<Group>
								{autoType?.available === false && (
									<Setting label="Unavailable" description={autoType.reason}>
										{null}
									</Setting>
								)}
								<Setting
									label="Default sequence"
									description="{USERNAME} {PASSWORD} {TOTP} {TAB} {ENTER} {DELAY n}. An autotype custom field replaces it for an item."
								>
									<SequenceInput
										key={config.autoType.defaultSequence}
										value={config.autoType.defaultSequence}
										onSave={(defaultSequence) => update((c) => ({ ...c, autoType: { ...c.autoType, defaultSequence } }))}
									/>
								</Setting>
								<Setting label="Press Enter" description="Presses Enter after the default sequence">
									<Switch
										checked={config.autoType.pressEnter}
										onChange={(_, checked) => update((c) => ({ ...c, autoType: { ...c.autoType, pressEnter: checked } }))}
									/>
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
							</Group>
						)}
						{active === "updates" && (
							<>
								<Group>
									<UpdatesSection />
								</Group>
								<Group>
									<Setting label="Automatic updates" description="Checks for a new version at startup then every hour, and downloads it">
										<Switch
											checked={config.updates.autoCheck}
											onChange={(_, checked) => update((c) => ({ ...c, updates: { ...c.updates, autoCheck: checked } }))}
										/>
									</Setting>
									<Setting
										label="Channel"
										description="Stable releases, also the betas, or also the development builds: the highest version wins. An older version of the new channel is only installed on request"
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
								</Group>
							</>
						)}
						{active === "certificates" && (
							<Group>
								<CertificatesSection />
							</Group>
						)}
						{active === "account" && (
							<Group>
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
							</Group>
						)}
					</Box>
				</Box>
			</Box>
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

function Group({ children }: Readonly<{ children: ReactNode }>) {
	return <Box sx={{ borderRadius: 2.5, border: "1px solid var(--border-subtle)", bgcolor: "var(--surface-1)" }}>{children}</Box>;
}

function SidebarItem({ label, icon, active, badge, onClick }: Readonly<{ label: string; icon: ReactNode; active: boolean; badge: boolean; onClick: () => void }>) {
	return (
		<Box
			component="button"
			onClick={onClick}
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1,
				px: 1.25,
				py: 0.75,
				border: 0,
				borderRadius: 1.5,
				bgcolor: active ? "var(--surface-2)" : "transparent",
				color: active ? "text.primary" : "var(--text-muted)",
				font: "inherit",
				fontSize: "0.8rem",
				textAlign: "left",
				cursor: "pointer",
				transition: "background-color 120ms ease, color 120ms ease",
				"&:hover": { bgcolor: active ? "var(--surface-2)" : "var(--hover)", color: "text.primary" },
				"& .MuiSvgIcon-root": { fontSize: 16, color: active ? "var(--accent)" : "inherit" },
			}}
		>
			{icon}
			<Box component="span" sx={{ flex: 1 }}>
				{label}
			</Box>
			{badge && (
				<Box
					component="span"
					sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "var(--accent)", boxShadow: (theme) => `0 0 6px ${alpha(theme.palette.primary.main, 0.6)}` }}
				/>
			)}
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
