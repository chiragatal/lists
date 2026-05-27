-- Recurring checklists: a separate structure from the Plans funnel.

CREATE TABLE checklists (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	last_reset_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_checklists_user ON checklists(user_id, sort_order);

CREATE TABLE checklist_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	checklist_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT '',
	name TEXT NOT NULL,
	state TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_checklist_items_list ON checklist_items(checklist_id, sort_order);

-- Snapshot of a run, captured on reset. Stores counts plus a JSON
-- breakdown of items and their states at that moment.
CREATE TABLE checklist_snapshots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	checklist_id INTEGER NOT NULL,
	user_id TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	reason TEXT NOT NULL, -- reset_all | clear_done
	done_count INTEGER NOT NULL,
	skipped_count INTEGER NOT NULL,
	pending_count INTEGER NOT NULL,
	total INTEGER NOT NULL,
	items_json TEXT NOT NULL DEFAULT '[]',
	FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_checklist_snapshots_list ON checklist_snapshots(checklist_id, created_at);
