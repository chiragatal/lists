import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteList, getList, renameList } from '$lib/server/lists';
import { listItems } from '$lib/server/items';
import { accessRole } from '$lib/server/shares';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const db = platform.env.DB;
	const id = parseId(params.id!);
	const role = await accessRole(db, locals.user.id, id);
	if (!role) throw error(404, 'not found');
	const list = await getList(db, id);
	if (!list) throw error(404, 'not found');
	const items = await listItems(db, id);
	return json({ list, items, role });
};

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const body = (await request.json()) as { name?: string };
	if (!body.name || typeof body.name !== 'string') throw error(400, 'name required');
	const ok = await renameList(platform.env.DB, locals.user.id, id, body.name);
	if (!ok) throw error(404, 'not found');
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const ok = await deleteList(platform.env.DB, locals.user.id, id);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
