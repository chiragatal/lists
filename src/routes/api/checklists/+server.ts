import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createChecklist, listChecklists } from '$lib/server/checklists';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const checklists = await listChecklists(platform.env.DB, locals.user.id);
	return json({ checklists });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { name?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const checklist = await createChecklist(platform.env.DB, locals.user.id, body.name);
	return json(checklist, { status: 201 });
};
