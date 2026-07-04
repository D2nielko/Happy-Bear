<script lang="ts">
	export let data;
</script>

<svelte:head>
	<title>Parent View — Happy Bear</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-amber-800">Parent view</h1>
		<a href="/tutor" class="text-sm text-amber-700 underline">back to tutor</a>
	</header>

	{#if data.sessions.length === 0}
		<p class="text-amber-700">No tutoring sessions yet.</p>
	{:else}
		<table class="w-full border-collapse text-left text-sm">
			<thead>
				<tr class="border-b border-amber-200 text-amber-600">
					<th class="py-2">Started</th>
					<th>Mode</th>
					<th>Turns</th>
					<th>Flagged</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.sessions as s}
					<tr class="border-b border-amber-100">
						<td class="py-2">{s.startedAt}</td>
						<td>{s.mode}</td>
						<td>{s.turnCount}</td>
						<td>
							{#if s.flaggedCount > 0}
								<span class="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-700"
									>{s.flaggedCount}</span
								>
							{:else}
								0
							{/if}
						</td>
						<td><a class="text-amber-700 underline" href={`/parent/${s.id}`}>transcript</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
