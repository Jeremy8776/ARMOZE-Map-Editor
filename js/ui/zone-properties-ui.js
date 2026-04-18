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
        this.shell = new ZoneInspectorShell(this);
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

        this.colorManager = new ZoneColorManager(this);
        this.profileManager = new ZoneProfileManager(this);

        this.profileManager.renderOptions();
        this.colorManager.renderRows();
        this.setupEventListeners();
        this.colorManager.syncAllPreviews();
    }

    // Thin adapters so call sites (event wiring + markup) can remain terse and
    // still route through the extracted managers.
    setColorInputValue(inputOrKey, value, fallback) {
        this.colorManager.setColorInputValue(inputOrKey, value, fallback);
    }

    syncColorInputPreview(input) {
        this.colorManager.syncInputPreview(input);
    }

    rememberRecentColor(section, color) {
        this.colorManager.remember(section, color);
    }

    getSelectText(select, fallback) {
        return select?.selectedOptions?.[0]?.textContent || fallback;
    }

    get profiles() {
        return this.profileManager?.getAll() || {};
    }

    saveCurrentAsProfile() {
        return this.profileManager.saveCurrentAsProfile();
    }

    deleteCurrentProfile() {
        return this.profileManager.deleteCurrent();
    }

    applyProfile(id) {
        this.profileManager.apply(id);
    }

    /**
     * Setup event listeners for zone properties inputs
     */
    setupEventListeners() {
        bindZonePropertiesEvents(this);
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

    syncZoneTitles(name) {
        this.shell.syncZoneTitles(name);
    }

    setInspectorCollapsed(collapsed) {
        this.shell.setInspectorCollapsed(collapsed);
    }

    pulseInspector() {
        this.shell.pulseInspector();
    }

    openInspector() {
        this.shell.openInspector();
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
        this.shell.showFloatingControls(zone);
    }

    hideFloatingControls() {
        this.shell.hideFloatingControls();
    }

    updateZoneDataReadout(zone) {
        this.shell.updateZoneDataReadout(zone);
    }

    /**
     * Anchor the floating panel to the zone - called on pan/zoom/select
     * Smarter positioning: avoid overlapping the zone itself
     */
    updateFloatingPosition() {
        this.shell.updateFloatingPosition();
    }

    /**
     * Get screen-space bounding box for a zone
     */
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
