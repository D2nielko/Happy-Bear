import { writable } from 'svelte/store';
import type { Message, BearEmotion } from '$lib/types.js';

export const messages = writable<Message[]>([]);
export const bearEmotion = writable<BearEmotion>('idle');
export const isLoading = writable(false);
export const sessionId = writable<string | null>(null);
export const displayName = writable<string | null>(null);
export const totalInteractions = writable(0);
