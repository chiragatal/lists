import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getItemChecklistId, updateItem } from '$lib/server/checklists';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	const body = (await request.json()) as { state?: string };
	if (body.state !== 'pending' && body.state !== 'done' && body.state !== 'skipped') {
		throw error(400, 'invalid state');
	}
	const checklistId = await getItemChecklistId(platform.env.DB, itemId);
	if (checklistId == null) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', checklistId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const item = await updateItem(platform.env.DB, itemId, { state: body.state });
	if (!item) throw error(404, 'not found');
	return json(item);
};
