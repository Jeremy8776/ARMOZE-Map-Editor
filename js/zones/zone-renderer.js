/**
 * Zone Renderer Module
 * Handles drawing zones, selection handles, and drawing previews
 */
class ZoneRenderer {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;
    }

    // Note: The render() method was removed as it was never used.
    // The application calls drawZones() and drawSelection() directly for more control.

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
            if (this.core.zoom > 0.3) {
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

        const spacing = Math.max(5, 50 - (patternDensity * 0.4));

        // Dots: simple repeating tile, rotation via setTransform.
        if (type === 'dots') {
            const size = Math.max(6, Math.ceil(spacing));
            const pCanvas = document.createElement('canvas');
            pCanvas.width = size;
            pCanvas.height = size;
            const pCtx = pCanvas.getContext('2d');
            pCtx.fillStyle = Utils.hexToRgba(color, opacity);
            pCtx.beginPath();
            pCtx.arc(size / 2, size / 2, patternThickness, 0, Math.PI * 2);
            pCtx.fill();
            const pattern = ctx.createPattern(pCanvas, 'repeat');
            if (patternAngle !== 0 && pattern) {
                pattern.setTransform(new DOMMatrix().rotate(patternAngle));
            }
            return pattern;
        }

        // Line patterns: draw axis-aligned lines inside a tile sized to an
        // exact integer multiple of spacing, so the tile tiles seamlessly.
        // Rotation is applied via pattern.setTransform on the final pattern —
        // this rotates the whole seamless field, so continuous lines stay
        // continuous at any angle.
        const baseAngleMap = {
            'diagonal_right': -45,  // /
            'diagonal_left':   45,  // \
            'vertical':         0,
            'horizontal':      90,
            'grid':             0,  // horizontal + vertical lines
            'crosshatch':      45,  // horizontal + vertical, rotated 45
        };
        const baseAngle = baseAngleMap[type] ?? 0;
        const drawCross = (type === 'grid' || type === 'crosshatch');

        const tileLines = 4;
        const size = Math.round(spacing * tileLines);

        const pCanvas = document.createElement('canvas');
        pCanvas.width = size;
        pCanvas.height = size;
        const pCtx = pCanvas.getContext('2d');

        pCtx.strokeStyle = Utils.hexToRgba(color, opacity);
        pCtx.lineWidth = patternThickness;
        pCtx.lineCap = 'butt';

        pCtx.beginPath();
        // Horizontal lines — span full tile width so they continue seamlessly
        // across the left/right wrap. Offset by spacing/2 so they don't sit on
        // the top/bottom wrap seam (avoids half-line clipping at edges).
        for (let i = 0; i < tileLines; i++) {
            const y = i * spacing + spacing / 2;
            pCtx.moveTo(0, y);
            pCtx.lineTo(size, y);
        }
        if (drawCross) {
            for (let i = 0; i < tileLines; i++) {
                const x = i * spacing + spacing / 2;
                pCtx.moveTo(x, 0);
                pCtx.lineTo(x, size);
            }
        }
        pCtx.stroke();

        const pattern = ctx.createPattern(pCanvas, 'repeat');
        const totalAngle = baseAngle + patternAngle;
        if (totalAngle !== 0 && pattern) {
            pattern.setTransform(new DOMMatrix().rotate(totalAngle));
        }
        return pattern;
    }

    drawZoneLabel(zone, ctx = this.core.ctx, options = {}) {
        if (zone.showLabel === false) return;

        const mode = this.getActiveLabelMode(zone);
        if (mode === 'pattern_checker') {
            this.drawPatternIntegratedLabel(zone, ctx, options);
            return;
        }

        if (mode === 'border_repeat' || mode === 'border_dash_alt') {
            this.drawBorderIntegratedLabel(zone, mode, ctx, options);
            return;
        }

        const layout = this.getLabelLayout(zone, ctx, options);
        if (!layout) return;
        this.drawFloatingLabel(zone, layout, ctx, options);
    }

    getZoneCenter(zone) {
        if (zone.shape === 'circle') {
            return { x: zone.cx, y: zone.cy };
        }
        if (zone.shape === 'rectangle') {
            return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
        }
        if (zone.shape === 'line') {
            return { x: (zone.x1 + zone.x2) / 2, y: (zone.y1 + zone.y2) / 2 };
        }
        if (zone.points?.length) {
            const bounds = Utils.getPolygonBounds(zone.points);
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        }
        return null;
    }

    getBaseLabelFontSize(zone) {
        const explicitFontSize = parseInt(zone?.labelFontSize, 10);
        if (Number.isFinite(explicitFontSize)) {
            return explicitFontSize;
        }

        let baseFontSize;
        switch (zone.labelSize) {
            case 'small': baseFontSize = Constants?.LABEL_SIZE_SMALL || 10; break;
            case 'large': baseFontSize = Constants?.LABEL_SIZE_LARGE || 18; break;
            default: baseFontSize = Constants?.LABEL_SIZE_MEDIUM || 14; break;
        }
        return baseFontSize;
    }

    getLabelFontSize(zone, options = {}) {
        const baseFontSize = this.getBaseLabelFontSize(zone);
        if (options.worldStatic) {
            return baseFontSize;
        }
        return Math.max(
            baseFontSize / this.core.zoom,
            baseFontSize * (Constants?.LABEL_MIN_SIZE_RATIO || 0.7)
        );
    }

    getLabelFontFamily(zone) {
        switch (zone.labelFontFamily) {
            case 'mono':
                return '"Share Tech Mono", monospace';
            case 'system':
                return '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
            default:
                return 'Rajdhani, sans-serif';
        }
    }

    getLabelFontString(zone, options = {}) {
        const fontSize = this.getLabelFontSize(zone, options);
        const fontStyle = zone.labelItalic ? 'italic ' : '';
        const fontWeight = zone.labelBold ? '700' : '600';
        const fontFamily = this.getLabelFontFamily(zone);
        return `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
    }

    getLabelText(zone) {
        return (zone.labelText || zone.name || '').trim();
    }

    getActiveLabelMode(zone) {
        if (zone.showLabel === false) return 'hidden';
        if (zone.patternLabelMode === 'checker_embed') return 'pattern_checker';
        if (zone.borderLabelMode === 'dash_alt') return 'border_dash_alt';
        if (zone.borderLabelMode === 'repeat') return 'border_repeat';
        return 'floating';
    }

    getZoneBounds(zone) {
        if (zone.shape === 'circle') {
            return {
                x: zone.cx - zone.radius,
                y: zone.cy - zone.radius,
                width: zone.radius * 2,
                height: zone.radius * 2
            };
        }
        if (zone.shape === 'rectangle') {
            return {
                x: zone.x,
                y: zone.y,
                width: zone.width,
                height: zone.height
            };
        }
        if (zone.shape === 'line') {
            return {
                x: Math.min(zone.x1, zone.x2),
                y: Math.min(zone.y1, zone.y2),
                width: Math.abs(zone.x2 - zone.x1),
                height: Math.abs(zone.y2 - zone.y1)
            };
        }
        if (zone.points?.length) {
            return Utils.getPolygonBounds(zone.points);
        }
        return null;
    }

    applyZonePath(ctx, zone) {
        ctx.beginPath();
        if (zone.shape === 'circle') {
            ctx.arc(zone.cx, zone.cy, zone.radius, 0, Math.PI * 2);
            return;
        }
        if (zone.shape === 'rectangle') {
            ctx.rect(zone.x, zone.y, zone.width, zone.height);
            return;
        }
        if (zone.shape === 'line') {
            ctx.moveTo(zone.x1, zone.y1);
            ctx.lineTo(zone.x2, zone.y2);
            return;
        }
        if (zone.points?.length) {
            ctx.moveTo(zone.points[0].x, zone.points[0].y);
            for (let i = 1; i < zone.points.length; i++) {
                ctx.lineTo(zone.points[i].x, zone.points[i].y);
            }
            ctx.closePath();
        }
    }

    getZoneSegments(zone) {
        if (zone.shape === 'rectangle') {
            return [
                { x1: zone.x, y1: zone.y, x2: zone.x + zone.width, y2: zone.y },
                { x1: zone.x + zone.width, y1: zone.y, x2: zone.x + zone.width, y2: zone.y + zone.height },
                { x1: zone.x + zone.width, y1: zone.y + zone.height, x2: zone.x, y2: zone.y + zone.height },
                { x1: zone.x, y1: zone.y + zone.height, x2: zone.x, y2: zone.y }
            ];
        }

        if (zone.shape === 'line') {
            return [{ x1: zone.x1, y1: zone.y1, x2: zone.x2, y2: zone.y2 }];
        }

        if (zone.shape === 'circle') {
            const segments = [];
            const steps = 16;
            for (let i = 0; i < steps; i++) {
                const startAngle = (i / steps) * Math.PI * 2;
                const endAngle = ((i + 1) / steps) * Math.PI * 2;
                segments.push({
                    x1: zone.cx + Math.cos(startAngle) * zone.radius,
                    y1: zone.cy + Math.sin(startAngle) * zone.radius,
                    x2: zone.cx + Math.cos(endAngle) * zone.radius,
                    y2: zone.cy + Math.sin(endAngle) * zone.radius
                });
            }
            return segments;
        }

        if (zone.points?.length) {
            const segments = [];
            for (let i = 0; i < zone.points.length; i++) {
                const start = zone.points[i];
                const end = zone.points[(i + 1) % zone.points.length];
                segments.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
            }
            return segments;
        }

        return [];
    }

    getLabelLayout(zone, ctx = this.core.ctx, options = {}) {
        if (!zone || zone.showLabel === false) return null;

        const text = this.getLabelText(zone);
        if (!text) return null;

        const anchor = this.getZoneCenter(zone);
        if (!anchor) return null;

        const centerX = anchor.x + (zone.labelOffsetX || 0);
        const centerY = anchor.y + (zone.labelOffsetY || 0);
        const zoomFactor = options.worldStatic ? 1 : this.core.zoom;
        const fontSize = this.getLabelFontSize(zone, options);
        const padding = 4 / zoomFactor;
        const radius = 3 / zoomFactor;
        const bgOpacity = zone.labelBgOpacity !== undefined ? zone.labelBgOpacity : 0.7;
        const bgColor = zone.labelBgColor || '#000000';

        ctx.save();
        ctx.font = this.getLabelFontString(zone, options);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        ctx.restore();

        const textHeight = Math.max(
            fontSize,
            (metrics.actualBoundingBoxAscent || fontSize * 0.7) + (metrics.actualBoundingBoxDescent || fontSize * 0.3)
        );
        const bgWidth = metrics.width + padding * 2;
        const bgHeight = textHeight + padding * 2;

        return {
            centerX,
            centerY,
            anchorX: anchor.x,
            anchorY: anchor.y,
            boxX: centerX - bgWidth / 2,
            boxY: centerY - bgHeight / 2,
            bgWidth,
            bgHeight,
            text,
            fontSize,
            radius,
            bgOpacity,
            bgColor
        };
    }

    drawFloatingLabel(zone, layout, ctx = this.core.ctx, options = {}) {
        const zoomFactor = options.worldStatic ? 1 : this.core.zoom;
        ctx.font = this.getLabelFontString(zone, options);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (layout.bgOpacity > 0) {
            ctx.fillStyle = Utils.hexToRgba(layout.bgColor, layout.bgOpacity);
            this.roundRect(ctx, layout.boxX, layout.boxY, layout.bgWidth, layout.bgHeight, layout.radius);
            ctx.fill();
        }

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4 / zoomFactor;
            ctx.shadowOffsetX = 1 / zoomFactor;
            ctx.shadowOffsetY = 1 / zoomFactor;
        }

        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1);
        ctx.fillText(layout.text, layout.centerX, layout.centerY);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    getPatternLabelRotation(zone) {
        if (zone.patternAngle) {
            return (zone.patternAngle * Math.PI) / 180;
        }
        if (zone.fillPattern === 'diagonal_right') return -Math.PI / 4;
        if (zone.fillPattern === 'diagonal_left') return Math.PI / 4;
        return 0;
    }

    drawPatternIntegratedLabel(zone, ctx = this.core.ctx, options = {}) {
        const text = this.getLabelText(zone);
        if (!text) return;

        const bounds = this.getZoneBounds(zone);
        if (!bounds) return;

        const renderOptions = { ...options, worldStatic: true };
        const fontSize = this.getLabelFontSize(zone, renderOptions);
        ctx.save();
        this.applyZonePath(ctx, zone);
        ctx.clip();
        ctx.font = this.getLabelFontString(zone, renderOptions);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        const spacingX = metrics.width + 44;
        const spacingY = fontSize * 2.4;
        const rotation = this.getPatternLabelRotation(zone);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const alpha = Math.min(0.55, 0.18 + ((zone.fillOpacity ?? zone.opacity ?? 0.4) * 0.5));

        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            ctx.shadowBlur = 2;
        }

        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || '#ffffff', alpha * (zone.labelOpacity ?? 1));
        let rowIndex = 0;
        for (let y = bounds.y - spacingY; y <= bounds.y + bounds.height + spacingY; y += spacingY) {
            const offsetX = rowIndex % 2 === 0 ? 0 : spacingX / 2;
            for (let x = bounds.x - spacingX; x <= bounds.x + bounds.width + spacingX; x += spacingX) {
                ctx.fillText(text, x + offsetX, y);
            }
            rowIndex++;
        }

        ctx.restore();
    }

    drawTextOnSegment(ctx, text, segment, distanceAlong, zone, options = {}) {
        options = options || {};

        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const length = Math.hypot(dx, dy);
        if (!length) return;

        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
            angle += Math.PI;
        }

        const ux = dx / length;
        const uy = dy / length;
        let px = segment.x1 + ux * distanceAlong;
        let py = segment.y1 + uy * distanceAlong;

        if (options.lineOffset) {
            const normalA = { x: -uy, y: ux };
            const normalB = { x: uy, y: -ux };
            let chosenNormal = normalA;

            if (options.offsetMode === 'outside') {
                const zoneCenter = this.getZoneCenter(zone);
                if (zoneCenter) {
                    const midpoint = {
                        x: (segment.x1 + segment.x2) / 2,
                        y: (segment.y1 + segment.y2) / 2
                    };
                    const toCenter = {
                        x: zoneCenter.x - midpoint.x,
                        y: zoneCenter.y - midpoint.y
                    };
                    const dotA = (normalA.x * toCenter.x) + (normalA.y * toCenter.y);
                    const dotB = (normalB.x * toCenter.x) + (normalB.y * toCenter.y);
                    chosenNormal = dotA < dotB ? normalA : normalB;
                }
            }

            px += chosenNormal.x * options.lineOffset;
            py += chosenNormal.y * options.lineOffset;
        }

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        if (options.drawToken) {
            const tokenPaddingX = options.paddingX ?? 7;
            const tokenPaddingY = options.paddingY ?? 3;
            const tokenFontSize = options.fontSize ?? this.getBaseLabelFontSize(zone);
            const tokenHeight = options.height || tokenFontSize + tokenPaddingY * 2;
            const tokenWidth = options.width;
            const tokenRadius = options.radius ?? 4;

            ctx.fillStyle = options.tokenFill || Utils.hexToRgba(zone.color || '#00ff88', zone.borderOpacity ?? 0.95);
            this.roundRect(
                ctx,
                -tokenWidth / 2,
                -tokenHeight / 2,
                tokenWidth,
                tokenHeight,
                tokenRadius
            );
            ctx.fill();

            if (options.tokenStroke) {
                ctx.strokeStyle = options.tokenStroke;
                ctx.lineWidth = options.tokenStrokeWidth ?? 1;
                this.roundRect(
                    ctx,
                    -tokenWidth / 2,
                    -tokenHeight / 2,
                    tokenWidth,
                    tokenHeight,
                    tokenRadius
                );
                ctx.stroke();
            }

            ctx.fillStyle = options.textColor || '#ffffff';
        }
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    drawBorderIntegratedLabel(zone, mode, ctx = this.core.ctx, options = {}) {
        const text = this.getLabelText(zone);
        if (!text) return;

        const segments = this.getZoneSegments(zone);
        if (!segments.length) return;

        const renderOptions = { ...options, worldStatic: true };
        const borderWidth = zone.borderWidth || 3;
        const dashLength = zone.style === 'dotted' ? borderWidth * 1.5 : borderWidth * 5;
        const dashGap = zone.style === 'dotted' ? borderWidth * 1.5 : borderWidth * 3;
        const fontSize = this.getLabelFontSize(zone, renderOptions);

        ctx.save();
        ctx.font = this.getLabelFontString(zone, renderOptions);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 3;
        }
        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || zone.color || '#ffffff', 0.9 * (zone.labelOpacity ?? 1));
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const tokenPaddingX = 8;
        const tokenPaddingY = 3;
        const tokenWidth = textWidth + tokenPaddingX * 2;
        const tokenHeight = fontSize + tokenPaddingY * 2;
        const textOutsideOffset = borderWidth + (fontSize * 0.8);
        const outsideOffset = borderWidth + (tokenHeight / 2) + 5;

        for (const segment of segments) {
            const segLength = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
            if (segLength < tokenWidth + 12) continue;

            const placements = [];
            if (mode === 'border_dash_alt') {
                const labelDashLength = Math.max(dashLength, tokenWidth + 10);
                const plainDashLength = Math.max(dashLength, Math.min(labelDashLength * 0.7, tokenWidth * 0.75));
                const cycleLength = labelDashLength + dashGap + plainDashLength + dashGap;
                for (let distance = (labelDashLength / 2) + 4; distance <= segLength - (labelDashLength / 2) - 4; distance += cycleLength) {
                    placements.push(distance);
                }
            } else {
                const interval = tokenWidth + Math.max(26, dashGap * 1.2);
                for (let distance = tokenWidth / 2 + 8; distance < segLength - tokenWidth / 2; distance += interval) {
                    placements.push(distance);
                }
                if (!placements.length) {
                    placements.push(segLength / 2);
                }
            }

            for (const distance of placements) {
                this.drawTextOnSegment(ctx, text, segment, distance, zone, mode === 'border_dash_alt'
                    ? {
                        drawToken: true,
                        width: tokenWidth,
                        height: tokenHeight,
                        fontSize: fontSize,
                        paddingX: tokenPaddingX,
                        paddingY: tokenPaddingY,
                        lineOffset: outsideOffset,
                        offsetMode: 'outside',
                        tokenFill: Utils.hexToRgba(zone.color || '#00ff88', zone.borderOpacity ?? 0.95),
                        tokenStroke: Utils.hexToRgba(zone.color || '#00ff88', 1),
                        tokenStrokeWidth: 1,
                        textColor: Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1)
                    }
                    : {
                        lineOffset: textOutsideOffset,
                        offsetMode: 'outside'
                    });
            }
        }

        ctx.restore();
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
        if (!preview) return;

        const ctx = this.core.ctx;
        const guideColor = '#ffe66d';
        const accentColor = '#00ff88';

        ctx.save();
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.shadowColor = 'rgba(255, 230, 109, 0.35)';
        ctx.shadowBlur = 10;

        for (const x of preview.verticals || []) {
            const screen = this.core.mapToScreen(x, 0);
            ctx.beginPath();
            ctx.moveTo(screen.x, 0);
            ctx.lineTo(screen.x, this.core.canvas.height);
            ctx.stroke();
        }

        for (const y of preview.horizontals || []) {
            const screen = this.core.mapToScreen(0, y);
            ctx.beginPath();
            ctx.moveTo(0, screen.y);
            ctx.lineTo(this.core.canvas.width, screen.y);
            ctx.stroke();
        }

        if (preview.anchor) {
            const anchor = this.core.mapToScreen(preview.anchor.x, preview.anchor.y);
            ctx.setLineDash([]);
            ctx.fillStyle = accentColor;
            ctx.shadowColor = 'rgba(0, 255, 136, 0.45)';
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = guideColor;
            ctx.beginPath();
            ctx.arc(anchor.x, anchor.y, 11, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();

        this.drawSnapBadge(preview);

        if (!preview.edgeSegments?.length) return;

        ctx.save();
        ctx.translate(this.core.panX, this.core.panY);
        ctx.scale(this.core.zoom, this.core.zoom);
        ctx.setLineDash([]);
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 5 / this.core.zoom;
        ctx.shadowColor = 'rgba(255, 230, 109, 0.35)';
        ctx.shadowBlur = 18 / this.core.zoom;

        for (const segment of preview.edgeSegments) {
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawSnapBadge(preview) {
        if (!preview.anchor) return;

        const ctx = this.core.ctx;
        const anchor = this.core.mapToScreen(preview.anchor.x, preview.anchor.y);
        const badgeText = `X ${Math.round(preview.anchor.x)}  Y ${Math.round(preview.anchor.y)}`;

        ctx.save();
        ctx.font = '700 12px "Share Tech Mono", monospace';
        const metrics = ctx.measureText(badgeText);
        const width = metrics.width + 18;
        const height = 24;
        const x = anchor.x + 14;
        const y = anchor.y - 34;

        ctx.fillStyle = 'rgba(10, 12, 15, 0.92)';
        ctx.strokeStyle = 'rgba(255, 230, 109, 0.85)';
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe66d';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, x + 9, y + height / 2 + 0.5);
        ctx.restore();
    }

    /**
     * Draw the current shape being drawn by a tool
     */
    drawCurrentShape(tool, drawingPoints, tempShape, lastMousePos) {
        if (!tool) return;

        const ctx = this.core.ctx;
        ctx.save();
        ctx.translate(this.core.panX, this.core.panY);
        ctx.scale(this.core.zoom, this.core.zoom);

        ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / this.core.zoom;
        ctx.setLineDash([5 / this.core.zoom, 5 / this.core.zoom]);

        if (tempShape) {
            if (tempShape.type === 'rectangle') {
                ctx.beginPath();
                ctx.rect(tempShape.x, tempShape.y, tempShape.width, tempShape.height);
                ctx.fill();
                ctx.stroke();
            } else if (tempShape.type === 'circle') {
                ctx.beginPath();
                ctx.arc(tempShape.cx, tempShape.cy, tempShape.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (tempShape.type === 'line') {
                ctx.lineWidth = 3 / this.core.zoom;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(tempShape.x1, tempShape.y1);
                ctx.lineTo(tempShape.x2, tempShape.y2);
                ctx.stroke();

                // Draw endpoint dots
                ctx.setLineDash([]);
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(tempShape.x1, tempShape.y1, 4 / this.core.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tempShape.x2, tempShape.y2, 4 / this.core.zoom, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw pen path in progress
        if (tool === 'pen' && drawingPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) {
                ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            }
            // Line to current mouse position
            if (lastMousePos) {
                ctx.lineTo(lastMousePos.x, lastMousePos.y);
            }
            ctx.stroke();

            // Draw anchor points
            ctx.fillStyle = '#00ff88';
            ctx.setLineDash([]);
            for (let i = 0; i < drawingPoints.length; i++) {
                const point = drawingPoints[i];
                ctx.beginPath();

                // Highlight start point if hovering to close loop
                if (i === 0 && tool === 'pen' && tempShape && tempShape.closeLoopHover) {
                    ctx.fillStyle = '#ffff00';
                    ctx.arc(point.x, point.y, 8 / this.core.zoom, 0, Math.PI * 2);
                } else {
                    ctx.fillStyle = '#00ff88';
                    ctx.arc(point.x, point.y, 5 / this.core.zoom, 0, Math.PI * 2);
                }

                ctx.fill();
                // Add a border to make points more visible
                ctx.strokeStyle = '#0a0c0f';
                ctx.lineWidth = 1.5 / this.core.zoom;
                ctx.stroke();
            }
        }

        // Draw freehand in progress
        if (tool === 'freehand' && drawingPoints.length > 0) {
            ctx.setLineDash([]); // Solid line for freehand
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) {
                ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            }

            // Close the path to show it will form a shape
            if (drawingPoints.length > 2) {
                ctx.lineTo(drawingPoints[0].x, drawingPoints[0].y);
                ctx.fill();
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Export zones as transparent PNG overlay
     */
    exportAsImage(settings = {}) {
        if (!this.core.mapImage) return null;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.core.mapWidth;
        exportCanvas.height = this.core.mapHeight;
        const ctx = exportCanvas.getContext('2d');

        // Transparent background
        ctx.clearRect(0, 0, this.core.mapWidth, this.core.mapHeight);

        // Draw map if requested
        if (settings.includeMap) {
            ctx.drawImage(this.core.mapImage, 0, 0, this.core.mapWidth, this.core.mapHeight);
        }

        // Draw zones
        const zones = this.manager.getZones();
        for (const zone of zones) {
            if (!zone.visible) continue;
            
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
            
            ctx.fillStyle = fillStyle;
            ctx.strokeStyle = Utils.hexToRgba(zone.color, borderOp);
            ctx.lineWidth = bWidth;

            if (zone.style === 'dashed') {
                ctx.setLineDash([bWidth * 5, bWidth * 3]);
            } else if (zone.style === 'dotted') {
                ctx.setLineDash([bWidth * 1.5, bWidth * 1.5]);
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
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(zone.x1, zone.y1);
                ctx.lineTo(zone.x2, zone.y2);
                ctx.stroke();
                // Endpoints
                ctx.setLineDash([]);
                ctx.fillStyle = zone.color;
                ctx.beginPath();
                ctx.arc(zone.x1, zone.y1, 4, 0, Math.PI * 2);
                ctx.arc(zone.x2, zone.y2, 4, 0, Math.PI * 2);
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
        }

        ctx.setLineDash([]);
        for (const zone of zones) {
            if (!zone.visible) continue;
            this.drawZoneLabel(zone, ctx, { worldStatic: true });
        }

        return exportCanvas;
    }
}

// Export for use in other modules
window.ZoneRenderer = ZoneRenderer;
