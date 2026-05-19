const KEY = 'lists:lastExportAt';
const STALE_DAYS = 14;

class BackupState {
	lastExportAt = $state<number | null>(null);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		const v = localStorage.getItem(KEY);
		this.lastExportAt = v ? Number(v) : null;
	}

	mark() {
		this.lastExportAt = Date.now();
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(KEY, String(this.lastExportAt));
		}
	}

	reset() {
		this.lastExportAt = null;
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(KEY);
		}
	}

	get daysSince(): number | null {
		if (!this.lastExportAt) return null;
		return (Date.now() - this.lastExportAt) / 86_400_000;
	}

	get stale(): boolean {
		const d = this.daysSince;
		return d === null || d >= STALE_DAYS;
	}
}

export const backup = new BackupState();

export async function requestPersistentStorage(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
	try {
		const already = await navigator.storage.persisted?.();
		if (already) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
