import { error, json, type RequestHandler } from '@sveltejs/kit';
import { clearActive } from '$lib/server/items';

export const POST: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const n = await clearActive(platform.env.DB, locals.user.id);
	return json({ cleared: n });
};
