import { error, json, type RequestHandler } from '@sveltejs/kit';
import { addItem } from '$lib/server/checklists';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const checklistId = Number(params.id);
	if (!Number.isFinite(checklistId)) throw error(400, 'invalid id');
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', checklistId);
	if (!role) throw error(404, 'checklist not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const body = (await request.json()) as { name?: string; category?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const item = await addItem(platform.env.DB, locals.user.id, checklistId, {
		name: body.name,
		category: typeof body.category === 'string' ? body.category : ''
	});
	if (!item) throw error(404, 'checklist not found');
	return json(item, { status: 201 });
};
