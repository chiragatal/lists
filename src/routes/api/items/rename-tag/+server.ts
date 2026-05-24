import { error, json, type RequestHandler } from '@sveltejs/kit';
import { renameTag } from '$lib/server/items';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { from?: string; to?: string };
	if (typeof body.from !== 'string' || typeof body.to !== 'string') {
		throw error(400, 'from and to required');
	}
	const n = await renameTag(platform.env.DB, locals.user.id, body.from, body.to);
	return json({ updated: n });
};
