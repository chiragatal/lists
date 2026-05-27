import { error, type RequestHandler } from '@sveltejs/kit';
import { deleteSnapshot, getSnapshotChecklistId } from '$lib/server/checklists';
import { accessRole, canWrite } from '$lib/server/shares';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const snapshotId = Number(params.snapshotId);
	if (!Number.isFinite(snapshotId)) throw error(400, 'invalid id');
	const checklistId = await getSnapshotChecklistId(platform.env.DB, snapshotId);
	if (checklistId == null) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', checklistId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const ok = await deleteSnapshot(platform.env.DB, snapshotId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
