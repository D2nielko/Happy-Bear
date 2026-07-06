<script lang="ts">
	export let data;
</script>

<svelte:head>
	<title>Transcript — Happy Bear</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-amber-800">
			Transcript <span class="text-sm font-normal text-amber-600">({data.session.mode})</span>
		</h1>
		<a href="/parent" class="text-sm text-amber-700 underline">all sessions</a>
	</header>

	<ol class="space-y-3">
		{#each data.turns as t}
			<li
				class={t.flagged
					? 'rounded-xl border-2 border-red-400 bg-red-50 p-3'
					: 'rounded-xl bg-amber-50 p-3'}
			>
				<div class="mb-1 flex items-center gap-2 text-xs text-amber-600">
					<span class="font-semibold uppercase">{t.role}</span>
					{#if t.move}<span class="rounded bg-amber-200 px-1.5 py-0.5">{t.move}</span>{/if}
					<span>{t.createdAt}</span>
					{#if t.flagged}
						<span class="rounded bg-red-200 px-1.5 py-0.5 font-semibold text-red-800"
							>flagged: {t.flagReason}</span
						>
					{/if}
				</div>
				<p class="text-amber-900">{t.content}</p>
			</li>
		{/each}
	</ol>
</div>
