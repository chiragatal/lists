import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteChecklist, getChecklist, renameChecklist } from '$lib/server/checklists';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const data = await getChecklist(platform.env.DB, locals.user.id, parseId(params.id!));
	if (!data) throw error(404, 'not found');
	return json(data);
};

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { name?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const ok = await renameChecklist(platform.env.DB, locals.user.id, parseId(params.id!), body.name);
	if (!ok) throw error(404, 'not found');
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const ok = await deleteChecklist(platform.env.DB, locals.user.id, parseId(params.id!));
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
