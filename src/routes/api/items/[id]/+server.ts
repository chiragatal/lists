import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteItem, updateItem, type UpdateInput } from '$lib/server/items';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const body = (await request.json()) as Record<string, unknown>;

	const patch: UpdateInput = {};
	if (typeof body.name === 'string') patch.name = body.name;
	if (typeof body.category === 'string') patch.category = body.category;
	if (Array.isArray(body.tags)) patch.tags = body.tags as string[];
	if (body.notes === null || typeof body.notes === 'string') patch.notes = body.notes as string | null;
	if (Array.isArray(body.completedAt))
		patch.completedAt = (body.completedAt as unknown[]).filter(
			(t): t is number => typeof t === 'number'
		);
	if (body.inShortlist === 0 || body.inShortlist === 1) patch.inShortlist = body.inShortlist;
	if (body.inActive === 0 || body.inActive === 1) patch.inActive = body.inActive;
	if (typeof body.sortOrder === 'number') patch.sortOrder = body.sortOrder;

	const updated = await updateItem(platform.env.DB, locals.user.id, id, patch);
	if (!updated) throw error(404, 'not found');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	const ok = await deleteItem(platform.env.DB, locals.user.id, id);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
