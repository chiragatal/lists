<script lang="ts">
	import type { Item, Tier } from './db';
	import { itemsByTier, setTierFlag, checkOffActive, clearActive } from './store.svelte';
	import ItemEditor from './ItemEditor.svelte';

	type Props = {
		tier: Tier;
		title: string;
		emptyHint: string;
	};

	let { tier, title, emptyHint }: Props = $props();

	let items = $state<Item[]>([]);
	let query = $state('');
	let categoryFilter = $state('');
	let tagFilter = $state('');
	let groupByCategory = $state(true);
	let editorOpen = $state(false);
	let editing = $state<Item | null>(null);

	$effect(() => {
		const sub = itemsByTier(tier).subscribe((rows) => (items = rows));
		return () => sub.unsubscribe();
	});

	const filtered = $derived(
		items.filter((it) => {
			if (query) {
				const q = query.toLowerCase();
				if (
					!it.name.toLowerCase().includes(q) &&
					!it.category.toLowerCase().includes(q) &&
					!it.tags.some((t) => t.toLowerCase().includes(q))
				)
					return false;
			}
			if (categoryFilter && it.category !== categoryFilter) return false;
			if (tagFilter && !it.tags.includes(tagFilter)) return false;
			return true;
		})
	);

	const allCategories = $derived(
		Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort()
	);
	const allTags = $derived(Array.from(new Set(items.flatMap((i) => i.tags))).sort());

	const grouped = $derived.by(() => {
		if (!groupByCategory) return [{ category: '', items: filtered }];
		const map = new Map<string, Item[]>();
		for (const it of filtered) {
			if (!map.has(it.category)) map.set(it.category, []);
			map.get(it.category)!.push(it);
		}
		return Array.from(map.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, items]) => ({ category, items }));
	});

	function openNew() {
		editing = null;
		editorOpen = true;
	}

	function openEdit(item: Item) {
		editing = item;
		editorOpen = true;
	}

	async function handleClearActive() {
		if (confirm('Clear all items from Active?')) await clearActive();
	}
</script>

<div class="mx-auto max-w-xl px-4 pt-6">
	<header class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{title}</h1>
			<p class="text-xs text-[var(--color-muted)]">
				{filtered.length} of {items.length}
				{items.length === 1 ? 'item' : 'items'}
			</p>
		</div>
		<div class="flex gap-2">
			{#if tier === 'active' && items.length > 0}
				<button
					onclick={handleClearActive}
					class="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Clear active"
				>
					Clear
				</button>
			{/if}
			<button
				onclick={openNew}
				class="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-slate-900"
			>
				+ Add
			</button>
		</div>
	</header>

	<div class="mb-4 flex flex-col gap-2">
		<input
			type="search"
			bind:value={query}
			placeholder="Search…"
			class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
		/>
		<div class="flex flex-wrap gap-2">
			<select
				bind:value={categoryFilter}
				class="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
			>
				<option value="">All categories</option>
				{#each allCategories as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			<select
				bind:value={tagFilter}
				class="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
			>
				<option value="">All tags</option>
				{#each allTags as t}
					<option value={t}>{t}</option>
				{/each}
			</select>
			<label class="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
				<input type="checkbox" bind:checked={groupByCategory} />
				Group
			</label>
		</div>
	</div>

	{#if items.length === 0}
		<div
			class="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-muted)]"
		>
			<p class="mb-2 text-3xl">📝</p>
			<p>{emptyHint}</p>
		</div>
	{:else if filtered.length === 0}
		<div class="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
			No items match your filters.
		</div>
	{:else}
		{#each grouped as group}
			{#if group.category}
				<h2 class="mt-4 mb-2 text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
					{group.category}
				</h2>
			{/if}
			<ul class="flex flex-col gap-2">
				{#each group.items as it (it.id)}
					<li
						class="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
					>
						{#if tier === 'active'}
							<button
								onclick={() => checkOffActive(it.id!)}
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-border)] text-xs hover:border-[var(--color-accent)]"
								aria-label="Mark done for this week"
								title="Mark done"
							></button>
						{/if}
						<button
							onclick={() => openEdit(it)}
							class="flex-1 text-left"
						>
							<div class="font-medium">{it.name}</div>
							{#if it.tags.length}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each it.tags as t}
										<span
											class="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
										>
											{t}
										</span>
									{/each}
								</div>
							{/if}
						</button>
						<div class="flex shrink-0 gap-1">
							<button
								onclick={() => setTierFlag(it.id!, 'shortlist', it.inShortlist !== 1)}
								class="rounded-md px-2 py-1 text-base leading-none transition-opacity"
								class:opacity-100={it.inShortlist === 1}
								class:opacity-30={it.inShortlist !== 1}
								title={it.inShortlist === 1 ? 'Remove from Shortlist' : 'Add to Shortlist'}
								aria-label="Toggle shortlist"
							>
								⭐
							</button>
							<button
								onclick={() => setTierFlag(it.id!, 'active', it.inActive !== 1)}
								class="rounded-md px-2 py-1 text-base leading-none transition-opacity"
								class:opacity-100={it.inActive === 1}
								class:opacity-30={it.inActive !== 1}
								title={it.inActive === 1 ? 'Remove from Active' : 'Add to Active'}
								aria-label="Toggle active"
							>
								🎯
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</div>

<ItemEditor
	open={editorOpen}
	item={editing}
	defaultTier={tier}
	onClose={() => (editorOpen = false)}
/>
