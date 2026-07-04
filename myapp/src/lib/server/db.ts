import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = resolve('data/happy-bear.db');

let db: Database.Database;

export function getDb(): Database.Database {
	if (!db) {
		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
		initializeSchema();
	}
	return db;
}

function initializeSchema() {
	db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			display_name TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			last_active_at TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL REFERENCES sessions(id),
			role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
			content TEXT NOT NULL,
			emotion TEXT,
			created_at TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS user_facts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL REFERENCES sessions(id),
			fact_type TEXT NOT NULL,
			fact_key TEXT NOT NULL,
			fact_value TEXT NOT NULL,
			extracted_at TEXT DEFAULT (datetime('now')),
			UNIQUE(session_id, fact_type, fact_key)
		);

		CREATE TABLE IF NOT EXISTS interactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL REFERENCES sessions(id),
			interaction_type TEXT NOT NULL,
			created_at TEXT DEFAULT (datetime('now'))
		);

		CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
		CREATE INDEX IF NOT EXISTS idx_facts_session ON user_facts(session_id);
		CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
	`);
}

// Session helpers
export function createSession(id: string): void {
	getDb().prepare('INSERT INTO sessions (id) VALUES (?)').run(id);
}

export function getSession(id: string) {
	return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
		| {
				id: string;
				display_name: string | null;
				created_at: string;
				last_active_at: string;
		  }
		| undefined;
}

export function updateSessionActivity(id: string): void {
	getDb().prepare("UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?").run(id);
}

export function updateSessionName(id: string, name: string): void {
	getDb().prepare('UPDATE sessions SET display_name = ? WHERE id = ?').run(name, id);
}

// Message helpers
export function saveMessage(
	sessionId: string,
	role: 'user' | 'assistant',
	content: string,
	emotion?: string
): void {
	getDb()
		.prepare('INSERT INTO messages (session_id, role, content, emotion) VALUES (?, ?, ?, ?)')
		.run(sessionId, role, content, emotion ?? null);
}

export function getRecentMessages(sessionId: string, limit = 20) {
	return getDb()
		.prepare(
			'SELECT role, content, emotion, created_at FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
		)
		.all(sessionId, limit)
		.reverse() as Array<{
		role: 'user' | 'assistant';
		content: string;
		emotion: string | null;
		created_at: string;
	}>;
}

// Fact helpers
export function upsertFact(
	sessionId: string,
	factType: string,
	factKey: string,
	factValue: string
): void {
	getDb()
		.prepare(
			`INSERT INTO user_facts (session_id, fact_type, fact_key, fact_value)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(session_id, fact_type, fact_key)
		 DO UPDATE SET fact_value = excluded.fact_value, extracted_at = datetime('now')`
		)
		.run(sessionId, factType, factKey, factValue);
}

export function getFacts(sessionId: string) {
	return getDb()
		.prepare('SELECT fact_type, fact_key, fact_value FROM user_facts WHERE session_id = ?')
		.all(sessionId) as Array<{
		fact_type: string;
		fact_key: string;
		fact_value: string;
	}>;
}

// Interaction helpers
export function logInteraction(sessionId: string, interactionType: string): void {
	getDb()
		.prepare('INSERT INTO interactions (session_id, interaction_type) VALUES (?, ?)')
		.run(sessionId, interactionType);
}

export function getInteractionCount(sessionId: string, interactionType?: string): number {
	if (interactionType) {
		const row = getDb()
			.prepare(
				'SELECT COUNT(*) as count FROM interactions WHERE session_id = ? AND interaction_type = ?'
			)
			.get(sessionId, interactionType) as { count: number };
		return row.count;
	}
	const row = getDb()
		.prepare('SELECT COUNT(*) as count FROM interactions WHERE session_id = ?')
		.get(sessionId) as { count: number };
	return row.count;
}

export function getTotalInteractions(sessionId: string): number {
	const row = getDb()
		.prepare('SELECT COUNT(*) as count FROM interactions WHERE session_id = ?')
		.get(sessionId) as { count: number };
	return row.count;
}
