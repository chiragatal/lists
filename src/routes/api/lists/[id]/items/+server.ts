import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createItem, type CreateInput, type Tier, type ChecklistState } from '$lib/server/items';
import { getListType } from '$lib/server/lists';
import { accessRole, canWrite } from '$lib/server/shares';

function asTier(v: unknown): Tier | undefined {
	return v === 'library' || v === 'shortlist' || v === 'active' ? v : undefined;
}
function asState(v: unknown): ChecklistState | undefined {
	return v === 'pending' || v === 'done' || v === 'skipped' ? v : undefined;
}

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const db = platform.env.DB;
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');
	const role = await accessRole(db, locals.user.id, id);
	if (!role) throw error(404, 'not found');
	if (!canWrite(role)) throw error(403, 'read-only');
	const type = await getListType(db, id);
	if (!type) throw error(404, 'not found');

	const body = (await request.json()) as Record<string, unknown>;
	const name = String(body.name ?? '').trim();
	const category = String(body.category ?? '').trim();
	if (!name) throw error(400, 'name required');

	let input: CreateInput;
	if (type === 'plan') {
		input = {
			type: 'plan',
			name,
			category,
			tier: asTier(body.tier) ?? 'library',
			tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map(String) : [],
			notes: typeof body.notes === 'string' ? body.notes : undefined
		};
	} else {
		input = {
			type: 'checklist',
			name,
			category,
			state: asState(body.state) ?? 'pending'
		};
	}
	const item = await createItem(db, id, input);
	return json(item, { status: 201 });
};
