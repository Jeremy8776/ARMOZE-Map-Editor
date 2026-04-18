/**
 * Zone Label Hit Tester
 * Reuses label geometry rules so pointer interactions match the rendered label surface.
 */
class ZoneLabelHitTester {
    constructor(canvasCore, labelUtils) {
        this.core = canvasCore;
        this.labelUtils = labelUtils;
    }

    findLabelAtPoint(zone, point, ctx = this.core.ctx) {
        if (!zone || this.labelUtils.getActiveLabelMode(zone) !== 'floating') return null;
        return this.getLabelHitBox(zone, point, ctx);
    }

    getLabelHitBox(zone, point = null, ctx = this.core.ctx) {
        if (!zone || this.labelUtils.getActiveLabelMode(zone) !== 'floating') return null;

        const anchor = this.labelUtils.getZoneCenter(zone);
        if (!anchor) return null;

        const text = this.labelUtils.getLabelText(zone);
        if (!text) return null;

        ctx.save();
        ctx.font = this.labelUtils.getLabelFontString(zone);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        ctx.restore();

        const fontSize = this.labelUtils.getLabelFontSize(zone);
        const padding = 4 / this.core.zoom;
        const textHeight = Math.max(
            fontSize,
            (metrics.actualBoundingBoxAscent || fontSize * 0.7) + (metrics.actualBoundingBoxDescent || fontSize * 0.3)
        );
        const width = metrics.width + padding * 2;
        const height = textHeight + padding * 2;
        const centerX = anchor.x + (zone.labelOffsetX || 0);
        const centerY = anchor.y + (zone.labelOffsetY || 0);
        const hitPadding = 6 / this.core.zoom;
        const box = {
            x: centerX - width / 2 - hitPadding,
            y: centerY - height / 2 - hitPadding,
            width: width + hitPadding * 2,
            height: height + hitPadding * 2,
            centerX,
            centerY
        };

        if (!point) return box;
        return Utils.pointInRect(point, box) ? box : null;
    }

    findZoneLabelAtPoint(zones, point, ctx = this.core.ctx) {
        for (let index = zones.length - 1; index >= 0; index--) {
            const zone = zones[index];
            if (!zone.visible || this.labelUtils.getActiveLabelMode(zone) !== 'floating') continue;
            const hit = this.getLabelHitBox(zone, point, ctx);
            if (hit) {
                return zone;
            }
        }
        return null;
    }
}

window.ZoneLabelHitTester = ZoneLabelHitTester;
