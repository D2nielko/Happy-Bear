<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { bearEmotion } from '$lib/stores/chat.js';
	import type { InteractionType } from '$lib/types.js';

	const dispatch = createEventDispatcher<{ interact: InteractionType }>();

	let animationClass = '';
	let isAnimating = false;

	$: eyeStyle = getEyeStyle($bearEmotion);
	$: mouthPath = getMouthPath($bearEmotion);
	$: blushOpacity = ['happy', 'excited', 'hugged'].includes($bearEmotion) ? 0.6 : 0;
	$: bodyClass = getBodyClass($bearEmotion);

	function getEyeStyle(emotion: string) {
		switch (emotion) {
			case 'happy':
			case 'excited':
			case 'hugged':
				return { type: 'crescent' };
			case 'sad':
				return { type: 'sad' };
			case 'sleepy':
				return { type: 'sleepy' };
			case 'boop':
				return { type: 'surprised' };
			default:
				return { type: 'normal' };
		}
	}

	function getMouthPath(emotion: string) {
		switch (emotion) {
			case 'happy':
			case 'hugged':
				return 'M 140,195 Q 160,215 180,195'; // big smile
			case 'excited':
				return 'M 138,192 Q 160,220 182,192'; // huge smile
			case 'sad':
				return 'M 142,200 Q 160,190 178,200'; // frown
			case 'sleepy':
				return 'M 148,198 Q 160,205 172,198'; // small smile
			case 'boop':
				return 'M 152,192 Q 160,202 168,192'; // small O
			default:
				return 'M 145,195 Q 160,208 175,195'; // gentle smile
		}
	}

	function getBodyClass(emotion: string) {
		switch (emotion) {
			case 'excited':
				return 'animate-bounce-gentle';
			case 'happy':
				return 'animate-wiggle';
			case 'hugged':
				return 'bear-hug';
			case 'sleepy':
				return 'bear-sleepy';
			default:
				return 'animate-breathe';
		}
	}

	function handleInteraction(type: InteractionType) {
		if (isAnimating) return;
		isAnimating = true;
		dispatch('interact', type);

		// Visual feedback
		animationClass = 'click-flash';
		setTimeout(() => {
			animationClass = '';
			isAnimating = false;
		}, 600);
	}
</script>

<div class="relative select-none">
	<svg
		viewBox="0 0 320 380"
		class="w-full max-w-[320px] mx-auto {bodyClass} {animationClass} transition-transform duration-300"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- Ears -->
		<circle cx="110" cy="90" r="35" fill="#C4935A" stroke="#A07840" stroke-width="2" />
		<circle cx="110" cy="90" r="20" fill="#E8C99B" />
		<circle cx="210" cy="90" r="35" fill="#C4935A" stroke="#A07840" stroke-width="2" />
		<circle cx="210" cy="90" r="20" fill="#E8C99B" />

		<!-- Head - clickable for pat -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<g
			class="cursor-pointer hover:brightness-105 transition-all"
			on:click={() => handleInteraction('pat_head')}
		>
			<ellipse cx="160" cy="145" rx="80" ry="75" fill="#D4A564" stroke="#B8903F" stroke-width="2" />
			<!-- Face area (lighter) -->
			<ellipse cx="160" cy="160" rx="55" ry="45" fill="#E8C99B" />
		</g>

		<!-- Eyes -->
		{#if eyeStyle.type === 'crescent'}
			<!-- Happy closed eyes -->
			<path
				d="M 130,140 Q 137,130 144,140"
				stroke="#5C4033"
				stroke-width="3"
				fill="none"
				stroke-linecap="round"
			/>
			<path
				d="M 176,140 Q 183,130 190,140"
				stroke="#5C4033"
				stroke-width="3"
				fill="none"
				stroke-linecap="round"
			/>
		{:else if eyeStyle.type === 'sad'}
			<!-- Sad eyes -->
			<circle cx="137" cy="138" r="5" fill="#5C4033" />
			<circle cx="183" cy="138" r="5" fill="#5C4033" />
			<path d="M 128,130 Q 137,135 146,132" stroke="#5C4033" stroke-width="2" fill="none" />
			<path d="M 174,132 Q 183,135 192,130" stroke="#5C4033" stroke-width="2" fill="none" />
		{:else if eyeStyle.type === 'sleepy'}
			<!-- Sleepy half-closed eyes -->
			<path d="M 130,140 L 144,140" stroke="#5C4033" stroke-width="3" stroke-linecap="round" />
			<path d="M 176,140 L 190,140" stroke="#5C4033" stroke-width="3" stroke-linecap="round" />
		{:else if eyeStyle.type === 'surprised'}
			<!-- Surprised wide eyes -->
			<circle cx="137" cy="138" r="7" fill="#5C4033" />
			<circle cx="183" cy="138" r="7" fill="#5C4033" />
			<circle cx="135" cy="136" r="2" fill="white" />
			<circle cx="181" cy="136" r="2" fill="white" />
		{:else}
			<!-- Normal eyes -->
			<circle cx="137" cy="138" r="5.5" fill="#5C4033" />
			<circle cx="183" cy="138" r="5.5" fill="#5C4033" />
			<circle cx="135.5" cy="136.5" r="1.5" fill="white" />
			<circle cx="181.5" cy="136.5" r="1.5" fill="white" />
		{/if}

		<!-- Blush -->
		<circle
			cx="120"
			cy="158"
			r="12"
			fill="#FFB6C1"
			opacity={blushOpacity}
			class="transition-opacity duration-500"
		/>
		<circle
			cx="200"
			cy="158"
			r="12"
			fill="#FFB6C1"
			opacity={blushOpacity}
			class="transition-opacity duration-500"
		/>

		<!-- Nose - clickable for boop -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<ellipse
			cx="160"
			cy="168"
			rx="12"
			ry="9"
			fill="#5C4033"
			class="cursor-pointer hover:fill-bear-dark transition-colors"
			on:click|stopPropagation={() => handleInteraction('nose_boop')}
		/>
		<!-- Nose shine -->
		<ellipse cx="157" cy="165" rx="4" ry="3" fill="#7D5A3C" opacity="0.5" />

		<!-- Mouth -->
		<path
			d={mouthPath}
			stroke="#5C4033"
			stroke-width="2.5"
			fill="none"
			stroke-linecap="round"
			class="transition-all duration-300"
		/>

		<!-- Body - clickable for hug -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<g
			class="cursor-pointer hover:brightness-105 transition-all"
			on:click={() => handleInteraction('hug')}
		>
			<ellipse cx="160" cy="275" rx="90" ry="85" fill="#D4A564" stroke="#B8903F" stroke-width="2" />
			<!-- Belly patch -->
			<ellipse cx="160" cy="275" rx="55" ry="50" fill="#E8C99B" />
		</g>

		<!-- Belly button area - clickable for belly rub -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<circle
			cx="160"
			cy="280"
			r="20"
			fill="transparent"
			class="cursor-pointer"
			on:click|stopPropagation={() => handleInteraction('belly_rub')}
		/>
		<!-- Belly swirl -->
		<path
			d="M 155,275 Q 160,265 165,275 Q 160,285 155,275"
			stroke="#C4935A"
			stroke-width="1.5"
			fill="none"
			opacity="0.4"
		/>

		<!-- Left arm -->
		<ellipse
			cx="80"
			cy="260"
			rx="30"
			ry="45"
			fill="#D4A564"
			stroke="#B8903F"
			stroke-width="2"
			transform="rotate(-15, 80, 260)"
		/>
		<!-- Left paw pad -->
		<ellipse cx="75" cy="285" rx="15" ry="12" fill="#E8C99B" transform="rotate(-15, 75, 285)" />

		<!-- Right arm -->
		<ellipse
			cx="240"
			cy="260"
			rx="30"
			ry="45"
			fill="#D4A564"
			stroke="#B8903F"
			stroke-width="2"
			transform="rotate(15, 240, 260)"
		/>
		<!-- Right paw pad -->
		<ellipse cx="245" cy="285" rx="15" ry="12" fill="#E8C99B" transform="rotate(15, 245, 285)" />

		<!-- Legs -->
		<ellipse cx="120" cy="345" rx="35" ry="28" fill="#D4A564" stroke="#B8903F" stroke-width="2" />
		<ellipse cx="120" cy="348" rx="20" ry="15" fill="#E8C99B" />
		<ellipse cx="200" cy="345" rx="35" ry="28" fill="#D4A564" stroke="#B8903F" stroke-width="2" />
		<ellipse cx="200" cy="348" rx="20" ry="15" fill="#E8C99B" />
	</svg>

	<!-- Interaction hint labels -->
	<div
		class="absolute top-[15%] left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
	>
		<span class="bg-bear-dark/70 text-white text-xs px-2 py-1 rounded-full font-poppins"
			>Pat my head!</span
		>
	</div>
</div>

<style>
	.bear-hug {
		animation: hug 1s ease-in-out;
	}

	.bear-sleepy {
		animation: sway 4s ease-in-out infinite;
	}

	.click-flash {
		filter: brightness(1.1);
	}

	@keyframes hug {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	@keyframes sway {
		0%,
		100% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(-2deg);
		}
		75% {
			transform: rotate(2deg);
		}
	}
</style>
