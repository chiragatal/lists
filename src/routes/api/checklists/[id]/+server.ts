import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteChecklist, getChecklist, renameChecklist } from '$lib/server/checklists';
import { accessRole } from '$lib/server/shares';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', id);
	if (!role) throw error(404, 'not found');
	const data = await getChecklist(platform.env.DB, id);
	if (!data) throw error(404, 'not found');
	return json({ ...data, role });
};

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', id);
	if (role !== 'owner') throw error(403, 'owner only');
	const body = (await request.json()) as { name?: string };
	if (typeof body.name !== 'string' || !body.name.trim()) throw error(400, 'name required');
	const ok = await renameChecklist(platform.env.DB, locals.user.id, id, body.name);
	if (!ok) throw error(404, 'not found');
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', id);
	if (role !== 'owner') throw error(403, 'owner only');
	const ok = await deleteChecklist(platform.env.DB, locals.user.id, id);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
