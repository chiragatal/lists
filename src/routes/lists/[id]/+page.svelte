<script lang="ts">
	import { page } from '$app/state';
	import { lists } from '$lib/lists.svelte';
	import TierView from '$lib/TierView.svelte';
	import ChecklistView from '$lib/ChecklistView.svelte';

	const id = $derived(Number(page.params.id));

	$effect(() => {
		lists.ensureDetail(id);
		if (typeof localStorage !== 'undefined' && Number.isFinite(id)) {
			localStorage.setItem('lists:lastList', String(id));
		}
	});

	const type = $derived(lists.current?.type);
</script>

{#if type === 'checklist'}
	<ChecklistView {id} />
{:else}
	<!-- Default to plan (Active tier) while loading or for plan lists. -->
	<TierView tier="active" planId={id} />
{/if}
