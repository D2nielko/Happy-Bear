<script lang="ts">
	export let role: 'user' | 'assistant';
	export let content: string;
</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
	{#if role === 'assistant'}
		<div class="flex items-end gap-2 max-w-[80%]">
			<div
				class="w-8 h-8 rounded-full bg-bear-tan flex items-center justify-center text-sm flex-shrink-0"
			>
				🧸
			</div>
			<div
				class="bg-white/80 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm border border-bear-light/50"
			>
				<p class="text-bear-dark text-sm font-poppins leading-relaxed">{content}</p>
			</div>
		</div>
	{:else}
		<div class="max-w-[80%]">
			<div class="bg-bear-tan/80 backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
				<p class="text-white text-sm font-poppins leading-relaxed">{content}</p>
			</div>
		</div>
	{/if}
</div>
