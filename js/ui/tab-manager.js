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

    /**
     * Create a new tab with the given map image
     * @param {string} name - Tab name (usually filename)
     * @param {HTMLImageElement} image - The map image
     * @param {Array} zones - Optional array of zones to load
     */
    createTab(name, image, zones = []) {
        const newTab = {
            id: Date.now().toString(),
            name: name,
            image: image,
            zones: zones,
            history: [],
            historyIndex: -1,
            view: null
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
        tab.history = [...this.app.historyManager.getHistory()];
        tab.historyIndex = this.app.historyManager.getHistoryIndex();
        tab.view = {
            zoom: this.app.core.zoom,
            panX: this.app.core.panX,
            panY: this.app.core.panY
        };
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
        this.app.elements.mapInfo.textContent = `${tab.name} (${tab.image.width}×${tab.image.height})`;
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
                <i data-lucide="map" class="tab-icon"></i>
                <span class="tab-title" title="${tab.name}">${this.escapeHtml(tab.name)}</span>
                <button type="button" class="tab-close" data-close-index="${i}" title="Close Tab" aria-label="Close ${this.escapeHtml(tab.name)}">
                    <i data-lucide="x" style="width:12px; height:12px;"></i>
                </button>
            </div>
        `).join('') + `
            <button type="button" class="tab-new" id="tabNewBtn" title="New Tab" aria-label="New Tab">
                <i data-lucide="plus"></i>
            </button>
        `;

        if (window.lucide) lucide.createIcons();

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
                this.app.elements.mapInfo.textContent = `${newName} (${this.tabs[index].image.width}×${this.tabs[index].image.height})`;
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
