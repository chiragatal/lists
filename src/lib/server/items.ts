import type { D1Database } from '@cloudflare/workers-types';

export type ApiItem = {
	id: number;
	name: string;
	category: string;
	tags: string[];
	notes?: string;
	completedAt?: number[];
	inShortlist: 0 | 1;
	inActive: 0 | 1;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
};

type Row = {
	id: number;
	name: string;
	category: string;
	tags: string;
	notes: string | null;
	completed_at: string;
	in_shortlist: number;
	in_active: number;
	sort_order: number;
	created_at: number;
	updated_at: number;
};

const COLS =
	'id, name, category, tags, notes, completed_at, in_shortlist, in_active, sort_order, created_at, updated_at';

export function rowToItem(row: Row): ApiItem {
	const completed = row.completed_at && row.completed_at !== '[]' ? JSON.parse(row.completed_at) : [];
	return {
		id: row.id,
		name: row.name,
		category: row.category,
		tags: row.tags ? JSON.parse(row.tags) : [],
		notes: row.notes ?? undefined,
		completedAt: completed.length ? completed : undefined,
		inShortlist: (row.in_shortlist ? 1 : 0) as 0 | 1,
		inActive: (row.in_active ? 1 : 0) as 0 | 1,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export async function listItems(db: D1Database, userId: string): Promise<ApiItem[]> {
	const result = await db
		.prepare(`SELECT ${COLS} FROM items WHERE user_id = ? ORDER BY sort_order ASC, id ASC`)
		.bind(userId)
		.all<Row>();
	return (result.results ?? []).map(rowToItem);
}

export async function getItem(db: D1Database, userId: string, id: number): Promise<ApiItem | null> {
	const row = await db
		.prepare(`SELECT ${COLS} FROM items WHERE user_id = ? AND id = ?`)
		.bind(userId, id)
		.first<Row>();
	return row ? rowToItem(row) : null;
}

async function nextSortOrder(db: D1Database, userId: string): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM items WHERE user_id = ?')
		.bind(userId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

export type CreateInput = {
	name: string;
	category: string;
	tags?: string[];
	notes?: string;
	tier?: 'library' | 'shortlist' | 'active';
	sortOrder?: number;
	createdAt?: number;
	updatedAt?: number;
	completedAt?: number[];
};

export async function createItem(
	db: D1Database,
	userId: string,
	input: CreateInput
): Promise<ApiItem> {
	const now = Date.now();
	const sortOrder = input.sortOrder ?? (await nextSortOrder(db, userId));
	const tier = input.tier ?? 'library';
	const inShortlist = tier === 'shortlist' ? 1 : 0;
	const inActive = tier === 'active' ? 1 : 0;
	const row = await db
		.prepare(
			`INSERT INTO items (user_id, name, category, tags, notes, completed_at, in_shortlist, in_active, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING ${COLS}`
		)
		.bind(
			userId,
			input.name.trim(),
			input.category.trim(),
			JSON.stringify(input.tags ?? []),
			input.notes?.trim() || null,
			JSON.stringify(input.completedAt ?? []),
			inShortlist,
			inActive,
			sortOrder,
			input.createdAt ?? now,
			input.updatedAt ?? now
		)
		.first<Row>();
	if (!row) throw new Error('Insert failed');
	return rowToItem(row);
}

export type UpdateInput = Partial<{
	name: string;
	category: string;
	tags: string[];
	notes: string | null;
	completedAt: number[];
	inShortlist: 0 | 1;
	inActive: 0 | 1;
	sortOrder: number;
}>;

export async function updateItem(
	db: D1Database,
	userId: string,
	id: number,
	patch: UpdateInput
): Promise<ApiItem | null> {
	const setParts: string[] = [];
	const args: unknown[] = [];
	if (patch.name !== undefined) {
		setParts.push('name = ?');
		args.push(patch.name.trim());
	}
	if (patch.category !== undefined) {
		setParts.push('category = ?');
		args.push(patch.category.trim());
	}
	if (patch.tags !== undefined) {
		setParts.push('tags = ?');
		args.push(JSON.stringify(patch.tags));
	}
	if (patch.notes !== undefined) {
		setParts.push('notes = ?');
		args.push(patch.notes ? patch.notes.trim() : null);
	}
	if (patch.completedAt !== undefined) {
		setParts.push('completed_at = ?');
		args.push(JSON.stringify(patch.completedAt));
	}
	if (patch.inShortlist !== undefined) {
		setParts.push('in_shortlist = ?');
		args.push(patch.inShortlist);
	}
	if (patch.inActive !== undefined) {
		setParts.push('in_active = ?');
		args.push(patch.inActive);
	}
	if (patch.sortOrder !== undefined) {
		setParts.push('sort_order = ?');
		args.push(patch.sortOrder);
	}
	setParts.push('updated_at = ?');
	args.push(Date.now());
	args.push(userId, id);

	const row = await db
		.prepare(
			`UPDATE items SET ${setParts.join(', ')} WHERE user_id = ? AND id = ? RETURNING ${COLS}`
		)
		.bind(...args)
		.first<Row>();
	return row ? rowToItem(row) : null;
}

export async function deleteItem(db: D1Database, userId: string, id: number): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM items WHERE user_id = ? AND id = ?')
		.bind(userId, id)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function setTier(
	db: D1Database,
	userId: string,
	id: number,
	tier: 'library' | 'shortlist' | 'active'
): Promise<ApiItem | null> {
	const item = await getItem(db, userId, id);
	if (!item) return null;
	const wasActiveOrShortlist = item.inActive === 1 || item.inShortlist === 1;
	const inShortlist: 0 | 1 = tier === 'shortlist' ? 1 : 0;
	const inActive: 0 | 1 = tier === 'active' ? 1 : 0;

	const patch: UpdateInput = { inShortlist, inActive };
	// Append a completion timestamp when moving Active/Shortlist → Library.
	if (tier === 'library' && wasActiveOrShortlist) {
		patch.completedAt = [...(item.completedAt ?? []), Date.now()];
	}
	return updateItem(db, userId, id, patch);
}

export async function clearActive(db: D1Database, userId: string): Promise<number> {
	const r = await db
		.prepare(
			'UPDATE items SET in_active = 0, in_shortlist = 0, updated_at = ? WHERE user_id = ? AND in_active = 1'
		)
		.bind(Date.now(), userId)
		.run();
	return r.meta.changes ?? 0;
}

export async function reorderItems(db: D1Database, userId: string, orderedIds: number[]) {
	const now = Date.now();
	const statements = orderedIds.map((id, idx) =>
		db
			.prepare('UPDATE items SET sort_order = ?, updated_at = ? WHERE user_id = ? AND id = ?')
			.bind(idx * 1000, now, userId, id)
	);
	if (statements.length === 0) return;
	await db.batch(statements);
}

export async function removeCompletion(
	db: D1Database,
	userId: string,
	id: number,
	ts: number
): Promise<ApiItem | null> {
	const item = await getItem(db, userId, id);
	if (!item) return null;
	const next = (item.completedAt ?? []).filter((t) => t !== ts);
	return updateItem(db, userId, id, { completedAt: next });
}

export async function renameCategory(
	db: D1Database,
	userId: string,
	from: string,
	to: string
): Promise<number> {
	const trimmed = to.trim();
	if (!trimmed || trimmed === from) return 0;
	const r = await db
		.prepare(
			'UPDATE items SET category = ?, updated_at = ? WHERE user_id = ? AND category = ?'
		)
		.bind(trimmed, Date.now(), userId, from)
		.run();
	return r.meta.changes ?? 0;
}

export async function renameTag(
	db: D1Database,
	userId: string,
	from: string,
	to: string
): Promise<number> {
	const trimmed = to.trim();
	if (!trimmed || trimmed === from) return 0;
	// SQLite JSON path: we update each row that has the tag.
	const rows = await db
		.prepare(`SELECT ${COLS} FROM items WHERE user_id = ?`)
		.bind(userId)
		.all<Row>();
	const affected: { id: number; tags: string[] }[] = [];
	for (const r of rows.results ?? []) {
		const tags: string[] = r.tags ? JSON.parse(r.tags) : [];
		if (!tags.includes(from)) continue;
		const next = [...new Set(tags.map((t) => (t === from ? trimmed : t)))];
		affected.push({ id: r.id, tags: next });
	}
	if (affected.length === 0) return 0;
	const now = Date.now();
	const statements = affected.map((a) =>
		db
			.prepare('UPDATE items SET tags = ?, updated_at = ? WHERE user_id = ? AND id = ?')
			.bind(JSON.stringify(a.tags), now, userId, a.id)
	);
	await db.batch(statements);
	return affected.length;
}

export async function eraseAllItems(db: D1Database, userId: string): Promise<number> {
	const r = await db.prepare('DELETE FROM items WHERE user_id = ?').bind(userId).run();
	return r.meta.changes ?? 0;
}

export async function bulkImport(
	db: D1Database,
	userId: string,
	items: CreateInput[],
	mode: 'replace' | 'merge'
): Promise<number> {
	if (mode === 'replace') {
		await eraseAllItems(db, userId);
	}
	// Allocate sort order range above existing max so merges don't collide.
	let base = await nextSortOrder(db, userId);
	const now = Date.now();
	const statements = items.map((it, idx) => {
		const tier = it.tier ?? 'library';
		return db
			.prepare(
				`INSERT INTO items (user_id, name, category, tags, notes, completed_at, in_shortlist, in_active, sort_order, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				userId,
				(it.name || 'Untitled').trim(),
				(it.category || '').trim(),
				JSON.stringify(it.tags ?? []),
				it.notes?.trim() || null,
				JSON.stringify(it.completedAt ?? []),
				tier === 'shortlist' ? 1 : 0,
				tier === 'active' ? 1 : 0,
				it.sortOrder ?? base + idx * 10,
				it.createdAt ?? now,
				it.updatedAt ?? now
			);
	});
	if (statements.length === 0) return 0;
	await db.batch(statements);
	return statements.length;
}
