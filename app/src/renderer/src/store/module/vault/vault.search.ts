import { CipherType, type VaultItem } from "@shared/types/vault.types";

export type VaultFilter =
	| { kind: "all" }
	| { kind: "favorites" }
	| { kind: "type"; type: CipherType }
	/** id null: items without folder */
	| { kind: "folder"; id: string | null }
	| { kind: "organization"; id: string }
	| { kind: "collection"; id: string };

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function normalize(value: string) {
	return value
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

export function matchesFilter(item: VaultItem, filter: VaultFilter) {
	switch (filter.kind) {
		case "all":
			return true;
		case "favorites":
			return item.favorite;
		case "type":
			return item.type === filter.type;
		case "folder":
			return item.folderId === filter.id;
		case "organization":
			return item.organizationId === filter.id;
		case "collection":
			return item.collectionIds.includes(filter.id);
	}
}

/**
 * Secondary line of an item in lists
 */
export function getItemSubtitle(item: VaultItem): string {
	switch (item.type) {
		case CipherType.Login:
			return item.login?.username || item.login?.uris[0]?.host || "";
		case CipherType.Card: {
			const last4 = item.card?.numberLast4 ? `•••• ${item.card.numberLast4}` : "";
			return [item.card?.brand, last4].filter(Boolean).join(" ");
		}
		case CipherType.Identity:
			return [item.identity?.firstName, item.identity?.lastName].filter(Boolean).join(" ") || item.identity?.email || "";
		case CipherType.SecureNote:
			return item.notes?.split("\n")[0] ?? "";
		case CipherType.SshKey:
			return item.sshKey?.keyFingerprint ?? "";
		default:
			return "";
	}
}

function searchableText(item: VaultItem) {
	return normalize(
		[
			item.login?.username,
			...(item.login?.uris.map((u) => u.uri) ?? []),
			item.card?.brand,
			item.card?.cardholderName,
			item.identity?.firstName,
			item.identity?.lastName,
			item.identity?.email,
			item.identity?.company,
			item.notes,
			...item.fields.map((f) => `${f.name} ${f.value ?? ""}`),
		]
			.filter(Boolean)
			.join(" ")
	);
}

/**
 * Relevance of an item for a query (0: no match). Every word of the query must match.
 */
export function scoreItem(item: VaultItem, query: string): number {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return 1;

	const name = normalize(item.name);
	let text: string | null = null;
	let score = 0;

	for (const word of words) {
		if (name.startsWith(word)) score += 100;
		else if (name.split(/[\s\-_.]+/).some((part) => part.startsWith(word))) score += 60;
		else if (name.includes(word)) score += 40;
		else if ((text ??= searchableText(item)).includes(word)) score += 10;
		else return 0;
	}

	return score + (item.favorite ? 5 : 0);
}

/**
 * Items of the filter matching the query: by relevance when searching, by name otherwise
 */
export function searchItems(items: VaultItem[], filter: VaultFilter, query: string): VaultItem[] {
	const filtered = items.filter((item) => matchesFilter(item, filter));

	if (!query.trim()) {
		return filtered.toSorted((a, b) => collator.compare(a.name, b.name));
	}

	return filtered
		.map((item) => ({ item, score: scoreItem(item, query) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || collator.compare(a.item.name, b.item.name))
		.map(({ item }) => item);
}
