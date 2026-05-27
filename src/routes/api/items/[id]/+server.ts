import { error, json, type RequestHandler } from '@sveltejs/kit';
import { deleteItem, getItemPlanId, updateItem, type UpdateInput } from '$lib/server/items';
import { accessRole, canWrite } from '$lib/server/shares';

function parseId(raw: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) throw error(400, 'invalid id');
	return n;
}

async function requireWritableItem(db: App.Platform['env']['DB'], userId: string, itemId: number) {
	const planId = await getItemPlanId(db, itemId);
	if (planId == null) throw error(404, 'not found');
	const role = await accessRole(db, userId, 'plan', planId);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
}

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	await requireWritableItem(platform.env.DB, locals.user.id, id);
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

	const updated = await updateItem(platform.env.DB, id, patch);
	if (!updated) throw error(404, 'not found');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const id = parseId(params.id!);
	await requireWritableItem(platform.env.DB, locals.user.id, id);
	const ok = await deleteItem(platform.env.DB, id);
	if (!ok) throw error(404, 'not found');
	return new Response(null, { status: 204 });
};
