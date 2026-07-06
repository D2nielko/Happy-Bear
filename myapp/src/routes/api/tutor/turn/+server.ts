import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import personaRaw from '$lib/server/tutor/persona.md?raw';
import { getTutorDb } from '$lib/server/tutor/db.js';
import { AnthropicLlmClient } from '$lib/server/tutor/llm.js';
import { HeuristicOutputCheck } from '$lib/server/tutor/safety.js';
import { runTurn, type TurnLoopDeps } from '$lib/server/tutor/turnLoop.js';

// One tutoring turn, streamed as SSE (architecture.md §2). Model name and
// key come from env (§8 A5); the turn loop itself is transport-agnostic.

export const POST: RequestHandler = async ({ request }) => {
	const { sessionId, text } = await request.json().catch(() => ({}));
	if (typeof sessionId !== 'string' || typeof text !== 'string' || !text.trim()) {
		throw error(400, 'sessionId and text are required');
	}
	if (!env.ANTHROPIC_API_KEY) {
		throw error(500, 'ANTHROPIC_API_KEY is not configured');
	}

	const deps: TurnLoopDeps = {
		db: getTutorDb(),
		llm: new AnthropicLlmClient({
			apiKey: env.ANTHROPIC_API_KEY,
			model: env.ANTHROPIC_MODEL || 'claude-sonnet-5'
		}),
		outputCheck: new HeuristicOutputCheck(),
		persona: personaRaw
	};
	const learnerText = text.trim().slice(0, 1000);

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			try {
				for await (const ev of runTurn(deps, { sessionId, learnerText })) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'turn failed';
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
				);
			}
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
