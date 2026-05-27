import type { D1Database } from '@cloudflare/workers-types';

export type Role = 'owner' | 'editor' | 'viewer';
export type ObjectType = 'plan' | 'checklist';

export type ShareMember = {
	id: number;
	email: string;
	role: 'editor' | 'viewer';
	pending: boolean;
};

function ownerColumn(type: ObjectType): { table: string; ownerCol: string } {
	return type === 'plan'
		? { table: 'plans', ownerCol: 'owner_id' }
		: { table: 'checklists', ownerCol: 'user_id' };
}

/** Returns the requesting user's role for an object, or null if no access. */
export async function accessRole(
	db: D1Database,
	userId: string,
	type: ObjectType,
	objectId: number
): Promise<Role | null> {
	const { table, ownerCol } = ownerColumn(type);
	const row = await db
		.prepare(`SELECT ${ownerCol} AS owner FROM ${table} WHERE id = ?`)
		.bind(objectId)
		.first<{ owner: string }>();
	if (!row) return null;
	if (row.owner === userId) return 'owner';
	const share = await db
		.prepare(
			'SELECT role FROM shares WHERE object_type = ? AND object_id = ? AND user_id = ?'
		)
		.bind(type, objectId, userId)
		.first<{ role: 'editor' | 'viewer' }>();
	return share ? share.role : null;
}

export function canWrite(role: Role | null): boolean {
	return role === 'owner' || role === 'editor';
}

/** Object ids of a given type the user can access via a share (not owned). */
export async function sharedObjectIds(
	db: D1Database,
	userId: string,
	type: ObjectType
): Promise<{ id: number; role: 'editor' | 'viewer'; ownerId: string }[]> {
	const res = await db
		.prepare(
			'SELECT object_id, role, owner_id FROM shares WHERE object_type = ? AND user_id = ?'
		)
		.bind(type, userId)
		.all<{ object_id: number; role: 'editor' | 'viewer'; owner_id: string }>();
	return (res.results ?? []).map((r) => ({ id: r.object_id, role: r.role, ownerId: r.owner_id }));
}

export async function listMembers(
	db: D1Database,
	type: ObjectType,
	objectId: number
): Promise<ShareMember[]> {
	const res = await db
		.prepare(
			'SELECT id, email, role, user_id FROM shares WHERE object_type = ? AND object_id = ? ORDER BY created_at ASC'
		)
		.bind(type, objectId)
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
	type: ObjectType,
	objectId: number,
	email: string,
	role: 'editor' | 'viewer'
): Promise<ShareMember> {
	const normalized = email.trim().toLowerCase();
	// Resolve to an existing user if they've signed up.
	const user = await db
		.prepare('SELECT id FROM users WHERE email = ?')
		.bind(normalized)
		.first<{ id: string }>();
	const now = Date.now();
	const row = await db
		.prepare(
			`INSERT INTO shares (object_type, object_id, owner_id, email, user_id, role, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(object_type, object_id, email)
			 DO UPDATE SET role = excluded.role, user_id = excluded.user_id
			 RETURNING id, email, role, user_id`
		)
		.bind(type, objectId, ownerId, normalized, user?.id ?? null, role, now)
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
	type: ObjectType,
	objectId: number,
	shareId: number
): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM shares WHERE id = ? AND object_type = ? AND object_id = ?')
		.bind(shareId, type, objectId)
		.run();
	return (r.meta.changes ?? 0) > 0;
}

/** A member removes their own access to a shared object. */
export async function leaveShare(
	db: D1Database,
	userId: string,
	type: ObjectType,
	objectId: number
): Promise<boolean> {
	const r = await db
		.prepare('DELETE FROM shares WHERE object_type = ? AND object_id = ? AND user_id = ?')
		.bind(type, objectId, userId)
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
