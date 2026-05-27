import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createItem, listItems } from '$lib/server/items';
import { getPlan, ownsPlan } from '$lib/server/plans';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const planId = Number(url.searchParams.get('plan'));
	if (!Number.isFinite(planId)) throw error(400, 'plan query param required');
	const plan = await getPlan(platform.env.DB, locals.user.id, planId);
	if (!plan) throw error(404, 'plan not found');
	const items = await listItems(platform.env.DB, locals.user.id, planId);
	return json({ items, plan: { id: plan.id, name: plan.name } });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as Record<string, unknown>;
	const planId = Number(body.planId);
	if (!Number.isFinite(planId)) throw error(400, 'planId required');
	if (!(await ownsPlan(platform.env.DB, locals.user.id, planId))) throw error(404, 'plan not found');
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	if (typeof body.category !== 'string' || !body.category.trim()) throw error(400, 'category required');
	const item = await createItem(platform.env.DB, locals.user.id, planId, {
		name: body.name,
		category: body.category,
		tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
		notes: typeof body.notes === 'string' ? body.notes : undefined,
		tier: body.tier === 'shortlist' || body.tier === 'active' ? body.tier : 'library'
	});
	return json(item, { status: 201 });
};
