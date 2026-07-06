import { beforeEach, describe, expect, it } from 'vitest';
import { NOW } from '$lib/pedagogy/fixtures.js';
import { createTutorDb, type TutorDb } from './db.js';
import { getOrCreateLearner, listMastery, listOpenMisconceptions } from './repo.js';
import { executeTool, type ToolContext } from './tools.js';

let db: TutorDb;
let ctx: ToolContext;

beforeEach(() => {
	db = createTutorDb(':memory:');
	getOrCreateLearner(db, 'kid');
	ctx = { db, learnerId: 'kid', activeSkillId: 'frac.add-unlike', now: NOW };
});

describe('tool executors', () => {
	it('check_math verifies and reports misconceptions', async () => {
		const r = await executeTool(
			'check_math',
			{ expression: '1/2 + 1/3', student_answer: '2/5' },
			ctx
		);
		expect(r.isError).toBe(false);
		const parsed = JSON.parse(r.result);
		expect(parsed.correct).toBe(false);
		expect(parsed.misconception).toBe('adds-denominators');
	});

	it('make_quiz_item persists and rejects unknown skills', async () => {
		const ok = await executeTool(
			'make_quiz_item',
			{ skill_id: 'frac.compare', prompt: '2/3 vs 3/5?', answer: '2/3', distractors: ['3/5'] },
			ctx
		);
		expect(ok.isError).toBe(false);
		expect(JSON.parse(ok.result).quiz_item_id).toBeGreaterThan(0);

		const bad = await executeTool(
			'make_quiz_item',
			{ skill_id: 'nope', prompt: 'x', answer: 'y' },
			ctx
		);
		expect(bad.isError).toBe(true);
	});

	it('log_misconception stores evidence, defaulting skill to the active one', async () => {
		const r = await executeTool(
			'log_misconception',
			{ tag: 'adds-denominators', evidence: 'said 1/2+1/3=2/5' },
			ctx
		);
		expect(r.isError).toBe(false);
		expect(JSON.parse(r.result).known).toBe(true);
		const open = listOpenMisconceptions(db, 'kid');
		expect(open).toHaveLength(1);
		expect(open[0].skillId).toBe('frac.add-unlike');
	});

	it('update_mastery creates then advances a mastery row', async () => {
		const r1 = await executeTool(
			'update_mastery',
			{ skill_id: 'frac.add-like', outcome: 'correct' },
			ctx
		);
		expect(r1.isError).toBe(false);
		expect(JSON.parse(r1.result).reps).toBe(1);

		const r2 = await executeTool(
			'update_mastery',
			{ skill_id: 'frac.add-like', outcome: 'incorrect' },
			ctx
		);
		const parsed = JSON.parse(r2.result);
		expect(parsed.reps).toBe(2);
		expect(parsed.lapses).toBeGreaterThanOrEqual(0);
		expect(listMastery(db, 'kid')).toHaveLength(1);
	});

	it('unknown tool and invalid input surface as tool errors, not throws', async () => {
		expect((await executeTool('nope', {}, ctx)).isError).toBe(true);
		expect((await executeTool('update_mastery', { skill_id: 'frac.add-like' }, ctx)).isError).toBe(
			true
		);
		expect(
			(await executeTool('update_mastery', { skill_id: 'frac.add-like', outcome: 'meh' }, ctx))
				.isError
		).toBe(true);
	});
});
