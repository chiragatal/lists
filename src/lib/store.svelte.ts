import type { Item, Tier } from './db';

export function tierOf(item: Item): Tier {
	if (item.inActive === 1) return 'active';
	if (item.inShortlist === 1) return 'shortlist';
	return 'library';
}

type UserSummary = { email: string; name: string | null; picture: string | null };

async function api<T = unknown>(
	url: string,
	init?: RequestInit & { json?: unknown }
): Promise<T> {
	const opts: RequestInit = { ...init };
	if (init?.json !== undefined) {
		opts.body = JSON.stringify(init.json);
		opts.headers = { 'content-type': 'application/json', ...(init.headers ?? {}) };
	}
	const res = await fetch(url, opts);
	if (res.status === 401) {
		if (typeof window !== 'undefined') {
			window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
		}
		throw new Error('unauthorized');
	}
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Request failed (${res.status}): ${text}`);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

class ListsStore {
	items = $state<Item[]>([]);
	user = $state<UserSummary | null>(null);
	currentPlanId = $state<number | null>(null);
	currentPlanName = $state<string>('');
	isLoaded = $state(false); // loaded for currentPlanId
	isLoading = $state(false);
	error = $state<string | null>(null);

	async loadUser() {
		if (this.user) return;
		try {
			this.user = await api<UserSummary>('/api/me');
		} catch {
			/* ignore — drawer just won't show account until next try */
		}
	}

	async ensurePlan(planId: number) {
		if (this.isLoaded && this.currentPlanId === planId) return;
		await this.loadPlan(planId);
	}

	async loadPlan(planId: number) {
		this.isLoading = true;
		this.error = null;
		try {
			const data = await api<{ items: Item[]; plan: { id: number; name: string } }>(
				`/api/items?plan=${planId}`
			);
			this.items = data.items;
			this.currentPlanId = planId;
			this.currentPlanName = data.plan?.name ?? '';
			this.isLoaded = true;
		} catch (e) {
			this.error = (e as Error).message;
		} finally {
			this.isLoading = false;
		}
	}

	async reload() {
		if (this.currentPlanId != null) await this.loadPlan(this.currentPlanId);
	}
}

export const lists = new ListsStore();

// --- Selectors / pure helpers ------------------------------------------------

export function itemsByTier(tier: Tier): Item[] {
	return lists.items
		.filter((it) => {
			if (tier === 'active') return it.inActive === 1;
			if (tier === 'shortlist') return it.inShortlist === 1 && it.inActive !== 1;
			return true; // library shows everything
		})
		.sort((a, b) => {
			const ao = a.sortOrder ?? a.updatedAt;
			const bo = b.sortOrder ?? b.updatedAt;
			return ao - bo;
		});
}

export function allCategories(): string[] {
	const set = new Set<string>();
	for (const it of lists.items) if (it.category) set.add(it.category);
	return [...set].sort();
}

export function tagsForCategory(category: string): string[] {
	if (!category) return [];
	const set = new Set<string>();
	for (const it of lists.items) {
		if (it.category !== category) continue;
		for (const t of it.tags) set.add(t);
	}
	return [...set].sort();
}

// --- Mutations ---------------------------------------------------------------

export async function addItem(input: {
	name: string;
	category: string;
	tags: string[];
	notes?: string;
	tier: Tier;
}): Promise<number> {
	if (lists.currentPlanId == null) throw new Error('No plan selected');
	const item = await api<Item>('/api/items', {
		method: 'POST',
		json: { ...input, planId: lists.currentPlanId }
	});
	// Defensive: never let the same id appear twice in local state.
	const existsAt = lists.items.findIndex((it) => it.id === item.id);
	if (existsAt >= 0) {
		lists.items = lists.items.map((it) => (it.id === item.id ? item : it));
	} else {
		lists.items = [...lists.items, item];
	}
	return item.id;
}

export async function updateItem(id: number, patch: Partial<Item>) {
	const item = await api<Item>(`/api/items/${id}`, { method: 'PATCH', json: patch });
	lists.items = lists.items.map((it) => (it.id === id ? item : it));
	return item;
}

export async function setItemTier(id: number, tier: Tier) {
	const item = await api<Item>(`/api/items/${id}/tier`, {
		method: 'POST',
		json: { tier }
	});
	lists.items = lists.items.map((it) => (it.id === id ? item : it));
}

export async function deleteItem(id: number) {
	await api(`/api/items/${id}`, { method: 'DELETE' });
	lists.items = lists.items.filter((it) => it.id !== id);
}

export async function clearActive() {
	if (lists.currentPlanId == null) return;
	await api('/api/items/clear-active', {
		method: 'POST',
		json: { planId: lists.currentPlanId }
	});
	// Reflect locally: any active item becomes library (we also cleared shortlist on the server)
	lists.items = lists.items.map((it) =>
		it.inActive === 1 ? { ...it, inActive: 0, inShortlist: 0 } : it
	);
}

export async function reorderItems(orderedIds: number[]) {
	await api('/api/items/reorder', { method: 'POST', json: { ids: orderedIds } });
	const pos = new Map<number, number>();
	orderedIds.forEach((id, idx) => pos.set(id, idx * 1000));
	lists.items = lists.items.map((it) =>
		pos.has(it.id) ? { ...it, sortOrder: pos.get(it.id)! } : it
	);
}

export async function removeCompletion(id: number, ts: number) {
	const item = await api<Item>(`/api/items/${id}/completion?ts=${ts}`, {
		method: 'DELETE'
	});
	lists.items = lists.items.map((it) => (it.id === id ? item : it));
}

export async function renameCategory(from: string, to: string) {
	if (lists.currentPlanId == null) return 0;
	const { updated } = await api<{ updated: number }>('/api/items/rename-category', {
		method: 'POST',
		json: { planId: lists.currentPlanId, from, to }
	});
	await lists.reload();
	return updated;
}

export async function renameTag(from: string, to: string) {
	if (lists.currentPlanId == null) return 0;
	const { updated } = await api<{ updated: number }>('/api/items/rename-tag', {
		method: 'POST',
		json: { planId: lists.currentPlanId, from, to }
	});
	await lists.reload();
	return updated;
}

export async function exportAll(): Promise<string> {
	// Full backup: Plans items + checklists (with items + history).
	const data = await api<unknown>('/api/export');
	return JSON.stringify(data, null, 2);
}

export async function importAll(jsonText: string, mode: 'replace' | 'merge' = 'merge') {
	const parsed = JSON.parse(jsonText);
	const hasData =
		Array.isArray(parsed?.plans) ||
		Array.isArray(parsed?.items) ||
		Array.isArray(parsed) ||
		Array.isArray(parsed?.checklists);
	if (!hasData) {
		throw new Error('Invalid backup file: no plans, items, or checklists found.');
	}
	const result = await api<{ plans: number; items: number; checklists: number }>('/api/import', {
		method: 'POST',
		json: { data: parsed, mode }
	});
	// Caller reloads the page after import, so no local refresh needed here.
	return (result.plans ?? 0) + (result.items ?? 0) + result.checklists;
}

export async function eraseAll() {
	// "Erase all" now means "delete account + all data". The server
	// clears the cookie; we just navigate to /login.
	await api('/api/me', { method: 'DELETE' });
	if (typeof window !== 'undefined') {
		window.location.href = '/login';
	}
}

export async function signOut() {
	await fetch('/api/auth/logout', { method: 'POST' });
	if (typeof window !== 'undefined') {
		window.location.href = '/login';
	}
}
