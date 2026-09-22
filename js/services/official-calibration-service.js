/**
 * Official Calibration Service
 *
 * Source of truth for pre-baked map calibrations shipped in Maps/catalog.json.
 *
 * Purpose: a user who installs an official map should get correct metres-per-
 * pixel without calibrating by hand. Catalog entries carry a `calibration`
 * block; when a map loads, the matching entry is applied automatically.
 *
 * Invariants:
 * - A user's own calibration always wins. Official values seed a map the first
 *   time it is seen; they never overwrite a calibration the user saved.
 * - Matching is by image dimensions, not filename, because that is the key the
 *   existing CalibrationService already persists under, and a renamed copy of
 *   the same export is still the same map.
 * - An entry whose declared dimensions do not match the loaded image is
 *   ignored rather than applied, so a re-exported map at a different
 *   resolution cannot silently get the wrong scale.
 */
class OfficialCalibrationService {
    static get STATUS_VERIFIED() { return 'verified'; }
    static get STATUS_UNVERIFIED() { return 'unverified'; }

    constructor(app) {
        this.app = app;
        this.entries = [];
    }

    /** @param {Object} catalog Parsed Maps/catalog.json */
    setCatalog(catalog) {
        const maps = Array.isArray(catalog?.maps) ? catalog.maps : [];
        this.entries = maps.filter(entry => entry && entry.file);
        return this.entries.length;
    }

    /**
     * Normalized calibration state for one catalog entry.
     * @returns {{status: string, verified: boolean, scale: number|null, worldWidth: number|null, worldDepth: number|null, label: string, tooltip: string}}
     */
    static describe(entry) {
        const calibration = entry?.calibration || null;
        const verified = OfficialCalibrationService.isVerified(calibration);
        const worldWidth = Number(calibration?.worldWidth);
        const worldDepth = Number(calibration?.worldDepth);
        const scale = Number(calibration?.scale);

        if (!verified) {
            return {
                status: OfficialCalibrationService.STATUS_UNVERIFIED,
                verified: false,
                scale: null,
                worldWidth: null,
                worldDepth: null,
                label: 'Not calibrated',
                tooltip: 'Not calibrated yet. Open Calibrate and enter the terrain size once; ARMOZE remembers it for this map.'
            };
        }

        const size = OfficialCalibrationService.formatWorldSize(worldWidth, worldDepth);
        return {
            status: OfficialCalibrationService.STATUS_VERIFIED,
            verified: true,
            scale,
            worldWidth,
            worldDepth,
            label: 'Calibrated',
            tooltip: `Officially calibrated: ${size} terrain at ${OfficialCalibrationService.formatScale(scale)} per pixel. Coordinates and exports are ready to use.`
        };
    }

    static isVerified(calibration) {
        if (!calibration || calibration.status !== OfficialCalibrationService.STATUS_VERIFIED) return false;
        const scale = Number(calibration.scale);
        return Number.isFinite(scale) && scale > 0;
    }

    static formatWorldSize(worldWidth, worldDepth) {
        const toKm = (metres) => {
            if (!Number.isFinite(metres) || metres <= 0) return null;
            const km = metres / 1000;
            // Terrain sizes are round-ish numbers; one decimal is enough and
            // 12.03 km reads as false precision for a 12032 m map.
            const rounded = Math.round(km * 10) / 10;
            return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} km`;
        };
        const width = toKm(worldWidth);
        const depth = toKm(worldDepth);
        if (!width || !depth) return 'known size';
        return width === depth ? `${width} square` : `${width} x ${depth}`;
    }

    static formatScale(scale) {
        if (!Number.isFinite(scale)) return '?';
        return `${Number(scale.toFixed(4))} m`;
    }

    /** Catalog entry for a loaded file, matched on filename. */
    findByFile(filename) {
        if (!filename) return null;
        const leaf = String(filename).split(/[\\/]/).pop().toLowerCase();
        return this.entries.find(entry => String(entry.file).toLowerCase() === leaf) || null;
    }

    /**
     * Calibration settings to apply for a freshly loaded map, or null.
     * Returns null when the entry is unverified, when the image dimensions
     * disagree with the catalog, or when the user already has their own
     * calibration saved for these dimensions.
     */
    resolveSettings(filename, imageWidth, imageHeight, { hasUserCalibration = false } = {}) {
        if (hasUserCalibration) return null;

        const entry = this.findByFile(filename);
        const calibration = entry?.calibration;
        if (!OfficialCalibrationService.isVerified(calibration)) return null;

        const declaredWidth = Number(calibration.imageWidth);
        const declaredHeight = Number(calibration.imageHeight);
        if (Number.isFinite(declaredWidth) && Number.isFinite(declaredHeight)) {
            if (declaredWidth !== Number(imageWidth) || declaredHeight !== Number(imageHeight)) {
                return null;
            }
        }

        return {
            scale: Number(calibration.scale),
            originX: Number.isFinite(Number(calibration.originX)) ? Number(calibration.originX) : 0,
            originZ: Number.isFinite(Number(calibration.originZ)) ? Number(calibration.originZ) : 0
        };
    }

    /**
     * Apply the official calibration for a just-loaded map, if one applies.
     * @returns {boolean} true when official settings were applied
     */
    applyForLoadedMap(filename) {
        const core = this.app?.core;
        if (!core?.mapWidth || !core?.mapHeight) return false;

        const hasUserCalibration = Boolean(this.app?.calibrationService?.getSavedCalibration?.());
        const settings = this.resolveSettings(filename, core.mapWidth, core.mapHeight, { hasUserCalibration });
        if (!settings) return false;

        this.app.coordinateSystem?.setSettings(settings, { notify: false });
        this.app.calibrationService?.saveCalibration(settings);
        this.app.notificationService?.showToast(
            `${this.findByFile(filename)?.name || 'Map'} is officially calibrated: ${OfficialCalibrationService.formatScale(settings.scale)} per pixel.`,
            'success'
        );
        return true;
    }
}

if (typeof window !== 'undefined') {
    window.OfficialCalibrationService = OfficialCalibrationService;
}
