import type { D1Database } from '@cloudflare/workers-types';
import { sharedListIds, type Role } from './shares';

export type ListType = 'plan' | 'checklist';

export type PlanCounts = { total: number; active: number; shortlist: number; library: number };
export type ChecklistCounts = { total: number; done: number; skipped: number; pending: number };
export type Counts = PlanCounts | ChecklistCounts;

export type ApiList = {
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
	counts: Counts;
};

type ListRow = {
	id: number;
	owner_id: string;
	type: ListType;
	name: string;
	sort_order: number;
	last_reset_at: number | null;
	created_at: number;
	updated_at: number;
};

const LIST_COLS = 'id, owner_id, type, name, sort_order, last_reset_at, created_at, updated_at';

async function countsFor(db: D1Database, lists: ListRow[]): Promise<Map<number, Counts>> {
	const out = new Map<number, Counts>();
	if (lists.length === 0) return out;
	const placeholders = lists.map(() => '?').join(',');
	const ids = lists.map((l) => l.id);
	const rows = await db
		.prepare(
			`SELECT list_id, tier, state, COUNT(*) AS n
			   FROM items WHERE list_id IN (${placeholders})
			   GROUP BY list_id, tier, state`
		)
		.bind(...ids)
		.all<{ list_id: number; tier: string | null; state: string | null; n: number }>();

	// Seed counts by type so empty lists still return zeros.
	for (const l of lists) {
		out.set(
			l.id,
			l.type === 'plan'
				? { total: 0, active: 0, shortlist: 0, library: 0 }
				: { total: 0, done: 0, skipped: 0, pending: 0 }
		);
	}

	for (const r of rows.results ?? []) {
		const c = out.get(r.list_id);
		if (!c) continue;
		c.total += r.n;
		if ('active' in c) {
			// plan
			if (r.tier === 'active') c.active += r.n;
			else if (r.tier === 'shortlist') c.shortlist += r.n;
			c.library = c.total;
		} else {
			// checklist
			if (r.state === 'done') c.done += r.n;
			else if (r.state === 'skipped') c.skipped += r.n;
			else c.pending += r.n;
		}
	}
	return out;
}

function rowToApi(r: ListRow, role: Role, shared: boolean, counts: Counts, ownerEmail?: string): ApiList {
	return {
		id: r.id,
		type: r.type,
		name: r.name,
		sortOrder: r.sort_order,
		lastResetAt: r.last_reset_at,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		role,
		shared,
		ownerEmail,
		counts
	};
}

async function createDefaultPlan(db: D1Database, userId: string): Promise<void> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO lists (owner_id, type, name, sort_order, created_at, updated_at)
			 VALUES (?, 'plan', 'Plan', 1000, ?, ?)`
		)
		.bind(userId, now, now)
		.run();
}

export async function listLists(db: D1Database, userId: string): Promise<ApiList[]> {
	let owned = await db
		.prepare(
			`SELECT ${LIST_COLS} FROM lists WHERE owner_id = ? ORDER BY sort_order ASC, id ASC`
		)
		.bind(userId)
		.all<ListRow>();

	const shares = await sharedListIds(db, userId);

	if ((owned.results ?? []).length === 0 && shares.length === 0) {
		await createDefaultPlan(db, userId);
		owned = await db
			.prepare(`SELECT ${LIST_COLS} FROM lists WHERE owner_id = ? ORDER BY sort_order ASC, id ASC`)
			.bind(userId)
			.all<ListRow>();
	}

	const ownedRows = owned.results ?? [];
	const sharedRows: (ListRow & { ownerEmail: string; role: Role })[] = [];
	if (shares.length > 0) {
		const ids = shares.map((s) => s.id);
		const rows = await db
			.prepare(
				`SELECT l.id, l.owner_id, l.type, l.name, l.sort_order, l.last_reset_at,
				        l.created_at, l.updated_at, u.email AS owner_email
				   FROM lists l JOIN users u ON u.id = l.owner_id
				  WHERE l.id IN (${ids.map(() => '?').join(',')})`
			)
			.bind(...ids)
			.all<ListRow & { owner_email: string }>();
		const roleById = new Map(shares.map((s) => [s.id, s.role]));
		for (const r of rows.results ?? []) {
			sharedRows.push({ ...r, ownerEmail: r.owner_email, role: roleById.get(r.id) ?? 'viewer' });
		}
	}

	const allRows = [...ownedRows, ...sharedRows];
	const cmap = await countsFor(db, allRows);
	const fallback = (r: ListRow): Counts =>
		r.type === 'plan'
			? { total: 0, active: 0, shortlist: 0, library: 0 }
			: { total: 0, done: 0, skipped: 0, pending: 0 };

	const ownedApi = ownedRows.map((r) => rowToApi(r, 'owner', false, cmap.get(r.id) ?? fallback(r)));
	const sharedApi = sharedRows
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((r) => rowToApi(r, r.role, true, cmap.get(r.id) ?? fallback(r), r.ownerEmail));

	return [...ownedApi, ...sharedApi];
}

export async function getList(db: D1Database, id: number): Promise<ApiList | null> {
	const r = await db.prepare(`SELECT ${LIST_COLS} FROM lists WHERE id = ?`).bind(id).first<ListRow>();
	if (!r) return null;
	const cmap = await countsFor(db, [r]);
	const fallback: Counts =
		r.type === 'plan'
			? { total: 0, active: 0, shortlist: 0, library: 0 }
			: { total: 0, done: 0, skipped: 0, pending: 0 };
	return rowToApi(r, 'owner', false, cmap.get(r.id) ?? fallback);
}

export async function getListType(db: D1Database, id: number): Promise<ListType | null> {
	const r = await db
		.prepare('SELECT type FROM lists WHERE id = ?')
		.bind(id)
		.first<{ type: ListType }>();
	return r?.type ?? null;
}

async function nextSortOrder(db: D1Database, userId: string): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM lists WHERE owner_id = ?')
		.bind(userId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

export async function createList(
	db: D1Database,
	userId: string,
	type: ListType,
	name: string
): Promise<ApiList> {
	const now = Date.now();
	const sortOrder = await nextSortOrder(db, userId);
	const fallback = type === 'plan' ? 'Plan' : 'Checklist';
	const r = await db
		.prepare(
			`INSERT INTO lists (owner_id, type, name, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 RETURNING ${LIST_COLS}`
		)
		.bind(userId, type, name.trim() || fallback, sortOrder, now, now)
		.first<ListRow>();
	if (!r) throw new Error('Insert failed');
	const counts: Counts =
		type === 'plan'
			? { total: 0, active: 0, shortlist: 0, library: 0 }
			: { total: 0, done: 0, skipped: 0, pending: 0 };
	return rowToApi(r, 'owner', false, counts);
}

export async function renameList(
	db: D1Database,
	userId: string,
	id: number,
	name: string
): Promise<boolean> {
	const r = await db
		.prepare('UPDATE lists SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
		.bind(name.trim() || 'List', Date.now(), id, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function deleteList(db: D1Database, userId: string, id: number): Promise<boolean> {
	// Items and snapshots cascade via FK; shares cascade via FK on list_id.
	const r = await db
		.prepare('DELETE FROM lists WHERE id = ? AND owner_id = ?')
		.bind(id, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function ownsList(db: D1Database, userId: string, id: number): Promise<boolean> {
	const r = await db
		.prepare('SELECT 1 AS ok FROM lists WHERE id = ? AND owner_id = ?')
		.bind(id, userId)
		.first<{ ok: number }>();
	return !!r;
}
