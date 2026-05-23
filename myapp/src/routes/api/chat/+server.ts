import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession, saveMessage, updateSessionActivity } from '$lib/server/db.js';
import { chat } from '$lib/server/claude.js';
import { saveExtractedFacts } from '$lib/server/memory.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionId = cookies.get('happy_bear_session');
	if (!sessionId) {
		throw error(401, 'No session found. Please refresh the page.');
	}

	const session = getSession(sessionId);
	if (!session) {
		throw error(401, 'Session expired. Please refresh the page.');
	}

	const { message } = await request.json();
	if (!message || typeof message !== 'string' || message.trim().length === 0) {
		throw error(400, 'Message is required.');
	}

	const trimmedMessage = message.trim().slice(0, 1000); // Limit message length

	// Save user message
	saveMessage(sessionId, 'user', trimmedMessage);

	// Extract and save any facts from the user's message
	saveExtractedFacts(sessionId, trimmedMessage);

	// Get bear's response from Claude
	const response = await chat(sessionId, trimmedMessage);

	// Save bear's response
	saveMessage(sessionId, 'assistant', response.text, response.emotion);

	// Update session activity
	updateSessionActivity(sessionId);

	return json({
		text: response.text,
		emotion: response.emotion
	});
};
