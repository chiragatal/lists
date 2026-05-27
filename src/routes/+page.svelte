<script lang="ts">
	import { goto } from '$app/navigation';
	import { plans } from '$lib/plans.svelte';
	import { lists } from '$lib/store.svelte';
	import { backup } from '$lib/backup.svelte';
	import { ui } from '$lib/ui.svelte';
	import { Menu, Plus, Crosshair, X } from '$lib/icons';

	$effect(() => {
		plans.loadIndex();
		lists.loadUser();
	});

	const loading = $derived(!plans.loaded);

	let creating = $state(false);
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
			const id = await plans.createPlan(n);
			creating = false;
			await goto(`/plans/${id}`);
		} finally {
			busy = false;
		}
	}

	function pct(p: { counts: { active: number; total: number } }) {
		if (p.counts.total === 0) return 0;
		return Math.round((p.counts.active / p.counts.total) * 100);
	}
</script>

<svelte:head>
	<title>Plans · Lists</title>
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
						{#if backup.stale && plans.all.length > 0}
							<span class="backup-dot" aria-hidden="true"></span>
						{/if}
					</button>
					<span
						class="truncate font-mono text-[10px] tracking-[0.24em] text-[var(--tier-color)] uppercase"
					>
						Plans
					</span>
				</div>
				<button type="button" onclick={startCreate} class="add-btn" aria-label="New plan">
					<Plus size={15} strokeWidth={2} />
					<span>New</span>
				</button>
			</div>
			<h1 class="font-display text-5xl leading-[0.95] text-[var(--color-text-bright)]">Plans</h1>
			<p class="mt-2 max-w-xs text-[13px] leading-snug text-[var(--color-muted)]">
				Each plan is its own Library → Shortlist → Active funnel.
			</p>
		</header>

		{#if creating}
			<div
				class="mb-4 flex items-center gap-2 rounded-xl border border-[var(--tier-color)] bg-[var(--color-paper)] px-3.5 py-3"
			>
				<Crosshair size={16} strokeWidth={1.5} class="text-[var(--tier-color)]" />
				<input
					bind:this={nameInput}
					type="text"
					bind:value={newName}
					placeholder="Plan name…"
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
		{/if}

		{#if loading}
			<ul class="space-y-2">
				{#each Array(2) as _, i}
					<li class="skeleton-card" style="--d: {i * 90}ms"></li>
				{/each}
			</ul>
		{:else}
			<ul class="space-y-2">
				{#each plans.all as p (p.id)}
					<li>
						<a href="/plans/{p.id}" class="card block rounded-xl border px-4 py-3.5">
							<div class="flex items-baseline justify-between gap-3">
								<p class="flex min-w-0 items-center gap-2">
									<span class="truncate font-display text-lg text-[var(--color-text-bright)]">{p.name}</span>
									{#if p.shared}
										<span
											class="shrink-0 rounded-full border border-[var(--color-hairline-strong)] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.14em] text-[var(--color-muted)] uppercase"
											title={p.ownerEmail ? `Shared by ${p.ownerEmail}` : 'Shared with you'}
										>
											Shared · {p.role}
										</span>
									{/if}
								</p>
								<span class="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
									{p.counts.active} active
								</span>
							</div>
							<div class="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
								<div
									class="h-full rounded-full bg-[var(--tier-color)] transition-all"
									style="width: {pct(p)}%"
								></div>
							</div>
							<div
								class="mt-2 flex items-center gap-3 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
							>
								<span class="text-[var(--color-emerald)]">{p.counts.active} active</span>
								<span class="text-[var(--color-amber)]">{p.counts.shortlist} shortlist</span>
								<span class="ml-auto">{p.counts.library} in library</span>
							</div>
						</a>
					</li>
				{/each}
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
		0%,
		100% {
			background-position: 200% 0;
		}
		50% {
			background-position: 0 0;
		}
	}
</style>
