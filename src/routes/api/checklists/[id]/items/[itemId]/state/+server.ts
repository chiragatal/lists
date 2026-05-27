import { error, json, type RequestHandler } from '@sveltejs/kit';
import { updateItem } from '$lib/server/checklists';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const itemId = Number(params.itemId);
	if (!Number.isFinite(itemId)) throw error(400, 'invalid id');
	const body = (await request.json()) as { state?: string };
	if (body.state !== 'pending' && body.state !== 'done' && body.state !== 'skipped') {
		throw error(400, 'invalid state');
	}
	const item = await updateItem(platform.env.DB, locals.user.id, itemId, { state: body.state });
	if (!item) throw error(404, 'not found');
	return json(item);
};
