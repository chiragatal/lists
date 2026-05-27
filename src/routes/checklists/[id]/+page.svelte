<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		checklists,
		groupItemsByCategory,
		type ChecklistItem,
		type ChecklistState
	} from '$lib/checklists.svelte';
	import {
		ChevronLeft,
		Plus,
		MoreHorizontal,
		History,
		Trash2,
		Pencil,
		X,
		Check
	} from '$lib/icons';
	import ChecklistHistorySheet from '$lib/ChecklistHistorySheet.svelte';

	const id = $derived(Number(page.params.id));

	$effect(() => {
		checklists.loadDetail(id);
	});

	const loading = $derived(checklists.detailLoading);
	const cl = $derived(checklists.current);
	const items = $derived(checklists.items);
	const groups = $derived(groupItemsByCategory(items));
	const counts = $derived(cl?.counts ?? { total: 0, done: 0, skipped: 0, pending: 0 });
	const resolved = $derived(counts.done + counts.skipped);
	const pct = $derived(counts.total === 0 ? 0 : Math.round((resolved / counts.total) * 100));

	let menuOpen = $state(false);
	let historyOpen = $state(false);

	// Add item
	let adding = $state(false);
	let newName = $state('');
	let newCategory = $state('');
	let addInput = $state<HTMLInputElement | null>(null);
	let busy = $state(false);

	// Rename checklist
	let renaming = $state(false);
	let renameValue = $state('');

	// Edit item
	let editingItem = $state<ChecklistItem | null>(null);
	let editName = $state('');
	let editCategory = $state('');

	const knownCategories = $derived([...new Set(items.map((i) => i.category).filter(Boolean))].sort());

	function toggle(item: ChecklistItem, target: ChecklistState) {
		const next: ChecklistState = item.state === target ? 'pending' : target;
		checklists.setItemState(id, item.id, next);
	}

	function startAdd() {
		adding = true;
		newName = '';
		queueMicrotask(() => addInput?.focus());
	}

	async function confirmAdd() {
		const n = newName.trim();
		if (!n || busy) return;
		busy = true;
		try {
			await checklists.addItem(id, n, newCategory.trim());
			newName = '';
			queueMicrotask(() => addInput?.focus());
		} finally {
			busy = false;
		}
	}

	function startRename() {
		menuOpen = false;
		renaming = true;
		renameValue = cl?.name ?? '';
	}

	async function confirmRename() {
		const n = renameValue.trim();
		if (!n) {
			renaming = false;
			return;
		}
		await checklists.renameChecklist(id, n);
		renaming = false;
	}

	async function handleReset(mode: 'all' | 'done') {
		menuOpen = false;
		const label = mode === 'all' ? 'Reset everything to pending?' : 'Clear all done items back to pending? (skipped items stay)';
		if (!confirm(label)) return;
		await checklists.reset(id, mode);
	}

	async function handleDelete() {
		menuOpen = false;
		if (!confirm(`Delete the checklist "${cl?.name}"? This removes all its items and history.`)) return;
		await checklists.deleteChecklist(id);
		await goto('/checklists');
	}

	function openItemEdit(item: ChecklistItem) {
		editingItem = item;
		editName = item.name;
		editCategory = item.category;
	}

	async function saveItemEdit() {
		if (!editingItem) return;
		const n = editName.trim();
		if (!n) return;
		await checklists.updateItem(id, editingItem.id, { name: n, category: editCategory.trim() });
		editingItem = null;
	}

	async function deleteEditingItem() {
		if (!editingItem) return;
		if (!confirm('Delete this item?')) return;
		await checklists.deleteItem(id, editingItem.id);
		editingItem = null;
	}
</script>

<svelte:head>
	<title>{cl?.name ?? 'Checklist'} · Lists</title>
</svelte:head>

<div class="page tier-active">
	<div class="mx-auto max-w-xl px-5 pt-5 pb-12">
		<header class="mb-5">
			<div class="mb-4 flex items-center justify-between gap-3">
				<a href="/checklists" class="icon-btn" aria-label="Back to checklists">
					<ChevronLeft size={18} strokeWidth={1.5} />
				</a>
				<div class="flex shrink-0 items-center gap-1.5">
					<button type="button" onclick={startAdd} class="add-btn" aria-label="Add item">
						<Plus size={15} strokeWidth={2} />
						<span>Add</span>
					</button>
					<div class="relative">
						<button
							type="button"
							onclick={() => (menuOpen = !menuOpen)}
							class="icon-btn"
							aria-label="Checklist menu"
						>
							<MoreHorizontal size={16} strokeWidth={1.5} />
						</button>
						{#if menuOpen}
							<div
								class="menu absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-lg border border-[var(--color-hairline-strong)] bg-[var(--color-paper-2)] shadow-xl"
							>
								<button type="button" class="menu-item" onclick={startRename}>
									<Pencil size={14} strokeWidth={1.5} /> Rename
								</button>
								<button type="button" class="menu-item" onclick={() => { menuOpen = false; historyOpen = true; }}>
									<History size={14} strokeWidth={1.5} /> History
								</button>
								<div class="h-px bg-[var(--color-hairline)]"></div>
								<button type="button" class="menu-item" onclick={() => handleReset('done')}>
									<Check size={14} strokeWidth={1.75} /> Clear done
								</button>
								<button type="button" class="menu-item" onclick={() => handleReset('all')}>
									<X size={14} strokeWidth={1.75} /> Reset all
								</button>
								<div class="h-px bg-[var(--color-hairline)]"></div>
								<button type="button" class="menu-item danger" onclick={handleDelete}>
									<Trash2 size={14} strokeWidth={1.5} /> Delete checklist
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<span
				class="font-mono text-[10px] tracking-[0.24em] text-[var(--tier-color)] uppercase"
			>
				Checklist
			</span>
			{#if renaming}
				<input
					type="text"
					bind:value={renameValue}
					onkeydown={(e) => {
						if (e.key === 'Enter') confirmRename();
						else if (e.key === 'Escape') (renaming = false);
					}}
					onblur={confirmRename}
					class="mt-1 block w-full border-b border-[var(--tier-color)] bg-transparent font-display text-4xl text-[var(--color-text-bright)] outline-none"
				/>
			{:else}
				<h1 class="mt-1 font-display text-4xl leading-tight text-[var(--color-text-bright)]">
					{cl?.name ?? 'Checklist'}
				</h1>
			{/if}

			<!-- Progress -->
			{#if !loading && counts.total > 0}
				<div class="mt-4">
					<div class="mb-1.5 flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
						<span class="text-[var(--tier-color)]">{resolved}</span>
						<span class="text-[var(--color-faint)]">/ {counts.total} resolved</span>
						<span class="ml-auto text-[var(--color-emerald)]">{counts.done} done</span>
						<span class="text-[var(--color-slate)]">{counts.skipped} skip</span>
					</div>
					<div class="h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-3)]">
						<div
							class="h-full rounded-full bg-[var(--tier-color)] transition-all"
							style="width: {pct}%"
						></div>
					</div>
				</div>
			{/if}
		</header>

		{#if adding}
			<div class="mb-4 rounded-xl border border-[var(--tier-color)] bg-[var(--color-paper)] p-3">
				<input
					bind:this={addInput}
					type="text"
					bind:value={newName}
					placeholder="Item name…"
					onkeydown={(e) => {
						if (e.key === 'Enter') confirmAdd();
						else if (e.key === 'Escape') (adding = false);
					}}
					class="w-full bg-transparent text-sm text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)]"
				/>
				<input
					type="text"
					bind:value={newCategory}
					list="cl-categories"
					placeholder="Category (optional)"
					onkeydown={(e) => {
						if (e.key === 'Enter') confirmAdd();
						else if (e.key === 'Escape') (adding = false);
					}}
					class="mt-2 w-full border-t border-[var(--color-hairline)] bg-transparent pt-2 text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-faint)]"
				/>
				<datalist id="cl-categories">
					{#each knownCategories as c}<option value={c}></option>{/each}
				</datalist>
				<div class="mt-2.5 flex justify-end gap-2">
					<button
						type="button"
						onclick={() => (adding = false)}
						class="rounded-md px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-muted)] uppercase hover:text-[var(--color-text)]"
					>
						Done
					</button>
					<button
						type="button"
						onclick={confirmAdd}
						disabled={!newName.trim() || busy}
						class="rounded-md bg-[var(--tier-color)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-deep)] uppercase disabled:opacity-40"
					>
						Add
					</button>
				</div>
			</div>
		{/if}

		{#if loading}
			<ul class="space-y-1.5">
				{#each Array(4) as _, i}
					<li class="skeleton-card" style="--d: {i * 80}ms"></li>
				{/each}
			</ul>
		{:else if items.length === 0}
			<div
				class="rounded-2xl border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-paper)]/40 px-6 py-12 text-center"
			>
				<p class="mx-auto max-w-xs text-sm leading-relaxed text-[var(--color-muted)]">
					This checklist is empty. Add items — group them with a category like "Documents" or "Clothes".
				</p>
				<button
					type="button"
					onclick={startAdd}
					class="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-color)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--tier-color)] uppercase"
				>
					<Plus size={12} strokeWidth={2} /> Add item
				</button>
			</div>
		{:else}
			<div class="space-y-6">
				{#each groups as g}
					<section>
						{#if g.category && g.category !== '—'}
							<div class="mb-2.5 flex items-baseline gap-3">
								<h2
									class="font-mono text-[10px] tracking-[0.22em] text-[var(--color-muted)] uppercase"
								>
									{g.category}
								</h2>
								<div class="h-px flex-1 bg-[var(--color-hairline)]"></div>
							</div>
						{/if}
						<ul class="space-y-1.5">
							{#each g.items as it (it.id)}
								<li
									class="item-row flex items-center gap-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-paper)] px-3.5 py-2.5"
									data-state={it.state}
								>
									<button
										type="button"
										onclick={() => openItemEdit(it)}
										class="min-w-0 flex-1 text-left"
									>
										<span class="item-name text-[15px] text-[var(--color-text-bright)]">
											{it.name}
										</span>
									</button>
									<div class="flex shrink-0 items-center gap-1.5">
										<button
											type="button"
											onclick={() => toggle(it, 'done')}
											class="state-btn done"
											class:on={it.state === 'done'}
											aria-label="Mark done"
											title="Done"
										>
											<Check size={15} strokeWidth={2} />
										</button>
										<button
											type="button"
											onclick={() => toggle(it, 'skipped')}
											class="state-btn skip"
											class:on={it.state === 'skipped'}
											aria-label="Don't need"
											title="Don't need"
										>
											<X size={15} strokeWidth={2} />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Item edit modal -->
{#if editingItem}
	<div
		class="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center"
		onclick={() => (editingItem = null)}
		role="presentation"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-t-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] shadow-2xl sm:rounded-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<header class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4">
				<p class="font-display-soft text-lg">Edit item</p>
				<button
					type="button"
					onclick={() => (editingItem = null)}
					class="-mr-1.5 rounded-md p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)]"
					aria-label="Close"
				>
					<X size={18} strokeWidth={1.5} />
				</button>
			</header>
			<div class="space-y-4 p-5">
				<label class="block">
					<span class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">Name</span>
					<input
						type="text"
						bind:value={editName}
						onkeydown={(e) => e.key === 'Enter' && saveItemEdit()}
						class="w-full border-0 border-b border-[var(--color-hairline-strong)] bg-transparent px-0 py-1.5 text-base text-[var(--color-text-bright)] outline-none focus:border-[var(--tier-color)]"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">Category</span>
					<input
						type="text"
						bind:value={editCategory}
						list="cl-categories-edit"
						placeholder="Optional"
						onkeydown={(e) => e.key === 'Enter' && saveItemEdit()}
						class="w-full border-0 border-b border-[var(--color-hairline)] bg-transparent px-0 py-1.5 text-sm text-[var(--color-text-bright)] outline-none focus:border-[var(--tier-color)]"
					/>
					<datalist id="cl-categories-edit">
						{#each knownCategories as c}<option value={c}></option>{/each}
					</datalist>
				</label>
			</div>
			<footer class="flex items-center justify-between border-t border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-5 py-3">
				<button
					type="button"
					onclick={deleteEditingItem}
					class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
				>
					<Trash2 size={13} strokeWidth={1.5} /> Delete
				</button>
				<button
					type="button"
					onclick={saveItemEdit}
					disabled={!editName.trim()}
					class="rounded-md bg-[var(--tier-color)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--color-ink-deep)] uppercase disabled:opacity-30"
				>
					Save
				</button>
			</footer>
		</div>
	</div>
{/if}

<ChecklistHistorySheet open={historyOpen} checklistId={id} onClose={() => (historyOpen = false)} />

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

	.menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		font-size: 13px;
		color: var(--color-text);
		background: transparent;
		transition: background 140ms;
	}
	.menu-item:hover {
		background: var(--color-paper-3);
	}
	.menu-item.danger {
		color: var(--color-danger);
	}

	.state-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 0.5rem;
		border: 1px solid var(--color-hairline-strong);
		color: var(--color-faint);
		transition: all 160ms;
	}
	.state-btn.done.on {
		background: var(--color-emerald);
		border-color: var(--color-emerald);
		color: var(--color-ink-deep);
	}
	.state-btn.skip.on {
		background: var(--color-slate);
		border-color: var(--color-slate);
		color: var(--color-ink-deep);
	}
	.state-btn:hover:not(.on) {
		color: var(--color-text);
		border-color: var(--color-muted);
	}

	.item-row[data-state='skipped'] .item-name {
		text-decoration: line-through;
		color: var(--color-muted);
	}
	.item-row[data-state='done'] {
		border-color: color-mix(in oklab, var(--color-emerald) 30%, var(--color-hairline));
	}

	.skeleton-card {
		height: 48px;
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
