import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { exchangeCodeForProfile, OAUTH_STATE_COOKIE } from '$lib/server/oauth';
import {
	createSession,
	findOrCreateUserByEmail,
	setSessionCookie
} from '$lib/server/auth';
import { resolvePendingInvites } from '$lib/server/shares';

export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const env = platform?.env;
	if (!env?.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		throw error(500, 'Auth not configured');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const oauthError = url.searchParams.get('error');

	if (oauthError) {
		throw redirect(303, `/login?error=${encodeURIComponent(oauthError)}`);
	}
	if (!code || !state) {
		throw error(400, 'Missing code or state');
	}

	const cookiePayload = cookies.get(OAUTH_STATE_COOKIE);
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
	if (!cookiePayload) {
		throw error(400, 'Missing OAuth state cookie');
	}
	const [savedState, next] = cookiePayload.split('|');
	if (savedState !== state) {
		throw error(400, 'State mismatch');
	}

	const redirectUri = `${url.origin}/api/auth/google/callback`;
	let profile;
	try {
		profile = await exchangeCodeForProfile({
			code,
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectUri
		});
	} catch (e) {
		console.error('[oauth] callback failed', e);
		throw redirect(303, `/login?error=${encodeURIComponent('oauth_failed')}`);
	}

	const user = await findOrCreateUserByEmail(env.DB, profile);
	// Attach any pending share invites addressed to this email.
	try {
		await resolvePendingInvites(env.DB, user.id, user.email);
	} catch (e) {
		console.error('[oauth] resolve invites failed', e);
	}
	const session = await createSession(env.DB, user.id);
	setSessionCookie(cookies, session.id, session.expiresAt);

	const dest = next && next.startsWith('/') ? next : '/';
	throw redirect(303, dest);
};
