// Test fixtures for pedagogy suites. Framework-free like the rest of the dir.
import { State, type Card } from 'ts-fsrs';
import type { LearnerSnapshot, SkillMastery, TurnSummary } from './types.js';

export const NOW = new Date('2026-07-04T12:00:00Z');
const DAY = 86_400_000;

function card(partial: Partial<Card>): Card {
	return {
		due: NOW,
		stability: 0,
		difficulty: 5,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: 0,
		reps: 0,
		lapses: 0,
		state: State.New,
		last_review: undefined,
		...partial
	};
}

// Cards engineered to land in each mastery band at NOW (see masteryBand()).
export const CARDS = {
	unknown: card({}),
	// reps < 3 and recently seen: retrievability high but evidence thin -> uncertain
	uncertain: card({
		state: State.Learning,
		reps: 1,
		stability: 1,
		last_review: new Date(NOW.getTime() - 10 * 60_000),
		due: new Date(NOW.getTime() + DAY)
	}),
	// seen often but long ago with weak stability -> low
	low: card({
		state: State.Review,
		reps: 4,
		stability: 0.5,
		last_review: new Date(NOW.getTime() - 365 * DAY),
		due: new Date(NOW.getTime() - 355 * DAY)
	}),
	// strong stability, recently reviewed, not yet due -> high
	high: card({
		state: State.Review,
		reps: 5,
		stability: 100,
		last_review: new Date(NOW.getTime() - 2 * DAY),
		due: new Date(NOW.getTime() + 60 * DAY)
	}),
	// strong stability but past due -> high band AND due for review
	highDue: card({
		state: State.Review,
		reps: 5,
		stability: 100,
		last_review: new Date(NOW.getTime() - 10 * DAY),
		due: new Date(NOW.getTime() - 60 * 60_000)
	})
} as const;

export function mkMastery(skillId: string, c: Card, pRecall = 0.5): SkillMastery {
	return { skillId, card: c, pRecall };
}

export function mkSnapshot(over: Partial<LearnerSnapshot> = {}): LearnerSnapshot {
	return {
		learnerId: 'l1',
		mastery: [],
		misconceptions: [],
		activeSkillId: 'frac.add-like',
		hintsThisProblem: 0,
		...over
	};
}

export function mkTurn(over: Partial<TurnSummary> = {}): TurnSummary {
	return {
		role: 'learner',
		move: null,
		answeredCorrectly: null,
		misconceptionTag: null,
		askedForAnswer: false,
		...over
	};
}
