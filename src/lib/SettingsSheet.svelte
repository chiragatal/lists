<script lang="ts">
	import { Download, Upload, Trash2, X } from './icons';
	import { exportAll, importAll, eraseAll } from './store.svelte';

	type Props = {
		open: boolean;
		onClose: () => void;
	};

	let { open, onClose }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let status = $state<{ kind: 'success' | 'error'; msg: string } | null>(null);
	let importMode = $state<'replace' | 'merge'>('merge');
	let busy = $state(false);

	async function handleExport() {
		busy = true;
		try {
			const json = await exportAll();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
			a.download = `lists-backup-${stamp}.json`;
			a.click();
			URL.revokeObjectURL(url);
			status = { kind: 'success', msg: 'Backup downloaded.' };
		} catch (e) {
			status = { kind: 'error', msg: (e as Error).message };
		} finally {
			busy = false;
		}
	}

	async function handleImport(file: File) {
		busy = true;
		status = null;
		try {
			const text = await file.text();
			const n = await importAll(text, importMode);
			status = {
				kind: 'success',
				msg: `Imported ${n} item${n === 1 ? '' : 's'} (${importMode}).`
			};
		} catch (e) {
			status = { kind: 'error', msg: (e as Error).message };
		} finally {
			busy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleErase() {
		if (!confirm('Erase ALL items? This cannot be undone.')) return;
		if (!confirm('Really erase everything?')) return;
		busy = true;
		try {
			await eraseAll();
			status = { kind: 'success', msg: 'All items erased.' };
		} finally {
			busy = false;
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
			class="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.6)] sm:rounded-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Settings"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div>
					<p class="font-display text-lg leading-none">Settings</p>
					<p class="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase">
						Backup &amp; data
					</p>
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

			<div class="space-y-5 p-5">
				<section>
					<h3 class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">
						Export
					</h3>
					<button
						type="button"
						onclick={handleExport}
						disabled={busy}
						class="flex w-full items-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3.5 py-3 text-left text-sm transition-colors hover:border-[var(--color-hairline-strong)] disabled:opacity-50"
					>
						<Download size={17} strokeWidth={1.5} class="text-[var(--color-emerald)]" />
						<div class="flex-1">
							<p class="font-medium text-[var(--color-text-bright)]">Download backup</p>
							<p class="text-xs text-[var(--color-muted)]">
								Save all items as a JSON file you can keep.
							</p>
						</div>
					</button>
				</section>

				<section>
					<h3 class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">
						Import
					</h3>
					<div class="mb-2 flex gap-1.5">
						<button
							type="button"
							onclick={() => (importMode = 'merge')}
							class="flex-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
							class:mode-on={importMode === 'merge'}
						>
							Merge
						</button>
						<button
							type="button"
							onclick={() => (importMode = 'replace')}
							class="flex-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
							class:mode-on={importMode === 'replace'}
						>
							Replace
						</button>
					</div>
					<label
						class="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3.5 py-3 transition-colors hover:border-[var(--color-hairline-strong)]"
					>
						<Upload size={17} strokeWidth={1.5} class="text-[var(--color-amber)]" />
						<div class="flex-1">
							<p class="text-sm font-medium text-[var(--color-text-bright)]">
								Choose backup file…
							</p>
							<p class="text-xs text-[var(--color-muted)]">
								{importMode === 'replace'
									? 'Replaces everything currently in the app.'
									: 'Adds these items alongside existing ones.'}
							</p>
						</div>
						<input
							bind:this={fileInput}
							type="file"
							accept="application/json,.json"
							class="hidden"
							disabled={busy}
							onchange={(e) => {
								const f = (e.currentTarget as HTMLInputElement).files?.[0];
								if (f) handleImport(f);
							}}
						/>
					</label>
				</section>

				<section>
					<h3 class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">
						Danger
					</h3>
					<button
						type="button"
						onclick={handleErase}
						disabled={busy}
						class="flex w-full items-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3.5 py-3 text-left text-sm transition-colors hover:border-[var(--color-danger)] disabled:opacity-50"
					>
						<Trash2 size={17} strokeWidth={1.5} class="text-[var(--color-danger)]" />
						<div class="flex-1">
							<p class="font-medium text-[var(--color-text-bright)]">Erase everything</p>
							<p class="text-xs text-[var(--color-muted)]">
								Delete all items from the device. Cannot be undone.
							</p>
						</div>
					</button>
				</section>

				{#if status}
					<p
						class="rounded-md border px-3 py-2 text-xs"
						class:status-success={status.kind === 'success'}
						class:status-error={status.kind === 'error'}
					>
						{status.msg}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.mode-on {
		border-color: var(--color-emerald) !important;
		background: color-mix(in oklab, var(--color-emerald) 12%, transparent);
		color: var(--color-text-bright);
	}
	button[type='button'] {
		border-color: var(--color-hairline);
		color: var(--color-muted);
	}
	button[type='button']:hover {
		color: var(--color-text);
	}
	.status-success {
		border-color: color-mix(in oklab, var(--color-success) 40%, var(--color-hairline));
		background: color-mix(in oklab, var(--color-success) 10%, transparent);
		color: var(--color-text-bright);
	}
	.status-error {
		border-color: color-mix(in oklab, var(--color-danger) 40%, var(--color-hairline));
		background: color-mix(in oklab, var(--color-danger) 10%, transparent);
		color: var(--color-text-bright);
	}
</style>
