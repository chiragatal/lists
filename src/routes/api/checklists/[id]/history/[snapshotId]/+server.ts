import { error, type RequestHandler } from '@sveltejs/kit';
import { deleteSnapshot } from '$lib/server/checklists';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const snapshotId = Number(params.snapshotId);
	if (!Number.isFinite(snapshotId)) throw error(400, 'invalid id');
	const ok = await deleteSnapshot(platform.env.DB, locals.user.id, snapshotId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
