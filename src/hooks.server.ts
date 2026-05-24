import { redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	loadSession,
	setSessionCookie
} from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/google/start', '/api/auth/google/callback'];

export const handle: Handle = async ({ event, resolve }) => {
	const platform = event.platform;
	event.locals.user = null;

	const db = platform?.env.DB;
	if (db) {
		const sid = event.cookies.get(SESSION_COOKIE);
		if (sid) {
			try {
				const session = await loadSession(db, sid);
				if (session) {
					event.locals.user = session.user;
					// Refresh cookie expiry to match the slid expiry
					setSessionCookie(event.cookies, sid, session.expiresAt);
				} else {
					clearSessionCookie(event.cookies);
				}
			} catch (e) {
				console.error('[auth] session load failed', e);
				clearSessionCookie(event.cookies);
			}
		}
	}

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
	const isAsset = path.startsWith('/_app/') || path.startsWith('/icon-') || path === '/manifest.webmanifest' || path === '/sw.js' || path === '/robots.txt' || path === '/registerSW.js';

	if (!event.locals.user && !isPublic && !isAsset) {
		const isApi = path.startsWith('/api/');
		if (isApi) {
			return new Response(JSON.stringify({ error: 'unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		throw redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}

	return resolve(event);
};
