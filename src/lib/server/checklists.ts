import type { D1Database } from '@cloudflare/workers-types';

export type ChecklistState = 'pending' | 'done' | 'skipped';

export type ApiChecklist = {
	id: number;
	name: string;
	sortOrder: number;
	lastResetAt: number | null;
	createdAt: number;
	updatedAt: number;
	counts: { total: number; done: number; skipped: number; pending: number };
};

export type ApiChecklistItem = {
	id: number;
	checklistId: number;
	category: string;
	name: string;
	state: ChecklistState;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
};

export type ApiSnapshot = {
	id: number;
	createdAt: number;
	reason: string;
	doneCount: number;
	skippedCount: number;
	pendingCount: number;
	total: number;
	items: { name: string; category: string; state: ChecklistState }[];
};

type ChecklistRow = {
	id: number;
	name: string;
	sort_order: number;
	last_reset_at: number | null;
	created_at: number;
	updated_at: number;
};

type ItemRow = {
	id: number;
	checklist_id: number;
	category: string;
	name: string;
	state: string;
	sort_order: number;
	created_at: number;
	updated_at: number;
};

const ITEM_COLS =
	'id, checklist_id, category, name, state, sort_order, created_at, updated_at';

function toItem(r: ItemRow): ApiChecklistItem {
	return {
		id: r.id,
		checklistId: r.checklist_id,
		category: r.category,
		name: r.name,
		state: (['pending', 'done', 'skipped'].includes(r.state) ? r.state : 'pending') as ChecklistState,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	};
}

export async function listChecklists(db: D1Database, userId: string): Promise<ApiChecklist[]> {
	const lists = await db
		.prepare(
			'SELECT id, name, sort_order, last_reset_at, created_at, updated_at FROM checklists WHERE user_id = ? ORDER BY sort_order ASC, id ASC'
		)
		.bind(userId)
		.all<ChecklistRow>();

	const rows = lists.results ?? [];
	if (rows.length === 0) return [];

	// Aggregate counts per checklist in one query.
	const counts = await db
		.prepare(
			`SELECT checklist_id,
			        COUNT(*) AS total,
			        SUM(CASE WHEN state = 'done' THEN 1 ELSE 0 END) AS done,
			        SUM(CASE WHEN state = 'skipped' THEN 1 ELSE 0 END) AS skipped,
			        SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending
			   FROM checklist_items WHERE user_id = ? GROUP BY checklist_id`
		)
		.bind(userId)
		.all<{ checklist_id: number; total: number; done: number; skipped: number; pending: number }>();

	const countMap = new Map<number, { total: number; done: number; skipped: number; pending: number }>();
	for (const c of counts.results ?? []) {
		countMap.set(c.checklist_id, {
			total: c.total,
			done: c.done ?? 0,
			skipped: c.skipped ?? 0,
			pending: c.pending ?? 0
		});
	}

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		sortOrder: r.sort_order,
		lastResetAt: r.last_reset_at,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		counts: countMap.get(r.id) ?? { total: 0, done: 0, skipped: 0, pending: 0 }
	}));
}

export async function getChecklist(
	db: D1Database,
	userId: string,
	id: number
): Promise<{ checklist: ApiChecklist; items: ApiChecklistItem[] } | null> {
	const row = await db
		.prepare(
			'SELECT id, name, sort_order, last_reset_at, created_at, updated_at FROM checklists WHERE user_id = ? AND id = ?'
		)
		.bind(userId, id)
		.first<ChecklistRow>();
	if (!row) return null;

	const itemsRes = await db
		.prepare(
			`SELECT ${ITEM_COLS} FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order ASC, id ASC`
		)
		.bind(id)
		.all<ItemRow>();
	const items = (itemsRes.results ?? []).map(toItem);

	const counts = { total: items.length, done: 0, skipped: 0, pending: 0 };
	for (const it of items) counts[it.state]++;

	return {
		checklist: {
			id: row.id,
			name: row.name,
			sortOrder: row.sort_order,
			lastResetAt: row.last_reset_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			counts
		},
		items
	};
}

async function nextChecklistSortOrder(db: D1Database, userId: string): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM checklists WHERE user_id = ?')
		.bind(userId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

async function nextItemSortOrder(db: D1Database, checklistId: number): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM checklist_items WHERE checklist_id = ?')
		.bind(checklistId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

export async function createChecklist(
	db: D1Database,
	userId: string,
	name: string
): Promise<ApiChecklist> {
	const now = Date.now();
	const sortOrder = await nextChecklistSortOrder(db, userId);
	const row = await db
		.prepare(
			'INSERT INTO checklists (user_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, sort_order, last_reset_at, created_at, updated_at'
		)
		.bind(userId, name.trim() || 'Untitled', sortOrder, now, now)
		.first<ChecklistRow>();
	if (!row) throw new Error('Insert failed');
	return {
		id: row.id,
		name: row.name,
		sortOrder: row.sort_order,
		lastResetAt: row.last_reset_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		counts: { total: 0, done: 0, skipped: 0, pending: 0 }
	};
}

export async function renameChecklist(
	db: D1Database,
	userId: string,
	id: number,
	name: string
): Promise<boolean> {
	const r = await db
		.prepare('UPDATE checklists SET name = ?, updated_at = ? WHERE user_id = ? AND id = ?')
		.bind(name.trim() || 'Untitled', Date.now(), userId, id)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function deleteChecklist(db: D1Database, userId: string, id: number): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM checklists WHERE user_id = ? AND id = ?')
		.bind(userId, id)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

async function ownsChecklist(db: D1Database, userId: string, checklistId: number): Promise<boolean> {
	const r = await db
		.prepare('SELECT 1 AS ok FROM checklists WHERE user_id = ? AND id = ?')
		.bind(userId, checklistId)
		.first<{ ok: number }>();
	return !!r;
}

export async function addItem(
	db: D1Database,
	userId: string,
	checklistId: number,
	input: { name: string; category?: string }
): Promise<ApiChecklistItem | null> {
	if (!(await ownsChecklist(db, userId, checklistId))) return null;
	const now = Date.now();
	const sortOrder = await nextItemSortOrder(db, checklistId);
	const row = await db
		.prepare(
			`INSERT INTO checklist_items (checklist_id, user_id, category, name, state, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'pending', ?, ?, ?) RETURNING ${ITEM_COLS}`
		)
		.bind(
			checklistId,
			userId,
			(input.category ?? '').trim(),
			input.name.trim(),
			sortOrder,
			now,
			now
		)
		.first<ItemRow>();
	return row ? toItem(row) : null;
}

export async function updateItem(
	db: D1Database,
	userId: string,
	itemId: number,
	patch: { name?: string; category?: string; state?: ChecklistState }
): Promise<ApiChecklistItem | null> {
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
	if (patch.state !== undefined) {
		setParts.push('state = ?');
		args.push(patch.state);
	}
	if (setParts.length === 0) return null;
	setParts.push('updated_at = ?');
	args.push(Date.now(), userId, itemId);

	const row = await db
		.prepare(
			`UPDATE checklist_items SET ${setParts.join(', ')} WHERE user_id = ? AND id = ? RETURNING ${ITEM_COLS}`
		)
		.bind(...args)
		.first<ItemRow>();
	return row ? toItem(row) : null;
}

export async function deleteItem(db: D1Database, userId: string, itemId: number): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM checklist_items WHERE user_id = ? AND id = ?')
		.bind(userId, itemId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function reorderItems(
	db: D1Database,
	userId: string,
	checklistId: number,
	orderedIds: number[]
) {
	const now = Date.now();
	const statements = orderedIds.map((id, idx) =>
		db
			.prepare(
				'UPDATE checklist_items SET sort_order = ?, updated_at = ? WHERE user_id = ? AND checklist_id = ? AND id = ?'
			)
			.bind(idx * 1000, now, userId, checklistId, id)
	);
	if (statements.length) await db.batch(statements);
}

export async function resetChecklist(
	db: D1Database,
	userId: string,
	checklistId: number,
	mode: 'all' | 'done'
): Promise<{ snapshot: ApiSnapshot; checklist: ApiChecklist; items: ApiChecklistItem[] } | null> {
	const current = await getChecklist(db, userId, checklistId);
	if (!current) return null;

	const now = Date.now();
	const c = current.checklist.counts;

	// Capture snapshot of the pre-reset state.
	const itemsJson = JSON.stringify(
		current.items.map((it) => ({ name: it.name, category: it.category, state: it.state }))
	);
	const reason = mode === 'all' ? 'reset_all' : 'clear_done';
	const snapRow = await db
		.prepare(
			`INSERT INTO checklist_snapshots (checklist_id, user_id, created_at, reason, done_count, skipped_count, pending_count, total, items_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id, created_at, reason, done_count, skipped_count, pending_count, total, items_json`
		)
		.bind(checklistId, userId, now, reason, c.done, c.skipped, c.pending, c.total, itemsJson)
		.first<{
			id: number;
			created_at: number;
			reason: string;
			done_count: number;
			skipped_count: number;
			pending_count: number;
			total: number;
			items_json: string;
		}>();

	// Apply the reset.
	if (mode === 'all') {
		await db
			.prepare(
				"UPDATE checklist_items SET state = 'pending', updated_at = ? WHERE checklist_id = ? AND state != 'pending'"
			)
			.bind(now, checklistId)
			.run();
	} else {
		await db
			.prepare(
				"UPDATE checklist_items SET state = 'pending', updated_at = ? WHERE checklist_id = ? AND state = 'done'"
			)
			.bind(now, checklistId)
			.run();
	}
	await db
		.prepare('UPDATE checklists SET last_reset_at = ?, updated_at = ? WHERE id = ?')
		.bind(now, now, checklistId)
		.run();

	const after = await getChecklist(db, userId, checklistId);
	const snapshot: ApiSnapshot = {
		id: snapRow!.id,
		createdAt: snapRow!.created_at,
		reason: snapRow!.reason,
		doneCount: snapRow!.done_count,
		skippedCount: snapRow!.skipped_count,
		pendingCount: snapRow!.pending_count,
		total: snapRow!.total,
		items: JSON.parse(snapRow!.items_json)
	};
	return { snapshot, checklist: after!.checklist, items: after!.items };
}

export async function deleteSnapshot(
	db: D1Database,
	userId: string,
	snapshotId: number
): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM checklist_snapshots WHERE user_id = ? AND id = ?')
		.bind(userId, snapshotId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function listSnapshots(
	db: D1Database,
	userId: string,
	checklistId: number
): Promise<ApiSnapshot[]> {
	const res = await db
		.prepare(
			'SELECT id, created_at, reason, done_count, skipped_count, pending_count, total, items_json FROM checklist_snapshots WHERE user_id = ? AND checklist_id = ? ORDER BY created_at DESC'
		)
		.bind(userId, checklistId)
		.all<{
			id: number;
			created_at: number;
			reason: string;
			done_count: number;
			skipped_count: number;
			pending_count: number;
			total: number;
			items_json: string;
		}>();
	return (res.results ?? []).map((r) => ({
		id: r.id,
		createdAt: r.created_at,
		reason: r.reason,
		doneCount: r.done_count,
		skippedCount: r.skipped_count,
		pendingCount: r.pending_count,
		total: r.total,
		items: JSON.parse(r.items_json)
	}));
}
