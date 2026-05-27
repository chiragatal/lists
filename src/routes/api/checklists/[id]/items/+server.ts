import { error, json, type RequestHandler } from '@sveltejs/kit';
import { addItem } from '$lib/server/checklists';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const checklistId = Number(params.id);
	if (!Number.isFinite(checklistId)) throw error(400, 'invalid id');
	const body = (await request.json()) as { name?: string; category?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const item = await addItem(platform.env.DB, locals.user.id, checklistId, {
		name: body.name,
		category: typeof body.category === 'string' ? body.category : ''
	});
	if (!item) throw error(404, 'checklist not found');
	return json(item, { status: 201 });
};
