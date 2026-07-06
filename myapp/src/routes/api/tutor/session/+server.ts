import { json, error } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import type { RequestHandler } from './$types';
import { getTutorDb } from '$lib/server/tutor/db.js';
import { createTutorSession, getOrCreateLearner } from '$lib/server/tutor/repo.js';

const LEARNER_COOKIE = 'happy_bear_learner';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { mode } = await request.json().catch(() => ({}));
	if (mode !== 'text' && mode !== 'voice') {
		throw error(400, "mode must be 'text' or 'voice'");
	}

	const db = getTutorDb();
	let learnerId = cookies.get(LEARNER_COOKIE);
	if (!learnerId) {
		learnerId = uuidv4();
		cookies.set(LEARNER_COOKIE, learnerId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	getOrCreateLearner(db, learnerId);
	const session = createTutorSession(db, { id: uuidv4(), learnerId, mode });
	return json({ sessionId: session.id, learnerId });
};
