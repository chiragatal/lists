import { error, json, type RequestHandler } from '@sveltejs/kit';
import { clearActive } from '$lib/server/items';
import { ownsPlan } from '$lib/server/plans';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { planId?: number };
	const planId = Number(body.planId);
	if (!Number.isFinite(planId)) throw error(400, 'planId required');
	if (!(await ownsPlan(platform.env.DB, locals.user.id, planId))) throw error(404, 'plan not found');
	const n = await clearActive(platform.env.DB, locals.user.id, planId);
	return json({ cleared: n });
};
