import type { D1Database } from '@cloudflare/workers-types';
import { sharedObjectIds, type Role } from './shares';

export type ApiPlan = {
	id: number;
	name: string;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
	role: Role;
	shared: boolean;
	ownerEmail?: string;
	counts: { total: number; active: number; shortlist: number; library: number };
};

type PlanRow = {
	id: number;
	name: string;
	sort_order: number;
	created_at: number;
	updated_at: number;
};

export async function ownsPlan(db: D1Database, userId: string, planId: number): Promise<boolean> {
	const r = await db
		.prepare('SELECT 1 AS ok FROM plans WHERE id = ? AND owner_id = ?')
		.bind(planId, userId)
		.first<{ ok: number }>();
	return !!r;
}

async function createDefaultPlan(db: D1Database, userId: string): Promise<void> {
	const now = Date.now();
	await db
		.prepare(
			'INSERT INTO plans (owner_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(userId, 'Plan', 1000, now, now)
		.run();
}

async function countsFor(
	db: D1Database,
	planIds: number[]
): Promise<Map<number, { total: number; active: number; shortlist: number }>> {
	const cmap = new Map<number, { total: number; active: number; shortlist: number }>();
	if (planIds.length === 0) return cmap;
	const placeholders = planIds.map(() => '?').join(',');
	const counts = await db
		.prepare(
			`SELECT plan_id,
			        COUNT(*) AS total,
			        SUM(CASE WHEN in_active = 1 THEN 1 ELSE 0 END) AS active,
			        SUM(CASE WHEN in_shortlist = 1 AND in_active = 0 THEN 1 ELSE 0 END) AS shortlist
			   FROM items WHERE plan_id IN (${placeholders}) GROUP BY plan_id`
		)
		.bind(...planIds)
		.all<{ plan_id: number; total: number; active: number; shortlist: number }>();
	for (const c of counts.results ?? []) {
		cmap.set(c.plan_id, { total: c.total, active: c.active ?? 0, shortlist: c.shortlist ?? 0 });
	}
	return cmap;
}

export async function listPlans(db: D1Database, userId: string): Promise<ApiPlan[]> {
	let owned = await db
		.prepare(
			'SELECT id, name, sort_order, created_at, updated_at FROM plans WHERE owner_id = ? ORDER BY sort_order ASC, id ASC'
		)
		.bind(userId)
		.all<PlanRow>();

	// Shared-with-me plans.
	const shares = await sharedObjectIds(db, userId, 'plan');

	// Guarantee at least one plan only when the user has neither owned nor shared.
	if ((owned.results ?? []).length === 0 && shares.length === 0) {
		await createDefaultPlan(db, userId);
		owned = await db
			.prepare(
				'SELECT id, name, sort_order, created_at, updated_at FROM plans WHERE owner_id = ? ORDER BY sort_order ASC, id ASC'
			)
			.bind(userId)
			.all<PlanRow>();
	}

	const ownedRows = owned.results ?? [];
	const sharedRows: (PlanRow & { ownerEmail: string; role: Role })[] = [];
	if (shares.length > 0) {
		const ids = shares.map((s) => s.id);
		const rows = await db
			.prepare(
				`SELECT p.id, p.name, p.sort_order, p.created_at, p.updated_at, u.email AS owner_email
				   FROM plans p JOIN users u ON u.id = p.owner_id
				  WHERE p.id IN (${ids.map(() => '?').join(',')})`
			)
			.bind(...ids)
			.all<PlanRow & { owner_email: string }>();
		const roleById = new Map(shares.map((s) => [s.id, s.role]));
		for (const r of rows.results ?? []) {
			sharedRows.push({ ...r, ownerEmail: r.owner_email, role: roleById.get(r.id) ?? 'viewer' });
		}
	}

	const allIds = [...ownedRows.map((r) => r.id), ...sharedRows.map((r) => r.id)];
	const cmap = await countsFor(db, allIds);
	const toCounts = (id: number) => {
		const c = cmap.get(id) ?? { total: 0, active: 0, shortlist: 0 };
		return { total: c.total, active: c.active, shortlist: c.shortlist, library: c.total };
	};

	const ownedPlans: ApiPlan[] = ownedRows.map((r) => ({
		id: r.id,
		name: r.name,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		role: 'owner' as Role,
		shared: false,
		counts: toCounts(r.id)
	}));
	const sharedPlans: ApiPlan[] = sharedRows
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((r) => ({
			id: r.id,
			name: r.name,
			sortOrder: r.sort_order,
			createdAt: r.created_at,
			updatedAt: r.updated_at,
			role: r.role,
			shared: true,
			ownerEmail: r.ownerEmail,
			counts: toCounts(r.id)
		}));

	return [...ownedPlans, ...sharedPlans];
}

export async function getPlan(db: D1Database, id: number): Promise<ApiPlan | null> {
	const r = await db
		.prepare(
			'SELECT id, name, sort_order, created_at, updated_at, owner_id FROM plans WHERE id = ?'
		)
		.bind(id)
		.first<PlanRow & { owner_id: string }>();
	if (!r) return null;
	const cmap = await countsFor(db, [id]);
	const c = cmap.get(id) ?? { total: 0, active: 0, shortlist: 0 };
	return {
		id: r.id,
		name: r.name,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		role: 'owner',
		shared: false,
		counts: { total: c.total, active: c.active, shortlist: c.shortlist, library: c.total }
	};
}

async function nextSortOrder(db: D1Database, userId: string): Promise<number> {
	const r = await db
		.prepare('SELECT MAX(sort_order) AS max FROM plans WHERE owner_id = ?')
		.bind(userId)
		.first<{ max: number | null }>();
	return (r?.max ?? 0) + 1000;
}

export async function createPlan(db: D1Database, userId: string, name: string): Promise<ApiPlan> {
	const now = Date.now();
	const sortOrder = await nextSortOrder(db, userId);
	const r = await db
		.prepare(
			'INSERT INTO plans (owner_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, sort_order, created_at, updated_at'
		)
		.bind(userId, name.trim() || 'Plan', sortOrder, now, now)
		.first<PlanRow>();
	if (!r) throw new Error('Insert failed');
	return {
		id: r.id,
		name: r.name,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		role: 'owner',
		shared: false,
		counts: { total: 0, active: 0, shortlist: 0, library: 0 }
	};
}

export async function renamePlan(
	db: D1Database,
	userId: string,
	id: number,
	name: string
): Promise<boolean> {
	const r = await db
		.prepare('UPDATE plans SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
		.bind(name.trim() || 'Plan', Date.now(), id, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

export async function deletePlan(db: D1Database, userId: string, id: number): Promise<boolean> {
	if (!(await ownsPlan(db, userId, id))) return false;
	// No FK cascade on items.plan_id — remove all items in the plan, plus shares.
	await db.prepare('DELETE FROM items WHERE plan_id = ?').bind(id).run();
	await db.prepare("DELETE FROM shares WHERE object_type = 'plan' AND object_id = ?").bind(id).run();
	const r = await db
		.prepare('DELETE FROM plans WHERE id = ? AND owner_id = ?')
		.bind(id, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}
