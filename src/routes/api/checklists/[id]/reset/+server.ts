import { error, json, type RequestHandler } from '@sveltejs/kit';
import { resetChecklist } from '$lib/server/checklists';
import { accessRole, canWrite } from '$lib/server/shares';

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const body = (await request.json()) as { mode?: string };
	const mode = body.mode === 'done' ? 'done' : body.mode === 'all' ? 'all' : null;
	if (!mode) throw error(400, 'mode must be "all" or "done"');
	const role = await accessRole(platform.env.DB, locals.user.id, 'checklist', id);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const result = await resetChecklist(platform.env.DB, locals.user.id, id, mode);
	if (!result) throw error(404, 'not found');
	return json(result);
};
