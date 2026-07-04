import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// Tutor-side tables (architecture.md §4). Legacy companion tables
// (sessions/messages/user_facts/interactions) live in db.ts and stay untouched.

export const learners = sqliteTable('learners', {
	id: text('id').primaryKey(),
	displayName: text('display_name'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const skills = sqliteTable('skills', {
	id: text('id').primaryKey(),
	domain: text('domain').notNull(),
	name: text('name').notNull(),
	description: text('description').notNull()
});

export const mastery = sqliteTable(
	'mastery',
	{
		learnerId: text('learner_id')
			.notNull()
			.references(() => learners.id),
		skillId: text('skill_id')
			.notNull()
			.references(() => skills.id),
		stability: real('stability').notNull(),
		difficulty: real('difficulty').notNull(),
		due: text('due').notNull(), // ISO datetime
		state: text('state', { enum: ['new', 'learning', 'review', 'relearning'] }).notNull(),
		reps: integer('reps').notNull().default(0),
		lapses: integer('lapses').notNull().default(0),
		elapsedDays: real('elapsed_days').notNull().default(0),
		scheduledDays: real('scheduled_days').notNull().default(0),
		learningSteps: integer('learning_steps').notNull().default(0),
		pRecall: real('p_recall').notNull().default(0),
		lastReview: text('last_review')
	},
	(t) => [primaryKey({ columns: [t.learnerId, t.skillId] })]
);

export const misconceptions = sqliteTable('misconceptions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	learnerId: text('learner_id')
		.notNull()
		.references(() => learners.id),
	skillId: text('skill_id').references(() => skills.id),
	tag: text('tag').notNull(),
	evidence: text('evidence').notNull(),
	turnId: integer('turn_id'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	resolvedAt: text('resolved_at')
});

export const tutorSessions = sqliteTable('tutor_sessions', {
	id: text('id').primaryKey(),
	learnerId: text('learner_id')
		.notNull()
		.references(() => learners.id),
	mode: text('mode', { enum: ['text', 'voice'] }).notNull(),
	startedAt: text('started_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	endedAt: text('ended_at')
});

export const turns = sqliteTable('turns', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: text('session_id')
		.notNull()
		.references(() => tutorSessions.id),
	role: text('role', { enum: ['learner', 'tutor'] }).notNull(),
	content: text('content').notNull(),
	move: text('move'),
	toolCalls: text('tool_calls'), // JSON array of {name, input, result}
	flagged: integer('flagged').notNull().default(0),
	flagReason: text('flag_reason'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});

export const quizItems = sqliteTable('quiz_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	skillId: text('skill_id')
		.notNull()
		.references(() => skills.id),
	prompt: text('prompt').notNull(),
	answer: text('answer').notNull(),
	distractors: text('distractors'), // JSON array of strings
	source: text('source').notNull().default('llm'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`)
});
