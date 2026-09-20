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
        this.renderScheduled = false;

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
        if (this.renderScheduled) return;

        this.renderScheduled = true;
        window.requestAnimationFrame(() => {
            this.renderScheduled = false;
            if (this.onRender) {
                this.onRender();
            }
        });
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

    clearMap() {
        this.mapImage = null;
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.canvas.classList.remove('visible');
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

        if (this.coordinateSystem) {
            const world = this.coordinateSystem.mapToWorld(point);
            const gridSize = this.getVisibleGridSize();
            return this.coordinateSystem.worldToMap({
                x: Math.round(world.x / gridSize) * gridSize,
                z: Math.round(world.z / gridSize) * gridSize
            });
        }

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

    getVisibleGridSize() {
        if (!this.coordinateSystem) return this.gridSize;
        const minorScreenSize = this.coordinateSystem.worldLengthToMap(this.gridSize) * this.zoom;
        const minimumMinorSpacing = window.Constants?.GRID_MINOR_MIN_SCREEN_PX || 18;
        return minorScreenSize >= minimumMinorSpacing
            ? this.gridSize
            : (window.Constants?.GRID_MAJOR_SIZE || 1000);
    }

    getGridColors() {
        const hexToRgba = (hex, alpha) => {
            const value = hex.replace('#', '');
            const full = value.length === 3
                ? value.split('').map(c => c + c).join('')
                : value.padEnd(8, 'f').slice(0, 8);
            const r = parseInt(full.slice(0, 2), 16);
            const g = parseInt(full.slice(2, 4), 16);
            const b = parseInt(full.slice(4, 6), 16);
            const a = value.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : alpha;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        };
        return {
            major: this.gridMajorColor ? hexToRgba(this.gridMajorColor, 0.5) : 'rgba(255, 230, 109, 0.42)',
            minor: this.gridMinorColor ? hexToRgba(this.gridMinorColor, 0.28) : 'rgba(255, 230, 109, 0.18)',
            label: this.gridLabelColor ? hexToRgba(this.gridLabelColor, 0.9) : 'rgba(255, 230, 109, 0.9)'
        };
    }

    setGridColors(colors = {}) {
        const isHexColor = value => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value);
        const updated = {};
        if (isHexColor(colors.major)) updated.gridMajorColor = colors.major;
        if (isHexColor(colors.minor)) updated.gridMinorColor = colors.minor;
        if (isHexColor(colors.label)) updated.gridLabelColor = colors.label;
        Object.assign(this, updated);
        try {
            localStorage.setItem('mapOverlay_grid_colors', JSON.stringify({
                major: this.gridMajorColor,
                minor: this.gridMinorColor,
                label: this.gridLabelColor
            }));
        } catch (error) {
            // Grid colour persistence is optional.
        }
        this.requestRender();
        return this.getGridColors();
    }

    loadGridColors() {
        try {
            const saved = JSON.parse(localStorage.getItem('mapOverlay_grid_colors') || 'null');
            if (saved) {
                if (saved.major) this.gridMajorColor = saved.major;
                if (saved.minor) this.gridMinorColor = saved.minor;
                if (saved.label) this.gridLabelColor = saved.label;
            }
        } catch (error) {
            // Ignore malformed saved colours.
        }
    }

    drawGrid() {
        const ctx = this.ctx;
        const visibleGridSize = this.getVisibleGridSize();
        const mapGridSize = this.coordinateSystem
            ? this.coordinateSystem.worldLengthToMap(visibleGridSize)
            : visibleGridSize;
        const screenGridSize = mapGridSize * this.zoom;

        if (screenGridSize < 8) return;

        const colors = this.getGridColors();
        const startMap = this.screenToMap(0, 0);
        const endMap = this.screenToMap(this.canvas.width, this.canvas.height);
        const startWorld = this.coordinateSystem?.mapToWorld(startMap);
        const endWorld = this.coordinateSystem?.mapToWorld(endMap);

        ctx.save();
        ctx.setLineDash([]);

        if (this.coordinateSystem) {
            const majorSize = window.Constants?.GRID_MAJOR_SIZE || 1000;
            const minX = Math.min(startWorld.x, endWorld.x);
            const maxX = Math.max(startWorld.x, endWorld.x);
            const minZ = Math.min(startWorld.z, endWorld.z);
            const maxZ = Math.max(startWorld.z, endWorld.z);
            const drawLine = (worldValue, vertical) => {
                const isMajor = Math.abs(worldValue / majorSize - Math.round(worldValue / majorSize)) < 0.000001;
                ctx.beginPath();
                ctx.strokeStyle = isMajor ? colors.major : colors.minor;
                ctx.lineWidth = isMajor ? 1.5 : 1;
                if (vertical) {
                    const mapX = this.coordinateSystem.worldToMap({ x: worldValue, z: 0 }).x;
                    const screenX = this.mapToScreen(mapX, 0).x;
                    ctx.moveTo(screenX, 0);
                    ctx.lineTo(screenX, this.canvas.height);
                } else {
                    const mapY = this.coordinateSystem.worldToMap({ x: 0, z: worldValue }).y;
                    const screenY = this.mapToScreen(0, mapY).y;
                    ctx.moveTo(0, screenY);
                    ctx.lineTo(this.canvas.width, screenY);
                }
                ctx.stroke();
            };

            for (let worldX = Math.floor(minX / visibleGridSize) * visibleGridSize; worldX <= maxX; worldX += visibleGridSize) {
                drawLine(worldX, true);
            }
            for (let worldZ = Math.floor(minZ / visibleGridSize) * visibleGridSize; worldZ <= maxZ; worldZ += visibleGridSize) {
                drawLine(worldZ, false);
            }

            const label = visibleGridSize === majorSize ? 'GRID 1 km' : 'GRID 100 m';
            ctx.font = '600 11px monospace';
            const labelWidth = ctx.measureText(label).width + 14;
            ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
            ctx.fillRect(10, this.canvas.height - 30, labelWidth, 20);
            ctx.fillStyle = colors.label;
            ctx.fillText(label, 17, this.canvas.height - 16);
        } else {
            const startMapX = Math.floor(startMap.x / mapGridSize) * mapGridSize;
            const endMapX = Math.ceil(endMap.x / mapGridSize) * mapGridSize;
            const startMapY = Math.floor(startMap.y / mapGridSize) * mapGridSize;
            const endMapY = Math.ceil(endMap.y / mapGridSize) * mapGridSize;

            ctx.beginPath();
            ctx.strokeStyle = colors.minor;
            ctx.lineWidth = 1;
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
        }

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
