<script lang="ts">
	import { page } from '$app/state';
	import { ui } from './ui.svelte';
	import { lists, signOut, type PlanCounts, type ChecklistCounts } from './lists.svelte';
	import { Crosshair, ListChecks, Settings, X, ChevronRight } from './icons';

	$effect(() => {
		if (!ui.menuOpen) return;
		if (!lists.indexLoaded && !lists.indexLoading) lists.loadIndex();
	});

	const planRows = $derived(lists.all.filter((l) => l.type === 'plan'));
	const checklistRows = $derived(lists.all.filter((l) => l.type === 'checklist'));
	const onPlans = $derived(page.url.pathname === '/' || page.url.pathname.startsWith('/plans') || page.url.pathname.startsWith('/lists'));
	const onChecklists = $derived(page.url.pathname.startsWith('/checklists'));
	const currentListId = $derived(
		page.url.pathname.match(/^\/(?:plans|checklists|lists)\/(\d+)/)?.[1] ?? null
	);

	function close() {
		ui.closeMenu();
	}
</script>

{#if ui.menuOpen}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
		onclick={close}
		role="presentation"
	>
		<nav
			class="drawer flex h-full w-[80%] max-w-xs flex-col border-r border-[var(--color-hairline-strong)] bg-[var(--color-paper)]"
			onclick={(e) => e.stopPropagation()}
			aria-label="Main menu"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<p class="font-display text-2xl leading-none text-[var(--color-text-bright)]">Lists</p>
				<button
					type="button"
					onclick={close}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close menu"
				>
					<X size={18} strokeWidth={1.5} />
				</button>
			</header>

			<div class="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
				<a href="/" onclick={close} class="section-head" class:active={onPlans}>
					<Crosshair size={16} strokeWidth={1.5} />
					<span class="flex-1">Plans</span>
					<ChevronRight size={14} strokeWidth={1.5} class="text-[var(--color-faint)]" />
				</a>
				<ul class="mb-3 ml-2 border-l border-[var(--color-hairline)] pl-2">
					{#each planRows as p (p.id)}
						{@const c = p.counts as PlanCounts}
						<li>
							<a
								href="/lists/{p.id}"
								onclick={close}
								class="sub-item"
								class:active={currentListId === String(p.id)}
							>
								<span class="flex-1 truncate">{p.name}</span>
								<span class="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
									<span class="text-[var(--color-emerald)]" title="Active">{c.active}</span>
									<span class="text-[var(--color-amber)]" title="Shortlist">{c.shortlist}</span>
									<span class="text-[var(--color-faint)]" title="In library">{c.library}</span>
								</span>
							</a>
						</li>
					{/each}
					{#if lists.indexLoaded && planRows.length === 0}
						<li class="px-2 py-1.5 text-xs text-[var(--color-faint)]">No plans yet</li>
					{/if}
				</ul>

				<a href="/" onclick={close} class="section-head" class:active={onChecklists}>
					<ListChecks size={16} strokeWidth={1.5} />
					<span class="flex-1">Checklists</span>
					<ChevronRight size={14} strokeWidth={1.5} class="text-[var(--color-faint)]" />
				</a>
				<ul class="mb-3 ml-2 border-l border-[var(--color-hairline)] pl-2">
					{#each checklistRows as cl (cl.id)}
						{@const c = cl.counts as ChecklistCounts}
						<li>
							<a
								href="/lists/{cl.id}"
								onclick={close}
								class="sub-item"
								class:active={currentListId === String(cl.id)}
							>
								<span class="flex-1 truncate">{cl.name}</span>
								<span class="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
									<span class="text-[var(--color-emerald)]" title="Done">{c.done}</span>
									<span class="text-[var(--color-slate)]" title="Skipped">{c.skipped}</span>
									<span class="text-[var(--color-faint)]" title="Pending">{c.pending}</span>
								</span>
							</a>
						</li>
					{/each}
					{#if lists.indexLoaded && checklistRows.length === 0}
						<li class="px-2 py-1.5 text-xs text-[var(--color-faint)]">No checklists yet</li>
					{/if}
				</ul>

				<div class="my-2 h-px bg-[var(--color-hairline)]"></div>

				<button type="button" onclick={() => ui.openSettings()} class="section-head w-full">
					<Settings size={16} strokeWidth={1.5} />
					<span class="flex-1 text-left">Settings</span>
				</button>
			</div>

			{#if lists.user}
				<footer class="border-t border-[var(--color-hairline)] p-3">
					<div class="flex items-center gap-3 px-2 py-1.5">
						{#if lists.user.picture}
							<img
								src={lists.user.picture}
								alt=""
								class="h-8 w-8 rounded-full border border-[var(--color-hairline)]"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<div
								class="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-paper-2)] font-mono text-[11px] text-[var(--color-muted)] uppercase"
							>
								{lists.user.email.slice(0, 1)}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							{#if lists.user.name}
								<p class="truncate text-sm font-medium text-[var(--color-text-bright)]">
									{lists.user.name}
								</p>
							{/if}
							<p class="truncate text-xs text-[var(--color-muted)]">{lists.user.email}</p>
						</div>
						<button
							type="button"
							onclick={() => signOut()}
							class="font-mono text-[10px] tracking-[0.16em] text-[var(--color-muted)] uppercase hover:text-[var(--color-text)]"
						>
							Sign out
						</button>
					</div>
				</footer>
			{/if}
		</nav>
	</div>
{/if}

<style>
	.drawer {
		animation: slide-in 220ms cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 12px 0 40px -12px rgba(0, 0, 0, 0.6);
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}
	@keyframes slide-in {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 0.625rem;
		color: var(--color-text);
		font-family: var(--font-display);
		font-variation-settings: 'wght' 560;
		font-size: 15px;
		letter-spacing: -0.01em;
		background: transparent;
		transition: background 160ms, color 160ms;
	}
	.section-head:hover {
		background: var(--color-paper-2);
		color: var(--color-text-bright);
	}
	.section-head.active {
		color: var(--color-text-bright);
	}

	.sub-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		border-radius: 0.5rem;
		color: var(--color-muted);
		font-size: 13px;
		transition: background 140ms, color 140ms;
	}
	.sub-item:hover {
		background: var(--color-paper-2);
		color: var(--color-text);
	}
	.sub-item.active {
		background: var(--color-paper-2);
		color: var(--color-text-bright);
	}

	@media (prefers-reduced-motion: reduce) {
		.drawer {
			animation: none;
		}
	}
</style>
