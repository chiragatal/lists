<script lang="ts">
	import type { Item, Tier } from './db';
	import { Dices, Pencil, X } from './icons';

	type Props = {
		open: boolean;
		pool: Item[];
		tier: Tier;
		onClose: () => void;
		onEdit: (item: Item) => void;
	};

	let { open, pool, tier, onClose, onEdit }: Props = $props();

	let pick = $state<Item | null>(null);
	let rolling = $state(false);
	let rollCount = $state(0);

	$effect(() => {
		if (open) {
			rollCount = 0;
			doPick();
		} else {
			pick = null;
		}
	});

	function doPick() {
		if (pool.length === 0) {
			pick = null;
			return;
		}
		rolling = true;
		const final = pool[Math.floor(Math.random() * pool.length)];
		// brief spin: flash through a handful of random items before settling
		let i = 0;
		const interval = setInterval(() => {
			pick = pool[Math.floor(Math.random() * pool.length)];
			i++;
			if (i >= 6) {
				clearInterval(interval);
				pick = final;
				rolling = false;
				rollCount++;
			}
		}, 70);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="pick-title"
			data-tier={tier}
		>
			<header class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-3.5">
				<div class="flex items-center gap-2">
					<Dices size={15} strokeWidth={1.5} class="text-[var(--tier-color)]" />
					<p
						id="pick-title"
						class="font-mono text-[10px] tracking-[0.22em] text-[var(--tier-color)] uppercase"
					>
						Pick one for me
					</p>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close"
				>
					<X size={16} strokeWidth={1.5} />
				</button>
			</header>

			<div class="px-6 py-8 text-center">
				{#if pick}
					<p
						class="mb-1 font-mono text-[10px] tracking-[0.22em] text-[var(--color-faint)] uppercase"
					>
						{pick.category || 'Uncategorized'}
					</p>
					<p
						class="font-display text-3xl leading-tight text-[var(--color-text-bright)]"
						class:opacity-50={rolling}
						style="transition: opacity 80ms;"
					>
						{pick.name}
					</p>
					{#if pick.tags.length}
						<div class="mt-3 flex flex-wrap justify-center gap-1">
							{#each pick.tags as t}
								<span
									class="rounded-full border border-[var(--color-hairline)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted)]"
								>
									{t}
								</span>
							{/each}
						</div>
					{/if}
					{#if pick.notes}
						<p class="mt-4 line-clamp-3 text-left text-[13px] leading-relaxed text-[var(--color-muted)]">
							{pick.notes}
						</p>
					{/if}
					<p
						class="mt-5 font-mono text-[9px] tracking-[0.22em] text-[var(--color-faint)] uppercase"
					>
						from {pool.length} {pool.length === 1 ? 'item' : 'items'} · roll {rollCount}
					</p>
				{:else}
					<p class="py-10 text-sm text-[var(--color-muted)]">
						Nothing to pick from. Add items or relax your filters.
					</p>
				{/if}
			</div>

			<footer class="grid grid-cols-2 gap-1.5 border-t border-[var(--color-hairline)] bg-[var(--color-paper-2)] p-3">
				<button
					type="button"
					onclick={doPick}
					disabled={pool.length === 0 || rolling}
					class="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-hairline)] px-3 py-2 font-mono text-[11px] tracking-[0.16em] text-[var(--color-muted)] uppercase transition-colors hover:border-[var(--color-hairline-strong)] hover:text-[var(--color-text)] disabled:opacity-40"
				>
					<Dices size={13} strokeWidth={1.5} />
					Pick again
				</button>
				<button
					type="button"
					onclick={() => {
						if (pick) onEdit(pick);
					}}
					disabled={!pick}
					class="flex items-center justify-center gap-1.5 rounded-md bg-[var(--tier-color)] px-3 py-2 font-mono text-[11px] tracking-[0.16em] text-[var(--color-ink-deep)] uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
				>
					<Pencil size={13} strokeWidth={1.75} />
					Open
				</button>
			</footer>
		</div>
	</div>
{/if}
