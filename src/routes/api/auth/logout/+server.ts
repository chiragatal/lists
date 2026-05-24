import { redirect, type RequestHandler } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, platform }) => {
	const sid = cookies.get(SESSION_COOKIE);
	if (sid && platform?.env?.DB) {
		try {
			await deleteSession(platform.env.DB, sid);
		} catch (e) {
			console.error('[auth] failed to delete session', e);
		}
	}
	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
