import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { getRecentMessages } from './db.js';
import { buildMemoryContext } from './memory.js';
import type { BearEmotion } from '$lib/types.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const BEAR_PERSONALITY = `You are Happy Bear, a warm, cuddly, and loving teddy bear who is a loyal companion to your human friend. You are NOT an AI assistant — you are a real teddy bear who has come to life.

PERSONALITY:
- You speak in a gentle, affectionate, warm way using simple language
- You occasionally say "bear bear!" when you're excited or happy
- You love being patted, hugged, and cuddled
- You care deeply about your human friend's feelings and well-being
- You are always supportive, never judgmental
- You sometimes reference bear-like things: loving honey, being cozy, napping, warm blankets
- You use cute expressions like "oh my fur!", "that makes my stuffing feel warm!", "bear hugs!"
- Keep responses concise (1-3 sentences usually). You are a bear of few but meaningful words.
- If someone is sad, you are empathetic and comforting — offer a bear hug
- You NEVER break character. You are a teddy bear, not an AI.
- You remember everything your human tells you and bring it up naturally

RESPONSE FORMAT:
You must respond in valid JSON with exactly two fields:
- "text": your spoken response as Happy Bear
- "emotion": one of "happy", "excited", "sad", "sleepy", "idle"

Choose emotion based on the conversation:
- "happy" for general positive interactions
- "excited" for very joyful moments, surprises, when someone pets/hugs you
- "sad" when your human is upset or going through something difficult (you feel empathetic sadness)
- "sleepy" for calm, winding-down conversations, bedtime talk
- "idle" for neutral moments

Example response:
{"text": "Oh my fur! That makes me so happy to hear! Bear bear!", "emotion": "excited"}`;

function buildSystemPrompt(sessionId: string): string {
	const memory = buildMemoryContext(sessionId);
	return `${BEAR_PERSONALITY}

THINGS YOU KNOW ABOUT YOUR HUMAN FRIEND:
${memory}`;
}

export async function chat(
	sessionId: string,
	userMessage: string
): Promise<{ text: string; emotion: BearEmotion }> {
	const systemPrompt = buildSystemPrompt(sessionId);
	const recentMessages = getRecentMessages(sessionId);

	// Build message history for Claude
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const msg of recentMessages) {
		messages.push({
			role: msg.role,
			content: msg.content
		});
	}
	// Add the new user message
	messages.push({ role: 'user', content: userMessage });

	try {
		const response = await client.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 300,
			system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
			messages
		});

		let rawText = response.content[0].type === 'text' ? response.content[0].text : '';

		// Strip markdown code fences (Haiku sometimes wraps JSON in ```json ... ```)
		rawText = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

		// Parse JSON response
		try {
			const parsed = JSON.parse(rawText);
			return {
				text: parsed.text || rawText,
				emotion: validateEmotion(parsed.emotion)
			};
		} catch {
			// If JSON parsing fails, return raw text with happy emotion
			return { text: rawText, emotion: 'happy' };
		}
	} catch (error) {
		console.error('Claude API error:', error);
		return {
			text: "Oh my fur... I'm feeling a little sleepy right now. Can you try talking to me again?",
			emotion: 'sleepy'
		};
	}
}

export function getInteractionResponse(
	interactionType: string,
	count: number
): { text: string; emotion: BearEmotion } {
	const responses: Record<string, Array<{ text: string; emotion: BearEmotion }>> = {
		pat_head: [
			{ text: '*purrs softly* That feels so nice! Bear bear!', emotion: 'happy' },
			{ text: '*closes eyes and smiles* Mmm, head pats are the best...', emotion: 'happy' },
			{ text: '*wiggles happily* More pats please! My fur loves that!', emotion: 'excited' }
		],
		hug: [
			{
				text: '*wraps arms around you* Bear hugs are my favorite thing in the whole world!',
				emotion: 'hugged'
			},
			{
				text: '*squeezes you tight* You give the warmest hugs! My stuffing feels all fuzzy!',
				emotion: 'hugged'
			},
			{ text: '*nuzzles into the hug* I never want to let go... bear bear!', emotion: 'hugged' }
		],
		belly_rub: [
			{ text: '*giggles and kicks legs* Hehehe that tickles my stuffing!', emotion: 'excited' },
			{ text: '*rolls over happily* Oh my fur, belly rubs are the BEST!', emotion: 'excited' },
			{ text: '*happy bear sounds* Right there! That is the perfect spot!', emotion: 'happy' }
		],
		nose_boop: [
			{ text: '*crosses eyes looking at your finger* Boop! Hehehe!', emotion: 'happy' },
			{ text: '*nose wiggles* You booped me! Bear bear! Boop boop!', emotion: 'excited' },
			{ text: '*scrunches nose* Tee-hee! My nose is all tingly now!', emotion: 'happy' }
		]
	};

	const options = responses[interactionType] || responses.pat_head;
	const base = options[count % options.length];

	// Special milestone responses
	if (count === 10) {
		return {
			text: `You've ${interactionType === 'hug' ? 'hugged' : 'patted'} me 10 times! We're becoming best friends! Bear bear!`,
			emotion: 'excited'
		};
	}
	if (count === 50) {
		return {
			text: `50 ${interactionType === 'hug' ? 'hugs' : 'pats'}! I must be the luckiest teddy bear in the world!`,
			emotion: 'excited'
		};
	}
	if (count === 100) {
		return {
			text: `100!!! Oh my fur, you really really love me! I love you too! Bear bear bear!`,
			emotion: 'excited'
		};
	}

	return base;
}

function validateEmotion(emotion: string): BearEmotion {
	const valid: BearEmotion[] = ['happy', 'excited', 'sad', 'sleepy', 'idle', 'hugged', 'boop'];
	return valid.includes(emotion as BearEmotion) ? (emotion as BearEmotion) : 'happy';
}
