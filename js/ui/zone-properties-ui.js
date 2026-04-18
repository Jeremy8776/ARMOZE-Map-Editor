/**
 * Zone Properties UI Module
 * Handles the zone properties panel rendering and interactions
 */
class ZonePropertiesUI {
    constructor(app) {
        this.app = app;
        this.elements = null;
        this.inspectorCollapsed = false;
        this.persistLiveZoneChanges = Utils.debounce(() => {
            this.app.zoneManager.saveToStorage();
        }, 180);
        this.refreshZoneListDebounced = Utils.debounce(() => {
            this.app.zoneListUI?.updateZoneList();
        }, 140);
    }

    /**
     * Initialize the zone properties UI
     * @param {Object} elements - DOM elements for zone properties
     */
    init(elements) {
        const floatingControls = elements instanceof HTMLElement ? elements : elements?.floatingControls;
        this.elements = {
            // Mapping new IDs to internal logic
            zoneProfile: document.getElementById('zoneProfile'),
            btnSaveProfile: document.getElementById('btnSaveProfile'),
            btnDeleteProfile: document.getElementById('btnDeleteProfile'),
            zoneStyle: document.getElementById('zoneStyle'),
            zoneFillPattern: document.getElementById('zoneFillPattern'),
            zoneColor: document.getElementById('zoneColor'),
            zoneRecentColors: document.getElementById('zoneRecentColors'),
            fillOpacity: document.getElementById('fillOpacity'),
            fillOpacityVal: document.getElementById('fillOpacityVal'),
            borderOpacity: document.getElementById('borderOpacity'),
            borderWidth: document.getElementById('borderWidth'),
            borderWidthVal: document.getElementById('borderWidthVal'),
            patternDensity: document.getElementById('patternDensity'),
            patternAngle: document.getElementById('patternAngle'),
            patternThickness: document.getElementById('patternThickness'),
            borderOpacityVal: document.getElementById('borderOpacityVal'),
            patternDensityVal: document.getElementById('patternDensityVal'),
            patternAngleVal: document.getElementById('patternAngleVal'),
            patternThicknessVal: document.getElementById('patternThicknessVal'),
            labelBorderToggle: document.getElementById('labelBorderToggle'),
            labelPatternToggle: document.getElementById('labelPatternToggle'),
            borderLabelDetail: document.getElementById('borderLabelDetail'),
            patternLabelDetail: document.getElementById('patternLabelDetail'),
            borderLabelMode: document.getElementById('borderLabelMode'),
            patternLabelMode: document.getElementById('patternLabelMode'),
            showLabel: document.getElementById('showLabel'),
            labelText: document.getElementById('labelText'),
            labelColor: document.getElementById('labelColor'),
            labelOpacity: document.getElementById('labelOpacity'),
            labelOpacityValue: document.getElementById('labelOpacityValue'),
            labelRecentColors: document.getElementById('labelRecentColors'),
            labelBgColor: document.getElementById('labelBgColor'),
            labelBgRecentColors: document.getElementById('labelBgRecentColors'),
            labelBgOpacity: document.getElementById('labelBgOpacity'),
            labelBgOpacityValue: document.getElementById('labelBgOpacityValue'),
            labelFontSize: document.getElementById('labelFontSize'),
            labelFontSizeVal: document.getElementById('labelFontSizeVal'),
            labelFontFamily: document.getElementById('labelFontFamily'),
            labelBold: document.getElementById('labelBold'),
            labelItalic: document.getElementById('labelItalic'),
            labelShadow: document.getElementById('labelShadow'),
            labelRotation: document.getElementById('labelRotation'),
            labelRotationVal: document.getElementById('labelRotationVal'),
            btnResetLabelPosition: document.getElementById('btnResetLabelPosition'),
            labelPositionInfo: document.getElementById('labelPositionInfo'),
            zoneCoords: document.getElementById('zoneCoords'),
            borderStyleSummary: document.getElementById('borderStyleSummary'),
            patternTypeSummary: document.getElementById('patternTypeSummary'),
            labelStyleSummary: document.getElementById('labelStyleSummary'),
            
            // Containers
             floatingControls: floatingControls,
             floatingZoneName: elements?.floatingZoneName || document.getElementById('floatingZoneName'),
             quickZoneColor: elements?.quickZoneColor || document.getElementById('quickZoneColor'),
             btnFloatDuplicate: elements?.btnFloatDuplicate || document.getElementById('btnFloatDuplicate'),
             btnFloatDelete: elements?.btnFloatDelete || document.getElementById('btnFloatDelete'),
             btnFloatClose: elements?.btnFloatClose || document.getElementById('btnFloatClose'),
             quickChip: elements?.quickChip || document.getElementById('zoneQuickChip'),
             quickZoneName: elements?.quickZoneName || document.getElementById('zoneQuickName'),
             btnQuickDuplicate: elements?.btnQuickDuplicate || document.getElementById('btnQuickDuplicate'),
             btnQuickDelete: elements?.btnQuickDelete || document.getElementById('btnQuickDelete'),
             btnQuickOpenInspector: elements?.btnQuickOpenInspector || document.getElementById('btnQuickOpenInspector'),
        };

        this.zonePanelElement = document.querySelector('.zone-panel');
        this.toolbarElement = document.querySelector('.toolbar');

        if (!this.elements.floatingControls || !this.elements.quickChip) {
            console.warn('ZonePropertiesUI init skipped: inspector or quick chip not found.');
            return;
        }

        this.setupAccordionInteractions();
        this.quickColors = ['#00ff88', '#ff4757', '#0066ff', '#f1c40f', '#9b59b6', '#ffffff'];
        this.recentColors = this.loadRecentColors();

        this.profiles = this.loadProfiles();
        this.renderProfileOptions();
        this.renderRecentColorRows();
        this.setupEventListeners();
        this.syncAllColorInputPreviews();
    }

    loadRecentColors() {
        const defaults = {
            zone: ['#00ff88', '#ffffff', '#000000', '#ff4757', '#0066ff'],
            label: ['#ffffff', '#00ff88', '#0066ff', '#ff4757', '#000000'],
            labelBg: ['#000000', '#ffffff', '#00ff88', '#1a1a1a', '#ff4757']
        };

        try {
            const data = JSON.parse(localStorage.getItem('mapOverlay_recent_colors') || '[]');
            if (Array.isArray(data)) {
                const zoneColors = data.length ? data : defaults.zone;
                return {
                    zone: zoneColors.slice(0, 10),
                    label: defaults.label.slice(0, 10),
                    labelBg: defaults.labelBg.slice(0, 10)
                };
            }

            if (data && typeof data === 'object') {
                return {
                    zone: Array.isArray(data.zone) && data.zone.length ? data.zone.slice(0, 10) : defaults.zone.slice(0, 10),
                    label: Array.isArray(data.label) && data.label.length ? data.label.slice(0, 10) : defaults.label.slice(0, 10),
                    labelBg: Array.isArray(data.labelBg) && data.labelBg.length ? data.labelBg.slice(0, 10) : defaults.labelBg.slice(0, 10)
                };
            }
        } catch (e) {
            // Fall through to defaults.
        }

        return {
            zone: defaults.zone.slice(0, 10),
            label: defaults.label.slice(0, 10),
            labelBg: defaults.labelBg.slice(0, 10)
        };
    }

    saveRecentColors() {
        localStorage.setItem('mapOverlay_recent_colors', JSON.stringify({
            zone: (this.recentColors.zone || []).slice(0, 10),
            label: (this.recentColors.label || []).slice(0, 10),
            labelBg: (this.recentColors.labelBg || []).slice(0, 10)
        }));
    }

    rememberRecentColor(section, color) {
        if (!color) return;
        const key = section || 'zone';
        const normalized = color.toLowerCase();
        const sectionColors = Array.isArray(this.recentColors[key]) ? this.recentColors[key] : [];
        this.recentColors[key] = [normalized, ...sectionColors.filter(item => item.toLowerCase() !== normalized)].slice(0, 10);
        this.saveRecentColors();
        this.renderRecentColorRows();
    }

    syncColorInputPreview(input) {
        if (!input) return;
        const shell = input.closest('.color-wheel-control');
        if (shell) shell.style.setProperty('--selected-color', input.value || '#ffffff');
    }

    setColorInputValue(inputOrKey, value, fallback = '#ffffff') {
        const input = typeof inputOrKey === 'string' ? this.elements[inputOrKey] : inputOrKey;
        if (!input) return;
        input.value = value || fallback;
        this.syncColorInputPreview(input);
    }

    getSelectText(select, fallback) {
        return select?.selectedOptions?.[0]?.textContent || fallback;
    }

    syncAllColorInputPreviews() {
        this.syncColorInputPreview(this.elements.zoneColor);
        this.syncColorInputPreview(this.elements.quickZoneColor);
        this.syncColorInputPreview(this.elements.labelColor);
        this.syncColorInputPreview(this.elements.labelBgColor);
    }

    renderRecentColorRows() {
        const rows = [
            { container: this.elements.zoneRecentColors, input: this.elements.zoneColor, section: 'zone' },
            { container: this.elements.labelRecentColors, input: this.elements.labelColor, section: 'label' },
            { container: this.elements.labelBgRecentColors, input: this.elements.labelBgColor, section: 'labelBg' }
        ];

        rows.forEach(({ container, input, section }) => {
            if (!container || !input) return;
            const colors = Array.isArray(this.recentColors[section]) ? this.recentColors[section] : [];
            container.innerHTML = colors.map(color => `
                <button type="button" class="recent-color-chip" data-color="${color}" style="--chip-color:${color}" title="${color}"></button>
            `).join('');

            container.querySelectorAll('.recent-color-chip').forEach((chip) => {
                chip.addEventListener('click', () => {
                    this.setColorInputValue(input, chip.dataset.color);
                    this.rememberRecentColor(section, chip.dataset.color);
                    if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
                    this.updateSelectedZone();
                });
            });
        });
    }

    loadProfiles() {
        try {
            const data = localStorage.getItem('mapOverlay_zone_profiles');
            if (data) return JSON.parse(data);
        } catch (e) {}
        
        // Default profiles
        return {
            'blufor': { name: 'BLUFOR', color: '#0066ff', style: 'solid', fillPattern: 'diagonal_right', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 30, patternAngle: 45, patternThickness: 2 },
            'opfor': { name: 'OPFOR', color: '#ff0000', style: 'solid', fillPattern: 'crosshatch', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 20, patternAngle: 0, patternThickness: 2 },
            'safe': { name: 'Safe Zone', color: '#00ff88', style: 'solid', fillPattern: 'solid', fillOpacity: 0.4, borderOpacity: 1.0, borderWidth: 3, patternDensity: 20, patternAngle: 0, patternThickness: 2 },
            'restricted': { name: 'Restricted', color: '#ff4757', style: 'dashed', fillPattern: 'diagonal_left', fillOpacity: 0.2, borderOpacity: 0.8, borderWidth: 4, patternDensity: 50, patternAngle: 0, patternThickness: 4 }
        };
    }

    saveProfiles() {
        localStorage.setItem('mapOverlay_zone_profiles', JSON.stringify(this.profiles));
    }

    renderProfileOptions() {
        if (!this.elements.zoneProfile) return;
        const select = this.elements.zoneProfile;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="custom">Custom (Unsaved)</option>';
        
        for (const [id, profile] of Object.entries(this.profiles)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = profile.name;
            select.appendChild(option);
        }
        
        if (this.profiles[currentValue] || currentValue === 'custom') {
            select.value = currentValue;
        } else {
            select.value = 'custom';
        }
    }

    saveCurrentAsProfile() {
        this.showNamePrompt('Profile Name', '', (name) => {
            this._doSaveProfile(name);
        });
    }

    _doSaveProfile(name) {
        if (!name) return;

        const normalizedName = name.trim().toLowerCase();
        const existingEntry = Object.entries(this.profiles).find(([, profile]) => profile.name?.trim().toLowerCase() === normalizedName);
        const id = existingEntry ? existingEntry[0] : 'profile_' + Date.now();
        this.profiles[id] = {
            name: name,
            style: this.elements.zoneStyle.value,
            fillPattern: this.elements.zoneFillPattern.value,
            color: this.elements.zoneColor.value,
            fillOpacity: parseInt(this.elements.fillOpacity.value) / 100,
            borderOpacity: parseInt(this.elements.borderOpacity.value) / 100,
            borderWidth: parseFloat(this.elements.borderWidth.value),
            patternThickness: parseFloat(this.elements.patternThickness.value),
            patternDensity: parseInt(this.elements.patternDensity.value),
            patternAngle: parseInt(this.elements.patternAngle.value),
            borderLabelMode: this.elements.borderLabelMode?.value || 'none',
            patternLabelMode: this.elements.patternLabelMode?.value || 'none',
            showLabel: this.elements.showLabel?.checked !== false,
            labelText: this.elements.labelText?.value || this.elements.floatingZoneName?.textContent || name,
            labelColor: this.elements.labelColor?.value || '#ffffff',
            labelOpacity: parseInt(this.elements.labelOpacity?.value || '100', 10) / 100,
            labelBgColor: this.elements.labelBgColor?.value || '#000000',
            labelBgOpacity: parseInt(this.elements.labelBgOpacity?.value || '70', 10) / 100,
            labelFontSize: this.getLabelFontSizeValue(),
            labelSize: this.getLegacyLabelSizeKey(this.getLabelFontSizeValue()),
            labelFontFamily: this.elements.labelFontFamily?.value || 'rajdhani',
            labelBold: !!this.elements.labelBold?.checked,
            labelItalic: !!this.elements.labelItalic?.checked,
            labelShadow: !!this.elements.labelShadow?.checked,
            labelRotation: parseInt(this.elements.labelRotation?.value || '0', 10)
        };
        
        this.saveProfiles();
        this.renderProfileOptions();
        this.elements.zoneProfile.value = id;
        this.app.zoneListUI?.updateZoneList();
        this.updateSelectedZone(); // Ensures the active zone has this profileID applied
    }

    deleteCurrentProfile() {
        const id = this.elements.zoneProfile.value;
        if (id === 'custom') {
            this.showToast('Cannot delete the unsaved Custom profile.');
            return;
        }

        this.showConfirm(`Delete the "${this.profiles[id].name}" profile?`, () => {
            delete this.profiles[id];
            this.saveProfiles();
            this.renderProfileOptions();
            this.elements.zoneProfile.value = 'custom';
            this.updateSelectedZone();
        });
    }

    applyProfile(id) {
        if (id === 'custom') return; // User just selected custom, don't overwrite their UI settings
        
        const p = this.profiles[id];
        if (!p) return;
        
        this.elements.zoneStyle.value = p.style || 'solid';
        this.elements.zoneFillPattern.value = p.fillPattern || 'solid';
        this.setColorInputValue('zoneColor', p.color, '#ffffff');
        if (this.elements.borderLabelMode) this.elements.borderLabelMode.value = p.borderLabelMode || 'none';
        if (this.elements.patternLabelMode) this.elements.patternLabelMode.value = p.patternLabelMode || 'none';
        
        const setSlider = (elementId, value, suffix) => {
            if (this.elements[elementId]) {
                this.elements[elementId].value = value;
                if (this.elements[`${elementId}Val`]) {
                    this.elements[`${elementId}Val`].textContent = value + suffix;
                }
            }
        };

        setSlider('fillOpacity', Math.round((p.fillOpacity !== undefined ? p.fillOpacity : 0.4) * 100), '%');
        setSlider('borderOpacity', Math.round((p.borderOpacity !== undefined ? p.borderOpacity : 1.0) * 100), '%');
        setSlider('borderWidth', p.borderWidth || 3, 'px');
        setSlider('patternThickness', p.patternThickness || 2, 'px');
        setSlider('patternDensity', p.patternDensity || 20, '');
        setSlider('patternAngle', p.patternAngle || 0, '°');

        if (this.elements.showLabel) this.elements.showLabel.checked = p.showLabel !== false;
        if (this.elements.labelText) this.elements.labelText.value = p.labelText || p.name || '';
        this.setColorInputValue('labelColor', p.labelColor, '#ffffff');
        if (this.elements.labelOpacity) {
            this.elements.labelOpacity.value = Math.round((p.labelOpacity !== undefined ? p.labelOpacity : 1.0) * 100);
        }
        if (this.elements.labelOpacityValue && this.elements.labelOpacity) {
            this.elements.labelOpacityValue.textContent = this.elements.labelOpacity.value + '%';
        }
        this.setColorInputValue('labelBgColor', p.labelBgColor, '#000000');
        if (this.elements.labelBgOpacity) {
            this.elements.labelBgOpacity.value = Math.round((p.labelBgOpacity !== undefined ? p.labelBgOpacity : 0.7) * 100);
        }
        if (this.elements.labelBgOpacityValue && this.elements.labelBgOpacity) {
            this.elements.labelBgOpacityValue.textContent = this.elements.labelBgOpacity.value + '%';
        }
        if (this.elements.labelFontSize) {
            this.elements.labelFontSize.value = p.labelFontSize || this.getLabelFontSizeValue(p);
        }
        if (this.elements.labelFontSizeVal && this.elements.labelFontSize) {
            this.elements.labelFontSizeVal.textContent = `${this.elements.labelFontSize.value}px`;
        }
        if (this.elements.labelFontFamily) this.elements.labelFontFamily.value = p.labelFontFamily || 'rajdhani';
        if (this.elements.labelBold) this.elements.labelBold.checked = !!p.labelBold;
        if (this.elements.labelItalic) this.elements.labelItalic.checked = !!p.labelItalic;
        if (this.elements.labelShadow) this.elements.labelShadow.checked = !!p.labelShadow;
        setSlider('labelRotation', p.labelRotation || 0, '°');
        this.updateIntegratedLabelControls(p);
        this.updateLabelOptionsVisibility();
        this.syncAccordionSummaries();

        this.updateSelectedZone();
    }

    /**
     * Setup event listeners for zone properties inputs
     */
    setupEventListeners() {
        if (this.elements.zoneName) this.elements.zoneName.addEventListener('input', () => this.updateSelectedZone({ live: true }));
        
        if (this.elements.zoneProfile) {
            this.elements.zoneProfile.addEventListener('change', (e) => {
                this.applyProfile(e.target.value);
            });
        }
        
        if (this.elements.btnSaveProfile) {
            this.elements.btnSaveProfile.addEventListener('click', () => this.saveCurrentAsProfile());
        }
        if (this.elements.btnDeleteProfile) {
            this.elements.btnDeleteProfile.addEventListener('click', () => this.deleteCurrentProfile());
        }

        const markAsCustom = () => {
            if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
            this.updateSelectedZone();
        };

        if (this.elements.zoneStyle) this.elements.zoneStyle.addEventListener('change', markAsCustom);
        if (this.elements.zoneFillPattern) this.elements.zoneFillPattern.addEventListener('change', markAsCustom);
        if (this.elements.zoneColor) this.elements.zoneColor.addEventListener('input', () => {
            this.syncColorInputPreview(this.elements.zoneColor);
            this.setColorInputValue('quickZoneColor', this.elements.zoneColor.value);
            if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
            this.updateSelectedZone({ live: true });
        });
        if (this.elements.zoneColor) this.elements.zoneColor.addEventListener('change', () => {
            this.rememberRecentColor('zone', this.elements.zoneColor.value);
            markAsCustom();
        });
        if (this.elements.zoneStyle) this.elements.zoneStyle.addEventListener('change', () => this.syncAccordionSummaries());
        if (this.elements.zoneFillPattern) this.elements.zoneFillPattern.addEventListener('change', () => this.syncAccordionSummaries());
        if (this.elements.borderLabelMode) this.elements.borderLabelMode.addEventListener('change', () => {
            markAsCustom();
            this.syncAccordionSummaries();
            this.updateLabelPositionInfo(this.app.zoneManager.getSelectedZone());
            this.updateIntegratedLabelControls();
        });
        if (this.elements.patternLabelMode) this.elements.patternLabelMode.addEventListener('change', () => {
            markAsCustom();
            this.syncAccordionSummaries();
            this.updateLabelPositionInfo(this.app.zoneManager.getSelectedZone());
            this.updateIntegratedLabelControls();
        });
        
        // Advanced Display Sliders
        const attachSlider = (id, suffix = '') => {
            if (this.elements[id]) {
                this.elements[id].addEventListener('input', () => {
                    if (this.elements[`${id}Val`]) {
                        this.elements[`${id}Val`].textContent = this.elements[id].value + suffix;
                    }
                    if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
                    this.updateSelectedZone({ live: true });
                });
                this.elements[id].addEventListener('change', () => this.updateSelectedZone());
            }
        };

        attachSlider('fillOpacity', '%');
        attachSlider('borderOpacity', '%');
        attachSlider('borderWidth', 'px');
        attachSlider('patternThickness', 'px');
        attachSlider('patternDensity', '');
        attachSlider('patternAngle', '°');
        attachSlider('labelFontSize', 'px');
        attachSlider('labelRotation', '°');

        if (this.elements.btnDeleteZone) this.elements.btnDeleteZone.addEventListener('click', () => this.deleteSelectedZone());

        // Label styling events
        const markLabelAsCustom = () => {
            if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
        };
        if (this.elements.showLabel) {
            this.elements.showLabel.addEventListener('change', () => {
                markLabelAsCustom();
                this.updateLabelOptionsVisibility();
                this.syncAccordionSummaries();
                this.updateSelectedZone();
            });
        }
        if (this.elements.labelText) {
            this.elements.labelText.addEventListener('input', () => {
                markLabelAsCustom();
                this.syncAccordionSummaries();
                this.updateSelectedZone({ live: true });
            });
            this.elements.labelText.addEventListener('change', () => this.updateSelectedZone());
        }
        if (this.elements.labelColor) this.elements.labelColor.addEventListener('input', () => {
            this.syncColorInputPreview(this.elements.labelColor);
            markLabelAsCustom();
            this.updateSelectedZone({ live: true });
        });
        if (this.elements.labelColor) this.elements.labelColor.addEventListener('change', () => {
            this.rememberRecentColor('label', this.elements.labelColor.value);
            this.updateSelectedZone();
        });
        if (this.elements.labelOpacity) {
            this.elements.labelOpacity.addEventListener('input', () => {
                markLabelAsCustom();
                if (this.elements.labelOpacityValue) this.elements.labelOpacityValue.textContent = this.elements.labelOpacity.value + '%';
                this.updateSelectedZone({ live: true });
            });
            this.elements.labelOpacity.addEventListener('change', () => this.updateSelectedZone());
        }
        if (this.elements.labelBgColor) this.elements.labelBgColor.addEventListener('input', () => {
            this.syncColorInputPreview(this.elements.labelBgColor);
            markLabelAsCustom();
            this.updateSelectedZone({ live: true });
        });
        if (this.elements.labelBgColor) this.elements.labelBgColor.addEventListener('change', () => {
            this.rememberRecentColor('labelBg', this.elements.labelBgColor.value);
            this.updateSelectedZone();
        });
        if (this.elements.labelBgOpacity) {
            this.elements.labelBgOpacity.addEventListener('input', () => {
                markLabelAsCustom();
                if (this.elements.labelBgOpacityValue) this.elements.labelBgOpacityValue.textContent = this.elements.labelBgOpacity.value + '%';
                this.updateSelectedZone({ live: true });
            });
            this.elements.labelBgOpacity.addEventListener('change', () => this.updateSelectedZone());
        }
        if (this.elements.labelFontFamily) this.elements.labelFontFamily.addEventListener('change', () => {
            markLabelAsCustom();
            this.syncAccordionSummaries();
            this.updateSelectedZone();
        });
        if (this.elements.labelBold) this.elements.labelBold.addEventListener('change', () => {
            markLabelAsCustom();
            this.syncAccordionSummaries();
            this.updateSelectedZone();
        });
        if (this.elements.labelItalic) this.elements.labelItalic.addEventListener('change', () => {
            markLabelAsCustom();
            this.syncAccordionSummaries();
            this.updateSelectedZone();
        });
        if (this.elements.labelShadow) this.elements.labelShadow.addEventListener('change', () => {
            markLabelAsCustom();
            this.updateSelectedZone();
        });
        if (this.elements.labelBorderToggle) {
            this.elements.labelBorderToggle.addEventListener('change', () => {
                markLabelAsCustom();
                if (this.elements.labelBorderToggle.checked) {
                    if (this.elements.borderLabelMode && this.elements.borderLabelMode.value === 'none') this.elements.borderLabelMode.value = 'repeat';
                    if (this.elements.labelPatternToggle) this.elements.labelPatternToggle.checked = false;
                    if (this.elements.patternLabelMode) this.elements.patternLabelMode.value = 'none';
                } else if (this.elements.borderLabelMode) {
                    this.elements.borderLabelMode.value = 'none';
                }
                this.updateIntegratedLabelControls();
                this.syncAccordionSummaries();
                this.updateLabelPositionInfo(this.app.zoneManager.getSelectedZone());
                this.updateSelectedZone();
            });
        }
        if (this.elements.labelPatternToggle) {
            this.elements.labelPatternToggle.addEventListener('change', () => {
                markLabelAsCustom();
                if (this.elements.labelPatternToggle.checked) {
                    if (this.elements.patternLabelMode && this.elements.patternLabelMode.value === 'none') this.elements.patternLabelMode.value = 'checker_embed';
                    if (this.elements.labelBorderToggle) this.elements.labelBorderToggle.checked = false;
                    if (this.elements.borderLabelMode) this.elements.borderLabelMode.value = 'none';
                } else if (this.elements.patternLabelMode) {
                    this.elements.patternLabelMode.value = 'none';
                }
                this.updateIntegratedLabelControls();
                this.syncAccordionSummaries();
                this.updateLabelPositionInfo(this.app.zoneManager.getSelectedZone());
                this.updateSelectedZone();
            });
        }
        if (this.elements.btnResetLabelPosition) {
            this.elements.btnResetLabelPosition.addEventListener('click', () => {
                const zone = this.app.zoneManager.getSelectedZone();
                if (!zone) return;
                if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
                zone.labelOffsetX = 0;
                zone.labelOffsetY = 0;
                this.updateLabelPositionInfo(zone);
                this.app.zoneManager.updateZone(zone.id, {
                    labelOffsetX: 0,
                    labelOffsetY: 0
                });
            });
        }

        // Floating Header renaming
        if (this.elements.floatingZoneName) {
            this.elements.floatingZoneName.addEventListener('click', () => {
                const zone = this.app.zoneManager.getSelectedZone();
                if (!zone) return;
                this.showNamePrompt('Rename Zone', zone.name, (newName) => {
                    zone.name = newName;
                    zone.labelText = newName; // Keep label text in sync with name
                    if (this.elements.labelText) this.elements.labelText.value = newName;
                    this.elements.floatingZoneName.textContent = newName;
                    this.app.zoneListUI.updateZoneList();
                    this.updateSelectedZone(); // Refresh everything
                });
            });
        }

        if (this.elements.btnFloatDuplicate) {
            this.elements.btnFloatDuplicate.addEventListener('click', () => this.app.duplicateSelectedZone());
        }

        if (this.elements.btnFloatDelete) {
            this.elements.btnFloatDelete.addEventListener('click', () => this.deleteSelectedZone());
        }

        if (this.elements.btnFloatClose) {
            this.elements.btnFloatClose.addEventListener('click', () => this.setInspectorCollapsed(true));
        }

        if (this.elements.quickZoneColor) {
            this.elements.quickZoneColor.addEventListener('input', () => {
                this.setColorInputValue('zoneColor', this.elements.quickZoneColor.value);
                if (this.elements.zoneProfile) this.elements.zoneProfile.value = 'custom';
                this.updateSelectedZone({ live: true });
            });
            this.elements.quickZoneColor.addEventListener('change', () => {
                this.rememberRecentColor('zone', this.elements.quickZoneColor.value);
                this.updateSelectedZone();
            });
        }

        if (this.elements.quickZoneName) {
            this.elements.quickZoneName.addEventListener('click', () => this.openInspector());
        }

        if (this.elements.btnQuickOpenInspector) {
            this.elements.btnQuickOpenInspector.addEventListener('click', () => this.openInspector());
        }

        if (this.elements.btnQuickDuplicate) {
            this.elements.btnQuickDuplicate.addEventListener('click', () => this.app.duplicateSelectedZone());
        }

        if (this.elements.btnQuickDelete) {
            this.elements.btnQuickDelete.addEventListener('click', () => this.deleteSelectedZone());
        }
    }

    setupAccordionInteractions() {
        const accordionSections = this.elements.floatingControls.querySelectorAll('[data-accordion]');
        accordionSections.forEach(section => {
            const trigger = section.querySelector('[data-accordion-trigger]');
            if (!trigger) return;

            trigger.addEventListener('click', () => {
                const isOpen = section.classList.contains('is-open');
                this.setAccordionOpen(section, !isOpen);
            });

            this.setAccordionOpen(section, section.classList.contains('is-open'));
        });

        this.syncAccordionSummaries();
    }

    setAccordionOpen(section, isOpen) {
        if (!section) return;

        const trigger = section.querySelector('[data-accordion-trigger]');
        section.classList.toggle('is-open', isOpen);

        if (trigger) {
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
    }

    getLabelFontSizeValue(zone = null) {
        const rawValue = zone?.labelFontSize ?? this.elements.labelFontSize?.value;
        const numericValue = parseInt(rawValue, 10);
        if (Number.isFinite(numericValue)) return numericValue;

        const legacySize = zone?.labelSize || 'medium';
        switch (legacySize) {
            case 'small': return Constants?.LABEL_SIZE_SMALL || 10;
            case 'large': return Constants?.LABEL_SIZE_LARGE || 18;
            default: return Constants?.LABEL_SIZE_MEDIUM || 14;
        }
    }

    getLegacyLabelSizeKey(fontSize) {
        if (fontSize <= 12) return 'small';
        if (fontSize >= 17) return 'large';
        return 'medium';
    }

    getActiveIntegrationMode(zone = null) {
        const patternMode = zone?.patternLabelMode || this.elements.patternLabelMode?.value || 'none';
        if (patternMode !== 'none') return 'pattern';

        const borderMode = zone?.borderLabelMode || this.elements.borderLabelMode?.value || 'none';
        if (borderMode !== 'none') return 'border';

        return 'floating';
    }

    updateIntegratedLabelControls(zone = null) {
        const activeMode = this.getActiveIntegrationMode(zone);
        if (this.elements.labelBorderToggle) this.elements.labelBorderToggle.checked = activeMode === 'border';
        if (this.elements.labelPatternToggle) this.elements.labelPatternToggle.checked = activeMode === 'pattern';
        if (this.elements.borderLabelDetail) this.elements.borderLabelDetail.classList.toggle('is-visible', activeMode === 'border');
        if (this.elements.patternLabelDetail) this.elements.patternLabelDetail.classList.toggle('is-visible', activeMode === 'pattern');
    }

    syncAccordionSummariesLegacy() {
        // Archived legacy implementation left only to reduce merge risk while the
        // new single-path summary renderer settles. This method is unused.
        return;

        if (this.elements.borderStyleSummary && this.elements.zoneStyle) {
            const borderStyle = this.elements.zoneStyle.selectedOptions?.[0]?.textContent || 'Border Style';
            const borderLabel = this.elements.borderLabelMode?.selectedOptions?.[0]?.textContent || 'Off';
            this.elements.borderStyleSummary.textContent = `${borderStyle} - Label: ${borderLabel}`;
        }

        if (this.elements.patternTypeSummary && this.elements.zoneFillPattern) {
            const patternType = this.elements.zoneFillPattern.selectedOptions?.[0]?.textContent || 'Pattern Type';
            const patternLabel = this.elements.patternLabelMode?.selectedOptions?.[0]?.textContent || 'Off';
            this.elements.patternTypeSummary.textContent = `${patternType} - Label: ${patternLabel}`;
        }

        if (this.elements.labelStyleSummary) {
            if (this.elements.showLabel && !this.elements.showLabel.checked) {
                this.elements.labelStyleSummary.textContent = 'Hidden';
            } else {
                const labelText = (this.elements.labelText?.value || '').trim() || 'Label';
                const fontName = this.elements.labelFontFamily?.selectedOptions?.[0]?.textContent || 'Rajdhani';
                const sizeName = this.elements.labelSize?.selectedOptions?.[0]?.textContent || 'Medium';
                const styleBits = [];
                if (this.elements.labelBold?.checked) styleBits.push('Bold');
                if (this.elements.labelItalic?.checked) styleBits.push('Italic');
                const styleText = styleBits.length ? ` • ${styleBits.join(' / ')}` : '';
                this.elements.labelStyleSummary.textContent = `${fontName} • ${sizeName}${styleText}`;
                const cleanStyleText = styleBits.length ? ` - ${styleBits.join(' / ')}` : '';
                this.elements.labelStyleSummary.textContent = `${labelText} - ${fontName} - ${sizeName}${cleanStyleText}`;
            }
        }

        if (this.elements.borderStyleSummary && this.elements.zoneStyle) {
            this.elements.borderStyleSummary.textContent = this.elements.zoneStyle.selectedOptions?.[0]?.textContent || 'Border Style';
        }

        if (this.elements.patternTypeSummary && this.elements.zoneFillPattern) {
            this.elements.patternTypeSummary.textContent = this.elements.zoneFillPattern.selectedOptions?.[0]?.textContent || 'Pattern Type';
        }

        if (this.elements.labelStyleSummary) {
            if (this.elements.showLabel?.checked === false) {
                this.elements.labelStyleSummary.textContent = 'Hidden';
            } else {
                const labelText = (this.elements.labelText?.value || '').trim() || 'Label';
                const fontName = this.elements.labelFontFamily?.selectedOptions?.[0]?.textContent || 'Rajdhani';
                const sizeName = `${this.getLabelFontSizeValue()}px`;
                const styleBits = [];
                if (this.elements.labelBold?.checked) styleBits.push('Bold');
                if (this.elements.labelItalic?.checked) styleBits.push('Italic');
                const activeMode = this.getActiveIntegrationMode();
                if (activeMode === 'border') {
                    styleBits.push(this.elements.borderLabelMode?.selectedOptions?.[0]?.textContent || 'Border');
                } else if (activeMode === 'pattern') {
                    styleBits.push('Pattern');
                }
                const cleanStyleText = styleBits.length ? ` - ${styleBits.join(' / ')}` : '';
                this.elements.labelStyleSummary.textContent = `${labelText} - ${fontName} - ${sizeName}${cleanStyleText}`;
            }
        }
    }

    syncAccordionSummaries() {
        if (this.elements.borderStyleSummary && this.elements.zoneStyle) {
            const borderStyle = this.getSelectText(this.elements.zoneStyle, 'Border Style');
            const borderLabelEnabled = this.elements.labelBorderToggle?.checked && this.elements.borderLabelMode?.value !== 'none';
            const borderLabel = borderLabelEnabled ? this.getSelectText(this.elements.borderLabelMode, 'Border') : '';
            this.elements.borderStyleSummary.textContent = borderLabel ? `${borderStyle} - ${borderLabel}` : borderStyle;
        }

        if (this.elements.patternTypeSummary && this.elements.zoneFillPattern) {
            const patternType = this.getSelectText(this.elements.zoneFillPattern, 'Pattern Type');
            const patternLabelEnabled = this.elements.labelPatternToggle?.checked && this.elements.patternLabelMode?.value !== 'none';
            const patternLabel = patternLabelEnabled ? this.getSelectText(this.elements.patternLabelMode, 'Pattern') : '';
            this.elements.patternTypeSummary.textContent = patternLabel ? `${patternType} - ${patternLabel}` : patternType;
        }

        if (this.elements.labelStyleSummary) {
            if (this.elements.showLabel?.checked === false) {
                this.elements.labelStyleSummary.textContent = 'Hidden';
            } else {
                const labelText = (this.elements.labelText?.value || '').trim() || 'Label';
                const fontName = this.getSelectText(this.elements.labelFontFamily, 'Rajdhani');
                const sizeName = `${this.getLabelFontSizeValue()}px`;
                const styleBits = [];
                if (this.elements.labelBold?.checked) styleBits.push('Bold');
                if (this.elements.labelItalic?.checked) styleBits.push('Italic');

                const activeMode = this.getActiveIntegrationMode();
                if (activeMode === 'border') {
                    styleBits.push(this.getSelectText(this.elements.borderLabelMode, 'Border'));
                } else if (activeMode === 'pattern') {
                    styleBits.push(this.getSelectText(this.elements.patternLabelMode, 'Pattern'));
                }

                const suffix = styleBits.length ? ` - ${styleBits.join(' / ')}` : '';
                this.elements.labelStyleSummary.textContent = `${labelText} - ${fontName} - ${sizeName}${suffix}`;
            }
        }
    }

    updateLabelPositionInfo(zone) {
        if (!this.elements.labelPositionInfo) return;
        if (!zone) {
            this.elements.labelPositionInfo.textContent = 'Drag the label on the map to place it inside or outside the shape.';
            return;
        }

        const patternMode = this.elements.patternLabelMode?.value || zone.patternLabelMode || 'none';
        const borderMode = this.elements.borderLabelMode?.value || zone.borderLabelMode || 'none';
        if (patternMode !== 'none') {
            this.elements.labelPositionInfo.textContent = 'Pattern-integrated labels are embedded into the fill, so drag placement is disabled in this mode.';
            return;
        }
        if (borderMode !== 'none') {
            this.elements.labelPositionInfo.textContent = 'Border-integrated labels follow the outline, so drag placement is disabled in this mode.';
            return;
        }

        const offsetX = Math.round(zone?.labelOffsetX || 0);
        const offsetY = Math.round(zone?.labelOffsetY || 0);
        const isCentered = offsetX === 0 && offsetY === 0;
        this.elements.labelPositionInfo.textContent = isCentered
            ? 'Drag the label on the map to place it inside or outside the shape.'
            : `Label offset: X ${offsetX}, Y ${offsetY}. Drag on the map to reposition.`;
    }

    setupFloatingDraggable() {
        return;
    }

    getZoneScreenCenter(zone) {
        let wx = 0, wy = 0;
        if (zone.shape === 'circle') {
            wx = zone.cx;
            wy = zone.cy;
        } else if (zone.shape === 'rectangle') {
            wx = zone.x + zone.width / 2;
            wy = zone.y + zone.height / 2;
        } else if (zone.shape === 'line') {
            wx = (zone.x1 + zone.x2) / 2;
            wy = (zone.y1 + zone.y2) / 2;
        } else if (zone.points && zone.points.length > 0) {
            const bounds = Utils.getPolygonBounds(zone.points);
            wx = bounds.x + bounds.width / 2;
            wy = bounds.y + bounds.height / 2;
        }

        return {
            x: wx * this.app.core.zoom + this.app.core.panX,
            y: wy * this.app.core.zoom + this.app.core.panY
        };
    }

    syncZoneTitles(name) {
        if (this.elements.floatingZoneName) this.elements.floatingZoneName.textContent = name;
        if (this.elements.quickZoneName) this.elements.quickZoneName.textContent = name;
    }

    setInspectorCollapsed(collapsed) {
        this.inspectorCollapsed = collapsed;
        if (!this.elements.floatingControls) return;

        this.elements.floatingControls.classList.toggle('is-collapsed', collapsed);
    }

    pulseInspector() {
        if (!this.elements.floatingControls) return;

        this.elements.floatingControls.classList.remove('is-attention');
        void this.elements.floatingControls.offsetWidth;
        this.elements.floatingControls.classList.add('is-attention');
        window.clearTimeout(this.inspectorPulseTimeout);
        this.inspectorPulseTimeout = window.setTimeout(() => {
            this.elements.floatingControls?.classList.remove('is-attention');
        }, 900);
    }

    openInspector() {
        if (!this.app.zoneManager.getSelectedZone()) return;
        this.setInspectorCollapsed(false);
        this.pulseInspector();
    }

    /**
     * Show zone properties for a selected zone.
     * @param {Object} zone
     * @param {boolean} isRefresh - true when called from updateSelectedZone (don't reset UI state)
     */
    showZoneProperties(zone, isRefresh = false) {
        if (!zone) {
            this.hideFloatingControls();
            return;
        }

        if (!isRefresh) {
            // Collapse all accordions on fresh zone selection
            const allAccordions = this.elements.floatingControls?.querySelectorAll('[data-accordion]');
            if (allAccordions) allAccordions.forEach(s => this.setAccordionOpen(s, false));
            this.setInspectorCollapsed(false);
        }

        this.syncZoneTitles(zone.name);
        if (this.elements.zoneProfile) this.elements.zoneProfile.value = zone.profileId || 'custom';
        
        if (this.elements.zoneStyle) this.elements.zoneStyle.value = zone.style || 'solid';
        if (this.elements.zoneFillPattern) this.elements.zoneFillPattern.value = zone.fillPattern || 'solid';
        this.setColorInputValue('zoneColor', zone.color, '#ffffff');
        this.setColorInputValue('quickZoneColor', zone.color, '#ffffff');
        if (this.elements.borderLabelMode) this.elements.borderLabelMode.value = zone.borderLabelMode || 'none';
        if (this.elements.patternLabelMode) this.elements.patternLabelMode.value = zone.patternLabelMode || 'none';
        
        // Populate sliders safely, falling back to legacy properties or defaults
        const setSlider = (id, value, suffix = '') => {
            if (this.elements[id]) {
                this.elements[id].value = value;
                if (this.elements[`${id}Val`]) {
                    this.elements[`${id}Val`].textContent = value + suffix;
                }
            }
        };

        const fillOpInfo = zone.fillOpacity !== undefined ? zone.fillOpacity * 100 : (zone.opacity !== undefined ? zone.opacity * 100 : 40);
        const borderOpInfo = zone.borderOpacity !== undefined ? zone.borderOpacity * 100 : 100;
        
        setSlider('fillOpacity', Math.round(fillOpInfo), '%');
        setSlider('borderOpacity', Math.round(borderOpInfo), '%');
        setSlider('borderWidth', zone.borderWidth || 3, 'px');
        setSlider('patternThickness', zone.patternThickness || 2, 'px');
        setSlider('patternDensity', zone.patternDensity || 20, '');
        setSlider('patternAngle', zone.patternAngle || 0, '°');

        // Label styling
        if (this.elements.showLabel) this.elements.showLabel.checked = zone.showLabel !== false;
        if (this.elements.labelText) this.elements.labelText.value = zone.labelText || zone.name || '';
        this.setColorInputValue('labelColor', zone.labelColor, '#ffffff');
        if (this.elements.labelOpacity) {
            this.elements.labelOpacity.value = (zone.labelOpacity !== undefined ? zone.labelOpacity * 100 : 100);
            if (this.elements.labelOpacityValue) this.elements.labelOpacityValue.textContent = this.elements.labelOpacity.value + '%';
        }
        this.setColorInputValue('labelBgColor', zone.labelBgColor, '#000000');
        if (this.elements.labelBgOpacity) {
            this.elements.labelBgOpacity.value = (zone.labelBgOpacity !== undefined ? zone.labelBgOpacity * 100 : 70);
            if (this.elements.labelBgOpacityValue) this.elements.labelBgOpacityValue.textContent = this.elements.labelBgOpacity.value + '%';
        }
        if (this.elements.labelFontSize) {
            this.elements.labelFontSize.value = this.getLabelFontSizeValue(zone);
            if (this.elements.labelFontSizeVal) this.elements.labelFontSizeVal.textContent = `${this.elements.labelFontSize.value}px`;
        }
        if (this.elements.labelFontFamily) this.elements.labelFontFamily.value = zone.labelFontFamily || 'rajdhani';
        if (this.elements.labelBold) this.elements.labelBold.checked = !!zone.labelBold;
        if (this.elements.labelItalic) this.elements.labelItalic.checked = !!zone.labelItalic;
        if (this.elements.labelShadow) this.elements.labelShadow.checked = zone.labelShadow || false;

        this.updateIntegratedLabelControls(zone);
        this.updateLabelOptionsVisibility();
        this.updateLabelPositionInfo(zone);
        this.syncAccordionSummaries();

        this.updateZoneDataReadout(zone);

        this.showFloatingControls(zone);
    }

    showFloatingControls(zone) {
        if (!this.elements.floatingControls || !this.elements.quickChip) return;

        this.elements.floatingControls.style.removeProperty('display');
        this.elements.quickChip.style.removeProperty('display');
        this.syncZoneTitles(zone.name);
        this.setColorInputValue('quickZoneColor', zone.color, '#ffffff');

        this.updateFloatingPosition();
    }

    hideFloatingControls() {
        if (this.elements.floatingControls) {
            this.elements.floatingControls.style.display = 'none';
        }
        if (this.elements.quickChip) {
            this.elements.quickChip.style.display = 'none';
        }
        this.updateZoneDataReadout(null);
    }

    updateZoneDataReadout(zone) {
        if (!this.elements.zoneCoords) return;
        this.elements.zoneCoords.innerHTML = zone
            ? this.formatZoneCoords(zone)
            : 'Select a layer to view its data.';
    }

    /**
     * Anchor the floating panel to the zone - called on pan/zoom/select
     * Smarter positioning: avoid overlapping the zone itself
     */
    updateFloatingPosition() {
        if (!this.elements.quickChip || this.elements.quickChip.style.display === 'none') return;
        
        const zone = this.app.zoneManager.getSelectedZone();
        if (!zone) {
            this.hideFloatingControls();
            return;
        }

        const chip = this.elements.quickChip;
        const rect = chip.getBoundingClientRect();
        const chipW = rect.width || 260;
        const chipH = rect.height || 58;
        const viewportW = document.documentElement.clientWidth;
        const viewportH = document.documentElement.clientHeight;
        
        // Get zone screen bounds
        const bb = this.getZoneScreenBB(zone);

        const leftLimit = this.toolbarElement
            ? this.toolbarElement.getBoundingClientRect().right + 16
            : 16;
        let rightLimit = viewportW - 16;
        if (this.zonePanelElement) {
            rightLimit = Math.min(rightLimit, this.zonePanelElement.getBoundingClientRect().left - 16);
        }
        if (this.elements.floatingControls && this.elements.floatingControls.style.display !== 'none' && !this.inspectorCollapsed) {
            rightLimit = Math.min(rightLimit, this.elements.floatingControls.getBoundingClientRect().left - 16);
        }

        let targetX = bb.minX + (bb.width / 2) - (chipW / 2);
        let targetY = bb.minY - chipH - 14;
        if (targetY < 84) {
            targetY = bb.maxY + 14;
        }
        if (targetY + chipH > viewportH - 16) {
            targetY = Math.max(84, bb.minY - chipH - 14);
        }

        targetX = Math.max(leftLimit, Math.min(targetX, rightLimit - chipW));
        targetY = Math.max(84, Math.min(targetY, viewportH - chipH - 16));

        chip.style.left = `${targetX}px`;
        chip.style.top = `${targetY}px`;
    }

    /**
     * Get screen-space bounding box for a zone
     */
    getZoneScreenBB(zone) {
        const mapToViewport = (mapX, mapY) => {
            const point = this.app.core.mapToScreen(mapX, mapY);
            const canvasRect = this.app.core.canvas.getBoundingClientRect();
            return {
                x: canvasRect.left + point.x,
                y: canvasRect.top + point.y
            };
        };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (zone.shape === 'circle') {
            const center = mapToViewport(zone.cx ?? 0, zone.cy ?? 0);
            const radius = (zone.radius ?? 0) * this.app.core.zoom;
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
        } else if (zone.points) {
            zone.points.forEach(p => {
                const screenP = mapToViewport(p.x, p.y);
                minX = Math.min(minX, screenP.x);
                maxX = Math.max(maxX, screenP.x);
                minY = Math.min(minY, screenP.y);
                maxY = Math.max(maxY, screenP.y);
            });
        } else {
            const center = mapToViewport(zone.x ?? 0, zone.y ?? 0);
            minX = maxX = center.x;
            minY = maxY = center.y;
        }

        return { 
            minX, minY, maxX, maxY, 
            width: maxX - minX, 
            height: maxY - minY 
        };
    }

    /**
     * Format zone coordinates for display
     */
    formatZoneCoords(zone) {
        if (zone.shape === 'circle') {
            const cx = zone.cx ?? 0;
            const cy = zone.cy ?? 0;
            const radius = zone.radius ?? 0;
            return `Center: (${cx.toFixed(1)}, ${cy.toFixed(1)})<br>Radius: ${radius.toFixed(1)}`;
        } else if (zone.shape === 'rectangle') {
            const x = zone.x ?? 0;
            const y = zone.y ?? 0;
            const width = zone.width ?? 0;
            const height = zone.height ?? 0;
            return `Position: (${x.toFixed(1)}, ${y.toFixed(1)})<br>Size: ${width.toFixed(1)} x ${height.toFixed(1)}`;
        } else if (zone.shape === 'line') {
            const x1 = zone.x1 ?? 0;
            const y1 = zone.y1 ?? 0;
            const x2 = zone.x2 ?? 0;
            const y2 = zone.y2 ?? 0;
            return `Start: (${x1.toFixed(1)}, ${y1.toFixed(1)})<br>End: (${x2.toFixed(1)}, ${y2.toFixed(1)})`;
        } else if (zone.points) {
            return zone.points.map((p, i) =>
                `P${i + 1}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`
            ).join('<br>');
        }
        return '';
    }

    /**
     * Update label options visibility based on showLabel checkbox
     */
    updateLabelOptionsVisibility() {
        if (!this.elements.showLabel) return;
        const showLabel = this.elements.showLabel.checked;
        this.elements.floatingControls.querySelectorAll('.label-options').forEach(el => {
            el.style.opacity = showLabel ? '1' : '0.4';
            el.style.pointerEvents = showLabel ? 'auto' : 'none';
        });
    }

    /**
     * Update the selected zone with current property values
     */
    updateSelectedZone(options = {}) {
        if (!this.app.zoneManager.selectedZoneId) return null;

        const live = !!options.live;
        const selectedZone = this.app.zoneManager.getSelectedZone();
        if (!selectedZone) return null;

        const previousSummary = {
            name: selectedZone.name,
            profileId: selectedZone.profileId,
            color: selectedZone.color
        };

        const labelFontSize = this.getLabelFontSizeValue();
        const borderLabelMode = this.elements.labelBorderToggle?.checked
            ? (this.elements.borderLabelMode?.value || 'repeat')
            : 'none';
        const patternLabelMode = this.elements.labelPatternToggle?.checked
            ? (this.elements.patternLabelMode?.value || 'checker_embed')
            : 'none';

        const labelTextValue = this.elements.labelText ? this.elements.labelText.value.trim() : '';
        const currentName = this.elements.floatingZoneName ? this.elements.floatingZoneName.textContent : 'Zone';
        const finalName = labelTextValue || currentName;

        const updatedZone = this.app.zoneManager.updateZone(this.app.zoneManager.selectedZoneId, {
            name: finalName,
            profileId: this.elements.zoneProfile ? this.elements.zoneProfile.value : 'custom',
            style: this.elements.zoneStyle ? this.elements.zoneStyle.value : 'solid',
            fillPattern: this.elements.zoneFillPattern ? this.elements.zoneFillPattern.value : 'solid',
            color: this.elements.zoneColor ? this.elements.zoneColor.value : '#ffffff',
            
            fillOpacity: this.elements.fillOpacity ? parseInt(this.elements.fillOpacity.value) / 100 : 0.4,
            borderOpacity: this.elements.borderOpacity ? parseInt(this.elements.borderOpacity.value) / 100 : 1.0,
            borderWidth: this.elements.borderWidth ? parseFloat(this.elements.borderWidth.value) : 3,
            patternThickness: this.elements.patternThickness ? parseFloat(this.elements.patternThickness.value) : 2,
            patternDensity: this.elements.patternDensity ? parseInt(this.elements.patternDensity.value) : 20,
            patternAngle: this.elements.patternAngle ? parseInt(this.elements.patternAngle.value) : 0,
            borderLabelMode: borderLabelMode,
            patternLabelMode: patternLabelMode,

            // Legacy fallback for backward compatibility
            opacity: this.elements.fillOpacity ? parseInt(this.elements.fillOpacity.value) / 100 : 0.4,

            // Label styling
            showLabel: this.elements.showLabel ? this.elements.showLabel.checked : true,
            labelText: this.elements.labelText ? this.elements.labelText.value : (this.elements.floatingZoneName ? this.elements.floatingZoneName.textContent : 'Zone'),
            labelColor: this.elements.labelColor ? this.elements.labelColor.value : '#ffffff',
            labelOpacity: this.elements.labelOpacity ? parseInt(this.elements.labelOpacity.value) / 100 : 1.0,
            labelBgColor: this.elements.labelBgColor ? this.elements.labelBgColor.value : '#000000',
            labelBgOpacity: this.elements.labelBgOpacity ? parseInt(this.elements.labelBgOpacity.value) / 100 : 0.7,
            labelFontSize: labelFontSize,
            labelSize: this.getLegacyLabelSizeKey(labelFontSize),
            labelFontFamily: this.elements.labelFontFamily ? this.elements.labelFontFamily.value : 'rajdhani',
            labelBold: this.elements.labelBold ? this.elements.labelBold.checked : false,
            labelItalic: this.elements.labelItalic ? this.elements.labelItalic.checked : false,
            labelShadow: this.elements.labelShadow ? this.elements.labelShadow.checked : true,
            labelRotation: this.elements.labelRotation ? parseInt(this.elements.labelRotation.value, 10) : 0
        }, {
            live,
            persist: !live
        });

        if (!updatedZone) {
            return null;
        }

        this.syncZoneTitles(updatedZone.name);

        const shouldRefreshList = (
            updatedZone.name !== previousSummary.name ||
            updatedZone.profileId !== previousSummary.profileId ||
            updatedZone.color !== previousSummary.color
        );

        if (live) {
            this.persistLiveZoneChanges();
            this.updateZoneDataReadout(updatedZone);
            this.updateLabelPositionInfo(updatedZone);
            if (shouldRefreshList) {
                this.refreshZoneListDebounced();
            }
            return updatedZone;
        }

        this.showZoneProperties(updatedZone, true);
        this.app.zoneListUI.updateZoneList();
        return updatedZone;
    }

    showNamePrompt(label, defaultValue, onConfirm) {
        if (!this.elements.floatingControls) return;
        const overlay = document.createElement('div');
        overlay.className = 'inline-prompt-overlay';
        overlay.innerHTML = `
            <div class="inline-prompt">
                <p>${label}</p>
                <input type="text" class="compact-input">
                <div class="inline-prompt-actions">
                    <button class="btn-chip cancel-btn">Cancel</button>
                    <button class="btn-chip primary confirm-btn">Save</button>
                </div>
            </div>
        `;
        this.elements.floatingControls.appendChild(overlay);
        const input = overlay.querySelector('input');
        input.value = defaultValue || '';
        input.focus();
        input.select();

        const confirm = () => {
            const value = input.value.trim();
            overlay.remove();
            if (value) onConfirm(value);
        };
        overlay.querySelector('.confirm-btn').addEventListener('click', confirm);
        overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') overlay.remove();
        });
    }

    showConfirm(message, onConfirm) {
        if (!this.elements.floatingControls) return;
        const overlay = document.createElement('div');
        overlay.className = 'inline-prompt-overlay';
        overlay.innerHTML = `
            <div class="inline-prompt">
                <p>${message}</p>
                <div class="inline-prompt-actions">
                    <button class="btn-chip cancel-btn">Cancel</button>
                    <button class="btn-chip primary danger-btn" style="color:#ff4757; border-color:rgba(255,71,87,0.4);">Delete</button>
                </div>
            </div>
        `;
        this.elements.floatingControls.appendChild(overlay);
        overlay.querySelector('.danger-btn').addEventListener('click', () => { overlay.remove(); onConfirm(); });
        overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            background:rgba(20,22,28,0.95); border:1px solid rgba(255,255,255,0.12);
            border-radius:10px; padding:10px 18px; color:rgba(255,255,255,0.85);
            font-size:13px; font-family:var(--font-primary); z-index:9999;
            box-shadow:0 8px 30px rgba(0,0,0,0.5); pointer-events:none;
            animation:floatPanelIn 0.25s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2800);
    }

    /**
     * Delete the currently selected zone
     */
    deleteSelectedZone() {
        if (!this.app.zoneManager.selectedZoneId) return;
        this.app.historyManager.saveHistory();
        this.app.zoneManager.deleteZone(this.app.zoneManager.selectedZoneId);
        this.hideFloatingControls();
        this.app.zoneListUI.updateZoneList();
        this.app.updateUI();
    }
}

// Export for use in other modules
window.ZonePropertiesUI = ZonePropertiesUI;
