import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { CARDS, NOW, mkMastery } from './fixtures.js';
import {
	isDueForReview,
	masteryBand,
	newMastery,
	retrievability,
	reviewMastery
} from './mastery.js';

describe('FSRS mastery wrapper', () => {
	it('new mastery starts unlearned', () => {
		const m = newMastery('frac.concept', NOW);
		expect(m.card.state).toBe(State.New);
		expect(m.pRecall).toBe(0);
		expect(masteryBand(m, NOW)).toBe('unknown');
	});

	it('correct reviews increase stability and schedule further out', () => {
		let m = newMastery('frac.concept', NOW);
		const s0 = m.card.stability;
		m = reviewMastery(m, 'correct', NOW);
		const s1 = m.card.stability;
		const day2 = new Date(NOW.getTime() + 86_400_000);
		m = reviewMastery(m, 'correct', day2);
		expect(s1).toBeGreaterThan(s0);
		expect(m.card.stability).toBeGreaterThan(s1);
		expect(m.card.due.getTime()).toBeGreaterThan(day2.getTime());
		expect(m.card.reps).toBe(2);
	});

	it('incorrect answer on a learned card records a lapse and relearns', () => {
		let m = mkMastery('frac.equiv', CARDS.high);
		m = reviewMastery(m, 'incorrect', NOW);
		expect(m.card.lapses).toBe(1);
		expect(m.card.state).toBe(State.Relearning);
		expect(m.card.stability).toBeLessThan(CARDS.high.stability);
	});

	it('is deterministic (fuzz disabled)', () => {
		const a = reviewMastery(newMastery('s', NOW), 'correct', NOW);
		const b = reviewMastery(newMastery('s', NOW), 'correct', NOW);
		expect(a.card.due.getTime()).toBe(b.card.due.getTime());
		expect(a.card.stability).toBe(b.card.stability);
	});

	it('retrievability stays in [0,1] and decays with time', () => {
		const fresh = retrievability(CARDS.high, NOW);
		const later = retrievability(CARDS.high, new Date(NOW.getTime() + 300 * 86_400_000));
		expect(fresh).toBeGreaterThan(later);
		for (const p of [fresh, later]) {
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThanOrEqual(1);
		}
	});

	it('bands: engineered cards land where the policy expects', () => {
		expect(masteryBand(mkMastery('s', CARDS.unknown), NOW)).toBe('unknown');
		expect(masteryBand(mkMastery('s', CARDS.uncertain), NOW)).toBe('uncertain');
		expect(masteryBand(mkMastery('s', CARDS.low), NOW)).toBe('low');
		expect(masteryBand(mkMastery('s', CARDS.high), NOW)).toBe('high');
		expect(masteryBand(undefined, NOW)).toBe('unknown');
	});

	it('never reports high mastery with fewer than 3 reps', () => {
		// even a just-reviewed card (retrievability ~1) stays 'uncertain' at reps<3
		let m = newMastery('s', NOW);
		m = reviewMastery(m, 'correct', NOW);
		expect(retrievability(m.card, NOW)).toBeGreaterThan(0.85);
		expect(masteryBand(m, NOW)).toBe('uncertain');
	});

	it('due detection', () => {
		expect(isDueForReview(mkMastery('s', CARDS.highDue), NOW)).toBe(true);
		expect(isDueForReview(mkMastery('s', CARDS.high), NOW)).toBe(false);
		expect(isDueForReview(mkMastery('s', CARDS.unknown), NOW)).toBe(false);
	});
});
