<script lang="ts">
	import { lists, type Item } from './lists.svelte';
	import { History, X } from './icons';

	type Props = {
		open: boolean;
		onClose: () => void;
		onOpenItem: (item: Item) => void;
	};

	let { open, onClose, onOpenItem }: Props = $props();

	type Event = { item: Item; ts: number };

	let rangeDays = $state<number | null>(null); // null = all-time
	let selectedTags = $state<string[]>([]);

	const allEvents = $derived.by<Event[]>(() => {
		const events: Event[] = [];
		for (const item of lists.items) {
			for (const ts of item.completedAt ?? []) {
				events.push({ item, ts });
			}
		}
		events.sort((a, b) => b.ts - a.ts);
		return events;
	});

	// Available tags = union of tags across items that have any completion.
	// Stays stable as range filter changes so chips don't dance around.
	const tagCounts = $derived.by(() => {
		const map = new Map<string, number>();
		for (const e of allEvents) {
			for (const t of e.item.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
		}
		return [...map.entries()]
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	});

	const cutoff = $derived(rangeDays ? Date.now() - rangeDays * 86_400_000 : 0);

	const filtered = $derived.by(() => {
		return allEvents.filter((e) => {
			if (rangeDays && e.ts < cutoff) return false;
			if (selectedTags.length && !selectedTags.some((t) => (e.item.tags ?? []).includes(t))) return false;
			return true;
		});
	});

	const ranges: { label: string; days: number | null }[] = [
		{ label: 'All', days: null },
		{ label: '7d', days: 7 },
		{ label: '30d', days: 30 },
		{ label: '90d', days: 90 }
	];

	function toggleTag(t: string) {
		selectedTags = selectedTags.includes(t)
			? selectedTags.filter((x) => x !== t)
			: [...selectedTags, t];
	}

	function clearAllFilters() {
		rangeDays = null;
		selectedTags = [];
	}

	function formatEvent(ts: number): { rel: string; abs: string } {
		const diff = Date.now() - ts;
		let rel: string;
		if (diff < 60_000) rel = 'just now';
		else if (diff < 3_600_000) rel = `${Math.floor(diff / 60_000)}m ago`;
		else if (diff < 86_400_000) rel = `${Math.floor(diff / 3_600_000)}h ago`;
		else if (diff < 7 * 86_400_000) rel = `${Math.floor(diff / 86_400_000)}d ago`;
		else if (diff < 60 * 86_400_000)
			rel = `${Math.floor(diff / (7 * 86_400_000))}w ago`;
		else rel = `${Math.floor(diff / (30 * 86_400_000))}mo ago`;

		const d = new Date(ts);
		const abs = d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: diff > 365 * 86_400_000 ? 'numeric' : undefined,
			hour: 'numeric',
			minute: '2-digit'
		});
		return { rel, abs };
	}

	const hasFilters = $derived(rangeDays !== null || selectedTags.length > 0);
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.6)] sm:rounded-2xl"
			style="max-height: 88dvh;"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="History"
		>
			<header
				class="flex shrink-0 items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div class="flex items-center gap-2">
					<History size={15} strokeWidth={1.5} class="text-[var(--color-text-bright)]" />
					<div>
						<p class="font-display-soft text-lg leading-none">History</p>
						<p
							class="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
						>
							{filtered.length} of {allEvents.length}
							{allEvents.length === 1 ? 'event' : 'events'}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close"
				>
					<X size={18} strokeWidth={1.5} />
				</button>
			</header>

			<div class="shrink-0 space-y-3 border-b border-[var(--color-hairline)] px-5 py-3">
				<!-- Range chips -->
				<div>
					<div class="mb-1.5 flex items-baseline justify-between">
						<span
							class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Range
						</span>
						{#if hasFilters}
							<button
								type="button"
								onclick={clearAllFilters}
								class="font-mono text-[10px] tracking-wide text-[var(--color-muted)] uppercase hover:text-[var(--color-text)]"
							>
								Reset
							</button>
						{/if}
					</div>
					<div class="flex gap-1">
						{#each ranges as r}
							<button
								type="button"
								onclick={() => (rangeDays = r.days)}
								class="range-chip"
								class:active={rangeDays === r.days}
							>
								{r.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Tag chips (any-match) -->
				{#if tagCounts.length > 0}
					<div>
						<div class="mb-1.5 flex items-baseline justify-between">
							<span
								class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
							>
								Tags
							</span>
							<span class="font-mono text-[10px] text-[var(--color-faint)]">any match</span>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each tagCounts as { tag, count }}
								{@const on = selectedTags.includes(tag)}
								<button
									type="button"
									onclick={() => toggleTag(tag)}
									class="tag-chip"
									class:active={on}
								>
									<span>{tag}</span>
									<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
										{count}
									</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
				{#if allEvents.length === 0}
					<div class="px-6 py-12 text-center">
						<p
							class="font-mono text-[10px] tracking-[0.22em] text-[var(--color-faint)] uppercase"
						>
							Nothing completed yet
						</p>
						<p class="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
							When you mark items as done from Active or Shortlist, they'll show up here.
						</p>
					</div>
				{:else if filtered.length === 0}
					<div class="px-6 py-10 text-center text-sm text-[var(--color-muted)]">
						No events match these filters.
						<button
							type="button"
							onclick={clearAllFilters}
							class="mt-2 block w-full text-center font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-bright)] uppercase hover:underline"
						>
							Reset
						</button>
					</div>
				{:else}
					<ul>
						{#each filtered as e, i (e.item.id + ':' + e.ts)}
							{@const f = formatEvent(e.ts)}
							<li>
								<button
									type="button"
									onclick={() => onOpenItem(e.item)}
									class="event-row"
									class:divider={i > 0}
								>
									<div class="min-w-0 flex-1">
										<div class="flex items-baseline gap-2">
											<p class="truncate font-serif text-[15px] text-[var(--color-text-bright)]">
												{e.item.name}
											</p>
											{#if e.item.category}
												<span
													class="shrink-0 font-mono text-[9px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
												>
													{e.item.category}
												</span>
											{/if}
										</div>
										{#if e.item.tags?.length}
											<div class="mt-1 flex flex-wrap gap-1">
												{#each e.item.tags as t}
													<span
														class="rounded-full border border-[var(--color-hairline)] px-1.5 py-px font-mono text-[9px] text-[var(--color-muted)]"
														class:tag-active={selectedTags.includes(t)}
													>
														{t}
													</span>
												{/each}
											</div>
										{/if}
									</div>
									<div class="shrink-0 text-right">
										<p class="text-xs text-[var(--color-text)]">{f.rel}</p>
										<p class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
											{f.abs}
										</p>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.range-chip {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-hairline);
		background: transparent;
		color: var(--color-muted);
		transition: color 200ms, border-color 200ms, background 200ms;
	}
	.range-chip:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.range-chip.active {
		border-color: var(--color-text-bright);
		background: color-mix(in oklab, var(--color-text-bright) 8%, transparent);
		color: var(--color-text-bright);
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 10px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline);
		background: transparent;
		color: var(--color-muted);
		font-size: 11px;
		transition: color 200ms, border-color 200ms, background 200ms;
	}
	.tag-chip:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.tag-chip.active {
		border-color: var(--color-text-bright);
		background: color-mix(in oklab, var(--color-text-bright) 10%, transparent);
		color: var(--color-text-bright);
	}

	.event-row {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		width: 100%;
		padding: 12px 20px;
		text-align: left;
		background: transparent;
		transition: background 160ms;
	}
	.event-row:hover {
		background: var(--color-paper-2);
	}
	.divider {
		border-top: 1px solid var(--color-hairline);
	}

	.tag-active {
		border-color: var(--color-text-bright) !important;
		color: var(--color-text-bright) !important;
	}
</style>
