/**
 * Enfusion coordinate system service.
 * Converts canvas map pixels into Workbench world-plane X/Z metres.
 * Canvas Y increases downward; Enfusion Z increases north/up on a north-up map.
 */
class CoordinateSystemService {
    constructor(core, onChanged = null) {
        this.core = core;
        this.onChanged = onChanged;
        this.settings = {
            scale: 1,
            originX: 0,
            originZ: 0
        };
    }

    getSettings() {
        return { ...this.settings };
    }

    setSettings(settings = {}, options = {}) {
        const next = {
            scale: this.toFiniteNumber(settings.scale, this.settings.scale),
            originX: this.toFiniteNumber(settings.originX, this.settings.originX),
            originZ: this.toFiniteNumber(settings.originZ, this.settings.originZ)
        };

        if (next.scale <= 0) {
            throw new Error('Map scale must be greater than zero.');
        }

        this.settings = next;
        if (options.notify !== false && this.onChanged) {
            this.onChanged(this.getSettings());
        }
        return this.getSettings();
    }

    reset(options = {}) {
        return this.setSettings({ scale: 1, originX: 0, originZ: 0 }, options);
    }

    getMapHeight() {
        const height = Number(this.core?.mapHeight);
        return Number.isFinite(height) ? height : 0;
    }

    mapToWorld(point) {
        const scale = this.settings.scale;
        return {
            x: this.settings.originX + (point.x * scale),
            z: this.settings.originZ + ((this.getMapHeight() - point.y) * scale)
        };
    }

    worldToMap(point) {
        const scale = this.settings.scale;
        return {
            x: (point.x - this.settings.originX) / scale,
            y: this.getMapHeight() - ((point.z - this.settings.originZ) / scale)
        };
    }

    mapLengthToWorld(length) {
        return length * this.settings.scale;
    }

    worldLengthToMap(length) {
        return length / this.settings.scale;
    }

    transformZone(zone) {
        const transformed = { ...zone };

        if (zone.cx !== undefined && zone.cy !== undefined) {
            const center = this.mapToWorld({ x: zone.cx, y: zone.cy });
            transformed.cx = center.x;
            transformed.cy = center.z;
            transformed.radius = this.mapLengthToWorld(zone.radius || 0);
        } else if (
            zone.x !== undefined && zone.y !== undefined &&
            zone.width !== undefined && zone.height !== undefined
        ) {
            const minimum = this.mapToWorld({
                x: zone.x,
                y: zone.y + zone.height
            });
            transformed.x = minimum.x;
            transformed.y = minimum.z;
            transformed.width = this.mapLengthToWorld(zone.width);
            transformed.height = this.mapLengthToWorld(zone.height);
        }

        if (
            zone.x1 !== undefined && zone.y1 !== undefined &&
            zone.x2 !== undefined && zone.y2 !== undefined
        ) {
            const start = this.mapToWorld({ x: zone.x1, y: zone.y1 });
            const end = this.mapToWorld({ x: zone.x2, y: zone.y2 });
            transformed.x1 = start.x;
            transformed.y1 = start.z;
            transformed.x2 = end.x;
            transformed.y2 = end.z;
        }

        if (Array.isArray(zone.points)) {
            transformed.points = zone.points.map(point => {
                const world = this.mapToWorld(point);
                return { x: world.x, y: world.z };
            });
        }

        return transformed;
    }

    calibrate(mapPoint1, worldPoint1, mapPoint2, worldPoint2) {
        const mapVector = {
            x: mapPoint2.x - mapPoint1.x,
            z: mapPoint1.y - mapPoint2.y
        };
        const worldVector = {
            x: worldPoint2.x - worldPoint1.x,
            z: worldPoint2.z - worldPoint1.z
        };
        const candidates = [];
        const epsilon = 0.0001;

        if (Math.abs(mapVector.x) > epsilon) {
            candidates.push(worldVector.x / mapVector.x);
        }
        if (Math.abs(mapVector.z) > epsilon) {
            candidates.push(worldVector.z / mapVector.z);
        }
        if (candidates.length === 0 || candidates.some(scale => !Number.isFinite(scale) || scale <= 0)) {
            throw new Error('Reference points must follow Enfusion orientation: X right and Z up.');
        }

        const scale = candidates.reduce((total, value) => total + value, 0) / candidates.length;
        if (candidates.length === 2) {
            const difference = Math.abs(candidates[0] - candidates[1]) / scale;
            if (difference > 0.02) {
                throw new Error('Reference points do not produce one uniform metres-per-pixel scale.');
            }
        }

        const mapWorld1 = {
            x: mapPoint1.x * scale,
            z: (this.getMapHeight() - mapPoint1.y) * scale
        };
        const mapWorld2 = {
            x: mapPoint2.x * scale,
            z: (this.getMapHeight() - mapPoint2.y) * scale
        };
        const settings = {
            scale,
            originX: ((worldPoint1.x - mapWorld1.x) + (worldPoint2.x - mapWorld2.x)) / 2,
            originZ: ((worldPoint1.z - mapWorld1.z) + (worldPoint2.z - mapWorld2.z)) / 2
        };

        return this.setSettings(settings);
    }

    toFiniteNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }
}

window.CoordinateSystemService = CoordinateSystemService;
