<script lang="ts">
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import type { Item, Tier } from './db';
	import { goto } from '$app/navigation';
	import { itemsByTier, lists, reorderItems, clearActive } from './store.svelte';
	import { plans } from './plans.svelte';
	import { tierMeta, tierColorClass } from './tier';
	import {
		Plus,
		Search,
		X,
		LayoutList,
		Tag,
		Dices,
		History,
		Menu,
		Bookmark,
		Library,
		MoreHorizontal,
		Pencil,
		Trash2,
		Check
	} from './icons';
	import { ui } from './ui.svelte';
	import ItemEditor from './ItemEditor.svelte';
	import ItemCard from './ItemCard.svelte';
	import CategoryChips from './CategoryChips.svelte';
	import TagFilter from './TagFilter.svelte';
	import PickModal from './PickModal.svelte';
	import HistorySheet from './HistorySheet.svelte';

	type TagMatchMode = 'all' | 'any';

	type Props = { tier: Tier; planId: number };
	let { tier, planId }: Props = $props();

	const meta = $derived(tierMeta(tier));
	const tierClass = $derived(tierColorClass(tier));

	$effect(() => {
		lists.ensurePlan(planId);
	});

	const items = $derived(itemsByTier(tier));
	const totalCount = $derived(lists.items.length);
	const isLoading = $derived(!lists.isLoaded || lists.currentPlanId !== planId);

	let query = $state('');
	let categoryFilter = $state('');
	let selectedTags = $state<string[]>([]);
	let tagMatchMode = $state<TagMatchMode>('all');
	let groupingMode = $state<'category-tag' | 'category' | 'none'>('category-tag');
	let editorOpen = $state(false);
	let editing = $state<Item | null>(null);
	let tagFilterOpen = $state(false);
	let pickOpen = $state(false);
	let historyOpen = $state(false);
	let searchFocused = $state(false);
	let menuOpen = $state(false);
	let renaming = $state(false);
	let renameValue = $state('');

	function startRename() {
		menuOpen = false;
		renameValue = lists.currentPlanName;
		renaming = true;
	}
	async function confirmRename() {
		const n = renameValue.trim();
		renaming = false;
		if (!n || n === lists.currentPlanName) return;
		await plans.renamePlan(planId, n);
		lists.currentPlanName = n;
	}
	async function handleClearActive() {
		menuOpen = false;
		if (!confirm('Clear everything from Active back to Library?')) return;
		await clearActive();
	}
	async function handleDeletePlan() {
		menuOpen = false;
		if (!confirm(`Delete the plan "${lists.currentPlanName}"? This removes all its items.`)) return;
		await plans.deletePlan(planId);
		await goto('/');
	}


	function tagHits(it: Item): number {
		if (!selectedTags.length) return 0;
		let n = 0;
		for (const t of selectedTags) if (it.tags.includes(t)) n++;
		return n;
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const matched = items.filter((it) => {
			if (q) {
				if (
					!it.name.toLowerCase().includes(q) &&
					!it.category.toLowerCase().includes(q) &&
					!it.tags.some((t) => t.toLowerCase().includes(q)) &&
					!(it.notes ?? '').toLowerCase().includes(q)
				)
					return false;
			}
			if (categoryFilter && it.category !== categoryFilter) return false;
			if (selectedTags.length) {
				if (tagMatchMode === 'all') {
					if (!selectedTags.every((t) => it.tags.includes(t))) return false;
				} else {
					if (!selectedTags.some((t) => it.tags.includes(t))) return false;
				}
			}
			return true;
		});

		// When matching "any" with multiple tags, items with more hits rank first
		if (tagMatchMode === 'any' && selectedTags.length > 1) {
			return [...matched].sort((a, b) => tagHits(b) - tagHits(a));
		}
		return matched;
	});

	const tagCounts = $derived.by(() => {
		const map = new Map<string, number>();
		for (const it of items) for (const t of it.tags) map.set(t, (map.get(t) ?? 0) + 1);
		return [...map.entries()]
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	});

	type Subgroup = { tag: string | null; items: Item[] };
	type Group = { category: string; items: Item[]; subgroups: Subgroup[] };

	const groups = $derived.by<Group[]>(() => {
		if (groupingMode === 'none') {
			return [{ category: '', items: filtered, subgroups: [{ tag: null, items: filtered }] }];
		}

		const byCategory = new Map<string, Item[]>();
		for (const it of filtered) {
			const k = it.category || '—';
			if (!byCategory.has(k)) byCategory.set(k, []);
			byCategory.get(k)!.push(it);
		}

		const ranking = tagMatchMode === 'any' && selectedTags.length > 1;

		return [...byCategory.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, list]) => {
				const ordered = ranking ? [...list].sort((a, b) => tagHits(b) - tagHits(a)) : list;
				return {
					category,
					items: ordered,
					subgroups:
						groupingMode === 'category-tag'
							? subgroupByCommonTag(ordered)
							: [{ tag: null, items: ordered }]
				};
			});
	});

	function subgroupByCommonTag(list: Item[]): Subgroup[] {
		const tagFreq = new Map<string, number>();
		for (const it of list) for (const t of it.tags) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);

		const sharedTags = [...tagFreq.entries()]
			.filter(([, n]) => n >= 2)
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([t]) => t);

		if (sharedTags.length === 0) return [{ tag: null, items: list }];

		const buckets = new Map<string, Item[]>();
		const other: Item[] = [];

		for (const it of list) {
			const candidate = sharedTags.find((t) => it.tags.includes(t));
			if (candidate) {
				if (!buckets.has(candidate)) buckets.set(candidate, []);
				buckets.get(candidate)!.push(it);
			} else {
				other.push(it);
			}
		}

		const subgroups: Subgroup[] = [];
		for (const tag of sharedTags) {
			const arr = buckets.get(tag);
			if (arr?.length) subgroups.push({ tag, items: arr });
		}
		if (other.length) subgroups.push({ tag: null, items: other });
		return subgroups;
	}

	function onTagTap(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	function clearAllFilters() {
		query = '';
		categoryFilter = '';
		selectedTags = [];
	}

	const hasFilters = $derived(!!query || !!categoryFilter || selectedTags.length > 0);

	function openNew() {
		editing = null;
		editorOpen = true;
	}
	function openEdit(item: Item) {
		editing = item;
		editorOpen = true;
	}

	let dndList = $state<Item[]>([]);
	$effect(() => {
		dndList = filtered;
	});
	const dragDisabled = $derived(groupingMode !== 'none' || hasFilters || tier === 'active');

	function handleDndConsider(e: CustomEvent<DndEvent<Item>>) {
		dndList = e.detail.items;
	}
	async function handleDndFinalize(e: CustomEvent<DndEvent<Item>>) {
		dndList = e.detail.items;
		await reorderItems(dndList.map((it) => it.id!));
	}

	function cycleGrouping() {
		groupingMode =
			groupingMode === 'category-tag'
				? 'category'
				: groupingMode === 'category'
					? 'none'
					: 'category-tag';
	}

	const groupingLabel = $derived(
		groupingMode === 'category-tag'
			? 'Category + tags'
			: groupingMode === 'category'
				? 'Category'
				: 'Flat'
	);
</script>

<div class="page {tierClass}">
	<div class="mx-auto max-w-xl px-5 pt-5 pb-24">
		<!-- Tier title -->
		<header class="mb-5">
			<!-- Top utility bar -->
			<div class="mb-4 flex items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2.5">
					<button
						type="button"
						onclick={() => ui.openMenu()}
						class="icon-btn shrink-0"
						aria-label="Menu"
					>
						<Menu size={16} strokeWidth={1.5} />
					</button>
					{#if renaming}
						<input
							type="text"
							bind:value={renameValue}
							onkeydown={(e) => {
								if (e.key === 'Enter') confirmRename();
								else if (e.key === 'Escape') (renaming = false);
							}}
							onblur={confirmRename}
							class="min-w-0 flex-1 border-b border-[var(--tier-color)] bg-transparent text-sm font-medium text-[var(--color-text-bright)] outline-none"
						/>
					{:else}
						<span class="truncate text-sm font-medium text-[var(--color-text-bright)]">
							{lists.currentPlanName || 'Plan'}
						</span>
					{/if}
				</div>
				<div class="flex shrink-0 items-center gap-1.5">
					<button type="button" onclick={openNew} class="add-btn" aria-label="Add new item">
						<Plus size={15} strokeWidth={2} />
						<span class="add-label">Add</span>
					</button>
					<div class="relative">
						<button
							type="button"
							onclick={() => (menuOpen = !menuOpen)}
							class="icon-btn"
							aria-label="Plan menu"
							title="Plan menu"
						>
							<MoreHorizontal size={16} strokeWidth={1.5} />
						</button>
						{#if menuOpen}
							<button
								type="button"
								class="fixed inset-0 z-20 cursor-default"
								onclick={() => (menuOpen = false)}
								aria-label="Close menu"
								tabindex="-1"
							></button>
							<div
								class="menu absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-lg border border-[var(--color-hairline-strong)] bg-[var(--color-paper-2)] shadow-xl"
							>
								<button type="button" class="menu-item" onclick={startRename}>
									<Pencil size={14} strokeWidth={1.5} /> Rename
								</button>
								<button
									type="button"
									class="menu-item"
									onclick={() => {
										menuOpen = false;
										historyOpen = true;
									}}
								>
									<History size={14} strokeWidth={1.5} /> History
								</button>
								<button type="button" class="menu-item" onclick={handleClearActive}>
									<Check size={14} strokeWidth={1.75} /> Clear active
								</button>
								<div class="h-px bg-[var(--color-hairline)]"></div>
								<button type="button" class="menu-item danger" onclick={handleDeletePlan}>
									<Trash2 size={14} strokeWidth={1.5} /> Delete plan
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="min-w-0">
				<h1 class="font-display text-5xl leading-[0.95] text-[var(--color-text-bright)]">
					{meta.label}
				</h1>
				<p class="mt-2 max-w-xs text-[13px] leading-snug text-[var(--color-muted)]">
					{meta.subtitle}
				</p>
			</div>

			<!-- Counts ruler -->
			<div
				class="mt-5 flex items-baseline gap-2 font-mono text-[11px] tabular-nums"
			>
				{#if isLoading}
					<span class="text-[var(--color-faint)]">—</span>
				{:else}
					<span class="text-[var(--tier-color)]">{filtered.length}</span>
					<span class="text-[var(--color-faint)]">/</span>
					<span class="text-[var(--color-muted)]">{items.length}</span>
					<span class="text-[var(--color-faint)]">
						{items.length === 1 ? 'item' : 'items'}
					</span>
				{/if}
				{#if hasFilters}
					<button
						type="button"
						onclick={clearAllFilters}
						class="ml-auto font-mono text-[10px] tracking-wide text-[var(--color-muted)] uppercase hover:text-[var(--color-text)]"
					>
						Reset filters
					</button>
				{/if}
			</div>
			<div
				class="mt-2 h-px bg-gradient-to-r from-[var(--tier-color)]/40 via-[var(--color-hairline-strong)] to-transparent"
			></div>
		</header>

		<!-- Toolbar -->
		<div class="mb-3 flex items-center gap-2">
			<div
				class="search-wrap flex flex-1 items-center gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper)] px-2.5 py-1.5 transition-colors"
				class:search-focus={searchFocused}
			>
				<Search size={14} strokeWidth={1.5} class="text-[var(--color-faint)]" />
				<input
					type="search"
					bind:value={query}
					onfocus={() => (searchFocused = true)}
					onblur={() => (searchFocused = false)}
					placeholder="Search…"
					class="w-full bg-transparent text-sm text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)]"
				/>
				{#if query}
					<button
						type="button"
						onclick={() => (query = '')}
						class="text-[var(--color-faint)] hover:text-[var(--color-text)]"
						aria-label="Clear search"
					>
						<X size={13} strokeWidth={1.5} />
					</button>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (tagFilterOpen = true)}
				class="icon-btn relative"
				aria-label="Tag filters"
				title="Tag filters"
			>
				<Tag size={15} strokeWidth={1.5} />
				{#if selectedTags.length}
					<span class="tag-count">
						{selectedTags.length}
					</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={cycleGrouping}
				class="icon-btn"
				aria-label="Cycle grouping"
				title={`Grouping: ${groupingLabel}`}
			>
				<LayoutList size={15} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={() => (pickOpen = true)}
				disabled={filtered.length === 0}
				class="icon-btn"
				aria-label="Pick one for me"
				title="Pick one for me"
			>
				<Dices size={15} strokeWidth={1.5} />
			</button>
		</div>

		<!-- Quick category filters -->
		<div class="mb-3">
			{#if isLoading}
				<div class="-mx-5 overflow-hidden px-5">
					<ul class="flex w-max items-center gap-1.5 pb-0.5">
						{#each [56, 92, 78, 64, 102] as w, i}
							<li class="skeleton-chip" style="width: {w}px; --d: {i * 60}ms"></li>
						{/each}
					</ul>
				</div>
			{:else}
				<CategoryChips
					items={items}
					selected={categoryFilter}
					onSelect={(c) => (categoryFilter = c)}
				/>
			{/if}
		</div>

		<!-- Selected tag pills -->
		{#if selectedTags.length > 0}
			<div class="mb-3 flex flex-wrap items-center gap-1.5" transition:fade={{ duration: 120 }}>
				<button
					type="button"
					onclick={() => (tagFilterOpen = true)}
					class="font-mono text-[10px] tracking-[0.16em] text-[var(--color-faint)] uppercase hover:text-[var(--color-text)]"
				>
					Tags ·
					<span class="text-[var(--tier-color)]">{tagMatchMode}</span>
				</button>
				{#each selectedTags as t}
					<button
						type="button"
						onclick={() => onTagTap(t)}
						class="inline-flex items-center gap-1 rounded-full border border-[var(--tier-color)] bg-[color-mix(in_oklab,var(--tier-color)_14%,transparent)] px-2 py-0.5 font-mono text-[10px] text-[var(--tier-color)]"
					>
						{t}
						<X size={10} strokeWidth={1.5} />
					</button>
				{/each}
			</div>
		{/if}

		<!-- Group label / dragging note -->
		<div
			class="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
		>
			<span>Grouped · {groupingLabel}</span>
			{#if !dragDisabled && filtered.length > 1}
				<span class="text-[var(--color-faint)]">Drag · to reorder</span>
			{/if}
		</div>

		{#if isLoading}
			<div class="space-y-7" aria-busy="true" aria-label="Loading items">
				{#each [{ w: 70, n: 2 }, { w: 56, n: 1 }] as group, gi}
					<section>
						<div class="mb-3 flex items-baseline gap-3">
							<div
								class="skeleton-line"
								style="width: {group.w}px; --d: {gi * 120}ms"
							></div>
							<div class="skeleton-line" style="width: 14px"></div>
							<div class="h-px flex-1 bg-[var(--color-hairline)]"></div>
						</div>
						<ul class="space-y-1.5">
							{#each Array(group.n) as _, i}
								<li
									class="skeleton-card"
									style="--d: {(gi * 2 + i) * 80 + 100}ms"
								></li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{:else if items.length === 0}
			{@const showFunnelHop = totalCount > 0 && tier !== 'library'}
			<div
				class="rounded-2xl border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-paper)]/40 px-6 py-12 text-center"
			>
				<p class="font-mono text-[10px] tracking-[0.22em] text-[var(--tier-color)] uppercase">
					Nothing here yet
				</p>
				<p class="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
					{#if showFunnelHop && tier === 'active'}
						Promote items from your Shortlist to commit to doing them now.
					{:else if showFunnelHop && tier === 'shortlist'}
						Pick items from your Library to set them aside as candidates.
					{:else}
						{meta.emptyHint}
					{/if}
				</p>
				{#if showFunnelHop && tier === 'active'}
					<a
						href="/shortlist"
						class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-amber)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--color-amber)] uppercase transition-colors hover:bg-[color-mix(in_oklab,var(--color-amber)_15%,transparent)]"
					>
						<Bookmark size={12} strokeWidth={1.75} /> Go to Shortlist
					</a>
				{:else if showFunnelHop && tier === 'shortlist'}
					<a
						href="/library"
						class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-slate)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--color-slate-bright)] uppercase transition-colors hover:bg-[color-mix(in_oklab,var(--color-slate)_15%,transparent)]"
					>
						<Library size={12} strokeWidth={1.75} /> Go to Library
					</a>
				{:else}
					<button
						type="button"
						onclick={openNew}
						class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-color)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--tier-color)] uppercase transition-colors hover:bg-[color-mix(in_oklab,var(--tier-color)_15%,transparent)]"
					>
						<Plus size={12} strokeWidth={2} /> Add first
					</button>
				{/if}
			</div>
		{:else if filtered.length === 0}
			<div
				class="rounded-xl border border-dashed border-[var(--color-hairline)] px-6 py-10 text-center text-sm text-[var(--color-muted)]"
			>
				No items match your filters.
				<button
					type="button"
					onclick={clearAllFilters}
					class="mt-2 block w-full text-center font-mono text-[10px] tracking-[0.18em] text-[var(--tier-color)] uppercase hover:underline"
				>
					Reset
				</button>
			</div>
		{:else if dragDisabled}
			<!-- Grouped (no drag) -->
			<div class="space-y-7">
				{#each groups as g}
					<section>
						{#if g.category && groupingMode !== 'none'}
							<div class="mb-3 flex items-baseline gap-3">
								<h2
									class="font-mono text-[10px] tracking-[0.22em] text-[var(--color-muted)] uppercase"
								>
									{g.category}
								</h2>
								<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
									{g.items.length}
								</span>
								<div class="h-px flex-1 bg-[var(--color-hairline)]"></div>
							</div>
						{/if}
						<div class="space-y-3">
							{#each g.subgroups as sub}
								{#if sub.tag}
									<div class="border-l border-[var(--tier-color)]/40 pl-3">
										<p
											class="mb-2 font-mono text-[9px] tracking-[0.22em] text-[var(--color-faint)] uppercase"
										>
											#{sub.tag}
										</p>
										<ul class="space-y-1.5">
											{#each sub.items as it (it.id)}
												<li>
													<ItemCard
														item={it}
														tier={tier}
														onEdit={openEdit}
														onTagTap={onTagTap}
														selectedTags={selectedTags}
													/>
												</li>
											{/each}
										</ul>
									</div>
								{:else}
									<ul class="space-y-1.5">
										{#each sub.items as it (it.id)}
											<li>
												<ItemCard
													item={it}
													tier={tier}
													onEdit={openEdit}
													onTagTap={onTagTap}
													selectedTags={selectedTags}
												/>
											</li>
										{/each}
									</ul>
								{/if}
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{:else}
			<!-- Flat (drag-to-reorder) -->
			<ul
				class="space-y-1.5"
				use:dndzone={{
					items: dndList,
					flipDurationMs: 220,
					dropTargetStyle: {},
					dragDisabled: false,
					morphDisabled: true,
					type: `tier-${tier}`,
					dropTargetClasses: ['dnd-drop-target']
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each dndList as it (it.id)}
					<li animate:flip={{ duration: 220 }}>
						<ItemCard
							item={it}
							tier={tier}
							onEdit={openEdit}
							onTagTap={onTagTap}
							selectedTags={selectedTags}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<ItemEditor
	open={editorOpen}
	item={editing}
	defaultTier={tier}
	onClose={() => (editorOpen = false)}
/>

<TagFilter
	open={tagFilterOpen}
	allTags={tagCounts}
	selected={selectedTags}
	mode={tagMatchMode}
	onChange={(next) => (selectedTags = next)}
	onModeChange={(m) => (tagMatchMode = m)}
	onClose={() => (tagFilterOpen = false)}
/>

<PickModal
	open={pickOpen}
	pool={filtered}
	tier={tier}
	onClose={() => (pickOpen = false)}
	onEdit={(it) => {
		pickOpen = false;
		openEdit(it);
	}}
/>

<HistorySheet
	open={historyOpen}
	onClose={() => (historyOpen = false)}
	onOpenItem={(it) => {
		historyOpen = false;
		openEdit(it);
	}}
/>

<style>
	.page {
		position: relative;
		min-height: 100dvh;
	}

	.menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		font-size: 13px;
		color: var(--color-text);
		background: transparent;
		transition: background 140ms;
	}
	.menu-item:hover {
		background: var(--color-paper-3);
	}
	.menu-item.danger {
		color: var(--color-danger);
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 0.5rem;
		border: 1px solid var(--color-hairline);
		background: var(--color-paper);
		color: var(--color-muted);
		transition: color 200ms, border-color 200ms, background 200ms;
	}
	.icon-btn:hover {
		color: var(--color-text);
		border-color: var(--color-hairline-strong);
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px 0 10px;
		border-radius: 0.5rem;
		background: var(--tier-color);
		color: var(--color-ink-deep);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-variation-settings: 'wght' 600;
		transition: background 200ms, transform 120ms;
	}
	.add-btn:hover {
		background: var(--tier-color-bright);
	}
	.add-btn:active {
		transform: scale(0.96);
	}
	.add-label {
		display: inline;
	}

	.tag-count {
		position: absolute;
		top: -3px;
		right: -3px;
		display: grid;
		place-items: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 9999px;
		background: var(--tier-color);
		color: var(--color-ink-deep);
		font-family: var(--font-mono);
		font-size: 9px;
		font-variation-settings: 'wght' 600;
		box-shadow: 0 0 0 2px var(--color-ink);
	}

	.search-wrap.search-focus {
		border-color: var(--tier-color);
	}

	.backup-dot {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: var(--color-amber);
		box-shadow: 0 0 0 2px var(--color-paper);
	}

	:global(.dnd-drop-target) {
		outline: 1px dashed var(--color-hairline-strong);
		outline-offset: 2px;
		border-radius: 0.75rem;
	}

	.skeleton-card,
	.skeleton-chip,
	.skeleton-line {
		background:
			linear-gradient(
				100deg,
				var(--color-paper) 0%,
				var(--color-paper-2) 50%,
				var(--color-paper) 100%
			);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
		animation-delay: var(--d, 0ms);
	}

	.skeleton-card {
		height: 56px;
		border-radius: 0.75rem;
		border: 1px solid var(--color-hairline);
	}

	.skeleton-chip {
		height: 26px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline);
		list-style: none;
	}

	.skeleton-line {
		height: 10px;
		border-radius: 4px;
	}

	@keyframes shimmer {
		0%,
		100% {
			background-position: 200% 0;
		}
		50% {
			background-position: 0 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-card,
		.skeleton-chip,
		.skeleton-line {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
