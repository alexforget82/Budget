BEGIN IMMEDIATE;
ALTER TABLE transactions ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 1 CHECK(reviewed IN (0,1));
CREATE TABLE rules(id INTEGER PRIMARY KEY AUTOINCREMENT,priority INTEGER NOT NULL DEFAULT 100,match_type TEXT NOT NULL CHECK(match_type IN ('contains','starts','equals')),pattern TEXT NOT NULL,account_id INTEGER REFERENCES accounts(id),direction TEXT NOT NULL CHECK(direction IN ('expense','income')),min_cents INTEGER,max_cents INTEGER,category_id INTEGER NOT NULL REFERENCES categories(id),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
PRAGMA user_version=3;
COMMIT;
