import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteItem, getItemListId, updateItem, type UpdateInput } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

async function requireWritable(
	db: App.Platform['env']['DB'],
	userId: string,
	listId: number,
	itemId: number
) {
	const actualList = await getItemListId(db, itemId);
	if (actualList !== listId) throw error(404, 'not found');
	const role = await accessRole(db, userId, listId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
}

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const listId = Number(params.id);
	const itemId = Number(params.itemId);
	if (!Number.isFinite(listId) || !Number.isFinite(itemId)) throw error(400, 'invalid id');
	await requireWritable(platform.env.DB, locals.user.id, listId, itemId);
	const body = (await request.json()) as Record<string, unknown>;
	const patch: UpdateInput = {};
	if (typeof body.name === 'string') patch.name = body.name;
	if (typeof body.category === 'string') patch.category = body.category;
	if (Array.isArray(body.tags)) patch.tags = (body.tags as unknown[]).map(String);
	if (typeof body.notes === 'string' || body.notes === null) patch.notes = body.notes as string | null;
	const item = await updateItem(platform.env.DB, itemId, patch);
	if (!item) throw error(404, 'not found');
	return json(item);
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const listId = Number(params.id);
	const itemId = Number(params.itemId);
	if (!Number.isFinite(listId) || !Number.isFinite(itemId)) throw error(400, 'invalid id');
	await requireWritable(platform.env.DB, locals.user.id, listId, itemId);
	const ok = await deleteItem(platform.env.DB, itemId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
