<div class="flex items-center gap-1 px-4 py-3">
	<span class="dot bg-bear-tan"></span>
	<span class="dot bg-bear-tan animation-delay-200"></span>
	<span class="dot bg-bear-tan animation-delay-400"></span>
</div>

<style>
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		animation: bounce 1.4s ease-in-out infinite;
	}

	.animation-delay-200 {
		animation-delay: 0.2s;
	}

	.animation-delay-400 {
		animation-delay: 0.4s;
	}

	@keyframes bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(-8px);
		}
	}
</style>
