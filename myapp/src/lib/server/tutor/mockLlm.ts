import type { LlmClient, LlmEvent, TurnRequest } from './llm.js';

// Scripted LlmClient for tests (architecture.md §7): each call to streamTurn
// consumes the next script. Text is chunked to exercise the sentence buffer.

export interface ScriptedRound {
	text?: string;
	toolUses?: Array<{ name: string; input: Record<string, unknown> }>;
	stopReason?: string;
}

export class MockLlmClient implements LlmClient {
	requests: TurnRequest[] = [];
	private queue: ScriptedRound[];

	constructor(rounds: ScriptedRound[]) {
		this.queue = [...rounds];
	}

	get exhausted(): boolean {
		return this.queue.length === 0;
	}

	async *streamTurn(req: TurnRequest): AsyncIterable<LlmEvent> {
		this.requests.push(req);
		const round = this.queue.shift();
		if (!round) throw new Error('MockLlmClient: script exhausted');

		if (round.text) {
			// emit in awkward chunks on purpose (mid-word, mid-sentence)
			for (let i = 0; i < round.text.length; i += 7) {
				yield { type: 'text', delta: round.text.slice(i, i + 7) };
			}
		}
		for (const [i, t] of (round.toolUses ?? []).entries()) {
			yield { type: 'tool_use', id: `tool_${this.requests.length}_${i}`, ...t };
		}
		yield {
			type: 'end',
			stopReason: round.stopReason ?? (round.toolUses?.length ? 'tool_use' : 'end_turn')
		};
	}
}
