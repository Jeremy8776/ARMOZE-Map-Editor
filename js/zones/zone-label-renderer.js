/**
 * Zone Label Renderer
 * Keeps label layout and integrated border/pattern label behavior separate from the main zone renderer.
 */
class ZoneLabelRenderer {
    constructor(canvasCore, getTextMetrics) {
        this.core = canvasCore;
        this.getTextMetrics = getTextMetrics;
        this.labelUtils = new ZoneLabelUtils(canvasCore);
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
        return this.labelUtils.getZoneCenter(zone);
    }

    getBaseLabelFontSize(zone) {
        const explicitFontSize = parseInt(zone?.labelFontSize, 10);
        if (Number.isFinite(explicitFontSize)) {
            return explicitFontSize;
        }

        return this.labelUtils.getBaseLabelFontSize(zone);
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
        return this.labelUtils.getLabelFontFamily(zone);
    }

    getLabelFontString(zone, options = {}) {
        const fontSize = this.getLabelFontSize(zone, options);
        const fontStyle = zone.labelItalic ? 'italic ' : '';
        const fontWeight = zone.labelBold ? '700' : '600';
        const fontFamily = this.getLabelFontFamily(zone);
        return `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
    }

    getLabelText(zone) {
        return this.labelUtils.getLabelText(zone);
    }

    getActiveLabelMode(zone) {
        return this.labelUtils.getActiveLabelMode(zone);
    }

    getZoneBounds(zone) {
        return this.labelUtils.getZoneBounds(zone);
    }

    applyZonePath(ctx, zone) {
        this.labelUtils.applyZonePath(ctx, zone);
    }

    getZoneSegments(zone) {
        return this.labelUtils.getZoneSegments(zone);
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

        const font = this.getLabelFontString(zone, options);
        const metrics = this.getTextMetrics(ctx, font, text);

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

        ctx.save();
        ctx.translate(layout.centerX, layout.centerY);
        if (zone.labelRotation) {
            ctx.rotate((zone.labelRotation * Math.PI) / 180);
        }

        if (layout.bgOpacity > 0) {
            ctx.fillStyle = Utils.hexToRgba(layout.bgColor, layout.bgOpacity);
            this.roundRect(ctx, -layout.bgWidth / 2, -layout.bgHeight / 2, layout.bgWidth, layout.bgHeight, layout.radius);
            ctx.fill();
        }

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4 / zoomFactor;
            ctx.shadowOffsetX = 1 / zoomFactor;
            ctx.shadowOffsetY = 1 / zoomFactor;
        }

        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1);
        ctx.fillText(layout.text, 0, 0);
        ctx.restore();
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
        const font = this.getLabelFontString(zone, renderOptions);
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = this.getTextMetrics(ctx, font, text);
        const spacingX = metrics.width + 44;
        const spacingY = fontSize * 2.4;
        const rotation = (zone.labelRotation !== undefined) ? (zone.labelRotation * Math.PI) / 180 : this.getPatternLabelRotation(zone);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 3;
        }

        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1);
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
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const length = Math.hypot(dx, dy);
        if (!length) return;

        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle <= -Math.PI / 2) angle += Math.PI;

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

        const renderOptions = { ...options, worldStatic: true };
        const borderWidth = zone.borderWidth || 3;
        const fontSize = this.getLabelFontSize(zone, renderOptions);

        ctx.save();
        const font = this.getLabelFontString(zone, renderOptions);
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = this.getTextMetrics(ctx, font, text);
        const textWidth = metrics.width;
        const tokenPaddingX = 8;
        const tokenPaddingY = 3;
        const tokenWidth = textWidth + tokenPaddingX * 2;
        const tokenHeight = fontSize + tokenPaddingY * 2;
        const outsideOffset = borderWidth + (tokenHeight / 2) + 5;

        if (zone.shape === 'circle') {
            this.drawCircleBorderLabel(zone, text, mode, ctx, renderOptions, {
                tokenWidth, tokenHeight, outsideOffset, tokenPaddingX, tokenPaddingY, fontSize
            });
            ctx.restore();
            return;
        }

        const segments = this.getZoneSegments(zone);
        if (!segments.length) {
            ctx.restore();
            return;
        }

        const dashLength = zone.style === 'dotted' ? borderWidth * 1.5 : borderWidth * 5;
        const dashGap = zone.style === 'dotted' ? borderWidth * 1.5 : borderWidth * 3;

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 3;
        }

        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || zone.color || '#ffffff', 0.9 * (zone.labelOpacity ?? 1));

        for (const segment of segments) {
            const segLength = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
            const minSpace = zone.shape === 'circle' ? tokenWidth * 0.5 : tokenWidth + 12;
            if (segLength < minSpace) continue;

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
                this.drawTextOnSegment(ctx, text, segment, distance, zone, {
                    ...renderOptions,
                    lineOffset: outsideOffset,
                    offsetMode: 'outside',
                    drawToken: mode === 'border_dash_alt',
                    width: tokenWidth,
                    height: tokenHeight,
                    fontSize,
                    paddingX: tokenPaddingX,
                    paddingY: tokenPaddingY,
                    tokenFill: Utils.hexToRgba(zone.color || '#00ff88', zone.borderOpacity ?? 0.95),
                    tokenStroke: Utils.hexToRgba(zone.color || '#00ff88', 1),
                    tokenStrokeWidth: 1,
                    textColor: Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1)
                });
            }
        }

        ctx.restore();
    }

    drawCircleBorderLabel(zone, text, mode, ctx, renderOptions, metrics) {
        const circumference = 2 * Math.PI * zone.radius;
        const interval = metrics.tokenWidth + 40;
        const count = Math.max(1, Math.floor(circumference / interval));
        const angleStep = (Math.PI * 2) / count;

        if (zone.labelShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 3;
        }
        ctx.fillStyle = Utils.hexToRgba(zone.labelColor || zone.color || '#ffffff', 0.9 * (zone.labelOpacity ?? 1));

        for (let i = 0; i < count; i++) {
            const angle = i * angleStep;
            const px = zone.cx + Math.cos(angle) * zone.radius;
            const py = zone.cy + Math.sin(angle) * zone.radius;
            const tx = -Math.sin(angle);
            const ty = Math.cos(angle);
            const segment = {
                x1: px - tx * 10,
                y1: py - ty * 10,
                x2: px + tx * 10,
                y2: py + ty * 10
            };

            this.drawTextOnSegment(ctx, text, segment, 10, zone, {
                ...renderOptions,
                lineOffset: metrics.outsideOffset,
                offsetMode: 'outside',
                drawToken: mode === 'border_dash_alt',
                width: metrics.tokenWidth,
                height: metrics.tokenHeight,
                fontSize: metrics.fontSize,
                paddingX: metrics.tokenPaddingX,
                paddingY: metrics.tokenPaddingY,
                tokenFill: Utils.hexToRgba(zone.color || '#00ff88', zone.borderOpacity ?? 0.95),
                tokenStroke: Utils.hexToRgba(zone.color || '#00ff88', 1),
                tokenStrokeWidth: 1,
                textColor: Utils.hexToRgba(zone.labelColor || '#ffffff', zone.labelOpacity ?? 1)
            });
        }
    }

    roundRect(ctx, x, y, width, height, radius) {
        this.labelUtils.roundRect(ctx, x, y, width, height, radius);
    }
}

window.ZoneLabelRenderer = ZoneLabelRenderer;
