import type { D1Database } from '@cloudflare/workers-types';

export type Tier = 'library' | 'shortlist' | 'active';
export type ChecklistState = 'pending' | 'done' | 'skipped';

export type ApiItem = {
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

type Row = {
	id: number;
	list_id: number;
	name: string;
	category: string;
	sort_order: number;
	tier: string | null;
	tags: string | null;
	notes: string | null;
	completed_at: string | null;
	state: string | null;
	created_at: number;
	updated_at: number;
};

const COLS =
	'id, list_id, name, category, sort_order, tier, tags, notes, completed_at, state, created_at, updated_at';

export function rowToItem(r: Row): ApiItem {
	const item: ApiItem = {
		id: r.id,
		listId: r.list_id,
		name: r.name,
		category: r.category,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	};
	if (r.tier) item.tier = r.tier as Tier;
	if (r.tags) {
		const parsed = JSON.parse(r.tags) as string[];
		if (parsed.length) item.tags = parsed;
	}
	if (r.notes) item.notes = r.notes;
	if (r.completed_at) {
		const parsed = JSON.parse(r.completed_at) as number[];
		if (parsed.length) item.completedAt = parsed;
	}
	if (r.state) item.state = r.state as ChecklistState;
	return item;
}

export async function listItems(db: D1Database, listId: number): Promise<ApiItem[]> {
	const result = await db
		.prepare(`SELECT ${COLS} FROM items WHERE list_id = ? ORDER BY sort_order ASC, id ASC`)
		.bind(listId)
		.all<Row>();
	return (result.results ?? []).map(rowToItem);
}

export async function getItem(db: D1Database, id: number): Promise<ApiItem | null> {
	const row = await db.prepare(`SELECT ${COLS} FROM items WHERE id = ?`).bind(id).first<Row>();
	return row ? rowToItem(row) : null;
}

/** The list an item belongs to — for access checks. */
export async function getItemListId(db: D1Database, id: number): Promise<number | null> {
	const r = await db
		.prepare('SELECT list_id FROM items WHERE id = ?')
		.bind(id)
		.first<{ list_id: number }>();
	return r?.list_id ?? null;
}

async function nextSortOrder(db: D1Database, listId: number): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM items WHERE list_id = ?')
		.bind(listId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

export type CreatePlanInput = {
	type: 'plan';
	name: string;
	category: string;
	tier?: Tier;
	tags?: string[];
	notes?: string;
	completedAt?: number[];
	sortOrder?: number;
	createdAt?: number;
	updatedAt?: number;
};
export type CreateChecklistInput = {
	type: 'checklist';
	name: string;
	category: string;
	state?: ChecklistState;
	sortOrder?: number;
	createdAt?: number;
	updatedAt?: number;
};
export type CreateInput = CreatePlanInput | CreateChecklistInput;

export async function createItem(
	db: D1Database,
	listId: number,
	input: CreateInput
): Promise<ApiItem> {
	const now = Date.now();
	const sortOrder = input.sortOrder ?? (await nextSortOrder(db, listId));
	const isPlan = input.type === 'plan';
	const tier = isPlan ? input.tier ?? 'library' : null;
	const tags = isPlan ? JSON.stringify(input.tags ?? []) : null;
	const notes = isPlan ? input.notes?.trim() || null : null;
	const completedAt = isPlan ? JSON.stringify(input.completedAt ?? []) : null;
	const state = !isPlan ? input.state ?? 'pending' : null;

	const row = await db
		.prepare(
			`INSERT INTO items (list_id, name, category, sort_order, tier, tags, notes, completed_at, state, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING ${COLS}`
		)
		.bind(
			listId,
			input.name.trim(),
			input.category.trim(),
			sortOrder,
			tier,
			tags,
			notes,
			completedAt,
			state,
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
	tier: Tier;
	tags: string[];
	notes: string | null;
	completedAt: number[];
	state: ChecklistState;
	sortOrder: number;
}>;

export async function updateItem(
	db: D1Database,
	id: number,
	patch: UpdateInput
): Promise<ApiItem | null> {
	const setParts: string[] = [];
	const args: unknown[] = [];
	const push = (col: string, val: unknown) => {
		setParts.push(`${col} = ?`);
		args.push(val);
	};
	if (patch.name !== undefined) push('name', patch.name.trim());
	if (patch.category !== undefined) push('category', patch.category.trim());
	if (patch.tier !== undefined) push('tier', patch.tier);
	if (patch.tags !== undefined) push('tags', JSON.stringify(patch.tags));
	if (patch.notes !== undefined) push('notes', patch.notes ? patch.notes.trim() : null);
	if (patch.completedAt !== undefined) push('completed_at', JSON.stringify(patch.completedAt));
	if (patch.state !== undefined) push('state', patch.state);
	if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);
	push('updated_at', Date.now());
	args.push(id);

	const row = await db
		.prepare(`UPDATE items SET ${setParts.join(', ')} WHERE id = ? RETURNING ${COLS}`)
		.bind(...args)
		.first<Row>();
	return row ? rowToItem(row) : null;
}

export async function deleteItem(db: D1Database, id: number): Promise<boolean> {
	const r = await db.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
	return (r.meta.changes ?? 0) > 0;
}

export async function setTier(db: D1Database, id: number, tier: Tier): Promise<ApiItem | null> {
	const item = await getItem(db, id);
	if (!item) return null;
	const wasShortlistOrActive = item.tier === 'shortlist' || item.tier === 'active';
	const patch: UpdateInput = { tier };
	if (tier === 'library' && wasShortlistOrActive) {
		patch.completedAt = [...(item.completedAt ?? []), Date.now()];
	}
	return updateItem(db, id, patch);
}

export async function clearActive(db: D1Database, listId: number): Promise<number> {
	const r = await db
		.prepare(
			"UPDATE items SET tier = 'library', updated_at = ? WHERE list_id = ? AND tier IN ('active', 'shortlist')"
		)
		.bind(Date.now(), listId)
		.run();
	return r.meta.changes ?? 0;
}

export async function reorderItems(db: D1Database, listId: number, orderedIds: number[]) {
	const now = Date.now();
	const statements = orderedIds.map((id, idx) =>
		db
			.prepare('UPDATE items SET sort_order = ?, updated_at = ? WHERE list_id = ? AND id = ?')
			.bind(idx * 1000, now, listId, id)
	);
	if (statements.length === 0) return;
	await db.batch(statements);
}

export async function removeCompletion(
	db: D1Database,
	id: number,
	ts: number
): Promise<ApiItem | null> {
	const item = await getItem(db, id);
	if (!item) return null;
	const next = (item.completedAt ?? []).filter((t) => t !== ts);
	return updateItem(db, id, { completedAt: next });
}

export async function renameCategory(
	db: D1Database,
	listId: number,
	from: string,
	to: string
): Promise<number> {
	const trimmed = to.trim();
	if (!trimmed || trimmed === from) return 0;
	const r = await db
		.prepare('UPDATE items SET category = ?, updated_at = ? WHERE list_id = ? AND category = ?')
		.bind(trimmed, Date.now(), listId, from)
		.run();
	return r.meta.changes ?? 0;
}

export async function renameTag(
	db: D1Database,
	listId: number,
	from: string,
	to: string
): Promise<number> {
	const trimmed = to.trim();
	if (!trimmed || trimmed === from) return 0;
	const rows = await db
		.prepare(`SELECT ${COLS} FROM items WHERE list_id = ? AND tags IS NOT NULL`)
		.bind(listId)
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
			.prepare('UPDATE items SET tags = ?, updated_at = ? WHERE id = ?')
			.bind(JSON.stringify(a.tags), now, a.id)
	);
	await db.batch(statements);
	return affected.length;
}

export async function bulkImport(
	db: D1Database,
	listId: number,
	items: CreateInput[]
): Promise<number> {
	if (items.length === 0) return 0;
	const base = await nextSortOrder(db, listId);
	const now = Date.now();
	const statements = items.map((it, idx) => {
		const isPlan = it.type === 'plan';
		const tier = isPlan ? it.tier ?? 'library' : null;
		const tags = isPlan ? JSON.stringify(it.tags ?? []) : null;
		const notes = isPlan ? it.notes?.trim() || null : null;
		const completedAt = isPlan ? JSON.stringify(it.completedAt ?? []) : null;
		const state = !isPlan ? it.state ?? 'pending' : null;
		return db
			.prepare(
				`INSERT INTO items (list_id, name, category, sort_order, tier, tags, notes, completed_at, state, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				listId,
				(it.name || 'Untitled').trim(),
				(it.category || '').trim(),
				it.sortOrder ?? base + idx * 10,
				tier,
				tags,
				notes,
				completedAt,
				state,
				it.createdAt ?? now,
				it.updatedAt ?? now
			);
	});
	await db.batch(statements);
	return statements.length;
}

/* ---------------- checklist state machine + reset ---------------- */

export type ResetMode = 'all' | 'done';

export async function resetChecklist(
	db: D1Database,
	listId: number,
	mode: ResetMode
): Promise<{ doneCount: number; skippedCount: number; pendingCount: number; total: number; items: { name: string; category: string; state: ChecklistState }[] }> {
	// Capture current state for the snapshot.
	const items = await listItems(db, listId);
	const snapItems = items.map((it) => ({
		name: it.name,
		category: it.category,
		state: (it.state ?? 'pending') as ChecklistState
	}));
	const total = items.length;
	const doneCount = snapItems.filter((i) => i.state === 'done').length;
	const skippedCount = snapItems.filter((i) => i.state === 'skipped').length;
	const pendingCount = total - doneCount - skippedCount;

	const now = Date.now();
	if (mode === 'all') {
		await db
			.prepare(
				"UPDATE items SET state = 'pending', updated_at = ? WHERE list_id = ? AND state IS NOT NULL"
			)
			.bind(now, listId)
			.run();
	} else {
		await db
			.prepare(
				"UPDATE items SET state = 'pending', updated_at = ? WHERE list_id = ? AND state = 'done'"
			)
			.bind(now, listId)
			.run();
	}

	await db
		.prepare('UPDATE lists SET last_reset_at = ?, updated_at = ? WHERE id = ?')
		.bind(now, now, listId)
		.run();

	return { doneCount, skippedCount, pendingCount, total, items: snapItems };
}
