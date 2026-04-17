/**
 * Shape Tools Module
 * Contains tools for drawing geometric shapes: Rectangle, Circle, Line
 */

class RectangleTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.drawingPoints = [];
        this.tempShape = null;
    }

    onDown(mapPos) {
        const pos = this.core.snapToGrid(mapPos);
        this.drawingPoints = [pos];
        this.tempShape = {
            type: 'rectangle',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0
        };
        this.core.requestRender();
    }

    onMove(mapPos) {
        if (this.drawingPoints.length > 0) {
            const pos = this.core.snapToGrid(mapPos);
            const start = this.drawingPoints[0];
            this.tempShape = {
                type: 'rectangle',
                x: Math.min(start.x, pos.x),
                y: Math.min(start.y, pos.y),
                width: Math.abs(pos.x - start.x),
                height: Math.abs(pos.y - start.y)
            };
            this.core.requestRender();
        }
    }

    onUp(mapPos) {
        if (this.tempShape && this.tempShape.width > 5 && this.tempShape.height > 5) {
            this.manager.createZone('rectangle', this.tempShape);
        }
        this.cancel();
    }

    cancel() {
        this.drawingPoints = [];
        this.tempShape = null;
    }
}

class CircleTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.drawingPoints = [];
        this.tempShape = null;
    }

    onDown(mapPos) {
        const pos = this.core.snapToGrid(mapPos);
        this.drawingPoints = [pos];
        this.tempShape = {
            type: 'circle',
            cx: pos.x,
            cy: pos.y,
            radius: 0
        };
        this.core.requestRender();
    }

    onMove(mapPos) {
        if (this.drawingPoints.length > 0) {
            const pos = this.core.snapToGrid(mapPos);
            const center = this.drawingPoints[0];
            this.tempShape = {
                type: 'circle',
                cx: center.x,
                cy: center.y,
                radius: Utils.distance(center, pos)
            };
            this.core.requestRender();
        }
    }

    onUp(mapPos) {
        if (this.tempShape && this.tempShape.radius > 5) {
            this.manager.createZone('circle', this.tempShape);
        }
        this.cancel();
    }

    cancel() {
        this.drawingPoints = [];
        this.tempShape = null;
    }
}

class LineTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.drawingPoints = [];
        this.tempShape = null;
    }

    onDown(mapPos) {
        const pos = this.core.snapToGrid(mapPos);
        this.drawingPoints = [pos];
        this.tempShape = {
            type: 'line',
            x1: pos.x,
            y1: pos.y,
            x2: pos.x,
            y2: pos.y
        };
        this.core.requestRender();
    }

    onMove(mapPos) {
        if (this.drawingPoints.length > 0) {
            const pos = this.core.snapToGrid(mapPos);
            const start = this.drawingPoints[0];
            this.tempShape = {
                type: 'line',
                x1: start.x,
                y1: start.y,
                x2: pos.x,
                y2: pos.y
            };
            this.core.requestRender();
        }
    }

    onUp(mapPos) {
        if (this.tempShape) {
            const length = Utils.distance(
                { x: this.tempShape.x1, y: this.tempShape.y1 },
                { x: this.tempShape.x2, y: this.tempShape.y2 }
            );

            if (length > 5) {
                // Create a line zone with two points
                this.manager.createZone('line', {
                    type: 'line',
                    points: [
                        { x: this.tempShape.x1, y: this.tempShape.y1 },
                        { x: this.tempShape.x2, y: this.tempShape.y2 }
                    ],
                    x1: this.tempShape.x1,
                    y1: this.tempShape.y1,
                    x2: this.tempShape.x2,
                    y2: this.tempShape.y2
                });
            }
        }
        this.cancel();
    }

    cancel() {
        this.drawingPoints = [];
        this.tempShape = null;
    }
}

// Export for use in other modules
window.RectangleTool = RectangleTool;
window.CircleTool = CircleTool;
window.LineTool = LineTool;
