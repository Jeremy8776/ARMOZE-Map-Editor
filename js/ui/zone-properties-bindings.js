/**
 * Zone Properties Bindings
 * Attaches all DOM event listeners for the zone properties panel to a
 * ZonePropertiesUI instance. Kept as a free function (rather than a class)
 * because the wiring is purely side-effect work performed once during init.
 *
 * Split out of ZonePropertiesUI so the panel stays under the 700-line cap
 * and so the event surface can be reviewed in one place.
 */
function bindZonePropertiesEvents(ui) {
    const els = ui.elements;

    const markAsCustom = () => {
        if (els.zoneProfile) els.zoneProfile.value = 'custom';
        ui.updateSelectedZone();
    };
    const markLabelAsCustom = () => {
        if (els.zoneProfile) els.zoneProfile.value = 'custom';
    };

    if (els.zoneName) els.zoneName.addEventListener('input', () => ui.updateSelectedZone({ live: true }));

    if (els.zoneProfile) {
        els.zoneProfile.addEventListener('change', (e) => ui.applyProfile(e.target.value));
    }
    if (els.btnSaveProfile) {
        els.btnSaveProfile.addEventListener('click', () => ui.saveCurrentAsProfile());
    }
    if (els.btnDeleteProfile) {
        els.btnDeleteProfile.addEventListener('click', () => ui.deleteCurrentProfile());
    }

    if (els.zoneStyle) {
        els.zoneStyle.addEventListener('change', markAsCustom);
        els.zoneStyle.addEventListener('change', () => ui.syncAccordionSummaries());
    }
    if (els.zoneFillPattern) {
        els.zoneFillPattern.addEventListener('change', markAsCustom);
        els.zoneFillPattern.addEventListener('change', () => ui.syncAccordionSummaries());
    }

    if (els.zoneColor) {
        els.zoneColor.addEventListener('input', () => {
            ui.syncColorInputPreview(els.zoneColor);
            ui.setColorInputValue('quickZoneColor', els.zoneColor.value);
            if (els.zoneProfile) els.zoneProfile.value = 'custom';
            ui.updateSelectedZone({ live: true });
        });
        els.zoneColor.addEventListener('change', () => {
            ui.rememberRecentColor('zone', els.zoneColor.value);
            markAsCustom();
        });
    }

    const onLabelIntegrationChange = () => {
        markAsCustom();
        ui.syncAccordionSummaries();
        ui.updateLabelPositionInfo(ui.app.zoneManager.getSelectedZone());
        ui.updateIntegratedLabelControls();
    };
    if (els.borderLabelMode) els.borderLabelMode.addEventListener('change', onLabelIntegrationChange);
    if (els.patternLabelMode) els.patternLabelMode.addEventListener('change', onLabelIntegrationChange);

    const attachSlider = (id, suffix = '') => {
        const input = els[id];
        if (!input) return;
        input.addEventListener('input', () => {
            const valEl = els[`${id}Val`];
            if (valEl) valEl.textContent = input.value + suffix;
            if (els.zoneProfile) els.zoneProfile.value = 'custom';
            ui.updateSelectedZone({ live: true });
        });
        input.addEventListener('change', () => ui.updateSelectedZone());
    };

    attachSlider('fillOpacity', '%');
    attachSlider('borderOpacity', '%');
    attachSlider('borderWidth', 'px');
    attachSlider('patternThickness', 'px');
    attachSlider('patternDensity', '');
    attachSlider('patternAngle', '°');
    attachSlider('labelFontSize', 'px');
    attachSlider('labelRotation', '°');

    if (els.btnDeleteZone) els.btnDeleteZone.addEventListener('click', () => ui.deleteSelectedZone());

    if (els.showLabel) {
        els.showLabel.addEventListener('change', () => {
            markLabelAsCustom();
            ui.updateLabelOptionsVisibility();
            ui.syncAccordionSummaries();
            ui.updateSelectedZone();
        });
    }
    if (els.labelText) {
        els.labelText.addEventListener('input', () => {
            markLabelAsCustom();
            ui.syncAccordionSummaries();
            ui.updateSelectedZone({ live: true });
        });
        els.labelText.addEventListener('change', () => ui.updateSelectedZone());
    }
    if (els.labelColor) {
        els.labelColor.addEventListener('input', () => {
            ui.syncColorInputPreview(els.labelColor);
            markLabelAsCustom();
            ui.updateSelectedZone({ live: true });
        });
        els.labelColor.addEventListener('change', () => {
            ui.rememberRecentColor('label', els.labelColor.value);
            ui.updateSelectedZone();
        });
    }
    if (els.labelOpacity) {
        els.labelOpacity.addEventListener('input', () => {
            markLabelAsCustom();
            if (els.labelOpacityValue) els.labelOpacityValue.textContent = els.labelOpacity.value + '%';
            ui.updateSelectedZone({ live: true });
        });
        els.labelOpacity.addEventListener('change', () => ui.updateSelectedZone());
    }
    if (els.labelBgColor) {
        els.labelBgColor.addEventListener('input', () => {
            ui.syncColorInputPreview(els.labelBgColor);
            markLabelAsCustom();
            ui.updateSelectedZone({ live: true });
        });
        els.labelBgColor.addEventListener('change', () => {
            ui.rememberRecentColor('labelBg', els.labelBgColor.value);
            ui.updateSelectedZone();
        });
    }
    if (els.labelBgOpacity) {
        els.labelBgOpacity.addEventListener('input', () => {
            markLabelAsCustom();
            if (els.labelBgOpacityValue) els.labelBgOpacityValue.textContent = els.labelBgOpacity.value + '%';
            ui.updateSelectedZone({ live: true });
        });
        els.labelBgOpacity.addEventListener('change', () => ui.updateSelectedZone());
    }

    const bindLabelToggleSync = (el) => {
        if (!el) return;
        el.addEventListener('change', () => {
            markLabelAsCustom();
            ui.syncAccordionSummaries();
            ui.updateSelectedZone();
        });
    };
    bindLabelToggleSync(els.labelFontFamily);
    bindLabelToggleSync(els.labelBold);
    bindLabelToggleSync(els.labelItalic);

    if (els.labelShadow) {
        els.labelShadow.addEventListener('change', () => {
            markLabelAsCustom();
            ui.updateSelectedZone();
        });
    }

    if (els.labelBorderToggle) {
        els.labelBorderToggle.addEventListener('change', () => {
            markLabelAsCustom();
            if (els.labelBorderToggle.checked) {
                if (els.borderLabelMode?.value === 'none') els.borderLabelMode.value = 'repeat';
                if (els.labelPatternToggle) els.labelPatternToggle.checked = false;
                if (els.patternLabelMode) els.patternLabelMode.value = 'none';
            } else if (els.borderLabelMode) {
                els.borderLabelMode.value = 'none';
            }
            ui.updateIntegratedLabelControls();
            ui.syncAccordionSummaries();
            ui.updateLabelPositionInfo(ui.app.zoneManager.getSelectedZone());
            ui.updateSelectedZone();
        });
    }
    if (els.labelPatternToggle) {
        els.labelPatternToggle.addEventListener('change', () => {
            markLabelAsCustom();
            if (els.labelPatternToggle.checked) {
                if (els.patternLabelMode?.value === 'none') els.patternLabelMode.value = 'checker_embed';
                if (els.labelBorderToggle) els.labelBorderToggle.checked = false;
                if (els.borderLabelMode) els.borderLabelMode.value = 'none';
            } else if (els.patternLabelMode) {
                els.patternLabelMode.value = 'none';
            }
            ui.updateIntegratedLabelControls();
            ui.syncAccordionSummaries();
            ui.updateLabelPositionInfo(ui.app.zoneManager.getSelectedZone());
            ui.updateSelectedZone();
        });
    }

    if (els.btnResetLabelPosition) {
        els.btnResetLabelPosition.addEventListener('click', () => {
            const zone = ui.app.zoneManager.getSelectedZone();
            if (!zone) return;
            if (els.zoneProfile) els.zoneProfile.value = 'custom';
            zone.labelOffsetX = 0;
            zone.labelOffsetY = 0;
            ui.updateLabelPositionInfo(zone);
            ui.app.zoneManager.updateZone(zone.id, { labelOffsetX: 0, labelOffsetY: 0 });
        });
    }

    if (els.floatingZoneName) {
        els.floatingZoneName.addEventListener('click', () => {
            const zone = ui.app.zoneManager.getSelectedZone();
            if (!zone) return;
            ui.app.notificationService?.showPrompt('', {
                title: 'Rename Zone',
                defaultValue: zone.name,
                confirmLabel: 'Save'
            }).then((newName) => {
                if (!newName) return;
                zone.name = newName;
                zone.labelText = newName;
                if (els.labelText) els.labelText.value = newName;
                els.floatingZoneName.textContent = newName;
                ui.app.zoneListUI.updateZoneList();
                ui.updateSelectedZone();
            });
        });
    }

    if (els.btnFloatDuplicate) {
        els.btnFloatDuplicate.addEventListener('click', () => ui.app.duplicateSelectedZone());
    }
    if (els.btnFloatDelete) {
        els.btnFloatDelete.addEventListener('click', () => ui.deleteSelectedZone());
    }
    if (els.btnFloatClose) {
        els.btnFloatClose.addEventListener('click', () => ui.setInspectorCollapsed(true));
    }

    if (els.quickZoneColor) {
        els.quickZoneColor.addEventListener('input', () => {
            ui.setColorInputValue('zoneColor', els.quickZoneColor.value);
            if (els.zoneProfile) els.zoneProfile.value = 'custom';
            ui.updateSelectedZone({ live: true });
        });
        els.quickZoneColor.addEventListener('change', () => {
            ui.rememberRecentColor('zone', els.quickZoneColor.value);
            ui.updateSelectedZone();
        });
    }

    if (els.quickZoneName) {
        els.quickZoneName.addEventListener('click', () => ui.openInspector());
    }
    if (els.btnQuickOpenInspector) {
        els.btnQuickOpenInspector.addEventListener('click', () => ui.openInspector());
    }
    if (els.btnQuickDuplicate) {
        els.btnQuickDuplicate.addEventListener('click', () => ui.app.duplicateSelectedZone());
    }
    if (els.btnQuickDelete) {
        els.btnQuickDelete.addEventListener('click', () => ui.deleteSelectedZone());
    }
}

window.bindZonePropertiesEvents = bindZonePropertiesEvents;
