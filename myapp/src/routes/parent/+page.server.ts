import type { PageServerLoad } from './$types';
import { getTutorDb } from '$lib/server/tutor/db.js';
import { listSessionsForParent } from '$lib/server/tutor/repo.js';

// Parent view (architecture.md §2): local-only, no analytics. A6: no auth
// while the app is local-first; revisit before any deployment.
export const load: PageServerLoad = async () => {
	return { sessions: listSessionsForParent(getTutorDb()) };
};
