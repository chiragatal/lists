import { error, json, type RequestHandler } from '@sveltejs/kit';
import { reorderItems } from '$lib/server/checklists';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const checklistId = Number(params.id);
	if (!Number.isFinite(checklistId)) throw error(400, 'invalid id');
	const body = (await request.json()) as { ids?: number[] };
	if (!Array.isArray(body.ids) || !body.ids.every((n) => Number.isFinite(n))) {
		throw error(400, 'ids array required');
	}
	await reorderItems(platform.env.DB, locals.user.id, checklistId, body.ids);
	return json({ ok: true });
};
