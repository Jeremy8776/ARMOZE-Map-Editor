/**
 * Grid Settings Service
 * Owns visual grid, snapping, spacing, colour and persistence settings.
 */
class GridSettingsService {
    static STORAGE_KEY = 'mapOverlay_grid_settings';
    static LEGACY_COLOR_KEY = 'mapOverlay_grid_colors';
    static DEFAULTS = Object.freeze({
        enabled: false,
        snapEnabled: false,
        gridSize: 100,
        majorColor: '#ffe66d',
        minorColor: '#ffe66d',
        labelColor: '#ffe66d'
    });

    constructor(app) {
        this.app = app;
        this.elements = {};
    }

    static normalizeColor(value, fallback) {
        const color = String(value || '').trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
    }

    static normalizeSettings(settings = {}) {
        const defaults = GridSettingsService.DEFAULTS;
        const size = Number(settings.gridSize);
        return {
            enabled: settings.enabled === true,
            snapEnabled: settings.snapEnabled === true,
            gridSize: Number.isFinite(size) && size >= 1 && size <= 100000 ? size : defaults.gridSize,
            majorColor: GridSettingsService.normalizeColor(settings.majorColor, defaults.majorColor),
            minorColor: GridSettingsService.normalizeColor(settings.minorColor, defaults.minorColor),
            labelColor: GridSettingsService.normalizeColor(settings.labelColor, defaults.labelColor)
        };
    }

    init(elements = {}) {
        this.elements = {
            modal: elements.modal || document.getElementById('gridSettingsModal'),
            btnOpen: elements.btnOpen || document.getElementById('btnOpenGridSettings'),
            btnClose: elements.btnClose || document.getElementById('btnCloseGridSettings'),
            btnDone: elements.btnDone || document.getElementById('btnDoneGridSettings'),
            btnReset: elements.btnReset || document.getElementById('btnResetGridSettings'),
            enabled: elements.enabled || document.getElementById('gridEnabled'),
            snapEnabled: elements.snapEnabled || document.getElementById('gridSnapEnabled'),
            gridSize: elements.gridSize || document.getElementById('gridSize'),
            majorColor: elements.majorColor || document.getElementById('gridMajorColor'),
            minorColor: elements.minorColor || document.getElementById('gridMinorColor'),
            labelColor: elements.labelColor || document.getElementById('gridLabelColor')
        };

        this.applySettings(this.loadSettings(), { persist: false });
        this.bindEvents();
    }

    bindEvents() {
        this.elements.btnOpen?.addEventListener('click', () => this.show());
        this.elements.btnClose?.addEventListener('click', () => this.hide());
        this.elements.btnDone?.addEventListener('click', () => this.hide());
        this.elements.modal?.addEventListener('click', event => {
            if (event.target === this.elements.modal) this.hide();
        });

        [this.elements.enabled, this.elements.snapEnabled].forEach(input => {
            input?.addEventListener('change', () => this.applyFromInputs());
        });
        this.elements.gridSize?.addEventListener('change', () => this.applyFromInputs());
        [this.elements.majorColor, this.elements.minorColor, this.elements.labelColor].forEach(input => {
            input?.addEventListener('input', () => this.applyFromInputs());
        });
        this.elements.btnReset?.addEventListener('click', () => {
            this.applySettings(GridSettingsService.DEFAULTS);
            this.app.notificationService?.showToast('Grid settings reset.', 'success');
        });
    }

    show() {
        this.syncInputs(this.getCoreSettings());
        this.elements.modal?.classList.add('visible');
    }

    hide() {
        this.elements.modal?.classList.remove('visible');
    }

    getCoreSettings() {
        const colors = this.app.core.getGridColors();
        return GridSettingsService.normalizeSettings({
            enabled: this.app.core.gridEnabled,
            snapEnabled: this.app.core.snapEnabled,
            gridSize: this.app.core.gridSize,
            majorColor: this.toHex(colors.major),
            minorColor: this.toHex(colors.minor),
            labelColor: this.toHex(colors.label)
        });
    }

    getInputSettings() {
        return GridSettingsService.normalizeSettings({
            enabled: this.elements.enabled?.checked,
            snapEnabled: this.elements.snapEnabled?.checked,
            gridSize: this.elements.gridSize?.value,
            majorColor: this.elements.majorColor?.value,
            minorColor: this.elements.minorColor?.value,
            labelColor: this.elements.labelColor?.value
        });
    }

    applyFromInputs() {
        const rawSize = Number(this.elements.gridSize?.value);
        if (!Number.isFinite(rawSize) || rawSize < 1 || rawSize > 100000) {
            this.app.notificationService?.showToast('Grid spacing must be between 1 and 100,000 metres.', 'error');
            this.syncInputs(this.getCoreSettings());
            return;
        }
        this.applySettings(this.getInputSettings());
    }

    applySettings(settings, { persist = true, sync = true } = {}) {
        const normalized = GridSettingsService.normalizeSettings(settings);
        this.app.core.setGridEnabled(normalized.enabled);
        this.app.core.setSnapEnabled(normalized.snapEnabled);
        this.app.core.setGridSize(normalized.gridSize);
        this.app.core.setGridColors({
            major: normalized.majorColor,
            minor: normalized.minorColor,
            label: normalized.labelColor
        }, { persist: false });

        if (persist) this.saveSettings(normalized);
        if (sync) this.syncInputs(normalized);
        this.syncToolbarState(normalized);
        this.app.core.requestRender();
        return normalized;
    }

    syncInputs(settings) {
        if (this.elements.enabled) this.elements.enabled.checked = settings.enabled;
        if (this.elements.snapEnabled) this.elements.snapEnabled.checked = settings.snapEnabled;
        if (this.elements.gridSize) this.elements.gridSize.value = settings.gridSize;
        if (this.elements.majorColor) this.elements.majorColor.value = settings.majorColor;
        if (this.elements.minorColor) this.elements.minorColor.value = settings.minorColor;
        if (this.elements.labelColor) this.elements.labelColor.value = settings.labelColor;
    }

    syncToolbarState(settings) {
        const button = this.app.elements?.btnOpenGridSettings || this.elements.btnOpen;
        button?.classList.toggle('active', settings.enabled);
        if (button) {
            const gridState = settings.enabled ? 'on' : 'off';
            const snapState = settings.snapEnabled ? ', snap on' : '';
            button.title = `Grid Settings (grid ${gridState}${snapState})`;
        }
    }

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(GridSettingsService.STORAGE_KEY) || 'null');
            if (saved) return GridSettingsService.normalizeSettings(saved);

            const legacy = JSON.parse(localStorage.getItem(GridSettingsService.LEGACY_COLOR_KEY) || 'null');
            if (legacy) {
                return GridSettingsService.normalizeSettings({
                    ...GridSettingsService.DEFAULTS,
                    majorColor: this.toHex(legacy.major),
                    minorColor: this.toHex(legacy.minor),
                    labelColor: this.toHex(legacy.label)
                });
            }
        } catch (error) {
            console.warn('Failed to load grid settings.', error);
        }
        return { ...GridSettingsService.DEFAULTS };
    }

    saveSettings(settings) {
        try {
            localStorage.setItem(GridSettingsService.STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save grid settings.', error);
        }
    }

    toHex(value) {
        const color = String(value || '');
        if (/^#[0-9a-f]{6}/i.test(color)) return color.slice(0, 7).toLowerCase();
        const match = color.match(/rgba?\(([^)]+)\)/i);
        if (!match) return GridSettingsService.DEFAULTS.majorColor;
        const [r, g, b] = match[1].split(',').map(part => Math.max(0, Math.min(255, Number(part))));
        if (![r, g, b].every(Number.isFinite)) return GridSettingsService.DEFAULTS.majorColor;
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
}

window.GridSettingsService = GridSettingsService;
