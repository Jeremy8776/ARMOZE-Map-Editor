/**
 * Toolbar UI Module
 * (Drag functionality removed for stability)
 */
class ToolbarUI {
    constructor(app, toolbarElement) {
        this.app = app;
        this.element = toolbarElement;
        this.toolButtons = [];
    }

    init() {
        if (!this.element) return;

        this.toolButtons = Array.from(this.element.querySelectorAll('.tool-btn[data-tool]'));
        this.helpButton = this.element.querySelector('#btnShowHelp');
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const { tool } = btn.dataset;
                this.app.toolManager.setTool(tool);
                this.setActiveTool(tool);
            });
        });

        if (this.helpButton) {
            this.helpButton.addEventListener('click', () => this.app.openDocumentation());
        }

        this.setActiveTool(this.app.toolManager.currentTool || 'select');
    }

    setActiveTool(toolName) {
        this.toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });
    }
}

window.ToolbarUI = ToolbarUI;
