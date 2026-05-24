import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { buildAuthorizeUrl, newState, OAUTH_STATE_COOKIE } from '$lib/server/oauth';

export const GET: RequestHandler = ({ url, cookies, platform }) => {
	const env = platform?.env;
	if (!env?.GOOGLE_CLIENT_ID) {
		throw error(500, 'GOOGLE_CLIENT_ID not configured');
	}

	const state = newState();
	const next = url.searchParams.get('next') ?? '/';
	const payload = `${state}|${next}`;

	cookies.set(OAUTH_STATE_COOKIE, payload, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 600 // 10 minutes
	});

	const redirectUri = `${url.origin}/api/auth/google/callback`;
	const authUrl = buildAuthorizeUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri, state });

	throw redirect(303, authUrl);
};
