/**
 * Zone Snap Preview Builder
 * Produces the guide geometry shown while a zone is being transformed.
 */
class ZoneSnapPreviewBuilder {
    build(zone, anchor) {
        if (!zone || !anchor) return null;

        const preview = {
            anchor: { x: anchor.x, y: anchor.y },
            verticals: [anchor.x],
            horizontals: [anchor.y],
            edgeSegments: []
        };

        if (zone.shape === 'rectangle') {
            preview.edgeSegments = [
                { x1: zone.x, y1: zone.y, x2: zone.x + zone.width, y2: zone.y },
                { x1: zone.x + zone.width, y1: zone.y, x2: zone.x + zone.width, y2: zone.y + zone.height },
                { x1: zone.x + zone.width, y1: zone.y + zone.height, x2: zone.x, y2: zone.y + zone.height },
                { x1: zone.x, y1: zone.y + zone.height, x2: zone.x, y2: zone.y }
            ];
            return preview;
        }

        if (zone.shape === 'circle') {
            preview.edgeSegments = [
                { x1: zone.cx - zone.radius, y1: zone.cy, x2: zone.cx + zone.radius, y2: zone.cy },
                { x1: zone.cx, y1: zone.cy - zone.radius, x2: zone.cx, y2: zone.cy + zone.radius }
            ];
            return preview;
        }

        if (zone.shape === 'line') {
            preview.edgeSegments = [
                { x1: zone.x1, y1: zone.y1, x2: zone.x2, y2: zone.y2 }
            ];
            return preview;
        }

        if (zone.points?.length) {
            const bounds = Utils.getPolygonBounds(zone.points);
            preview.edgeSegments = [
                { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.width, y2: bounds.y },
                { x1: bounds.x + bounds.width, y1: bounds.y, x2: bounds.x + bounds.width, y2: bounds.y + bounds.height },
                { x1: bounds.x + bounds.width, y1: bounds.y + bounds.height, x2: bounds.x, y2: bounds.y + bounds.height },
                { x1: bounds.x, y1: bounds.y + bounds.height, x2: bounds.x, y2: bounds.y }
            ];
        }

        return preview;
    }
}

window.ZoneSnapPreviewBuilder = ZoneSnapPreviewBuilder;
