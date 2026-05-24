<script lang="ts">
	import { Library } from '$lib/icons';

	let { data } = $props();

	const startUrl = $derived(`/api/auth/google/start?next=${encodeURIComponent(data.next)}`);
</script>

<svelte:head>
	<title>Sign in · Lists</title>
</svelte:head>

<div class="login-page">
	<div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
		<div class="mb-10 text-center">
			<div class="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-paper)]">
				<Library size={22} strokeWidth={1.4} class="text-[var(--color-emerald)]" />
			</div>
			<h1 class="font-display text-4xl leading-none text-[var(--color-text-bright)]">Lists</h1>
			<p class="mt-3 text-sm text-[var(--color-muted)]">
				Library · Shortlist · Active
			</p>
		</div>

		{#if data.error}
			<p
				class="mb-4 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_40%,var(--color-hairline))] bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] px-3 py-2 text-center text-xs text-[var(--color-text-bright)]"
			>
				{data.error === 'access_denied'
					? 'Sign-in was cancelled.'
					: data.error === 'oauth_failed'
						? 'Something went wrong with Google sign-in. Try again.'
						: `Sign-in error: ${data.error}`}
			</p>
		{/if}

		<a href={startUrl} class="google-btn">
			<svg viewBox="0 0 18 18" class="h-4 w-4" aria-hidden="true">
				<path
					fill="#4285F4"
					d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
				/>
				<path
					fill="#34A853"
					d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
				/>
				<path
					fill="#FBBC05"
					d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
				/>
				<path
					fill="#EA4335"
					d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
				/>
			</svg>
			<span>Sign in with Google</span>
		</a>

		<p class="mt-8 text-center text-[11px] leading-relaxed text-[var(--color-faint)]">
			We only use your email to identify your account. Your lists are private to you.
		</p>
	</div>
</div>

<style>
	.login-page {
		background:
			radial-gradient(ellipse 90% 50% at 50% -10%, #161a26 0%, transparent 60%),
			var(--color-ink);
		min-height: 100dvh;
	}
	.google-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 12px 16px;
		border-radius: 12px;
		border: 1px solid var(--color-hairline-strong);
		background: var(--color-paper);
		color: var(--color-text-bright);
		font-family: var(--font-display);
		font-variation-settings: 'wght' 540;
		font-size: 14px;
		letter-spacing: -0.01em;
		transition:
			background 180ms,
			border-color 180ms,
			transform 80ms;
	}
	.google-btn:hover {
		background: var(--color-paper-2);
		border-color: var(--color-emerald);
	}
	.google-btn:active {
		transform: scale(0.99);
	}
</style>
