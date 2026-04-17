/**
 * Calibration Service Module
 * Handles map calibration for coordinate transformation
 */
class CalibrationService {
    constructor(app) {
        this.app = app;
        this.elements = null;
        this.state = {
            active: false,
            pickingStep: 0, // 1 or 2
            p1: null, // {x, y} map coords
            p2: null
        };
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
            btnApply: refs.btnApplyCalibration || document.getElementById('btnApplyCalibration'),
            step1: refs.calStep1 || document.getElementById('calStep1'),
            step2: refs.calStep2 || document.getElementById('calStep2'),
            btnPick1: refs.btnPickPoint1 || document.getElementById('btnPickPoint1'),
            btnPick2: refs.btnPickPoint2 || document.getElementById('btnPickPoint2'),
            pt1Params: refs.pt1Params || document.getElementById('pt1Params'),
            pt2Params: refs.pt2Params || document.getElementById('pt2Params'),
            inputs: {
                p1x: refs.pt1WorldX || document.getElementById('pt1WorldX'),
                p1y: refs.pt1WorldY || document.getElementById('pt1WorldY'),
                p2x: refs.pt2WorldX || document.getElementById('pt2WorldX'),
                p2y: refs.pt2WorldY || document.getElementById('pt2WorldY')
            }
        };

        if (!this.elements.modal || !this.elements.btnOpen || !this.elements.btnApply) {
            console.warn('CalibrationService init skipped: calibration DOM is incomplete.');
            return;
        }

        this.setupEventListeners();
    }

    /**
     * Setup event listeners for calibration
     */
    setupEventListeners() {
        this.elements.btnOpen.addEventListener('click', () => {
            this.app.hideExportModal();
            this.showModal();
        });

        this.elements.btnClose.addEventListener('click', () => this.hideModal());
        this.elements.btnCancel.addEventListener('click', () => this.hideModal());
        this.elements.btnPick1.addEventListener('click', () => this.startPicking(1));
        this.elements.btnPick2.addEventListener('click', () => this.startPicking(2));
        this.elements.btnApply.addEventListener('click', () => this.applyCalibration());

        // Input validation to enable Apply button
        Object.values(this.elements.inputs).forEach(input => {
            input.addEventListener('input', () => this.checkReady());
        });
    }

    /**
     * Show the calibration modal
     */
    showModal() {
        this.elements.modal.classList.add('visible');
        this.resetUI();
    }

    /**
     * Hide the calibration modal
     */
    hideModal() {
        this.elements.modal.classList.remove('visible');
        this.state.active = false;
        this.state.pickingStep = 0;
        document.body.style.cursor = 'default';
        this.app.showExportModal(); // Return to export modal
    }

    /**
     * Reset the calibration UI state
     */
    resetUI() {
        this.state.p1 = null;
        this.state.p2 = null;
        this.elements.pt1Params.textContent = '-';
        this.elements.pt2Params.textContent = '-';
        this.elements.inputs.p1x.value = '';
        this.elements.inputs.p1y.value = '';
        this.elements.inputs.p2x.value = '';
        this.elements.inputs.p2y.value = '';
        this.checkReady();
    }

    /**
     * Start picking a point on the map
     * @param {number} step - Which point to pick (1 or 2)
     */
    startPicking(step) {
        this.elements.modal.classList.remove('visible');
        this.state.active = true;
        this.state.pickingStep = step;
        document.body.style.cursor = 'crosshair';

        // Add one-time click listener
        const pickHandler = (e) => {
            if (!this.state.active) return;

            e.preventDefault();
            e.stopPropagation();

            // Get coords from CanvasCore
            const rect = this.app.core.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.app.core.panX) / this.app.core.zoom;
            const y = (e.clientY - rect.top - this.app.core.panY) / this.app.core.zoom;

            this.handlePickResult(x, y);

            // Cleanup
            this.app.core.canvas.removeEventListener('click', pickHandler);
            document.body.style.cursor = 'default';
        };

        this.app.core.canvas.addEventListener('click', pickHandler, { once: true });
    }

    /**
     * Handle the result of picking a point
     * @param {number} x - X coordinate in map pixels
     * @param {number} y - Y coordinate in map pixels
     */
    handlePickResult(x, y) {
        const step = this.state.pickingStep;

        if (step === 1) {
            this.state.p1 = { x, y };
            this.elements.pt1Params.textContent = `${Math.round(x)}, ${Math.round(y)}`;
        } else if (step === 2) {
            this.state.p2 = { x, y };
            this.elements.pt2Params.textContent = `${Math.round(x)}, ${Math.round(y)}`;
        }

        this.state.active = false;
        this.state.pickingStep = 0;
        this.elements.modal.classList.add('visible');
        this.checkReady();
    }

    /**
     * Check if calibration is ready to apply
     */
    checkReady() {
        const p1Ready = this.state.p1 && this.elements.inputs.p1x.value && this.elements.inputs.p1y.value;
        const p2Ready = this.state.p2 && this.elements.inputs.p2x.value && this.elements.inputs.p2y.value;
        this.elements.btnApply.disabled = !(p1Ready && p2Ready);
    }

    /**
     * Apply the calibration and calculate scale/origin
     */
    applyCalibration() {
        const mapP1 = this.state.p1;
        const mapP2 = this.state.p2;

        const worldP1 = {
            x: parseFloat(this.elements.inputs.p1x.value),
            y: parseFloat(this.elements.inputs.p1y.value)
        };
        const worldP2 = {
            x: parseFloat(this.elements.inputs.p2x.value),
            y: parseFloat(this.elements.inputs.p2y.value)
        };

        // Distance in Map Pixels
        const distMap = Utils.distance(mapP1, mapP2);

        // Distance in World Units
        const distWorld = Utils.distance(worldP1, worldP2);

        if (distMap < 1 || distWorld < 0.1) {
            alert("Points are too close together to calibrate accurately.");
            return;
        }

        // Scale = World Units per Pixel
        const scale = distWorld / distMap;

        // Origin Calculation
        const invertY = this.app.elements.invertY.checked;

        const originX1 = worldP1.x - (mapP1.x * scale);
        const originX2 = worldP2.x - (mapP2.x * scale);

        let originY1, originY2;

        if (invertY) {
            originY1 = worldP1.y + (mapP1.y * scale);
            originY2 = worldP2.y + (mapP2.y * scale);
        } else {
            originY1 = worldP1.y - (mapP1.y * scale);
            originY2 = worldP2.y - (mapP2.y * scale);
        }

        const originX = (originX1 + originX2) / 2;
        const originY = (originY1 + originY2) / 2;

        // Apply to Export Modal Inputs
        this.app.elements.mapScale.value = scale.toFixed(4);
        this.app.elements.originX.value = originX.toFixed(2);
        this.app.elements.originY.value = originY.toFixed(2);

        this.hideModal();
    }
}

// Export for use in other modules
window.CalibrationService = CalibrationService;
