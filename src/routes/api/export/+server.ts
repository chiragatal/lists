import { error, json, type RequestHandler } from '@sveltejs/kit';
import { buildExport } from '$lib/server/backup';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const data = await buildExport(platform.env.DB, locals.user.id);
	return json(data);
};
