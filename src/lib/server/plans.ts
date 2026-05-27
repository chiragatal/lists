import type { D1Database } from '@cloudflare/workers-types';

export type ApiPlan = {
	id: number;
	name: string;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
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

export async function listPlans(db: D1Database, userId: string): Promise<ApiPlan[]> {
	let rows = await db
		.prepare(
			'SELECT id, name, sort_order, created_at, updated_at FROM plans WHERE owner_id = ? ORDER BY sort_order ASC, id ASC'
		)
		.bind(userId)
		.all<PlanRow>();

	// Guarantee every user always has at least one plan.
	if ((rows.results ?? []).length === 0) {
		await createDefaultPlan(db, userId);
		rows = await db
			.prepare(
				'SELECT id, name, sort_order, created_at, updated_at FROM plans WHERE owner_id = ? ORDER BY sort_order ASC, id ASC'
			)
			.bind(userId)
			.all<PlanRow>();
	}

	const counts = await db
		.prepare(
			`SELECT plan_id,
			        COUNT(*) AS total,
			        SUM(CASE WHEN in_active = 1 THEN 1 ELSE 0 END) AS active,
			        SUM(CASE WHEN in_shortlist = 1 AND in_active = 0 THEN 1 ELSE 0 END) AS shortlist
			   FROM items WHERE user_id = ? GROUP BY plan_id`
		)
		.bind(userId)
		.all<{ plan_id: number; total: number; active: number; shortlist: number }>();

	const cmap = new Map<number, { total: number; active: number; shortlist: number }>();
	for (const c of counts.results ?? []) {
		cmap.set(c.plan_id, { total: c.total, active: c.active ?? 0, shortlist: c.shortlist ?? 0 });
	}

	return (rows.results ?? []).map((r) => {
		const c = cmap.get(r.id) ?? { total: 0, active: 0, shortlist: 0 };
		return {
			id: r.id,
			name: r.name,
			sortOrder: r.sort_order,
			createdAt: r.created_at,
			updatedAt: r.updated_at,
			counts: {
				total: c.total,
				active: c.active,
				shortlist: c.shortlist,
				library: c.total
			}
		};
	});
}

export async function getPlan(db: D1Database, userId: string, id: number): Promise<ApiPlan | null> {
	const r = await db
		.prepare(
			'SELECT id, name, sort_order, created_at, updated_at FROM plans WHERE id = ? AND owner_id = ?'
		)
		.bind(id, userId)
		.first<PlanRow>();
	if (!r) return null;
	const c = await db
		.prepare(
			`SELECT COUNT(*) AS total,
			        SUM(CASE WHEN in_active = 1 THEN 1 ELSE 0 END) AS active,
			        SUM(CASE WHEN in_shortlist = 1 AND in_active = 0 THEN 1 ELSE 0 END) AS shortlist
			   FROM items WHERE plan_id = ?`
		)
		.bind(id)
		.first<{ total: number; active: number; shortlist: number }>();
	const total = c?.total ?? 0;
	return {
		id: r.id,
		name: r.name,
		sortOrder: r.sort_order,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		counts: { total, active: c?.active ?? 0, shortlist: c?.shortlist ?? 0, library: total }
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
	// No FK cascade on items.plan_id — remove items first.
	await db.prepare('DELETE FROM items WHERE plan_id = ? AND user_id = ?').bind(id, userId).run();
	const r = await db
		.prepare('DELETE FROM plans WHERE id = ? AND owner_id = ?')
		.bind(id, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}
