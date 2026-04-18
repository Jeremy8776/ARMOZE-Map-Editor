/**
 * Zone Preview Renderer
 * Handles transient canvas guides so the main zone renderer can stay focused on durable layer drawing.
 */
class ZonePreviewRenderer {
    constructor(canvasCore, getTextMetrics) {
        this.core = canvasCore;
        this.getTextMetrics = getTextMetrics;
        this.labelUtils = new ZoneLabelUtils(canvasCore);
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
        const badgeFont = '700 12px "Share Tech Mono", monospace';

        ctx.save();
        ctx.font = badgeFont;
        const metrics = this.getTextMetrics(ctx, badgeFont, badgeText);
        const width = metrics.width + 18;
        const height = 24;
        const x = anchor.x + 14;
        const y = anchor.y - 34;

        ctx.fillStyle = 'rgba(10, 12, 15, 0.92)';
        ctx.strokeStyle = 'rgba(255, 230, 109, 0.85)';
        ctx.lineWidth = 1.5;
        this.labelUtils.roundRect(ctx, x, y, width, height, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffe66d';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, x + 9, y + height / 2 + 0.5);
        ctx.restore();
    }

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

        if (tool === 'pen' && drawingPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) {
                ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            }
            if (lastMousePos) {
                ctx.lineTo(lastMousePos.x, lastMousePos.y);
            }
            ctx.stroke();

            ctx.fillStyle = '#00ff88';
            ctx.setLineDash([]);
            for (let i = 0; i < drawingPoints.length; i++) {
                const point = drawingPoints[i];
                ctx.beginPath();

                if (i === 0 && tempShape && tempShape.closeLoopHover) {
                    ctx.fillStyle = '#ffff00';
                    ctx.arc(point.x, point.y, 8 / this.core.zoom, 0, Math.PI * 2);
                } else {
                    ctx.fillStyle = '#00ff88';
                    ctx.arc(point.x, point.y, 5 / this.core.zoom, 0, Math.PI * 2);
                }

                ctx.fill();
                ctx.strokeStyle = '#0a0c0f';
                ctx.lineWidth = 1.5 / this.core.zoom;
                ctx.stroke();
            }
        }

        if (tool === 'freehand' && drawingPoints.length > 0) {
            ctx.setLineDash([]);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) {
                ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            }

            if (drawingPoints.length > 2) {
                ctx.lineTo(drawingPoints[0].x, drawingPoints[0].y);
                ctx.fill();
            }
            ctx.stroke();
        }

        ctx.restore();
    }
}

window.ZonePreviewRenderer = ZonePreviewRenderer;
