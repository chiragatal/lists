import { liveQuery } from 'dexie';
import { db, type Item, type Tier } from './db';

export function itemsByTier(tier: Tier) {
	return liveQuery(() => {
		switch (tier) {
			case 'library':
				return db.items.orderBy('updatedAt').reverse().toArray();
			case 'shortlist':
				return db.items
					.where('inShortlist')
					.equals(1)
					.toArray()
					.then((rows) => rows.sort((a, b) => b.updatedAt - a.updatedAt));
			case 'active':
				return db.items
					.where('inActive')
					.equals(1)
					.toArray()
					.then((rows) => rows.sort((a, b) => b.updatedAt - a.updatedAt));
		}
	});
}

export async function addItem(input: {
	name: string;
	category: string;
	tags: string[];
	tier: Tier;
}): Promise<number> {
	const now = Date.now();
	const item: Item = {
		name: input.name.trim(),
		category: input.category.trim(),
		tags: input.tags.map((t) => t.trim()).filter(Boolean),
		inShortlist: input.tier === 'shortlist' || input.tier === 'active' ? 1 : 0,
		inActive: input.tier === 'active' ? 1 : 0,
		createdAt: now,
		updatedAt: now
	};
	return (await db.items.add(item)) as number;
}

export async function updateItem(id: number, patch: Partial<Item>) {
	await db.items.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setTierFlag(id: number, tier: Tier, on: boolean) {
	const patch: Partial<Item> = { updatedAt: Date.now() };
	if (tier === 'shortlist') {
		patch.inShortlist = on ? 1 : 0;
		if (!on) patch.inActive = 0;
	} else if (tier === 'active') {
		patch.inActive = on ? 1 : 0;
		if (on) patch.inShortlist = 1;
	}
	await db.items.update(id, patch);
}

export async function deleteItem(id: number) {
	await db.items.delete(id);
}

export async function checkOffActive(id: number) {
	await db.items.update(id, { inActive: 0, updatedAt: Date.now() });
}

export async function clearActive() {
	const ids = await db.items.where('inActive').equals(1).primaryKeys();
	await db.items.bulkUpdate(
		ids.map((id) => ({
			key: id as number,
			changes: { inActive: 0, updatedAt: Date.now() }
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
