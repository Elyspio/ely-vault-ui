import { useEffect, useState } from "react";
import { Avatar, type SxProps, type Theme } from "@mui/material";

/** Gravatar of the signed-in account, with its initial as the offline / missing-image fallback. */
export function AccountAvatar({ email, size = 28, sx }: Readonly<{ email?: string | null; size?: number; sx?: SxProps<Theme> }>) {
	const normalizedEmail = email?.trim().toLowerCase() ?? "";
	const [loaded, setLoaded] = useState<{ email: string; url: string } | null>(null);

	useEffect(() => {
		if (!normalizedEmail) return;
		let active = true;
		void crypto.subtle
			.digest("SHA-256", new TextEncoder().encode(normalizedEmail))
			.then((digest) => {
				const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
				if (active) setLoaded({ email: normalizedEmail, url: `https://www.gravatar.com/avatar/${hash}?s=${size * 2}&d=404&r=g` });
			})
			.catch(() => {
				// Keep the initial if hashing is unavailable.
			});
		return () => {
			active = false;
		};
	}, [normalizedEmail, size]);

	return (
		<Avatar
			key={normalizedEmail}
			src={loaded?.email === normalizedEmail ? loaded.url : undefined}
			slotProps={{ img: { referrerPolicy: "no-referrer", alt: "" } }}
			sx={[{ width: size, height: size, fontSize: "0.8rem", fontWeight: 600, bgcolor: "var(--accent-soft)", color: "primary.main" }, ...(Array.isArray(sx) ? sx : [sx])]}
		>
			{normalizedEmail[0]?.toUpperCase()}
		</Avatar>
	);
}
