/**
 * Zone Profile Manager
 * Owns the persistence and application of reusable zone styling presets
 * (BLUFOR, OPFOR, Safe Zone, user-created profiles).
 *
 * Extracted from ZonePropertiesUI to keep that file under the 700-line cap
 * and to isolate localStorage concerns from panel rendering. All DOM mutations
 * are routed back through a ZonePropertiesUI instance so the panel stays the
 * single source of truth for form state.
 */
const ZONE_PROFILES_STORAGE_KEY = 'mapOverlay_zone_profiles';

const DEFAULT_PROFILES = {
    blufor: { name: 'BLUFOR', color: '#0066ff', style: 'solid', fillPattern: 'diagonal_right', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 30, patternAngle: 45, patternThickness: 2 },
    opfor: { name: 'OPFOR', color: '#ff0000', style: 'solid', fillPattern: 'crosshatch', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 20, patternAngle: 0, patternThickness: 2 },
    safe: { name: 'Safe Zone', color: '#00ff88', style: 'solid', fillPattern: 'solid', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 20, patternAngle: 0, patternThickness: 2 },
    restricted: { name: 'Restricted', color: '#ff4757', style: 'dashed', fillPattern: 'diagonal_left', fillOpacity: 0.2, borderOpacity: 0.8, borderWidth: 4, patternDensity: 50, patternAngle: 0, patternThickness: 4 }
};

class ZoneProfileManager {
    constructor(propertiesUI) {
        this.ui = propertiesUI;
        this.profiles = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(ZONE_PROFILES_STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (err) {
            console.warn('[ZoneProfileManager] Failed to parse stored profiles, falling back to defaults.', err);
        }
        return { ...DEFAULT_PROFILES };
    }

    save() {
        try {
            localStorage.setItem(ZONE_PROFILES_STORAGE_KEY, JSON.stringify(this.profiles));
        } catch (err) {
            console.warn('[ZoneProfileManager] Failed to persist profiles.', err);
        }
    }

    getAll() {
        return this.profiles;
    }

    getById(id) {
        return this.profiles[id] || null;
    }

    /**
     * Rebuild the <select> options to mirror the current profile map.
     * Preserves the currently chosen option when still valid.
     */
    renderOptions() {
        const select = this.ui.elements.zoneProfile;
        if (!select) return;

        const previousValue = select.value;
        select.innerHTML = '';

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Custom (Unsaved)';
        select.appendChild(customOpt);

        for (const [id, profile] of Object.entries(this.profiles)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = profile.name;
            select.appendChild(option);
        }

        select.value = (this.profiles[previousValue] || previousValue === 'custom')
            ? previousValue
            : 'custom';
    }

    /**
     * Prompt for a name and create (or overwrite by name) a profile snapshot
     * from the current form state.
     */
    async saveCurrentAsProfile() {
        const notifier = this.ui.app.notificationService;
        const name = await (notifier?.showPrompt('', {
            title: 'Profile Name',
            placeholder: 'e.g. AAC Patrol',
            confirmLabel: 'Save Profile'
        }) ?? Promise.resolve(null));
        if (!name) return;

        const trimmed = name.trim();
        if (!trimmed) return;

        const normalized = trimmed.toLowerCase();
        const existing = Object.entries(this.profiles)
            .find(([, profile]) => profile.name?.trim().toLowerCase() === normalized);
        const id = existing ? existing[0] : `profile_${Date.now()}`;

        this.profiles[id] = this._snapshotCurrentForm(trimmed);
        this.save();
        this.renderOptions();
        if (this.ui.elements.zoneProfile) this.ui.elements.zoneProfile.value = id;
        this.ui.app.zoneListUI?.updateZoneList();
        this.ui.updateSelectedZone();
    }

    async deleteCurrent() {
        const select = this.ui.elements.zoneProfile;
        if (!select) return;
        const id = select.value;
        const notifier = this.ui.app.notificationService;

        if (id === 'custom') {
            notifier?.showToast('Cannot delete the unsaved Custom profile.', 'info');
            return;
        }

        const profile = this.profiles[id];
        if (!profile) return;

        const ok = await (notifier?.showConfirm(`Delete the "${profile.name}" profile?`, {
            title: 'Delete Profile',
            confirmLabel: 'Delete',
            tone: 'danger'
        }) ?? Promise.resolve(false));
        if (!ok) return;

        delete this.profiles[id];
        this.save();
        this.renderOptions();
        select.value = 'custom';
        this.ui.updateSelectedZone();
    }

    /**
     * Apply a profile's values onto the form inputs.
     * Skips the 'custom' pseudo-profile so the user's in-progress edits survive.
     */
    apply(id) {
        if (id === 'custom') return;
        const profile = this.profiles[id];
        if (!profile) return;

        const ui = this.ui;
        const els = ui.elements;

        if (els.zoneStyle) els.zoneStyle.value = profile.style || 'solid';
        if (els.zoneFillPattern) els.zoneFillPattern.value = profile.fillPattern || 'solid';
        ui.colorManager.setColorInputValue('zoneColor', profile.color, '#ffffff');
        if (els.borderLabelMode) els.borderLabelMode.value = profile.borderLabelMode || 'none';
        if (els.patternLabelMode) els.patternLabelMode.value = profile.patternLabelMode || 'none';

        const setSlider = (key, value, suffix = '') => {
            if (!els[key]) return;
            els[key].value = value;
            if (els[`${key}Val`]) els[`${key}Val`].textContent = value + suffix;
        };

        setSlider('fillOpacity', Math.round((profile.fillOpacity ?? 0.4) * 100), '%');
        setSlider('borderOpacity', Math.round((profile.borderOpacity ?? 1.0) * 100), '%');
        setSlider('borderWidth', profile.borderWidth || 3, 'px');
        setSlider('patternThickness', profile.patternThickness || 2, 'px');
        setSlider('patternDensity', profile.patternDensity || 20, '');
        setSlider('patternAngle', profile.patternAngle || 0, '°');
        setSlider('labelRotation', profile.labelRotation || 0, '°');

        if (els.showLabel) els.showLabel.checked = profile.showLabel !== false;
        if (els.labelText) els.labelText.value = profile.labelText || profile.name || '';
        ui.colorManager.setColorInputValue('labelColor', profile.labelColor, '#ffffff');

        if (els.labelOpacity) {
            els.labelOpacity.value = Math.round((profile.labelOpacity ?? 1.0) * 100);
            if (els.labelOpacityValue) els.labelOpacityValue.textContent = els.labelOpacity.value + '%';
        }
        ui.colorManager.setColorInputValue('labelBgColor', profile.labelBgColor, '#000000');
        if (els.labelBgOpacity) {
            els.labelBgOpacity.value = Math.round((profile.labelBgOpacity ?? 0.7) * 100);
            if (els.labelBgOpacityValue) els.labelBgOpacityValue.textContent = els.labelBgOpacity.value + '%';
        }
        if (els.labelFontSize) {
            els.labelFontSize.value = profile.labelFontSize || ui.getLabelFontSizeValue(profile);
            if (els.labelFontSizeVal) els.labelFontSizeVal.textContent = `${els.labelFontSize.value}px`;
        }
        if (els.labelFontFamily) els.labelFontFamily.value = profile.labelFontFamily || 'rajdhani';
        if (els.labelBold) els.labelBold.checked = !!profile.labelBold;
        if (els.labelItalic) els.labelItalic.checked = !!profile.labelItalic;
        if (els.labelShadow) els.labelShadow.checked = !!profile.labelShadow;

        ui.updateIntegratedLabelControls(profile);
        ui.updateLabelOptionsVisibility();
        ui.syncAccordionSummaries();
        ui.updateSelectedZone();
    }

    _snapshotCurrentForm(name) {
        const ui = this.ui;
        const els = ui.elements;
        const fontSize = ui.getLabelFontSizeValue();

        return {
            name,
            style: els.zoneStyle?.value || 'solid',
            fillPattern: els.zoneFillPattern?.value || 'solid',
            color: els.zoneColor?.value || '#ffffff',
            fillOpacity: parseInt(els.fillOpacity?.value || '40', 10) / 100,
            borderOpacity: parseInt(els.borderOpacity?.value || '100', 10) / 100,
            borderWidth: parseFloat(els.borderWidth?.value || '3'),
            patternThickness: parseFloat(els.patternThickness?.value || '2'),
            patternDensity: parseInt(els.patternDensity?.value || '20', 10),
            patternAngle: parseInt(els.patternAngle?.value || '0', 10),
            borderLabelMode: els.borderLabelMode?.value || 'none',
            patternLabelMode: els.patternLabelMode?.value || 'none',
            showLabel: els.showLabel?.checked !== false,
            labelText: els.labelText?.value || els.floatingZoneName?.textContent || name,
            labelColor: els.labelColor?.value || '#ffffff',
            labelOpacity: parseInt(els.labelOpacity?.value || '100', 10) / 100,
            labelBgColor: els.labelBgColor?.value || '#000000',
            labelBgOpacity: parseInt(els.labelBgOpacity?.value || '70', 10) / 100,
            labelFontSize: fontSize,
            labelSize: ui.getLegacyLabelSizeKey(fontSize),
            labelFontFamily: els.labelFontFamily?.value || 'rajdhani',
            labelBold: !!els.labelBold?.checked,
            labelItalic: !!els.labelItalic?.checked,
            labelShadow: !!els.labelShadow?.checked,
            labelRotation: parseInt(els.labelRotation?.value || '0', 10)
        };
    }
}

window.ZoneProfileManager = ZoneProfileManager;
