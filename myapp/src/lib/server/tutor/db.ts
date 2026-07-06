import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import * as schema from './schema.js';
import { FRACTION_SKILLS } from '$lib/pedagogy/skills.js';

export type TutorDb = BetterSQLite3Database<typeof schema>;

// Runs migrations from myapp/drizzle and idempotently seeds the fractions
// skills. cwd is assumed to be myapp/ (dev server and vitest both run there —
// architecture.md §8 A8).
export function createTutorDb(path: string): TutorDb {
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: resolve('drizzle') });
	seedSkills(db);
	return db;
}

function seedSkills(db: TutorDb): void {
	for (const s of FRACTION_SKILLS) {
		db.insert(schema.skills).values(s).onConflictDoNothing().run();
	}
}

let singleton: TutorDb | undefined;

export function getTutorDb(): TutorDb {
	if (!singleton) {
		singleton = createTutorDb(process.env.DATABASE_PATH ?? resolve('data/happy-bear.db'));
	}
	return singleton;
}
