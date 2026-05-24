// See https://svelte.dev/docs/kit/types#app.d.ts
import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			user: { id: string; email: string; name: string | null; picture: string | null } | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				SESSION_SECRET: string;
			};
		}
	}
}

export {};
