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
import { type AppConfig, type AutoTypeAfter, offlineAccessMs, type ThemeMode, type UpdateChannel } from "@shared/config/app.config";
import { validateAutoTypeSequence } from "@shared/autotype/autotype.sequence";
import { useAutoTypeAvailability } from "@hooks/useAutoType";
import { formatDateTime } from "@view/utils/date.utils";
import { CertificatesSection } from "./CertificatesSection";
import { HelloUnlockSetting } from "./HelloUnlockSetting";
import { UpdatesSection } from "./UpdatesSection";
import { selectPendingUpdate } from "@modules/update/update.selectors";
import { useDialogFocus } from "@hooks/useDialogFocus";
import { type Language, type LanguageSetting, languages } from "@shared/i18n/i18n.languages";
import { useTranslation } from "react-i18next";
import { translateMessage } from "@core/utils/message.utils";

type Duration = { value: number; unit: "seconds" | "minutes" | "hours" | "never"; count: number };

const autoLockOptions: Duration[] = [
	{ value: 1, unit: "minutes", count: 1 },
	{ value: 5, unit: "minutes", count: 5 },
	{ value: 15, unit: "minutes", count: 15 },
	{ value: 30, unit: "minutes", count: 30 },
	{ value: 60, unit: "hours", count: 1 },
	{ value: 240, unit: "hours", count: 4 },
	{ value: 0, unit: "never", count: 0 },
];

const clipboardOptions: Duration[] = [
	{ value: 10, unit: "seconds", count: 10 },
	{ value: 20, unit: "seconds", count: 20 },
	{ value: 30, unit: "seconds", count: 30 },
	{ value: 60, unit: "minutes", count: 1 },
	{ value: 120, unit: "minutes", count: 2 },
	{ value: 0, unit: "never", count: 0 },
];

const offlineAccessOptions: Duration[] = [
	{ value: 1, unit: "minutes", count: 1 },
	{ value: 5, unit: "minutes", count: 5 },
	{ value: 15, unit: "minutes", count: 15 },
	{ value: 30, unit: "minutes", count: 30 },
	{ value: 60, unit: "hours", count: 1 },
	{ value: 240, unit: "hours", count: 4 },
	{ value: 720, unit: "hours", count: 12 },
	{ value: 1440, unit: "hours", count: 24 },
];

/** Offline access choices, with a value set by hand in the configuration file (shown in minutes) */
function offlineAccessChoices(minutes: number): Duration[] {
	if (offlineAccessOptions.some((o) => o.value === minutes)) return offlineAccessOptions;
	return [...offlineAccessOptions, { value: minutes, unit: "minutes" as const, count: minutes }].sort((a, b) => a.value - b.value);
}

const channelOptions: UpdateChannel[] = ["stable", "beta", "dev"];

const themeOptions: ThemeMode[] = ["dark", "light", "system"];

/** Language names are written in their own language, never translated */
const languageNames: Record<Language, string> = { en: "English", fr: "Français" };

const languageOptions: LanguageSetting[] = ["system", ...languages];

const afterTypingOptions: AutoTypeAfter[] = ["minimized", "restore", "lock"];

type SectionKey = "security" | "display" | "autoType" | "updates" | "certificates" | "account";

const sections: { key: SectionKey; icon: ReactNode }[] = [
	{ key: "security", icon: <ShieldRounded /> },
	{ key: "display", icon: <PaletteRounded /> },
	{ key: "autoType", icon: <KeyboardRounded /> },
	{ key: "updates", icon: <SystemUpdateAltRounded /> },
	{ key: "certificates", icon: <VerifiedUserRounded /> },
	{ key: "account", icon: <PersonRounded /> },
];

export function SettingsDialog() {
	const { t } = useTranslation(["settings", "common"]);
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
	const durationLabel = (o: Duration) => (o.unit === "never" ? t("durations.never") : t(`durations.${o.unit}`, { count: o.count }));

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
					<Typography sx={{ px: 1.25, pb: 1.5, fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>{t("dialog.title")}</Typography>
					{sections.map((s) => (
						<SidebarItem
							key={s.key}
							label={t(`sections.${s.key}.label`)}
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
							<Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>{t(`sections.${active}.label`)}</Typography>
							<Typography sx={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t(`sections.${active}.description`)}</Typography>
						</Box>
						<IconButton size="small" onClick={close} aria-label={t("common:close")} sx={{ color: "var(--text-muted)" }}>
							<CloseRounded fontSize="small" />
						</IconButton>
					</Box>
					<Box ref={contentRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 3, display: "flex", flexDirection: "column", gap: 2 }}>
						{active === "security" && (
							<Group>
								<Setting label={t("security.autoLock.label")} description={t("security.autoLock.description")}>
									<Select
										size="small"
										value={config.security.autoLockMinutes ?? 0}
										onChange={(event) => update((c) => ({ ...c, security: { ...c.security, autoLockMinutes: Number(event.target.value) || null } }))}
										sx={{ minWidth: 150 }}
									>
										{autoLockOptions.map((o) => (
											<MenuItem key={o.value} value={o.value}>
												{durationLabel(o)}
											</MenuItem>
										))}
									</Select>
								</Setting>
								<Setting label={t("security.lockOnSystemLock.label")} description={t("security.lockOnSystemLock.description")}>
									<Switch
										checked={config.security.lockOnSystemLock}
										onChange={(_, checked) => update((c) => ({ ...c, security: { ...c.security, lockOnSystemLock: checked } }))}
									/>
								</Setting>
								<HelloUnlockSetting
									render={(control) => (
										<Setting label={t("security.hello.label")} description={t("security.hello.description")}>
											{control}
										</Setting>
									)}
								/>
								<Setting label={t("security.clipboard.label")} description={t("security.clipboard.description")}>
									<Select
										size="small"
										value={config.security.clipboardClearSeconds ?? 0}
										onChange={(event) => update((c) => ({ ...c, security: { ...c.security, clipboardClearSeconds: Number(event.target.value) || null } }))}
										sx={{ minWidth: 150 }}
									>
										{clipboardOptions.map((o) => (
											<MenuItem key={o.value} value={o.value}>
												{durationLabel(o)}
											</MenuItem>
										))}
									</Select>
								</Setting>
								<Setting label={t("security.offlineAccess.label")} description={t("security.offlineAccess.description")}>
									<Select
										size="small"
										value={offlineAccessMs(config.security.offlineAccessMinutes) / 60_000}
										onChange={(event) => update((c) => ({ ...c, security: { ...c.security, offlineAccessMinutes: Number(event.target.value) } }))}
										sx={{ minWidth: 150 }}
									>
										{offlineAccessChoices(offlineAccessMs(config.security.offlineAccessMinutes) / 60_000).map((o) => (
											<MenuItem key={o.value} value={o.value}>
												{durationLabel(o)}
											</MenuItem>
										))}
									</Select>
								</Setting>
							</Group>
						)}
						{active === "display" && (
							<Group>
								<Setting label={t("display.theme.label")} description={t("display.theme.description")}>
									<Select
										size="small"
										value={config.display.theme}
										onChange={(event) => update((c) => ({ ...c, display: { ...c.display, theme: event.target.value } }))}
										sx={{ minWidth: 150 }}
									>
										{themeOptions.map((o) => (
											<MenuItem key={o} value={o}>
												{t(`display.theme.${o}`)}
											</MenuItem>
										))}
									</Select>
								</Setting>
								<Setting label={t("display.language.label")} description={t("display.language.description")}>
									<Select
										size="small"
										value={config.display.language}
										onChange={(event) => update((c) => ({ ...c, display: { ...c.display, language: event.target.value } }))}
										sx={{ minWidth: 150 }}
									>
										{languageOptions.map((o) => (
											<MenuItem key={o} value={o}>
												{o === "system" ? t("display.language.system") : languageNames[o]}
											</MenuItem>
										))}
									</Select>
								</Setting>
								<Setting label={t("display.favicons.label")} description={t("display.favicons.description")}>
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
									<Setting label={t("autoType.unavailable")} description={autoType.reason}>
										{null}
									</Setting>
								)}
								<Setting label={t("autoType.defaultSequence.label")} description={t("autoType.defaultSequence.description")}>
									<SequenceInput
										key={config.autoType.defaultSequence}
										value={config.autoType.defaultSequence}
										onSave={(defaultSequence) => update((c) => ({ ...c, autoType: { ...c.autoType, defaultSequence } }))}
									/>
								</Setting>
								<Setting label={t("autoType.pressEnter.label")} description={t("autoType.pressEnter.description")}>
									<Switch
										checked={config.autoType.pressEnter}
										onChange={(_, checked) => update((c) => ({ ...c, autoType: { ...c.autoType, pressEnter: checked } }))}
									/>
								</Setting>
								<Setting label={t("autoType.afterTyping.label")} description={t("autoType.afterTyping.description")}>
									<Select
										size="small"
										value={config.autoType.afterTyping}
										onChange={(event) => update((c) => ({ ...c, autoType: { ...c.autoType, afterTyping: event.target.value } }))}
										sx={{ minWidth: 150 }}
									>
										{afterTypingOptions.map((o) => (
											<MenuItem key={o} value={o}>
												{t(`autoType.afterTyping.${o}`)}
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
									<Setting label={t("updates.autoCheck.label")} description={t("updates.autoCheck.description")}>
										<Switch
											checked={config.updates.autoCheck}
											onChange={(_, checked) => update((c) => ({ ...c, updates: { ...c.updates, autoCheck: checked } }))}
										/>
									</Setting>
									<Setting label={t("updates.channel.label")} description={t("updates.channel.description")}>
										<Select
											size="small"
											value={config.updates.channel}
											onChange={(event) => update((c) => ({ ...c, updates: { ...c.updates, channel: event.target.value } }))}
											sx={{ minWidth: 150 }}
										>
											{channelOptions.map((o) => (
												<MenuItem key={o} value={o}>
													{t(`updates.channel.${o}`)}
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
								<Setting
									label={account?.email ?? ""}
									description={
										lastSync ? t("account.syncedOn", { server: account?.serverUrl ?? "", date: formatDateTime(lastSync) }) : (account?.serverUrl ?? "")
									}
								>
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
										{confirmLogout ? t("common:confirm") : t("account.logout")}
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
	const validation = validateAutoTypeSequence(draft);
	const error = validation && translateMessage(validation);

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
