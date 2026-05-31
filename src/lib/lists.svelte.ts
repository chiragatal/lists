export type ListType = 'plan' | 'checklist';
export type Role = 'owner' | 'editor' | 'viewer';
export type Tier = 'library' | 'shortlist' | 'active';
export type ChecklistState = 'pending' | 'done' | 'skipped';

export type PlanCounts = { total: number; active: number; shortlist: number; library: number };
export type ChecklistCounts = { total: number; done: number; skipped: number; pending: number };

export type List = {
	id: number;
	type: ListType;
	name: string;
	sortOrder: number;
	lastResetAt: number | null;
	createdAt: number;
	updatedAt: number;
	role: Role;
	shared: boolean;
	ownerEmail?: string;
	counts: PlanCounts | ChecklistCounts;
};

export type Item = {
	id: number;
	listId: number;
	name: string;
	category: string;
	sortOrder: number;
	// plan-only:
	tier?: Tier;
	tags?: string[];
	notes?: string;
	completedAt?: number[];
	// checklist-only:
	state?: ChecklistState;
	createdAt: number;
	updatedAt: number;
};

export type Snapshot = {
	id: number;
	createdAt: number;
	reason: string;
	doneCount: number;
	skippedCount: number;
	pendingCount: number;
	total: number;
	items: { name: string; category: string; state: ChecklistState }[];
};

type UserSummary = { email: string; name: string | null; picture: string | null };

async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
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
	// Index
	all = $state<List[]>([]);
	indexLoaded = $state(false);
	indexLoading = $state(false);
	user = $state<UserSummary | null>(null);

	// Detail
	current = $state<List | null>(null);
	items = $state<Item[]>([]);
	currentRole = $state<Role>('owner');
	detailLoading = $state(false);
	detailError = $state<string | null>(null);

	get canEdit(): boolean {
		return this.currentRole === 'owner' || this.currentRole === 'editor';
	}

	get isOwner(): boolean {
		return this.currentRole === 'owner';
	}

	async loadUser() {
		if (this.user) return;
		try {
			this.user = await api<UserSummary>('/api/me');
		} catch {
			/* ignore */
		}
	}

	async loadIndex() {
		this.indexLoading = true;
		try {
			const data = await api<{ lists: List[] }>('/api/lists');
			this.all = data.lists;
			this.indexLoaded = true;
		} finally {
			this.indexLoading = false;
		}
	}

	async ensureDetail(id: number) {
		if (this.current?.id === id && !this.detailLoading) return;
		await this.loadDetail(id);
	}

	async loadDetail(id: number) {
		this.detailLoading = true;
		this.detailError = null;
		try {
			const data = await api<{ list: List; items: Item[]; role: Role }>(`/api/lists/${id}`);
			this.current = data.list;
			this.items = data.items;
			this.currentRole = data.role ?? 'owner';
		} catch (e) {
			this.detailError = (e as Error).message;
			this.current = null;
			this.items = [];
		} finally {
			this.detailLoading = false;
		}
	}

	async reloadCurrent() {
		if (this.current) await this.loadDetail(this.current.id);
	}

	/* ---- list-level mutations ---- */

	async createList(type: ListType, name: string): Promise<number> {
		const l = await api<List>('/api/lists', { method: 'POST', json: { type, name } });
		this.all = [...this.all, l];
		return l.id;
	}

	async renameList(id: number, name: string) {
		await api(`/api/lists/${id}`, { method: 'PATCH', json: { name } });
		this.all = this.all.map((l) => (l.id === id ? { ...l, name } : l));
		if (this.current?.id === id) this.current = { ...this.current, name };
	}

	async deleteList(id: number) {
		await api(`/api/lists/${id}`, { method: 'DELETE' });
		this.all = this.all.filter((l) => l.id !== id);
		if (this.current?.id === id) {
			this.current = null;
			this.items = [];
		}
	}

	/* ---- item mutations (works for both types) ---- */

	private recountCurrent() {
		if (!this.current) return;
		if (this.current.type === 'plan') {
			const counts: PlanCounts = { total: this.items.length, active: 0, shortlist: 0, library: 0 };
			for (const it of this.items) {
				if (it.tier === 'active') counts.active++;
				else if (it.tier === 'shortlist') counts.shortlist++;
			}
			counts.library = counts.total;
			this.current = { ...this.current, counts };
		} else {
			const counts: ChecklistCounts = { total: this.items.length, done: 0, skipped: 0, pending: 0 };
			for (const it of this.items) {
				const s = it.state ?? 'pending';
				counts[s]++;
			}
			this.current = { ...this.current, counts };
		}
		// Mirror updated counts into the index entry so the index/drawer reflect immediately.
		const id = this.current.id;
		this.all = this.all.map((l) => (l.id === id ? { ...l, counts: this.current!.counts } : l));
	}

	async addItem(
		listId: number,
		input: {
			name: string;
			category: string;
			tier?: Tier;
			tags?: string[];
			notes?: string;
			state?: ChecklistState;
		}
	): Promise<Item> {
		const item = await api<Item>(`/api/lists/${listId}/items`, { method: 'POST', json: input });
		const existsAt = this.items.findIndex((it) => it.id === item.id);
		if (existsAt >= 0) {
			this.items = this.items.map((it) => (it.id === item.id ? item : it));
		} else {
			this.items = [...this.items, item];
		}
		this.recountCurrent();
		return item;
	}

	async updateItem(
		listId: number,
		itemId: number,
		patch: { name?: string; category?: string; tags?: string[]; notes?: string | null }
	): Promise<Item> {
		const item = await api<Item>(`/api/lists/${listId}/items/${itemId}`, {
			method: 'PATCH',
			json: patch
		});
		this.items = this.items.map((it) => (it.id === itemId ? item : it));
		return item;
	}

	async deleteItem(listId: number, itemId: number) {
		await api(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' });
		this.items = this.items.filter((it) => it.id !== itemId);
		this.recountCurrent();
	}

	async reorderItems(listId: number, orderedIds: number[]) {
		await api(`/api/lists/${listId}/items/reorder`, {
			method: 'POST',
			json: { ids: orderedIds }
		});
		const pos = new Map<number, number>();
		orderedIds.forEach((id, idx) => pos.set(id, idx * 1000));
		this.items = this.items
			.map((it) => (pos.has(it.id) ? { ...it, sortOrder: pos.get(it.id)! } : it))
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	/* ---- plan-only ---- */

	async setTier(listId: number, itemId: number, tier: Tier) {
		const item = await api<Item>(`/api/lists/${listId}/items/${itemId}/tier`, {
			method: 'POST',
			json: { tier }
		});
		this.items = this.items.map((it) => (it.id === itemId ? item : it));
		this.recountCurrent();
		return item;
	}

	async clearActive(listId: number) {
		await api(`/api/lists/${listId}/clear-active`, { method: 'POST' });
		this.items = this.items.map((it) =>
			it.tier === 'active' || it.tier === 'shortlist' ? { ...it, tier: 'library' } : it
		);
		this.recountCurrent();
	}

	async removeCompletion(listId: number, itemId: number, ts: number) {
		const item = await api<Item>(`/api/lists/${listId}/items/${itemId}/completion?ts=${ts}`, {
			method: 'DELETE'
		});
		this.items = this.items.map((it) => (it.id === itemId ? item : it));
	}

	async renameCategory(listId: number, from: string, to: string): Promise<number> {
		const { updated } = await api<{ updated: number }>(`/api/lists/${listId}/rename-category`, {
			method: 'POST',
			json: { from, to }
		});
		await this.reloadCurrent();
		return updated;
	}

	async renameTag(listId: number, from: string, to: string): Promise<number> {
		const { updated } = await api<{ updated: number }>(`/api/lists/${listId}/rename-tag`, {
			method: 'POST',
			json: { from, to }
		});
		await this.reloadCurrent();
		return updated;
	}

	/* ---- checklist-only ---- */

	async setItemState(listId: number, itemId: number, state: ChecklistState) {
		const prev = this.items;
		this.items = this.items.map((it) => (it.id === itemId ? { ...it, state } : it));
		this.recountCurrent();
		try {
			const item = await api<Item>(`/api/lists/${listId}/items/${itemId}/state`, {
				method: 'POST',
				json: { state }
			});
			this.items = this.items.map((it) => (it.id === itemId ? item : it));
			this.recountCurrent();
		} catch (e) {
			this.items = prev;
			this.recountCurrent();
			throw e;
		}
	}

	async reset(listId: number, mode: 'all' | 'done'): Promise<Snapshot> {
		const prev = this.items;
		this.items = this.items.map((it) => {
			if (mode === 'all' && it.state && it.state !== 'pending') return { ...it, state: 'pending' };
			if (mode === 'done' && it.state === 'done') return { ...it, state: 'pending' };
			return it;
		});
		this.recountCurrent();
		try {
			const result = await api<{ snapshot: Snapshot; list: List; items: Item[] }>(
				`/api/lists/${listId}/reset`,
				{ method: 'POST', json: { mode } }
			);
			this.current = result.list;
			this.items = result.items;
			this.all = this.all.map((l) => (l.id === listId ? result.list : l));
			return result.snapshot;
		} catch (e) {
			this.items = prev;
			this.recountCurrent();
			throw e;
		}
	}

	async loadHistory(listId: number): Promise<Snapshot[]> {
		const data = await api<{ snapshots: Snapshot[] }>(`/api/lists/${listId}/history`);
		return data.snapshots;
	}

	async deleteSnapshot(listId: number, snapshotId: number) {
		await api(`/api/lists/${listId}/history/${snapshotId}`, { method: 'DELETE' });
	}
}

export const lists = new ListsStore();

/* ---- selectors / pure helpers ---- */

export function itemsByTier(tier: Tier): Item[] {
	return lists.items
		.filter((it) => {
			if (tier === 'active') return it.tier === 'active';
			if (tier === 'shortlist') return it.tier === 'shortlist';
			return true; // library shows everything
		})
		.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
		for (const t of it.tags ?? []) set.add(t);
	}
	return [...set].sort();
}

export function groupChecklistItemsByCategory(
	items: Item[]
): { category: string; items: Item[] }[] {
	const map = new Map<string, Item[]>();
	for (const it of items) {
		const k = it.category || '—';
		if (!map.has(k)) map.set(k, []);
		map.get(k)!.push(it);
	}
	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([category, list]) => ({
			category,
			items: [...list].sort((a, b) => a.sortOrder - b.sortOrder)
		}));
}

/* ---- account-level ops kept here for convenience ---- */

export async function exportAll(): Promise<string> {
	const data = await api<unknown>('/api/export');
	return JSON.stringify(data, null, 2);
}

export async function importAll(jsonText: string, mode: 'replace' | 'merge' = 'merge') {
	const parsed = JSON.parse(jsonText);
	const hasData =
		Array.isArray(parsed?.lists) ||
		Array.isArray(parsed?.plans) ||
		Array.isArray(parsed?.checklists) ||
		Array.isArray(parsed?.items) ||
		Array.isArray(parsed);
	if (!hasData) throw new Error('Invalid backup file: no lists/plans/checklists/items found.');
	const result = await api<{ lists: number; items: number }>('/api/import', {
		method: 'POST',
		json: { data: parsed, mode }
	});
	return (result.lists ?? 0) + (result.items ?? 0);
}

export async function eraseAll() {
	await api('/api/me', { method: 'DELETE' });
	if (typeof window !== 'undefined') window.location.href = '/login';
}

export async function signOut() {
	await fetch('/api/auth/logout', { method: 'POST' });
	if (typeof window !== 'undefined') window.location.href = '/login';
}
