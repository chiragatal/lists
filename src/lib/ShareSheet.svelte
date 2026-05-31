<script lang="ts">
	import { X, Trash2, Plus } from './icons';

	type Member = { id: number; email: string; role: 'editor' | 'viewer'; pending: boolean };

	type Props = {
		open: boolean;
		listId: number;
		title: string;
		onClose: () => void;
	};

	let { open, listId, title, onClose }: Props = $props();

	const base = $derived(`/api/lists/${listId}/shares`);

	let members = $state<Member[]>([]);
	let loading = $state(false);
	let email = $state('');
	let role = $state<'editor' | 'viewer'>('editor');
	let busy = $state(false);
	let err = $state<string | null>(null);
	let emailInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!open) return;
		loading = true;
		err = null;
		fetch(base)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load members'))))
			.then((d) => (members = d.members))
			.catch((e) => (err = e.message))
			.finally(() => (loading = false));
		queueMicrotask(() => emailInput?.focus());
	});

	async function invite() {
		const e = email.trim().toLowerCase();
		if (!e || !e.includes('@') || busy) return;
		busy = true;
		err = null;
		try {
			const res = await fetch(base, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: e, role })
			});
			if (!res.ok) {
				const t = await res.text();
				throw new Error(t.replace(/^.*?:/, '').trim() || 'Could not share');
			}
			const m = (await res.json()) as Member;
			members = [...members.filter((x) => x.email !== m.email), m];
			email = '';
		} catch (e) {
			err = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	async function remove(id: number) {
		const prev = members;
		members = members.filter((m) => m.id !== id);
		const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
		if (!res.ok) members = prev;
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
			aria-label="Share"
		>
			<header
				class="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4"
			>
				<div class="min-w-0">
					<p class="font-display-soft text-lg leading-none">Share</p>
					<p class="mt-1 truncate font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase">
						{title}
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

			<div class="space-y-4 p-5">
				<div>
					<span class="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">
						Invite by email
					</span>
					<div class="flex gap-2">
						<input
							bind:this={emailInput}
							type="email"
							bind:value={email}
							placeholder="name@example.com"
							onkeydown={(e) => e.key === 'Enter' && invite()}
							class="min-w-0 flex-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3 py-2 text-sm text-[var(--color-text-bright)] outline-none focus:border-[var(--color-emerald)]"
						/>
						<select
							bind:value={role}
							class="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-2 py-2 text-sm text-[var(--color-text)]"
						>
							<option value="editor">Editor</option>
							<option value="viewer">Viewer</option>
						</select>
						<button
							type="button"
							onclick={invite}
							disabled={!email.trim() || busy}
							class="grid place-items-center rounded-lg bg-[var(--color-emerald)] px-3 text-[var(--color-ink-deep)] disabled:opacity-40"
							aria-label="Add"
						>
							<Plus size={16} strokeWidth={2} />
						</button>
					</div>
					{#if err}
						<p class="mt-2 text-xs text-[var(--color-danger)]">{err}</p>
					{/if}
					<p class="mt-2 text-[11px] leading-relaxed text-[var(--color-faint)]">
						Editors can change items; viewers can only look. People who haven't used the app yet
						get access when they first sign in with this email.
					</p>
				</div>

				<div>
					<span class="mb-2 block font-mono text-[10px] tracking-[0.18em] text-[var(--color-faint)] uppercase">
						Shared with
					</span>
					{#if loading}
						<p class="text-sm text-[var(--color-muted)]">Loading…</p>
					{:else if members.length === 0}
						<p class="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-3 py-3 text-xs text-[var(--color-muted)]">
							Not shared with anyone yet.
						</p>
					{:else}
						<ul class="overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-paper-2)]">
							{#each members as m, i (m.id)}
								<li class="flex items-center gap-2 px-3 py-2.5" class:divider={i > 0}>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-[var(--color-text)]">{m.email}</p>
										<p class="font-mono text-[10px] tracking-wide text-[var(--color-faint)] uppercase">
											{m.role}{m.pending ? ' · pending' : ''}
										</p>
									</div>
									<button
										type="button"
										onclick={() => remove(m.id)}
										class="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
										aria-label="Remove {m.email}"
									>
										<Trash2 size={13} strokeWidth={1.5} />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.divider {
		border-top: 1px solid var(--color-hairline);
	}
</style>
