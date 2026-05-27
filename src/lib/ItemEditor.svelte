<script lang="ts">
	import type { Item, Tier } from './db';
	import {
		addItem,
		updateItem,
		deleteItem,
		allCategories,
		tagsForCategory,
		tierOf,
		removeCompletion
	} from './store.svelte';
	import { Trash2, X, Bookmark, Crosshair, Library, Check } from './icons';

	type Props = {
		open: boolean;
		item?: Item | null;
		defaultTier: Tier;
		canEdit?: boolean;
		onClose: () => void;
	};

	let { open, item = null, defaultTier, canEdit = true, onClose }: Props = $props();

	let name = $state('');
	let category = $state('');
	let tagsText = $state('');
	let notes = $state('');
	let placement = $state<Tier>('library');
	let completedAt = $state<number[]>([]);
	let nameInput = $state<HTMLInputElement | null>(null);
	let saving = $state(false);

	const categories = $derived(allCategories());
	const tagSuggestions = $derived(tagsForCategory(category.trim()));

	$effect(() => {
		if (!open) return;
		if (item) {
			name = item.name;
			category = item.category;
			tagsText = item.tags.join(', ');
			notes = item.notes ?? '';
			placement = tierOf(item);
			completedAt = [...(item.completedAt ?? [])];
		} else {
			name = '';
			category = '';
			tagsText = '';
			notes = '';
			placement = defaultTier;
			completedAt = [];
		}
		queueMicrotask(() => nameInput?.focus());
	});

	function parseTags(s: string): string[] {
		return s
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const currentTags = $derived(parseTags(tagsText));

	function addTagSuggestion(t: string) {
		if (currentTags.includes(t)) {
			tagsText = currentTags.filter((x) => x !== t).join(', ');
		} else {
			tagsText = [...currentTags, t].join(', ');
		}
	}

	async function save() {
		if (saving) return;
		const n = name.trim();
		const c = category.trim();
		if (!n || !c) return;
		saving = true;
		try {
			const tags = parseTags(tagsText);
			const trimmedNotes = notes.trim();
			if (item?.id != null) {
				await updateItem(item.id, {
					name: n,
					category: c,
					tags,
					notes: (trimmedNotes || null) as string | undefined,
					inShortlist: placement === 'shortlist' ? 1 : 0,
					inActive: placement === 'active' ? 1 : 0
				});
			} else {
				await addItem({ name: n, category: c, tags, notes: trimmedNotes, tier: placement });
			}
			onClose();
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (item?.id != null && confirm('Delete this item permanently?')) {
			await deleteItem(item.id);
			onClose();
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
	}

	async function removeEntry(ts: number) {
		completedAt = completedAt.filter((t) => t !== ts);
		if (item?.id != null) await removeCompletion(item.id, ts);
	}

	function formatCompletion(ts: number): { rel: string; abs: string } {
		const diff = Date.now() - ts;
		let rel: string;
		if (diff < 60_000) rel = 'just now';
		else if (diff < 3_600_000) rel = `${Math.floor(diff / 60_000)}m ago`;
		else if (diff < 86_400_000) rel = `${Math.floor(diff / 3_600_000)}h ago`;
		else if (diff < 7 * 86_400_000) rel = `${Math.floor(diff / 86_400_000)}d ago`;
		else rel = `${Math.floor(diff / 86_400_000)}d ago`;
		const d = new Date(ts);
		const abs = d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: diff > 365 * 86_400_000 ? 'numeric' : undefined,
			hour: 'numeric',
			minute: '2-digit'
		});
		return { rel, abs };
	}

	const placements: { id: Tier; label: string; hint: string; Icon: typeof Library }[] = [
		{ id: 'library', label: 'Library', hint: 'At rest', Icon: Library },
		{ id: 'shortlist', label: 'Shortlist', hint: 'Considering', Icon: Bookmark },
		{ id: 'active', label: 'Active', hint: 'Doing now', Icon: Crosshair }
	];
</script>

<svelte:window onkeydown={open ? handleKey : null} />

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
			aria-labelledby="editor-title"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div>
					<p id="editor-title" class="font-display-soft text-lg leading-none">
						{item ? 'Edit' : 'New entry'}
					</p>
					<p
						class="mt-1 font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						{item ? `#${item.id}` : 'Draft'}
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
				<label class="block">
					<span
						class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						Name
					</span>
					<input
						bind:this={nameInput}
						type="text"
						bind:value={name}
						placeholder="What is it?"
						class="w-full border-0 border-b border-[var(--color-hairline-strong)] bg-transparent px-0 py-2 font-display-soft text-2xl text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-emerald)]"
					/>
				</label>

				<label class="block">
					<span
						class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						Category
					</span>
					<input
						type="text"
						bind:value={category}
						list="category-suggestions"
						placeholder="Cook · Watch · Read · Build…"
						class="w-full border-0 border-b border-[var(--color-hairline)] bg-transparent px-0 py-1.5 text-sm text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-emerald)]"
					/>
					<datalist id="category-suggestions">
						{#each categories as c}
							<option value={c}></option>
						{/each}
					</datalist>
				</label>

				<div>
					<div class="mb-1.5 flex items-baseline justify-between">
						<span
							class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
						>
							Tags
						</span>
						<span class="font-mono text-[10px] text-[var(--color-faint)]">comma-separated</span>
					</div>
					<input
						type="text"
						bind:value={tagsText}
						placeholder="quick, italian, weeknight"
						class="w-full border-0 border-b border-[var(--color-hairline)] bg-transparent px-0 py-1.5 text-sm text-[var(--color-text-bright)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-emerald)]"
					/>
					{#if tagSuggestions.length}
						<div class="mt-3 flex flex-wrap gap-1">
							{#each tagSuggestions as t}
								{@const on = currentTags.includes(t)}
								<button
									type="button"
									onclick={() => addTagSuggestion(t)}
									class="suggest-chip"
									class:on
								>
									{on ? '−' : '+'} {t}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<label class="block">
					<span
						class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						Notes <span class="text-[var(--color-faint)] normal-case">— optional</span>
					</span>
					<textarea
						bind:value={notes}
						rows="3"
						placeholder="Why, ingredients, link, mood…"
						class="block w-full resize-none rounded-md border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-2.5 py-2 text-sm leading-relaxed text-[var(--color-text)] outline-none placeholder:text-[var(--color-faint)] focus:border-[var(--color-emerald)]"
					></textarea>
				</label>

				<div>
					<span
						class="mb-2 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
					>
						State
					</span>
					<div class="grid grid-cols-3 gap-1.5">
						{#each placements as p}
							<button
								type="button"
								onclick={() => (placement = p.id)}
								class="placement-tile"
								data-tier={p.id}
								class:selected={placement === p.id}
							>
								<p.Icon size={16} strokeWidth={1.5} />
								<span class="placement-label">{p.label}</span>
								<span class="placement-hint">{p.hint}</span>
							</button>
						{/each}
					</div>
				</div>

				{#if item && completedAt.length}
					<div>
						<div class="mb-2 flex items-baseline justify-between">
							<span
								class="font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase"
							>
								Done · history
							</span>
							<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
								{completedAt.length}
							</span>
						</div>
						<ul class="overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)]">
							{#each [...completedAt].sort((a, b) => b - a) as ts, i (ts)}
								{@const f = formatCompletion(ts)}
								<li
									class="flex items-center gap-2 px-3 py-2"
									class:divider={i > 0}
								>
									<Check
										size={12}
										strokeWidth={2}
										class="text-[var(--color-emerald)] shrink-0"
									/>
									<span class="flex-1 text-xs text-[var(--color-text)]">
										{f.rel}
									</span>
									<span class="font-mono text-[10px] text-[var(--color-faint)] tabular-nums">
										{f.abs}
									</span>
									<button
										type="button"
										onclick={() => removeEntry(ts)}
										class="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-paper-3)] hover:text-[var(--color-danger)]"
										aria-label="Remove this completion entry"
										title="Remove entry"
									>
										<X size={12} strokeWidth={1.5} />
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<footer
				class="flex items-center justify-between gap-2 border-t border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-5 py-3"
			>
				{#if item && canEdit}
					<button
						type="button"
						onclick={remove}
						class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)]"
					>
						<Trash2 size={13} strokeWidth={1.5} /> Delete
					</button>
				{:else}
					<span class="font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase">
						{canEdit ? '' : 'View only'}
					</span>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						onclick={onClose}
						class="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
					>
						{canEdit ? 'Cancel' : 'Close'}
					</button>
					{#if canEdit}
						<button
							type="button"
							onclick={save}
							disabled={!name.trim() || !category.trim() || saving}
							class="rounded-md bg-[var(--color-emerald)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--color-ink-deep)] uppercase transition-opacity hover:bg-[var(--color-emerald-bright)] disabled:opacity-30"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
					{/if}
				</div>
			</footer>
		</div>
	</div>
{/if}

<style>
	.suggest-chip {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 9999px;
		border: 1px solid var(--color-hairline);
		color: var(--color-muted);
		background: transparent;
		transition: border-color 200ms, color 200ms, background 200ms;
	}
	.suggest-chip:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.suggest-chip.on {
		border-color: var(--color-emerald);
		color: var(--color-emerald);
		background: color-mix(in oklab, var(--color-emerald) 14%, transparent);
	}

	.placement-tile {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 12px 12px 10px;
		border-radius: 0.625rem;
		border: 1px solid var(--color-hairline);
		background: var(--color-paper-2);
		color: var(--color-muted);
		transition: border-color 200ms, color 200ms, background 200ms;
		text-align: left;
	}
	.placement-tile:hover {
		border-color: var(--color-hairline-strong);
		color: var(--color-text);
	}
	.placement-label {
		font-family: var(--font-display);
		font-variation-settings: 'wght' 600;
		letter-spacing: -0.01em;
		font-size: 13px;
		color: var(--color-text-bright);
	}
	.placement-hint {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-faint);
	}
	.placement-tile.selected[data-tier='library'] {
		border-color: var(--color-slate);
		background: color-mix(in oklab, var(--color-slate) 10%, var(--color-paper-2));
	}
	.placement-tile.selected[data-tier='library'] .placement-hint {
		color: var(--color-slate);
	}
	.placement-tile.selected[data-tier='shortlist'] {
		border-color: var(--color-amber);
		background: color-mix(in oklab, var(--color-amber) 10%, var(--color-paper-2));
	}
	.placement-tile.selected[data-tier='shortlist'] .placement-hint {
		color: var(--color-amber);
	}
	.placement-tile.selected[data-tier='active'] {
		border-color: var(--color-emerald);
		background: color-mix(in oklab, var(--color-emerald) 10%, var(--color-paper-2));
	}
	.placement-tile.selected[data-tier='active'] .placement-hint {
		color: var(--color-emerald);
	}
	.divider {
		border-top: 1px solid var(--color-hairline);
	}
</style>
