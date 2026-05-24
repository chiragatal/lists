import { redirect, type ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = ({ locals, url }) => {
	if (locals.user) {
		const next = url.searchParams.get('next');
		throw redirect(303, next && next.startsWith('/') ? next : '/');
	}
	return {
		error: url.searchParams.get('error'),
		next: url.searchParams.get('next') ?? '/'
	};
};
