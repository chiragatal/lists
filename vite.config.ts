import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Lists',
				short_name: 'Lists',
				description: 'Library / Shortlist / Active — figure out what to do.',
				theme_color: '#0c0e13',
				background_color: '#0c0e13',
				display: 'standalone',
				start_url: '/',
				icons: [
					{ src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
					{ src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
					{ src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']
			}
		})
	]
});
