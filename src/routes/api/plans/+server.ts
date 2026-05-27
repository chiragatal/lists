import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createPlan, listPlans } from '$lib/server/plans';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const plans = await listPlans(platform.env.DB, locals.user.id);
	return json({ plans });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { name?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const plan = await createPlan(platform.env.DB, locals.user.id, body.name);
	return json(plan, { status: 201 });
};
