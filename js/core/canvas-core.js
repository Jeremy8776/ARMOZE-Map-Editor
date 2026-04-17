/**
 * Canvas Core Module
 * Handles canvas setup, view state, and coordinate systems
 */
class CanvasCore {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container;
        this.ctx = canvas.getContext('2d');

        // Map state
        this.mapImage = null;
        this.mapWidth = 0;
        this.mapHeight = 0;

        // View state
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 5;
        this.panX = 0;
        this.panY = 0;

        // Snapping state
        this.snapEnabled = false;
        this.gridSize = window.Constants?.SNAP_GRID_SIZE || 100; // Map units

        // Render callback
        this.onRender = null;
        this.onCoordsChanged = null;
        this.onZoomChanged = null;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.requestRender();
    }

    requestRender() {
        if (this.onRender) {
            this.onRender();
        }
    }

    /**
     * Load a map image
     */
    loadMap(image) {
        this.mapImage = image;
        this.mapWidth = image.width;
        this.mapHeight = image.height;

        // Fit map to view
        this.fitToView();

        // Show canvas
        this.canvas.classList.add('visible');

        this.requestRender();
    }

    /**
     * Fit map to container view
     */
    fitToView() {
        if (!this.mapImage) return;

        const containerWidth = this.canvas.width;
        const containerHeight = this.canvas.height;

        const scaleX = containerWidth / this.mapWidth;
        const scaleY = containerHeight / this.mapHeight;
        this.zoom = Math.min(scaleX, scaleY) * 0.9;

        // Center the map
        this.panX = (containerWidth - this.mapWidth * this.zoom) / 2;
        this.panY = (containerHeight - this.mapHeight * this.zoom) / 2;

        if (this.onZoomChanged) {
            this.onZoomChanged(Math.round(this.zoom * 100));
        }
        this.requestRender();
    }

    /**
     * Zoom in/out
     */
    setZoom(delta, centerX = null, centerY = null) {
        if (!this.mapImage) return;

        const oldZoom = this.zoom;
        this.zoom = Utils.clamp(this.zoom * (1 + delta), this.minZoom, this.maxZoom);

        // Zoom toward cursor position
        if (centerX !== null && centerY !== null) {
            const zoomRatio = this.zoom / oldZoom;
            this.panX = centerX - (centerX - this.panX) * zoomRatio;
            this.panY = centerY - (centerY - this.panY) * zoomRatio;
        }

        if (this.onZoomChanged) {
            this.onZoomChanged(Math.round(this.zoom * 100));
        }

        this.requestRender();
    }

    /**
     * Pan the view
     */
    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.requestRender();
    }

    /**
     * Convert screen coordinates to map coordinates
     */
    screenToMap(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }

    /**
     * Convert map coordinates to screen coordinates
     */
    mapToScreen(mapX, mapY) {
        return {
            x: mapX * this.zoom + this.panX,
            y: mapY * this.zoom + this.panY
        };
    }

    /**
     * Snap a point to the nearest grid intersection if snapping is enabled
     */
    snapToGrid(point) {
        if (!this.snapEnabled) return point;

        return {
            x: Math.round(point.x / this.gridSize) * this.gridSize,
            y: Math.round(point.y / this.gridSize) * this.gridSize
        };
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        return this.snapEnabled;
    }

    /**
     * Get mouse position relative to canvas
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Base render: Clears canvas and draws grid/map
     * Returns true if map is loaded
     */
    renderBase() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw map
        if (this.mapImage) {
            ctx.save();
            ctx.translate(this.panX, this.panY);
            ctx.scale(this.zoom, this.zoom);
            ctx.drawImage(this.mapImage, 0, 0);
            ctx.restore();
            if (this.snapEnabled) {
                this.drawGrid();
            }
            return true;
        }
        return false;
    }

    drawGrid() {
        const ctx = this.ctx;
        const mapGridSize = this.gridSize;
        const screenGridSize = mapGridSize * this.zoom;

        if (screenGridSize < 12) return;

        const startMapX = Math.floor((-this.panX / this.zoom) / mapGridSize) * mapGridSize;
        const endMapX = Math.ceil(((this.canvas.width - this.panX) / this.zoom) / mapGridSize) * mapGridSize;
        const startMapY = Math.floor((-this.panY / this.zoom) / mapGridSize) * mapGridSize;
        const endMapY = Math.ceil(((this.canvas.height - this.panY) / this.zoom) / mapGridSize) * mapGridSize;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 230, 109, 0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();

        for (let mapX = startMapX; mapX <= endMapX; mapX += mapGridSize) {
            const screenX = this.mapToScreen(mapX, 0).x;
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
        }

        for (let mapY = startMapY; mapY <= endMapY; mapY += mapGridSize) {
            const screenY = this.mapToScreen(0, mapY).y;
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
        }

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Update transform after external zoom/pan changes
     * Used when restoring tab state
     */
    updateTransform() {
        // Trigger a render to apply the new transform
        this.requestRender();
    }
}

// Export for use in other modules
window.CanvasCore = CanvasCore;
