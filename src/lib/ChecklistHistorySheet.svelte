<script lang="ts">
	import { lists, type Snapshot } from './lists.svelte';
	import { History, X, Trash2 } from './icons';

	type Props = {
		open: boolean;
		checklistId: number;
		onClose: () => void;
	};

	let { open, checklistId, onClose }: Props = $props();

	let snapshots = $state<Snapshot[]>([]);
	let loading = $state(false);
	let expanded = $state<number | null>(null);

	$effect(() => {
		if (!open) return;
		loading = true;
		lists
			.loadHistory(checklistId)
			.then((s) => (snapshots = s))
			.finally(() => (loading = false));
	});

	function fmt(ts: number): string {
		return new Date(ts).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: Date.now() - ts > 365 * 86_400_000 ? 'numeric' : undefined,
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function reasonLabel(r: string): string {
		return r === 'reset_all' ? 'Reset all' : r === 'clear_done' ? 'Cleared done' : r;
	}

	let deleting = $state<number | null>(null);
	async function removeSnapshot(snapshotId: number) {
		if (deleting) return;
		if (!confirm('Delete this history entry?')) return;
		deleting = snapshotId;
		try {
			await lists.deleteSnapshot(checklistId, snapshotId);
			snapshots = snapshots.filter((s) => s.id !== snapshotId);
			if (expanded === snapshotId) expanded = null;
		} finally {
			deleting = null;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.6)] sm:rounded-2xl"
			style="max-height: 86dvh;"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Checklist history"
		>
			<header
				class="flex shrink-0 items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div class="flex items-center gap-2">
					<History size={15} strokeWidth={1.5} class="text-[var(--color-text-bright)]" />
					<div>
						<p class="font-display-soft text-lg leading-none">History</p>
						<p
							class="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
						>
							{snapshots.length} past {snapshots.length === 1 ? 'run' : 'runs'}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close"
				>
					<X size={18} strokeWidth={1.5} />
				</button>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
				{#if loading}
					<p class="py-10 text-center text-sm text-[var(--color-muted)]">Loading…</p>
				{:else if snapshots.length === 0}
					<div class="px-6 py-10 text-center">
						<p class="font-mono text-[10px] tracking-[0.22em] text-[var(--color-faint)] uppercase">
							Nothing yet
						</p>
						<p class="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
							Each time you reset this checklist, a snapshot of that run is saved here.
						</p>
					</div>
				{:else}
					<ul class="space-y-1.5">
						{#each snapshots as s (s.id)}
							<li class="overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-paper-2)]">
								<div class="flex w-full items-center gap-2 px-3.5 py-3">
									<button
										type="button"
										onclick={() => (expanded = expanded === s.id ? null : s.id)}
										class="flex min-w-0 flex-1 items-center gap-3 text-left"
									>
										<div class="min-w-0 flex-1">
											<p class="text-sm text-[var(--color-text-bright)]">{fmt(s.createdAt)}</p>
											<p
												class="mt-0.5 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
											>
												{reasonLabel(s.reason)}
											</p>
										</div>
										<div class="flex shrink-0 items-center gap-2.5 font-mono text-[11px] tabular-nums">
											<span class="text-[var(--color-emerald)]">{s.doneCount}✓</span>
											<span class="text-[var(--color-slate)]">{s.skippedCount}✗</span>
											{#if s.pendingCount > 0}
												<span class="text-[var(--color-faint)]">{s.pendingCount}○</span>
											{/if}
										</div>
									</button>
									<button
										type="button"
										onclick={() => removeSnapshot(s.id)}
										disabled={deleting === s.id}
										class="shrink-0 rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)] disabled:opacity-40"
										aria-label="Delete history entry"
										title="Delete entry"
									>
										<Trash2 size={13} strokeWidth={1.5} />
									</button>
								</div>
								{#if expanded === s.id && s.items.length}
									<div class="border-t border-[var(--color-hairline)] px-3.5 py-2.5">
										<ul class="space-y-1">
											{#each s.items as it}
												<li class="flex items-center gap-2 text-[13px]">
													<span
														class="w-3 shrink-0 text-center font-mono text-[10px]"
														class:text-[var(--color-emerald)]={it.state === 'done'}
														class:text-[var(--color-slate)]={it.state === 'skipped'}
														class:text-[var(--color-faint)]={it.state === 'pending'}
													>
														{it.state === 'done' ? '✓' : it.state === 'skipped' ? '✗' : '○'}
													</span>
													<span
														class="text-[var(--color-text)]"
														class:line-through={it.state === 'skipped'}
														class:opacity-60={it.state === 'skipped'}
													>
														{it.name}
													</span>
													{#if it.category}
														<span class="ml-auto font-mono text-[9px] tracking-wide text-[var(--color-faint)] uppercase">
															{it.category}
														</span>
													{/if}
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}
