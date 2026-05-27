import { error, json, type RequestHandler } from '@sveltejs/kit';
import { accessRole, addShare, listMembers } from '$lib/server/shares';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', id);
	if (role !== 'owner') throw error(403, 'owner only');
	const members = await listMembers(platform.env.DB, 'plan', id);
	return json({ members });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', id);
	if (role !== 'owner') throw error(403, 'owner only');
	const body = (await request.json()) as { email?: string; role?: string };
	const email = (body.email ?? '').trim().toLowerCase();
	if (!email || !email.includes('@')) throw error(400, 'valid email required');
	if (email === locals.user.email.toLowerCase()) throw error(400, "can't share with yourself");
	const shareRole = body.role === 'viewer' ? 'viewer' : 'editor';
	const member = await addShare(platform.env.DB, locals.user.id, 'plan', id, email, shareRole);
	return json(member, { status: 201 });
};
