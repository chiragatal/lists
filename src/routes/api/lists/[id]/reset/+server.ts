import { error, json, type RequestHandler } from '@sveltejs/kit';
import { listItems, resetChecklist, type ResetMode } from '$lib/server/items';
import { getList } from '$lib/server/lists';
import { createSnapshot } from '$lib/server/snapshots';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const db = platform.env.DB;
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const role = await accessRole(db, locals.user.id, id);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const body = (await request.json()) as { mode?: string };
	const mode: ResetMode = body.mode === 'done' ? 'done' : 'all';

	const before = await resetChecklist(db, id, mode);
	const snapshot = await createSnapshot(db, id, {
		reason: mode === 'all' ? 'reset_all' : 'clear_done',
		doneCount: before.doneCount,
		skippedCount: before.skippedCount,
		pendingCount: before.pendingCount,
		total: before.total,
		items: before.items
	});

	const [list, items] = await Promise.all([getList(db, id), listItems(db, id)]);
	return json({ snapshot, list, items });
};
