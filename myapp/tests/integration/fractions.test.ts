import { describe, expect, it } from 'vitest';
import { createTutorDb } from '$lib/server/tutor/db.js';
import { MockLlmClient, type ScriptedRound } from '$lib/server/tutor/mockLlm.js';
import {
	createTutorSession,
	getOrCreateLearner,
	listMastery,
	listOpenMisconceptions,
	listSessionsForParent,
	listTurns
} from '$lib/server/tutor/repo.js';
import { HeuristicOutputCheck } from '$lib/server/tutor/safety.js';
import { runTurn, type TurnEvent, type TurnLoopDeps } from '$lib/server/tutor/turnLoop.js';

// Scripted 5-turn fractions exchange against the mock LLM (architecture.md
// §7 milestone 6): drives the real turn loop, policy, tools and persistence —
// only the model is fake.

const PERSONA = 'You are Happy Bear, a teddy-bear tutor. Short sentences.';

async function drive(deps: TurnLoopDeps, sessionId: string, learnerText: string) {
	const events: TurnEvent[] = [];
	for await (const ev of runTurn(deps, { sessionId, learnerText })) events.push(ev);
	const move = events.find((e) => e.type === 'move');
	const done = events.find((e) => e.type === 'done');
	const text = events
		.filter((e): e is Extract<TurnEvent, { type: 'text' }> => e.type === 'text')
		.map((e) => e.delta)
		.join('');
	return { events, move, done, text };
}

describe('5-turn fractions tutoring exchange (mock LLM)', () => {
	it('runs the exchange and visibly updates the learner model', async () => {
		const db = createTutorDb(':memory:');
		getOrCreateLearner(db, 'kid');
		createTutorSession(db, { id: 's1', learnerId: 'kid', mode: 'text' });

		const script: ScriptedRound[] = [
			// T1 — opening, no tools
			{ text: 'Oh my fur, fractions are my favorite! What do you think 1/2 + 1/3 makes?' },
			// T2 — learner answers wrong; model verifies, logs, records outcome...
			{
				toolUses: [
					{
						name: 'check_math',
						input: { expression: '1/2 + 1/3', student_answer: '2/5' }
					},
					{
						name: 'log_misconception',
						input: {
							skill_id: 'frac.add-unlike',
							tag: 'adds-denominators',
							evidence: 'said 1/2 + 1/3 = 2/5'
						}
					},
					{ name: 'update_mastery', input: { skill_id: 'frac.add-unlike', outcome: 'incorrect' } }
				]
			},
			// ...then responds with a hint-flavored reply
			{ text: 'Hmm, close! When we add halves and thirds, can we just add the bottoms?' },
			// T3 — probe the misconception
			{ text: 'Good wondering! If 1/2 + 1/2 were 2/4, would that be bigger or smaller than 1?' },
			// T4 — model poses a fresh practice problem
			{
				toolUses: [
					{
						name: 'make_quiz_item',
						input: {
							skill_id: 'frac.add-unlike',
							prompt: 'What is 1/2 + 1/3?',
							answer: '5/6'
						}
					}
				]
			},
			{ text: 'Yes! Same bottoms first. So, what is 1/2 + 1/3?' },
			// T5 — correct answer gets recorded
			{
				toolUses: [
					{ name: 'update_mastery', input: { skill_id: 'frac.add-unlike', outcome: 'correct' } }
				]
			},
			{ text: 'Bear bear, 5/6 is exactly right! You found the honey.' }
		];
		const llm = new MockLlmClient(script);
		const deps: TurnLoopDeps = {
			db,
			llm,
			outputCheck: new HeuristicOutputCheck(),
			persona: PERSONA
		};

		// T1: no evidence at all -> DIAGNOSE
		const t1 = await drive(deps, 's1', 'Hi! Can we do fractions today?');
		expect(t1.move).toMatchObject({ move: 'DIAGNOSE' });
		expect(t1.text).toContain('fractions are my favorite');

		// T2: wrong answer; tools fire and the learner model changes
		const t2 = await drive(deps, 's1', 'I think 1/2 + 1/3 = 2/5');
		expect(t2.events.filter((e) => e.type === 'tool').map((e) => e.name)).toEqual([
			'check_math',
			'log_misconception',
			'update_mastery'
		]);
		expect(listMastery(db, 'kid')).toHaveLength(1);
		expect(listMastery(db, 'kid')[0].card.reps).toBe(1);
		expect(listOpenMisconceptions(db, 'kid').map((m) => m.tag)).toEqual(['adds-denominators']);

		// T3: the check_math result from T2 carries the misconception -> PROBE
		const t3 = await drive(deps, 's1', 'Wait, so I cannot just add the bottoms?');
		expect(t3.move).toMatchObject({ move: 'PROBE' });

		// T4: reflective turn, no checkable answer, thin evidence -> PROBE (not EXPLAIN)
		const t4 = await drive(deps, 's1', 'I think I need the same bottom number first');
		expect(t4.move).toMatchObject({ move: 'PROBE' });
		expect(t4.text).toContain('what is 1/2 + 1/3');

		// T5: correct answer against the open problem -> PRACTICE, mastery advances
		const t5 = await drive(deps, 's1', 'It is 5/6!');
		expect(t5.move).toMatchObject({ move: 'PRACTICE' });
		const mastery = listMastery(db, 'kid')[0];
		expect(mastery.card.reps).toBe(2);
		expect(mastery.pRecall).toBeGreaterThan(0);

		// full transcript persisted: 5 learner + 5 tutor turns, moves recorded
		const turns = listTurns(db, 's1');
		expect(turns).toHaveLength(10);
		expect(turns.filter((t) => t.role === 'tutor').map((t) => t.move)).toEqual([
			'DIAGNOSE',
			'DIAGNOSE',
			'PROBE',
			'PROBE',
			'PRACTICE'
		]);
		expect(turns.every((t) => t.flagged === 0)).toBe(true);
		expect(llm.exhausted).toBe(true);

		// parent view sees the session
		const sessions = listSessionsForParent(db);
		expect(sessions[0]).toMatchObject({ id: 's1', turnCount: 10, flaggedCount: 0 });

		// the system prompt actually constrained the moves and carried the model
		const lastSystem = llm.requests.at(-1)!.system;
		expect(lastSystem).toContain('MOVE: PRACTICE');
		expect(lastSystem).toContain('adds-denominators');
	});

	it('blocks unsafe output mid-stream and flags the turn', async () => {
		const db = createTutorDb(':memory:');
		getOrCreateLearner(db, 'kid');
		createTutorSession(db, { id: 's2', learnerId: 'kid', mode: 'text' });

		const llm = new MockLlmClient([
			{ text: 'Fractions are fun. You are stupid if you missed it. More math now.' }
		]);
		const deps: TurnLoopDeps = {
			db,
			llm,
			outputCheck: new HeuristicOutputCheck(),
			persona: PERSONA
		};

		const t = await drive(deps, 's2', 'hello bear');
		expect(t.text).toContain('Fractions are fun.');
		expect(t.text).not.toContain('stupid');
		expect(t.text).toContain("let's talk about our fractions instead");
		expect(t.done).toMatchObject({ flagged: true });

		const tutorTurn = listTurns(db, 's2').find((x) => x.role === 'tutor')!;
		expect(tutorTurn.flagged).toBe(1);
		expect(tutorTurn.flagReason).toContain('demeaning language');
		expect(tutorTurn.content).not.toContain('stupid');
	});
});
