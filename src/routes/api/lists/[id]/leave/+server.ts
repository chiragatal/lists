import { error, json, type RequestHandler } from '@sveltejs/kit';
import { leaveShare } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const ok = await leaveShare(platform.env.DB, locals.user.id, id);
	if (!ok) throw error(404, 'not a member');
	return json({ ok: true });
};
