import { error, json, type RequestHandler } from '@sveltejs/kit';
import { removeCompletion } from '$lib/server/items';

export const DELETE: RequestHandler = async ({ locals, platform, params, url }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	const ts = Number(url.searchParams.get('ts'));
	if (!Number.isFinite(id) || !Number.isFinite(ts)) throw error(400, 'invalid id or ts');
	const updated = await removeCompletion(platform.env.DB, locals.user.id, id, ts);
	if (!updated) throw error(404, 'not found');
	return json(updated);
};
