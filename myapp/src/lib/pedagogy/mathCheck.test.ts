import { describe, expect, it } from 'vitest';
import { checkFractionAnswer } from './mathCheck.js';

describe('check_math fraction verifier', () => {
	it('accepts a correct simplified answer', () => {
		const r = checkFractionAnswer('1/2 + 1/3', '5/6');
		expect(r).toMatchObject({ valid: true, correct: true, expected: '5/6', misconception: null });
	});

	it('rejects a wrong answer with the expected value', () => {
		const r = checkFractionAnswer('1/2 + 1/3', '2/6');
		expect(r.correct).toBe(false);
		expect(r.expected).toBe('5/6');
	});

	it('flags adds-denominators (1/2 + 1/3 = 2/5)', () => {
		const r = checkFractionAnswer('1/2 + 1/3', '2/5');
		expect(r.correct).toBe(false);
		expect(r.misconception).toBe('adds-denominators');
	});

	it('flags ignores-common-denominator (1/2 + 1/3 = 2/2)', () => {
		const r = checkFractionAnswer('1/2 + 1/3', '2/2');
		expect(r.correct).toBe(false);
		expect(r.misconception).toBe('ignores-common-denominator');
	});

	it('flags incomplete simplification but scores the value correct', () => {
		const r = checkFractionAnswer('1/4 + 1/4', '2/4');
		expect(r.correct).toBe(true);
		expect(r.misconception).toBe('incomplete-simplification');
		expect(r.note).toMatch(/lowest terms/);
	});

	it('handles like denominators, subtraction, integers and mixed numbers', () => {
		expect(checkFractionAnswer('1/4 + 2/4', '3/4').correct).toBe(true);
		expect(checkFractionAnswer('3/4 - 1/4', '1/2').correct).toBe(true);
		expect(checkFractionAnswer('1/2 + 1/2', '1').correct).toBe(true);
		expect(checkFractionAnswer('3/2 + 0/2', '1 1/2').correct).toBe(true);
		expect(checkFractionAnswer('1/2 + 1/4', '0.75').correct).toBe(true);
	});

	it('exact arithmetic: no float smearing on awkward denominators', () => {
		expect(checkFractionAnswer('1/3 + 1/6', '1/2').correct).toBe(true);
		expect(checkFractionAnswer('1/10 + 2/10', '3/10').correct).toBe(true);
		expect(checkFractionAnswer('1/10 + 2/10', '0.3').correct).toBe(true);
	});

	it('equivalent-but-unsimplified equality is still equality', () => {
		const r = checkFractionAnswer('1/3 + 1/6', '3/6');
		expect(r.correct).toBe(true);
		expect(r.got).toBe('1/2'); // canonicalized
	});

	it('rejects garbage inputs without throwing', () => {
		expect(checkFractionAnswer('1/2 + banana', '1/2').valid).toBe(false);
		expect(checkFractionAnswer('1/2 + 1/3', 'banana').valid).toBe(false);
		expect(checkFractionAnswer('1/2 + 1/3', '1/0').valid).toBe(false);
	});

	it('no misconception guess when the naive value coincides with the truth', () => {
		// 0/2 + 0/3: adds-denominators naive = 0/5 = 0 = expected -> must not tag
		const r = checkFractionAnswer('0/2 + 0/3', '1/5');
		expect(r.misconception).toBeNull();
	});
});
