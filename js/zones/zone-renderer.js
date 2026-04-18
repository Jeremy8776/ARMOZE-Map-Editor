/**
 * Zone Renderer Module
 * Handles drawing zones, selection handles, and drawing previews
 */
class ZoneRenderer {
    constructor(canvasCore, zoneManager, imageOverlayManager = null) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.imageOverlayManager = imageOverlayManager;
        this.patternTileCache = new Map();
        this.patternCache = new Map();
        this.textMetricsCache = new Map();
        this.maxCacheEntries = 250;
        this.overlayRenderer = new ImageOverlayRenderer(canvasCore, imageOverlayManager);
        this.labelRenderer = new ZoneLabelRenderer(
            canvasCore,
            (ctx, font, text) => this.getTextMetrics(ctx, font, text)
        );
        this.previewRenderer = new ZonePreviewRenderer(
            canvasCore,
            (ctx, font, text) => this.getTextMetrics(ctx, font, text)
        );
        this.exportRenderer = new ZoneExportRenderer(canvasCore, zoneManager, {
            createZonePattern: (...args) => this.createZonePattern(...args),
            drawZoneLabel: (...args) => this.drawZoneLabel(...args),
            drawImageOverlays: (...args) => this.drawImageOverlays(...args)
        });
    }

    // Note: The render() method was removed as it was never used.
    // The application calls drawZones() and drawSelection() directly for more control.

    pruneCache(cache) {
        while (cache.size > this.maxCacheEntries) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
    }

    getContextCacheKey(ctx) {
        return ctx === this.core.ctx ? 'main' : 'secondary';
    }

    getTextMetrics(ctx, font, text) {
        const key = `${this.getContextCacheKey(ctx)}|${font}|${text}`;
        if (this.textMetricsCache.has(key)) {
            return this.textMetricsCache.get(key);
        }

        ctx.save();
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        ctx.restore();

        const metricSummary = {
            width: metrics.width,
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent || 0,
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent || 0
        };

        this.textMetricsCache.set(key, metricSummary);
        this.pruneCache(this.textMetricsCache);
        return metricSummary;
    }

    getPatternTile(type, color, opacity, patternDensity = 20, patternThickness = 2) {
        const key = `${type}|${color}|${opacity}|${patternDensity}|${patternThickness}`;
        if (this.patternTileCache.has(key)) {
            return this.patternTileCache.get(key);
        }

        const spacing = Math.max(5, 50 - (patternDensity * 0.4));
        let tileCanvas = null;

        if (type === 'dots') {
            const size = Math.max(6, Math.ceil(spacing));
            tileCanvas = document.createElement('canvas');
            tileCanvas.width = size;
            tileCanvas.height = size;
            const tileContext = tileCanvas.getContext('2d');
            tileContext.fillStyle = Utils.hexToRgba(color, opacity);
            tileContext.beginPath();
            tileContext.arc(size / 2, size / 2, patternThickness, 0, Math.PI * 2);
            tileContext.fill();
        } else {
            const drawCross = (type === 'grid' || type === 'crosshatch');
            const tileLines = 4;
            const size = Math.round(spacing * tileLines);

            tileCanvas = document.createElement('canvas');
            tileCanvas.width = size;
            tileCanvas.height = size;
            const tileContext = tileCanvas.getContext('2d');

            tileContext.strokeStyle = Utils.hexToRgba(color, opacity);
            tileContext.lineWidth = patternThickness;
            tileContext.lineCap = 'butt';
            tileContext.beginPath();

            for (let i = 0; i < tileLines; i++) {
                const y = i * spacing + spacing / 2;
                tileContext.moveTo(0, y);
                tileContext.lineTo(size, y);
            }

            if (drawCross) {
                for (let i = 0; i < tileLines; i++) {
                    const x = i * spacing + spacing / 2;
                    tileContext.moveTo(x, 0);
                    tileContext.lineTo(x, size);
                }
            }

            tileContext.stroke();
        }

        this.patternTileCache.set(key, tileCanvas);
        this.pruneCache(this.patternTileCache);
        return tileCanvas;
    }

    drawImageOverlays(ctx = this.core.ctx, options = {}) {
        this.overlayRenderer.drawImageOverlays(ctx, options);
    }

    drawImageOverlaySelection() {
        this.overlayRenderer.drawImageOverlaySelection();
    }

    drawZones() {
        const ctx = this.core.ctx;
        const zones = this.manager.getZones();

        for (const zone of zones) {
            if (!zone.visible) continue;

            ctx.save();
            ctx.translate(this.core.panX, this.core.panY);
            ctx.scale(this.core.zoom, this.core.zoom);

            const fillOp = zone.fillOpacity !== undefined ? zone.fillOpacity : (zone.opacity || 0.4);
            const borderOp = zone.borderOpacity !== undefined ? zone.borderOpacity : 1.0;
            const bWidth = zone.borderWidth || 3;
            const pDensity = zone.patternDensity || 20;
            const pAngle = zone.patternAngle || 0;
            const pThick = zone.patternThickness || 2;

            let fillStyle;
            if (zone.fillPattern && zone.fillPattern !== 'solid') {
                fillStyle = this.createZonePattern(ctx, zone.fillPattern, zone.color, fillOp, pDensity, pAngle, pThick);
            }
            if (!fillStyle) {
                fillStyle = Utils.hexToRgba(zone.color, fillOp);
            }

            const strokeColor = Utils.hexToRgba(zone.color, borderOp);
            const isSelected = zone.id === this.manager.selectedZoneId;
            const isHovered = zone.id === this.manager.hoveredZoneId;

            ctx.fillStyle = fillStyle;
            ctx.strokeStyle = strokeColor;
            
            // Adjust line width with hover/selection multipliers
            let actualWidth = bWidth;
            if (isSelected) actualWidth += 2;
            else if (isHovered) actualWidth += 1;
            ctx.lineWidth = actualWidth / this.core.zoom;

            // Set line dash based on style
            if (zone.style === 'dashed') {
                ctx.setLineDash([(actualWidth * 5) / this.core.zoom, (actualWidth * 3) / this.core.zoom]);
            } else if (zone.style === 'dotted') {
                ctx.setLineDash([(actualWidth * 1.5) / this.core.zoom, (actualWidth * 1.5) / this.core.zoom]);
            } else {
                ctx.setLineDash([]);
            }

            if (zone.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(zone.cx, zone.cy, zone.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (zone.shape === 'rectangle') {
                ctx.beginPath();
                ctx.rect(zone.x, zone.y, zone.width, zone.height);
                ctx.fill();
                ctx.stroke();
            } else if (zone.shape === 'line') {
                ctx.lineWidth = (actualWidth + 2) / this.core.zoom;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(zone.x1, zone.y1);
                ctx.lineTo(zone.x2, zone.y2);
                ctx.stroke();

                // Draw endpoint circles
                ctx.setLineDash([]);
                ctx.fillStyle = strokeColor;
                ctx.beginPath();
                ctx.arc(zone.x1, zone.y1, (actualWidth + 1) / this.core.zoom, 0, Math.PI * 2);
                ctx.arc(zone.x2, zone.y2, (actualWidth + 1) / this.core.zoom, 0, Math.PI * 2);
                ctx.fill();
            } else if (zone.points && zone.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(zone.points[0].x, zone.points[0].y);
                for (let i = 1; i < zone.points.length; i++) {
                    ctx.lineTo(zone.points[i].x, zone.points[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            // Reset dash for labels
            ctx.setLineDash([]);

            // Draw zone label
            if (this.core.zoom > 0.0) {
                this.drawZoneLabel(zone);
            }

            ctx.restore();
        }
    }

    /**
     * Create a pattern for zone filling
     */
    createZonePattern(ctx, type, color, opacity, patternDensity = 20, patternAngle = 0, patternThickness = 2) {
        if (!type || type === 'solid') return null;

        const patternKey = `${this.getContextCacheKey(ctx)}|${type}|${color}|${opacity}|${patternDensity}|${patternAngle}|${patternThickness}`;
        if (ctx === this.core.ctx && this.patternCache.has(patternKey)) {
            return this.patternCache.get(patternKey);
        }
        
        const baseAngleMap = {
            'diagonal_right': -45,
            'diagonal_left':   45,
            'vertical':         0,
            'horizontal':      90,
            'grid':             0,
            'crosshatch':      45,
        };
        const baseAngle = baseAngleMap[type] ?? 0;
        const tileCanvas = this.getPatternTile(type, color, opacity, patternDensity, patternThickness);
        const pattern = ctx.createPattern(tileCanvas, 'repeat');
        const totalAngle = baseAngle + patternAngle;
        if (totalAngle !== 0 && pattern) {
            pattern.setTransform(new DOMMatrix().rotate(totalAngle));
        }
        if (ctx === this.core.ctx && pattern) {
            this.patternCache.set(patternKey, pattern);
            this.pruneCache(this.patternCache);
        }
        return pattern;
    }

    getActiveLabelMode(zone) {
        return this.labelRenderer.getActiveLabelMode(zone);
    }

    getLabelLayout(zone, ctx = this.core.ctx, options = {}) {
        return this.labelRenderer.getLabelLayout(zone, ctx, options);
    }

    drawZoneLabel(zone, ctx = this.core.ctx, options = {}) {
        this.labelRenderer.drawZoneLabel(zone, ctx, options);
    }

    /**
     * Draw a rounded rectangle
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    drawSelection() {
        if (this.imageOverlayManager?.selectedOverlayId) {
            this.drawImageOverlaySelection();
            return;
        }

        const selectedZoneId = this.manager.selectedZoneId;
        if (!selectedZoneId) return;

        const zone = this.manager.getZone(selectedZoneId);
        if (!zone) return;

        const ctx = this.core.ctx;
        ctx.save();
        ctx.translate(this.core.panX, this.core.panY);
        ctx.scale(this.core.zoom, this.core.zoom);

        // Selection handles are always solid
        ctx.setLineDash([]);

        const handleSize = 8 / this.core.zoom;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 / this.core.zoom;

        if (zone.shape === 'circle') {
            // Draw handles at cardinal points
            const handles = [
                { x: zone.cx + zone.radius, y: zone.cy },
                { x: zone.cx - zone.radius, y: zone.cy },
                { x: zone.cx, y: zone.cy + zone.radius },
                { x: zone.cx, y: zone.cy - zone.radius }
            ];

            for (const handle of handles) {
                ctx.beginPath();
                ctx.rect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
                ctx.fill();
                ctx.stroke();
            }
        } else if (zone.shape === 'rectangle') {
            // Draw handles at corners
            const handles = [
                { x: zone.x, y: zone.y },
                { x: zone.x + zone.width, y: zone.y },
                { x: zone.x + zone.width, y: zone.y + zone.height },
                { x: zone.x, y: zone.y + zone.height }
            ];

            for (const handle of handles) {
                ctx.beginPath();
                ctx.rect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
                ctx.fill();
                ctx.stroke();
            }
        } else if (zone.points) {
            // Draw handles at vertices
            for (const point of zone.points) {
                ctx.beginPath();
                ctx.rect(point.x - handleSize / 2, point.y - handleSize / 2, handleSize, handleSize);
                ctx.fill();
                ctx.stroke();
            }
        }

        if (zone.showLabel !== false && this.getActiveLabelMode(zone) === 'floating') {
            const labelLayout = this.getLabelLayout(zone, ctx);
            if (labelLayout) {
                ctx.save();
                ctx.setLineDash([6 / this.core.zoom, 4 / this.core.zoom]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 1.5 / this.core.zoom;

                if (Math.abs(labelLayout.centerX - labelLayout.anchorX) > 0.1 || Math.abs(labelLayout.centerY - labelLayout.anchorY) > 0.1) {
                    ctx.beginPath();
                    ctx.moveTo(labelLayout.anchorX, labelLayout.anchorY);
                    ctx.lineTo(labelLayout.centerX, labelLayout.centerY);
                    ctx.stroke();
                }

                this.roundRect(
                    ctx,
                    labelLayout.boxX - 2 / this.core.zoom,
                    labelLayout.boxY - 2 / this.core.zoom,
                    labelLayout.bgWidth + 4 / this.core.zoom,
                    labelLayout.bgHeight + 4 / this.core.zoom,
                    4 / this.core.zoom
                );
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(labelLayout.centerX, labelLayout.centerY, 3.5 / this.core.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.restore();
    }

    drawSnapPreview(preview) {
        this.previewRenderer.drawSnapPreview(preview);
    }

    drawSnapBadge(preview) {
        this.previewRenderer.drawSnapBadge(preview);
    }

    /**
     * Draw the current shape being drawn by a tool
     */
    drawCurrentShape(tool, drawingPoints, tempShape, lastMousePos) {
        this.previewRenderer.drawCurrentShape(tool, drawingPoints, tempShape, lastMousePos);
    }

    /**
     * Export zones as transparent PNG overlay
     */
    exportAsImage(settings = {}) {
        return this.exportRenderer.exportAsImage(settings);
    }
}

// Export for use in other modules
window.ZoneRenderer = ZoneRenderer;
