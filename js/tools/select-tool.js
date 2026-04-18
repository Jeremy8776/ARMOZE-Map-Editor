/**
 * Select Tool Module
 * Handles selection, dragging zones, and resizing via handles
 */
class SelectTool {
    constructor(canvasCore, zoneManager, imageOverlayManager = null) {
        this.core = canvasCore;
        this.manager = zoneManager;
        this.imageOverlayManager = imageOverlayManager;

        this.isDragging = false;
        this.isDraggingHandle = false;
        this.isDraggingLabel = false;
        this.draggedHandleIndex = -1;
        this.dragStart = null;
        this.dragOffset = { x: 0, y: 0 };
        this.labelDragOffset = { x: 0, y: 0 };
        this.hasDragged = false; // Track if actual dragging occurred
        this.snapPreview = null;
        this.labelUtils = new ZoneLabelUtils(canvasCore);
        this.labelHitTester = new ZoneLabelHitTester(canvasCore, this.labelUtils);
        this.snapPreviewBuilder = new ZoneSnapPreviewBuilder();
        this.overlayTransforms = new OverlayTransformController(this);

        // Callback for history save
        this.onDragComplete = null;

        this.handleSelectStartWhileDragging = (event) => {
            if (this.isDragging || this.isDraggingHandle || this.isDraggingLabel || this.overlayTransforms.hasActiveInteraction()) {
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

    onDown(mapPos, event = null) {
        if (this.overlayTransforms.handlePointerDown(mapPos)) {
            return;
        }

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
            this.imageOverlayManager?.selectOverlay(null, { render: false });
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
            this.imageOverlayManager?.selectOverlay(null, { render: false });
        }
        this.core.requestRender();
    }

    onMove(mapPos, event = null) {
        if (this.overlayTransforms.handlePointerMove(mapPos, event)) {
            this.core.requestRender();
        } else if (this.isDraggingLabel && this.manager.selectedZoneId) {
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
            const hoveredOverlay = this.imageOverlayManager?.findOverlayAtPoint(mapPos);
            if (hoveredOverlay) {
                this.imageOverlayManager.setHoveredOverlay(hoveredOverlay.id);
                if (this.manager.hoveredZoneId) {
                    this.manager.setHoveredZone(null);
                }
            } else {
                this.imageOverlayManager?.setHoveredOverlay(null);
                const hoveredZone = this.manager.findZoneAtPoint(mapPos, this.core.zoom) || this.findZoneLabelAtPoint(mapPos);
                if (hoveredZone && hoveredZone.id !== this.manager.hoveredZoneId) {
                    this.manager.setHoveredZone(hoveredZone.id);
                } else if (!hoveredZone && this.manager.hoveredZoneId) {
                    this.manager.setHoveredZone(null);
                }
            }

            this.updateCursor(mapPos);
        }
    }

    onUp(mapPos) {
        const overlayDragged = this.overlayTransforms.hasActiveInteraction() && this.overlayTransforms.hasDragged;
        const anyDragged = this.hasDragged || overlayDragged;
        if ((this.isDragging || this.isDraggingHandle || this.isDraggingLabel || overlayDragged) && anyDragged) {
            // Trigger update callback
            const zone = this.manager.getSelectedZone();
            if (zone && this.manager.onZoneUpdated) {
                this.manager.onZoneUpdated(zone);
            }
            this.manager.saveToStorage();
            this.imageOverlayManager?.saveToStorage();

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
        this.overlayTransforms.reset();
        this.setDragInteractionLock(false);
        this.clearSnapPreview();
        this.updateCursor(mapPos || this.dragStart || { x: 0, y: 0 });
    }

    cancel() {
        this.isDragging = false;
        this.isDraggingHandle = false;
        this.isDraggingLabel = false;
        this.dragStart = null;
        this.overlayTransforms.reset();
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

        const anchor = this.labelUtils.getZoneCenter(zone);
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

    findLabelAtPoint(point) {
        const zone = this.manager.getSelectedZone();
        return this.labelHitTester.findLabelAtPoint(zone, point);
    }

    findZoneLabelAtPoint(point) {
        return this.labelHitTester.findZoneLabelAtPoint(this.manager.getZones(), point);
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
        this.snapPreview = this.snapPreviewBuilder.build(zone, anchor);
    }

    updateCursor(mapPos) {
        const container = this.core.container;

        if (this.overlayTransforms.hasActiveInteraction() || this.isDraggingLabel) {
            container.style.cursor = 'grabbing';
            return;
        }

        if (this.imageOverlayManager?.selectedOverlayId && this.imageOverlayManager.findRotationHandleAtPoint(mapPos, this.core.zoom)) {
            container.style.cursor = 'grab';
            return;
        }

        if (this.imageOverlayManager?.selectedOverlayId) {
            const overlayHandleIndex = this.imageOverlayManager.findHandleAtPoint(mapPos, this.core.zoom);
            if (overlayHandleIndex !== -1) {
                container.style.cursor = this.getCornerResizeCursor(overlayHandleIndex);
                return;
            }
        }

        const overlay = this.imageOverlayManager?.findOverlayAtPoint(mapPos);
        if (overlay) {
            container.style.cursor = overlay.id === this.imageOverlayManager.selectedOverlayId ? 'move' : 'pointer';
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
            const zoneHandleIndex = this.findHandleAtPoint(mapPos);
            if (zoneHandleIndex !== -1) {
                const zone = this.manager.getSelectedZone();
                if (zone?.shape === 'rectangle') {
                    container.style.cursor = this.getCornerResizeCursor(zoneHandleIndex);
                } else {
                    container.style.cursor = 'nwse-resize';
                }
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

    getCornerResizeCursor(handleIndex) {
        return handleIndex === 0 || handleIndex === 2 ? 'nwse-resize' : 'nesw-resize';
    }
}

// Export for use in other modules
window.SelectTool = SelectTool;
