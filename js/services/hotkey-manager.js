/**
 * Hotkey Manager Service
 * Centralized handling for keyboard shortcuts.
 */
class HotkeyManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        if (isTyping) return;

        // Command/Ctrl Shortcuts
        if (e.ctrlKey || e.metaKey) {
            // Let context menu handle copy/paste/duplicate if applicable
            if (this.app.contextMenu && this.app.contextMenu.handleKeyboard(e)) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) this.app.historyManager.redo();
                    else this.app.historyManager.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.app.historyManager.redo();
                    break;
                case 'e':
                    e.preventDefault();
                    this.app.showExportModal();
                    break;
                case 't':
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (this.app.extractorUI) this.app.extractorUI.show();
                    }
                    break;
            }
        } else {
            // Single Key Tool Shortcuts
            this.handleToolShortcuts(e);
        }
    }

    handleToolShortcuts(e) {
        const key = e.key.toLowerCase();
        let tool = null;

            switch (key) {
                case 'v': tool = 'select'; break;
                case 'r': tool = 'rectangle'; break;
                case 'c': tool = 'circle'; break;
                case 'l': tool = 'line'; break;
                case 'p': tool = 'pen'; break;
                case 'd': tool = 'freehand'; break;
                case '?':
                    e.preventDefault();
                    this.app.openDocumentation();
                    break;
                case 's': 
                    e.preventDefault();
                    this.app.elements.btnToggleSnap.click();
                    break;
                case 'f':
                    e.preventDefault();
                    this.app.core.fitToView();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    this.app.core.setZoom(0.1);
                    break;
                case '-':
                    e.preventDefault();
                    this.app.core.setZoom(-0.1);
                    break;
        }

        if (tool) {
            e.preventDefault();
            const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
            if (btn) btn.click();
        }
    }
}

window.HotkeyManager = HotkeyManager;
