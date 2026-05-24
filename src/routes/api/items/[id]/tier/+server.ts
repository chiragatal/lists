import { error, json, type RequestHandler } from '@sveltejs/kit';
import { setTier } from '$lib/server/items';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const body = (await request.json()) as { tier?: string };
	if (body.tier !== 'library' && body.tier !== 'shortlist' && body.tier !== 'active') {
		throw error(400, 'invalid tier');
	}
	const updated = await setTier(platform.env.DB, locals.user.id, id, body.tier);
	if (!updated) throw error(404, 'not found');
	return json(updated);
};
