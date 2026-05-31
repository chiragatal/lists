import type { D1Database } from '@cloudflare/workers-types';
import { bulkImport, listItems, type ChecklistState, type CreateInput, type Tier } from './items';
import { createList, listLists } from './lists';
import { createSnapshot, listSnapshots } from './snapshots';

type AnyRecord = Record<string, unknown>;

function num(v: unknown): number | undefined {
	return typeof v === 'number' ? v : undefined;
}

export async function buildExport(db: D1Database, userId: string) {
	const allLists = await listLists(db, userId);
	const lists = [];
	for (const l of allLists) {
		if (l.role !== 'owner') continue; // only export what the user owns
		const items = await listItems(db, l.id);
		const block: AnyRecord = {
			type: l.type,
			name: l.name,
			createdAt: l.createdAt,
			items: items.map((it) => {
				if (l.type === 'plan') {
					return {
						name: it.name,
						category: it.category,
						tags: it.tags ?? [],
						notes: it.notes,
						completedAt: it.completedAt,
						tier: it.tier ?? 'library',
						sortOrder: it.sortOrder,
						createdAt: it.createdAt,
						updatedAt: it.updatedAt
					};
				}
				return {
					name: it.name,
					category: it.category,
					state: it.state ?? 'pending',
					sortOrder: it.sortOrder,
					createdAt: it.createdAt,
					updatedAt: it.updatedAt
				};
			})
		};
		if (l.type === 'checklist') {
			block.lastResetAt = l.lastResetAt;
			const snaps = await listSnapshots(db, l.id);
			block.snapshots = snaps.map((s) => ({
				createdAt: s.createdAt,
				reason: s.reason,
				doneCount: s.doneCount,
				skippedCount: s.skippedCount,
				pendingCount: s.pendingCount,
				total: s.total,
				items: s.items
			}));
		}
		lists.push(block);
	}
	return { schema: 'lists.v5', exportedAt: new Date().toISOString(), lists };
}

function planItemToInput(raw: AnyRecord): CreateInput {
	let tier: Tier = 'library';
	if (raw.inActive === 1) tier = 'active';
	else if (raw.inShortlist === 1) tier = 'shortlist';
	if (raw.tier === 'library' || raw.tier === 'shortlist' || raw.tier === 'active') {
		tier = raw.tier;
	}
	return {
		type: 'plan',
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

function validState(v: unknown): ChecklistState {
	return v === 'done' || v === 'skipped' ? v : 'pending';
}

function checklistItemToInput(raw: AnyRecord): CreateInput {
	return {
		type: 'checklist',
		name: String(raw.name ?? '').trim() || 'Untitled',
		category: String(raw.category ?? '').trim(),
		state: validState(raw.state),
		sortOrder: num(raw.sortOrder),
		createdAt: num(raw.createdAt),
		updatedAt: num(raw.updatedAt)
	};
}

type NormalizedList = {
	type: 'plan' | 'checklist';
	name: string;
	createdAt?: number;
	lastResetAt?: number | null;
	items: AnyRecord[];
	snapshots?: AnyRecord[];
};

function normalize(root: AnyRecord | unknown[]): NormalizedList[] {
	if (Array.isArray(root)) {
		// Very old: flat items array → one Plan.
		return [{ type: 'plan', name: 'Plan', items: root as AnyRecord[] }];
	}
	const r = (root ?? {}) as AnyRecord;

	// v5: top-level `lists` array with `type`.
	if (Array.isArray(r.lists)) {
		return (r.lists as AnyRecord[]).map((l) => ({
			type: l.type === 'checklist' ? 'checklist' : 'plan',
			name: String(l.name ?? '').trim() || (l.type === 'checklist' ? 'Checklist' : 'Plan'),
			createdAt: num(l.createdAt),
			lastResetAt: num(l.lastResetAt) ?? null,
			items: Array.isArray(l.items) ? (l.items as AnyRecord[]) : [],
			snapshots: Array.isArray(l.snapshots) ? (l.snapshots as AnyRecord[]) : undefined
		}));
	}

	// v4 (and earlier): `plans` + `checklists` arrays, or a flat `items` array.
	const out: NormalizedList[] = [];
	if (Array.isArray(r.plans)) {
		for (const p of r.plans as AnyRecord[]) {
			out.push({
				type: 'plan',
				name: String(p.name ?? '').trim() || 'Plan',
				createdAt: num(p.createdAt),
				items: Array.isArray(p.items) ? (p.items as AnyRecord[]) : []
			});
		}
	} else if (Array.isArray(r.items)) {
		out.push({ type: 'plan', name: 'Plan', items: r.items as AnyRecord[] });
	}
	if (Array.isArray(r.checklists)) {
		for (const c of r.checklists as AnyRecord[]) {
			out.push({
				type: 'checklist',
				name: String(c.name ?? '').trim() || 'Checklist',
				createdAt: num(c.createdAt),
				lastResetAt: num(c.lastResetAt) ?? null,
				items: Array.isArray(c.items) ? (c.items as AnyRecord[]) : [],
				snapshots: Array.isArray(c.snapshots) ? (c.snapshots as AnyRecord[]) : undefined
			});
		}
	}
	return out;
}

export async function applyImport(
	db: D1Database,
	userId: string,
	data: AnyRecord | unknown[],
	mode: 'replace' | 'merge'
): Promise<{ lists: number; items: number }> {
	const blocks = normalize(data);

	if (mode === 'replace') {
		// Delete all owned lists (items, snapshots, shares cascade via FK).
		await db.prepare('DELETE FROM lists WHERE owner_id = ?').bind(userId).run();
	}

	let importedLists = 0;
	let importedItems = 0;
	for (const block of blocks) {
		const list = await createList(db, userId, block.type, block.name);
		if (block.type === 'plan') {
			importedItems += await bulkImport(db, list.id, block.items.map(planItemToInput));
		} else {
			importedItems += await bulkImport(db, list.id, block.items.map(checklistItemToInput));
			if (block.lastResetAt) {
				await db
					.prepare('UPDATE lists SET last_reset_at = ? WHERE id = ?')
					.bind(block.lastResetAt, list.id)
					.run();
			}
			if (block.snapshots?.length) {
				for (const s of block.snapshots) {
					await createSnapshot(db, list.id, {
						reason: (s.reason === 'clear_done' ? 'clear_done' : 'reset_all') as
							| 'reset_all'
							| 'clear_done',
						doneCount: num(s.doneCount) ?? 0,
						skippedCount: num(s.skippedCount) ?? 0,
						pendingCount: num(s.pendingCount) ?? 0,
						total: num(s.total) ?? 0,
						items: Array.isArray(s.items)
							? (s.items as { name: string; category: string; state: ChecklistState }[])
							: [],
						createdAt: num(s.createdAt)
					});
				}
			}
		}
		importedLists++;
	}

	return { lists: importedLists, items: importedItems };
}
