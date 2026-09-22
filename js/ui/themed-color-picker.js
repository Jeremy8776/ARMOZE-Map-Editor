/**
 * Themed Color Picker
 * Replaces Chromium's native colour popup with an ARMOZE-owned surface while
 * retaining the existing input/change event contract used throughout the app.
 */
class ThemedColorPicker {
    constructor() {
        this.panel = null;
        this.activeInput = null;
        this.originalColor = null;
        this.hsv = { h: 0, s: 0, v: 1 };
        this.draggingSaturation = false;
        this.closeTimer = null;
    }

    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value)));
    }

    static normalizeHex(value) {
        const raw = String(value || '').trim().replace(/^#/, '');
        if (/^[0-9a-f]{3}$/i.test(raw)) {
            return `#${raw.split('').map(char => char + char).join('').toLowerCase()}`;
        }
        if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
        return null;
    }

    static hexToRgb(hex) {
        const normalized = ThemedColorPicker.normalizeHex(hex);
        if (!normalized) return { r: 255, g: 255, b: 255 };
        return {
            r: parseInt(normalized.slice(1, 3), 16),
            g: parseInt(normalized.slice(3, 5), 16),
            b: parseInt(normalized.slice(5, 7), 16)
        };
    }

    static rgbToHex({ r, g, b }) {
        const channel = value => Math.round(ThemedColorPicker.clamp(value, 0, 255))
            .toString(16)
            .padStart(2, '0');
        return `#${channel(r)}${channel(g)}${channel(b)}`;
    }

    static rgbToHsv({ r, g, b }) {
        const red = ThemedColorPicker.clamp(r, 0, 255) / 255;
        const green = ThemedColorPicker.clamp(g, 0, 255) / 255;
        const blue = ThemedColorPicker.clamp(b, 0, 255) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;

        if (delta) {
            if (max === red) hue = 60 * (((green - blue) / delta) % 6);
            else if (max === green) hue = 60 * (((blue - red) / delta) + 2);
            else hue = 60 * (((red - green) / delta) + 4);
        }
        if (hue < 0) hue += 360;

        return {
            h: hue,
            s: max === 0 ? 0 : delta / max,
            v: max
        };
    }

    static hexToHsv(hex) {
        return ThemedColorPicker.rgbToHsv(ThemedColorPicker.hexToRgb(hex));
    }

    static hsvToRgb({ h, s, v }) {
        const hue = ((Number(h) % 360) + 360) % 360;
        const saturation = ThemedColorPicker.clamp(s, 0, 1);
        const value = ThemedColorPicker.clamp(v, 0, 1);
        const chroma = value * saturation;
        const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
        const match = value - chroma;
        let red = 0;
        let green = 0;
        let blue = 0;

        if (hue < 60) [red, green] = [chroma, x];
        else if (hue < 120) [red, green] = [x, chroma];
        else if (hue < 180) [green, blue] = [chroma, x];
        else if (hue < 240) [green, blue] = [x, chroma];
        else if (hue < 300) [red, blue] = [x, chroma];
        else [red, blue] = [chroma, x];

        return {
            r: Math.round((red + match) * 255),
            g: Math.round((green + match) * 255),
            b: Math.round((blue + match) * 255)
        };
    }

    static hsvToHex(hsv) {
        return ThemedColorPicker.rgbToHex(ThemedColorPicker.hsvToRgb(hsv));
    }

    init() {
        this.buildPanel();
        document.addEventListener('pointerdown', event => this.handleDocumentPointerDown(event), true);
        document.addEventListener('click', event => this.handleDocumentClick(event), true);
        document.addEventListener('keydown', event => this.handleDocumentKeyDown(event), true);
        window.addEventListener('resize', () => this.position());
        window.addEventListener('scroll', () => this.position(), true);
    }

    buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'themed-color-picker';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'false');
        panel.hidden = true;
        panel.innerHTML = `
            <div class="themed-color-picker__header">
                <div class="themed-color-picker__identity">
                    <span class="themed-color-picker__swatch" aria-hidden="true"></span>
                    <span><strong>Color</strong><small data-role="picker-value">#FFFFFF</small></span>
                </div>
                <button type="button" class="themed-color-picker__close" data-action="close" aria-label="Close colour picker">&times;</button>
            </div>
            <div class="themed-color-picker__sv" data-role="saturation" tabindex="0" aria-label="Colour saturation and brightness">
                <span class="themed-color-picker__cursor" data-role="cursor"></span>
            </div>
            <label class="themed-color-picker__hue-row">
                <span>Hue</span>
                <input type="range" min="0" max="359" step="1" value="0" data-role="hue" aria-label="Hue">
            </label>
            <div class="themed-color-picker__fields">
                <label class="themed-color-picker__field themed-color-picker__field--hex"><span>Hex</span><input type="text" maxlength="7" spellcheck="false" data-role="hex"></label>
                <label class="themed-color-picker__field"><span>R</span><input type="text" inputmode="numeric" maxlength="3" data-role="red"></label>
                <label class="themed-color-picker__field"><span>G</span><input type="text" inputmode="numeric" maxlength="3" data-role="green"></label>
                <label class="themed-color-picker__field"><span>B</span><input type="text" inputmode="numeric" maxlength="3" data-role="blue"></label>
            </div>
            <div class="themed-color-picker__footer">
                <button type="button" class="themed-color-picker__eyedropper" data-action="eyedropper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 0 1 3 3L18 9"/><path d="m15 6 3 3"/><path d="M12 9 6.5 3.5"/><path d="M18 15.5 12.5 10"/></svg>
                    Pick from screen
                </button>
                <button type="button" class="themed-color-picker__done" data-action="done">Done</button>
            </div>`;
        document.body.appendChild(panel);
        this.panel = panel;
        this.panel.querySelector('[data-action="eyedropper"]').hidden = !window.EyeDropper;
        this.bindPanelEvents();
    }

    bindPanelEvents() {
        const saturation = this.panel.querySelector('[data-role="saturation"]');
        const hue = this.panel.querySelector('[data-role="hue"]');
        const hex = this.panel.querySelector('[data-role="hex"]');
        const rgbFields = ['red', 'green', 'blue'].map(role => this.panel.querySelector(`[data-role="${role}"]`));

        saturation.addEventListener('pointerdown', event => {
            event.preventDefault();
            this.draggingSaturation = true;
            saturation.setPointerCapture?.(event.pointerId);
            this.updateSaturation(event);
        });
        saturation.addEventListener('pointermove', event => {
            if (this.draggingSaturation) this.updateSaturation(event);
        });
        ['pointerup', 'pointercancel'].forEach(type => saturation.addEventListener(type, () => {
            this.draggingSaturation = false;
        }));
        saturation.addEventListener('keydown', event => this.nudgeSaturation(event));

        hue.addEventListener('input', () => {
            this.hsv.h = Number(hue.value);
            this.applyHsv();
        });
        hex.addEventListener('input', () => {
            const normalized = ThemedColorPicker.normalizeHex(hex.value);
            if (normalized) this.applyHex(normalized);
        });
        hex.addEventListener('blur', () => this.syncPanel());
        rgbFields.forEach(input => input.addEventListener('input', () => this.applyRgbFields()));

        this.panel.querySelector('[data-action="close"]').addEventListener('click', () => this.close({ commit: true }));
        this.panel.querySelector('[data-action="done"]').addEventListener('click', () => this.close({ commit: true }));
        this.panel.querySelector('[data-action="eyedropper"]').addEventListener('click', () => this.pickFromScreen());
    }

    handleDocumentPointerDown(event) {
        const input = event.target.closest?.('input[type="color"]');
        if (input) {
            event.preventDefault();
            event.stopPropagation();
            input.focus({ preventScroll: true });
            if (this.activeInput !== input) this.open(input);
            return;
        }
        if (!this.panel.hidden && !this.panel.contains(event.target)) this.close({ commit: true });
    }

    handleDocumentClick(event) {
        const input = event.target.closest?.('input[type="color"]');
        if (!input) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.activeInput !== input) this.open(input);
    }

    handleDocumentKeyDown(event) {
        const input = event.target.closest?.('input[type="color"]');
        if (input && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            this.open(input);
            return;
        }
        if (event.key === 'Escape' && !this.panel.hidden) {
            event.preventDefault();
            this.close({ commit: false });
        }
    }

    open(input) {
        if (this.activeInput && this.activeInput !== input) this.close({ commit: true, immediate: true });
        clearTimeout(this.closeTimer);
        this.activeInput = input;
        this.originalColor = ThemedColorPicker.normalizeHex(input.value) || '#ffffff';
        this.hsv = ThemedColorPicker.hexToHsv(this.originalColor);
        this.panel.setAttribute('aria-label', this.getInputLabel(input));
        this.panel.hidden = false;
        this.panel.classList.remove('is-visible');
        this.syncPanel();
        this.position();
        requestAnimationFrame(() => this.panel.classList.add('is-visible'));
    }

    close({ commit = true, immediate = false } = {}) {
        if (!this.activeInput || !this.panel) return;
        const input = this.activeInput;
        const changed = input.value.toLowerCase() !== this.originalColor.toLowerCase();

        if (!commit && changed) {
            input.value = this.originalColor;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (commit && changed) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this.activeInput = null;
        this.panel.classList.remove('is-visible');
        clearTimeout(this.closeTimer);
        const finish = () => {
            if (!this.activeInput) this.panel.hidden = true;
        };
        if (immediate) finish();
        else this.closeTimer = setTimeout(finish, 130);
    }

    updateSaturation(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        this.hsv.s = ThemedColorPicker.clamp((event.clientX - rect.left) / rect.width, 0, 1);
        this.hsv.v = 1 - ThemedColorPicker.clamp((event.clientY - rect.top) / rect.height, 0, 1);
        this.applyHsv();
    }

    nudgeSaturation(event) {
        const amount = event.shiftKey ? 0.05 : 0.01;
        if (event.key === 'ArrowLeft') this.hsv.s -= amount;
        else if (event.key === 'ArrowRight') this.hsv.s += amount;
        else if (event.key === 'ArrowUp') this.hsv.v += amount;
        else if (event.key === 'ArrowDown') this.hsv.v -= amount;
        else return;
        event.preventDefault();
        this.hsv.s = ThemedColorPicker.clamp(this.hsv.s, 0, 1);
        this.hsv.v = ThemedColorPicker.clamp(this.hsv.v, 0, 1);
        this.applyHsv();
    }

    applyHsv() {
        this.applyColor(ThemedColorPicker.hsvToHex(this.hsv), false);
    }

    applyHex(hex) {
        this.hsv = ThemedColorPicker.hexToHsv(hex);
        this.applyColor(hex, false);
    }

    applyRgbFields() {
        const values = ['red', 'green', 'blue'].map(role => Number(this.panel.querySelector(`[data-role="${role}"]`).value));
        if (!values.every(Number.isFinite)) return;
        const hex = ThemedColorPicker.rgbToHex({ r: values[0], g: values[1], b: values[2] });
        this.hsv = ThemedColorPicker.hexToHsv(hex);
        this.applyColor(hex, false);
    }

    applyColor(color, preserveFocusedField = true) {
        if (!this.activeInput) return;
        const normalized = ThemedColorPicker.normalizeHex(color);
        if (!normalized) return;
        this.activeInput.value = normalized;
        this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.syncPanel(preserveFocusedField ? document.activeElement : null);
    }

    syncPanel(preserveElement = null) {
        if (!this.activeInput) return;
        const color = ThemedColorPicker.hsvToHex(this.hsv);
        const rgb = ThemedColorPicker.hexToRgb(color);
        const hueColor = ThemedColorPicker.hsvToHex({ h: this.hsv.h, s: 1, v: 1 });
        const saturation = this.panel.querySelector('[data-role="saturation"]');
        const cursor = this.panel.querySelector('[data-role="cursor"]');

        this.panel.style.setProperty('--picker-color', color);
        this.panel.style.setProperty('--picker-hue', hueColor);
        cursor.style.left = `${this.hsv.s * 100}%`;
        cursor.style.top = `${(1 - this.hsv.v) * 100}%`;
        this.panel.querySelector('[data-role="hue"]').value = Math.round(this.hsv.h);
        this.panel.querySelector('[data-role="picker-value"]').textContent = color.toUpperCase();
        saturation.setAttribute('aria-valuetext', `${Math.round(this.hsv.s * 100)}% saturation, ${Math.round(this.hsv.v * 100)}% brightness`);

        const fieldValues = {
            hex: color.toUpperCase(),
            red: rgb.r,
            green: rgb.g,
            blue: rgb.b
        };
        Object.entries(fieldValues).forEach(([role, value]) => {
            const field = this.panel.querySelector(`[data-role="${role}"]`);
            if (field !== preserveElement) field.value = value;
        });
    }

    async pickFromScreen() {
        if (!window.EyeDropper) return;
        try {
            const result = await new window.EyeDropper().open();
            if (result?.sRGBHex) this.applyHex(result.sRGBHex);
        } catch (error) {
            // Escape and cancelled screen picks are expected.
        }
    }

    getInputLabel(input) {
        const labels = {
            zoneColor: 'Zone colour',
            quickZoneColor: 'Zone colour',
            labelColor: 'Label colour',
            labelBgColor: 'Label background colour',
            gridMajorColor: 'Major grid line colour',
            gridMinorColor: 'Minor grid line colour',
            gridLabelColor: 'Grid label colour'
        };
        return labels[input.id] || input.getAttribute('aria-label') || 'Colour picker';
    }

    position() {
        if (!this.activeInput || this.panel.hidden) return;
        const anchor = this.activeInput.getBoundingClientRect();
        const width = this.panel.offsetWidth;
        const height = this.panel.offsetHeight;
        const margin = 12;
        const gap = 8;
        let left = anchor.left;
        let top = anchor.bottom + gap;

        if (left + width > window.innerWidth - margin) left = anchor.right - width;
        if (top + height > window.innerHeight - margin) top = anchor.top - height - gap;
        left = Math.max(margin, Math.min(window.innerWidth - width - margin, left));
        top = Math.max(margin, Math.min(window.innerHeight - height - margin, top));
        this.panel.style.left = `${Math.round(left)}px`;
        this.panel.style.top = `${Math.round(top)}px`;
    }
}

window.ThemedColorPicker = ThemedColorPicker;
