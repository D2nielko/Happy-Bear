// Seed knowledge components for the fractions domain (architecture.md §8 A4).
// Framework-free: plain data, importable from server and tests alike.

export interface SkillDef {
	id: string;
	domain: string;
	name: string;
	description: string;
}

export const FRACTION_SKILLS: SkillDef[] = [
	{
		id: 'frac.concept',
		domain: 'fractions',
		name: 'Fraction as part of a whole',
		description: 'Understand a/b as a parts out of b equal parts; numerator vs denominator.'
	},
	{
		id: 'frac.equiv',
		domain: 'fractions',
		name: 'Equivalent fractions',
		description: 'Recognize and generate equivalent fractions by scaling numerator and denominator.'
	},
	{
		id: 'frac.compare',
		domain: 'fractions',
		name: 'Comparing fractions',
		description: 'Order fractions using common denominators or benchmark fractions like 1/2.'
	},
	{
		id: 'frac.add-like',
		domain: 'fractions',
		name: 'Add/subtract like denominators',
		description: 'Add and subtract fractions that share a denominator; keep the denominator.'
	},
	{
		id: 'frac.add-unlike',
		domain: 'fractions',
		name: 'Add/subtract unlike denominators',
		description: 'Find a common denominator before adding or subtracting.'
	},
	{
		id: 'frac.simplify',
		domain: 'fractions',
		name: 'Simplifying fractions',
		description: 'Reduce a fraction to lowest terms using the greatest common factor.'
	}
];

// Misconception tags the tutor can log, keyed to where they typically surface.
export const KNOWN_MISCONCEPTIONS: Record<string, string> = {
	'adds-denominators': 'Adds denominators when adding fractions (1/2 + 1/3 = 2/5).',
	'bigger-denominator-bigger-fraction': 'Thinks a larger denominator means a larger fraction.',
	'treats-fraction-as-two-numbers':
		'Operates on numerator and denominator as unrelated whole numbers.',
	'ignores-common-denominator': 'Adds unlike fractions without converting to a common denominator.',
	'incomplete-simplification': 'Stops simplifying before lowest terms.',
	'whole-number-bias': 'Applies whole-number ordering rules to fractions.'
};
