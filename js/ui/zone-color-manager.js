/**
 * Zone Color Manager
 * Owns recent-color history (zone fill, label text, label background) plus
 * the tiny helpers that keep the custom color-wheel swatches in visual sync
 * with their underlying <input type="color"> value.
 *
 * Extracted from ZonePropertiesUI so color persistence, rendering of the
 * recent-color chip rows, and preview sync are in one place instead of woven
 * through the panel class.
 */
const RECENT_COLORS_STORAGE_KEY = 'mapOverlay_recent_colors';
const RECENT_COLORS_MAX = 10;

const DEFAULT_RECENT_COLORS = {
    zone: ['#00ff88', '#ffffff', '#000000', '#ff4757', '#0066ff'],
    label: ['#ffffff', '#00ff88', '#0066ff', '#ff4757', '#000000'],
    labelBg: ['#000000', '#ffffff', '#00ff88', '#1a1a1a', '#ff4757']
};

class ZoneColorManager {
    constructor(propertiesUI) {
        this.ui = propertiesUI;
        this.recent = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(RECENT_COLORS_STORAGE_KEY) || '[]';
            const data = JSON.parse(raw);

            // v1 stored a flat array of zone colors. Migrate by promoting the
            // array into the new section-keyed shape when present.
            if (Array.isArray(data)) {
                return {
                    zone: (data.length ? data : DEFAULT_RECENT_COLORS.zone).slice(0, RECENT_COLORS_MAX),
                    label: DEFAULT_RECENT_COLORS.label.slice(0, RECENT_COLORS_MAX),
                    labelBg: DEFAULT_RECENT_COLORS.labelBg.slice(0, RECENT_COLORS_MAX)
                };
            }

            if (data && typeof data === 'object') {
                return {
                    zone: this._pickSection(data.zone, DEFAULT_RECENT_COLORS.zone),
                    label: this._pickSection(data.label, DEFAULT_RECENT_COLORS.label),
                    labelBg: this._pickSection(data.labelBg, DEFAULT_RECENT_COLORS.labelBg)
                };
            }
        } catch (err) {
            console.warn('[ZoneColorManager] Failed to parse recent colors, using defaults.', err);
        }

        return {
            zone: DEFAULT_RECENT_COLORS.zone.slice(0, RECENT_COLORS_MAX),
            label: DEFAULT_RECENT_COLORS.label.slice(0, RECENT_COLORS_MAX),
            labelBg: DEFAULT_RECENT_COLORS.labelBg.slice(0, RECENT_COLORS_MAX)
        };
    }

    save() {
        try {
            localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify({
                zone: (this.recent.zone || []).slice(0, RECENT_COLORS_MAX),
                label: (this.recent.label || []).slice(0, RECENT_COLORS_MAX),
                labelBg: (this.recent.labelBg || []).slice(0, RECENT_COLORS_MAX)
            }));
        } catch (err) {
            console.warn('[ZoneColorManager] Failed to persist recent colors.', err);
        }
    }

    remember(section, color) {
        if (!color) return;
        const key = section || 'zone';
        const normalized = color.toLowerCase();
        const existing = Array.isArray(this.recent[key]) ? this.recent[key] : [];
        this.recent[key] = [normalized, ...existing.filter(c => c.toLowerCase() !== normalized)]
            .slice(0, RECENT_COLORS_MAX);
        this.save();
        this.renderRows();
    }

    /**
     * Sync the custom swatch shell so the wheel preview matches the input value.
     */
    syncInputPreview(input) {
        if (!input) return;
        const shell = input.closest('.color-wheel-control');
        if (shell) shell.style.setProperty('--selected-color', input.value || '#ffffff');
    }

    setColorInputValue(inputOrKey, value, fallback = '#ffffff') {
        const input = typeof inputOrKey === 'string'
            ? this.ui.elements[inputOrKey]
            : inputOrKey;
        if (!input) return;
        input.value = value || fallback;
        this.syncInputPreview(input);
    }

    syncAllPreviews() {
        const els = this.ui.elements;
        this.syncInputPreview(els.zoneColor);
        this.syncInputPreview(els.quickZoneColor);
        this.syncInputPreview(els.labelColor);
        this.syncInputPreview(els.labelBgColor);
    }

    /**
     * Render the recent-color chip rows under each color picker.
     * Chips are created through DOM APIs so user-supplied hex values cannot
     * escape attribute quoting.
     */
    renderRows() {
        const els = this.ui.elements;
        const rows = [
            { container: els.zoneRecentColors, input: els.zoneColor, section: 'zone' },
            { container: els.labelRecentColors, input: els.labelColor, section: 'label' },
            { container: els.labelBgRecentColors, input: els.labelBgColor, section: 'labelBg' }
        ];

        rows.forEach(({ container, input, section }) => {
            if (!container || !input) return;

            container.innerHTML = '';
            const colors = Array.isArray(this.recent[section]) ? this.recent[section] : [];

            colors.forEach(color => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'recent-color-chip';
                chip.dataset.color = color;
                chip.title = color;
                chip.style.setProperty('--chip-color', color);
                chip.addEventListener('click', () => {
                    this.setColorInputValue(input, color);
                    this.remember(section, color);
                    if (els.zoneProfile) els.zoneProfile.value = 'custom';
                    this.ui.updateSelectedZone();
                });
                container.appendChild(chip);
            });
        });
    }

    _pickSection(candidate, fallback) {
        if (Array.isArray(candidate) && candidate.length) {
            return candidate.slice(0, RECENT_COLORS_MAX);
        }
        return fallback.slice(0, RECENT_COLORS_MAX);
    }
}

window.ZoneColorManager = ZoneColorManager;
