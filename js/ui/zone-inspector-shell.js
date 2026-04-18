/**
 * Zone Inspector Shell
 * Owns inspector chrome, placement, and readout rendering so the properties
 * class can focus on form state and zone updates.
 */
class ZoneInspectorShell {
    constructor(propertiesUI) {
        this.ui = propertiesUI;
    }

    syncZoneTitles(name) {
        if (this.ui.elements.floatingZoneName) this.ui.elements.floatingZoneName.textContent = name;
        if (this.ui.elements.quickZoneName) this.ui.elements.quickZoneName.textContent = name;
    }

    setInspectorCollapsed(collapsed) {
        this.ui.inspectorCollapsed = collapsed;
        if (!this.ui.elements.floatingControls) return;
        this.ui.elements.floatingControls.classList.toggle('is-collapsed', collapsed);
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
        if (!this.ui.app.zoneManager.getSelectedZone()) return;
        this.setInspectorCollapsed(false);
        this.pulseInspector();
    }

    showFloatingControls(zone) {
        const { floatingControls, quickChip } = this.ui.elements;
        if (!floatingControls || !quickChip) return;

        floatingControls.style.removeProperty('display');
        quickChip.style.removeProperty('display');
        this.syncZoneTitles(zone.name);
        this.ui.setColorInputValue('quickZoneColor', zone.color, '#ffffff');
        this.updateFloatingPosition();
    }

    hideFloatingControls() {
        if (this.ui.elements.floatingControls) {
            this.ui.elements.floatingControls.style.display = 'none';
        }
        if (this.ui.elements.quickChip) {
            this.ui.elements.quickChip.style.display = 'none';
        }
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
        if (!zone) {
            this.hideFloatingControls();
            return;
        }

        const rect = chip.getBoundingClientRect();
        const chipWidth = rect.width || 260;
        const chipHeight = rect.height || 58;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const bounds = this.getZoneScreenBB(zone);

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
