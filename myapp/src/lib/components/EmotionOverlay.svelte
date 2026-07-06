<script lang="ts">
	import { bearEmotion } from '$lib/stores/chat.js';
	import { onDestroy } from 'svelte';

	let particles: Array<{ id: number; x: number; y: number; emoji: string }> = [];
	let nextId = 0;

	const emotionEmojis: Record<string, string[]> = {
		happy: ['💛', '⭐'],
		excited: ['✨', '🌟', '💛', '⭐'],
		hugged: ['💖', '💕', '🤎'],
		boop: ['💫', '✨'],
		sad: ['💧'],
		sleepy: ['💤', '☁️'],
		idle: []
	};

	let interval: ReturnType<typeof setInterval> | null = null;

	$: {
		if (interval) clearInterval(interval);
		const emojis = emotionEmojis[$bearEmotion] || [];
		if (emojis.length > 0 && $bearEmotion !== 'idle') {
			// Spawn a burst of particles
			for (let i = 0; i < 3; i++) {
				setTimeout(() => spawnParticle(emojis), i * 200);
			}
			// Then occasional particles
			interval = setInterval(() => spawnParticle(emojis), 800);
			// Stop after a few seconds
			setTimeout(() => {
				if (interval) clearInterval(interval);
			}, 3000);
		}
	}

	function spawnParticle(emojis: string[]) {
		const particle = {
			id: nextId++,
			x: 20 + Math.random() * 60,
			y: 20 + Math.random() * 60,
			emoji: emojis[Math.floor(Math.random() * emojis.length)]
		};
		particles = [...particles, particle];
		// Remove after animation
		setTimeout(() => {
			particles = particles.filter((p) => p.id !== particle.id);
		}, 1500);
	}

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div class="absolute inset-0 pointer-events-none overflow-hidden">
	{#each particles as particle (particle.id)}
		<span
			class="absolute text-2xl animate-float-up"
			style="left: {particle.x}%; top: {particle.y}%"
		>
			{particle.emoji}
		</span>
	{/each}
</div>
