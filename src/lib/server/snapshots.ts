import type { D1Database } from '@cloudflare/workers-types';
import type { ChecklistState } from './items';

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

type Row = {
	id: number;
	list_id: number;
	created_at: number;
	reason: string;
	done_count: number;
	skipped_count: number;
	pending_count: number;
	total: number;
	items_json: string;
};

function toApi(r: Row): ApiSnapshot {
	let items: { name: string; category: string; state: ChecklistState }[] = [];
	try {
		items = JSON.parse(r.items_json) as { name: string; category: string; state: ChecklistState }[];
	} catch {
		items = [];
	}
	return {
		id: r.id,
		createdAt: r.created_at,
		reason: r.reason,
		doneCount: r.done_count,
		skippedCount: r.skipped_count,
		pendingCount: r.pending_count,
		total: r.total,
		items
	};
}

export async function listSnapshots(db: D1Database, listId: number): Promise<ApiSnapshot[]> {
	const res = await db
		.prepare(
			'SELECT id, list_id, created_at, reason, done_count, skipped_count, pending_count, total, items_json FROM snapshots WHERE list_id = ? ORDER BY created_at DESC'
		)
		.bind(listId)
		.all<Row>();
	return (res.results ?? []).map(toApi);
}

export async function createSnapshot(
	db: D1Database,
	listId: number,
	data: {
		reason: 'reset_all' | 'clear_done';
		doneCount: number;
		skippedCount: number;
		pendingCount: number;
		total: number;
		items: { name: string; category: string; state: ChecklistState }[];
		createdAt?: number;
	}
): Promise<ApiSnapshot> {
	const now = data.createdAt ?? Date.now();
	const row = await db
		.prepare(
			`INSERT INTO snapshots (list_id, created_at, reason, done_count, skipped_count, pending_count, total, items_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING id, list_id, created_at, reason, done_count, skipped_count, pending_count, total, items_json`
		)
		.bind(
			listId,
			now,
			data.reason,
			data.doneCount,
			data.skippedCount,
			data.pendingCount,
			data.total,
			JSON.stringify(data.items)
		)
		.first<Row>();
	if (!row) throw new Error('Insert failed');
	return toApi(row);
}

export async function getSnapshotListId(db: D1Database, id: number): Promise<number | null> {
	const r = await db
		.prepare('SELECT list_id FROM snapshots WHERE id = ?')
		.bind(id)
		.first<{ list_id: number }>();
	return r?.list_id ?? null;
}

export async function deleteSnapshot(db: D1Database, id: number): Promise<boolean> {
	const r = await db.prepare('DELETE FROM snapshots WHERE id = ?').bind(id).run();
	return (r.meta.changes ?? 0) > 0;
}
