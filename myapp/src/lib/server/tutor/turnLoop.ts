import type Anthropic from '@anthropic-ai/sdk';
import { checkFractionAnswer } from '$lib/pedagogy/mathCheck.js';
import { selectMove } from '$lib/pedagogy/policy.js';
import type { LearnerSnapshot, Move, TurnSummary } from '$lib/pedagogy/types.js';
import type { TutorDb } from './db.js';
import { toAnthropicTools, type LlmClient } from './llm.js';
import { buildSystemPrompt } from './prompt.js';
import {
	getTutorSession,
	insertTurn,
	listMastery,
	listOpenMisconceptions,
	listTurns
} from './repo.js';
import type { OutputCheck } from './safety.js';
import { ALL_TOOLS, executeTool, type ToolContext } from './tools.js';

// Server-side turn loop (architecture.md §2 data flows): persist input →
// policy picks the move → move-constrained streaming LLM call with tools →
// safety-checked deltas out → persist the tutor turn.

export interface TurnLoopDeps {
	db: TutorDb;
	llm: LlmClient;
	outputCheck: OutputCheck;
	persona: string;
	now?: () => Date;
}

export type TurnEvent =
	| { type: 'move'; move: Move; reason: string }
	| { type: 'text'; delta: string }
	| { type: 'tool'; name: string }
	| { type: 'done'; turnId: number; flagged: boolean };

interface StoredToolCall {
	name: string;
	input: Record<string, unknown>;
	result: string;
}

const MAX_TOOL_ROUNDS = 4;
const HISTORY_TURNS = 20;

export async function* runTurn(
	deps: TurnLoopDeps,
	input: { sessionId: string; learnerText: string }
): AsyncGenerator<TurnEvent> {
	const now = deps.now?.() ?? new Date();
	const session = getTutorSession(deps.db, input.sessionId);
	if (!session) throw new Error(`unknown tutor session '${input.sessionId}'`);

	const history = listTurns(deps.db, input.sessionId);
	insertTurn(deps.db, { sessionId: input.sessionId, role: 'learner', content: input.learnerText });

	// --- policy input, derived from persisted state only (Decision Log D3) ---
	const openProblem = findOpenProblem(history);
	const masteryRows = listMastery(deps.db, session.learnerId);
	const openMisconceptions = listOpenMisconceptions(deps.db, session.learnerId);
	// Active skill: the open problem's skill; between problems, fall back to
	// the skill under discussion (latest misconception, or the sole tracked
	// skill) so the policy doesn't reset to DIAGNOSE mid-conversation.
	const activeSkillId =
		openProblem?.skillId ??
		openMisconceptions.at(-1)?.skillId ??
		(masteryRows.length === 1 ? masteryRows[0].skillId : null);
	const snapshot: LearnerSnapshot = {
		learnerId: session.learnerId,
		mastery: masteryRows,
		misconceptions: openMisconceptions,
		activeSkillId,
		hintsThisProblem: countHintsSinceProblem(history)
	};
	const lastTurn = summarizeLastExchange(history, input.learnerText, openProblem);
	const decision = selectMove(snapshot, lastTurn, now);
	yield { type: 'move', move: decision.move, reason: decision.reason };

	const system = buildSystemPrompt(
		deps.persona,
		decision,
		snapshot,
		openProblem ? { prompt: openProblem.prompt, answer: openProblem.answer } : null
	);
	const messages: Anthropic.MessageParam[] = [
		...history.slice(-HISTORY_TURNS).map(
			(t): Anthropic.MessageParam => ({
				role: t.role === 'learner' ? 'user' : 'assistant',
				content: t.content
			})
		),
		{ role: 'user', content: input.learnerText }
	];

	// --- streaming rounds with mid-stream tool execution ---
	const toolCtx: ToolContext = {
		db: deps.db,
		learnerId: session.learnerId,
		activeSkillId: decision.targetSkillId ?? snapshot.activeSkillId,
		now
	};
	const tools = toAnthropicTools(ALL_TOOLS);
	const toolRecords: StoredToolCall[] = [];
	const emitter = new SentenceEmitter(deps.outputCheck);

	let blocked: string | null = null;
	rounds: for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		let roundText = '';
		const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
		let stopReason: string | null = null;

		for await (const ev of deps.llm.streamTurn({ system, messages, tools })) {
			if (ev.type === 'text') {
				roundText += ev.delta;
				for (const out of emitter.push(ev.delta)) {
					if (out.blocked) {
						blocked = out.reason;
						yield { type: 'text', delta: out.text };
						break rounds;
					}
					yield { type: 'text', delta: out.text };
				}
			} else if (ev.type === 'tool_use') {
				toolUses.push(ev);
			} else {
				stopReason = ev.stopReason;
			}
		}

		if (stopReason !== 'tool_use' || toolUses.length === 0) break;

		const assistantContent: Anthropic.ContentBlockParam[] = [
			...(roundText ? [{ type: 'text' as const, text: roundText }] : []),
			...toolUses.map((t) => ({
				type: 'tool_use' as const,
				id: t.id,
				name: t.name,
				input: t.input
			}))
		];
		const results: Anthropic.ToolResultBlockParam[] = [];
		for (const t of toolUses) {
			yield { type: 'tool', name: t.name };
			const { result, isError } = await executeTool(t.name, t.input, toolCtx);
			toolRecords.push({ name: t.name, input: t.input, result });
			results.push({ type: 'tool_result', tool_use_id: t.id, content: result, is_error: isError });
		}
		messages.push({ role: 'assistant', content: assistantContent });
		messages.push({ role: 'user', content: results });
	}

	if (!blocked) {
		for (const out of emitter.flush()) {
			if (out.blocked) {
				blocked = out.reason;
			}
			yield { type: 'text', delta: out.text };
		}
	}

	// --- persist the tutor turn with safety verdicts ---
	const finalText = emitter.emittedText;
	const post = deps.outputCheck.checkTurn(finalText);
	const flagReason = blocked
		? `blocked mid-stream: ${blocked}`
		: post.action === 'flag'
			? post.reason
			: undefined;
	const turnId = insertTurn(deps.db, {
		sessionId: input.sessionId,
		role: 'tutor',
		content: finalText,
		move: decision.move,
		toolCalls: toolRecords,
		flagged: Boolean(flagReason),
		flagReason
	});
	yield { type: 'done', turnId, flagged: Boolean(flagReason) };
}

// Buffers streamed deltas into sentences so every chunk passes the safety
// check before the client (and the TTS engine) ever sees it.
class SentenceEmitter {
	emittedText = '';
	private pending = '';

	constructor(private check: OutputCheck) {}

	push(
		delta: string
	): Array<{ text: string; blocked: false } | { text: string; blocked: true; reason: string }> {
		this.pending += delta;
		const out: ReturnType<SentenceEmitter['push']> = [];
		let m: RegExpMatchArray | null;
		while ((m = this.pending.match(/^[\s\S]*?[.!?]["')\]]?(\s+|$)/))) {
			const sentence = m[0];
			this.pending = this.pending.slice(sentence.length);
			const verdict = this.check.checkChunk(sentence);
			if (verdict.action === 'block') {
				this.pending = '';
				this.emittedText += verdict.replacement;
				out.push({ text: verdict.replacement, blocked: true, reason: verdict.reason });
				return out;
			}
			this.emittedText += sentence;
			out.push({ text: sentence, blocked: false });
		}
		return out;
	}

	flush(): ReturnType<SentenceEmitter['push']> {
		if (!this.pending) return [];
		const rest = this.pending;
		this.pending = '';
		const verdict = this.check.checkChunk(rest);
		if (verdict.action === 'block') {
			this.emittedText += verdict.replacement;
			return [{ text: verdict.replacement, blocked: true, reason: verdict.reason }];
		}
		this.emittedText += rest;
		return [{ text: rest, blocked: false }];
	}
}

// --- policy-input derivation from persisted turns (Decision Log D3) ---

interface OpenProblem {
	skillId: string;
	prompt: string;
	answer: string;
}

type TurnRow = ReturnType<typeof listTurns>[number];

function parseToolCalls(t: TurnRow): StoredToolCall[] {
	if (!t.toolCalls) return [];
	try {
		return JSON.parse(t.toolCalls) as StoredToolCall[];
	} catch {
		return [];
	}
}

// The problem "on the table" = the last make_quiz_item the tutor registered.
function findOpenProblem(history: TurnRow[]): OpenProblem | null {
	for (let i = history.length - 1; i >= 0; i--) {
		for (const call of parseToolCalls(history[i]).reverse()) {
			if (call.name === 'make_quiz_item') {
				const input = call.input as { skill_id?: string; prompt?: string; answer?: string };
				if (input.skill_id && input.prompt && input.answer) {
					return { skillId: input.skill_id, prompt: input.prompt, answer: input.answer };
				}
			}
		}
	}
	return null;
}

// Hints spent since that problem was posed.
function countHintsSinceProblem(history: TurnRow[]): number {
	let hints = 0;
	for (let i = history.length - 1; i >= 0; i--) {
		const t = history[i];
		if (t.role !== 'tutor') continue;
		if (parseToolCalls(t).some((c) => c.name === 'make_quiz_item')) return hints;
		if (t.move === 'HINT') hints++;
	}
	return hints;
}

const ASKED_FOR_ANSWER =
	/\b(just tell me|tell me the answer|what'?s the answer|give me the answer|i give up)\b/i;
const ANSWER_TOKEN = /-?\d+\s+\d+\s*\/\s*\d+|-?\d+\s*\/\s*\d+|-?\d*\.\d+|-?\d+/;

// Summary of the incoming learner turn relative to the open problem. The
// misconception tag carries over from the previous tutor turn's check_math,
// or is detected fresh when the learner answers the open problem.
function summarizeLastExchange(
	history: TurnRow[],
	learnerText: string,
	openProblem: OpenProblem | null
): TurnSummary {
	const lastTutor = [...history].reverse().find((t) => t.role === 'tutor');

	let answeredCorrectly: boolean | null = null;
	let misconceptionTag: string | null = null;

	const token = learnerText.match(ANSWER_TOKEN)?.[0];
	if (openProblem && token) {
		const problemExpr = openProblem.prompt.match(/-?\d+\s*\/\s*\d+\s*[+-]\s*-?\d+\s*\/\s*\d+/)?.[0];
		const r = checkFractionAnswer(problemExpr ?? openProblem.answer, token);
		if (r.valid) {
			answeredCorrectly = r.correct;
			misconceptionTag = r.misconception;
		}
	}

	if (!misconceptionTag && lastTutor) {
		for (const call of parseToolCalls(lastTutor)) {
			if (call.name === 'check_math') {
				try {
					const parsed = JSON.parse(call.result) as { misconception?: string | null };
					if (parsed.misconception) misconceptionTag = parsed.misconception;
				} catch {
					/* unparseable result: ignore */
				}
			}
			if (call.name === 'log_misconception' && typeof call.input.tag === 'string') {
				misconceptionTag = call.input.tag;
			}
		}
	}

	return {
		role: 'learner',
		move: (lastTutor?.move as Move | null) ?? null,
		answeredCorrectly,
		misconceptionTag,
		askedForAnswer: ASKED_FOR_ANSWER.test(learnerText)
	};
}
