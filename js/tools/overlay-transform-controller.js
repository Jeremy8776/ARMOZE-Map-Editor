/**
 * Overlay Transform Controller
 * Keeps overlay-specific drag, resize, rotate, and snap preview behavior out of the generic select tool.
 */
class OverlayTransformController {
    constructor(host) {
        this.host = host;
        this.reset();
    }

    get core() {
        return this.host.core;
    }

    get manager() {
        return this.host.imageOverlayManager;
    }

    reset() {
        this.isDraggingOverlay = false;
        this.isDraggingOverlayHandle = false;
        this.isDraggingOverlayRotate = false;
        this.draggedOverlayHandleIndex = -1;
        this.dragOffset = { x: 0, y: 0 };
        this.overlayResizeState = null;
        this.overlayRotateState = null;
        this.hasDragged = false;
    }

    hasActiveInteraction() {
        return this.isDraggingOverlay || this.isDraggingOverlayHandle || this.isDraggingOverlayRotate;
    }

    handlePointerDown(mapPos) {
        if (!this.manager?.selectedOverlayId) {
            return false;
        }

        if (this.manager.findRotationHandleAtPoint(mapPos, this.core.zoom)) {
            const selectedOverlay = this.manager.getSelectedOverlay();
            const center = this.manager.getOverlayCenter(selectedOverlay);
            this.isDraggingOverlayRotate = true;
            this.overlayRotateState = selectedOverlay && center ? {
                center,
                startRotation: selectedOverlay.rotation || 0,
                startPointerAngle: Math.atan2(mapPos.y - center.y, mapPos.x - center.x)
            } : null;
            this.host.setDragInteractionLock(true);
            return true;
        }

        const overlayHandleIndex = this.manager.findHandleAtPoint(mapPos, this.core.zoom);
        if (overlayHandleIndex !== -1) {
            const selectedOverlay = this.manager.getSelectedOverlay();
            const oppositeHandles = [2, 3, 0, 1];
            const handles = this.manager.getSelectionHandles(selectedOverlay);
            const oppositeHandle = handles[oppositeHandles[overlayHandleIndex]];

            this.isDraggingOverlayHandle = true;
            this.draggedOverlayHandleIndex = overlayHandleIndex;
            this.overlayResizeState = selectedOverlay && oppositeHandle ? {
                startWidth: selectedOverlay.width,
                startHeight: selectedOverlay.height,
                startRotation: selectedOverlay.rotation || 0,
                oppositeHandle,
                aspectRatio: selectedOverlay.height ? selectedOverlay.width / selectedOverlay.height : 1
            } : null;
            this.host.setDragInteractionLock(true);
            return true;
        }

        const overlay = this.manager.findOverlayAtPoint(mapPos);
        if (!overlay) {
            return false;
        }

        if (overlay.id === this.manager.selectedOverlayId) {
            const localPoint = this.manager.toOverlayLocalPoint(mapPos, overlay);
            this.isDraggingOverlay = true;
            this.dragOffset = localPoint ? {
                x: localPoint.x - overlay.x,
                y: localPoint.y - overlay.y
            } : { x: 0, y: 0 };
            this.host.setDragInteractionLock(true);
        } else {
            this.manager.selectOverlay(overlay.id);
            this.host.manager.selectZone(null);
        }

        this.core.requestRender();
        return true;
    }

    handlePointerMove(mapPos, event = null) {
        if (this.isDraggingOverlayRotate && this.manager?.selectedOverlayId) {
            this.rotateOverlay(mapPos);
            return true;
        }
        if (this.isDraggingOverlayHandle && this.manager?.selectedOverlayId) {
            this.resizeOverlay(mapPos, event);
            return true;
        }
        if (this.isDraggingOverlay && this.manager?.selectedOverlayId) {
            this.dragOverlay(mapPos);
            return true;
        }
        return false;
    }

    dragOverlay(mapPos) {
        const overlay = this.manager?.getSelectedOverlay();
        if (!overlay) return;

        const rotation = this.manager.getOverlayRotationRadians(overlay);
        const localVector = {
            x: this.dragOffset.x - overlay.width / 2,
            y: this.dragOffset.y - overlay.height / 2
        };
        const rotatedVector = {
            x: localVector.x * Math.cos(rotation) - localVector.y * Math.sin(rotation),
            y: localVector.x * Math.sin(rotation) + localVector.y * Math.cos(rotation)
        };

        const origin = {
            x: mapPos.x - overlay.width / 2 - rotatedVector.x,
            y: mapPos.y - overlay.height / 2 - rotatedVector.y
        };
        const snappedOrigin = this.core.snapToGrid(origin);

        this.hasDragged = true;
        overlay.x = snappedOrigin.x;
        overlay.y = snappedOrigin.y;
        this.updateOverlaySnapPreview(overlay);

        this.manager.updateOverlay(overlay.id, {
            x: overlay.x,
            y: overlay.y
        }, { live: true, persist: false, render: false });
    }

    resizeOverlay(mapPos, event = null) {
        const overlay = this.manager?.getSelectedOverlay();
        if (!overlay || !this.overlayResizeState) return;

        const minSize = 32;
        const freeformResize = !!event?.shiftKey;
        const { startWidth, startHeight, startRotation, oppositeHandle, aspectRatio } = this.overlayResizeState;
        const snappedMapPos = this.core.snapToGrid(mapPos);
        const rotationRadians = (startRotation * Math.PI) / 180;
        const worldDx = snappedMapPos.x - oppositeHandle.x;
        const worldDy = snappedMapPos.y - oppositeHandle.y;
        const cos = Math.cos(-rotationRadians);
        const sin = Math.sin(-rotationRadians);
        const localDxRaw = worldDx * cos - worldDy * sin;
        const localDyRaw = worldDx * sin + worldDy * cos;

        const handleConfigs = [
            { xDir: -1, yDir: -1 },
            { xDir: 1, yDir: -1 },
            { xDir: 1, yDir: 1 },
            { xDir: -1, yDir: 1 }
        ];
        const config = handleConfigs[this.draggedOverlayHandleIndex];
        if (!config) return;

        let width = Math.max(minSize, Math.abs(localDxRaw));
        let height = Math.max(minSize, Math.abs(localDyRaw));

        if (!freeformResize && aspectRatio > 0) {
            const widthScale = width / Math.max(startWidth, 1);
            const heightScale = height / Math.max(startHeight, 1);
            const uniformScale = Math.max(
                widthScale,
                heightScale,
                minSize / Math.max(startWidth, 1),
                minSize / Math.max(startHeight, 1)
            );
            width = Math.max(minSize, startWidth * uniformScale);
            height = Math.max(minSize, startHeight * uniformScale);
        }

        const localMidpoint = {
            x: (config.xDir * width) / 2,
            y: (config.yDir * height) / 2
        };
        const newCenter = {
            x: oppositeHandle.x + localMidpoint.x * Math.cos(rotationRadians) - localMidpoint.y * Math.sin(rotationRadians),
            y: oppositeHandle.y + localMidpoint.x * Math.sin(rotationRadians) + localMidpoint.y * Math.cos(rotationRadians)
        };

        this.hasDragged = true;
        overlay.x = newCenter.x - width / 2;
        overlay.y = newCenter.y - height / 2;
        overlay.width = width;
        overlay.height = height;
        overlay.rotation = startRotation;
        this.updateOverlaySnapPreview(overlay);

        this.manager.updateOverlay(overlay.id, {
            x: overlay.x,
            y: overlay.y,
            width: overlay.width,
            height: overlay.height,
            rotation: overlay.rotation
        }, { live: true, persist: false, render: false });
    }

    rotateOverlay(mapPos) {
        const overlay = this.manager?.getSelectedOverlay();
        if (!overlay || !this.overlayRotateState) return;

        const { center, startRotation, startPointerAngle } = this.overlayRotateState;
        const currentPointerAngle = Math.atan2(mapPos.y - center.y, mapPos.x - center.x);
        let nextRotation = startRotation + ((currentPointerAngle - startPointerAngle) * (180 / Math.PI));

        if (nextRotation > 180 || nextRotation <= -180) {
            nextRotation = ((nextRotation + 180) % 360 + 360) % 360 - 180;
        }

        if (this.core.snapEnabled) {
            const rotationStep = window.Constants?.SNAP_ROTATION_STEP || 15;
            nextRotation = Math.round(nextRotation / rotationStep) * rotationStep;
        }

        this.hasDragged = true;
        overlay.rotation = nextRotation;
        this.updateOverlaySnapPreview(overlay);

        this.manager.updateOverlay(overlay.id, {
            rotation: overlay.rotation
        }, { live: true, persist: false, render: false });
    }

    updateOverlaySnapPreview(overlay) {
        if (!overlay) {
            this.host.clearSnapPreview();
            return;
        }

        if (!this.core.snapEnabled) {
            this.host.clearSnapPreview();
            return;
        }

        const handles = this.manager.getSelectionHandles(overlay);
        const anchor = handles[0] || this.manager.getOverlayCenter(overlay);
        const edgeSegments = [];

        if (handles.length === 4) {
            for (let index = 0; index < handles.length; index++) {
                const start = handles[index];
                const end = handles[(index + 1) % handles.length];
                edgeSegments.push({
                    x1: start.x,
                    y1: start.y,
                    x2: end.x,
                    y2: end.y
                });
            }
        }

        this.host.snapPreview = {
            anchor,
            verticals: anchor ? [anchor.x] : [],
            horizontals: anchor ? [anchor.y] : [],
            edgeSegments
        };
    }
}

window.OverlayTransformController = OverlayTransformController;
