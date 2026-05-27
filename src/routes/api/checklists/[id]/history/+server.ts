import { error, json, type RequestHandler } from '@sveltejs/kit';
import { listSnapshots } from '$lib/server/checklists';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const snapshots = await listSnapshots(platform.env.DB, locals.user.id, id);
	return json({ snapshots });
};
