import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createItem, listItems } from '$lib/server/items';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const items = await listItems(platform.env.DB, locals.user.id);
	return json({ items, user: { email: locals.user.email, name: locals.user.name, picture: locals.user.picture } });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as Record<string, unknown>;
	if (typeof body.name !== 'string' || !body.name.trim()) {
		throw error(400, 'name required');
	}
	if (typeof body.category !== 'string' || !body.category.trim()) {
		throw error(400, 'category required');
	}
	const item = await createItem(platform.env.DB, locals.user.id, {
		name: body.name,
		category: body.category,
		tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
		notes: typeof body.notes === 'string' ? body.notes : undefined,
		tier: body.tier === 'shortlist' || body.tier === 'active' ? body.tier : 'library'
	});
	return json(item, { status: 201 });
};
