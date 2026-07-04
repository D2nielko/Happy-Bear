import { upsertFact, getFacts, updateSessionName } from './db.js';

interface ExtractedFact {
	factType: string;
	factKey: string;
	factValue: string;
}

/**
 * Extract facts from a user message using pattern matching.
 * This avoids a second API call for common patterns.
 */
export function extractFacts(message: string): ExtractedFact[] {
	const facts: ExtractedFact[] = [];

	// Name patterns
	const namePatterns = [
		/my name is (\w+)/i,
		/i'm (\w+)/i,
		/call me (\w+)/i,
		/i am (\w+)/i,
		/name'?s (\w+)/i
	];
	for (const pattern of namePatterns) {
		const match = message.match(pattern);
		if (match) {
			// Filter out common non-name words
			const word = match[1];
			const nonNames = [
				'doing',
				'good',
				'fine',
				'great',
				'okay',
				'ok',
				'well',
				'happy',
				'sad',
				'tired',
				'not',
				'so',
				'very',
				'really',
				'just',
				'feeling',
				'a',
				'the',
				'here',
				'back',
				'sorry'
			];
			if (!nonNames.includes(word.toLowerCase())) {
				facts.push({ factType: 'identity', factKey: 'name', factValue: word });
				break;
			}
		}
	}

	// Age
	const ageMatch =
		message.match(/i(?:'m| am) (\d{1,3}) years? old/i) || message.match(/my age is (\d{1,3})/i);
	if (ageMatch) {
		facts.push({ factType: 'identity', factKey: 'age', factValue: ageMatch[1] });
	}

	// Favorites
	const favoritePatterns = [
		{ regex: /my favorite (?:colour|color) is (\w+)/i, key: 'favorite_color' },
		{ regex: /i love (\w+)/i, key: 'loves' },
		{ regex: /my favorite food is ([^.!?]+)/i, key: 'favorite_food' },
		{ regex: /my favorite animal is ([^.!?]+)/i, key: 'favorite_animal' },
		{ regex: /my favorite (\w+) is ([^.!?]+)/i, key: 'favorite_$1' }
	];
	for (const { regex, key } of favoritePatterns) {
		const match = message.match(regex);
		if (match) {
			if (key === 'favorite_$1') {
				facts.push({
					factType: 'preference',
					factKey: `favorite_${match[1].toLowerCase()}`,
					factValue: match[2].trim()
				});
			} else {
				facts.push({ factType: 'preference', factKey: key, factValue: match[1].trim() });
			}
		}
	}

	// Job/occupation
	const jobMatch =
		message.match(/i (?:work as|am) an? ([^.!?]+?)(?:\.|!|\?|$)/i) ||
		message.match(/my job is ([^.!?]+)/i) ||
		message.match(/i'm an? ([^.!?,]+?)(?:,|\.|!|\?|$)/i);
	if (jobMatch) {
		const job = jobMatch[1].trim();
		const jobWords = [
			'teacher',
			'doctor',
			'nurse',
			'engineer',
			'developer',
			'designer',
			'student',
			'artist',
			'writer',
			'chef',
			'musician',
			'programmer',
			'scientist',
			'lawyer'
		];
		if (jobWords.some((w) => job.toLowerCase().includes(w))) {
			facts.push({ factType: 'identity', factKey: 'occupation', factValue: job });
		}
	}

	// Pet
	const petMatch =
		message.match(/i have an? (\w+) (?:named|called) (\w+)/i) ||
		message.match(/my (\w+)(?:'s| is) (?:named|called) (\w+)/i);
	if (petMatch) {
		facts.push({
			factType: 'life',
			factKey: `pet_${petMatch[1].toLowerCase()}`,
			factValue: petMatch[2]
		});
	}

	// Location
	const locationMatch =
		message.match(/i live in ([^.!?]+)/i) || message.match(/i'm from ([^.!?]+)/i);
	if (locationMatch) {
		facts.push({ factType: 'identity', factKey: 'location', factValue: locationMatch[1].trim() });
	}

	return facts;
}

/**
 * Save extracted facts to the database and update session name if name found.
 */
export function saveExtractedFacts(sessionId: string, message: string): void {
	const facts = extractFacts(message);
	for (const fact of facts) {
		upsertFact(sessionId, fact.factType, fact.factKey, fact.factValue);
		// If we learned the user's name, update the session display name
		if (fact.factKey === 'name') {
			updateSessionName(sessionId, fact.factValue);
		}
	}
}

/**
 * Build a memory string for injection into the system prompt.
 */
export function buildMemoryContext(sessionId: string): string {
	const facts = getFacts(sessionId);
	if (facts.length === 0) {
		return 'You have not learned anything about your human friend yet.';
	}

	const lines: string[] = [];
	for (const fact of facts) {
		switch (fact.fact_key) {
			case 'name':
				lines.push(`Your human friend's name is ${fact.fact_value}.`);
				break;
			case 'age':
				lines.push(`They are ${fact.fact_value} years old.`);
				break;
			case 'occupation':
				lines.push(`They work as a ${fact.fact_value}.`);
				break;
			case 'location':
				lines.push(`They live in ${fact.fact_value}.`);
				break;
			default:
				if (fact.fact_key.startsWith('favorite_')) {
					const thing = fact.fact_key.replace('favorite_', '');
					lines.push(`Their favorite ${thing} is ${fact.fact_value}.`);
				} else if (fact.fact_key.startsWith('pet_')) {
					const animal = fact.fact_key.replace('pet_', '');
					lines.push(`They have a ${animal} named ${fact.fact_value}.`);
				} else if (fact.fact_key === 'loves') {
					lines.push(`They love ${fact.fact_value}.`);
				} else {
					lines.push(`${fact.fact_key}: ${fact.fact_value}`);
				}
		}
	}

	return lines.join('\n');
}
