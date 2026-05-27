import type { D1Database } from '@cloudflare/workers-types';
import { listItems, bulkImport, type CreateInput } from './items';
import { listPlans, createPlan } from './plans';
import { getChecklist, listChecklists, listSnapshots } from './checklists';

type AnyRecord = Record<string, unknown>;

function num(v: unknown): number | undefined {
	return typeof v === 'number' ? v : undefined;
}

function itemExportShape(it: {
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
}) {
	return {
		name: it.name,
		category: it.category,
		tags: it.tags,
		notes: it.notes,
		completedAt: it.completedAt,
		inShortlist: it.inShortlist,
		inActive: it.inActive,
		sortOrder: it.sortOrder,
		createdAt: it.createdAt,
		updatedAt: it.updatedAt
	};
}

export async function buildExport(db: D1Database, userId: string) {
	const planList = await listPlans(db, userId);
	const plans = [];
	for (const p of planList) {
		const items = await listItems(db, userId, p.id);
		plans.push({
			name: p.name,
			createdAt: p.createdAt,
			items: items.map(itemExportShape)
		});
	}

	const cls = await listChecklists(db, userId);
	const checklists = [];
	for (const c of cls) {
		const detail = await getChecklist(db, userId, c.id);
		const snaps = await listSnapshots(db, userId, c.id);
		checklists.push({
			name: c.name,
			lastResetAt: c.lastResetAt,
			createdAt: c.createdAt,
			items: (detail?.items ?? []).map((i) => ({
				name: i.name,
				category: i.category,
				state: i.state,
				sortOrder: i.sortOrder
			})),
			snapshots: snaps.map((s) => ({
				createdAt: s.createdAt,
				reason: s.reason,
				doneCount: s.doneCount,
				skippedCount: s.skippedCount,
				pendingCount: s.pendingCount,
				total: s.total,
				items: s.items
			}))
		});
	}

	return { schema: 'lists.v4', exportedAt: new Date().toISOString(), plans, checklists };
}

function planItemToInput(raw: AnyRecord): CreateInput {
	let tier: 'library' | 'shortlist' | 'active' = 'library';
	if (raw.inActive === 1) tier = 'active';
	else if (raw.inShortlist === 1) tier = 'shortlist';
	if (raw.tier === 'library' || raw.tier === 'shortlist' || raw.tier === 'active') tier = raw.tier;
	return {
		name: String(raw.name ?? '').trim() || 'Untitled',
		category: String(raw.category ?? '').trim(),
		tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
		notes: typeof raw.notes === 'string' ? raw.notes : undefined,
		tier,
		completedAt: Array.isArray(raw.completedAt)
			? (raw.completedAt as unknown[]).filter((n): n is number => typeof n === 'number')
			: undefined,
		sortOrder: num(raw.sortOrder),
		createdAt: num(raw.createdAt),
		updatedAt: num(raw.updatedAt)
	};
}

function validState(v: unknown): 'pending' | 'done' | 'skipped' {
	return v === 'done' || v === 'skipped' ? v : 'pending';
}

export async function applyImport(
	db: D1Database,
	userId: string,
	data: AnyRecord | unknown[],
	mode: 'replace' | 'merge'
): Promise<{ plans: number; items: number; checklists: number }> {
	const root = (Array.isArray(data) ? { items: data } : (data ?? {})) as AnyRecord;

	// Normalize to a list of plans. New (v4) backups have `plans`; older ones
	// (v2/v3) have a flat `items` array → import into a single "Plan".
	let planBlocks: { name: string; createdAt?: number; items: AnyRecord[] }[];
	if (Array.isArray(root.plans)) {
		planBlocks = (root.plans as AnyRecord[]).map((p) => ({
			name: String(p.name ?? '').trim() || 'Plan',
			createdAt: num(p.createdAt),
			items: Array.isArray(p.items) ? (p.items as AnyRecord[]) : []
		}));
	} else if (Array.isArray(root.items)) {
		planBlocks = [{ name: 'Plan', items: root.items as AnyRecord[] }];
	} else {
		planBlocks = [];
	}

	const checklistsRaw = Array.isArray(root.checklists) ? (root.checklists as AnyRecord[]) : [];

	if (mode === 'replace') {
		await db.prepare('DELETE FROM items WHERE user_id = ?').bind(userId).run();
		await db.prepare('DELETE FROM plans WHERE owner_id = ?').bind(userId).run();
		await db.prepare('DELETE FROM checklists WHERE user_id = ?').bind(userId).run();
	}

	let importedPlans = 0;
	let importedItems = 0;
	for (const block of planBlocks) {
		const plan = await createPlan(db, userId, block.name);
		importedItems += await bulkImport(db, userId, plan.id, block.items.map(planItemToInput));
		importedPlans++;
	}

	// Checklists
	const now = Date.now();
	let importedChecklists = 0;
	const maxRow = await db
		.prepare('SELECT MAX(sort_order) AS max FROM checklists WHERE user_id = ?')
		.bind(userId)
		.first<{ max: number | null }>();
	let base = (maxRow?.max ?? 0) + 1000;
	for (const c of checklistsRaw) {
		const clRow = await db
			.prepare(
				'INSERT INTO checklists (user_id, name, sort_order, last_reset_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
			)
			.bind(
				userId,
				String(c.name ?? '').trim() || 'Untitled',
				base,
				num(c.lastResetAt) ?? null,
				num(c.createdAt) ?? now,
				now
			)
			.first<{ id: number }>();
		base += 1000;
		if (!clRow) continue;
		const clId = clRow.id;

		const itemsRaw = Array.isArray(c.items) ? (c.items as AnyRecord[]) : [];
		if (itemsRaw.length) {
			await db.batch(
				itemsRaw.map((it, idx) =>
					db
						.prepare(
							'INSERT INTO checklist_items (checklist_id, user_id, category, name, state, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
						)
						.bind(
							clId,
							userId,
							String(it.category ?? '').trim(),
							String(it.name ?? '').trim() || 'Untitled',
							validState(it.state),
							num(it.sortOrder) ?? idx * 1000,
							now,
							now
						)
				)
			);
		}

		const snapsRaw = Array.isArray(c.snapshots) ? (c.snapshots as AnyRecord[]) : [];
		if (snapsRaw.length) {
			await db.batch(
				snapsRaw.map((s) =>
					db
						.prepare(
							'INSERT INTO checklist_snapshots (checklist_id, user_id, created_at, reason, done_count, skipped_count, pending_count, total, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
						)
						.bind(
							clId,
							userId,
							num(s.createdAt) ?? now,
							String(s.reason ?? 'reset_all'),
							num(s.doneCount) ?? 0,
							num(s.skippedCount) ?? 0,
							num(s.pendingCount) ?? 0,
							num(s.total) ?? 0,
							JSON.stringify(Array.isArray(s.items) ? s.items : [])
						)
				)
			);
		}
		importedChecklists++;
	}

	return { plans: importedPlans, items: importedItems, checklists: importedChecklists };
}
