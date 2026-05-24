export type Tier = 'library' | 'shortlist' | 'active';

export interface Item {
	id: number;
	name: string;
	category: string;
	tags: string[];
	notes?: string;
	completedAt?: number[];
	inShortlist: 0 | 1;
	inActive: 0 | 1;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
}
