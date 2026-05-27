export type ChecklistState = 'pending' | 'done' | 'skipped';

export type Checklist = {
	id: number;
	name: string;
	sortOrder: number;
	lastResetAt: number | null;
	createdAt: number;
	updatedAt: number;
	counts: { total: number; done: number; skipped: number; pending: number };
};

export type ChecklistItem = {
	id: number;
	checklistId: number;
	category: string;
	name: string;
	state: ChecklistState;
	sortOrder: number;
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

async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const opts: RequestInit = { ...init };
	if (init?.json !== undefined) {
		opts.body = JSON.stringify(init.json);
		opts.headers = { 'content-type': 'application/json', ...(init.headers ?? {}) };
	}
	const res = await fetch(url, opts);
	if (res.status === 401) {
		if (typeof window !== 'undefined') {
			window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
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

class ChecklistsStore {
	all = $state<Checklist[]>([]);
	indexLoaded = $state(false);
	indexLoading = $state(false);

	// Active checklist detail
	current = $state<Checklist | null>(null);
	items = $state<ChecklistItem[]>([]);
	detailLoading = $state(false);
	detailError = $state<string | null>(null);

	async loadIndex() {
		this.indexLoading = true;
		try {
			const data = await api<{ checklists: Checklist[] }>('/api/checklists');
			this.all = data.checklists;
			this.indexLoaded = true;
		} finally {
			this.indexLoading = false;
		}
	}

	async loadDetail(id: number) {
		this.detailLoading = true;
		this.detailError = null;
		this.current = null;
		this.items = [];
		try {
			const data = await api<{ checklist: Checklist; items: ChecklistItem[] }>(
				`/api/checklists/${id}`
			);
			this.current = data.checklist;
			this.items = data.items;
		} catch (e) {
			this.detailError = (e as Error).message;
		} finally {
			this.detailLoading = false;
		}
	}

	private recount() {
		if (!this.current) return;
		const counts = { total: this.items.length, done: 0, skipped: 0, pending: 0 };
		for (const it of this.items) counts[it.state]++;
		this.current = { ...this.current, counts };
	}

	async createChecklist(name: string): Promise<number> {
		const c = await api<Checklist>('/api/checklists', { method: 'POST', json: { name } });
		this.all = [...this.all, c];
		return c.id;
	}

	async renameChecklist(id: number, name: string) {
		await api(`/api/checklists/${id}`, { method: 'PATCH', json: { name } });
		this.all = this.all.map((c) => (c.id === id ? { ...c, name } : c));
		if (this.current?.id === id) this.current = { ...this.current, name };
	}

	async deleteChecklist(id: number) {
		await api(`/api/checklists/${id}`, { method: 'DELETE' });
		this.all = this.all.filter((c) => c.id !== id);
		if (this.current?.id === id) {
			this.current = null;
			this.items = [];
		}
	}

	async addItem(checklistId: number, name: string, category: string) {
		const item = await api<ChecklistItem>(`/api/checklists/${checklistId}/items`, {
			method: 'POST',
			json: { name, category }
		});
		this.items = [...this.items, item];
		this.recount();
		return item;
	}

	async updateItem(checklistId: number, itemId: number, patch: { name?: string; category?: string }) {
		const item = await api<ChecklistItem>(`/api/checklists/${checklistId}/items/${itemId}`, {
			method: 'PATCH',
			json: patch
		});
		this.items = this.items.map((it) => (it.id === itemId ? item : it));
		return item;
	}

	async deleteItem(checklistId: number, itemId: number) {
		await api(`/api/checklists/${checklistId}/items/${itemId}`, { method: 'DELETE' });
		this.items = this.items.filter((it) => it.id !== itemId);
		this.recount();
	}

	async setItemState(checklistId: number, itemId: number, state: ChecklistState) {
		// Optimistic update for snappy toggling.
		const prev = this.items;
		this.items = this.items.map((it) => (it.id === itemId ? { ...it, state } : it));
		this.recount();
		try {
			const item = await api<ChecklistItem>(
				`/api/checklists/${checklistId}/items/${itemId}/state`,
				{ method: 'POST', json: { state } }
			);
			this.items = this.items.map((it) => (it.id === itemId ? item : it));
			this.recount();
		} catch (e) {
			this.items = prev;
			this.recount();
			throw e;
		}
	}

	async reorderItems(checklistId: number, orderedIds: number[]) {
		await api(`/api/checklists/${checklistId}/items/reorder`, {
			method: 'POST',
			json: { ids: orderedIds }
		});
		const pos = new Map<number, number>();
		orderedIds.forEach((id, idx) => pos.set(id, idx * 1000));
		this.items = this.items
			.map((it) => (pos.has(it.id) ? { ...it, sortOrder: pos.get(it.id)! } : it))
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	async reset(checklistId: number, mode: 'all' | 'done'): Promise<Snapshot> {
		// Optimistic: apply the reset locally so the UI responds instantly,
		// then reconcile with the server (which also writes the snapshot).
		const prev = this.items;
		this.items = this.items.map((it) => {
			if (mode === 'all' && it.state !== 'pending') return { ...it, state: 'pending' };
			if (mode === 'done' && it.state === 'done') return { ...it, state: 'pending' };
			return it;
		});
		this.recount();
		try {
			const result = await api<{
				snapshot: Snapshot;
				checklist: Checklist;
				items: ChecklistItem[];
			}>(`/api/checklists/${checklistId}/reset`, { method: 'POST', json: { mode } });
			this.current = result.checklist;
			this.items = result.items;
			this.all = this.all.map((c) => (c.id === checklistId ? result.checklist : c));
			return result.snapshot;
		} catch (e) {
			this.items = prev;
			this.recount();
			throw e;
		}
	}

	async loadHistory(checklistId: number): Promise<Snapshot[]> {
		const data = await api<{ snapshots: Snapshot[] }>(`/api/checklists/${checklistId}/history`);
		return data.snapshots;
	}

	async deleteSnapshot(checklistId: number, snapshotId: number) {
		await api(`/api/checklists/${checklistId}/history/${snapshotId}`, { method: 'DELETE' });
	}
}

export const checklists = new ChecklistsStore();

export function groupItemsByCategory(
	items: ChecklistItem[]
): { category: string; items: ChecklistItem[] }[] {
	const map = new Map<string, ChecklistItem[]>();
	for (const it of items) {
		const k = it.category || '—';
		if (!map.has(k)) map.set(k, []);
		map.get(k)!.push(it);
	}
	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([category, list]) => ({
			category,
			// Sort by manual order so reorder persists across re-renders.
			items: [...list].sort((a, b) => a.sortOrder - b.sortOrder)
		}));
}
