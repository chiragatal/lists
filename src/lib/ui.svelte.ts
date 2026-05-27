class UiState {
	menuOpen = $state(false);
	settingsOpen = $state(false);

	openMenu() {
		this.menuOpen = true;
	}
	closeMenu() {
		this.menuOpen = false;
	}
	openSettings() {
		this.menuOpen = false;
		this.settingsOpen = true;
	}
	closeSettings() {
		this.settingsOpen = false;
	}
}

export const ui = new UiState();
