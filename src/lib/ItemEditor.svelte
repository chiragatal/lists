<script lang="ts">
	import type { Item, Tier } from './db';
	import { addItem, updateItem, deleteItem, allCategories, tagsForCategory } from './store.svelte';

	type Props = {
		open: boolean;
		item?: Item | null;
		defaultTier: Tier;
		onClose: () => void;
	};

	let { open, item = null, defaultTier, onClose }: Props = $props();

	let name = $state('');
	let category = $state('');
	let tagsText = $state('');
	let inShortlist = $state(false);
	let inActive = $state(false);
	let categories = $state<string[]>([]);
	let tagSuggestions = $state<string[]>([]);

	$effect(() => {
		if (!open) return;
		if (item) {
			name = item.name;
			category = item.category;
			tagsText = item.tags.join(', ');
			inShortlist = item.inShortlist === 1;
			inActive = item.inActive === 1;
		} else {
			name = '';
			category = '';
			tagsText = '';
			inShortlist = defaultTier === 'shortlist' || defaultTier === 'active';
			inActive = defaultTier === 'active';
		}
		allCategories().then((c) => (categories = c));
	});

	$effect(() => {
		const c = category.trim();
		if (!c) {
			tagSuggestions = [];
			return;
		}
		tagsForCategory(c).then((t) => (tagSuggestions = t));
	});

	function parseTags(s: string): string[] {
		return s
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	function addTagSuggestion(t: string) {
		const current = parseTags(tagsText);
		if (current.includes(t)) return;
		tagsText = [...current, t].join(', ');
	}

	async function save() {
		const n = name.trim();
		const c = category.trim();
		if (!n || !c) return;
		const tags = parseTags(tagsText);
		if (item?.id != null) {
			await updateItem(item.id, {
				name: n,
				category: c,
				tags,
				inShortlist: inShortlist ? 1 : 0,
				inActive: inActive && inShortlist ? 1 : 0
			});
		} else {
			const tier: Tier = inActive ? 'active' : inShortlist ? 'shortlist' : 'library';
			await addItem({ name: n, category: c, tags, tier });
		}
		onClose();
	}

	async function remove() {
		if (item?.id != null && confirm('Delete this item?')) {
			await deleteItem(item.id);
			onClose();
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
		onclick={onClose}
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-t-2xl bg-[var(--color-surface)] p-5 shadow-2xl sm:rounded-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<h2 class="mb-4 text-lg font-semibold">
				{item ? 'Edit item' : 'New item'}
			</h2>

			<label class="mb-3 block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">Name</span>
				<input
					type="text"
					bind:value={name}
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
					placeholder="e.g. Pasta carbonara"
					autofocus
				/>
			</label>

			<label class="mb-3 block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">Category</span>
				<input
					type="text"
					bind:value={category}
					list="category-suggestions"
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
					placeholder="e.g. Cook"
				/>
				<datalist id="category-suggestions">
					{#each categories as c}
						<option value={c}></option>
					{/each}
				</datalist>
			</label>

			<label class="mb-2 block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]"
					>Tags <span class="text-[var(--color-muted)]/70">(comma-separated)</span></span
				>
				<input
					type="text"
					bind:value={tagsText}
					class="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
					placeholder="e.g. quick, italian, dinner"
				/>
			</label>

			{#if tagSuggestions.length}
				<div class="mb-3 flex flex-wrap gap-1.5">
					{#each tagSuggestions as t}
						<button
							type="button"
							onclick={() => addTagSuggestion(t)}
							class="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
						>
							+ {t}
						</button>
					{/each}
				</div>
			{/if}

			<div class="mb-5 flex flex-col gap-2 rounded-lg bg-[var(--color-bg)] p-3">
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={inShortlist}
						onchange={() => {
							if (!inShortlist) inActive = false;
						}}
					/>
					<span>⭐ In Shortlist</span>
				</label>
				<label class="flex items-center gap-2 text-sm" class:opacity-50={!inShortlist}>
					<input
						type="checkbox"
						bind:checked={inActive}
						disabled={!inShortlist}
						onchange={() => {
							if (inActive) inShortlist = true;
						}}
					/>
					<span>🎯 In Active</span>
				</label>
			</div>

			<div class="flex items-center gap-2">
				{#if item}
					<button
						onclick={remove}
						class="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
					>
						Delete
					</button>
				{/if}
				<div class="ml-auto flex gap-2">
					<button
						onclick={onClose}
						class="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
					>
						Cancel
					</button>
					<button
						onclick={save}
						disabled={!name.trim() || !category.trim()}
						class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
