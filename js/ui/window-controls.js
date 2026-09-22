/**
 * Window Controls
 * Custom minimize / maximize / close buttons for the frameless ARMOZE window,
 * styled to the app theme instead of the native Windows title bar.
 */
class WindowControls {
    static buildMarkup() {
        return `
            <div class="window-controls" role="group" aria-label="Window controls">
                <button type="button" class="window-control" id="btnWinMin" aria-label="Minimize window">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
                </button>
                <button type="button" class="window-control" id="btnWinMax" aria-label="Maximize or restore window">
                    <svg class="window-control-max-glyph" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="12" height="12" x="6" y="6" rx="1"/></svg>
                    <svg class="window-control-restore-glyph" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5H5v6"/><path d="M5 5l14 14"/><path d="M13 19h6v-6"/></svg>
                </button>
                <button type="button" class="window-control window-control--close" id="btnWinClose" aria-label="Close window">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>`;
    }

    constructor(app) {
        this.app = app;
        this.root = null;
        this.maximizeButton = null;
    }

    init() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        headerActions.insertAdjacentHTML('afterend', WindowControls.buildMarkup());
        this.root = document.querySelector('.window-controls');
        if (!this.root) return;

        this.maximizeButton = this.root.querySelector('#btnWinMax');

        document.getElementById('btnWinMin')?.addEventListener('click', () => {
            window.electronAPI?.windowMinimize?.();
        });
        document.getElementById('btnWinMax')?.addEventListener('click', () => {
            window.electronAPI?.windowMaximize?.();
        });
        document.getElementById('btnWinClose')?.addEventListener('click', () => {
            window.electronAPI?.windowClose?.();
        });

        this.syncMaximizeState();
    }

    /**
     * Reflect the maximized/restored state in the maximize glyph.
     * Called on init and on every window-state change from main.
     */
    syncMaximizeState(state) {
        if (!this.maximizeButton) return;
        if (typeof state !== 'string') {
            window.electronAPI?.windowIsMaximized?.().then(isMaximized => {
                this.applyMaximizeState(isMaximized);
            }).catch(() => {});
            return;
        }
        this.applyMaximizeState(state === 'maximized');
    }

    applyMaximizeState(isMaximized) {
        if (!this.maximizeButton) return;
        this.maximizeButton.classList.toggle('is-restored', !isMaximized);
        this.maximizeButton.setAttribute(
            'aria-label',
            isMaximized ? 'Restore window' : 'Maximize window'
        );
    }
}

window.WindowControls = WindowControls;