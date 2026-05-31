import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getItemListId, removeCompletion } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const DELETE: RequestHandler = async ({ locals, platform, params, url }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const listId = Number(params.id);
	const itemId = Number(params.itemId);
	if (!Number.isFinite(listId) || !Number.isFinite(itemId)) throw error(400, 'invalid id');
	const ts = Number(url.searchParams.get('ts'));
	if (!Number.isFinite(ts)) throw error(400, 'ts required');
	const actualList = await getItemListId(platform.env.DB, itemId);
	if (actualList !== listId) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, listId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const item = await removeCompletion(platform.env.DB, itemId, ts);
	if (!item) throw error(404, 'not found');
	return json(item);
};
