<script lang="ts">
	import { X } from './icons';

	export type TagMatchMode = 'all' | 'any';

	type Props = {
		open: boolean;
		allTags: { tag: string; count: number }[];
		selected: string[];
		mode: TagMatchMode;
		onChange: (next: string[]) => void;
		onModeChange: (m: TagMatchMode) => void;
		onClose: () => void;
	};

	let { open, allTags, selected, mode, onChange, onModeChange, onClose }: Props = $props();

	function toggle(tag: string) {
		if (selected.includes(tag)) onChange(selected.filter((t) => t !== tag));
		else onChange([...selected, tag]);
	}

	function clearAll() {
		onChange([]);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.6)] sm:rounded-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Filter by tags"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div>
					<p class="font-display-soft text-lg leading-none">Tags</p>
					<p class="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase">
						{selected.length} of {allTags.length} selected
					</p>
				</div>
				<div class="flex items-center gap-2">
					{#if selected.length}
						<button
							type="button"
							onclick={clearAll}
							class="font-mono text-[11px] tracking-wide text-[var(--color-muted)] uppercase hover:text-[var(--color-text)]"
						>
							Clear
						</button>
					{/if}
					<button
						type="button"
						onclick={onClose}
						class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
						aria-label="Close"
					>
						<X size={18} strokeWidth={1.5} />
					</button>
				</div>
			</header>

			<!-- All/Any mode toggle -->
			<div class="border-b border-[var(--color-hairline)] px-5 py-3">
				<div class="mb-1.5 flex items-baseline justify-between">
					<span
						class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						Match
					</span>
					<span class="font-mono text-[10px] text-[var(--color-faint)]">
						{mode === 'all' ? 'every selected tag' : 'any tag, ranked by hits'}
					</span>
				</div>
				<div class="flex gap-1.5">
					<button
						type="button"
						onclick={() => onModeChange('all')}
						class="flex-1 rounded-md border px-2.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-colors"
						class:mode-on={mode === 'all'}
					>
						All
					</button>
					<button
						type="button"
						onclick={() => onModeChange('any')}
						class="flex-1 rounded-md border px-2.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-colors"
						class:mode-on={mode === 'any'}
					>
						Any
					</button>
				</div>
			</div>

			<div class="max-h-[50vh] overflow-y-auto p-5 scrollbar-thin">
				{#if allTags.length === 0}
					<p class="py-8 text-center text-sm text-[var(--color-muted)]">
						No tags yet on items in this view.
					</p>
				{:else}
					<ul class="flex flex-wrap gap-1.5">
						{#each allTags as { tag, count }}
							{@const on = selected.includes(tag)}
							<li>
								<button
									type="button"
									onclick={() => toggle(tag)}
									class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
									class:on
								>
									<span>{tag}</span>
									<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
										{count}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
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
	button.on {
		border-color: var(--tier-color, var(--color-emerald));
		background: color-mix(in oklab, var(--tier-color, var(--color-emerald)) 14%, transparent);
		color: var(--color-text-bright);
	}
	button.on :global(span:last-child) {
		color: var(--tier-color, var(--color-emerald));
	}
	.mode-on {
		border-color: var(--tier-color, var(--color-emerald)) !important;
		background: color-mix(in oklab, var(--tier-color, var(--color-emerald)) 14%, transparent);
		color: var(--color-text-bright);
	}
</style>
