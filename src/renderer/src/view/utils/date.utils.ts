const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const dateTime = new Intl.DateTimeFormat("fr", { dateStyle: "long", timeStyle: "short" });

export function formatRelative(iso: string) {
	const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
	const abs = Math.abs(seconds);
	if (abs < 60) return relative.format(seconds, "second");
	if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
	if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
	return relative.format(Math.round(seconds / 86400), "day");
}

export function formatDateTime(iso: string) {
	return dateTime.format(new Date(iso));
}
