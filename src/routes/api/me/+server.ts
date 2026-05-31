import { error, json, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie, deleteAllSessionsForUser } from '$lib/server/auth';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	return json({
		email: locals.user.email,
		name: locals.user.name,
		picture: locals.user.picture
	});
};

export const DELETE: RequestHandler = async ({ locals, platform, cookies }) => {
	if (!locals.user || !platform?.env?.DB) throw error(401, 'unauthorized');
	const db = platform.env.DB;
	const uid = locals.user.id;
	// All owned lists, items, snapshots, shares cascade via FK on users.id.
	await deleteAllSessionsForUser(db, uid);
	await db.prepare('DELETE FROM users WHERE id = ?').bind(uid).run();
	clearSessionCookie(cookies);
	return json({ ok: true });
};
