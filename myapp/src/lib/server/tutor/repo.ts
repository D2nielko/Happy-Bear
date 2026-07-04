import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { State, type Card } from 'ts-fsrs';
import type { Misconception, SkillMastery } from '$lib/pedagogy/types.js';
import type { TutorDb } from './db.js';
import { learners, mastery, misconceptions, quizItems, turns, tutorSessions } from './schema.js';

// Persistence adapters between the framework-free pedagogy types and the
// Drizzle rows (architecture.md §4). All functions take the db explicitly so
// tests can pass an in-memory instance.

const STATE_TO_ROW: Record<State, 'new' | 'learning' | 'review' | 'relearning'> = {
	[State.New]: 'new',
	[State.Learning]: 'learning',
	[State.Review]: 'review',
	[State.Relearning]: 'relearning'
};
const ROW_TO_STATE = {
	new: State.New,
	learning: State.Learning,
	review: State.Review,
	relearning: State.Relearning
} as const;

export function getOrCreateLearner(db: TutorDb, id: string, displayName?: string) {
	db.insert(learners).values({ id, displayName }).onConflictDoNothing().run();
	return db.select().from(learners).where(eq(learners.id, id)).get()!;
}

export function listMastery(db: TutorDb, learnerId: string): SkillMastery[] {
	return db
		.select()
		.from(mastery)
		.where(eq(mastery.learnerId, learnerId))
		.all()
		.map((r) => {
			const card: Card = {
				due: new Date(r.due),
				stability: r.stability,
				difficulty: r.difficulty,
				elapsed_days: r.elapsedDays,
				scheduled_days: r.scheduledDays,
				learning_steps: r.learningSteps,
				reps: r.reps,
				lapses: r.lapses,
				state: ROW_TO_STATE[r.state],
				last_review: r.lastReview ? new Date(r.lastReview) : undefined
			};
			return { skillId: r.skillId, card, pRecall: r.pRecall };
		});
}

export function upsertMastery(db: TutorDb, learnerId: string, m: SkillMastery): void {
	const row = {
		learnerId,
		skillId: m.skillId,
		stability: m.card.stability,
		difficulty: m.card.difficulty,
		due: m.card.due.toISOString(),
		state: STATE_TO_ROW[m.card.state],
		reps: m.card.reps,
		lapses: m.card.lapses,
		elapsedDays: m.card.elapsed_days,
		scheduledDays: m.card.scheduled_days,
		learningSteps: m.card.learning_steps,
		pRecall: m.pRecall,
		lastReview: m.card.last_review?.toISOString() ?? null
	};
	db.insert(mastery)
		.values(row)
		.onConflictDoUpdate({ target: [mastery.learnerId, mastery.skillId], set: row })
		.run();
}

export function insertMisconception(
	db: TutorDb,
	learnerId: string,
	m: { skillId: string | null; tag: string; evidence: string; turnId?: number }
): void {
	db.insert(misconceptions)
		.values({ learnerId, skillId: m.skillId, tag: m.tag, evidence: m.evidence, turnId: m.turnId })
		.run();
}

export function listOpenMisconceptions(db: TutorDb, learnerId: string): Misconception[] {
	return db
		.select()
		.from(misconceptions)
		.where(and(eq(misconceptions.learnerId, learnerId), isNull(misconceptions.resolvedAt)))
		.all()
		.map((r) => ({
			id: r.id,
			skillId: r.skillId,
			tag: r.tag,
			evidence: r.evidence,
			resolvedAt: r.resolvedAt
		}));
}

export function createTutorSession(
	db: TutorDb,
	s: { id: string; learnerId: string; mode: 'text' | 'voice' }
) {
	db.insert(tutorSessions).values(s).run();
	return db.select().from(tutorSessions).where(eq(tutorSessions.id, s.id)).get()!;
}

export function getTutorSession(db: TutorDb, id: string) {
	return db.select().from(tutorSessions).where(eq(tutorSessions.id, id)).get();
}

export function insertTurn(
	db: TutorDb,
	t: {
		sessionId: string;
		role: 'learner' | 'tutor';
		content: string;
		move?: string;
		toolCalls?: unknown[];
		flagged?: boolean;
		flagReason?: string;
	}
): number {
	const res = db
		.insert(turns)
		.values({
			sessionId: t.sessionId,
			role: t.role,
			content: t.content,
			move: t.move,
			toolCalls: t.toolCalls?.length ? JSON.stringify(t.toolCalls) : null,
			flagged: t.flagged ? 1 : 0,
			flagReason: t.flagReason
		})
		.run();
	return Number(res.lastInsertRowid);
}

export function listTurns(db: TutorDb, sessionId: string) {
	return db.select().from(turns).where(eq(turns.sessionId, sessionId)).orderBy(turns.id).all();
}

// Parent view: every session with turn/flag counts, newest first.
export function listSessionsForParent(db: TutorDb) {
	return db
		.select({
			id: tutorSessions.id,
			learnerId: tutorSessions.learnerId,
			mode: tutorSessions.mode,
			startedAt: tutorSessions.startedAt,
			turnCount: sql<number>`count(${turns.id})`,
			flaggedCount: sql<number>`coalesce(sum(${turns.flagged}), 0)`
		})
		.from(tutorSessions)
		.leftJoin(turns, eq(turns.sessionId, tutorSessions.id))
		.groupBy(tutorSessions.id)
		.orderBy(desc(tutorSessions.startedAt))
		.all();
}

export function insertQuizItem(
	db: TutorDb,
	q: { skillId: string; prompt: string; answer: string; distractors?: string[]; source?: string }
): number {
	const res = db
		.insert(quizItems)
		.values({
			skillId: q.skillId,
			prompt: q.prompt,
			answer: q.answer,
			distractors: q.distractors ? JSON.stringify(q.distractors) : null,
			source: q.source ?? 'llm'
		})
		.run();
	return Number(res.lastInsertRowid);
}
