import Anthropic from '@anthropic-ai/sdk';
import type { ToolExecutor } from './tools.js';

// LlmClient boundary (architecture.md §3): one streaming model call per
// round. The turn loop owns the tool-execution conversation; tests swap in a
// scripted mock.

export interface TurnRequest {
	system: string;
	messages: Anthropic.MessageParam[];
	tools: Anthropic.Tool[];
}

export type LlmEvent =
	| { type: 'text'; delta: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'end'; stopReason: string | null };

export interface LlmClient {
	streamTurn(req: TurnRequest): AsyncIterable<LlmEvent>;
}

export function toAnthropicTools(tools: ToolExecutor[]): Anthropic.Tool[] {
	return tools.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: t.inputSchema as Anthropic.Tool.InputSchema
	}));
}

export class AnthropicLlmClient implements LlmClient {
	private client: Anthropic;

	constructor(private opts: { apiKey: string; model: string; maxTokens?: number }) {
		this.client = new Anthropic({ apiKey: opts.apiKey });
	}

	async *streamTurn(req: TurnRequest): AsyncIterable<LlmEvent> {
		const stream = this.client.messages.stream({
			model: this.opts.model,
			max_tokens: this.opts.maxTokens ?? 400,
			system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
			messages: req.messages,
			tools: req.tools
		});

		for await (const ev of stream) {
			if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
				yield { type: 'text', delta: ev.delta.text };
			}
		}

		// Tool inputs arrive as partial-JSON deltas; the assembled blocks on the
		// final message are the reliable source.
		const final = await stream.finalMessage();
		for (const block of final.content) {
			if (block.type === 'tool_use') {
				yield {
					type: 'tool_use',
					id: block.id,
					name: block.name,
					input: (block.input ?? {}) as Record<string, unknown>
				};
			}
		}
		yield { type: 'end', stopReason: final.stop_reason };
	}
}
