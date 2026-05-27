import { error, json, type RequestHandler } from '@sveltejs/kit';
import { reorderItems } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { planId?: number; ids?: number[] };
	const planId = Number(body.planId);
	if (!Number.isFinite(planId)) throw error(400, 'planId required');
	if (!Array.isArray(body.ids) || !body.ids.every((n) => Number.isFinite(n))) {
		throw error(400, 'ids array required');
	}
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', planId);
	if (!role) throw error(404, 'plan not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	await reorderItems(platform.env.DB, planId, body.ids);
	return json({ ok: true });
};
