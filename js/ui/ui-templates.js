/**
 * UI Templates Module
 * Contains large HTML fragments for modals and floating panels.
 */
const UITemplates = {
    FLOATING_CONTROLS: `
        <div id="zoneQuickChip" class="zone-quick-chip" style="display: none;">
            <div class="zone-quick-chip__identity">
                <span class="zone-quick-chip__eyebrow">Zone</span>
                <button type="button" id="zoneQuickName" class="zone-quick-chip__name">Zone Name</button>
            </div>
            <label class="zone-quick-chip__color" style="--selected-color:#00ff88;" aria-label="Quick zone color">
                <span class="color-wheel-core" aria-hidden="true"></span>
                <input type="color" id="quickZoneColor" class="compact-color-picker" value="#00ff88">
            </label>
            <div class="zone-quick-chip__actions">
                <button id="btnQuickOpenInspector" class="zone-quick-chip__action zone-quick-chip__action--primary" title="Open Inspector">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18 3h3v3"/><path d="M10 14 21 3"/></svg>
                </button>
                <button id="btnQuickDuplicate" class="zone-quick-chip__action" title="Duplicate Zone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button id="btnQuickDelete" class="zone-quick-chip__action zone-quick-chip__action--danger" title="Delete Zone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </div>
        </div>

        <div id="floatingZoneControls" class="floating-controls-panel zone-inspector-panel" style="display: none;">
            <div class="floating-controls-header">
                <div class="zone-inspector-heading">
                    <span class="zone-inspector-kicker">Zone Inspector</span>
                    <span id="floatingZoneName" class="editable-name">Zone Name</span>
                </div>
                <div class="floating-controls-actions">
                    <button id="btnFloatDuplicate" title="Duplicate"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
                    <button id="btnFloatDelete" class="btn-danger-text" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                    <button id="btnFloatClose" title="Collapse Inspector"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                </div>
            </div>
            
            <div class="floating-controls-body">
                <div class="zone-inspector-intro">
                    <p>Stable editing surface for the selected zone. Use the chip on the map for quick changes.</p>
                </div>
                <div class="property-grid">
                        <div class="property-item">
                            <label>Profile</label>
                            <div class="profile-select-group">
                                <select id="zoneProfile" class="compact-select"></select>
                                <button id="btnSaveProfile" class="btn-icon-small" title="Save Style"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
                                <button id="btnDeleteProfile" class="btn-icon-small btn-danger-text" title="Delete Profile"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                            </div>
                        </div>

                        <div class="property-item">
                            <div class="property-label-row">
                                <label>Color</label>
                                <span class="custom-color-picker-label">Inspector</span>
                            </div>
                            <div class="background-control-row">
                                <label class="color-wheel-control compact-color-picker-shell" style="--selected-color:#00ff88;" aria-label="Custom color">
                                    <span class="color-wheel-core" aria-hidden="true"></span>
                                    <input type="color" id="zoneColor" class="compact-color-picker" value="#00ff88">
                                </label>
                                <div class="slider-row compact-slider-row">
                                    <input type="range" id="fillOpacity" min="0" max="100" step="5">
                                    <span id="fillOpacityVal" class="slider-val">40%</span>
                                </div>
                            </div>
                            <div class="recent-colors-group">
                                <span class="recent-colors-label">Recent Colors</span>
                                <div class="recent-colors-row" id="zoneRecentColors"></div>
                            </div>
                        </div>

                        <section class="accordion-section" data-accordion="border">
                            <button
                                type="button"
                                class="accordion-trigger"
                                data-accordion-trigger
                                aria-expanded="false"
                                aria-controls="borderAccordionPanel">
                                <span class="accordion-trigger-copy">
                                    <span class="accordion-title">Border Style</span>
                                    <span class="accordion-summary" id="borderStyleSummary">Solid</span>
                                </span>
                                <span class="accordion-chevron" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </span>
                            </button>
                            <div id="borderAccordionPanel" class="accordion-panel" data-accordion-panel>
                                <div class="property-item">
                                    <label>Border Style</label>
                                    <select id="zoneStyle" class="compact-select">
                                        <option value="solid">Solid</option>
                                        <option value="dashed">Dashed</option>
                                        <option value="dotted">Dotted</option>
                                    </select>
                                </div>

                                <div class="property-item">
                                    <label>Border Width</label>
                                    <div class="slider-row">
                                        <input type="range" id="borderWidth" min="1" max="15" step="1">
                                        <span id="borderWidthVal" class="slider-val">3px</span>
                                    </div>
                                </div>

                                <div class="property-item">
                                    <label>Border Opacity</label>
                                    <div class="slider-row">
                                        <input type="range" id="borderOpacity" min="0" max="100" value="100">
                                        <span id="borderOpacityVal" class="slider-val">100%</span>
                                    </div>
                                </div>

                            </div>
                        </section>

                        <section class="accordion-section" data-accordion="pattern">
                            <button
                                type="button"
                                class="accordion-trigger"
                                data-accordion-trigger
                                aria-expanded="false"
                                aria-controls="patternAccordionPanel">
                                <span class="accordion-trigger-copy">
                                    <span class="accordion-title">Pattern Type</span>
                                    <span class="accordion-summary" id="patternTypeSummary">Solid Fill</span>
                                </span>
                                <span class="accordion-chevron" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </span>
                            </button>
                            <div id="patternAccordionPanel" class="accordion-panel" data-accordion-panel>
                                <div class="property-item">
                                    <label>Pattern Type</label>
                                    <select id="zoneFillPattern" class="compact-select">
                                        <option value="solid">Solid Fill</option>
                                        <option value="diagonal_right">Diagonal Detail</option>
                                        <option value="diagonal_left">Diagonal Reverse</option>
                                        <option value="crosshatch">Crosshatch</option>
                                        <option value="dots">Dotted Pattern</option>
                                    </select>
                                </div>

                                <div class="property-item">
                                    <label>Pattern Density</label>
                                    <div class="slider-row">
                                        <input type="range" id="patternDensity" min="5" max="100" value="20">
                                        <span id="patternDensityVal" class="slider-val">20</span>
                                    </div>
                                </div>

                                <div class="property-item">
                                    <label>Pattern Angle</label>
                                    <div class="slider-row">
                                        <input type="range" id="patternAngle" min="0" max="180" value="0">
                                        <span id="patternAngleVal" class="slider-val">0°</span>
                                    </div>
                                </div>

                                <div class="property-item">
                                    <label>Pattern Thickness</label>
                                    <div class="slider-row">
                                        <input type="range" id="patternThickness" min="1" max="10" value="2">
                                        <span id="patternThicknessVal" class="slider-val">2px</span>
                                    </div>
                                </div>

                            </div>
                        </section>

                        <section class="accordion-section" data-accordion="label">
                            <button
                                type="button"
                                class="accordion-trigger"
                                data-accordion-trigger
                                aria-expanded="false"
                                aria-controls="labelAccordionPanel">
                                <span class="accordion-trigger-copy">
                                    <span class="accordion-title">Label</span>
                                    <span class="accordion-summary" id="labelStyleSummary">Visible</span>
                                </span>
                                <span class="accordion-chevron" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </span>
                            </button>
                            <div id="labelAccordionPanel" class="accordion-panel" data-accordion-panel>
                                <div class="property-item">
                                    <label class="checkbox-label"><input type="checkbox" id="showLabel" checked><span>Show Label</span></label>
                                </div>

                                <div class="label-options">
                                    <div class="property-item">
                                        <label>Label Text</label>
                                        <input type="text" id="labelText" class="compact-input" placeholder="Zone label text">
                                    </div>

                                    <div class="property-item">
                                        <label>Type Style</label>
                                        <div class="segmented-toggle">
                                            <label class="toggle-chip"><input type="checkbox" id="labelBold"><span>Bold</span></label>
                                            <label class="toggle-chip"><input type="checkbox" id="labelItalic"><span>Italic</span></label>
                                            <label class="toggle-chip"><input type="checkbox" id="labelShadow"><span>Shadow</span></label>
                                        </div>
                                    </div>

                                    <div class="property-item">
                                        <label>Font</label>
                                        <select id="labelFontFamily" class="compact-select">
                                            <option value="rajdhani">Rajdhani</option>
                                            <option value="mono">Share Tech Mono</option>
                                            <option value="system">Segoe UI</option>
                                        </select>
                                    </div>

                                    <div class="property-item">
                                        <label>Text Color</label>
                                        <div class="background-control-row">
                                            <label class="color-wheel-control" style="--selected-color:#ffffff;">
                                                <span class="color-wheel-core" aria-hidden="true"></span>
                                                <input type="color" id="labelColor" value="#ffffff">
                                            </label>
                                            <div class="slider-row compact-slider-row">
                                                <input type="range" id="labelOpacity" min="0" max="100" value="100">
                                                <span id="labelOpacityValue" class="slider-val">100%</span>
                                            </div>
                                        </div>
                                        <div class="recent-colors-group">
                                            <span class="recent-colors-label">Recent Colors</span>
                                            <div class="recent-colors-row" id="labelRecentColors"></div>
                                        </div>
                                    </div>

                                    <div class="property-item">
                                        <label>Text Size</label>
                                        <div class="slider-row">
                                            <input type="range" id="labelFontSize" min="10" max="100" step="1" value="14">
                                            <span id="labelFontSizeVal" class="slider-val">14px</span>
                                        </div>
                                    </div>

                                    <div class="property-item">
                                        <label>Text Rotation</label>
                                        <div class="slider-row">
                                            <input type="range" id="labelRotation" min="0" max="360" step="1" value="0">
                                            <span id="labelRotationVal" class="slider-val">0°</span>
                                        </div>
                                    </div>

                                    <div class="property-item">
                                        <label>Integration</label>
                                        <div class="segmented-toggle integration-toggle-row">
                                            <label class="toggle-chip"><input type="checkbox" id="labelBorderToggle"><span>Border</span></label>
                                            <label class="toggle-chip"><input type="checkbox" id="labelPatternToggle"><span>Pattern</span></label>
                                        </div>
                                        <select id="patternLabelMode" class="compact-select ui-hidden-control" aria-hidden="true" tabindex="-1">
                                            <option value="none">Off</option>
                                            <option value="checker_embed">Checker Embed</option>
                                        </select>
                                    </div>

                                    <div class="property-item integration-detail" id="borderLabelDetail">
                                        <select id="borderLabelMode" class="compact-select">
                                            <option value="none">Off</option>
                                            <option value="repeat">Repeat on Border</option>
                                            <option value="dash_alt">Every Other Dash</option>
                                        </select>
                                    </div>

                                    <div class="property-item">
                                        <label>Background</label>
                                        <div class="background-control-row">
                                            <label class="color-wheel-control" style="--selected-color:#000000;">
                                                <span class="color-wheel-core" aria-hidden="true"></span>
                                                <input type="color" id="labelBgColor" value="#000000">
                                            </label>
                                            <div class="slider-row compact-slider-row">
                                                <input type="range" id="labelBgOpacity" min="0" max="100" value="70">
                                                <span id="labelBgOpacityValue" class="slider-val">70%</span>
                                            </div>
                                        </div>
                                        <div class="recent-colors-group">
                                            <span class="recent-colors-label">Recent Colors</span>
                                            <div class="recent-colors-row" id="labelBgRecentColors"></div>
                                        </div>
                                    </div>

                                    <div class="property-item">
                                        <label>Placement</label>
                                        <div class="label-position-row">
                                            <button type="button" id="btnResetLabelPosition" class="btn-chip">Reset to Center</button>
                                            <span id="labelPositionInfo" class="inline-hint">Drag the label on the map to place it inside or outside the shape.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                </div>
            </div>
        </div>
    `,

    EXPORT_MODAL: `
        <div class="modal-overlay" id="exportModal">
            <div class="modal">
                <div class="modal-header">
                    <h2><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg> Export Zones</h2>
                    <button class="modal-close" id="btnCloseExport">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <label class="export-option"><input type="radio" name="exportFormat" value="enfusion" checked><div class="export-option-content"><span class="export-option-title">EnfusionScript (.c)</span><p>Direct copy-paste for Enfusion code blocks.</p></div></label>
                        <label class="export-option"><input type="radio" name="exportFormat" value="image"><div class="export-option-content"><span class="export-option-title">Image Overlay</span><p>Transparent overlay for Map Configs.</p></div></label>
                        <label class="export-option"><input type="radio" name="exportFormat" value="image_with_map"><div class="export-option-content"><span class="export-option-title">Map + Overlay</span><p>Full map image with zones drawn on top.</p></div></label>
                        <label class="export-option"><input type="radio" name="exportFormat" value="json"><div class="export-option-content"><span class="export-option-title">JSON Config</span><p>Portable state for sharing/re-editing.</p></div></label>
                        <label class="export-option"><input type="radio" name="exportFormat" value="workbench"><div class="export-option-content"><span class="export-option-title">Workbench Plugin (.c)</span><p>Plugin for script-based map generation.</p></div></label>
                    </div>

                    <div class="export-settings-glass">
                        <h4>Coordinate Foundation</h4>
                        <div class="setting-row">
                            <label>Origin Offset (X, Y)</label>
                            <div class="offset-inputs"><input type="number" id="originX" value="0" step="100"><input type="number" id="originY" value="0" step="100"></div>
                        </div>
                        <div class="setting-row">
                            <label>Map Scale (m / px)</label>
                            <input type="number" id="mapScale" value="1.0" step="0.0001" style="flex:1">
                        </div>
                        <div class="setting-row">
                            <label class="checkbox-label"><input type="checkbox" id="invertY" checked><span>Invert Y Axis (Tactical standard)</span></label>
                        </div>
                        <div class="setting-row">
                            <label>Image Format</label>
                            <select id="imageFormat" style="flex:1">
                                <option value="png" selected>PNG</option>
                                <option value="tiff">TIFF (16-bit friendly)</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary btn-full" id="btnOpenCalibration"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg> Calibrate Coordinate System</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-reset" id="btnCancelExport">Cancel</button>
                    <button class="btn btn-primary" id="btnConfirmExport">Generate & Export</button>
                </div>
            </div>
        </div>
    `,

    CALIBRATION_MODAL: `
        <div class="modal-overlay" id="calibrationModal">
            <div class="modal calibration-modal">
                <div class="modal-header">
                    <h2><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M17 21h4v-4"/><path d="M7 3H3v4"/><path d="M10 10v4h4v-4h-4z"/></svg> Map Calibration</h2>
                    <button class="modal-close" id="btnCloseCalibration">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-hint">Align map pixels with world coordinates by picking two reference points.</p>
                    
                    <div class="cal-step" id="calStep1">
                        <div class="cal-step-header"><span>Step 1: Reference Point Alpha</span><button class="btn-icon-auto" id="btnPickPoint1">Pick Point</button></div>
                        <div class="cal-coords">Map Pixels: <span id="pt1Params">-</span></div>
                        <div class="setting-row"><label>World Coords (X, Y)</label><div class="offset-inputs"><input type="number" id="pt1WorldX" placeholder="X"><input type="number" id="pt1WorldY" placeholder="Y"></div></div>
                    </div>

                    <div class="cal-step" id="calStep2">
                        <div class="cal-step-header"><span>Step 2: Reference Point Bravo</span><button class="btn-icon-auto" id="btnPickPoint2">Pick Point</button></div>
                        <div class="cal-coords">Map Pixels: <span id="pt2Params">-</span></div>
                        <div class="setting-row"><label>World Coords (X, Y)</label><div class="offset-inputs"><input type="number" id="pt2WorldX" placeholder="X"><input type="number" id="pt2WorldY" placeholder="Y"></div></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-reset" id="btnCancelCalibration">Cancel</button>
                    <button class="btn btn-primary" id="btnApplyCalibration" disabled>Apply Calibration</button>
                </div>
            </div>
        </div>
    `
};

window.UITemplates = UITemplates;
