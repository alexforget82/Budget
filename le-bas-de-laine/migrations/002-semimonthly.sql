-- Keep all IDs and references while expanding the period constraint.
BEGIN IMMEDIATE;
CREATE TABLE categories_new(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,limit_cents INTEGER CHECK(limit_cents>=0),period TEXT CHECK(period IN ('weekly','monthly','semimonthly')),renewal_day INTEGER,starts_on TEXT,active INTEGER NOT NULL DEFAULT 1,source_key TEXT UNIQUE,source_hash TEXT,dirty INTEGER NOT NULL DEFAULT 0,renewal_day2 INTEGER);
INSERT INTO categories_new(id,name,limit_cents,period,renewal_day,starts_on,active,source_key,source_hash,dirty) SELECT id,name,limit_cents,period,renewal_day,starts_on,active,source_key,source_hash,dirty FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE recurrences ADD COLUMN second_day INTEGER;
PRAGMA user_version=2;
COMMIT;
