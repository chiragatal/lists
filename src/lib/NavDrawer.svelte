<script lang="ts">
	import { page } from '$app/state';
	import { ui } from './ui.svelte';
	import { lists, signOut } from './store.svelte';
	import { Crosshair, ListChecks, Settings, X } from './icons';

	const onPlans = $derived(
		page.url.pathname === '/' || page.url.pathname.startsWith('/plans')
	);
	const onChecklists = $derived(page.url.pathname.startsWith('/checklists'));
	function go(_href: string) {
		ui.closeMenu();
		// Anchor handles navigation; this just closes the drawer.
	}
</script>

{#if ui.menuOpen}
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
		onclick={() => ui.closeMenu()}
		role="presentation"
	>
		<nav
			class="drawer flex h-full w-[78%] max-w-xs flex-col border-r border-[var(--color-hairline-strong)] bg-[var(--color-paper)]"
			onclick={(e) => e.stopPropagation()}
			aria-label="Main menu"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<p class="font-display text-2xl leading-none text-[var(--color-text-bright)]">Lists</p>
				<button
					type="button"
					onclick={() => ui.closeMenu()}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close menu"
				>
					<X size={18} strokeWidth={1.5} />
				</button>
			</header>

			<div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
				<a href="/" onclick={() => go('/')} class="nav-item" class:active={onPlans}>
					<Crosshair size={17} strokeWidth={1.5} />
					<span class="flex-1">Plans</span>
				</a>
				<a
					href="/checklists"
					onclick={() => go('/checklists')}
					class="nav-item"
					class:active={onChecklists}
				>
					<ListChecks size={17} strokeWidth={1.5} />
					<span class="flex-1">Checklists</span>
				</a>

				<div class="my-3 h-px bg-[var(--color-hairline)]"></div>

				<button type="button" onclick={() => ui.openSettings()} class="nav-item w-full">
					<Settings size={17} strokeWidth={1.5} />
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

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 0.625rem;
		color: var(--color-muted);
		font-family: var(--font-display);
		font-variation-settings: 'wght' 520;
		font-size: 15px;
		letter-spacing: -0.01em;
		background: transparent;
		transition: background 160ms, color 160ms;
	}
	.nav-item:hover {
		background: var(--color-paper-2);
		color: var(--color-text-bright);
	}
	.nav-item.active {
		background: var(--color-paper-2);
		color: var(--color-text-bright);
	}
	@media (prefers-reduced-motion: reduce) {
		.drawer {
			animation: none;
		}
	}
</style>
