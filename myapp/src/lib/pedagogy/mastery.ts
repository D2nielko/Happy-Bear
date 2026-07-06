import {
	createEmptyCard,
	fsrs,
	generatorParameters,
	Rating,
	State,
	type Card,
	type Grade
} from 'ts-fsrs';
import type { ReviewOutcome, SkillMastery } from './types.js';

// FSRS wrapper (architecture.md §3, §6). Fuzz disabled so scheduling is
// deterministic and testable.
const engine = fsrs(generatorParameters({ enable_fuzz: false }));

const RATING: Record<ReviewOutcome, Grade> = {
	correct: Rating.Good,
	hesitant: Rating.Hard,
	incorrect: Rating.Again
};

export function newMastery(skillId: string, now: Date = new Date()): SkillMastery {
	return { skillId, card: createEmptyCard(now), pRecall: 0 };
}

export function reviewMastery(
	m: SkillMastery,
	outcome: ReviewOutcome,
	now: Date = new Date()
): SkillMastery {
	const { card } = engine.next(m.card, now, RATING[outcome]);
	return { skillId: m.skillId, card, pRecall: retrievability(card, now) };
}

export function retrievability(card: Card, now: Date = new Date()): number {
	if (card.state === State.New) return 0;
	return engine.get_retrievability(card, now, false);
}

// Coarse confidence bands the policy reasons over. With fewer than 3
// observations we never claim "high" — uncertainty keeps the policy in
// HINT/PROBE territory instead of EXPLAIN (architecture.md §3).
export type MasteryBand = 'unknown' | 'low' | 'uncertain' | 'high';

export function masteryBand(m: SkillMastery | undefined, now: Date = new Date()): MasteryBand {
	if (!m || m.card.state === State.New || m.card.reps === 0) return 'unknown';
	const p = retrievability(m.card, now);
	if (m.card.reps < 3) return p < 0.4 ? 'low' : 'uncertain';
	if (p >= 0.85) return 'high';
	if (p >= 0.4) return 'uncertain';
	return 'low';
}

export function isDueForReview(m: SkillMastery, now: Date = new Date()): boolean {
	return m.card.state === State.Review && m.card.due.getTime() <= now.getTime();
}
