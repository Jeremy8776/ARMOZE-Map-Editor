/**
 * Zone Inspector Shell
 * Owns inspector chrome, placement, and readout rendering so the properties
 * class can focus on form state and zone updates.
 */
class ZoneInspectorShell {
    constructor(propertiesUI) {
        this.ui = propertiesUI;
        this.dragState = null;
        this.resizeState = null;
        this.pinnedEdge = null;
        this.panelSize = InspectorLayoutService.getDefaultSize(null);
        this.activeTab = 'general';
        this.storageKey = 'mapOverlay_inspector_layout';
    }

    initPanelInteractions() {
        const panel = this.ui.elements.floatingControls;
        const header = panel?.querySelector('.floating-controls-header');
        if (!panel || !header) return;

        this.restoreLayout();
        this.ensureAdaptiveControls();
        this.setActiveTab(this.activeTab);
        header.title = 'Drag to move. Drop near an app edge to pin.';
        header.addEventListener('pointerdown', (event) => this.startPanelDrag(event));
    }

    ensureAdaptiveControls() {
        const panel = this.ui.elements.floatingControls;
        if (!panel) return;

        if (!panel.querySelector('.inspector-resize-handle')) {
            const handle = document.createElement('div');
            handle.className = 'inspector-resize-handle';
            handle.title = 'Resize Inspector';
            panel.appendChild(handle);
            handle.addEventListener('pointerdown', (event) => this.startPanelResize(event));
        }
    }

    restoreLayout() {
        const panel = this.ui.elements.floatingControls;
        if (!panel) return;

        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            const savedPinnedEdge = InspectorLayoutService.normalizePinnedEdge(saved.pinnedEdge);
            if (savedPinnedEdge) {
                this.pinPanel(savedPinnedEdge, { persist: false, size: saved.size });
                return;
            }
            if (saved.pinnedEdge && !savedPinnedEdge) {
                localStorage.removeItem(this.storageKey);
                return;
            }
            if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                panel.classList.add('is-floating-custom');
                panel.style.left = `${saved.left}px`;
                panel.style.top = `${saved.top}px`;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                if (Number.isFinite(saved.width)) panel.style.width = `${saved.width}px`;
                if (Number.isFinite(saved.height)) panel.style.height = `${saved.height}px`;
            }
        } catch (error) {
            localStorage.removeItem(this.storageKey);
        }
    }

    persistLayout(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            // Layout persistence is optional.
        }
    }

    startPanelDrag(event) {
        const panel = this.ui.elements.floatingControls;
        if (!panel || event.button !== 0) return;
        if (event.target.closest('button, input, select, label')) return;

        const wasPinnedEdge = this.pinnedEdge;
        const rect = panel.getBoundingClientRect();
        const floatingRect = wasPinnedEdge
            ? InspectorLayoutService.getFloatingRestoreRect(wasPinnedEdge, rect, {
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight
            })
            : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        this.unpinPanel(floatingRect);

        this.dragState = {
            offsetX: Math.max(24, Math.min(event.clientX - floatingRect.left, floatingRect.width - 24)),
            offsetY: Math.max(24, Math.min(event.clientY - floatingRect.top, floatingRect.height - 24)),
            width: floatingRect.width,
            height: floatingRect.height
        };

        panel.classList.add('is-panel-dragging');
        document.body.classList.add('is-dragging-inspector');
        document.addEventListener('pointermove', this.boundPanelDragMove ||= ((moveEvent) => this.movePanel(moveEvent)));
        document.addEventListener('pointerup', this.boundPanelDragEnd ||= ((upEvent) => this.endPanelDrag(upEvent)), { once: true });
        event.preventDefault();
    }

    movePanel(event) {
        if (!this.dragState) return;
        const panel = this.ui.elements.floatingControls;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const left = Math.max(8, Math.min(event.clientX - this.dragState.offsetX, viewportWidth - this.dragState.width - 8));
        const top = Math.max(64, Math.min(event.clientY - this.dragState.offsetY, viewportHeight - this.dragState.height - 8));

        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    endPanelDrag(event) {
        const panel = this.ui.elements.floatingControls;
        if (!panel || !this.dragState) return;

        document.removeEventListener('pointermove', this.boundPanelDragMove);
        document.body.classList.remove('is-dragging-inspector');
        panel.classList.remove('is-panel-dragging');

        const edge = this.getNearestPinEdge(panel.getBoundingClientRect());
        if (edge) {
            this.pinPanel(edge);
        } else {
            const rect = panel.getBoundingClientRect();
            this.persistLayout({
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                pinnedEdge: null
            });
        }

        this.dragState = null;
    }

    getNearestPinEdge(rect) {
        const threshold = 28;
        const viewportWidth = document.documentElement.clientWidth;
        const distances = [
            { edge: 'left', value: rect.left },
            { edge: 'right', value: viewportWidth - rect.right }
        ].sort((a, b) => a.value - b.value);

        return distances[0].value <= threshold ? distances[0].edge : null;
    }

    pinPanel(edge, options = {}) {
        const panel = this.ui.elements.floatingControls;
        if (!panel) return;
        const pinnedEdge = InspectorLayoutService.normalizePinnedEdge(edge);
        if (!pinnedEdge) {
            this.unpinPanel();
            return;
        }

        this.pinnedEdge = pinnedEdge;
        this.panelSize = InspectorLayoutService.clampSize(pinnedEdge, options.size || this.panelSize || InspectorLayoutService.getDefaultSize(pinnedEdge));
        panel.classList.remove(
            'is-floating-custom',
            'is-pinned-left',
            'is-pinned-right',
            'is-layout-side-panel'
        );
        panel.classList.add(`is-pinned-${pinnedEdge}`);
        panel.classList.add('is-layout-side-panel');
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.style.width = `${this.panelSize}px`;
        panel.style.height = '';
        this.updatePinnedInset();
        this.setActiveTab(this.activeTab || 'general');

        if (options.persist !== false) {
            this.persistLayout({ pinnedEdge: pinnedEdge, size: this.panelSize });
        }
    }

    unpinPanel(rect = null) {
        const panel = this.ui.elements.floatingControls;
        if (!panel) return;

        this.pinnedEdge = null;
        panel.classList.remove(
            'is-pinned-left',
            'is-pinned-right',
            'is-layout-side-panel'
        );
        panel.classList.add('is-floating-custom');
        this.clearAppInset();
        if (rect) {
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.width = `${rect.width}px`;
            panel.style.height = `${rect.height}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
    }

    setActiveTab(tab) {
        this.activeTab = tab || 'general';
        const panel = this.ui.elements.floatingControls;
        if (!panel) return;

        panel.querySelectorAll('[data-inspector-tab]').forEach(button => {
            button.classList.toggle('is-active', button.dataset.inspectorTab === this.activeTab);
        });
        panel.querySelectorAll('[data-inspector-pane]').forEach(pane => {
            pane.classList.toggle('is-active-pane', pane.dataset.inspectorPane === this.activeTab);
        });
    }

    applyAppInset(edge, size) {
        const app = document.getElementById('app');
        if (!app) return;

        this.clearAppInset();
        const inset = InspectorLayoutService.getInsetForEdge(edge, size);
        app.classList.add('has-pinned-inspector', `inspector-pinned-${edge}`);
        app.style.setProperty('--inspector-inset-top', `${inset.top}px`);
        app.style.setProperty('--inspector-inset-right', `${inset.right}px`);
        app.style.setProperty('--inspector-inset-bottom', `${inset.bottom}px`);
        app.style.setProperty('--inspector-inset-left', `${inset.left}px`);
        window.requestAnimationFrame(() => this.ui.app.core?.resize?.());
    }

    updatePinnedInset() {
        const panel = this.ui.elements.floatingControls;
        const hidden = !panel || panel.style.display === 'none';
        const collapsed = !!panel?.classList.contains('is-collapsed');

        if (!InspectorLayoutService.shouldReserveInset({
            edge: this.pinnedEdge,
            hidden,
            collapsed
        })) {
            this.clearAppInset();
            return;
        }

        this.applyAppInset(this.pinnedEdge, this.panelSize);
    }

    clearAppInset() {
        const app = document.getElementById('app');
        if (!app) return;
        app.classList.remove(
            'has-pinned-inspector',
            'inspector-pinned-left',
            'inspector-pinned-right'
        );
        app.style.removeProperty('--inspector-inset-top');
        app.style.removeProperty('--inspector-inset-right');
        app.style.removeProperty('--inspector-inset-bottom');
        app.style.removeProperty('--inspector-inset-left');
        window.requestAnimationFrame(() => this.ui.app.core?.resize?.());
    }

    startPanelResize(event) {
        const panel = this.ui.elements.floatingControls;
        if (!panel || event.button !== 0) return;
        const rect = panel.getBoundingClientRect();

        this.resizeState = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startSize: this.panelSize,
            edge: this.pinnedEdge
        };

        document.body.classList.add('is-resizing-inspector');
        document.addEventListener('pointermove', this.boundPanelResizeMove ||= ((moveEvent) => this.resizePanel(moveEvent)));
        document.addEventListener('pointerup', this.boundPanelResizeEnd ||= ((upEvent) => this.endPanelResize(upEvent)), { once: true });
        event.preventDefault();
        event.stopPropagation();
    }

    resizePanel(event) {
        if (!this.resizeState) return;
        const panel = this.ui.elements.floatingControls;
        const edge = this.resizeState.edge;

        if (!edge) {
            const width = Math.max(300, Math.min(this.resizeState.startWidth + event.clientX - this.resizeState.startX, 640));
            const height = Math.max(240, Math.min(this.resizeState.startHeight + event.clientY - this.resizeState.startY, document.documentElement.clientHeight - 88));
            panel.style.width = `${width}px`;
            panel.style.height = `${height}px`;
            return;
        }

        let nextSize = this.resizeState.startSize;
        if (edge === 'right') nextSize += this.resizeState.startX - event.clientX;
        if (edge === 'left') nextSize += event.clientX - this.resizeState.startX;

        this.panelSize = InspectorLayoutService.clampSize(edge, nextSize);
        panel.style.width = `${this.panelSize}px`;
        panel.style.height = '';
        this.updatePinnedInset();
    }

    endPanelResize() {
        const panel = this.ui.elements.floatingControls;
        if (!panel || !this.resizeState) return;

        document.removeEventListener('pointermove', this.boundPanelResizeMove);
        document.body.classList.remove('is-resizing-inspector');

        const rect = panel.getBoundingClientRect();
        if (this.pinnedEdge) {
            this.persistLayout({ pinnedEdge: this.pinnedEdge, size: this.panelSize });
        } else {
            this.persistLayout({
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                pinnedEdge: null
            });
        }

        this.resizeState = null;
        window.requestAnimationFrame(() => this.ui.app.core?.resize?.());
    }

    syncZoneTitles(name) {
        if (this.ui.elements.floatingZoneName) this.ui.elements.floatingZoneName.textContent = name;
        if (this.ui.elements.quickZoneName) this.ui.elements.quickZoneName.textContent = name;
    }

    setInspectorCollapsed(collapsed) {
        this.ui.inspectorCollapsed = collapsed;
        if (!this.ui.elements.floatingControls) return;
        this.ui.elements.floatingControls.classList.toggle('is-collapsed', collapsed);
        this.updatePinnedInset();
    }

    pulseInspector() {
        const inspector = this.ui.elements.floatingControls;
        if (!inspector) return;

        inspector.classList.remove('is-attention');
        void inspector.offsetWidth;
        inspector.classList.add('is-attention');
        window.clearTimeout(this.ui.inspectorPulseTimeout);
        this.ui.inspectorPulseTimeout = window.setTimeout(() => {
            inspector.classList.remove('is-attention');
        }, 900);
    }

    openInspector() {
        if (!this.ui.app.zoneManager.getSelectedZone() && !this.ui.getSelectedOverlay?.()) return;
        this.setInspectorCollapsed(false);
        this.pulseInspector();
    }

    setInspectorMode(mode) {
        const isOverlay = mode === 'overlay';
        const kicker = this.ui.elements.floatingControls?.querySelector('.zone-inspector-kicker');
        const quickEyebrow = this.ui.elements.quickChip?.querySelector('.zone-quick-chip__eyebrow');
        if (kicker) kicker.textContent = isOverlay ? 'Image Inspector' : 'Zone Inspector';
        if (quickEyebrow) quickEyebrow.textContent = isOverlay ? 'Image' : 'Zone';
        if (this.ui.elements.quickZoneColor) {
            this.ui.elements.quickZoneColor.setAttribute('aria-label', isOverlay ? 'Quick image tint color' : 'Quick zone color');
        }
        if (this.ui.elements.btnQuickDuplicate) {
            this.ui.elements.btnQuickDuplicate.title = isOverlay ? 'Duplicate Image' : 'Duplicate Zone';
        }
        if (this.ui.elements.btnQuickDelete) {
            this.ui.elements.btnQuickDelete.title = isOverlay ? 'Delete Image' : 'Delete Zone';
        }
    }

    showFloatingControls(zone) {
        const { floatingControls, quickChip } = this.ui.elements;
        if (!floatingControls || !quickChip) return;

        floatingControls.style.removeProperty('display');
        quickChip.style.removeProperty('display');
        this.updatePinnedInset();
        const name = zone.name || this.ui.app.imageOverlayManager?.getOverlayDisplayName?.(zone) || 'Layer';
        this.syncZoneTitles(name);
        this.ui.setColorInputValue('quickZoneColor', zone.color || zone.tintColor || '#ffffff', '#ffffff');
        this.updateFloatingPosition();
    }

    hideFloatingControls() {
        if (this.ui.elements.floatingControls) {
            this.ui.elements.floatingControls.style.display = 'none';
        }
        if (this.ui.elements.quickChip) {
            this.ui.elements.quickChip.style.display = 'none';
        }
        this.clearAppInset();
        this.updateZoneDataReadout(null);
    }

    updateZoneDataReadout(zone) {
        const readout = this.ui.elements.zoneCoords;
        if (!readout) return;
        readout.innerHTML = zone
            ? this.formatZoneCoords(zone)
            : 'Select a layer to view its data.';
    }

    updateFloatingPosition() {
        const chip = this.ui.elements.quickChip;
        if (!chip || chip.style.display === 'none') return;

        const zone = this.ui.app.zoneManager.getSelectedZone();
        const overlay = this.ui.getSelectedOverlay?.();
        const activeLayer = zone || overlay;
        if (!activeLayer) {
            this.hideFloatingControls();
            return;
        }

        const rect = chip.getBoundingClientRect();
        const chipWidth = rect.width || 260;
        const chipHeight = rect.height || 58;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const bounds = zone ? this.getZoneScreenBB(zone) : this.getOverlayScreenBB(overlay);

        const leftLimit = this.ui.toolbarElement
            ? this.ui.toolbarElement.getBoundingClientRect().right + 16
            : 16;
        let rightLimit = viewportWidth - 16;
        if (this.ui.zonePanelElement) {
            rightLimit = Math.min(rightLimit, this.ui.zonePanelElement.getBoundingClientRect().left - 16);
        }
        if (this.ui.elements.floatingControls && this.ui.elements.floatingControls.style.display !== 'none' && !this.ui.inspectorCollapsed) {
            rightLimit = Math.min(rightLimit, this.ui.elements.floatingControls.getBoundingClientRect().left - 16);
        }

        let targetX = bounds.minX + (bounds.width / 2) - (chipWidth / 2);
        let targetY = bounds.minY - chipHeight - 14;
        if (targetY < 84) {
            targetY = bounds.maxY + 14;
        }
        if (targetY + chipHeight > viewportHeight - 16) {
            targetY = Math.max(84, bounds.minY - chipHeight - 14);
        }

        targetX = Math.max(leftLimit, Math.min(targetX, rightLimit - chipWidth));
        targetY = Math.max(84, Math.min(targetY, viewportHeight - chipHeight - 16));

        chip.style.left = `${targetX}px`;
        chip.style.top = `${targetY}px`;
    }

    getOverlayScreenBB(overlay) {
        const mapToViewport = (mapX, mapY) => {
            const point = this.ui.app.core.mapToScreen(mapX, mapY);
            const canvasRect = this.ui.app.core.canvas.getBoundingClientRect();
            return {
                x: canvasRect.left + point.x,
                y: canvasRect.top + point.y
            };
        };

        const topLeft = mapToViewport(overlay.x ?? 0, overlay.y ?? 0);
        const bottomRight = mapToViewport((overlay.x ?? 0) + (overlay.width ?? 0), (overlay.y ?? 0) + (overlay.height ?? 0));
        return {
            minX: Math.min(topLeft.x, bottomRight.x),
            minY: Math.min(topLeft.y, bottomRight.y),
            maxX: Math.max(topLeft.x, bottomRight.x),
            maxY: Math.max(topLeft.y, bottomRight.y),
            width: Math.abs(bottomRight.x - topLeft.x),
            height: Math.abs(bottomRight.y - topLeft.y)
        };
    }

    getZoneScreenBB(zone) {
        const mapToViewport = (mapX, mapY) => {
            const point = this.ui.app.core.mapToScreen(mapX, mapY);
            const canvasRect = this.ui.app.core.canvas.getBoundingClientRect();
            return {
                x: canvasRect.left + point.x,
                y: canvasRect.top + point.y
            };
        };

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        if (zone.shape === 'circle') {
            const center = mapToViewport(zone.cx ?? 0, zone.cy ?? 0);
            const radius = (zone.radius ?? 0) * this.ui.app.core.zoom;
            minX = center.x - radius;
            maxX = center.x + radius;
            minY = center.y - radius;
            maxY = center.y + radius;
        } else if (zone.shape === 'rectangle') {
            const topLeft = mapToViewport(zone.x ?? 0, zone.y ?? 0);
            const bottomRight = mapToViewport((zone.x ?? 0) + (zone.width ?? 0), (zone.y ?? 0) + (zone.height ?? 0));
            minX = Math.min(topLeft.x, bottomRight.x);
            maxX = Math.max(topLeft.x, bottomRight.x);
            minY = Math.min(topLeft.y, bottomRight.y);
            maxY = Math.max(topLeft.y, bottomRight.y);
        } else if (zone.shape === 'line') {
            const start = mapToViewport(zone.x1 ?? 0, zone.y1 ?? 0);
            const end = mapToViewport(zone.x2 ?? 0, zone.y2 ?? 0);
            minX = Math.min(start.x, end.x);
            maxX = Math.max(start.x, end.x);
            minY = Math.min(start.y, end.y);
            maxY = Math.max(start.y, end.y);
        } else if (zone.points?.length) {
            zone.points.forEach(point => {
                const screenPoint = mapToViewport(point.x, point.y);
                minX = Math.min(minX, screenPoint.x);
                maxX = Math.max(maxX, screenPoint.x);
                minY = Math.min(minY, screenPoint.y);
                maxY = Math.max(maxY, screenPoint.y);
            });
        } else {
            const center = mapToViewport(zone.x ?? 0, zone.y ?? 0);
            minX = maxX = center.x;
            minY = maxY = center.y;
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    formatZoneCoords(zone) {
        if (zone?.sourceType) {
            const x = zone.x ?? 0;
            const y = zone.y ?? 0;
            const width = zone.width ?? 0;
            const height = zone.height ?? 0;
            const rotation = zone.rotation ?? 0;
            return `Position: (${x.toFixed(1)}, ${y.toFixed(1)})<br>Size: ${width.toFixed(1)} x ${height.toFixed(1)}<br>Rotation: ${rotation.toFixed(1)} deg`;
        }
        if (zone.shape === 'circle') {
            const cx = zone.cx ?? 0;
            const cy = zone.cy ?? 0;
            const radius = zone.radius ?? 0;
            return `Center: (${cx.toFixed(1)}, ${cy.toFixed(1)})<br>Radius: ${radius.toFixed(1)}`;
        }
        if (zone.shape === 'rectangle') {
            const x = zone.x ?? 0;
            const y = zone.y ?? 0;
            const width = zone.width ?? 0;
            const height = zone.height ?? 0;
            return `Position: (${x.toFixed(1)}, ${y.toFixed(1)})<br>Size: ${width.toFixed(1)} x ${height.toFixed(1)}`;
        }
        if (zone.shape === 'line') {
            const x1 = zone.x1 ?? 0;
            const y1 = zone.y1 ?? 0;
            const x2 = zone.x2 ?? 0;
            const y2 = zone.y2 ?? 0;
            return `Start: (${x1.toFixed(1)}, ${y1.toFixed(1)})<br>End: (${x2.toFixed(1)}, ${y2.toFixed(1)})`;
        }
        if (zone.points?.length) {
            return zone.points.map((point, index) =>
                `P${index + 1}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`
            ).join('<br>');
        }
        return '';
    }
}

window.ZoneInspectorShell = ZoneInspectorShell;
