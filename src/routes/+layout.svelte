<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Bookmark, Crosshair, Library } from '$lib/icons';
	import { requestPersistentStorage } from '$lib/backup.svelte';
	import { ui } from '$lib/ui.svelte';
	import { lists } from '$lib/store.svelte';
	import { plans } from '$lib/plans.svelte';
	import { checklists } from '$lib/checklists.svelte';
	import NavDrawer from '$lib/NavDrawer.svelte';
	import SettingsSheet from '$lib/SettingsSheet.svelte';

	let { children } = $props();

	onMount(() => {
		requestPersistentStorage();
		// Login gate runs server-side; if we reached a page, we're authed.
		if (page.url.pathname.startsWith('/login')) return;
		// Warm the drawer data in parallel so it opens instantly, fully populated.
		lists.loadUser();
		if (!plans.loaded && !plans.loading) plans.loadIndex();
		if (!checklists.indexLoaded && !checklists.indexLoading) checklists.loadIndex();
	});

	// The bottom nav shows only inside a plan, scoped to that plan's tiers.
	const planMatch = $derived(page.url.pathname.match(/^\/plans\/(\d+)(\/(shortlist|library))?\/?$/));
	const planId = $derived(planMatch ? planMatch[1] : null);
	const subTier = $derived(planMatch ? (planMatch[3] ?? 'active') : null);

	const tabs = $derived(
		planId
			? [
					{
						href: `/plans/${planId}`,
						label: 'Active',
						active: subTier === 'active',
						Icon: Crosshair,
						tone: 'emerald'
					},
					{
						href: `/plans/${planId}/shortlist`,
						label: 'Shortlist',
						active: subTier === 'shortlist',
						Icon: Bookmark,
						tone: 'amber'
					},
					{
						href: `/plans/${planId}/library`,
						label: 'Library',
						active: subTier === 'library',
						Icon: Library,
						tone: 'slate'
					}
				]
			: []
	);

	const hideNav = $derived(!planId);
</script>

<div class="flex min-h-dvh flex-col">
	<main class="flex-1">
		{@render children()}
	</main>

	{#if !hideNav}
	<nav
		class="bottom-nav fixed right-0 bottom-0 left-0 z-20"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		<div class="nav-blur"></div>
		<ul class="nav-list mx-auto flex max-w-xl">
			{#each tabs as tab}
				{@const active = tab.active}
				<li class="flex-1">
					<a
						href={tab.href}
						class="nav-link"
						class:active
						data-tone={tab.tone}
						aria-current={active ? 'page' : undefined}
					>
						<span class="indicator" aria-hidden="true"></span>
						<tab.Icon size={18} strokeWidth={active ? 1.75 : 1.5} />
						<span class="label">{tab.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	{/if}
</div>

<NavDrawer />
<SettingsSheet open={ui.settingsOpen} onClose={() => ui.closeSettings()} />

<style>
	.bottom-nav {
		border-top: 1px solid var(--color-hairline);
	}
	.nav-blur {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, var(--color-ink) 60%, color-mix(in oklab, var(--color-ink) 88%, transparent));
		backdrop-filter: blur(10px);
	}
	.nav-list {
		position: relative;
	}
	.nav-link {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 8px 12px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-faint);
		transition: color 220ms;
	}
	.nav-link:hover {
		color: var(--color-muted);
	}
	.nav-link[data-tone='emerald'].active {
		color: var(--color-emerald);
	}
	.nav-link[data-tone='amber'].active {
		color: var(--color-amber);
	}
	.nav-link[data-tone='slate'].active {
		color: var(--color-slate-bright);
	}

	.indicator {
		position: absolute;
		top: 0;
		left: 50%;
		width: 22px;
		height: 1.5px;
		background: currentColor;
		opacity: 0;
		transform: translateX(-50%) scaleX(0.4);
		transition: opacity 220ms, transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
		border-radius: 0 0 2px 2px;
	}
	.nav-link.active .indicator {
		opacity: 1;
		transform: translateX(-50%) scaleX(1);
		box-shadow: 0 0 12px 0 currentColor;
	}

	.label {
		font-variation-settings: 'wght' 500;
	}
</style>
