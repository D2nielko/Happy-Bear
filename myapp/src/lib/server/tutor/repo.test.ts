import { describe, expect, it, beforeEach } from 'vitest';
import { CARDS, NOW, mkMastery } from '$lib/pedagogy/fixtures.js';
import { newMastery, reviewMastery } from '$lib/pedagogy/mastery.js';
import { FRACTION_SKILLS } from '$lib/pedagogy/skills.js';
import { createTutorDb, type TutorDb } from './db.js';
import {
	createTutorSession,
	getOrCreateLearner,
	insertMisconception,
	insertQuizItem,
	insertTurn,
	listMastery,
	listOpenMisconceptions,
	listSessionsForParent,
	listTurns,
	upsertMastery
} from './repo.js';

let db: TutorDb;
beforeEach(() => {
	db = createTutorDb(':memory:');
});

describe('tutor persistence', () => {
	it('migrates and seeds fraction skills', () => {
		const rows = db.query.skills.findMany().sync();
		expect(rows.map((r) => r.id).sort()).toEqual(FRACTION_SKILLS.map((s) => s.id).sort());
	});

	it('mastery roundtrips the full FSRS card', () => {
		getOrCreateLearner(db, 'kid');
		let m = newMastery('frac.concept', NOW);
		m = reviewMastery(m, 'correct', NOW);
		m = reviewMastery(m, 'hesitant', new Date(NOW.getTime() + 86_400_000));
		upsertMastery(db, 'kid', m);

		const [back] = listMastery(db, 'kid');
		expect(back.card).toEqual(m.card);
		expect(back.pRecall).toBeCloseTo(m.pRecall, 10);

		// upsert overwrites, not duplicates
		m = reviewMastery(m, 'correct', new Date(NOW.getTime() + 2 * 86_400_000));
		upsertMastery(db, 'kid', m);
		expect(listMastery(db, 'kid')).toHaveLength(1);
	});

	it('misconceptions: open list excludes nothing yet resolved', () => {
		getOrCreateLearner(db, 'kid');
		insertMisconception(db, 'kid', {
			skillId: 'frac.add-like',
			tag: 'adds-denominators',
			evidence: 'said 1/2 + 1/3 = 2/5'
		});
		const open = listOpenMisconceptions(db, 'kid');
		expect(open).toHaveLength(1);
		expect(open[0].tag).toBe('adds-denominators');
		expect(open[0].resolvedAt).toBeNull();
	});

	it('sessions, turns and the parent listing with flag counts', () => {
		getOrCreateLearner(db, 'kid');
		createTutorSession(db, { id: 's1', learnerId: 'kid', mode: 'text' });
		insertTurn(db, { sessionId: 's1', role: 'learner', content: 'what is 1/2 + 1/3?' });
		insertTurn(db, {
			sessionId: 's1',
			role: 'tutor',
			content: 'What do the bottoms of the fractions need to match?',
			move: 'HINT',
			toolCalls: [{ name: 'check_math', input: {}, result: 'incorrect' }],
			flagged: true,
			flagReason: 'test-flag'
		});

		const turns = listTurns(db, 's1');
		expect(turns).toHaveLength(2);
		expect(turns[1].move).toBe('HINT');
		expect(JSON.parse(turns[1].toolCalls!)).toHaveLength(1);

		const sessions = listSessionsForParent(db);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].turnCount).toBe(2);
		expect(sessions[0].flaggedCount).toBe(1);
	});

	it('quiz items persist with distractors', () => {
		const id = insertQuizItem(db, {
			skillId: 'frac.compare',
			prompt: 'Which is bigger, 2/3 or 3/5?',
			answer: '2/3',
			distractors: ['3/5', 'they are equal']
		});
		expect(id).toBeGreaterThan(0);
	});

	it('fixture cards roundtrip too', () => {
		getOrCreateLearner(db, 'kid');
		upsertMastery(db, 'kid', mkMastery('frac.equiv', CARDS.high, 0.9));
		expect(listMastery(db, 'kid')[0].card.state).toBe(CARDS.high.state);
	});
});
