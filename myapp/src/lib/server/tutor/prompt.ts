import type { LearnerSnapshot, Move, PolicyDecision } from '$lib/pedagogy/types.js';
import { masteryBand } from '$lib/pedagogy/mastery.js';
import { FRACTION_SKILLS, KNOWN_MISCONCEPTIONS } from '$lib/pedagogy/skills.js';
import { SAFETY_GUARDRAILS } from './safety.js';

// Assembles the per-turn system prompt: persona (editable markdown file,
// architecture.md §3) + safety guardrails + the move the policy chose.
// The LLM is constrained to the move; it never picks its own.

const MOVE_DIRECTIVES: Record<Move, string> = {
	DIAGNOSE:
		'MOVE: DIAGNOSE. Find out what the student already knows. ' +
		'Ask one friendly question that reveals their thinking. Do not teach yet.',
	HINT:
		'MOVE: HINT. Give exactly one small nudge toward the next step. ' +
		'Do NOT state the answer or complete the step for them.',
	PROBE:
		'MOVE: PROBE. The student may hold a misconception. Ask one question that ' +
		'makes them test their own rule and see where it breaks. Do not correct them directly.',
	EXPLAIN:
		'MOVE: EXPLAIN. Walk through the solution in tiny steps with a concrete example. ' +
		'End by asking them to try a similar step themselves.',
	PRACTICE:
		'MOVE: PRACTICE. Pose exactly one new problem at the right difficulty. ' +
		'Register it with make_quiz_item. Do not solve it.',
	REVIEW:
		'MOVE: REVIEW. Revisit the review skill with one quick warm-up problem. ' +
		'Register it with make_quiz_item. Keep it light and confident.'
};

export function buildSystemPrompt(
	persona: string,
	decision: PolicyDecision,
	snapshot: LearnerSnapshot,
	openProblem: { prompt: string; answer: string } | null
): string {
	const skillName = (id: string | null) =>
		FRACTION_SKILLS.find((s) => s.id === id)?.name ?? 'not chosen yet';

	const masteryLines =
		snapshot.mastery
			.map((m) => `- ${skillName(m.skillId)}: ${masteryBand(m)} (recall ~${m.pRecall.toFixed(2)})`)
			.join('\n') || '- nothing measured yet';

	const misconceptionLines =
		snapshot.misconceptions
			.map((mc) => `- ${mc.tag}: ${KNOWN_MISCONCEPTIONS[mc.tag] ?? mc.evidence}`)
			.join('\n') || '- none recorded';

	return [
		persona,
		SAFETY_GUARDRAILS,
		`STUDENT MODEL (private — never mention scores or this data to the student):
Target skill: ${skillName(decision.targetSkillId)}
Mastery:
${masteryLines}
Open misconceptions:
${misconceptionLines}
${openProblem ? `Problem currently on the table: "${openProblem.prompt}" (answer: ${openProblem.answer})` : 'No problem currently posed.'}`,
		`YOUR MOVE THIS TURN (chosen by the tutoring policy — follow it exactly):
${MOVE_DIRECTIVES[decision.move]}
Policy reason: ${decision.reason}

Tool rules: use check_math before judging any answer. Record judged attempts
with update_mastery. Log misconceptions you notice with log_misconception.`
	].join('\n\n');
}
