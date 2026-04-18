/**
 * Zone Label Utils
 * Centralizes label geometry and font rules so rendering and hit-testing stay in sync.
 */
class ZoneLabelUtils {
    constructor(canvasCore) {
        this.core = canvasCore;
    }

    getZoneCenter(zone) {
        if (!zone) return null;
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

        switch (zone?.labelSize) {
            case 'small':
                return Constants?.LABEL_SIZE_SMALL || 10;
            case 'large':
                return Constants?.LABEL_SIZE_LARGE || 18;
            default:
                return Constants?.LABEL_SIZE_MEDIUM || 14;
        }
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
        switch (zone?.labelFontFamily) {
            case 'mono':
                return '"Share Tech Mono", monospace';
            case 'system':
                return '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
            default:
                return 'Rajdhani, sans-serif';
        }
    }

    getLabelFontString(zone, options = {}) {
        const fontStyle = zone?.labelItalic ? 'italic ' : '';
        const fontWeight = zone?.labelBold ? '700' : '600';
        return `${fontStyle}${fontWeight} ${this.getLabelFontSize(zone, options)}px ${this.getLabelFontFamily(zone)}`;
    }

    getLabelText(zone) {
        return (zone?.labelText || zone?.name || '').trim();
    }

    getActiveLabelMode(zone) {
        if (!zone || zone.showLabel === false) return 'hidden';
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
            const steps = 12;
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
}

window.ZoneLabelUtils = ZoneLabelUtils;
