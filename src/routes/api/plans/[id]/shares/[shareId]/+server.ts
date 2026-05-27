import { error, type RequestHandler } from '@sveltejs/kit';
import { accessRole, removeShare } from '$lib/server/shares';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	const shareId = Number(params.shareId);
	if (!Number.isFinite(id) || !Number.isFinite(shareId)) throw error(400, 'invalid id');
	const role = await accessRole(platform.env.DB, locals.user.id, 'plan', id);
	if (role !== 'owner') throw error(403, 'owner only');
	const ok = await removeShare(platform.env.DB, 'plan', id, shareId);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
