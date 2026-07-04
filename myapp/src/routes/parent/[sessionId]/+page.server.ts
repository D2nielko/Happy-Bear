import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTutorDb } from '$lib/server/tutor/db.js';
import { getTutorSession, listTurns } from '$lib/server/tutor/repo.js';

export const load: PageServerLoad = async ({ params }) => {
	const db = getTutorDb();
	const session = getTutorSession(db, params.sessionId);
	if (!session) throw error(404, 'session not found');
	return { session, turns: listTurns(db, params.sessionId) };
};
