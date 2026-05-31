-- Unify plans + checklists into one `lists` parent, one `items` table,
-- one `snapshots` table (checklist history), and a `shares` table that
-- references list_id directly (no more object_type discriminator).
--
-- Destructive: drops all prior content. Data is restored from the user's
-- backup file via the importer (schema bumped to lists.v5).

DROP TABLE IF EXISTS checklist_snapshots;
DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS checklists;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS shares;

CREATE TABLE lists (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	owner_id TEXT NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('plan', 'checklist')),
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	last_reset_at INTEGER,           -- checklist-only; NULL for plans
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_lists_owner ON lists(owner_id, sort_order);

CREATE TABLE items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	list_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT '',
	sort_order INTEGER NOT NULL DEFAULT 0,
	-- plan-only (NULL for checklist items):
	tier TEXT,                        -- 'library' | 'shortlist' | 'active'
	tags TEXT,                        -- JSON array
	notes TEXT,
	completed_at TEXT,                -- JSON array of timestamps
	-- checklist-only (NULL for plan items):
	state TEXT,                       -- 'pending' | 'done' | 'skipped'
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);
CREATE INDEX idx_items_list ON items(list_id, sort_order);

CREATE TABLE snapshots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	list_id INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	reason TEXT NOT NULL,             -- 'reset_all' | 'clear_done'
	done_count INTEGER NOT NULL,
	skipped_count INTEGER NOT NULL,
	pending_count INTEGER NOT NULL,
	total INTEGER NOT NULL,
	items_json TEXT NOT NULL DEFAULT '[]',
	FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);
CREATE INDEX idx_snapshots_list ON snapshots(list_id, created_at);

CREATE TABLE shares (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	list_id INTEGER NOT NULL,
	owner_id TEXT NOT NULL,           -- denormalized for "shared by me" listings
	email TEXT NOT NULL,              -- invitee email, lowercased
	user_id TEXT,                     -- resolved on login; NULL = pending
	role TEXT NOT NULL,               -- 'editor' | 'viewer'
	created_at INTEGER NOT NULL,
	FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
	FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_shares_unique ON shares(list_id, email);
CREATE INDEX idx_shares_user ON shares(user_id);
CREATE INDEX idx_shares_email ON shares(email);
CREATE INDEX idx_shares_list ON shares(list_id);
