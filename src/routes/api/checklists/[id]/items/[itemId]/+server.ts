import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteItem, getItemChecklistId, updateItem } from '$lib/server/checklists';
import { accessRole, canWrite } from '$lib/server/shares';

async function requireWritable(db: App.Platform['env']['DB'], userId: string, itemId: number) {
	const checklistId = await getItemChecklistId(db, itemId);
	if (checklistId == null) throw error(404, 'not found');
	const role = await accessRole(db, userId, 'checklist', checklistId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
}

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	await requireWritable(platform.env.DB, locals.user.id, itemId);
	const body = (await request.json()) as { name?: string; category?: string };
	const patch: { name?: string; category?: string } = {};
	if (typeof body.name === 'string') patch.name = body.name;
	if (typeof body.category === 'string') patch.category = body.category;
	const item = await updateItem(platform.env.DB, itemId, patch);
	if (!item) throw error(404, 'not found');
	return json(item);
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	await requireWritable(platform.env.DB, locals.user.id, itemId);
	const ok = await deleteItem(platform.env.DB, itemId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
