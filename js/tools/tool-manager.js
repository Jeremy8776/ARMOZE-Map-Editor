/**
 * Tool Manager Module
 * Manages active tool state and delegates to specific tool implementations
 */
class ToolManager {
    constructor(canvasCore, zoneManager, imageOverlayManager = null) {
        this.core = canvasCore;
        this.zoneManager = zoneManager;
        this.imageOverlayManager = imageOverlayManager;
        this.currentTool = 'select';

        // Initialize tools
        this.tools = {
            select: new SelectTool(canvasCore, zoneManager, imageOverlayManager),
            rectangle: new RectangleTool(canvasCore, zoneManager),
            circle: new CircleTool(canvasCore, zoneManager),
            line: new LineTool(canvasCore, zoneManager),
            pen: new PenTool(canvasCore, zoneManager),
            freehand: new FreehandTool(canvasCore, zoneManager)
        };

        this.activeOperation = null;
    }

    setTool(toolName) {
        if (toolName !== 'pan' && !this.tools[toolName]) return;

        this.currentTool = toolName;

        // Update UI cursor
        this.core.container.className = 'canvas-container tool-' + toolName;

        // Reset state
        this.cancelOperation();
        this.core.requestRender();
    }

    getActiveTool() {
        return this.tools[this.currentTool] || null;
    }

    handleDown(mapPos, e) {
        const tool = this.getActiveTool();
        if (tool && tool.onDown) {
            tool.onDown(mapPos, e);
        }
    }

    handleMove(mapPos, e) {
        const tool = this.getActiveTool();
        if (tool && tool.onMove) {
            tool.onMove(mapPos, e);
        }
    }

    handleUp(mapPos, e) {
        const tool = this.getActiveTool();
        if (tool && tool.onUp) {
            tool.onUp(mapPos, e);
        }
    }

    handleDoubleClick(mapPos, e) {
        const tool = this.getActiveTool();
        if (tool && tool.onDoubleClick) {
            tool.onDoubleClick(mapPos, e);
        }
    }

    cancelOperation() {
        const tool = this.getActiveTool();
        if (tool && tool.cancel) {
            tool.cancel();
        }
        this.core.requestRender();
    }

    // Used by renderer to draw current tool state
    getCurrentDrawState() {
        const tool = this.getActiveTool();
        return {
            toolName: this.currentTool,
            points: tool?.drawingPoints || [],
            tempShape: tool?.tempShape || null,
            closeLoopHover: tool?.closeLoopHover || false,
            snapPreview: tool?.snapPreview || null
        };
    }
}

// Export for use in other modules
window.ToolManager = ToolManager;
