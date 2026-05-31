class UiState {
	settingsOpen = $state(false);

	openSettings() {
		this.settingsOpen = true;
	}
	closeSettings() {
		this.settingsOpen = false;
	}
}

export const ui = new UiState();
