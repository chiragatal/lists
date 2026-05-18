import { liveQuery } from 'dexie';
import { db, type Item, type Tier } from './db';

export function tierOf(item: Item): Tier {
	if (item.inActive === 1) return 'active';
	if (item.inShortlist === 1) return 'shortlist';
	return 'library';
}

export function itemsByTier(tier: Tier) {
	return liveQuery(async () => {
		let rows: Item[];
		switch (tier) {
			case 'active':
				rows = await db.items.where('inActive').equals(1).toArray();
				break;
			case 'shortlist':
				rows = await db.items.where('inShortlist').equals(1).toArray();
				rows = rows.filter((r) => r.inActive !== 1);
				break;
			case 'library':
				rows = await db.items.toArray();
				break;
		}
		return rows.sort((a, b) => {
			const ao = a.sortOrder ?? a.updatedAt;
			const bo = b.sortOrder ?? b.updatedAt;
			return ao - bo;
		});
	});
}

async function nextSortOrder(): Promise<number> {
	const last = await db.items.orderBy('sortOrder').last();
	return (last?.sortOrder ?? 0) + 1000;
}

export async function addItem(input: {
	name: string;
	category: string;
	tags: string[];
	notes?: string;
	tier: Tier;
}): Promise<number> {
	const now = Date.now();
	const item: Item = {
		name: input.name.trim(),
		category: input.category.trim(),
		tags: input.tags.map((t) => t.trim()).filter(Boolean),
		notes: input.notes?.trim() || undefined,
		inShortlist: input.tier === 'shortlist' ? 1 : 0,
		inActive: input.tier === 'active' ? 1 : 0,
		sortOrder: await nextSortOrder(),
		createdAt: now,
		updatedAt: now
	};
	return (await db.items.add(item)) as number;
}

export async function updateItem(id: number, patch: Partial<Item>) {
	await db.items.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setItemTier(id: number, tier: Tier) {
	const patch: Partial<Item> = {
		inShortlist: tier === 'shortlist' ? 1 : 0,
		inActive: tier === 'active' ? 1 : 0,
		updatedAt: Date.now()
	};
	await db.items.update(id, patch);
}

export async function deleteItem(id: number) {
	await db.items.delete(id);
}

export async function clearActive() {
	const ids = await db.items.where('inActive').equals(1).primaryKeys();
	await db.items.bulkUpdate(
		ids.map((id) => ({
			key: id as number,
			changes: { inActive: 0, inShortlist: 0, updatedAt: Date.now() }
		}))
	);
}

export async function reorderItems(orderedIds: number[]) {
	const now = Date.now();
	await db.items.bulkUpdate(
		orderedIds.map((id, idx) => ({
			key: id,
			changes: { sortOrder: idx * 1000, updatedAt: now }
		}))
	);
}

export async function allCategories(): Promise<string[]> {
	const items = await db.items.toArray();
	return Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort();
}

export async function tagsForCategory(category: string): Promise<string[]> {
	if (!category) return [];
	const items = await db.items.where('category').equals(category).toArray();
	const set = new Set<string>();
	for (const i of items) for (const t of i.tags) set.add(t);
	return Array.from(set).sort();
}

export async function exportAll(): Promise<string> {
	const items = await db.items.toArray();
	return JSON.stringify(
		{
			schema: 'lists.v2',
			exportedAt: new Date().toISOString(),
			items
		},
		null,
		2
	);
}

export async function importAll(json: string, mode: 'replace' | 'merge' = 'replace') {
	const parsed = JSON.parse(json);
	const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
	if (!items) throw new Error('Invalid backup file: missing items array.');

	const normalized: Item[] = items.map((raw: Partial<Item>, idx: number) => {
		const inActive = raw.inActive === 1 ? 1 : 0;
		const inShortlist = raw.inShortlist === 1 && inActive !== 1 ? 1 : 0;
		return {
			name: String(raw.name ?? '').trim() || 'Untitled',
			category: String(raw.category ?? '').trim(),
			tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
			notes: typeof raw.notes === 'string' ? raw.notes : undefined,
			inShortlist: inShortlist as 0 | 1,
			inActive: inActive as 0 | 1,
			sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : idx * 1000,
			createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
			updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
		};
	});

	if (mode === 'replace') {
		await db.items.clear();
	}
	await db.items.bulkAdd(normalized);
	return normalized.length;
}

export async function eraseAll() {
	await db.items.clear();
}
