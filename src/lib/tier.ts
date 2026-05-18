import type { Tier } from './db';

export const TIERS: { id: Tier; label: string; subtitle: string; emptyHint: string }[] = [
	{
		id: 'active',
		label: 'Active',
		subtitle: 'What you are actually doing now.',
		emptyHint:
			'Nothing on the workbench yet. Promote items from your Shortlist when you decide to commit to them.'
	},
	{
		id: 'shortlist',
		label: 'Shortlist',
		subtitle: 'Things under consideration.',
		emptyHint:
			'Empty for now. Mark items in the Library to set aside what you might want to do soon.'
	},
	{
		id: 'library',
		label: 'Library',
		subtitle: 'Everything you might possibly do.',
		emptyHint:
			'Begin your library — anything you might do someday: recipes, films, books, projects, gifts.'
	}
];

export function tierMeta(tier: Tier) {
	return TIERS.find((t) => t.id === tier)!;
}

export function tierColorClass(tier: Tier): string {
	return tier === 'active' ? 'tier-active' : tier === 'shortlist' ? 'tier-shortlist' : 'tier-library';
}
