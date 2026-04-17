/**
 * Select Tool Module
 * Handles selection, dragging zones, and resizing via handles
 */
class SelectTool {
    constructor(canvasCore, zoneManager) {
        this.core = canvasCore;
        this.manager = zoneManager;

        this.isDragging = false;
        this.isDraggingHandle = false;
        this.isDraggingLabel = false;
        this.draggedHandleIndex = -1;
        this.dragStart = null;
        this.dragOffset = { x: 0, y: 0 };
        this.labelDragOffset = { x: 0, y: 0 };
        this.hasDragged = false; // Track if actual dragging occurred
        this.snapPreview = null;

        // Callback for history save
        this.onDragComplete = null;

        this.handleSelectStartWhileDragging = (event) => {
            if (this.isDragging || this.isDraggingHandle || this.isDraggingLabel) {
                event.preventDefault();
            }
        };
    }

    setDragInteractionLock(locked) {
        document.body.classList.toggle('is-zone-dragging', locked);
        document.removeEventListener('selectstart', this.handleSelectStartWhileDragging);
        if (locked) {
            document.addEventListener('selectstart', this.handleSelectStartWhileDragging);
        }
    }

    onDown(mapPos) {
        if (this.manager.selectedZoneId) {
            const labelHit = this.findLabelAtPoint(mapPos);
            if (labelHit) {
                this.isDraggingLabel = true;
                this.dragStart = mapPos;
                this.labelDragOffset = {
                    x: mapPos.x - labelHit.centerX,
                    y: mapPos.y - labelHit.centerY
                };
                this.core.container.style.cursor = 'grabbing';
                this.setDragInteractionLock(true);
                return;
            }
        }

        const zoneFromLabel = this.findZoneLabelAtPoint(mapPos);
        if (zoneFromLabel) {
            if (zoneFromLabel.id !== this.manager.selectedZoneId) {
                this.manager.selectZone(zoneFromLabel.id);
                this.core.requestRender();
                return;
            }
        }

        // First, check if clicking on a handle of the selected zone
        if (this.manager.selectedZoneId) {
            const handleIndex = this.findHandleAtPoint(mapPos);
            if (handleIndex !== -1) {
                this.isDraggingHandle = true;
                this.draggedHandleIndex = handleIndex;
                this.dragStart = mapPos;
                this.setDragInteractionLock(true);
                return;
            }
        }

        // Check if clicking on a zone
        const zone = this.manager.findZoneAtPoint(mapPos, this.core.zoom);
        if (zone) {
            // If clicking on already selected zone, start dragging
            if (zone.id === this.manager.selectedZoneId) {
                this.isDragging = true;
                this.dragStart = mapPos;
                this.setDragInteractionLock(true);

                // Calculate offset from zone center/position
                if (zone.shape === 'circle') {
                    this.dragOffset = {
                        x: mapPos.x - zone.cx,
                        y: mapPos.y - zone.cy
                    };
                } else if (zone.shape === 'line') {
                    this.dragOffset = {
                        x: mapPos.x - zone.x1,
                        y: mapPos.y - zone.y1
                    };
                } else if (zone.shape === 'rectangle') {
                    this.dragOffset = {
                        x: mapPos.x - zone.x,
                        y: mapPos.y - zone.y
                    };
                } else if (zone.points) {
                    const bounds = Utils.getPolygonBounds(zone.points);
                    this.dragOffset = {
                        x: mapPos.x - bounds.x,
                        y: mapPos.y - bounds.y
                    };
                }
            } else {
                // Select the zone
                this.manager.selectZone(zone.id);
            }
        } else {
            this.manager.selectZone(null);
        }
        this.core.requestRender();
    }

    onMove(mapPos) {
        if (this.isDraggingLabel && this.manager.selectedZoneId) {
            this.dragLabel(mapPos);
            this.core.requestRender();
        } else if (this.isDraggingHandle && this.manager.selectedZoneId) {
            this.dragHandle(mapPos);
            this.core.requestRender();
        } else if (this.isDragging && this.manager.selectedZoneId) {
            this.dragZone(mapPos);
            this.core.requestRender();
        } else {
            // Handle hover and cursor updates
            const hoveredZone = this.manager.findZoneAtPoint(mapPos, this.core.zoom) || this.findZoneLabelAtPoint(mapPos);
            if (hoveredZone && hoveredZone.id !== this.manager.hoveredZoneId) {
                this.manager.setHoveredZone(hoveredZone.id);
            } else if (!hoveredZone && this.manager.hoveredZoneId) {
                this.manager.setHoveredZone(null);
            }

            this.updateCursor(mapPos);
        }
    }

    onUp(mapPos) {
        if ((this.isDragging || this.isDraggingHandle || this.isDraggingLabel) && this.hasDragged) {
            // Trigger update callback
            const zone = this.manager.getSelectedZone();
            if (zone && this.manager.onZoneUpdated) {
                this.manager.onZoneUpdated(zone);
            }

            // Trigger history save callback
            if (this.onDragComplete) {
                this.onDragComplete();
            }
        }

        this.isDragging = false;
        this.isDraggingHandle = false;
        this.isDraggingLabel = false;
        this.draggedHandleIndex = -1;
        this.dragStart = null;
        this.hasDragged = false;
        this.setDragInteractionLock(false);
        this.clearSnapPreview();
        this.updateCursor(mapPos || this.dragStart || { x: 0, y: 0 });
    }

    cancel() {
        this.isDragging = false;
        this.isDraggingHandle = false;
        this.isDraggingLabel = false;
        this.dragStart = null;
        this.setDragInteractionLock(false);
        this.clearSnapPreview();
    }

    emitLiveZoneUpdate(zone) {
        if (zone && this.manager.onZoneUpdated) {
            this.manager.onZoneUpdated(zone, { live: true });
        }
    }

    /**
     * Find if a handle is at the given point
     */
    findHandleAtPoint(point) {
        const zone = this.manager.getSelectedZone();
        if (!zone) return -1;

        const handleSize = 12 / this.core.zoom; // Slightly larger hit area

        if (zone.shape === 'circle') {
            const handles = [
                { x: zone.cx + zone.radius, y: zone.cy },
                { x: zone.cx - zone.radius, y: zone.cy },
                { x: zone.cx, y: zone.cy + zone.radius },
                { x: zone.cx, y: zone.cy - zone.radius }
            ];
            for (let i = 0; i < handles.length; i++) {
                if (Math.abs(point.x - handles[i].x) < handleSize &&
                    Math.abs(point.y - handles[i].y) < handleSize) {
                    return i;
                }
            }
        } else if (zone.shape === 'rectangle') {
            // Corners: 0=topLeft, 1=topRight, 2=bottomRight, 3=bottomLeft
            const handles = [
                { x: zone.x, y: zone.y },
                { x: zone.x + zone.width, y: zone.y },
                { x: zone.x + zone.width, y: zone.y + zone.height },
                { x: zone.x, y: zone.y + zone.height }
            ];
            for (let i = 0; i < handles.length; i++) {
                if (Math.abs(point.x - handles[i].x) < handleSize &&
                    Math.abs(point.y - handles[i].y) < handleSize) {
                    return i;
                }
            }
        } else if (zone.points) {
            for (let i = 0; i < zone.points.length; i++) {
                if (Math.abs(point.x - zone.points[i].x) < handleSize &&
                    Math.abs(point.y - zone.points[i].y) < handleSize) {
                    return i;
                }
            }
        }

        return -1;
    }

    dragHandle(mapPos) {
        const zone = this.manager.getSelectedZone();
        if (!zone) return;
        const snappedPos = this.core.snapToGrid(mapPos);

        this.hasDragged = true;

        if (zone.shape === 'circle') {
            zone.radius = Utils.distance({ x: zone.cx, y: zone.cy }, snappedPos);
        } else if (zone.shape === 'rectangle' && this.draggedHandleIndex >= 0) {
            // Resize rectangle from corners
            const handleIndex = this.draggedHandleIndex;
            const oldX = zone.x;
            const oldY = zone.y;
            const oldRight = zone.x + zone.width;
            const oldBottom = zone.y + zone.height;

            // 0=topLeft, 1=topRight, 2=bottomRight, 3=bottomLeft
            if (handleIndex === 0) {
                zone.x = Math.min(snappedPos.x, oldRight - 5);
                zone.y = Math.min(snappedPos.y, oldBottom - 5);
                zone.width = oldRight - zone.x;
                zone.height = oldBottom - zone.y;
            } else if (handleIndex === 1) {
                zone.y = Math.min(snappedPos.y, oldBottom - 5);
                zone.width = Math.max(snappedPos.x - oldX, 5);
                zone.height = oldBottom - zone.y;
            } else if (handleIndex === 2) {
                zone.width = Math.max(snappedPos.x - oldX, 5);
                zone.height = Math.max(snappedPos.y - oldY, 5);
            } else if (handleIndex === 3) {
                zone.x = Math.min(snappedPos.x, oldRight - 5);
                zone.width = oldRight - zone.x;
                zone.height = Math.max(snappedPos.y - oldY, 5);
            }
        } else if (zone.points && this.draggedHandleIndex >= 0) {
            zone.points[this.draggedHandleIndex] = { x: snappedPos.x, y: snappedPos.y };
        }

        this.syncLineGeometry(zone);
        this.updateSnapPreview(zone, snappedPos);
        this.emitLiveZoneUpdate(zone);
    }

    dragLabel(mapPos) {
        const zone = this.manager.getSelectedZone();
        if (!zone) return;

        const anchor = this.getZoneCenter(zone);
        if (!anchor) return;

        const labelCenter = {
            x: mapPos.x - (this.labelDragOffset?.x || 0),
            y: mapPos.y - (this.labelDragOffset?.y || 0)
        };

        zone.labelOffsetX = labelCenter.x - anchor.x;
        zone.labelOffsetY = labelCenter.y - anchor.y;
        this.hasDragged = true;
        this.clearSnapPreview();
        this.dragStart = mapPos;
        this.emitLiveZoneUpdate(zone);
    }

    dragZone(mapPos) {
        const zone = this.manager.getSelectedZone();
        if (!zone) return;

        this.hasDragged = true;

        if (zone.shape === 'circle') {
            const snappedCenter = this.getSnappedAnchor(mapPos, this.dragOffset);
            zone.cx = snappedCenter.x;
            zone.cy = snappedCenter.y;
            this.updateSnapPreview(zone, snappedCenter);
        } else if (zone.shape === 'line') {
            const snappedStart = this.getSnappedAnchor(mapPos, this.dragOffset);
            const dx = snappedStart.x - zone.x1;
            const dy = snappedStart.y - zone.y1;
            zone.x1 += dx;
            zone.y1 += dy;
            zone.x2 += dx;
            zone.y2 += dy;
            if (zone.points?.length >= 2) {
                zone.points = zone.points.map(point => ({
                    x: point.x + dx,
                    y: point.y + dy
                }));
            }
            this.updateSnapPreview(zone, snappedStart);
        } else if (zone.shape === 'rectangle') {
            const snappedOrigin = this.getSnappedAnchor(mapPos, this.dragOffset);
            zone.x = snappedOrigin.x;
            zone.y = snappedOrigin.y;
            this.updateSnapPreview(zone, snappedOrigin);
        } else if (zone.points) {
            const bounds = Utils.getPolygonBounds(zone.points);
            const offset = this.dragOffset || { x: 0, y: 0 };
            const snappedBounds = this.getSnappedAnchor(mapPos, offset);
            const dx = snappedBounds.x - bounds.x;
            const dy = snappedBounds.y - bounds.y;
            for (const point of zone.points) {
                point.x += dx;
                point.y += dy;
            }
            this.updateSnapPreview(zone, snappedBounds);
        }

        this.syncLineGeometry(zone);
        this.dragStart = mapPos;
        this.emitLiveZoneUpdate(zone);
    }

    getSnappedAnchor(mapPos, offset = { x: 0, y: 0 }) {
        const anchor = {
            x: mapPos.x - offset.x,
            y: mapPos.y - offset.y
        };
        return this.core.snapToGrid(anchor);
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

    getLabelFontSize(zone) {
        const explicitFontSize = parseInt(zone?.labelFontSize, 10);
        if (Number.isFinite(explicitFontSize)) {
            return Math.max(explicitFontSize / this.core.zoom, explicitFontSize * (Constants?.LABEL_MIN_SIZE_RATIO || 0.7));
        }

        switch (zone?.labelSize) {
            case 'small': return Math.max((Constants?.LABEL_SIZE_SMALL || 10) / this.core.zoom, (Constants?.LABEL_SIZE_SMALL || 10) * (Constants?.LABEL_MIN_SIZE_RATIO || 0.7));
            case 'large': return Math.max((Constants?.LABEL_SIZE_LARGE || 18) / this.core.zoom, (Constants?.LABEL_SIZE_LARGE || 18) * (Constants?.LABEL_MIN_SIZE_RATIO || 0.7));
            default: return Math.max((Constants?.LABEL_SIZE_MEDIUM || 14) / this.core.zoom, (Constants?.LABEL_SIZE_MEDIUM || 14) * (Constants?.LABEL_MIN_SIZE_RATIO || 0.7));
        }
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

    getLabelFontString(zone) {
        const fontStyle = zone?.labelItalic ? 'italic ' : '';
        const fontWeight = zone?.labelBold ? '700' : '600';
        return `${fontStyle}${fontWeight} ${this.getLabelFontSize(zone)}px ${this.getLabelFontFamily(zone)}`;
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

    findLabelAtPoint(point) {
        const zone = this.manager.getSelectedZone();
        if (!zone || zone.showLabel === false || this.getActiveLabelMode(zone) !== 'floating') return null;
        return this.getLabelHitBox(zone, point);
    }

    getLabelHitBox(zone, point = null) {
        if (!zone || zone.showLabel === false || this.getActiveLabelMode(zone) !== 'floating') return null;

        const anchor = this.getZoneCenter(zone);
        if (!anchor) return null;
        const text = this.getLabelText(zone);
        if (!text) return null;

        const ctx = this.core.ctx;
        ctx.save();
        ctx.font = this.getLabelFontString(zone);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        ctx.restore();

        const fontSize = this.getLabelFontSize(zone);
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

    findZoneLabelAtPoint(point) {
        const zones = this.manager.getZones();
        for (let i = zones.length - 1; i >= 0; i--) {
            const zone = zones[i];
            if (!zone.visible || zone.showLabel === false || this.getActiveLabelMode(zone) !== 'floating') continue;
            const hit = this.getLabelHitBox(zone, point);
            if (hit) {
                return zone;
            }
        }
        return null;
    }

    syncLineGeometry(zone) {
        if (zone?.shape === 'line' && zone.points?.length >= 2) {
            zone.x1 = zone.points[0].x;
            zone.y1 = zone.points[0].y;
            zone.x2 = zone.points[1].x;
            zone.y2 = zone.points[1].y;
        }
    }

    clearSnapPreview() {
        this.snapPreview = null;
    }

    updateSnapPreview(zone, anchor) {
        if (!this.core.snapEnabled || !zone || !anchor) {
            this.clearSnapPreview();
            return;
        }

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
        } else if (zone.shape === 'circle') {
            preview.edgeSegments = [
                { x1: zone.cx - zone.radius, y1: zone.cy, x2: zone.cx + zone.radius, y2: zone.cy },
                { x1: zone.cx, y1: zone.cy - zone.radius, x2: zone.cx, y2: zone.cy + zone.radius }
            ];
        } else if (zone.shape === 'line') {
            preview.edgeSegments = [
                { x1: zone.x1, y1: zone.y1, x2: zone.x2, y2: zone.y2 }
            ];
        } else if (zone.points?.length) {
            const bounds = Utils.getPolygonBounds(zone.points);
            preview.edgeSegments = [
                { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.width, y2: bounds.y },
                { x1: bounds.x + bounds.width, y1: bounds.y, x2: bounds.x + bounds.width, y2: bounds.y + bounds.height },
                { x1: bounds.x + bounds.width, y1: bounds.y + bounds.height, x2: bounds.x, y2: bounds.y + bounds.height },
                { x1: bounds.x, y1: bounds.y + bounds.height, x2: bounds.x, y2: bounds.y }
            ];
        }

        this.snapPreview = preview;
    }

    updateCursor(mapPos) {
        const container = this.core.container;

        if (this.isDraggingLabel) {
            container.style.cursor = 'grabbing';
            return;
        }

        if (this.manager.selectedZoneId && this.findLabelAtPoint(mapPos)) {
            container.style.cursor = 'grab';
            return;
        }

        const zoneFromLabel = this.findZoneLabelAtPoint(mapPos);
        if (zoneFromLabel) {
            container.style.cursor = zoneFromLabel.id === this.manager.selectedZoneId ? 'grab' : 'pointer';
            return;
        }

        // Handle
        if (this.manager.selectedZoneId) {
            if (this.findHandleAtPoint(mapPos) !== -1) {
                container.style.cursor = 'nwse-resize';
                return;
            }
        }

        // Zone
        const zone = this.manager.findZoneAtPoint(mapPos, this.core.zoom);
        if (zone) {
            container.style.cursor = zone.id === this.manager.selectedZoneId ? 'move' : 'pointer';
        } else {
            container.style.cursor = 'default';
        }
    }
}

// Export for use in other modules
window.SelectTool = SelectTool;
