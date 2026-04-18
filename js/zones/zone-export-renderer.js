/**
 * Zone Export Renderer
 * Mirrors the live renderer into an export canvas without editor-only chrome.
 */
class ZoneExportRenderer {
    constructor(canvasCore, zoneManager, dependencies) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.createZonePattern = dependencies.createZonePattern;
        this.drawZoneLabel = dependencies.drawZoneLabel;
        this.drawImageOverlays = dependencies.drawImageOverlays;
    }

    exportAsImage(settings = {}) {
        if (!this.core.mapImage) return null;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.core.mapWidth;
        exportCanvas.height = this.core.mapHeight;
        const ctx = exportCanvas.getContext('2d');

        ctx.clearRect(0, 0, this.core.mapWidth, this.core.mapHeight);

        if (settings.includeMap) {
            ctx.drawImage(this.core.mapImage, 0, 0, this.core.mapWidth, this.core.mapHeight);
        }

        const zones = this.manager.getZones();
        for (const zone of zones) {
            if (!zone.visible) continue;

            const fillOp = zone.fillOpacity !== undefined ? zone.fillOpacity : (zone.opacity || 0.4);
            const borderOp = zone.borderOpacity !== undefined ? zone.borderOpacity : 1.0;
            const borderWidth = zone.borderWidth || 3;
            const patternDensity = zone.patternDensity || 20;
            const patternAngle = zone.patternAngle || 0;
            const patternThickness = zone.patternThickness || 2;

            let fillStyle;
            if (zone.fillPattern && zone.fillPattern !== 'solid') {
                fillStyle = this.createZonePattern(
                    ctx,
                    zone.fillPattern,
                    zone.color,
                    fillOp,
                    patternDensity,
                    patternAngle,
                    patternThickness
                );
            }
            if (!fillStyle) {
                fillStyle = Utils.hexToRgba(zone.color, fillOp);
            }

            ctx.fillStyle = fillStyle;
            ctx.strokeStyle = Utils.hexToRgba(zone.color, borderOp);
            ctx.lineWidth = borderWidth;

            if (zone.style === 'dashed') {
                ctx.setLineDash([borderWidth * 5, borderWidth * 3]);
            } else if (zone.style === 'dotted') {
                ctx.setLineDash([borderWidth * 1.5, borderWidth * 1.5]);
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
                ctx.setLineDash([]);
                ctx.fillStyle = zone.color;
                ctx.beginPath();
                ctx.arc(zone.x1, zone.y1, 4, 0, Math.PI * 2);
                ctx.arc(zone.x2, zone.y2, 4, 0, Math.PI * 2);
                ctx.fill();
            } else if (zone.points?.length) {
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

        this.drawImageOverlays(ctx, { worldStatic: true, showEditorState: false });
        return exportCanvas;
    }
}

window.ZoneExportRenderer = ZoneExportRenderer;
