import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getItemListId, setTier, type Tier } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const listId = Number(params.id);
	const itemId = Number(params.itemId);
	if (!Number.isFinite(listId) || !Number.isFinite(itemId)) throw error(400, 'invalid id');
	const actualList = await getItemListId(platform.env.DB, itemId);
	if (actualList !== listId) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, listId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const body = (await request.json()) as { tier?: string };
	if (body.tier !== 'library' && body.tier !== 'shortlist' && body.tier !== 'active') {
		throw error(400, 'invalid tier');
	}
	const item = await setTier(platform.env.DB, itemId, body.tier as Tier);
	if (!item) throw error(404, 'not found');
	return json(item);
};
