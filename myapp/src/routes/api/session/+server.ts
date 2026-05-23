import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { createSession, getSession, updateSessionActivity, getTotalInteractions } from '$lib/server/db.js';

export const GET: RequestHandler = async ({ cookies }) => {
	let sessionId = cookies.get('happy_bear_session');

	if (sessionId) {
		const session = getSession(sessionId);
		if (session) {
			updateSessionActivity(sessionId);
			const totalInteractions = getTotalInteractions(sessionId);
			return json({
				id: session.id,
				displayName: session.display_name,
				totalInteractions,
				isNew: false
			});
		}
	}

	// Create new session
	sessionId = uuidv4();
	createSession(sessionId);
	cookies.set('happy_bear_session', sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 // 1 year
	});

	return json({
		id: sessionId,
		displayName: null,
		totalInteractions: 0,
		isNew: true
	});
};
