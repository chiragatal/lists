<script lang="ts">
	import type { Item } from './lists.svelte';

	type Props = {
		items: Item[];
		selected: string;
		onSelect: (category: string) => void;
		max?: number;
	};

	let { items, selected, onSelect, max = 6 }: Props = $props();

	const counts = $derived.by(() => {
		const map = new Map<string, number>();
		for (const it of items) {
			if (!it.category) continue;
			map.set(it.category, (map.get(it.category) ?? 0) + 1);
		}
		return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	});

	const top = $derived(counts.slice(0, max));
	const hasMore = $derived(counts.length > max);
</script>

{#if top.length > 0}
	<div class="-mx-5 overflow-x-auto px-5 scrollbar-hide">
		<ul class="flex w-max items-center gap-1.5 pb-0.5">
			<li>
				<button
					type="button"
					onclick={() => onSelect('')}
					class="group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors"
					class:active={selected === ''}
					aria-pressed={selected === ''}
				>
					<span>All</span>
					<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
						{items.length}
					</span>
				</button>
			</li>
			{#each top as [cat, count]}
				<li>
					<button
						type="button"
						onclick={() => onSelect(selected === cat ? '' : cat)}
						class="group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors"
						class:active={selected === cat}
						aria-pressed={selected === cat}
					>
						<span>{cat}</span>
						<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
							{count}
						</span>
					</button>
				</li>
			{/each}
			{#if hasMore}
				<li class="px-1 text-[10px] font-mono text-[var(--color-faint)]">
					+{counts.length - max}
				</li>
			{/if}
		</ul>
	</div>
{/if}

<style>
	button {
		border-color: var(--color-hairline);
		color: var(--color-muted);
		background: transparent;
	}
	button:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	button.active {
		border-color: var(--tier-color, var(--color-emerald));
		background: color-mix(in oklab, var(--tier-color, var(--color-emerald)) 12%, transparent);
		color: var(--color-text-bright);
	}
	button.active :global(span:last-child) {
		color: var(--tier-color, var(--color-emerald));
	}
</style>
