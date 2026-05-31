<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		lists,
		type List,
		type ListType,
		type PlanCounts,
		type ChecklistCounts
	} from '$lib/lists.svelte';
	import { backup } from '$lib/backup.svelte';
	import { ui } from '$lib/ui.svelte';
	import { Menu, Plus, Crosshair, ListChecks, X } from '$lib/icons';

	$effect(() => {
		lists.loadIndex();
		lists.loadUser();
	});

	const loading = $derived(!lists.indexLoaded);

	let creating = $state(false);
	let newType = $state<ListType>('plan');
	let newName = $state('');
	let busy = $state(false);
	let nameInput = $state<HTMLInputElement | null>(null);

	function startCreate() {
		creating = true;
		newName = '';
		queueMicrotask(() => nameInput?.focus());
	}
	async function confirmCreate() {
		const n = newName.trim();
		if (!n || busy) return;
		busy = true;
		try {
			const id = await lists.createList(newType, n);
			creating = false;
			await goto(`/lists/${id}`);
		} finally {
			busy = false;
		}
	}

	function planPct(l: List) {
		const c = l.counts as PlanCounts;
		if (c.total === 0) return 0;
		return Math.round((c.active / c.total) * 100);
	}
	function checklistPct(l: List) {
		const c = l.counts as ChecklistCounts;
		if (c.total === 0) return 0;
		return Math.round(((c.done + c.skipped) / c.total) * 100);
	}
</script>

<svelte:head>
	<title>Lists</title>
</svelte:head>

<div class="page tier-active">
	<div class="mx-auto max-w-xl px-5 pt-5 pb-12">
		<header class="mb-5">
			<div class="mb-4 flex items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2.5">
					<button
						type="button"
						onclick={() => ui.openMenu()}
						class="icon-btn relative shrink-0"
						aria-label="Menu"
						title={backup.stale ? 'Menu — backup overdue' : 'Menu'}
					>
						<Menu size={16} strokeWidth={1.5} />
						{#if backup.stale && lists.all.length > 0}
							<span class="backup-dot" aria-hidden="true"></span>
						{/if}
					</button>
					<span
						class="truncate font-mono text-[10px] tracking-[0.24em] text-[var(--tier-color)] uppercase"
					>
						Lists
					</span>
				</div>
				<button type="button" onclick={startCreate} class="add-btn" aria-label="New list">
					<Plus size={15} strokeWidth={2} />
					<span>New</span>
				</button>
			</div>
			<h1 class="font-display text-5xl leading-[0.95] text-[var(--color-text-bright)]">Lists</h1>
			<p class="mt-2 max-w-xs text-[13px] leading-snug text-[var(--color-muted)]">
				Plans funnel things you might do; checklists tick through and reset.
			</p>
		</header>

		{#if creating}
			<div
				class="mb-4 rounded-xl border border-[var(--tier-color)] bg-[var(--color-paper)] p-3.5"
			>
				<div class="mb-3 grid grid-cols-2 gap-1.5">
					<button
						type="button"
						onclick={() => (newType = 'plan')}
						class="type-tile"
						class:selected={newType === 'plan'}
						data-type="plan"
					>
						<Crosshair size={15} strokeWidth={1.5} />
						<span class="type-label">Plan</span>
						<span class="type-hint">Library → Shortlist → Active funnel</span>
					</button>
					<button
						type="button"
						onclick={() => (newType = 'checklist')}
						class="type-tile"
						class:selected={newType === 'checklist'}
						data-type="checklist"
					>
						<ListChecks size={15} strokeWidth={1.5} />
						<span class="type-label">Checklist</span>
						<span class="type-hint">Tick through, then reset</span>
					</button>
				</div>
				<div class="flex items-center gap-2">
					<input
						bind:this={nameInput}
						type="text"
						bind:value={newName}
						placeholder={newType === 'plan' ? 'Plan name…' : 'Checklist name…'}
						onkeydown={(e) => {
							if (e.key === 'Enter') confirmCreate();
							else if (e.key === 'Escape') (creating = false);
						}}
						class="flex-1 bg-transparent text-sm text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)]"
					/>
					<button
						type="button"
						onclick={confirmCreate}
						disabled={!newName.trim() || busy}
						class="rounded-md bg-[var(--tier-color)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-deep)] uppercase disabled:opacity-40"
					>
						Create
					</button>
					<button
						type="button"
						onclick={() => (creating = false)}
						class="rounded-md p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
						aria-label="Cancel"
					>
						<X size={15} strokeWidth={1.5} />
					</button>
				</div>
			</div>
		{/if}

		{#if loading}
			<ul class="space-y-2">
				{#each Array(2) as _, i}
					<li class="skeleton-card" style="--d: {i * 90}ms"></li>
				{/each}
			</ul>
		{:else}
			<ul class="space-y-2">
				{#each lists.all as l (l.id)}
					<li>
						<a href="/lists/{l.id}" class="card block rounded-xl border px-4 py-3.5">
							<div class="flex items-baseline justify-between gap-3">
								<p class="flex min-w-0 items-center gap-2">
									<span
										class="type-chip shrink-0 font-mono text-[8px] tracking-[0.18em] uppercase"
										data-type={l.type}
									>
										{l.type === 'plan' ? 'Plan' : 'Checklist'}
									</span>
									<span class="truncate font-display text-lg text-[var(--color-text-bright)]">{l.name}</span>
									{#if l.shared}
										<span
											class="shrink-0 rounded-full border border-[var(--color-hairline-strong)] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.14em] text-[var(--color-muted)] uppercase"
											title={l.ownerEmail ? `Shared by ${l.ownerEmail}` : 'Shared with you'}
										>
											Shared · {l.role}
										</span>
									{/if}
								</p>
								<span class="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
									{#if l.type === 'plan'}
										{(l.counts as PlanCounts).active} active
									{:else}
										{(l.counts as ChecklistCounts).done + (l.counts as ChecklistCounts).skipped}/{(l.counts as ChecklistCounts).total}
									{/if}
								</span>
							</div>
							<div class="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
								<div
									class="h-full rounded-full transition-all"
									class:bg-[var(--color-emerald)]={true}
									style="width: {l.type === 'plan' ? planPct(l) : checklistPct(l)}%; background: var(--tier-color);"
								></div>
							</div>
							{#if l.type === 'plan'}
								{@const c = l.counts as PlanCounts}
								<div
									class="mt-2 flex items-center gap-3 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
								>
									<span class="text-[var(--color-emerald)]">{c.active} active</span>
									<span class="text-[var(--color-amber)]">{c.shortlist} shortlist</span>
									<span class="ml-auto">{c.library} in library</span>
								</div>
							{:else}
								{@const c = l.counts as ChecklistCounts}
								<div
									class="mt-2 flex items-center gap-3 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
								>
									<span class="text-[var(--color-emerald)]">{c.done} done</span>
									<span class="text-[var(--color-slate)]">{c.skipped} skipped</span>
									<span class="ml-auto">{c.pending} pending</span>
								</div>
							{/if}
						</a>
					</li>
				{/each}
				{#if lists.all.length === 0}
					<li
						class="rounded-2xl border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-paper)]/40 px-6 py-12 text-center"
					>
						<p class="mx-auto max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
							Nothing here yet. Create a plan to funnel things you might do, or a checklist to tick through.
						</p>
						<button
							type="button"
							onclick={startCreate}
							class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-color)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--tier-color)] uppercase"
						>
							<Plus size={12} strokeWidth={2} /> New list
						</button>
					</li>
				{/if}
			</ul>
		{/if}
	</div>
</div>

<style>
	.page {
		position: relative;
		min-height: 100dvh;
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
		transition: color 200ms, border-color 200ms;
	}
	.icon-btn:hover {
		color: var(--color-text);
		border-color: var(--color-hairline-strong);
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
		transition: transform 120ms;
	}
	.add-btn:active {
		transform: scale(0.96);
	}
	.card {
		background: var(--color-paper);
		border-color: var(--color-hairline);
		transition: border-color 160ms;
	}
	.card:hover {
		border-color: var(--color-hairline-strong);
	}
	.type-chip {
		padding: 1px 7px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline-strong);
		color: var(--color-muted);
	}
	.type-chip[data-type='plan'] {
		color: var(--color-emerald);
		border-color: color-mix(in oklab, var(--color-emerald) 40%, var(--color-hairline-strong));
	}
	.type-chip[data-type='checklist'] {
		color: var(--color-amber);
		border-color: color-mix(in oklab, var(--color-amber) 40%, var(--color-hairline-strong));
	}
	.type-tile {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 11px 12px 9px;
		border-radius: 0.625rem;
		border: 1px solid var(--color-hairline);
		background: var(--color-paper-2);
		color: var(--color-muted);
		text-align: left;
		transition: border-color 200ms, color 200ms, background 200ms;
	}
	.type-tile:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.type-label {
		font-family: var(--font-display);
		font-variation-settings: 'wght' 600;
		font-size: 13px;
		color: var(--color-text-bright);
	}
	.type-hint {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-faint);
	}
	.type-tile.selected[data-type='plan'] {
		border-color: var(--color-emerald);
		background: color-mix(in oklab, var(--color-emerald) 10%, var(--color-paper-2));
	}
	.type-tile.selected[data-type='checklist'] {
		border-color: var(--color-amber);
		background: color-mix(in oklab, var(--color-amber) 10%, var(--color-paper-2));
	}
	.skeleton-card {
		height: 84px;
		border-radius: 0.75rem;
		border: 1px solid var(--color-hairline);
		background: linear-gradient(
			100deg,
			var(--color-paper) 0%,
			var(--color-paper-2) 50%,
			var(--color-paper) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
		animation-delay: var(--d, 0ms);
	}
	@keyframes shimmer {
		0%, 100% { background-position: 200% 0; }
		50% { background-position: 0 0; }
	}
</style>
