import type { Dispatch, SetStateAction } from "react";
import { Box, Button, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { useVaultActions } from "@hooks/useVaultActions";
import { isValidTotp } from "@shared/vault/totp";
import { type DraftUri, type ItemDraft, type SecretChange, UriMatchType, type VaultItem } from "@shared/types/vault.types";
import { SecretInput } from "./SecretInput";
import { EditorSection } from "./EditorSection";

type Login = NonNullable<ItemDraft["login"]>;

type Props = {
	draft: ItemDraft;
	setDraft: Dispatch<SetStateAction<ItemDraft>>;
	item: VaultItem | null;
};

/** Match type options: the "default" value stands for null (account default, base domain) */
const matchOptions: { value: string; label: string; match: UriMatchType | null }[] = [
	{ value: "default", label: "Default", match: null },
	{ value: String(UriMatchType.Domain), label: "Base domain", match: UriMatchType.Domain },
	{ value: String(UriMatchType.Host), label: "Host", match: UriMatchType.Host },
	{ value: String(UriMatchType.StartsWith), label: "Starts with", match: UriMatchType.StartsWith },
	{ value: String(UriMatchType.Exact), label: "Exact", match: UriMatchType.Exact },
	{ value: String(UriMatchType.RegularExpression), label: "Regular expression", match: UriMatchType.RegularExpression },
	{ value: String(UriMatchType.Never), label: "Never", match: UriMatchType.Never },
];

/**
 * Login values: username, password and TOTP secrets (write-only), websites
 */
export function LoginFields({ draft, setDraft, item }: Readonly<Props>) {
	const actions = useVaultActions();
	const login: Login = draft.login ?? { username: null, uris: [] };

	const patch = (changes: Partial<Login>) => setDraft((current) => ({ ...current, login: { ...(current.login ?? { username: null, uris: [] }), ...changes } }));
	const setUris = (uris: DraftUri[]) => patch({ uris });

	const totpError = login.totp?.kind === "set" && !isValidTotp(login.totp.value) ? "Not a valid TOTP secret" : null;

	return (
		<EditorSection title="Login">
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				<TextField label="Username" size="small" fullWidth autoComplete="off" value={login.username ?? ""} onChange={(event) => patch({ username: event.target.value })} />
				<SecretInput
					label="Password"
					value={login.password}
					onChange={(password) => patch({ password })}
					stored={item?.login?.hasPassword ?? false}
					reveal={item ? () => actions.reveal(item.id, { kind: "password" }) : undefined}
					generate
				/>
				<SecretInput
					label="TOTP secret"
					value={login.totp}
					onChange={(totp: SecretChange | undefined) => patch({ totp })}
					stored={item?.login?.hasTotp ?? false}
					error={totpError}
					helperText="Base32 secret, otpauth://totp uri or steam:// secret"
				/>
			</Box>

			<Typography variant="overline" component="div" sx={{ color: "var(--text-faint)", mt: 3, mb: 1 }}>
				Websites
			</Typography>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				{login.uris.map((uri, index) => (
					<Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
						<TextField
							size="small"
							placeholder="https://"
							aria-label={`Website ${index + 1}`}
							value={uri.uri}
							onChange={(event) => setUris(login.uris.map((current, i) => (i === index ? { ...current, uri: event.target.value } : current)))}
							sx={{ flex: "1 1 260px", minWidth: 0 }}
						/>
						<TextField
							select
							size="small"
							aria-label="Match type"
							value={uri.match === null ? "default" : String(uri.match)}
							onChange={(event) => {
								const option = matchOptions.find((candidate) => candidate.value === event.target.value);
								setUris(login.uris.map((current, i) => (i === index ? { ...current, match: option?.match ?? null } : current)));
							}}
							sx={{ width: 170 }}
						>
							{matchOptions.map((option) => (
								<MenuItem key={option.value} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>
						<Tooltip title="Move up">
							<span>
								<IconButton size="small" disabled={index === 0} onClick={() => setUris(move(login.uris, index, index - 1))}>
									<KeyboardArrowUpRounded />
								</IconButton>
							</span>
						</Tooltip>
						<Tooltip title="Move down">
							<span>
								<IconButton size="small" disabled={index === login.uris.length - 1} onClick={() => setUris(move(login.uris, index, index + 1))}>
									<KeyboardArrowDownRounded />
								</IconButton>
							</span>
						</Tooltip>
						<Tooltip title="Remove">
							<IconButton size="small" onClick={() => setUris(login.uris.filter((_, i) => i !== index))}>
								<DeleteOutlineRounded />
							</IconButton>
						</Tooltip>
					</Box>
				))}
				<Box>
					<Button size="small" startIcon={<AddRounded />} onClick={() => setUris([...login.uris, { uri: "", match: null }])}>
						Add website
					</Button>
				</Box>
			</Box>
		</EditorSection>
	);
}

/** Copy of the list with the item at `from` moved to `to` */
function move<T>(list: T[], from: number, to: number): T[] {
	const next = [...list];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}
