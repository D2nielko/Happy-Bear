export type BearEmotion = 'idle' | 'happy' | 'excited' | 'sad' | 'sleepy' | 'hugged' | 'boop';

export type InteractionType = 'pat_head' | 'hug' | 'belly_rub' | 'nose_boop';

export interface Message {
	id?: number;
	role: 'user' | 'assistant';
	content: string;
	emotion?: BearEmotion;
	createdAt?: string;
}

export interface Session {
	id: string;
	displayName?: string;
	createdAt: string;
	lastActiveAt: string;
}

export interface UserFact {
	id?: number;
	sessionId: string;
	factType: string;
	factKey: string;
	factValue: string;
	extractedAt?: string;
}

export interface ChatResponse {
	text: string;
	emotion: BearEmotion;
}

export interface InteractResponse {
	text: string;
	emotion: BearEmotion;
	interactionCount: number;
}
