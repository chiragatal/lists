import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteItem, updateItem } from '$lib/server/checklists';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	const body = (await request.json()) as { name?: string; category?: string };
	const patch: { name?: string; category?: string } = {};
	if (typeof body.name === 'string') patch.name = body.name;
	if (typeof body.category === 'string') patch.category = body.category;
	const item = await updateItem(platform.env.DB, locals.user.id, itemId, patch);
	if (!item) throw error(404, 'not found');
	return json(item);
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	const ok = await deleteItem(platform.env.DB, locals.user.id, itemId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
