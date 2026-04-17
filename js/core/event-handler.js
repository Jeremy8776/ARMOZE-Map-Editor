/**
 * Event Handler Module
 * Routes mouse and keyboard events to the appropriate managers
 */
class EventHandler {
    constructor(canvasCore, toolManager, zoneManager) {
        this.core = canvasCore;
        this.toolManager = toolManager;
        this.zoneManager = zoneManager;
        this.isPanning = false;
        this.dragStart = null;
        this.lastMousePos = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.core.canvas;
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onMouseDown(e) {
        e.preventDefault();
        const pos = this.core.getMousePos(e);
        const mapPos = this.core.screenToMap(pos.x, pos.y);

        // Check for space + click panning
        if (e.button === 1 || (e.button === 0 && this.toolManager.currentTool === 'pan')) {
            this.isPanning = true;
            this.dragStart = pos;
            return;
        }

        if (e.button !== 0) return;

        // Route to current tool
        this.toolManager.handleDown(mapPos, e);
    }

    onMouseMove(e) {
        if (this.isPanning) {
            e.preventDefault();
        }
        const pos = this.core.getMousePos(e);
        const mapPos = this.core.screenToMap(pos.x, pos.y);
        this.lastMousePos = mapPos;

        // Update coordinate display
        if (this.core.onCoordsChanged && mapPos.x >= 0 && mapPos.y >= 0 &&
            mapPos.x <= this.core.mapWidth && mapPos.y <= this.core.mapHeight) {
            this.core.onCoordsChanged(mapPos.x, mapPos.y);
        }

        // Handle panning
        if (this.isPanning && this.dragStart) {
            this.core.pan(
                pos.x - this.dragStart.x,
                pos.y - this.dragStart.y
            );
            this.dragStart = pos;
            return;
        }

        // Route to current tool
        this.toolManager.handleMove(mapPos, e);
    }

    onMouseUp(e) {
        e.preventDefault();
        if (this.isPanning) {
            this.isPanning = false;
            this.dragStart = null;
            return;
        }

        const pos = this.core.getMousePos(e);
        const mapPos = this.core.screenToMap(pos.x, pos.y);

        this.toolManager.handleUp(mapPos, e);
    }

    onMouseLeave(e) {
        this.isPanning = false;
        this.dragStart = null;
    }

    onWheel(e) {
        e.preventDefault();
        const pos = this.core.getMousePos(e);
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.core.setZoom(delta, pos.x, pos.y);
    }

    onDoubleClick(e) {
        const pos = this.core.getMousePos(e);
        const mapPos = this.core.screenToMap(pos.x, pos.y);
        this.toolManager.handleDoubleClick(mapPos, e);
    }

    onKeyDown(e) {
        // Check if user is typing in an input field - if so, skip most shortcuts
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        // Escape to cancel drawing or blur input
        if (e.key === 'Escape') {
            if (isTyping) {
                activeElement.blur();
            } else {
                this.toolManager.cancelOperation();
            }
            return;
        }

        // Skip all other shortcuts if typing
        if (isTyping) return;

        // Delete selected zone (only when not typing)
        // FIX: Save history before deleting to enable undo
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.zoneManager.selectedZoneId) {
            e.preventDefault();
            // Access app's history manager through the global app instance
            if (window.app && window.app.historyManager) {
                window.app.historyManager.saveHistory();
            }
            this.zoneManager.deleteZone(this.zoneManager.selectedZoneId);
            return;
        }

        // Keyboard shortcuts for tools
        if (!e.ctrlKey && !e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'v': this.toolManager.setTool('select'); break;
                case 'r': this.toolManager.setTool('rectangle'); break;
                case 'c': this.toolManager.setTool('circle'); break;
                case 'l': this.toolManager.setTool('line'); break;
                case 'p': this.toolManager.setTool('pen'); break;
                case 'd': this.toolManager.setTool('freehand'); break;
                case 's': this.core.toggleSnap(); break;
                case 'f': this.core.fitToView(); break;
                case '=':
                case '+': this.core.setZoom(0.1); break;
                case '-': this.core.setZoom(-0.1); break;
            }
        }
    }
}

// Export for use in other modules
window.EventHandler = EventHandler;
