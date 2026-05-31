import { error, type RequestHandler } from '@sveltejs/kit';
import { deleteSnapshot, getSnapshotListId } from '$lib/server/snapshots';
import { accessRole, canWrite } from '$lib/server/shares';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const listId = Number(params.id);
	const snapId = Number(params.snapshotId);
	if (!Number.isFinite(listId) || !Number.isFinite(snapId)) throw error(400, 'invalid id');
	const actual = await getSnapshotListId(platform.env.DB, snapId);
	if (actual !== listId) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, listId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const ok = await deleteSnapshot(platform.env.DB, snapId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
