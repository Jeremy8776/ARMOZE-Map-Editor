/**
 * Zone List UI Module
 * Handles the zone list panel rendering and interactions
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

    /**
     * Update the zone list display
     */
    updateZoneList() {
        const zones = this.app.zoneManager.getZones();
        this.elements.zoneCount.textContent = zones.length;

        if (zones.length === 0) {
            this.elements.zoneList.innerHTML = `
                <div class="empty-state">
                    <p>No zones created yet</p>
                    <p class="hint">Use the drawing tools to create zones</p>
                </div>
            `;
            if (this.elements.zoneCoords) {
                this.elements.zoneCoords.innerHTML = 'Select a layer to view its data.';
            }
            return;
        }

        this.elements.zoneList.innerHTML = zones.map(zone => {
            const isSelected = zone.id === this.app.zoneManager.selectedZoneId;
            let shapeIcon = 'shapes';
            if (zone.shape === 'circle') shapeIcon = 'circle';
            else if (zone.shape === 'rectangle') shapeIcon = 'square';
            else if (zone.shape === 'line') shapeIcon = 'type';
            else if (zone.points) shapeIcon = 'triangle';

            return `
                <div class="zone-item ${isSelected ? 'selected' : ''}" data-zone-id="${zone.id}">
                    <div class="zone-shape-icon" style="color: ${zone.color}">
                        <i data-lucide="${shapeIcon}" style="width:16px; height:16px;"></i>
                    </div>
                    <div class="zone-item-info">
                        <div class="zone-item-name">${this.escapeHtml(zone.name)}</div>
                        <div class="zone-item-meta">
                            <span class="profile-tag">${
                                this.app.zonePropertiesUI && this.app.zonePropertiesUI.profiles && this.app.zonePropertiesUI.profiles[zone.profileId]
                                    ? this.escapeHtml(this.app.zonePropertiesUI.profiles[zone.profileId].name)
                                    : (zone.profileId === 'custom' ? 'Custom' : 'Direct')
                            }</span>
                        </div>
                    </div>
                    <div class="zone-item-actions">
                        <button class="zone-action-btn zone-action-expand" data-zone-id="${zone.id}" title="Show Properties">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                        <button class="zone-action-btn zone-action-delete" data-zone-id="${zone.id}" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                        <button class="zone-visibility" data-zone-id="${zone.id}" title="${zone.visible ? 'Hide' : 'Show'}">
                            ${zone.visible ? this.getEyeIcon() : this.getEyeOffIcon()}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.attachEventListeners();

        // Initialize new icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    /**
     * Attach event listeners to zone list items
     */
    attachEventListeners() {
        // Click handlers for zone items
        this.elements.zoneList.querySelectorAll('.zone-item').forEach(item => {
            // Left click - select
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.zone-visibility') && !e.target.closest('.zone-action-btn')) {
                    if (e.shiftKey && this.app.zoneManager.selectedZoneId) {
                        // Shift+click: toggle multi-select
                        const zoneId = item.dataset.zoneId;
                        const index = this.app.selectedZoneIds.indexOf(zoneId);
                        if (index === -1) {
                            this.app.selectedZoneIds.push(zoneId);
                        } else {
                            this.app.selectedZoneIds.splice(index, 1);
                        }
                        this.updateZoneListSelection();
                    } else {
                        // Normal click: single select — also re-shows properties if panel was minimised
                        this.app.selectedZoneIds = [];
                        this.app.zoneManager.selectZone(item.dataset.zoneId);
                        const zone = this.app.zoneManager.getZone(item.dataset.zoneId);
                        if (zone && this.app.zonePropertiesUI) {
                            this.app.zonePropertiesUI.showZoneProperties(zone);
                        }
                    }
                }
            });

            // Right click - context menu
            item.addEventListener('contextmenu', (e) => {
                this.app.contextMenu.showForZoneItem(e, item.dataset.zoneId);
            });
        });

        // Expand (show properties) buttons
        this.elements.zoneList.querySelectorAll('.zone-action-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const zone = this.app.zoneManager.getZone(btn.dataset.zoneId);
                if (zone) {
                    this.app.zoneManager.selectZone(btn.dataset.zoneId);
                    if (this.app.zonePropertiesUI) this.app.zonePropertiesUI.showZoneProperties(zone);
                }
            });
        });

        // Delete buttons
        this.elements.zoneList.querySelectorAll('.zone-action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const zoneId = btn.dataset.zoneId;
                if (this.app.historyManager) this.app.historyManager.saveHistory();
                this.app.zoneManager.deleteZone(zoneId);
                if (this.app.zonePropertiesUI) this.app.zonePropertiesUI.hideFloatingControls();
                this.updateZoneList();
                if (this.app.updateUI) this.app.updateUI();
            });
        });

        // Visibility toggle buttons
        this.elements.zoneList.querySelectorAll('.zone-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const zone = this.app.zoneManager.getZone(btn.dataset.zoneId);
                if (zone) {
                    this.app.zoneManager.updateZone(zone.id, { visible: !zone.visible });
                    this.updateZoneList();
                }
            });
        });
    }

    /**
     * Update zone list selection highlighting
     */
    updateZoneListSelection() {
        this.elements.zoneList.querySelectorAll('.zone-item').forEach(item => {
            const zoneId = item.dataset.zoneId;
            const isSelected = zoneId === this.app.zoneManager.selectedZoneId;
            const isMultiSelected = this.app.selectedZoneIds.includes(zoneId);

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
