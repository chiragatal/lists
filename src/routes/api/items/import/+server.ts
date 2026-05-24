import { error, json, type RequestHandler } from '@sveltejs/kit';
import { bulkImport, type CreateInput } from '$lib/server/items';

function coerceTier(raw: unknown): 'library' | 'shortlist' | 'active' {
	if (raw === 'shortlist' || raw === 'active' || raw === 'library') return raw;
	return 'library';
}

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const body = (await request.json()) as { items?: unknown; mode?: string };
	if (!Array.isArray(body.items)) throw error(400, 'items array required');
	const mode = body.mode === 'replace' ? 'replace' : 'merge';

	const inputs: CreateInput[] = body.items.map((raw) => {
		const r = (raw ?? {}) as Record<string, unknown>;
		// Accept both API shape and legacy IndexedDB-export shape (with inShortlist/inActive)
		let tier: 'library' | 'shortlist' | 'active';
		if (typeof r.tier === 'string') {
			tier = coerceTier(r.tier);
		} else if (r.inActive === 1) {
			tier = 'active';
		} else if (r.inShortlist === 1) {
			tier = 'shortlist';
		} else {
			tier = 'library';
		}
		return {
			name: String(r.name ?? '').trim() || 'Untitled',
			category: String(r.category ?? '').trim(),
			tags: Array.isArray(r.tags) ? (r.tags as string[]).map(String) : [],
			notes: typeof r.notes === 'string' ? r.notes : undefined,
			tier,
			completedAt: Array.isArray(r.completedAt)
				? (r.completedAt as unknown[]).filter((t): t is number => typeof t === 'number')
				: undefined,
			sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : undefined,
			createdAt: typeof r.createdAt === 'number' ? r.createdAt : undefined,
			updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : undefined
		};
	});

	const n = await bulkImport(platform.env.DB, locals.user.id, inputs, mode);
	return json({ imported: n });
};
