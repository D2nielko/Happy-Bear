import { describe, expect, it } from 'vitest';
import { CARDS, NOW, mkMastery, mkSnapshot, mkTurn } from './fixtures.js';
import { MAX_HINTS, selectMove } from './policy.js';
import type { LearnerSnapshot, Move, TurnSummary } from './types.js';

const ACTIVE = 'frac.add-like';

function snapWithBand(band: keyof typeof CARDS, over: Partial<LearnerSnapshot> = {}) {
	return mkSnapshot({
		mastery: band === 'unknown' ? [] : [mkMastery(ACTIVE, CARDS[band])],
		activeSkillId: ACTIVE,
		...over
	});
}

// Transition table (architecture.md §3): [description, snapshot, lastTurn, expected move]
const TABLE: Array<[string, LearnerSnapshot, TurnSummary | null, Move]> = [
	['session start -> DIAGNOSE', snapWithBand('unknown'), null, 'DIAGNOSE'],
	[
		'misconception surfaced -> PROBE',
		snapWithBand('uncertain'),
		mkTurn({ misconceptionTag: 'adds-denominators', answeredCorrectly: false }),
		'PROBE'
	],
	[
		'wrong, 0 hints -> HINT',
		snapWithBand('uncertain'),
		mkTurn({ answeredCorrectly: false }),
		'HINT'
	],
	[
		'wrong, 1 hint -> HINT',
		snapWithBand('uncertain', { hintsThisProblem: 1 }),
		mkTurn({ answeredCorrectly: false }),
		'HINT'
	],
	[
		'wrong, hints exhausted -> EXPLAIN',
		snapWithBand('uncertain', { hintsThisProblem: MAX_HINTS }),
		mkTurn({ answeredCorrectly: false }),
		'EXPLAIN'
	],
	[
		'asked for answer, no scaffolding yet -> HINT',
		snapWithBand('uncertain'),
		mkTurn({ askedForAnswer: true }),
		'HINT'
	],
	[
		'asked for answer, hints spent but mastery uncertain -> still HINT',
		snapWithBand('uncertain', { hintsThisProblem: MAX_HINTS }),
		mkTurn({ askedForAnswer: true }),
		'HINT'
	],
	[
		'asked for answer, hints spent, mastery high -> EXPLAIN',
		snapWithBand('high', { hintsThisProblem: MAX_HINTS }),
		mkTurn({ askedForAnswer: true }),
		'EXPLAIN'
	],
	[
		'correct, mastery uncertain -> PRACTICE',
		snapWithBand('uncertain'),
		mkTurn({ answeredCorrectly: true }),
		'PRACTICE'
	],
	[
		'correct, mastery low -> PRACTICE',
		snapWithBand('low'),
		mkTurn({ answeredCorrectly: true }),
		'PRACTICE'
	],
	[
		'correct, mastery high, another skill due -> REVIEW',
		mkSnapshot({
			activeSkillId: ACTIVE,
			mastery: [mkMastery(ACTIVE, CARDS.high), mkMastery('frac.equiv', CARDS.highDue)]
		}),
		mkTurn({ answeredCorrectly: true }),
		'REVIEW'
	],
	[
		'correct, mastery high, nothing due -> PRACTICE next skill',
		mkSnapshot({
			activeSkillId: ACTIVE,
			mastery: [mkMastery(ACTIVE, CARDS.high), mkMastery('frac.equiv', CARDS.low)]
		}),
		mkTurn({ answeredCorrectly: true }),
		'PRACTICE'
	],
	['no answer, band unknown -> DIAGNOSE', snapWithBand('unknown'), mkTurn(), 'DIAGNOSE'],
	['no answer, band uncertain -> PROBE', snapWithBand('uncertain'), mkTurn(), 'PROBE'],
	['no answer, band low -> PROBE', snapWithBand('low'), mkTurn(), 'PROBE'],
	[
		'no answer, band high w/ due skill -> REVIEW',
		mkSnapshot({
			activeSkillId: ACTIVE,
			mastery: [mkMastery(ACTIVE, CARDS.high), mkMastery('frac.simplify', CARDS.highDue)]
		}),
		mkTurn(),
		'REVIEW'
	]
];

describe('dialogue policy transition table', () => {
	it.each(TABLE)('%s', (_desc, snapshot, last, expected) => {
		expect(selectMove(snapshot, last, NOW).move).toBe(expected);
	});

	it('REVIEW targets the due skill, PRACTICE-advance targets the weakest', () => {
		const s = mkSnapshot({
			activeSkillId: ACTIVE,
			mastery: [mkMastery(ACTIVE, CARDS.high), mkMastery('frac.equiv', CARDS.highDue)]
		});
		expect(selectMove(s, mkTurn({ answeredCorrectly: true }), NOW).targetSkillId).toBe(
			'frac.equiv'
		);

		const s2 = mkSnapshot({
			activeSkillId: ACTIVE,
			mastery: [
				mkMastery(ACTIVE, CARDS.high),
				mkMastery('frac.equiv', CARDS.uncertain),
				mkMastery('frac.compare', CARDS.low)
			]
		});
		expect(selectMove(s2, mkTurn({ answeredCorrectly: true }), NOW).targetSkillId).toBe(
			'frac.compare'
		);
	});

	// The no-answer-dumping invariant: EXPLAIN is unreachable until MAX_HINTS
	// hints are spent, across every band / turn-shape combination.
	it('EXPLAIN never fires before hints are exhausted', () => {
		const bands = ['unknown', 'uncertain', 'low', 'high'] as const;
		const turns = [
			null,
			mkTurn(),
			mkTurn({ answeredCorrectly: false }),
			mkTurn({ answeredCorrectly: true }),
			mkTurn({ askedForAnswer: true }),
			mkTurn({ misconceptionTag: 'adds-denominators' })
		];
		for (const band of bands) {
			for (const hints of [0, 1]) {
				for (const last of turns) {
					const d = selectMove(snapWithBand(band, { hintsThisProblem: hints }), last, NOW);
					expect(d.move, `band=${band} hints=${hints} last=${JSON.stringify(last)}`).not.toBe(
						'EXPLAIN'
					);
				}
			}
		}
	});
});
