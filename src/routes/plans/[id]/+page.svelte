<script lang="ts">
	import { page } from '$app/state';
	import TierView from '$lib/TierView.svelte';
	const id = $derived(Number(page.params.id));
</script>

<TierView tier="active" planId={id} />
