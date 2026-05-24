import type { D1Database } from '@cloudflare/workers-types';
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'lists_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
	id: string;
	email: string;
	name: string | null;
	picture: string | null;
};

function randomToken(bytes = 32): string {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newUserId(): string {
	return crypto.randomUUID();
}

export async function findOrCreateUserByEmail(
	db: D1Database,
	profile: { email: string; name?: string | null; picture?: string | null }
): Promise<SessionUser> {
	const now = Date.now();
	const existing = await db
		.prepare('SELECT id, email, name, picture FROM users WHERE email = ?')
		.bind(profile.email)
		.first<SessionUser>();

	if (existing) {
		// Refresh name/picture if Google sends them
		if ((profile.name && profile.name !== existing.name) || (profile.picture && profile.picture !== existing.picture)) {
			await db
				.prepare('UPDATE users SET name = ?, picture = ?, updated_at = ? WHERE id = ?')
				.bind(profile.name ?? existing.name, profile.picture ?? existing.picture, now, existing.id)
				.run();
		}
		return existing;
	}

	const id = newUserId();
	await db
		.prepare(
			'INSERT INTO users (id, email, name, picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(id, profile.email, profile.name ?? null, profile.picture ?? null, now, now)
		.run();

	return {
		id,
		email: profile.email,
		name: profile.name ?? null,
		picture: profile.picture ?? null
	};
}

export async function createSession(db: D1Database, userId: string): Promise<{ id: string; expiresAt: number }> {
	const id = randomToken(32);
	const now = Date.now();
	const expiresAt = now + SESSION_TTL_MS;
	await db
		.prepare(
			'INSERT INTO sessions (id, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(id, userId, now, expiresAt, now)
		.run();
	return { id, expiresAt };
}

export async function loadSession(
	db: D1Database,
	sessionId: string
): Promise<{ user: SessionUser; expiresAt: number } | null> {
	const row = await db
		.prepare(
			`SELECT s.id AS sid, s.expires_at AS exp, u.id AS uid, u.email, u.name, u.picture
			   FROM sessions s JOIN users u ON u.id = s.user_id
			  WHERE s.id = ?`
		)
		.bind(sessionId)
		.first<{
			sid: string;
			exp: number;
			uid: string;
			email: string;
			name: string | null;
			picture: string | null;
		}>();

	if (!row) return null;
	if (row.exp < Date.now()) {
		await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
		return null;
	}

	// Sliding window: extend session TTL on every authenticated request.
	const now = Date.now();
	const newExpires = now + SESSION_TTL_MS;
	await db
		.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?')
		.bind(now, newExpires, sessionId)
		.run();

	return {
		user: { id: row.uid, email: row.email, name: row.name, picture: row.picture },
		expiresAt: newExpires
	};
}

export async function deleteSession(db: D1Database, sessionId: string) {
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function deleteAllSessionsForUser(db: D1Database, userId: string) {
	await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

export function setSessionCookie(cookies: Cookies, sessionId: string, expiresAt: number) {
	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
