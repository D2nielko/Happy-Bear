// Framework-free pedagogy types (architecture.md §3). No Svelte/SvelteKit/env
// imports anywhere under src/lib/pedagogy — enforced by framework-free.test.ts.

import type { Card } from 'ts-fsrs';

export type Move = 'DIAGNOSE' | 'HINT' | 'PROBE' | 'EXPLAIN' | 'PRACTICE' | 'REVIEW';

export type ReviewOutcome = 'correct' | 'incorrect' | 'hesitant';

export interface SkillMastery {
	skillId: string;
	card: Card; // full ts-fsrs card; persisted field-by-field in the mastery table
	pRecall: number; // retrievability at last update, 0..1
}

export interface Misconception {
	id?: number;
	skillId: string | null;
	tag: string;
	evidence: string;
	resolvedAt: string | null;
}

export interface LearnerSnapshot {
	learnerId: string;
	mastery: SkillMastery[];
	misconceptions: Misconception[]; // unresolved only
	activeSkillId: string | null;
	hintsThisProblem: number;
}

export interface TurnSummary {
	role: 'learner' | 'tutor';
	move: Move | null; // tutor's move on its last turn, if any
	answeredCorrectly: boolean | null; // null = the turn contained no checkable answer
	misconceptionTag: string | null;
	askedForAnswer: boolean;
}

export interface PolicyDecision {
	move: Move;
	reason: string;
	targetSkillId: string | null;
}
