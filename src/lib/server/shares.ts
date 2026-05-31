import type { D1Database } from '@cloudflare/workers-types';

export type Role = 'owner' | 'editor' | 'viewer';

export type ShareMember = {
	id: number;
	email: string;
	role: 'editor' | 'viewer';
	pending: boolean;
};

/** Returns the requesting user's role for a list, or null if no access. */
export async function accessRole(
	db: D1Database,
	userId: string,
	listId: number
): Promise<Role | null> {
	const row = await db
		.prepare('SELECT owner_id FROM lists WHERE id = ?')
		.bind(listId)
		.first<{ owner_id: string }>();
	if (!row) return null;
	if (row.owner_id === userId) return 'owner';
	const share = await db
		.prepare('SELECT role FROM shares WHERE list_id = ? AND user_id = ?')
		.bind(listId, userId)
		.first<{ role: 'editor' | 'viewer' }>();
	return share ? share.role : null;
}

export function canWrite(role: Role | null): boolean {
	return role === 'owner' || role === 'editor';
}

/** List ids the user can access via a share (not owned). */
export async function sharedListIds(
	db: D1Database,
	userId: string
): Promise<{ id: number; role: 'editor' | 'viewer'; ownerId: string }[]> {
	const res = await db
		.prepare('SELECT list_id, role, owner_id FROM shares WHERE user_id = ?')
		.bind(userId)
		.all<{ list_id: number; role: 'editor' | 'viewer'; owner_id: string }>();
	return (res.results ?? []).map((r) => ({ id: r.list_id, role: r.role, ownerId: r.owner_id }));
}

export async function listMembers(db: D1Database, listId: number): Promise<ShareMember[]> {
	const res = await db
		.prepare(
			'SELECT id, email, role, user_id FROM shares WHERE list_id = ? ORDER BY created_at ASC'
		)
		.bind(listId)
		.all<{ id: number; email: string; role: 'editor' | 'viewer'; user_id: string | null }>();
	return (res.results ?? []).map((r) => ({
		id: r.id,
		email: r.email,
		role: r.role,
		pending: r.user_id == null
	}));
}

export async function addShare(
	db: D1Database,
	ownerId: string,
	listId: number,
	email: string,
	role: 'editor' | 'viewer'
): Promise<ShareMember> {
	const normalized = email.trim().toLowerCase();
	const user = await db
		.prepare('SELECT id FROM users WHERE email = ?')
		.bind(normalized)
		.first<{ id: string }>();
	const now = Date.now();
	const row = await db
		.prepare(
			`INSERT INTO shares (list_id, owner_id, email, user_id, role, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(list_id, email)
			 DO UPDATE SET role = excluded.role, user_id = excluded.user_id
			 RETURNING id, email, role, user_id`
		)
		.bind(listId, ownerId, normalized, user?.id ?? null, role, now)
		.first<{ id: number; email: string; role: 'editor' | 'viewer'; user_id: string | null }>();
	return {
		id: row!.id,
		email: row!.email,
		role: row!.role,
		pending: row!.user_id == null
	};
}

export async function removeShare(
	db: D1Database,
	listId: number,
	shareId: number
): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM shares WHERE id = ? AND list_id = ?')
		.bind(shareId, listId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

/** A member removes their own access to a shared list. */
export async function leaveShare(
	db: D1Database,
	userId: string,
	listId: number
): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM shares WHERE list_id = ? AND user_id = ?')
		.bind(listId, userId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

/** On login, attach this user to any pending invites for their email. */
export async function resolvePendingInvites(
	db: D1Database,
	userId: string,
	email: string
): Promise<void> {
	await db
		.prepare('UPDATE shares SET user_id = ? WHERE email = ? AND user_id IS NULL')
		.bind(userId, email.trim().toLowerCase())
		.run();
}
