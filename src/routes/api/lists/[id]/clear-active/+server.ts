import { error, json, type RequestHandler } from '@sveltejs/kit';
import { clearActive } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const role = await accessRole(platform.env.DB, locals.user.id, id);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const updated = await clearActive(platform.env.DB, id);
	return json({ updated });
};
