import { useEffect, useState } from "react";
import { Avatar } from "@mui/material";

/** Gravatar of the signed-in account, with its initial as the offline / missing-image fallback. */
export function AccountAvatar({ email }: Readonly<{ email?: string | null }>) {
	const normalizedEmail = email?.trim().toLowerCase() ?? "";
	const [loaded, setLoaded] = useState<{ email: string; url: string } | null>(null);

	useEffect(() => {
		if (!normalizedEmail) return;
		let active = true;
		void crypto.subtle
			.digest("SHA-256", new TextEncoder().encode(normalizedEmail))
			.then((digest) => {
				const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
				if (active) setLoaded({ email: normalizedEmail, url: `https://www.gravatar.com/avatar/${hash}?s=56&d=404&r=g` });
			})
			.catch(() => {
				// Keep the initial if hashing is unavailable.
			});
		return () => {
			active = false;
		};
	}, [normalizedEmail]);

	return (
		<Avatar
			key={normalizedEmail}
			src={loaded?.email === normalizedEmail ? loaded.url : undefined}
			slotProps={{ img: { referrerPolicy: "no-referrer", alt: "" } }}
			sx={{ width: 28, height: 28, fontSize: "0.8rem", fontWeight: 600, bgcolor: "var(--accent-soft)", color: "primary.main" }}
		>
			{normalizedEmail[0]?.toUpperCase()}
		</Avatar>
	);
}
