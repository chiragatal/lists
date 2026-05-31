import { error, json, type RequestHandler } from '@sveltejs/kit';
import { reorderItems } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const role = await accessRole(platform.env.DB, locals.user.id, id);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const body = (await request.json()) as { ids?: unknown };
	const ids = Array.isArray(body.ids)
		? (body.ids as unknown[]).map(Number).filter((n) => Number.isFinite(n))
		: [];
	await reorderItems(platform.env.DB, id, ids);
	return json({ ok: true });
};
