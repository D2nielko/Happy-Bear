import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getSession,
	logInteraction,
	getInteractionCount,
	saveMessage,
	getTotalInteractions
} from '$lib/server/db.js';
import { getInteractionResponse } from '$lib/server/claude.js';

const VALID_INTERACTIONS = ['pat_head', 'hug', 'belly_rub', 'nose_boop'];

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionId = cookies.get('happy_bear_session');
	if (!sessionId) {
		throw error(401, 'No session found.');
	}

	const session = getSession(sessionId);
	if (!session) {
		throw error(401, 'Session expired.');
	}

	const { interactionType } = await request.json();
	if (!VALID_INTERACTIONS.includes(interactionType)) {
		throw error(400, 'Invalid interaction type.');
	}

	// Log the interaction
	logInteraction(sessionId, interactionType);

	// Get count for this specific interaction type
	const count = getInteractionCount(sessionId, interactionType);
	const totalInteractions = getTotalInteractions(sessionId);

	// Get the bear's reaction
	const response = getInteractionResponse(interactionType, count);

	// Save as a chat message so it appears in conversation
	saveMessage(sessionId, 'assistant', response.text, response.emotion);

	return json({
		text: response.text,
		emotion: response.emotion,
		interactionCount: count,
		totalInteractions
	});
};
