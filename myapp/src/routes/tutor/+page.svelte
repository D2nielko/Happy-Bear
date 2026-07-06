<script lang="ts">
	import { onMount } from 'svelte';
	import { WebSpeechStt, SpeechSynthesisTts } from '$lib/voice/webSpeech.js';
	import type { SttEngine, TtsEngine } from '$lib/voice/types.js';

	interface TutorMessage {
		role: 'learner' | 'tutor';
		content: string;
		move?: string;
	}

	let sessionId: string | null = null;
	let messages: TutorMessage[] = [];
	let input = '';
	let busy = false;
	let speakReplies = false;
	let listening = false;
	let partialTranscript = '';
	let errorText = '';
	let chatEl: HTMLDivElement;

	// Defaults per architecture.md §3; server engines are stubs for now.
	const stt: SttEngine = new WebSpeechStt();
	const tts: TtsEngine = new SpeechSynthesisTts();
	let voiceSupported = false;

	onMount(async () => {
		voiceSupported = stt.isAvailable() && tts.isAvailable();
		const res = await fetch('/api/tutor/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mode: voiceSupported ? 'voice' : 'text' })
		});
		sessionId = (await res.json()).sessionId;
	});

	function scrollDown() {
		requestAnimationFrame(() => chatEl?.scrollTo({ top: chatEl.scrollHeight }));
	}

	async function send(text: string) {
		const trimmed = text.trim();
		if (!trimmed || !sessionId || busy) return;
		busy = true;
		errorText = '';
		messages = [...messages, { role: 'learner', content: trimmed }];
		const reply: TutorMessage = { role: 'tutor', content: '' };
		messages = [...messages, reply];
		scrollDown();

		try {
			const res = await fetch('/api/tutor/turn', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId, text: trimmed })
			});
			if (!res.ok || !res.body) throw new Error(`turn failed (${res.status})`);

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split('\n\n');
				buffer = events.pop() ?? '';
				for (const raw of events) {
					if (!raw.startsWith('data: ')) continue;
					const ev = JSON.parse(raw.slice(6));
					if (ev.type === 'move') {
						reply.move = ev.move;
					} else if (ev.type === 'text') {
						reply.content += ev.delta;
						// server emits whole safety-checked sentences: speak each
						// one as it lands so audio starts before the turn ends
						if (speakReplies) tts.speak(ev.delta);
					} else if (ev.type === 'error') {
						throw new Error(ev.message);
					}
					messages = messages;
					scrollDown();
				}
			}
			if (speakReplies) await tts.flush();
		} catch (e) {
			errorText = e instanceof Error ? e.message : 'Something went wrong.';
			if (!reply.content) {
				reply.content = 'Oh my fur... something went wrong. Can you try again?';
				messages = messages;
			}
		} finally {
			busy = false;
		}
	}

	function submitText() {
		const text = input;
		input = '';
		send(text);
	}

	// Push-to-talk: hold to record, release to send the final transcript.
	function pttDown() {
		if (!voiceSupported || busy) return;
		tts.cancel();
		listening = true;
		partialTranscript = '';
		speakReplies = true;
		stt.start({
			lang: 'en-US',
			onPartial: (t) => (partialTranscript = t),
			onFinal: (t) => {
				partialTranscript = '';
				if (listening) {
					listening = false;
					stt.stop();
				}
				send(t);
			},
			onError: (e) => {
				listening = false;
				errorText = e.message;
			}
		});
	}

	function pttUp() {
		if (!listening) return;
		listening = false;
		stt.stop(); // triggers the final result, which sends
	}
</script>

<svelte:head>
	<title>Happy Bear Tutor</title>
</svelte:head>

<div class="mx-auto flex h-screen max-w-2xl flex-col p-4">
	<header class="mb-3 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-amber-800">🧸 Happy Bear Tutor</h1>
		<nav class="space-x-3 text-sm text-amber-700">
			<a href="/" class="underline">companion</a>
			<a href="/parent" class="underline">parent view</a>
		</nav>
	</header>

	<div bind:this={chatEl} class="flex-1 space-y-3 overflow-y-auto rounded-xl bg-amber-50 p-4">
		{#if messages.length === 0}
			<p class="text-center text-amber-600">Say hi to start! We're learning fractions together.</p>
		{/if}
		{#each messages as m}
			<div class={m.role === 'learner' ? 'flex justify-end' : 'flex justify-start'}>
				<div
					class={m.role === 'learner'
						? 'max-w-[80%] rounded-2xl bg-amber-600 px-4 py-2 text-white'
						: 'max-w-[80%] rounded-2xl bg-white px-4 py-2 text-amber-900 shadow'}
				>
					{#if m.move}
						<span
							class="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-400"
							>{m.move}</span
						>
					{/if}
					{m.content}{#if m.role === 'tutor' && busy && m === messages[messages.length - 1]}<span
							class="animate-pulse">▍</span
						>{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if partialTranscript}
		<p class="mt-2 text-sm italic text-amber-600">…{partialTranscript}</p>
	{/if}
	{#if errorText}
		<p class="mt-2 text-sm text-red-600">{errorText}</p>
	{/if}

	<form class="mt-3 flex gap-2" on:submit|preventDefault={submitText}>
		<input
			bind:value={input}
			disabled={busy || !sessionId}
			placeholder="Type to Happy Bear…"
			class="flex-1 rounded-xl border border-amber-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
		/>
		<button
			type="submit"
			disabled={busy || !input.trim()}
			class="rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white disabled:opacity-40"
		>
			Send
		</button>
		{#if voiceSupported}
			<button
				type="button"
				aria-pressed={listening}
				disabled={busy}
				on:mousedown={pttDown}
				on:mouseup={pttUp}
				on:mouseleave={pttUp}
				on:touchstart|preventDefault={pttDown}
				on:touchend|preventDefault={pttUp}
				class={listening
					? 'rounded-xl bg-red-500 px-5 py-3 font-semibold text-white'
					: 'rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white disabled:opacity-40'}
			>
				{listening ? '● listening' : '🎤 hold'}
			</button>
		{/if}
	</form>
	<label class="mt-2 flex items-center gap-2 text-sm text-amber-700">
		<input type="checkbox" bind:checked={speakReplies} />
		read replies aloud
	</label>
</div>
