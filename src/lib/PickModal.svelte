<script lang="ts">
	import { lists, type Item, type Tier } from './lists.svelte';
	import { tierColorClass } from './tier';
	import { Bookmark, Check, Crosshair, Dices, Pencil, X } from './icons';

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

	async function moveTo(next: Tier) {
		if (!pick?.id) return;
		const listId = lists.current?.id;
		if (listId == null) return;
		await lists.setTier(listId, pick.id, next);
		pick = { ...pick, tier: next };
	}

	const pickCurrent = $derived(pick?.tier ?? 'library');
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)] {tierColorClass(
				tier
			)}"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="pick-title"
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
					{#if pick.tags?.length}
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

					<!-- Move actions, parallel to ItemCard logic -->
					<div class="mt-5 flex items-center justify-center gap-1.5">
						{#if tier === 'active'}
							<button
								type="button"
								onclick={() => moveTo('shortlist')}
								class="move-btn"
								title="Move to Shortlist"
								aria-label="Move to Shortlist"
							>
								<Bookmark size={14} strokeWidth={1.5} />
								<span>Shortlist</span>
							</button>
							<button
								type="button"
								onclick={() => moveTo('library')}
								class="move-btn"
								title="Done — back to Library"
								aria-label="Mark done"
							>
								<Check size={14} strokeWidth={1.75} />
								<span>Done</span>
							</button>
						{:else if tier === 'shortlist'}
							<button
								type="button"
								onclick={() => moveTo('active')}
								class="move-btn"
								title="Move to Active"
								aria-label="Move to Active"
							>
								<Crosshair size={14} strokeWidth={1.5} />
								<span>Active</span>
							</button>
							<button
								type="button"
								onclick={() => moveTo('library')}
								class="move-btn"
								title="Done — back to Library"
								aria-label="Mark done"
							>
								<Check size={14} strokeWidth={1.75} />
								<span>Done</span>
							</button>
						{:else}
							<button
								type="button"
								onclick={() => moveTo(pickCurrent === 'shortlist' ? 'library' : 'shortlist')}
								class="move-btn"
								class:on-shortlist={pickCurrent === 'shortlist'}
								title={pickCurrent === 'shortlist' ? 'Remove from Shortlist' : 'Move to Shortlist'}
								aria-label="Toggle shortlist"
							>
								<Bookmark
									size={14}
									strokeWidth={1.5}
									fill={pickCurrent === 'shortlist' ? 'var(--color-amber)' : 'none'}
								/>
								<span>Shortlist</span>
							</button>
							<button
								type="button"
								onclick={() => moveTo(pickCurrent === 'active' ? 'library' : 'active')}
								class="move-btn"
								class:on-active={pickCurrent === 'active'}
								title={pickCurrent === 'active' ? 'Remove from Active' : 'Move to Active'}
								aria-label="Toggle active"
							>
								<Crosshair size={14} strokeWidth={1.5} />
								<span>Active</span>
							</button>
						{/if}
					</div>

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

			<footer
				class="grid grid-cols-2 gap-1.5 border-t border-[var(--color-hairline)] bg-[var(--color-paper-2)] p-3"
			>
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

<style>
	.move-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline);
		background: var(--color-paper-2);
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		transition: color 200ms, border-color 200ms, background 200ms;
	}
	.move-btn:hover {
		color: var(--color-text-bright);
		border-color: var(--color-hairline-strong);
	}
	.move-btn.on-shortlist {
		border-color: var(--color-amber);
		color: var(--color-amber);
		background: color-mix(in oklab, var(--color-amber) 10%, var(--color-paper-2));
	}
	.move-btn.on-active {
		border-color: var(--color-emerald);
		color: var(--color-emerald);
		background: color-mix(in oklab, var(--color-emerald) 10%, var(--color-paper-2));
	}
</style>
