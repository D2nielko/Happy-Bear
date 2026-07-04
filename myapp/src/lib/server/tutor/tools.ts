import { checkFractionAnswer } from '$lib/pedagogy/mathCheck.js';
import { masteryBand, newMastery, reviewMastery } from '$lib/pedagogy/mastery.js';
import { FRACTION_SKILLS, KNOWN_MISCONCEPTIONS } from '$lib/pedagogy/skills.js';
import type { ReviewOutcome } from '$lib/pedagogy/types.js';
import type { TutorDb } from './db.js';
import { insertMisconception, insertQuizItem, listMastery, upsertMastery } from './repo.js';

// Tool executors the LLM can call mid-turn (architecture.md §3). Each returns
// a JSON string fed back as the tool_result block.

export interface ToolContext {
	db: TutorDb;
	learnerId: string;
	activeSkillId: string | null;
	now: Date;
}

export interface ToolExecutor {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute(input: Record<string, unknown>, ctx: ToolContext): Promise<{ result: string }>;
}

const SKILL_IDS = FRACTION_SKILLS.map((s) => s.id);

function str(input: Record<string, unknown>, key: string): string {
	const v = input[key];
	if (typeof v !== 'string' || v.length === 0) throw new Error(`missing string field '${key}'`);
	return v;
}

export const checkMathTool: ToolExecutor = {
	name: 'check_math',
	description:
		'Verify a student answer to a fraction arithmetic problem with exact math. ' +
		'Always call this before judging an answer right or wrong. Returns correctness, ' +
		'the canonical expected value, and any recognized misconception pattern.',
	inputSchema: {
		type: 'object',
		properties: {
			expression: { type: 'string', description: "the problem, e.g. '1/2 + 1/3'" },
			student_answer: { type: 'string', description: "the student's answer, e.g. '2/5'" }
		},
		required: ['expression', 'student_answer']
	},
	async execute(input) {
		const r = checkFractionAnswer(str(input, 'expression'), str(input, 'student_answer'));
		return { result: JSON.stringify(r) };
	}
};

export const makeQuizItemTool: ToolExecutor = {
	name: 'make_quiz_item',
	description:
		'Save a practice question you composed so it can be reused. Call when you pose a new problem.',
	inputSchema: {
		type: 'object',
		properties: {
			skill_id: { type: 'string', enum: SKILL_IDS },
			prompt: { type: 'string' },
			answer: { type: 'string' },
			distractors: { type: 'array', items: { type: 'string' } }
		},
		required: ['skill_id', 'prompt', 'answer']
	},
	async execute(input, ctx) {
		const skillId = str(input, 'skill_id');
		if (!SKILL_IDS.includes(skillId)) throw new Error(`unknown skill_id '${skillId}'`);
		const id = insertQuizItem(ctx.db, {
			skillId,
			prompt: str(input, 'prompt'),
			answer: str(input, 'answer'),
			distractors: Array.isArray(input.distractors)
				? input.distractors.filter((d): d is string => typeof d === 'string')
				: undefined
		});
		return { result: JSON.stringify({ quiz_item_id: id }) };
	}
};

export const logMisconceptionTool: ToolExecutor = {
	name: 'log_misconception',
	description:
		'Record evidence that the student holds a specific misconception. ' +
		`Known tags: ${Object.keys(KNOWN_MISCONCEPTIONS).join(', ')}. ` +
		'Use a short kebab-case tag for anything new.',
	inputSchema: {
		type: 'object',
		properties: {
			skill_id: { type: 'string', enum: SKILL_IDS },
			tag: { type: 'string' },
			evidence: { type: 'string', description: 'quote or paraphrase of what the student said' }
		},
		required: ['tag', 'evidence']
	},
	async execute(input, ctx) {
		const tag = str(input, 'tag');
		const skillId = typeof input.skill_id === 'string' ? input.skill_id : ctx.activeSkillId;
		insertMisconception(ctx.db, ctx.learnerId, {
			skillId: skillId && SKILL_IDS.includes(skillId) ? skillId : null,
			tag,
			evidence: str(input, 'evidence')
		});
		return {
			result: JSON.stringify({ logged: tag, known: tag in KNOWN_MISCONCEPTIONS })
		};
	}
};

export const updateMasteryTool: ToolExecutor = {
	name: 'update_mastery',
	description:
		'Record the outcome of the student attempting a problem on a skill. ' +
		"Call after every judged attempt: outcome 'correct', 'incorrect', or 'hesitant' " +
		'(right answer but slow/unsure).',
	inputSchema: {
		type: 'object',
		properties: {
			skill_id: { type: 'string', enum: SKILL_IDS },
			outcome: { type: 'string', enum: ['correct', 'incorrect', 'hesitant'] }
		},
		required: ['skill_id', 'outcome']
	},
	async execute(input, ctx) {
		const skillId = str(input, 'skill_id');
		if (!SKILL_IDS.includes(skillId)) throw new Error(`unknown skill_id '${skillId}'`);
		const outcome = str(input, 'outcome') as ReviewOutcome;
		if (!['correct', 'incorrect', 'hesitant'].includes(outcome)) {
			throw new Error(`invalid outcome '${outcome}'`);
		}
		const existing =
			listMastery(ctx.db, ctx.learnerId).find((m) => m.skillId === skillId) ??
			newMastery(skillId, ctx.now);
		const updated = reviewMastery(existing, outcome, ctx.now);
		upsertMastery(ctx.db, ctx.learnerId, updated);
		return {
			result: JSON.stringify({
				skill_id: skillId,
				p_recall: Number(updated.pRecall.toFixed(3)),
				band: masteryBand(updated, ctx.now),
				reps: updated.card.reps,
				lapses: updated.card.lapses
			})
		};
	}
};

export const ALL_TOOLS: ToolExecutor[] = [
	checkMathTool,
	makeQuizItemTool,
	logMisconceptionTool,
	updateMasteryTool
];

export async function executeTool(
	name: string,
	input: Record<string, unknown>,
	ctx: ToolContext
): Promise<{ result: string; isError: boolean }> {
	const tool = ALL_TOOLS.find((t) => t.name === name);
	if (!tool) return { result: `unknown tool '${name}'`, isError: true };
	try {
		const { result } = await tool.execute(input, ctx);
		return { result, isError: false };
	} catch (e) {
		return { result: e instanceof Error ? e.message : 'tool failed', isError: true };
	}
}
