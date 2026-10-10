import { type RefObject, useEffect, useRef } from "react";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import LockPersonRounded from "@mui/icons-material/LockPersonRounded";
import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import { useAppDispatch, useAppSelector } from "@store";
import { selectVisibleItems } from "@modules/vault/vault.selectors";
import { selectItem, setQuery } from "@modules/vault/vault.reducer";
import { getItemSubtitle } from "@modules/vault/vault.search";
import type { VaultItem } from "@shared/types/vault.types";
import { ItemIcon } from "./ItemIcon";
import { Kbd } from "@components/shared/Kbd";
import { useFilterLabel } from "./useFilterLabel";
import { usePrimaryCopy } from "./usePrimaryCopy";

export function ItemList({ searchRef }: Readonly<{ searchRef: RefObject<HTMLInputElement | null> }>) {
	const dispatch = useAppDispatch();
	const items = useAppSelector(selectVisibleItems);
	const query = useAppSelector((state) => state.vault.query);
	const selectedId = useAppSelector((state) => state.vault.selectedId);
	const filterLabel = useFilterLabel();
	const copyPrimary = usePrimaryCopy();
	const listRef = useRef<HTMLDivElement>(null);

	// Keep a visible selection: the first result when searching
	useEffect(() => {
		if (items.length > 0 && !items.some((item) => item.id === selectedId)) {
			dispatch(selectItem(items[0].id));
		}
	}, [items, selectedId, dispatch]);

	useEffect(() => {
		listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId ?? "")}"]`)?.scrollIntoView({ block: "nearest" });
	}, [selectedId]);

	const move = (delta: number) => {
		if (items.length === 0) return;
		const index = items.findIndex((item) => item.id === selectedId);
		const next = Math.min(Math.max(index + delta, 0), items.length - 1);
		dispatch(selectItem(items[next].id));
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			move(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			move(-1);
		} else if (event.key === "Enter") {
			const item = items.find((i) => i.id === selectedId);
			if (item) {
				event.preventDefault();
				void copyPrimary(item);
			}
		} else if (event.key === "Escape" && query) {
			event.preventDefault();
			dispatch(setQuery(""));
		}
	};

	return (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "var(--surface-1)", borderRight: "1px solid var(--border-subtle)", minWidth: 0 }}>
			<Box sx={{ p: 1.5, pb: 1 }}>
				<TextField
					inputRef={searchRef}
					fullWidth
					size="small"
					placeholder={`Search ${filterLabel.toLowerCase()}`}
					value={query}
					onChange={(event) => dispatch(setQuery(event.target.value))}
					onKeyDown={onKeyDown}
					slotProps={{
						input: {
							sx: { bgcolor: "var(--surface-0)", fontSize: "0.85rem" },
							startAdornment: (
								<InputAdornment position="start">
									<SearchRounded sx={{ fontSize: 18, color: "var(--text-faint)" }} />
								</InputAdornment>
							),
							endAdornment: !query && (
								<InputAdornment position="end" sx={{ gap: 0.5 }}>
									<Kbd>Ctrl</Kbd>
									<Kbd>F</Kbd>
								</InputAdornment>
							),
						},
					}}
				/>
				<Typography sx={{ mt: 1.25, px: 0.5, fontSize: "0.72rem", color: "var(--text-faint)" }}>
					{filterLabel} · {items.length} item{items.length > 1 ? "s" : ""}
				</Typography>
			</Box>

			<Box ref={listRef} tabIndex={0} onKeyDown={onKeyDown} sx={{ flex: 1, overflow: "auto", px: 1, pb: 1, outline: "none" }}>
				{items.length === 0 ? (
					<Box sx={{ textAlign: "center", color: "var(--text-faint)", mt: 8 }}>
						<SearchOffRounded sx={{ fontSize: 36, mb: 1 }} />
						<Typography variant="body2">{query ? `No results for "${query}"` : "No items"}</Typography>
					</Box>
				) : (
					items.map((item) => (
						<ItemRow
							key={item.id}
							item={item}
							selected={item.id === selectedId}
							onSelect={() => dispatch(selectItem(item.id))}
							onActivate={() => void copyPrimary(item)}
						/>
					))
				)}
			</Box>
		</Box>
	);
}

type RowProps = { item: VaultItem; selected: boolean; onSelect: () => void; onActivate: () => void };

function ItemRow({ item, selected, onSelect, onActivate }: Readonly<RowProps>) {
	const subtitle = getItemSubtitle(item);

	return (
		<Box
			data-id={item.id}
			onClick={onSelect}
			onDoubleClick={onActivate}
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1.25,
				px: 1,
				py: 0.875,
				mb: 0.25,
				borderRadius: 2,
				cursor: "default",
				bgcolor: selected ? "var(--surface-3)" : "transparent",
				boxShadow: selected ? "inset 0 0 0 1px var(--border-medium)" : "none",
				contentVisibility: "auto",
				containIntrinsicSize: "auto 52px",
				"&:hover": { bgcolor: selected ? "var(--surface-3)" : "var(--surface-2)" },
			}}
		>
			<ItemIcon item={item} />
			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					<Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: 500 }}>
						{item.name}
					</Typography>
					{item.favorite && <StarRounded sx={{ fontSize: 13, color: "warning.main" }} />}
					{item.reprompt && <LockPersonRounded sx={{ fontSize: 13, color: "var(--text-faint)" }} />}
				</Box>
				{subtitle && (
					<Typography noWrap sx={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
						{subtitle}
					</Typography>
				)}
			</Box>
		</Box>
	);
}
