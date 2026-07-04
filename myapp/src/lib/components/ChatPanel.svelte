<script lang="ts">
	import { onMount, afterUpdate, tick } from 'svelte';
	import ChatBubble from './ChatBubble.svelte';
	import BouncingDots from './BouncingDots.svelte';
	import { messages, isLoading, bearEmotion } from '$lib/stores/chat.js';
	import type { BearEmotion } from '$lib/types.js';

	let inputText = '';
	let chatContainer: HTMLDivElement;
	let inputElement: HTMLInputElement;

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	afterUpdate(scrollToBottom);

	onMount(() => {
		inputElement?.focus();
	});

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || $isLoading) return;

		inputText = '';
		isLoading.set(true);

		// Add user message immediately
		messages.update((msgs) => [...msgs, { role: 'user', content: text }]);
		await tick();
		scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});

			if (!res.ok) {
				throw new Error('Failed to get response');
			}

			const data: { text: string; emotion: BearEmotion } = await res.json();

			messages.update((msgs) => [
				...msgs,
				{
					role: 'assistant',
					content: data.text,
					emotion: data.emotion
				}
			]);

			bearEmotion.set(data.emotion);

			// Reset to idle after 4 seconds
			setTimeout(() => bearEmotion.set('idle'), 4000);
		} catch {
			messages.update((msgs) => [
				...msgs,
				{
					role: 'assistant',
					content: 'Oh my fur... something went wrong. Can you try again?',
					emotion: 'sad'
				}
			]);
			bearEmotion.set('sad');
			setTimeout(() => bearEmotion.set('idle'), 4000);
		} finally {
			isLoading.set(false);
			await tick();
			inputElement?.focus();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div
	class="flex flex-col h-full bg-white/30 backdrop-blur-sm rounded-2xl border border-bear-light/50 shadow-lg overflow-hidden"
>
	<!-- Chat messages -->
	<div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4 chat-scroll">
		{#if $messages.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center px-4">
				<span class="text-5xl mb-3">🧸</span>
				<p class="font-comfortaa text-bear-dark/60 text-sm">
					Say hi to Happy Bear!<br />
					<span class="text-xs text-bear-brown/40"
						>You can also pat the bear's head or give it a hug</span
					>
				</p>
			</div>
		{:else}
			{#each $messages as message}
				<ChatBubble role={message.role} content={message.content} />
			{/each}
		{/if}

		{#if $isLoading}
			<div class="flex justify-start mb-3">
				<div class="flex items-end gap-2">
					<div
						class="w-8 h-8 rounded-full bg-bear-tan flex items-center justify-center text-sm flex-shrink-0"
					>
						🧸
					</div>
					<div
						class="bg-white/80 backdrop-blur-sm rounded-2xl rounded-bl-md shadow-sm border border-bear-light/50"
					>
						<BouncingDots />
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input area -->
	<div class="border-t border-bear-light/30 p-3">
		<div class="flex gap-2">
			<input
				bind:this={inputElement}
				bind:value={inputText}
				on:keydown={handleKeydown}
				type="text"
				placeholder="Talk to Happy Bear..."
				class="flex-1 bg-white/60 border border-bear-light/50 rounded-full px-4 py-2.5 text-sm font-poppins text-bear-dark placeholder:text-bear-tan/60 focus:outline-none focus:ring-2 focus:ring-bear-tan/30 focus:border-bear-tan/50 transition-all"
				disabled={$isLoading}
			/>
			<button
				on:click={sendMessage}
				disabled={$isLoading || !inputText.trim()}
				class="bg-bear-tan hover:bg-bear-brown text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="w-5 h-5"
				>
					<path
						d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>
