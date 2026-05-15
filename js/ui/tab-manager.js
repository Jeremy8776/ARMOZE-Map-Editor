/**
 * Tab Manager Module
 * Handles tab creation, switching, closing, and state management
 */
class TabManager {
    constructor(app) {
        this.app = app;
        this.tabs = [];
        this.activeTabIndex = -1;
        this.tabBarElement = null;
    }

    /**
     * Initialize the tab manager
     * @param {HTMLElement} tabBarElement - The tab bar container element
     */
    init(tabBarElement) {
        this.tabBarElement = tabBarElement;
    }

    /**
     * Get all tabs
     * @returns {Array} Array of tab objects
     */
    getTabs() {
        return this.tabs;
    }

    /**
     * Get the active tab index
     * @returns {number} Active tab index (-1 if no tabs)
     */
    getActiveTabIndex() {
        return this.activeTabIndex;
    }

    /**
     * Get the active tab
     * @returns {Object|null} Active tab object or null
     */
    getActiveTab() {
        if (this.activeTabIndex === -1 || this.activeTabIndex >= this.tabs.length) {
            return null;
        }
        return this.tabs[this.activeTabIndex];
    }

    static getTabTitleText(tab) {
        const name = tab?.name || 'Untitled';
        return tab?.dirty ? `${name} *` : name;
    }

    static getTabIconSvg(icon) {
        const paths = {
            map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
            close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
            plus: '<path d="M5 12h14"/><path d="M12 5v14"/>'
        };
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon] || ''}</svg>`;
    }

    static getTabControlIconMarkup(icon) {
        const safeIcon = icon === 'plus' ? 'plus' : 'close';
        return `<span class="tab-control-icon tab-control-icon-${safeIcon}" aria-hidden="true"></span>`;
    }

    /**
     * Create a new tab with the given map image
     * @param {string} name - Tab name (usually filename)
     * @param {HTMLImageElement} image - The map image
     * @param {Array} zones - Optional array of zones to load
     */
    createTab(name, image, zones = [], overlays = []) {
        const newTab = {
            id: Date.now().toString(),
            name: name,
            image: image,
            zones: zones,
            overlays: overlays,
            history: [],
            historyIndex: -1,
            view: null,
            dirty: false
        };

        this.tabs.push(newTab);
        this.switchToTab(this.tabs.length - 1);
    }

    /**
     * Close a tab at the given index
     * @param {number} index - Tab index to close
     * @param {Event} e - Optional event object
     */
    closeTab(index, e) {
        if (e) e.stopPropagation();

        if (index === this.activeTabIndex) {
            // If closing active tab, try to switch to previous or next
            let newIndex = index - 1;
            if (newIndex < 0 && this.tabs.length > 1) {
                newIndex = index + 1;
            }

            this.tabs.splice(index, 1);

            if (this.tabs.length === 0) {
                this.activeTabIndex = -1;
                if (this.tabBarElement) this.tabBarElement.innerHTML = '';
                this.app.showUploadScreen();
            } else {
                this.switchToTab(Math.max(0, Math.min(this.tabs.length - 1, index - 1)));
            }
        } else {
            this.tabs.splice(index, 1);
            if (index < this.activeTabIndex) {
                this.activeTabIndex--;
            }
            this.renderTabs();
        }
    }

    /**
     * Save the current tab's state before switching
     */
    saveCurrentTabState() {
        if (this.activeTabIndex === -1) return;
        const tab = this.tabs[this.activeTabIndex];

        tab.zones = this.app.zoneManager.getZones();
        tab.overlays = this.app.imageOverlayManager.serializeOverlays();
        tab.history = [...this.app.historyManager.getHistory()];
        tab.historyIndex = this.app.historyManager.getHistoryIndex();
        tab.view = {
            zoom: this.app.core.zoom,
            panX: this.app.core.panX,
            panY: this.app.core.panY
        };
    }

    markActiveTabDirty(dirty = true) {
        const tab = this.getActiveTab();
        if (!tab || tab.dirty === dirty) return;
        tab.dirty = dirty;
        this.renderTabs();
    }

    markActiveTabClean() {
        this.markActiveTabDirty(false);
    }

    /**
     * Switch to a tab at the given index
     * @param {number} index - Tab index to switch to
     */
    switchToTab(index) {
        if (index < 0 || index >= this.tabs.length) return;

        // Save current tab state if switching from another tab
        if (this.activeTabIndex !== -1 && this.activeTabIndex !== index) {
            this.saveCurrentTabState();
        }

        this.activeTabIndex = index;
        const tab = this.tabs[index];

        // 1. Load Map Image
        this.app.core.loadMap(tab.image);
        this.app.elements.uploadPrompt.style.display = 'none';
        this.app.elements.canvas.classList.add('visible');

        // 2. Restore Zones
        this.app.zoneManager.zones = Utils.deepClone(tab.zones);
        this.app.zoneManager.selectedZoneId = null;
        this.app.imageOverlayManager.setOverlays(Utils.deepClone(tab.overlays || []), { persist: true, keepSelection: false });
        this.app.layerOrderService?.ensureLayerOrders({ persist: true });
        this.app.imageOverlayManager.selectOverlay(null, { render: false });

        // 3. Restore History
        this.app.historyManager.setHistory(tab.history, tab.historyIndex);

        // 4. Restore View
        if (tab.view) {
            this.app.core.zoom = tab.view.zoom;
            this.app.core.panX = tab.view.panX;
            this.app.core.panY = tab.view.panY;
            this.app.core.updateTransform && this.app.core.updateTransform();
        }

        // 5. Update UI
        this.app.elements.mapInfo.textContent = `${tab.name} (${tab.image.width} x ${tab.image.height})`;
        this.app.zoneListUI.updateZoneList();
        this.renderTabs();
        this.app.core.requestRender();
        this.app.updateUI();
    }

    /**
     * Render the tab bar
     */
    renderTabs() {
        if (!this.tabBarElement) return;

        this.tabBarElement.innerHTML = this.tabs.map((tab, i) => `
            <div class="tab ${i === this.activeTabIndex ? 'active' : ''}"
                 data-tab-index="${i}"
                 draggable="true">
                <span class="tab-icon">${TabManager.getTabIconSvg('map')}</span>
                <span class="tab-title" title="${this.escapeHtml(TabManager.getTabTitleText(tab))}">${this.escapeHtml(TabManager.getTabTitleText(tab))}</span>
                <button type="button" class="tab-close" data-close-index="${i}" title="Close Tab" aria-label="Close ${this.escapeHtml(tab.name)}">
                    ${TabManager.getTabControlIconMarkup('close')}
                </button>
            </div>
        `).join('') + `
            <button type="button" class="tab-new" id="tabNewBtn" title="New Tab" aria-label="New Tab">
                ${TabManager.getTabControlIconMarkup('plus')}
            </button>
        `;

        // Attach event listeners
        this.tabBarElement.querySelectorAll('.tab').forEach((tabEl, i) => {
            tabEl.addEventListener('click', (e) => {
                if (!e.target.closest('.tab-close')) this.switchToTab(i);
            });
            tabEl.addEventListener('auxclick', (e) => {
                if (e.button === 1) {
                    e.preventDefault();
                    this.closeTab(i, e);
                }
            });
            tabEl.addEventListener('dblclick', (e) => {
                if (!e.target.closest('.tab-close')) this.startInlineRename(i, tabEl);
            });
        });

        this.tabBarElement.querySelectorAll('.tab-close').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(parseInt(btn.dataset.closeIndex), e);
            });
        });

        const newBtn = this.tabBarElement.querySelector('#tabNewBtn');
        if (newBtn) newBtn.addEventListener('click', () => this.startNewTab());

        this.setupTabDragAndDrop();
    }

    /**
     * Setup drag-and-drop tab reordering
     */
    setupTabDragAndDrop() {
        const tabEls = Array.from(this.tabBarElement.querySelectorAll('.tab[draggable]'));
        let dragSrcIndex = -1;

        tabEls.forEach((tabEl) => {
            tabEl.addEventListener('dragstart', (e) => {
                dragSrcIndex = parseInt(tabEl.dataset.tabIndex);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragSrcIndex));
                tabEl.classList.add('tab-dragging');
            });
            tabEl.addEventListener('dragend', () => {
                tabEl.classList.remove('tab-dragging');
                tabEls.forEach(t => t.classList.remove('tab-drag-over'));
            });
            tabEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tabEls.forEach(t => t.classList.remove('tab-drag-over'));
                tabEl.classList.add('tab-drag-over');
            });
            tabEl.addEventListener('dragenter', (e) => {
                e.preventDefault();
                tabEls.forEach(t => t.classList.remove('tab-drag-over'));
                tabEl.classList.add('tab-drag-over');
            });
            tabEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIndex = parseInt(tabEl.dataset.tabIndex);
                if (dragSrcIndex !== -1 && dragSrcIndex !== targetIndex) {
                    const activeId = this.tabs[this.activeTabIndex]?.id;
                    const moved = this.tabs.splice(dragSrcIndex, 1)[0];
                    this.tabs.splice(targetIndex, 0, moved);
                    this.activeTabIndex = this.tabs.findIndex(t => t.id === activeId);
                    this.renderTabs();
                }
                dragSrcIndex = -1;
            });
        });
    }

    /**
     * Start inline rename of a tab
     */
    startInlineRename(index, tabEl) {
        const titleSpan = tabEl.querySelector('.tab-title');
        if (!titleSpan) return;
        const original = this.tabs[index].name;
        titleSpan.contentEditable = 'true';
        titleSpan.focus();
        const range = document.createRange();
        range.selectNodeContents(titleSpan);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        const finish = () => {
            titleSpan.contentEditable = 'false';
            const newName = titleSpan.textContent.trim() || original;
            this.tabs[index].name = newName;
            titleSpan.textContent = newName;
            if (index === this.activeTabIndex) {
                this.app.elements.mapInfo.textContent = `${newName} (${this.tabs[index].image.width} x ${this.tabs[index].image.height})`;
            }
        };

        titleSpan.addEventListener('blur', finish, { once: true });
        titleSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); titleSpan.blur(); }
            if (e.key === 'Escape') { titleSpan.textContent = original; titleSpan.blur(); }
        });
    }

    /**
     * Start a new tab (show upload screen)
     */
    startNewTab() {
        this.app.showUploadScreen(true);
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
}

// Export for use in other modules
window.TabManager = TabManager;
