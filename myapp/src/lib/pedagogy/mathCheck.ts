import { create, all, type Fraction, type MathJsInstance } from 'mathjs';

// Exact fraction verifier behind the check_math tool (architecture.md §3).
// Framework-free; mathjs configured so every literal is a Fraction — no
// floating point anywhere in the comparison.
const math: MathJsInstance = create(all, { number: 'Fraction' });

export interface MathCheckResult {
	valid: boolean; // inputs parseable
	correct: boolean | null;
	expected: string | null; // canonical lowest-terms value of the expression
	got: string | null; // canonical value of the student answer
	misconception: string | null; // known-misconception tag if the error matches one
	note: string | null; // e.g. right value but not in lowest terms
}

const invalid = (note: string): MathCheckResult => ({
	valid: false,
	correct: null,
	expected: null,
	got: null,
	misconception: null,
	note
});

export function checkFractionAnswer(expression: string, studentAnswer: string): MathCheckResult {
	let expected: Fraction;
	try {
		expected = toFraction(math.evaluate(expression));
	} catch {
		return invalid(`could not evaluate expression '${expression}'`);
	}

	const parsed = parseAnswer(studentAnswer);
	if (!parsed) {
		return invalid(`could not parse student answer '${studentAnswer}'`);
	}

	const correct = parsed.value.equals(expected);
	let note: string | null = null;
	if (correct && !parsed.lowestTerms) {
		note = 'right value but not in lowest terms';
	}

	return {
		valid: true,
		correct,
		expected: format(expected),
		got: format(parsed.value),
		misconception: correct
			? parsed.lowestTerms
				? null
				: 'incomplete-simplification'
			: detectMisconception(expression, parsed.value, expected),
		note
	};
}

function toFraction(v: unknown): Fraction {
	// evaluate() returns a Fraction under our config for rational arithmetic;
	// anything else (matrix, complex, undefined) is out of scope.
	if (math.isFraction(v)) return v;
	if (typeof v === 'number' || math.isBigNumber(v)) return math.fraction(v as number);
	throw new Error('not a rational result');
}

function format(f: Fraction): string {
	const n = Number(f.n) * (f.s < 0 ? -1 : 1);
	const d = Number(f.d);
	return d === 1 ? `${n}` : `${n}/${d}`;
}

function parseAnswer(raw: string): { value: Fraction; lowestTerms: boolean } | null {
	const s = raw.trim();
	// mixed number: "1 1/2"
	const mixed = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
	if (mixed) {
		const whole = math.fraction(Number(mixed[1]), 1);
		const part = math.fraction(Number(mixed[2]), Number(mixed[3]));
		if (Number(mixed[3]) === 0) return null;
		const value = toFraction(math.add(whole, Number(mixed[1]) < 0 ? math.unaryMinus(part) : part));
		return { value, lowestTerms: gcd(Number(mixed[2]), Number(mixed[3])) === 1 };
	}
	const frac = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
	if (frac) {
		const n = Number(frac[1]);
		const d = Number(frac[2]);
		if (d === 0) return null;
		return { value: math.fraction(n, d), lowestTerms: gcd(Math.abs(n), d) === 1 };
	}
	const int = s.match(/^-?\d+$/);
	if (int) return { value: math.fraction(Number(s), 1), lowestTerms: true };
	const dec = s.match(/^-?\d*\.\d+$/);
	if (dec) return { value: math.fraction(s), lowestTerms: true };
	return null;
}

// If the wrong answer matches a classic error pattern for "a/b op c/d",
// name it so the tutor can log and probe it.
function detectMisconception(expression: string, got: Fraction, expected: Fraction): string | null {
	const m = expression.trim().match(/^(-?\d+)\s*\/\s*(\d+)\s*([+-])\s*(-?\d+)\s*\/\s*(\d+)$/);
	if (!m) return null;
	const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[4]), Number(m[5])];
	const op = m[3];
	if (b === 0 || d === 0) return null;

	const candidates: Array<[string, () => Fraction | null]> = [
		[
			'adds-denominators',
			() => {
				const den = op === '+' ? b + d : b - d;
				const num = op === '+' ? a + c : a - c;
				return den > 0 ? math.fraction(num, den) : null;
			}
		],
		[
			'ignores-common-denominator',
			() => (b !== d ? math.fraction(op === '+' ? a + c : a - c, b) : null)
		]
	];
	for (const [tag, make] of candidates) {
		try {
			const naive = make();
			if (naive && !naive.equals(expected) && got.equals(naive)) return tag;
		} catch {
			// unrepresentable candidate (e.g. zero denominator): skip
		}
	}
	return null;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}
