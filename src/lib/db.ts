import Dexie, { type Table } from 'dexie';

export type Tier = 'library' | 'shortlist' | 'active';

export interface Item {
	id?: number;
	name: string;
	category: string;
	tags: string[];
	notes?: string;
	inShortlist: 0 | 1;
	inActive: 0 | 1;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
}

class ListsDB extends Dexie {
	items!: Table<Item, number>;

	constructor() {
		super('lists');
		this.version(1).stores({
			items: '++id, name, category, inShortlist, inActive, createdAt, updatedAt, *tags'
		});
		this.version(2)
			.stores({
				items:
					'++id, name, category, inShortlist, inActive, sortOrder, createdAt, updatedAt, *tags'
			})
			.upgrade(async (tx) => {
				const table = tx.table<Item>('items');
				const all = await table.toArray();
				all.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
				for (let i = 0; i < all.length; i++) {
					await table.update(all[i].id!, { sortOrder: i * 1000 });
				}
			});
	}
}

export const db = new ListsDB();
