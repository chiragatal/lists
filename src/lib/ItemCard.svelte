<script lang="ts">
	import type { Item, Tier } from './db';
	import { setItemTier, tierOf } from './store.svelte';
	import { Bookmark, Check, Crosshair, GripVertical, StickyNote } from './icons';

	type Props = {
		item: Item;
		tier: Tier;
		onEdit: (item: Item) => void;
		onTagTap: (tag: string) => void;
		selectedTags: string[];
	};

	let { item, tier, onEdit, onTagTap, selectedTags }: Props = $props();

	const current = $derived(tierOf(item));

	function stop(e: Event) {
		e.stopPropagation();
	}

	function go(next: Tier) {
		return (e: MouseEvent) => {
			stop(e);
			setItemTier(item.id!, next);
		};
	}
</script>

<article
	class="card group relative grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors"
	data-tier={current}
>
	<div class="flex flex-col items-center gap-2 pt-0.5">
		{#if tier !== 'active'}
			<span
				class="drag-handle flex h-6 w-6 cursor-grab items-center justify-center text-[var(--color-faint)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
				aria-hidden="true"
				title="Drag to reorder"
			>
				<GripVertical size={14} strokeWidth={1.5} />
			</span>
		{:else}
			<span class="block h-6 w-6"></span>
		{/if}
	</div>

	<div class="min-w-0">
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => onEdit(item)}
				class="block min-w-0 truncate text-left font-serif text-[17px] leading-snug text-[var(--color-text-bright)] hover:text-[var(--tier-color, var(--color-text-bright))]"
			>
				{item.name}
			</button>
			{#if item.notes}
				<span
					class="note-mark shrink-0 text-[var(--color-faint)]"
					title="Has notes"
					aria-label="Has notes"
				>
					<StickyNote size={11} strokeWidth={1.5} />
				</span>
			{/if}
			{#if tier === 'library' && current !== 'library'}
				<span
					class="state-badge font-mono text-[8px] tracking-[0.18em] uppercase"
					data-state={current}
				>
					{current === 'active' ? '● Active' : '● Shortlist'}
				</span>
			{/if}
		</div>
		{#if item.tags.length}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each item.tags as t}
					{@const selected = selectedTags.includes(t)}
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							onTagTap(t);
						}}
						class="tag-chip"
						class:tag-selected={selected}
					>
						{t}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="flex shrink-0 items-center gap-1 pl-1">
		{#if tier === 'active'}
			<button
				type="button"
				onclick={go('shortlist')}
				class="action-btn"
				title="Move to Shortlist"
				aria-label="Move to Shortlist"
			>
				<Bookmark size={15} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={go('library')}
				class="action-btn"
				title="Done — back to Library"
				aria-label="Mark done"
			>
				<Check size={15} strokeWidth={1.75} />
			</button>
		{:else if tier === 'shortlist'}
			<button
				type="button"
				onclick={go('active')}
				class="action-btn"
				title="Move to Active"
				aria-label="Move to Active"
			>
				<Crosshair size={15} strokeWidth={1.5} />
			</button>
			<button
				type="button"
				onclick={go('library')}
				class="action-btn"
				title="Done — back to Library"
				aria-label="Mark done"
			>
				<Check size={15} strokeWidth={1.75} />
			</button>
		{:else}
			<button
				type="button"
				onclick={go(current === 'shortlist' ? 'library' : 'shortlist')}
				class="action-btn"
				class:on={current === 'shortlist'}
				title={current === 'shortlist' ? 'Remove from Shortlist' : 'Move to Shortlist'}
				aria-label="Toggle shortlist"
			>
				<Bookmark
					size={15}
					strokeWidth={1.5}
					fill={current === 'shortlist' ? 'var(--color-amber)' : 'none'}
				/>
			</button>
			<button
				type="button"
				onclick={go(current === 'active' ? 'library' : 'active')}
				class="action-btn"
				class:on-active={current === 'active'}
				title={current === 'active' ? 'Remove from Active' : 'Move to Active'}
				aria-label="Toggle active"
			>
				<Crosshair size={15} strokeWidth={1.5} />
			</button>
		{/if}
	</div>
</article>

<style>
	.card {
		background: var(--color-paper);
		border-color: var(--color-hairline);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02) inset;
	}
	.card:hover {
		border-color: var(--color-hairline-strong);
	}

	/* When library shows item already in active/shortlist, hint left edge color */
	.card[data-tier='active'] {
		box-shadow:
			inset 2px 0 0 var(--color-emerald),
			0 1px 0 rgba(255, 255, 255, 0.02) inset;
	}
	.card[data-tier='shortlist'] {
		box-shadow:
			inset 2px 0 0 var(--color-amber),
			0 1px 0 rgba(255, 255, 255, 0.02) inset;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 0.5rem;
		color: var(--color-faint);
		transition: color 200ms, background 200ms;
	}
	.action-btn:hover {
		color: var(--color-text-bright);
		background: var(--color-paper-2);
	}
	.action-btn.on {
		color: var(--color-amber);
	}
	.action-btn.on-active {
		color: var(--color-emerald);
	}

	.tag-chip {
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.4;
		letter-spacing: 0.04em;
		padding: 1px 6px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline);
		color: var(--color-muted);
		background: transparent;
		transition: border-color 200ms, color 200ms, background 200ms;
	}
	.tag-chip:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.tag-selected {
		border-color: var(--tier-color, var(--color-emerald)) !important;
		color: var(--tier-color, var(--color-emerald)) !important;
		background: color-mix(in oklab, var(--tier-color, var(--color-emerald)) 14%, transparent);
	}

	.state-badge {
		padding: 1px 6px;
		border-radius: 9999px;
		border: 1px solid currentColor;
		flex-shrink: 0;
	}
	.state-badge[data-state='active'] {
		color: var(--color-emerald);
	}
	.state-badge[data-state='shortlist'] {
		color: var(--color-amber);
	}
</style>
