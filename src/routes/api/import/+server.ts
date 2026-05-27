import { error, json, type RequestHandler } from '@sveltejs/kit';
import { applyImport } from '$lib/server/backup';

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { data?: unknown; mode?: string };
	if (body.data === undefined) throw error(400, 'data required');
	const mode = body.mode === 'replace' ? 'replace' : 'merge';
	const result = await applyImport(
		platform.env.DB,
		locals.user.id,
		body.data as Record<string, unknown>,
		mode
	);
	return json(result);
};
