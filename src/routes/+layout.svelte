<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const tabs = [
		{ href: '/', label: 'Library', icon: '📚' },
		{ href: '/shortlist', label: 'Shortlist', icon: '⭐' },
		{ href: '/active', label: 'Active', icon: '🎯' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-dvh flex-col">
	<main class="flex-1 pb-20">
		{@render children()}
	</main>

	<nav
		class="fixed right-0 bottom-0 left-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		<ul class="mx-auto flex max-w-xl">
			{#each tabs as tab}
				<li class="flex-1">
					<a
						href={tab.href}
						class="flex flex-col items-center gap-0.5 py-3 text-xs transition-colors"
						class:text-[var(--color-accent)]={isActive(tab.href)}
						class:text-[var(--color-muted)]={!isActive(tab.href)}
					>
						<span class="text-lg leading-none">{tab.icon}</span>
						<span>{tab.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
