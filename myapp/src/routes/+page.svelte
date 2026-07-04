<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import TeddyBear from '$lib/components/TeddyBear.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import EmotionOverlay from '$lib/components/EmotionOverlay.svelte';
	import {
		messages,
		bearEmotion,
		sessionId,
		displayName,
		totalInteractions
	} from '$lib/stores/chat.js';
	import type { InteractionType, BearEmotion } from '$lib/types.js';

	let initialized = false;

	onMount(async () => {
		try {
			// Initialize or resume session
			const res = await fetch('/api/session');
			const session = await res.json();
			sessionId.set(session.id);
			displayName.set(session.displayName);
			totalInteractions.set(session.totalInteractions);

			initialized = true;

			// If new session, have the bear greet
			if (session.isNew) {
				setTimeout(() => {
					messages.update((msgs) => [
						...msgs,
						{
							role: 'assistant',
							content:
								"Hi there! I'm Happy Bear! I'm so happy to meet you! What's your name? Bear bear!",
							emotion: 'excited'
						}
					]);
					bearEmotion.set('excited');
					setTimeout(() => bearEmotion.set('idle'), 4000);
				}, 500);
			}
		} catch (err) {
			console.error('Failed to initialize session:', err);
			initialized = true;
		}
	});

	async function handleInteraction(event: CustomEvent<InteractionType>) {
		const interactionType = event.detail;

		try {
			const res = await fetch('/api/interact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ interactionType })
			});

			if (!res.ok) throw new Error('Interaction failed');

			const data: { text: string; emotion: BearEmotion; totalInteractions: number } =
				await res.json();

			messages.update((msgs) => [
				...msgs,
				{
					role: 'assistant',
					content: data.text,
					emotion: data.emotion
				}
			]);

			bearEmotion.set(data.emotion);
			totalInteractions.set(data.totalInteractions);

			setTimeout(() => bearEmotion.set('idle'), 4000);
		} catch (err) {
			console.error('Interaction error:', err);
		}
	}
</script>

<svelte:head>
	<title>Happy Bear - Your Teddy Bear Friend</title>
	<meta name="description" content="An interactive AI teddy bear companion" />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header />

	{#if !initialized}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<span class="text-5xl inline-block animate-pulse-soft">🧸</span>
				<p class="font-comfortaa text-bear-dark/60 mt-3 text-sm">Waking up Happy Bear...</p>
			</div>
		</div>
	{:else}
		<main
			class="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:p-6 max-w-6xl mx-auto w-full"
		>
			<!-- Bear section -->
			<div class="lg:w-2/5 flex flex-col items-center justify-center relative">
				<div class="relative w-full max-w-sm">
					<EmotionOverlay />
					<TeddyBear on:interact={handleInteraction} />
					<div class="text-center mt-2">
						<p class="font-poppins text-xs text-bear-brown/40">
							Click the bear to interact! Try its head, belly, or nose
						</p>
					</div>
				</div>
			</div>

			<!-- Chat section -->
			<div class="lg:w-3/5 flex-1 min-h-[400px] lg:min-h-0">
				<ChatPanel />
			</div>
		</main>
	{/if}
</div>
