import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getItemPlanId, setTier } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const body = (await request.json()) as { tier?: string };
	if (body.tier !== 'library' && body.tier !== 'shortlist' && body.tier !== 'active') {
		throw error(400, 'invalid tier');
	}
	const planId = await getItemPlanId(platform.env.DB, id);
	if (planId == null) throw error(404, 'not found');
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', planId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const updated = await setTier(platform.env.DB, id, body.tier);
	if (!updated) throw error(404, 'not found');
	return json(updated);
};
