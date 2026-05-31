<script lang="ts">
	import { Download, Upload, Trash2, X, Pencil, Check } from './icons';
	import { exportAll, importAll, eraseAll, signOut, lists } from './lists.svelte';
	import { backup } from './backup.svelte';

	type Props = {
		open: boolean;
		onClose: () => void;
	};

	let { open, onClose }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let status = $state<{ kind: 'success' | 'error'; msg: string } | null>(null);
	let importMode = $state<'replace' | 'merge'>('merge');
	let busy = $state(false);

	// Manage data — categories and tags (derived from the store)
	const categories = $derived.by(() => {
		const map = new Map<string, number>();
		for (const it of lists.items) {
			if (it.category) map.set(it.category, (map.get(it.category) ?? 0) + 1);
		}
		return [...map.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	const tags = $derived.by(() => {
		const map = new Map<string, number>();
		for (const it of lists.items) for (const t of it.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
		return [...map.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	let editing = $state<{ kind: 'category' | 'tag'; name: string; draft: string } | null>(null);

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
			backup.mark();
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
				msg: `Imported ${n} record${n === 1 ? '' : 's'} (${importMode}). Refreshing…`
			};
			// Reload so the checklists view also reflects the import.
			setTimeout(() => {
				if (typeof window !== 'undefined') window.location.reload();
			}, 900);
		} catch (e) {
			status = { kind: 'error', msg: (e as Error).message };
		} finally {
			busy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleDeleteAccount() {
		if (!confirm('Delete your account and erase ALL your data? This cannot be undone.')) return;
		if (!confirm('Really delete the account?')) return;
		busy = true;
		try {
			backup.reset();
			await eraseAll();
		} finally {
			busy = false;
		}
	}


	function beginEdit(kind: 'category' | 'tag', name: string) {
		editing = { kind, name, draft: name };
	}

	function cancelEdit() {
		editing = null;
	}

	async function commitEdit() {
		if (!editing) return;
		const target = editing.draft.trim();
		if (!target || target === editing.name) {
			editing = null;
			return;
		}
		const listId = lists.current?.id;
		if (listId == null) {
			editing = null;
			return;
		}
		try {
			if (editing.kind === 'category') {
				const n = await lists.renameCategory(listId, editing.name, target);
				const collidedWith = categories.find((c) => c.name === target && c.name !== editing!.name);
				status = {
					kind: 'success',
					msg: collidedWith
						? `Merged ${n} item${n === 1 ? '' : 's'} into "${target}".`
						: `Renamed ${n} item${n === 1 ? '' : 's'}.`
				};
			} else {
				const n = await lists.renameTag(listId, editing.name, target);
				const collidedWith = tags.find((t) => t.name === target && t.name !== editing!.name);
				status = {
					kind: 'success',
					msg: collidedWith
						? `Merged ${n} item${n === 1 ? '' : 's'} into "${target}".`
						: `Renamed ${n} item${n === 1 ? '' : 's'}.`
				};
			}
		} catch (e) {
			status = { kind: 'error', msg: (e as Error).message };
		}
		editing = null;
	}

	function formatBackup(): string {
		const d = backup.daysSince;
		if (d === null) return 'Never exported.';
		if (d < 1) return 'Last backup: today.';
		if (d < 2) return 'Last backup: yesterday.';
		return `Last backup: ${Math.floor(d)} days ago.`;
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
					<p class="font-display-soft text-lg leading-none">Settings</p>
					<p
						class="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase"
					>
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

			<div class="max-h-[78vh] space-y-5 overflow-y-auto p-5 scrollbar-thin">
				{#if lists.user}
					<section>
						<h3
							class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Account
						</h3>
						<div class="flex items-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3.5 py-3">
							{#if lists.user.picture}
								<img
									src={lists.user.picture}
									alt=""
									class="h-9 w-9 rounded-full border border-[var(--color-hairline)]"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<div
									class="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-paper-3)] font-mono text-xs text-[var(--color-muted)] uppercase"
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
								class="rounded-md border border-[var(--color-hairline)] px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[var(--color-muted)] uppercase hover:border-[var(--color-hairline-strong)] hover:text-[var(--color-text)]"
							>
								Sign out
							</button>
						</div>
					</section>
				{/if}

				<section>
					<div class="mb-2 flex items-baseline justify-between">
						<h3
							class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Export
						</h3>
						<p
							class="font-mono text-[10px]"
							class:text-[var(--color-amber)]={backup.stale && categories.length > 0}
							class:text-[var(--color-faint)]={!backup.stale || categories.length === 0}
						>
							{formatBackup()}
						</p>
					</div>
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
								Save everything — Plans and Checklists — as a JSON file you can keep.
							</p>
						</div>
					</button>
				</section>

				<section>
					<h3
						class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
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
					<div class="mb-2 flex items-baseline justify-between">
						<h3
							class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Categories
						</h3>
						<p class="font-mono text-[10px] text-[var(--color-faint)]">
							{categories.length} total
						</p>
					</div>
					{#if categories.length === 0}
						<p class="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] p-3 text-xs text-[var(--color-muted)]">
							None yet.
						</p>
					{:else}
						<ul class="overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)]">
							{#each categories as c, i}
								<li
									class="flex items-center gap-2 px-3 py-2"
									class:divider={i > 0}
								>
									{#if editing?.kind === 'category' && editing.name === c.name}
										<input
											type="text"
											bind:value={editing.draft}
											onkeydown={(e) => {
												if (e.key === 'Enter') commitEdit();
												else if (e.key === 'Escape') cancelEdit();
											}}
											class="flex-1 border-b border-[var(--color-emerald)] bg-transparent py-0.5 text-sm text-[var(--color-text-bright)] outline-none"
										/>
										<button
											type="button"
											onclick={commitEdit}
											class="rounded-md p-1 text-[var(--color-emerald)] hover:bg-[var(--color-paper-3)]"
											aria-label="Save"
										>
											<Check size={14} strokeWidth={2} />
										</button>
										<button
											type="button"
											onclick={cancelEdit}
											class="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]"
											aria-label="Cancel"
										>
											<X size={14} strokeWidth={1.5} />
										</button>
									{:else}
										<span class="flex-1 truncate text-sm text-[var(--color-text)]">
											{c.name}
										</span>
										<span class="font-mono text-[10px] tabular-nums text-[var(--color-faint)]">
											{c.count}
										</span>
										<button
											type="button"
											onclick={() => beginEdit('category', c.name)}
											class="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-paper-3)] hover:text-[var(--color-text)]"
											aria-label="Rename {c.name}"
										>
											<Pencil size={12} strokeWidth={1.5} />
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section>
					<div class="mb-2 flex items-baseline justify-between">
						<h3
							class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Tags
						</h3>
						<p class="font-mono text-[10px] text-[var(--color-faint)]">
							{tags.length} total
						</p>
					</div>
					{#if tags.length === 0}
						<p class="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] p-3 text-xs text-[var(--color-muted)]">
							None yet.
						</p>
					{:else}
						<ul class="overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)]">
							{#each tags as t, i}
								<li
									class="flex items-center gap-2 px-3 py-2"
									class:divider={i > 0}
								>
									{#if editing?.kind === 'tag' && editing.name === t.name}
										<input
											type="text"
											bind:value={editing.draft}
											onkeydown={(e) => {
												if (e.key === 'Enter') commitEdit();
												else if (e.key === 'Escape') cancelEdit();
											}}
											class="flex-1 border-b border-[var(--color-emerald)] bg-transparent py-0.5 text-sm text-[var(--color-text-bright)] outline-none"
										/>
										<button
											type="button"
											onclick={commitEdit}
											class="rounded-md p-1 text-[var(--color-emerald)] hover:bg-[var(--color-paper-3)]"
											aria-label="Save"
										>
											<Check size={14} strokeWidth={2} />
										</button>
										<button
											type="button"
											onclick={cancelEdit}
											class="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]"
											aria-label="Cancel"
										>
											<X size={14} strokeWidth={1.5} />
										</button>
									{:else}
										<span class="flex-1 truncate font-mono text-xs text-[var(--color-text)]">
											{t.name}
										</span>
										<span class="font-mono text-[10px] tabular-nums text-[var(--color-faint)]">
											{t.count}
										</span>
										<button
											type="button"
											onclick={() => beginEdit('tag', t.name)}
											class="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-paper-3)] hover:text-[var(--color-text)]"
											aria-label="Rename {t.name}"
										>
											<Pencil size={12} strokeWidth={1.5} />
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
					<p class="mt-1.5 px-1 font-mono text-[9px] text-[var(--color-faint)]">
						Rename to an existing name to merge.
					</p>
				</section>

				<section>
					<h3
						class="mb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						Danger
					</h3>
					<button
						type="button"
						onclick={handleDeleteAccount}
						disabled={busy}
						class="flex w-full items-center gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3.5 py-3 text-left text-sm transition-colors hover:border-[var(--color-danger)] disabled:opacity-50"
					>
						<Trash2 size={17} strokeWidth={1.5} class="text-[var(--color-danger)]" />
						<div class="flex-1">
							<p class="font-medium text-[var(--color-text-bright)]">
								Delete account and erase all data
							</p>
							<p class="text-xs text-[var(--color-muted)]">
								Removes your account, all items, and sessions. Cannot be undone.
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
	.divider {
		border-top: 1px solid var(--color-hairline);
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
