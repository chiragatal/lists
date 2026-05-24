import { error, json, type RequestHandler } from '@sveltejs/kit';
import { reorderItems } from '$lib/server/items';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { ids?: number[] };
	if (!Array.isArray(body.ids) || !body.ids.every((n) => Number.isFinite(n))) {
		throw error(400, 'ids array required');
	}
	await reorderItems(platform.env.DB, locals.user.id, body.ids);
	return json({ ok: true });
};
