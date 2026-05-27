import { error, json, type RequestHandler } from '@sveltejs/kit';
import { renameCategory } from '$lib/server/items';
import { ownsPlan } from '$lib/server/plans';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { planId?: number; from?: string; to?: string };
	const planId = Number(body.planId);
	if (!Number.isFinite(planId)) throw error(400, 'planId required');
	if (typeof body.from !== 'string' || typeof body.to !== 'string') {
		throw error(400, 'from and to required');
	}
	if (!(await ownsPlan(platform.env.DB, locals.user.id, planId))) throw error(404, 'plan not found');
	const n = await renameCategory(platform.env.DB, locals.user.id, planId, body.from, body.to);
	return json({ updated: n });
};
