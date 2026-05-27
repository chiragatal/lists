export type Plan = {
	id: number;
	name: string;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
	counts: { total: number; active: number; shortlist: number; library: number };
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

class PlansStore {
	all = $state<Plan[]>([]);
	loaded = $state(false);
	loading = $state(false);

	async loadIndex() {
		this.loading = true;
		try {
			const data = await api<{ plans: Plan[] }>('/api/plans');
			this.all = data.plans;
			this.loaded = true;
		} finally {
			this.loading = false;
		}
	}

	get(id: number): Plan | undefined {
		return this.all.find((p) => p.id === id);
	}

	async createPlan(name: string): Promise<number> {
		const p = await api<Plan>('/api/plans', { method: 'POST', json: { name } });
		this.all = [...this.all, p];
		return p.id;
	}

	async renamePlan(id: number, name: string) {
		await api(`/api/plans/${id}`, { method: 'PATCH', json: { name } });
		this.all = this.all.map((p) => (p.id === id ? { ...p, name } : p));
	}

	async deletePlan(id: number) {
		await api(`/api/plans/${id}`, { method: 'DELETE' });
		this.all = this.all.filter((p) => p.id !== id);
	}
}

export const plans = new PlansStore();
