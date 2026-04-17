/**
 * Context Menu Manager
 * Handles right-click context menus for zones and layer items
 */
class ContextMenu {
    constructor(app) {
        this.app = app;
        this.menu = null;
        this.clipboard = null; // For copy/paste

        this.init();
    }

    init() {
        // Close menu on click outside
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            // Prevent default and close existing menu if clicking elsewhere
            if (!e.target.closest('.context-menu')) {
                this.hide();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    }

    /**
     * Show context menu for a zone item in the layer list
     */
    showForZoneItem(e, zoneId) {
        e.preventDefault();
        e.stopPropagation();

        const zone = this.app.zoneManager.getZone(zoneId);
        if (!zone) return;

        // Select the zone if not already selected
        if (this.app.zoneManager.selectedZoneId !== zoneId) {
            this.app.zoneManager.selectZone(zoneId);
        }

        const items = [
            {
                icon: 'edit-3',
                label: 'Rename',
                action: () => this.renameZone(zoneId)
            },
            {
                icon: 'copy',
                label: 'Duplicate',
                shortcut: 'Ctrl+D',
                action: () => this.duplicateZone(zoneId)
            },
            { separator: true },
            {
                icon: 'clipboard-copy',
                label: 'Copy',
                shortcut: 'Ctrl+C',
                action: () => this.copyZone(zoneId)
            },
            {
                icon: 'clipboard-paste',
                label: 'Paste',
                shortcut: 'Ctrl+V',
                disabled: !this.clipboard,
                action: () => this.pasteZone()
            },
            { separator: true },
            {
                icon: zone.visible ? 'eye-off' : 'eye',
                label: zone.visible ? 'Hide' : 'Show',
                action: () => this.toggleVisibility(zoneId)
            },
            { separator: true },
            {
                icon: 'trash-2',
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                action: () => this.deleteZone(zoneId)
            }
        ];

        this.show(e.clientX, e.clientY, items);
    }

    /**
     * Show context menu for zones on canvas
     */
    showForCanvas(e, zone = null) {
        e.preventDefault();

        const items = [];

        if (zone) {
            items.push(
                {
                    icon: 'edit-3',
                    label: 'Rename',
                    action: () => this.renameZone(zone.id)
                },
                {
                    icon: 'copy',
                    label: 'Duplicate',
                    shortcut: 'Ctrl+D',
                    action: () => this.duplicateZone(zone.id)
                },
                { separator: true },
                {
                    icon: 'clipboard-copy',
                    label: 'Copy',
                    shortcut: 'Ctrl+C',
                    action: () => this.copyZone(zone.id)
                }
            );
        }

        items.push({
            icon: 'clipboard-paste',
            label: 'Paste',
            shortcut: 'Ctrl+V',
            disabled: !this.clipboard,
            action: () => this.pasteZone()
        });

        if (zone) {
            items.push(
                { separator: true },
                {
                    icon: zone.visible ? 'eye-off' : 'eye',
                    label: zone.visible ? 'Hide' : 'Show',
                    action: () => this.toggleVisibility(zone.id)
                },
                { separator: true },
                {
                    icon: 'trash-2',
                    label: 'Delete',
                    shortcut: 'Del',
                    danger: true,
                    action: () => this.deleteZone(zone.id)
                }
            );
        }

        this.show(e.clientX, e.clientY, items);
    }

    /**
     * Display the context menu at position
     */
    show(x, y, items) {
        this.hide();

        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';

        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'context-menu-separator';
                this.menu.appendChild(sep);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                if (item.danger) menuItem.classList.add('danger');
                if (item.disabled) {
                    menuItem.classList.add('disabled');
                    menuItem.style.opacity = '0.5';
                    menuItem.style.pointerEvents = 'none';
                }

                menuItem.innerHTML = `
                    <i data-lucide="${item.icon}"></i>
                    <span>${item.label}</span>
                    ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
                `;

                menuItem.addEventListener('click', () => {
                    item.action();
                    this.hide();
                });

                this.menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(this.menu);

        // Position menu (ensure it doesn't go off screen)
        const rect = this.menu.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) {
            x = window.innerWidth - rect.width - 10;
        }
        if (y + rect.height > window.innerHeight) {
            y = window.innerHeight - rect.height - 10;
        }

        this.menu.style.left = x + 'px';
        this.menu.style.top = y + 'px';

        // Initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons({ icons: this.menu.querySelectorAll('[data-lucide]') });
        }
    }

    hide() {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
    }

    // ==================== ACTIONS ====================

    renameZone(zoneId) {
        const zone = this.app.zoneManager.getZone(zoneId);
        if (!zone) return;

        const propertiesUI = this.app.zonePropertiesUI;
        if (!propertiesUI?.showNamePrompt) return;

        this.app.zoneManager.selectZone(zoneId);
        propertiesUI.showZoneProperties(zone);
        propertiesUI.showNamePrompt('Rename Zone', zone.name, (newName) => {
            this.app.historyManager.saveHistory();
            this.app.zoneManager.updateZone(zoneId, { name: newName.trim() });
            this.app.zoneListUI.updateZoneList();
        });
    }

    duplicateZone(zoneId) {
        const zone = this.app.zoneManager.getZone(zoneId);
        if (!zone) return;

        this.app.historyManager.saveHistory();

        // Deep clone and offset the zone
        const clone = Utils.deepClone(zone);
        clone.id = Utils.generateId();
        clone.name = zone.name + ' (Copy)';
        Utils.offsetZone(clone, 20);

        this.app.zoneManager.zones.push(clone);
        this.app.zoneManager.selectZone(clone.id);
        this.app.zoneManager.saveToStorage();
        this.app.zoneListUI.updateZoneList();
        this.app.core.requestRender();
    }

    copyZone(zoneId) {
        const zone = this.app.zoneManager.getZone(zoneId);
        if (!zone) return;

        this.clipboard = Utils.deepClone(zone);
    }

    pasteZone() {
        if (!this.clipboard) return;

        this.app.historyManager.saveHistory();

        // Deep clone and offset the zone
        const clone = Utils.deepClone(this.clipboard);
        clone.id = Utils.generateId();
        clone.name = this.clipboard.name + ' (Pasted)';
        Utils.offsetZone(clone, 30);

        this.app.zoneManager.zones.push(clone);
        this.app.zoneManager.selectZone(clone.id);
        this.app.zoneManager.saveToStorage();
        this.app.zoneListUI.updateZoneList();
        this.app.core.requestRender();
    }

    toggleVisibility(zoneId) {
        const zone = this.app.zoneManager.getZone(zoneId);
        if (zone) {
            this.app.zoneManager.updateZone(zoneId, { visible: !zone.visible });
            this.app.zoneListUI.updateZoneList();
        }
    }

    deleteZone(zoneId) {
        this.app.historyManager.saveHistory();
        this.app.zoneManager.deleteZone(zoneId);
        this.app.zonePropertiesUI?.hideFloatingControls();
        this.app.zoneListUI.updateZoneList();
        this.app.updateUI();
    }

    /**
     * Handle keyboard shortcuts for copy/paste/duplicate
     */
    handleKeyboard(e) {
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        if (isTyping) return false;

        if (e.ctrlKey || e.metaKey) {
            const selectedId = this.app.zoneManager.selectedZoneId;

            if (e.key === 'd' && selectedId) {
                e.preventDefault();
                this.duplicateZone(selectedId);
                return true;
            }
            if (e.key === 'c' && selectedId) {
                e.preventDefault();
                this.copyZone(selectedId);
                return true;
            }
            if (e.key === 'v' && this.clipboard) {
                e.preventDefault();
                this.pasteZone();
                return true;
            }
        }

        return false;
    }
}

// Export for use
window.ContextMenu = ContextMenu;
