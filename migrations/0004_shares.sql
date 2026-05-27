-- Sharing: a plan or checklist can be shared with other users by email.
-- user_id is NULL until the invitee logs in (pending invite resolves then).

CREATE TABLE shares (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	object_type TEXT NOT NULL,        -- 'plan' | 'checklist'
	object_id INTEGER NOT NULL,
	owner_id TEXT NOT NULL,           -- who shared it (for listing "shared by me")
	email TEXT NOT NULL,              -- invitee email, lowercased
	user_id TEXT,                     -- resolved on login; NULL = pending
	role TEXT NOT NULL,               -- 'editor' | 'viewer'
	created_at INTEGER NOT NULL,
	FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_shares_unique ON shares(object_type, object_id, email);
CREATE INDEX idx_shares_user ON shares(user_id);
CREATE INDEX idx_shares_email ON shares(email);
CREATE INDEX idx_shares_object ON shares(object_type, object_id);
