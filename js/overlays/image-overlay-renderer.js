/**
 * Image Overlay Renderer
 * Keeps image overlay draw and selection behavior isolated from zone rendering and label logic.
 */
class ImageOverlayRenderer {
    constructor(canvasCore, imageOverlayManager) {
        this.core = canvasCore;
        this.imageOverlayManager = imageOverlayManager;
        this.overlayRenderCache = new Map();
        this.maxCacheEntries = 250;
    }

    pruneCache() {
        while (this.overlayRenderCache.size > this.maxCacheEntries) {
            const oldestKey = this.overlayRenderCache.keys().next().value;
            this.overlayRenderCache.delete(oldestKey);
        }
    }

    getOverlayRenderAsset(overlay) {
        if (!overlay?.image) return null;
        if (overlay.sourceType === 'svg') {
            return overlay.image;
        }
        if (!overlay.tintEnabled || !overlay.tintColor) {
            return overlay.image;
        }

        const key = [
            overlay.src,
            overlay.tintEnabled ? '1' : '0',
            overlay.tintColor,
            overlay.tintMode || 'pixel',
            overlay.renderVersion || 0,
            overlay.naturalWidth || overlay.image.naturalWidth || overlay.image.width,
            overlay.naturalHeight || overlay.image.naturalHeight || overlay.image.height
        ].join('|');

        if (this.overlayRenderCache.has(key)) {
            return this.overlayRenderCache.get(key);
        }

        const width = overlay.naturalWidth || overlay.image.naturalWidth || overlay.image.width || 1;
        const height = overlay.naturalHeight || overlay.image.naturalHeight || overlay.image.height || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(overlay.image, 0, 0, canvas.width, canvas.height);

        if (overlay.tintMode === 'flat') {
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = overlay.tintColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            const tint = this.hexToRgb(overlay.tintColor);

            for (let index = 0; index < pixels.length; index += 4) {
                const alpha = pixels[index + 3];
                if (!alpha) continue;

                const luminance = (
                    (0.2126 * pixels[index]) +
                    (0.7152 * pixels[index + 1]) +
                    (0.0722 * pixels[index + 2])
                ) / 255;

                pixels[index] = Math.round(tint.r * luminance);
                pixels[index + 1] = Math.round(tint.g * luminance);
                pixels[index + 2] = Math.round(tint.b * luminance);
            }

            ctx.putImageData(imageData, 0, 0);
        }

        this.overlayRenderCache.set(key, canvas);
        this.pruneCache();
        return canvas;
    }

    hexToRgb(hex) {
        const normalized = (hex || '#ffffff').replace('#', '');
        const value = normalized.length === 3
            ? normalized.split('').map(char => char + char).join('')
            : normalized.padEnd(6, 'f');

        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16)
        };
    }

    drawImageOverlays(ctx = this.core.ctx, options = {}) {
        if (!this.imageOverlayManager) return;

        const overlays = this.imageOverlayManager.getOverlays();
        if (!overlays.length) return;
        const showEditorState = options.showEditorState !== false;

        ctx.save();
        if (!options.worldStatic) {
            ctx.translate(this.core.panX, this.core.panY);
            ctx.scale(this.core.zoom, this.core.zoom);
        }

        for (const overlay of overlays) {
            if (overlay.visible === false || !overlay.image) continue;
            const asset = this.getOverlayRenderAsset(overlay);
            if (!asset) continue;

            const centerX = overlay.x + overlay.width / 2;
            const centerY = overlay.y + overlay.height / 2;
            const rotation = ((overlay.rotation || 0) * Math.PI) / 180;

            ctx.save();
            ctx.globalAlpha = overlay.opacity !== undefined ? overlay.opacity : 1;
            ctx.translate(centerX, centerY);
            if (rotation) {
                ctx.rotate(rotation);
            }
            ctx.drawImage(asset, -overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);

            const isHovered = overlay.id === this.imageOverlayManager.hoveredOverlayId;
            const isSelected = overlay.id === this.imageOverlayManager.selectedOverlayId;
            if (showEditorState && (isHovered || isSelected)) {
                ctx.setLineDash(isSelected ? [] : [6 / (options.worldStatic ? 1 : this.core.zoom), 4 / (options.worldStatic ? 1 : this.core.zoom)]);
                ctx.strokeStyle = isSelected ? 'rgba(0, 255, 136, 0.95)' : 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = (isSelected ? 2 : 1.5) / (options.worldStatic ? 1 : this.core.zoom);
                ctx.strokeRect(-overlay.width / 2, -overlay.height / 2, overlay.width, overlay.height);
            }
            ctx.restore();
        }

        ctx.restore();
    }

    drawImageOverlaySelection() {
        const overlay = this.imageOverlayManager?.getSelectedOverlay();
        if (!overlay) return;

        const ctx = this.core.ctx;
        const handleSize = 8 / this.core.zoom;
        const handles = this.imageOverlayManager.getSelectionHandles(overlay);
        const rotationHandle = this.imageOverlayManager.getRotationHandle(overlay);
        const topMid = handles.length >= 2
            ? {
                x: (handles[0].x + handles[1].x) / 2,
                y: (handles[0].y + handles[1].y) / 2
            }
            : null;

        ctx.save();
        ctx.translate(this.core.panX, this.core.panY);
        ctx.scale(this.core.zoom, this.core.zoom);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / this.core.zoom;

        if (handles.length) {
            ctx.beginPath();
            ctx.moveTo(handles[0].x, handles[0].y);
            for (let index = 1; index < handles.length; index++) {
                ctx.lineTo(handles[index].x, handles[index].y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        if (rotationHandle && topMid) {
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.lineWidth = 1.5 / this.core.zoom;
            ctx.beginPath();
            ctx.moveTo(topMid.x, topMid.y);
            ctx.lineTo(rotationHandle.x, rotationHandle.y);
            ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 / this.core.zoom;

        for (const handle of handles) {
            ctx.beginPath();
            ctx.rect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        }

        if (rotationHandle) {
            ctx.beginPath();
            ctx.arc(rotationHandle.x, rotationHandle.y, handleSize * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }
}

window.ImageOverlayRenderer = ImageOverlayRenderer;
