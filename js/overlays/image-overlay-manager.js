/**
 * Image Overlay Manager
 * Handles imported branding/logo overlays placed on the map canvas.
 */
class ImageOverlayManager {
    constructor(renderCallback) {
        this.requestRender = renderCallback;
        this.storageKey = 'mapOverlay_image_overlays';
        this.overlays = [];
        this.selectedOverlayId = null;
        this.hoveredOverlayId = null;

        this.onOverlayCreated = null;
        this.onOverlaySelected = null;
        this.onOverlayUpdated = null;
        this.onOverlayDeleted = null;

        this.setOverlays(this.loadFromStorage(), { persist: false, keepSelection: false });
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('Failed to load image overlays from local storage');
            return [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.serializeOverlays()));
        } catch (error) {
            console.warn('Failed to save image overlays to local storage');
        }
    }

    serializeOverlay(overlay) {
        if (!overlay) return null;

        return {
            id: overlay.id,
            name: overlay.name || this.getOverlayDisplayName(overlay),
            sourceName: overlay.sourceName || overlay.name || 'overlay',
            sourceType: overlay.sourceType || 'raster',
            visible: overlay.visible !== false,
            opacity: overlay.opacity !== undefined ? overlay.opacity : 1,
            tintEnabled: !!overlay.tintEnabled,
            tintColor: overlay.tintColor || '#ffffff',
            tintMode: overlay.tintMode || (overlay.sourceType === 'svg' ? 'vector' : 'pixel'),
            x: overlay.x || 0,
            y: overlay.y || 0,
            width: overlay.width || 0,
            height: overlay.height || 0,
            src: overlay.src || '',
            svgMarkupOriginal: overlay.svgMarkupOriginal || '',
            naturalWidth: overlay.naturalWidth || overlay.width || 0,
            naturalHeight: overlay.naturalHeight || overlay.height || 0,
            rotation: overlay.rotation || 0,
            renderVersion: overlay.renderVersion || 0
        };
    }

    serializeOverlays() {
        return this.overlays.map(overlay => this.serializeOverlay(overlay));
    }

    getOverlayDisplayName(overlay) {
        const baseName = overlay?.name || overlay?.sourceName || '';
        if (!baseName) return 'overlay';
        return baseName.replace(/\.[^.]+$/, '') || baseName;
    }

    buildOverlayAsset(overlay) {
        if (!overlay?.src) return;

        if (overlay.sourceType === 'svg' && overlay.svgMarkupOriginal) {
            const svgMarkup = ImageOverlayColorUtils.getSvgMarkupForOverlay(overlay);
            const image = new Image();
            const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
            const objectUrl = URL.createObjectURL(blob);

            image.onload = () => {
                overlay.image = image;
                if (!overlay.naturalWidth) overlay.naturalWidth = image.naturalWidth || overlay.width;
                if (!overlay.naturalHeight) overlay.naturalHeight = image.naturalHeight || overlay.height;
                URL.revokeObjectURL(objectUrl);
                this.requestRender();
            };
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
            };
            image.src = objectUrl;
            return;
        }

        const image = new Image();
        image.onload = () => {
            overlay.image = image;
            if (!overlay.naturalWidth) overlay.naturalWidth = image.naturalWidth || overlay.width;
            if (!overlay.naturalHeight) overlay.naturalHeight = image.naturalHeight || overlay.height;
            if (!overlay.tintEnabled && this.shouldRefreshLegacyTintColor(overlay)) {
                overlay.tintColor = ImageOverlayColorUtils.getDefaultOverlayTintColor(image, overlay);
                this.saveToStorage();
            }
            this.requestRender();
        };
        image.src = overlay.src;
    }

    shouldRefreshLegacyTintColor(overlay) {
        return !overlay?.tintEnabled && (!overlay?.tintColor || overlay.tintColor === '#00ff88');
    }
    normalizeOverlay(overlay) {
        const normalized = {
            ...this.serializeOverlay(overlay),
            image: null
        };

        if (this.shouldRefreshLegacyTintColor(overlay)) {
            const inferredColor = ImageOverlayColorUtils.getDefaultOverlayTintColor(overlay?.image, normalized);
            if (inferredColor) {
                normalized.tintColor = inferredColor;
            }
        }

        this.buildOverlayAsset(normalized);
        return normalized;
    }

    setOverlays(overlays = [], options = {}) {
        this.overlays = (Array.isArray(overlays) ? overlays : []).map(overlay => this.normalizeOverlay(overlay));

        if (!options.keepSelection || !this.getOverlay(this.selectedOverlayId)) {
            this.selectedOverlayId = null;
        }
        this.hoveredOverlayId = null;

        if (options.persist !== false) {
            this.saveToStorage();
        }
        this.requestRender();
    }

    getOverlays() {
        return this.overlays;
    }

    getOverlay(id) {
        return this.overlays.find(overlay => overlay.id === id);
    }

    getSelectedOverlay() {
        return this.getOverlay(this.selectedOverlayId);
    }

    hasOverlays() {
        return this.overlays.length > 0;
    }

    createOverlayFromImage(image, name, placement = {}, options = {}) {
        if (!image) return null;

        const naturalWidth = image.naturalWidth || image.width || 1;
        const naturalHeight = image.naturalHeight || image.height || 1;
        const mapWidth = this.core?.mapWidth || naturalWidth;
        const mapHeight = this.core?.mapHeight || naturalHeight;

        const maxWidth = mapWidth * 0.24;
        const maxHeight = mapHeight * 0.24;
        const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
        const width = Math.max(48, Math.round(naturalWidth * scale));
        const height = Math.max(48, Math.round(naturalHeight * scale));
        const x = placement.x ?? (mapWidth - width) / 2;
        const y = placement.y ?? (mapHeight - height) / 2;
        const initialTintColor = ImageOverlayColorUtils.getDefaultOverlayTintColor(image, options);

        const overlay = {
            id: Utils.generateId('overlay'),
            name: name || this.getOverlayDisplayName({ sourceName: options.sourceName || name || 'overlay' }),
            sourceName: options.sourceName || name || 'overlay',
            sourceType: options.sourceType || 'raster',
            visible: true,
            opacity: 1,
            tintEnabled: false,
            tintColor: initialTintColor,
            tintMode: options.tintMode || ((options.sourceType || 'raster') === 'svg' ? 'vector' : 'pixel'),
            rotation: 0,
            renderVersion: 0,
            x,
            y,
            width,
            height,
            src: image.src,
            svgMarkupOriginal: options.svgMarkupOriginal || '',
            naturalWidth,
            naturalHeight,
            image
        };

        this.overlays.push(overlay);
        if (overlay.sourceType === 'svg' && overlay.svgMarkupOriginal) {
            this.buildOverlayAsset(overlay);
        }
        this.selectOverlay(overlay.id, { render: false });

        if (this.onOverlayCreated) {
            this.onOverlayCreated(overlay, options);
        }

        if (options.persist !== false) {
            this.saveToStorage();
        }
        if (options.render !== false) {
            this.requestRender();
        }

        return overlay;
    }

    updateOverlay(id, updates, options = {}) {
        const index = this.overlays.findIndex(overlay => overlay.id === id);
        if (index === -1) return null;

        const currentOverlay = this.overlays[index];
        const nextOverlay = {
            ...currentOverlay,
            ...updates
        };

        const tintChanged =
            updates.tintEnabled !== undefined && updates.tintEnabled !== currentOverlay.tintEnabled ||
            updates.tintColor !== undefined && updates.tintColor !== currentOverlay.tintColor ||
            updates.tintMode !== undefined && updates.tintMode !== currentOverlay.tintMode;

        if (tintChanged) {
            nextOverlay.renderVersion = (currentOverlay.renderVersion || 0) + 1;
        }

        if (
            updates.src && updates.src !== currentOverlay.src ||
            nextOverlay.sourceType === 'svg' && (
                updates.svgMarkupOriginal !== undefined ||
                updates.tintEnabled !== undefined ||
                updates.tintColor !== undefined ||
                updates.tintMode !== undefined
            )
        ) {
            nextOverlay.image = null;
            this.buildOverlayAsset(nextOverlay);
        }

        this.overlays[index] = nextOverlay;

        if (this.onOverlayUpdated) {
            this.onOverlayUpdated(nextOverlay, options);
        }

        if (options.persist !== false) {
            this.saveToStorage();
        }
        if (options.render !== false) {
            this.requestRender();
        }

        return nextOverlay;
    }

    deleteOverlay(id, options = {}) {
        const index = this.overlays.findIndex(overlay => overlay.id === id);
        if (index === -1) return;

        this.overlays.splice(index, 1);
        if (this.selectedOverlayId === id) {
            this.selectedOverlayId = null;
            if (this.onOverlaySelected) {
                this.onOverlaySelected(null);
            }
        }

        if (this.onOverlayDeleted) {
            this.onOverlayDeleted(id, options);
        }

        if (options.persist !== false) {
            this.saveToStorage();
        }
        if (options.render !== false) {
            this.requestRender();
        }
    }

    selectOverlay(overlayId, options = {}) {
        this.selectedOverlayId = overlayId;
        const overlay = this.getSelectedOverlay();
        if (this.onOverlaySelected) {
            this.onOverlaySelected(overlay, options);
        }
        if (options.render !== false) {
            this.requestRender();
        }
    }

    setHoveredOverlay(overlayId) {
        if (this.hoveredOverlayId !== overlayId) {
            this.hoveredOverlayId = overlayId;
            this.requestRender();
            return true;
        }
        return false;
    }

    getOverlayBounds(overlay) {
        if (!overlay) return null;
        return {
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height
        };
    }

    getOverlayCenter(overlay) {
        if (!overlay) return null;
        return {
            x: overlay.x + overlay.width / 2,
            y: overlay.y + overlay.height / 2
        };
    }

    getOverlayRotationRadians(overlay) {
        return ((overlay?.rotation || 0) * Math.PI) / 180;
    }

    rotatePoint(point, center, angleRadians) {
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return {
            x: center.x + dx * cos - dy * sin,
            y: center.y + dx * sin + dy * cos
        };
    }

    getSelectionHandles(overlay) {
        const bounds = this.getOverlayBounds(overlay);
        if (!bounds) return [];
        const center = this.getOverlayCenter(overlay);
        const rotation = this.getOverlayRotationRadians(overlay);

        return [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ].map(point => this.rotatePoint(point, center, rotation));
    }

    getRotationHandle(overlay) {
        if (!overlay) return null;
        const center = this.getOverlayCenter(overlay);
        const rotation = this.getOverlayRotationRadians(overlay);
        const offset = Math.max(28, Math.min(52, overlay.height * 0.18));
        const topCenter = {
            x: overlay.x + overlay.width / 2,
            y: overlay.y - offset
        };
        return this.rotatePoint(topCenter, center, rotation);
    }

    toOverlayLocalPoint(point, overlay, options = {}) {
        if (!overlay || !point) return null;
        const center = options.center || this.getOverlayCenter(overlay);
        const rotation = options.rotationRadians ?? this.getOverlayRotationRadians(overlay);
        return this.rotatePoint(point, center, -rotation);
    }

    findHandleAtPoint(point, zoom = 1) {
        const overlay = this.getSelectedOverlay();
        if (!overlay) return -1;

        const handleSize = 12 / zoom;
        const handles = this.getSelectionHandles(overlay);
        for (let index = 0; index < handles.length; index++) {
            const handle = handles[index];
            if (
                Math.abs(point.x - handle.x) < handleSize &&
                Math.abs(point.y - handle.y) < handleSize
            ) {
                return index;
            }
        }

        return -1;
    }

    findRotationHandleAtPoint(point, zoom = 1) {
        const overlay = this.getSelectedOverlay();
        if (!overlay) return false;

        const handle = this.getRotationHandle(overlay);
        if (!handle) return false;

        const hitRadius = 12 / zoom;
        return Math.abs(point.x - handle.x) < hitRadius && Math.abs(point.y - handle.y) < hitRadius;
    }

    findOverlayAtPoint(point) {
        for (let index = this.overlays.length - 1; index >= 0; index--) {
            const overlay = this.overlays[index];
            if (overlay.visible === false) continue;

            const localPoint = this.toOverlayLocalPoint(point, overlay);
            if (localPoint && Utils.pointInRect(localPoint, overlay)) {
                return overlay;
            }
        }

        return null;
    }

    hydrateCore(canvasCore) {
        this.core = canvasCore;
    }
}

window.ImageOverlayManager = ImageOverlayManager;
