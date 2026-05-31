import { redirect } from '@sveltejs/kit';

// Remember the last list the user opened and resume there when they visit
// `/`. The Home icon clears this key so going home is always possible.
export function load() {
	if (typeof localStorage === 'undefined') return;
	const v = localStorage.getItem('lists:lastList');
	if (v && /^\d+$/.test(v)) throw redirect(307, `/lists/${v}`);
}
