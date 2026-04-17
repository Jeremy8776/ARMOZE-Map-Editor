/**
 * Path Tools Module
 * Contains tools for drawing paths: Pen (anchors) and Freehand (drawing)
 */

class PenTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.drawingPoints = [];
        this.closeLoopHover = false;
    }

    onDown(mapPos, e) {
        // Handle snap
        const pos = this.core.snapToGrid(mapPos);

        // Check if closing the loop
        if (this.drawingPoints.length >= 3) {
            const startPoint = this.drawingPoints[0];
            // If click is near start point (within reasonable screen distance converted to map)
            const dist = Utils.distance(pos, startPoint);
            const threshold = 10 / this.core.zoom; // 10 pixels screen tolerance

            if (dist < threshold) {
                this.finishShape();
                return;
            }
        }

        this.drawingPoints.push(pos);
        this.core.requestRender();
    }

    onMove(mapPos) {
        // Handle snap for preview
        const pos = this.core.snapToGrid(mapPos);

        // Check hover over start point for closure hint
        if (this.drawingPoints.length >= 3) {
            const startPoint = this.drawingPoints[0];
            const dist = Utils.distance(pos, startPoint);
            const threshold = 10 / this.core.zoom;

            this.closeLoopHover = dist < threshold;
        } else {
            this.closeLoopHover = false;
        }

        this.core.requestRender();
    }

    onDoubleClick(mapPos) {
        this.finishShape();
    }

    finishShape() {
        // Remove points that are too close to each other (dedup double-click artifacts)
        let points = [...this.drawingPoints];

        // Filter out duplicate consecutive points
        if (points.length > 1) {
            points = points.filter((p, i) => {
                if (i === 0) return true;
                return Utils.distance(p, points[i - 1]) > 0.001;
            });
        }

        if (points.length >= 3) {
            this.manager.createZone('polygon', {
                type: 'polygon',
                points: points
            });
        }
        this.cancel();
    }

    cancel() {
        this.drawingPoints = [];
        this.closeLoopHover = false;
        this.core.requestRender();
    }
}

class FreehandTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.drawingPoints = [];
        this.isDrawing = false;
    }

    onDown(mapPos) {
        const pos = this.core.snapToGrid(mapPos);
        this.isDrawing = true;
        this.drawingPoints = [pos];
    }

    onMove(mapPos) {
        if (!this.isDrawing) return;
        const pos = this.core.snapToGrid(mapPos);

        // Add point if it's far enough from the last point (reduces jitter)
        const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
        const minDistance = 3 / this.core.zoom; // Minimum distance between points

        if (Utils.distance(lastPoint, pos) >= minDistance) {
            this.drawingPoints.push(pos);
        }
        this.core.requestRender();
    }

    onUp(mapPos) {
        if (this.drawingPoints.length >= 3) {
            // Simplify the path to reduce point count
            const simplifiedPoints = this.simplifyPath(this.drawingPoints, 2);

            this.manager.createZone('polygon', {
                type: 'polygon',
                points: simplifiedPoints
            });
        }
        this.cancel();
    }

    cancel() {
        this.isDrawing = false;
        this.drawingPoints = [];
        this.core.requestRender();
    }

    /**
     * Simplify a path using the Ramer-Douglas-Peucker algorithm
     */
    simplifyPath(points, tolerance) {
        if (points.length <= 2) return points;

        // Find the point with maximum distance from the line between first and last
        let maxDist = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.perpendicularDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        // If max distance is greater than tolerance, recursively simplify
        if (maxDist > tolerance) {
            const left = this.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        } else {
            return [first, last];
        }
    }

    /**
     * Calculate perpendicular distance from point to line
     */
    perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lineLengthSquared = dx * dx + dy * dy;

        if (lineLengthSquared === 0) {
            return Utils.distance(point, lineStart);
        }

        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared
        ));

        const projection = {
            x: lineStart.x + t * dx,
            y: lineStart.y + t * dy
        };

        return Utils.distance(point, projection);
    }
}

// Export for use in other modules
window.PenTool = PenTool;
window.FreehandTool = FreehandTool;
