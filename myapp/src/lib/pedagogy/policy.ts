import { isDueForReview, masteryBand, type MasteryBand } from './mastery.js';
import type { LearnerSnapshot, PolicyDecision, TurnSummary } from './types.js';

// Dialogue policy as an explicit, pure state machine (architecture.md §3).
// Invariants (locked by policy.test.ts):
//   - EXPLAIN is only reachable after >= MAX_HINTS hints on the current problem.
//   - When mastery is 'unknown' or 'uncertain', the policy prefers
//     DIAGNOSE/HINT/PROBE/PRACTICE — never answer-dumping EXPLAIN.
export const MAX_HINTS = 2;

export function selectMove(
	s: LearnerSnapshot,
	last: TurnSummary | null,
	now: Date = new Date()
): PolicyDecision {
	const active = s.activeSkillId ? s.mastery.find((m) => m.skillId === s.activeSkillId) : undefined;
	const band = masteryBand(active, now);

	// Session opening: establish what the learner knows before teaching.
	if (last === null) {
		return {
			move: 'DIAGNOSE',
			reason: 'session start: no evidence yet',
			targetSkillId: s.activeSkillId
		};
	}

	// Fresh misconception evidence beats everything else: dig into it.
	if (last.misconceptionTag !== null) {
		return {
			move: 'PROBE',
			reason: `misconception '${last.misconceptionTag}' surfaced: probe its boundary`,
			targetSkillId: s.activeSkillId
		};
	}

	// Wrong answer: scaffold before telling. Only explain once hints are spent.
	if (last.answeredCorrectly === false) {
		if (s.hintsThisProblem < MAX_HINTS) {
			return {
				move: 'HINT',
				reason: `wrong answer, ${s.hintsThisProblem}/${MAX_HINTS} hints used: scaffold`,
				targetSkillId: s.activeSkillId
			};
		}
		return {
			move: 'EXPLAIN',
			reason: `wrong answer with ${s.hintsThisProblem} hints spent: worked explanation earned`,
			targetSkillId: s.activeSkillId
		};
	}

	// Learner asks for the answer outright: same gate — hints first.
	if (last.askedForAnswer) {
		if (s.hintsThisProblem >= MAX_HINTS && band !== 'unknown' && band !== 'uncertain') {
			return {
				move: 'EXPLAIN',
				reason: 'answer requested after full scaffolding',
				targetSkillId: s.activeSkillId
			};
		}
		return {
			move: 'HINT',
			reason: `answer requested but mastery ${band}: hint instead of telling`,
			targetSkillId: s.activeSkillId
		};
	}

	// Correct answer: consolidate or advance.
	if (last.answeredCorrectly === true) {
		if (band === 'high') {
			const due = dueHighSkill(s, now);
			if (due) {
				return {
					move: 'REVIEW',
					reason: `skill '${due.skillId}' due for spaced review`,
					targetSkillId: due.skillId
				};
			}
			const next = weakestSkill(s, now);
			return {
				move: 'PRACTICE',
				reason: next
					? `mastered current skill: practice '${next}'`
					: 'mastered: consolidate with practice',
				targetSkillId: next ?? s.activeSkillId
			};
		}
		return {
			move: 'PRACTICE',
			reason: `correct but mastery ${band}: gather more evidence`,
			targetSkillId: s.activeSkillId
		};
	}

	// No checkable answer in the last turn (chat, question, thinking aloud).
	if (band === 'unknown') {
		return {
			move: 'DIAGNOSE',
			reason: 'no mastery evidence for active skill',
			targetSkillId: s.activeSkillId
		};
	}
	if (band === 'high') {
		const due = dueHighSkill(s, now);
		if (due) {
			return {
				move: 'REVIEW',
				reason: `skill '${due.skillId}' due for spaced review`,
				targetSkillId: due.skillId
			};
		}
	}
	return {
		move: 'PROBE',
		reason: `mastery ${band}: probe understanding before moving on`,
		targetSkillId: s.activeSkillId
	};
}

// REVIEW is for maintenance of skills that are still strong. A skill that is
// overdue AND decayed belongs to PRACTICE/re-teaching, not a quick review.
function dueHighSkill(s: LearnerSnapshot, now: Date) {
	return s.mastery.find((m) => isDueForReview(m, now) && masteryBand(m, now) === 'high');
}

// Lowest-band, then lowest-recall skill among tracked mastery rows; null if
// nothing tracked besides the active skill.
function weakestSkill(s: LearnerSnapshot, now: Date): string | null {
	const order: Record<MasteryBand, number> = { unknown: 0, low: 1, uncertain: 2, high: 3 };
	const candidates = s.mastery
		.filter((m) => m.skillId !== s.activeSkillId)
		.sort(
			(a, b) => order[masteryBand(a, now)] - order[masteryBand(b, now)] || a.pRecall - b.pRecall
		);
	return candidates[0]?.skillId ?? null;
}
