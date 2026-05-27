import { error, json, type RequestHandler } from '@sveltejs/kit';
import { renameTag } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { planId?: number; from?: string; to?: string };
	const planId = Number(body.planId);
	if (!Number.isFinite(planId)) throw error(400, 'planId required');
	if (typeof body.from !== 'string' || typeof body.to !== 'string') {
		throw error(400, 'from and to required');
	}
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', planId);
	if (!role) throw error(404, 'plan not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const n = await renameTag(platform.env.DB, planId, body.from, body.to);
	return json({ updated: n });
};
