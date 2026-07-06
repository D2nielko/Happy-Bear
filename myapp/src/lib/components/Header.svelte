<script lang="ts">
	import { totalInteractions, displayName } from '$lib/stores/chat.js';

	$: level =
		$totalInteractions < 10
			? 'New Friend'
			: $totalInteractions < 30
				? 'Good Friend'
				: $totalInteractions < 75
					? 'Best Friend'
					: $totalInteractions < 150
						? 'Bear Bestie'
						: 'Soulmate';

	$: levelEmoji =
		$totalInteractions < 10
			? '🧸'
			: $totalInteractions < 30
				? '💛'
				: $totalInteractions < 75
					? '🌟'
					: $totalInteractions < 150
						? '✨'
						: '💖';
</script>

<header class="w-full bg-white/40 backdrop-blur-sm border-b border-bear-tan/20 px-6 py-3">
	<div class="max-w-6xl mx-auto flex items-center justify-between">
		<div class="flex items-center gap-3">
			<span class="text-3xl">🧸</span>
			<div>
				<h1 class="font-comfortaa text-xl text-bear-dark font-bold leading-tight">Happy Bear</h1>
				{#if $displayName}
					<p class="text-sm text-bear-brown/70 font-poppins">{$displayName}'s teddy bear</p>
				{/if}
			</div>
		</div>
		<div class="flex items-center gap-2 bg-warm-100 px-3 py-1.5 rounded-full">
			<span class="text-sm">{levelEmoji}</span>
			<span class="font-comfortaa text-sm text-bear-dark font-medium">{level}</span>
		</div>
	</div>
</header>
