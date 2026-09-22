/**
 * Calibration Service Module
 * Handles map calibration for coordinate transformation.
 * Calibration is derived from the terrain world size and persisted per map
 * dimensions so the same map never needs re-calibrating.
 */
class CalibrationService {
    constructor(app) {
        this.app = app;
        this.elements = null;
        this.storageKey = 'mapOverlay_map_calibration';
    }

    /**
     * Quick setup for full-terrain images: derive metres-per-pixel from the
     * terrain world size, with the world origin at the image bottom-left.
     */
    static getWorldSizeSettings(mapWidth, mapHeight, worldWidth, worldDepth) {
        const width = Number(mapWidth);
        const height = Number(mapHeight);
        const worldW = Number(worldWidth);
        const worldD = Number(worldDepth);
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new Error('Load a map before applying world size.');
        }
        if (!Number.isFinite(worldW) || worldW <= 0 || !Number.isFinite(worldD) || worldD <= 0) {
            throw new Error('Enter the terrain width and depth in metres.');
        }
        const scaleX = worldW / width;
        const scaleZ = worldD / height;
        const average = (scaleX + scaleZ) / 2;
        if (Math.abs(scaleX - scaleZ) / average > 0.02) {
            throw new Error('World size does not match the image aspect ratio.');
        }
        return { scale: scaleX, originX: 0, originZ: 0 };
    }

    static getCalibrationKey(mapWidth, mapHeight) {
        return `${Number(mapWidth)}x${Number(mapHeight)}`;
    }

    /**
     * Initialize the calibration service
     * @param {Object} elements - DOM elements for calibration
     */
    init(elements) {
        const refs = elements || {};
        this.elements = {
            modal: refs.calibrationModal || document.getElementById('calibrationModal'),
            btnOpen: refs.btnOpenCalibration || document.getElementById('btnOpenCalibration'),
            btnClose: refs.btnCloseCalibration || document.getElementById('btnCloseCalibration'),
            btnCancel: refs.btnCancelCalibration || document.getElementById('btnCancelCalibration'),
            worldSizeWidth: refs.worldSizeWidth || document.getElementById('worldSizeWidth'),
            worldSizeDepth: refs.worldSizeDepth || document.getElementById('worldSizeDepth'),
            btnApplyWorldSize: refs.btnApplyWorldSize || document.getElementById('btnApplyWorldSize')
        };

        if (!this.elements.modal || !this.elements.btnApplyWorldSize) {
            console.warn('CalibrationService init skipped: calibration DOM is incomplete.');
            return;
        }

        this.setupEventListeners();
    }

    /**
     * Setup event listeners for calibration
     */
    setupEventListeners() {
        this.elements.btnOpen?.addEventListener('click', () => {
            this.app.hideExportModal();
            this.openedFromExport = true;
            this.showModal();
        });

        const btnOpenToolbar = document.getElementById('btnOpenCalibrationToolbar');
        btnOpenToolbar?.addEventListener('click', () => {
            if (!this.app.core.mapImage) {
                this.app.notificationService?.showToast('Load a map before calibrating.', 'error');
                return;
            }
            this.showModal();
        });

        this.elements.btnClose.addEventListener('click', () => this.hideModal());
        this.elements.btnCancel.addEventListener('click', () => this.hideModal());
        this.elements.btnApplyWorldSize.addEventListener('click', () => this.applyWorldSize());
    }

    /**
     * Show the calibration modal
     */
    showModal() {
        this.elements.modal.classList.add('visible');
        this.restoreWorldSizeInputs();
    }

    /**
     * Hide the calibration modal
     */
    hideModal() {
        this.elements.modal.classList.remove('visible');
        // Only return to the export modal when calibration was opened from it.
        if (this.openedFromExport) {
            this.openedFromExport = false;
            this.app.showExportModal();
        }
    }

    /**
     * Pre-fill the world-size inputs from the saved calibration for this map.
     */
    restoreWorldSizeInputs() {
        const saved = this.getSavedCalibration();
        if (!saved) return;
        const width = saved.scale * this.app.core.mapWidth;
        const depth = saved.scale * this.app.core.mapHeight;
        if (Number.isFinite(width) && width > 0) {
            this.elements.worldSizeWidth.value = Math.round(width * 1000) / 1000;
        }
        if (Number.isFinite(depth) && depth > 0) {
            this.elements.worldSizeDepth.value = Math.round(depth * 1000) / 1000;
        }
    }

    getStorage() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        } catch (error) {
            return {};
        }
    }

    getSavedCalibration() {
        const { mapWidth, mapHeight } = this.app.core;
        if (!mapWidth || !mapHeight) return null;
        return this.getStorage()[CalibrationService.getCalibrationKey(mapWidth, mapHeight)] || null;
    }

    saveCalibration(settings) {
        const { mapWidth, mapHeight } = this.app.core;
        if (!mapWidth || !mapHeight) return;
        const storage = this.getStorage();
        storage[CalibrationService.getCalibrationKey(mapWidth, mapHeight)] = settings;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(storage));
        } catch (error) {
            console.warn('Failed to save map calibration.', error);
        }
    }

    /**
     * Restore a saved calibration for the current map dimensions, if any.
     * @returns {boolean} true when a saved calibration was applied
     */
    restoreSavedCalibration() {
        const saved = this.getSavedCalibration();
        if (!saved || !Number.isFinite(saved.scale) || saved.scale <= 0) return false;
        this.app.coordinateSystem.setSettings(saved, { notify: false });
        return true;
    }

    /**
     * Apply terrain world size as the map calibration and persist it.
     */
    applyWorldSize() {
        try {
            const settings = CalibrationService.getWorldSizeSettings(
                this.app.core.mapWidth,
                this.app.core.mapHeight,
                this.elements.worldSizeWidth.value,
                this.elements.worldSizeDepth.value
            );
            this.app.coordinateSystem.setSettings(settings);
            this.saveCalibration(settings);
            this.app.tabManager?.markActiveTabDirty();
            this.app.notificationService?.showToast(
                `Calibrated: ${settings.scale.toFixed(3)} m per pixel. Saved for this map size.`,
                'success'
            );
            this.hideModal();
        } catch (err) {
            this.app.notificationService?.showAlert(err.message, {
                title: 'Calibration Error',
                tone: 'danger'
            });
        }
    }
}

// Export for use in other modules
window.CalibrationService = CalibrationService;