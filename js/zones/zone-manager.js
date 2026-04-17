/**
 * Zone Manager Module
 * Handles zone data, CRUD operations, and selection
 */
class ZoneManager {
    constructor(renderCallback) {
        this.zones = this.loadFromStorage();
        this.selectedZoneId = null;
        this.hoveredZoneId = null;
        this.requestRender = renderCallback;

        // Callbacks
        this.onZoneCreated = null;
        this.onZoneSelected = null;
        this.onZoneUpdated = null;
        this.onZoneDeleted = null;
    }

    saveToStorage() {
        try {
            localStorage.setItem('mapOverlay_zones', JSON.stringify(this.zones));
        } catch (e) {
            console.warn('Failed to save zones to local storage');
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('mapOverlay_zones');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.warn('Failed to load zones from local storage');
            return [];
        }
    }

    getZones() {
        return this.zones;
    }

    getZone(id) {
        return this.zones.find(z => z.id === id);
    }

    getSelectedZone() {
        return this.getZone(this.selectedZoneId);
    }

    createZone(type, shape) {
        const zone = {
            id: Utils.generateId(),
            name: `Zone ${this.zones.length + 1}`,
            profileId: 'safe',
            color: '#00ff88',
            visible: true,
            showLabel: true,
            labelText: `Zone ${this.zones.length + 1}`,
            labelColor: '#ffffff',
            labelOpacity: 1.0,
            labelBgColor: '#000000',
            labelBgOpacity: 0.7,
            labelFontSize: Constants?.LABEL_SIZE_MEDIUM || 14,
            labelSize: 'medium',
            labelFontFamily: 'rajdhani',
            labelBold: false,
            labelItalic: false,
            labelShadow: false,
            labelOffsetX: 0,
            labelOffsetY: 0,
            borderLabelMode: 'none',
            patternLabelMode: 'none',
            shape: type,
            ...shape
        };

        this.zones.push(zone);
        this.selectZone(zone.id);

        if (this.onZoneCreated) {
            this.onZoneCreated(zone);
        }

        this.saveToStorage();
        this.requestRender();
        return zone;
    }

    updateZone(id, updates) {
        const zoneIndex = this.zones.findIndex(z => z.id === id);
        if (zoneIndex !== -1) {
            this.zones[zoneIndex] = { ...this.zones[zoneIndex], ...updates };

            if (this.onZoneUpdated) {
                this.onZoneUpdated(this.zones[zoneIndex]);
            }
            this.saveToStorage();
            this.requestRender();
        }
    }

    deleteZone(id) {
        const index = this.zones.findIndex(z => z.id === id);
        if (index !== -1) {
            this.zones.splice(index, 1);
            if (this.selectedZoneId === id) {
                this.selectZone(null);
            }

            if (this.onZoneDeleted) {
                this.onZoneDeleted(id);
            }
            this.saveToStorage();
            this.requestRender();
        }
    }

    selectZone(zoneId) {
        this.selectedZoneId = zoneId;
        const zone = this.getZone(zoneId);

        if (this.onZoneSelected) {
            this.onZoneSelected(zone);
        }
        this.requestRender();
    }

    setHoveredZone(zoneId) {
        if (this.hoveredZoneId !== zoneId) {
            this.hoveredZoneId = zoneId;
            this.requestRender();
            return true;
        }
        return false;
    }

    findZoneAtPoint(point, zoom = 1) {
        // Search in reverse order (top-most first)
        for (let i = this.zones.length - 1; i >= 0; i--) {
            const zone = this.zones[i];
            if (!zone.visible) continue;

            if (zone.shape === 'circle') {
                if (Utils.pointInCircle(point, { x: zone.cx, y: zone.cy }, zone.radius)) {
                    return zone;
                }
            } else if (zone.shape === 'rectangle') {
                // Check if point is inside rectangle
                if (Utils.pointInRect(point, zone)) {
                    return zone;
                }
            } else if (zone.shape === 'line') {
                // Check if point is near the line (within threshold)
                const threshold = 10 / zoom;
                const dist = this.distanceToLine(point,
                    { x: zone.x1, y: zone.y1 },
                    { x: zone.x2, y: zone.y2 }
                );
                if (dist <= threshold) {
                    return zone;
                }
            } else if (zone.points) {
                if (Utils.pointInPolygon(point, zone.points)) {
                    return zone;
                }
            }
        }
        return null;
    }

    distanceToLine(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lineLengthSquared = dx * dx + dy * dy;

        if (lineLengthSquared === 0) {
            return Utils.distance(point, lineStart);
        }

        const t = Math.max(0, Math.min(1,
            ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared
        ));

        const projection = {
            x: lineStart.x + t * dx,
            y: lineStart.y + t * dy
        };

        return Utils.distance(point, projection);
    }
}

// Export for use in other modules
window.ZoneManager = ZoneManager;
