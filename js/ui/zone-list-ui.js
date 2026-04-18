/**
 * Zone List UI Module
 * Handles the shared layer panel rendering and interactions.
 */
class ZoneListUI {
    constructor(app) {
        this.app = app;
        this.elements = null;
    }

    /**
     * Initialize the zone list UI
     * @param {Object} elements - DOM elements for zone list
     */
    init(elements) {
        this.elements = {
            zoneCount: elements.zoneCount,
            zoneList: elements.zoneList,
            zoneCoords: elements.zoneCoords || document.getElementById('zoneCoords'),
            layersSection: elements.layersSection || document.getElementById('layersSection'),
            zoneDataSection: elements.zoneDataSection || document.getElementById('zoneDataSection'),
            zonePanelResizer: elements.zonePanelResizer || document.getElementById('zonePanelResizer')
        };
        this.setupCompactDataSection();
    }

    setupCompactDataSection() {
        const dataSection = this.elements.zoneDataSection;
        const resizer = this.elements.zonePanelResizer;
        if (!dataSection) return;

        localStorage.removeItem('mapOverlay_zone_data_height');
        dataSection.style.flexBasis = '56px';
        if (resizer) resizer.style.display = 'none';
    }

    getLayers() {
        const zones = this.app.zoneManager.getZones().map(zone => ({
            kind: 'zone',
            id: zone.id,
            item: zone
        }));
        const overlays = (this.app.imageOverlayManager?.getOverlays?.() || []).map(overlay => ({
            kind: 'overlay',
            id: overlay.id,
            item: overlay
        }));
        return [...zones, ...overlays];
    }

    /**
     * Update the shared layer list display.
     */
    updateZoneList() {
        const layers = this.getLayers();
        this.elements.zoneCount.textContent = layers.length;

        if (layers.length === 0) {
            this.elements.zoneList.innerHTML = `
                <div class="empty-state">
                    <p>No layers created yet</p>
                    <p class="hint">Use the drawing tools or add a branding image</p>
                </div>
            `;
            if (this.elements.zoneCoords) {
                this.elements.zoneCoords.innerHTML = 'Select a layer to view its data.';
            }
            return;
        }

        this.elements.zoneList.innerHTML = layers.map(layer => this.renderLayerItem(layer)).join('');

        this.attachEventListeners();

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    renderLayerItem(layer) {
        const { kind, id, item } = layer;
        const isSelected = this.isLayerSelected(kind, id);
        const icon = kind === 'zone' ? this.getZoneShapeIcon(item) : 'image';
        const accentColor = kind === 'zone' ? item.color : '#7ad7ff';
        const metaLabel = kind === 'zone' ? this.getZoneMetaLabel(item) : this.getOverlayMetaLabel(item);
        const expandTitle = kind === 'zone' ? 'Show Properties' : 'Select Overlay';
        const name = kind === 'zone'
            ? (item.name || 'Zone')
            : (this.app.imageOverlayManager?.getOverlayDisplayName(item) || 'overlay');

        return `
            <div class="zone-item ${isSelected ? 'selected' : ''}" data-layer-id="${id}" data-layer-kind="${kind}">
                <div class="zone-shape-icon" style="color: ${accentColor}">
                    <i data-lucide="${icon}" style="width:16px; height:16px;"></i>
                </div>
                <div class="zone-item-info">
                    <div class="zone-item-name">${this.escapeHtml(name)}</div>
                    <div class="zone-item-meta">
                        <span class="profile-tag">${metaLabel}</span>
                    </div>
                </div>
                <div class="zone-item-actions">
                    ${kind === 'overlay' ? `
                        <button class="zone-action-btn overlay-tint-toggle ${item.tintEnabled ? 'is-active' : ''}" data-layer-id="${id}" title="${item.tintEnabled ? 'Disable Tint' : 'Enable Tint'}">
                            <i data-lucide="paint-bucket"></i>
                        </button>
                        <label class="overlay-tint-chip" title="Tint Color">
                            <span class="overlay-tint-chip__swatch" style="--overlay-tint:${item.tintColor || '#ffffff'};"></span>
                            <input type="color" class="overlay-tint-input" data-layer-id="${id}" value="${item.tintColor || '#ffffff'}">
                        </label>
                    ` : ''}
                    <button class="zone-action-btn zone-action-expand" data-layer-id="${id}" data-layer-kind="${kind}" title="${expandTitle}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                    <button class="zone-action-btn zone-action-delete" data-layer-id="${id}" data-layer-kind="${kind}" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                    <button class="zone-visibility" data-layer-id="${id}" data-layer-kind="${kind}" title="${item.visible ? 'Hide' : 'Show'}">
                        ${item.visible ? this.getEyeIcon() : this.getEyeOffIcon()}
                    </button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        this.elements.zoneList.querySelectorAll('.zone-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const layerId = item.dataset.layerId;
                const layerKind = item.dataset.layerKind;

                if (
                    e.target.closest('.zone-visibility') ||
                    e.target.closest('.zone-action-btn') ||
                    e.target.closest('.overlay-tint-chip')
                ) {
                    return;
                }

                if (layerKind === 'zone' && e.shiftKey && this.app.zoneManager.selectedZoneId) {
                    const index = this.app.selectedZoneIds.indexOf(layerId);
                    if (index === -1) {
                        this.app.selectedZoneIds.push(layerId);
                    } else {
                        this.app.selectedZoneIds.splice(index, 1);
                    }
                    this.updateZoneListSelection();
                    return;
                }

                this.app.selectedZoneIds = [];
                if (layerKind === 'zone') {
                    this.app.zoneManager.selectZone(layerId);
                    const zone = this.app.zoneManager.getZone(layerId);
                    if (zone && this.app.zonePropertiesUI) {
                        this.app.zonePropertiesUI.showZoneProperties(zone);
                    }
                } else {
                    this.app.imageOverlayManager?.selectOverlay(layerId);
                    this.app.zoneManager.selectZone(null);
                }
            });

            item.addEventListener('contextmenu', (e) => {
                if (item.dataset.layerKind === 'zone') {
                    this.app.contextMenu.showForZoneItem(e, item.dataset.layerId);
                }
            });
        });

        this.elements.zoneList.querySelectorAll('.zone-action-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layerKind = btn.dataset.layerKind;

                if (layerKind === 'zone') {
                    const zone = this.app.zoneManager.getZone(layerId);
                    if (zone) {
                        this.app.zoneManager.selectZone(layerId);
                        if (this.app.zonePropertiesUI) {
                            this.app.zonePropertiesUI.showZoneProperties(zone);
                        }
                    }
                } else {
                    this.app.imageOverlayManager?.selectOverlay(layerId);
                    this.app.zoneManager.selectZone(null);
                }
            });
        });

        this.elements.zoneList.querySelectorAll('.overlay-tint-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const overlay = this.app.imageOverlayManager?.getOverlay(btn.dataset.layerId);
                if (!overlay) return;
                if (this.app.historyManager) this.app.historyManager.saveHistory();
                const nextOverlay = this.app.imageOverlayManager.updateOverlay(overlay.id, {
                    tintEnabled: !overlay.tintEnabled
                });
                this.syncOverlayTintControls(nextOverlay);
            });
        });

        this.elements.zoneList.querySelectorAll('.overlay-tint-chip').forEach(chip => {
            chip.addEventListener('pointerdown', (e) => e.stopPropagation());
            chip.addEventListener('click', (e) => e.stopPropagation());
        });

        this.elements.zoneList.querySelectorAll('.overlay-tint-input').forEach(input => {
            input.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (this.app.historyManager) this.app.historyManager.saveHistory();
            });
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('input', (e) => {
                e.stopPropagation();
                const overlay = this.app.imageOverlayManager?.getOverlay(input.dataset.layerId);
                if (!overlay) return;
                const nextOverlay = this.app.imageOverlayManager.updateOverlay(overlay.id, {
                    tintEnabled: true,
                    tintColor: input.value
                }, { live: true, persist: false });
                this.syncOverlayTintControls(nextOverlay);
            });
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                const overlay = this.app.imageOverlayManager?.getOverlay(input.dataset.layerId);
                if (!overlay) return;
                const nextOverlay = this.app.imageOverlayManager.updateOverlay(overlay.id, {
                    tintEnabled: true,
                    tintColor: input.value
                });
                this.syncOverlayTintControls(nextOverlay);
            });
        });

        this.elements.zoneList.querySelectorAll('.zone-action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layerKind = btn.dataset.layerKind;
                if (this.app.historyManager) this.app.historyManager.saveHistory();

                if (layerKind === 'zone') {
                    this.app.zoneManager.deleteZone(layerId);
                    if (this.app.zonePropertiesUI) {
                        this.app.zonePropertiesUI.hideFloatingControls();
                    }
                } else {
                    this.app.imageOverlayManager?.deleteOverlay(layerId);
                }

                this.updateZoneList();
                if (this.app.updateUI) this.app.updateUI();
            });
        });

        this.elements.zoneList.querySelectorAll('.zone-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                const layerKind = btn.dataset.layerKind;

                if (layerKind === 'zone') {
                    const zone = this.app.zoneManager.getZone(layerId);
                    if (zone) {
                        this.app.zoneManager.updateZone(zone.id, { visible: !zone.visible });
                    }
                } else {
                    const overlay = this.app.imageOverlayManager?.getOverlay(layerId);
                    if (overlay) {
                        this.app.imageOverlayManager.updateOverlay(overlay.id, { visible: !overlay.visible });
                    }
                }

                this.updateZoneList();
            });
        });
    }

    isLayerSelected(kind, id) {
        if (kind === 'zone') {
            return id === this.app.zoneManager.selectedZoneId;
        }
        return id === this.app.imageOverlayManager?.selectedOverlayId;
    }

    getZoneShapeIcon(zone) {
        let shapeIcon = 'shapes';
        if (zone.shape === 'circle') shapeIcon = 'circle';
        else if (zone.shape === 'rectangle') shapeIcon = 'square';
        else if (zone.shape === 'line') shapeIcon = 'type';
        else if (zone.points) shapeIcon = 'triangle';
        return shapeIcon;
    }

    getZoneMetaLabel(zone) {
        if (this.app.zonePropertiesUI?.profiles?.[zone.profileId]) {
            return this.escapeHtml(this.app.zonePropertiesUI.profiles[zone.profileId].name);
        }
        return zone.profileId === 'custom' ? 'Custom' : 'Direct';
    }

    getOverlayMetaLabel(overlay) {
        const baseLabel = overlay.sourceType === 'svg' ? 'SVG Logo' : 'Branding';
        return overlay.tintEnabled ? `${baseLabel} Tinted` : baseLabel;
    }

    syncOverlayTintControls(overlay) {
        if (!overlay || !this.elements?.zoneList) return;

        const row = this.elements.zoneList.querySelector(`.zone-item[data-layer-kind="overlay"][data-layer-id="${overlay.id}"]`);
        if (!row) return;

        const toggle = row.querySelector('.overlay-tint-toggle');
        if (toggle) {
            toggle.classList.toggle('is-active', !!overlay.tintEnabled);
            toggle.title = overlay.tintEnabled ? 'Disable Tint' : 'Enable Tint';
        }

        const chip = row.querySelector('.overlay-tint-chip__swatch');
        if (chip) {
            chip.style.setProperty('--overlay-tint', overlay.tintColor || '#ffffff');
        }

        const input = row.querySelector('.overlay-tint-input');
        if (input && input.value !== (overlay.tintColor || '#ffffff')) {
            input.value = overlay.tintColor || '#ffffff';
        }

        const meta = row.querySelector('.profile-tag');
        if (meta) {
            meta.textContent = this.getOverlayMetaLabel(overlay);
        }
    }

    /**
     * Update shared layer selection highlighting.
     */
    updateZoneListSelection() {
        this.elements.zoneList.querySelectorAll('.zone-item').forEach(item => {
            const layerId = item.dataset.layerId;
            const layerKind = item.dataset.layerKind;
            const isSelected = this.isLayerSelected(layerKind, layerId);
            const isMultiSelected = layerKind === 'zone' && this.app.selectedZoneIds.includes(layerId);

            item.classList.toggle('selected', isSelected);
            item.classList.toggle('multi-selected', isMultiSelected && !isSelected);
        });
    }

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get SVG icon for visible eye
     * @returns {string} Eye icon HTML
     */
    getEyeIcon() {
        return `<i data-lucide="eye"></i>`;
    }

    /**
     * Get SVG icon for hidden eye
     * @returns {string} Eye-off icon HTML
     */
    getEyeOffIcon() {
        return `<i data-lucide="eye-off"></i>`;
    }
}

// Export for use in other modules
window.ZoneListUI = ZoneListUI;
