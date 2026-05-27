-- Multiple Plans: each Plan is its own Library/Shortlist/Active funnel.
-- Existing items are wrapped into one default "Plan" per user.

CREATE TABLE plans (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	owner_id TEXT NOT NULL,
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_plans_owner ON plans(owner_id, sort_order);

ALTER TABLE items ADD COLUMN plan_id INTEGER;
CREATE INDEX idx_items_plan ON items(plan_id);

-- Create one default plan per user who already has items.
INSERT INTO plans (owner_id, name, sort_order, created_at, updated_at)
SELECT DISTINCT user_id, 'Plan', 1000, (unixepoch() * 1000), (unixepoch() * 1000)
FROM items;

-- Assign every existing item to its owner's default plan.
UPDATE items
SET plan_id = (SELECT p.id FROM plans p WHERE p.owner_id = items.user_id);
