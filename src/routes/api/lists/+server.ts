import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createList, listLists, type ListType } from '$lib/server/lists';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const lists = await listLists(platform.env.DB, locals.user.id);
	return json({ lists });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { type?: string; name?: string };
	const type: ListType = body.type === 'checklist' ? 'checklist' : 'plan';
	const name = (body.name ?? '').trim();
	const list = await createList(platform.env.DB, locals.user.id, type, name);
	return json(list, { status: 201 });
};
