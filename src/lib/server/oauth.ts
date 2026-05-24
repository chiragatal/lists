/**
 * Google OAuth 2.0 (Authorization Code flow) helpers.
 * Returns the URL to redirect the user to, and exchanges the callback
 * code for a profile (email + name + picture).
 */

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

export const OAUTH_STATE_COOKIE = 'lists_oauth_state';

function randomState(): string {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildAuthorizeUrl(input: {
	clientId: string;
	redirectUri: string;
	state: string;
	next?: string;
}): string {
	const params = new URLSearchParams({
		client_id: input.clientId,
		redirect_uri: input.redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		access_type: 'online',
		include_granted_scopes: 'true',
		prompt: 'select_account',
		state: input.state
	});
	return `${GOOGLE_AUTH}?${params}`;
}

export function newState(): string {
	return randomState();
}

export async function exchangeCodeForProfile(input: {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}): Promise<{ email: string; name: string | null; picture: string | null }> {
	const tokenRes = await fetch(GOOGLE_TOKEN, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code: input.code,
			client_id: input.clientId,
			client_secret: input.clientSecret,
			redirect_uri: input.redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenRes.ok) {
		const body = await tokenRes.text();
		throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
	}

	const tokens = (await tokenRes.json()) as { access_token: string; id_token?: string };

	// Prefer userinfo endpoint over decoding the id_token — avoids signature
	// verification dependency for a small extra request.
	const userRes = await fetch(GOOGLE_USERINFO, {
		headers: { authorization: `Bearer ${tokens.access_token}` }
	});

	if (!userRes.ok) {
		const body = await userRes.text();
		throw new Error(`Userinfo failed (${userRes.status}): ${body}`);
	}

	const profile = (await userRes.json()) as {
		email?: string;
		email_verified?: boolean;
		name?: string;
		picture?: string;
	};

	if (!profile.email) {
		throw new Error('Google profile missing email');
	}
	if (profile.email_verified === false) {
		throw new Error('Google email is not verified');
	}

	return {
		email: profile.email,
		name: profile.name ?? null,
		picture: profile.picture ?? null
	};
}
