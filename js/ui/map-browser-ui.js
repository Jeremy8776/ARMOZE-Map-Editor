/**
 * Map Browser UI Module
 * Handles the display and interaction with the local maps gallery.
 */
class MapBrowserUI {
    constructor(app) {
        this.app = app;
        this.container = null;
    }

    async init(container) {
        this.container = container;
        const manifestMaps = Array.isArray(window.LOCAL_MAPS) ? window.LOCAL_MAPS : [];
        if (manifestMaps.length > 0) {
            this.renderLocalMapList(manifestMaps);
        }
        await this.refresh();
    }

    async refresh() {
        try {
            const maps = await this.loadMaps();
            if (maps.length > 0) {
                window.LOCAL_MAPS = maps;
                this.renderLocalMapList(maps);
            } else if (!this.container?.children?.length) {
                this.showError('No local maps were found in your Maps folder.');
            }
        } catch (err) {
            console.error('[MapBrowserUI] Failed to refresh maps:', err);
            const manifestMaps = Array.isArray(window.LOCAL_MAPS) ? window.LOCAL_MAPS : [];
            if (manifestMaps.length > 0) {
                this.renderLocalMapList(manifestMaps);
            } else {
                this.showError('Could not load local maps.');
            }
        }
    }

    async loadMaps() {
        const manifestMaps = Array.isArray(window.LOCAL_MAPS) ? window.LOCAL_MAPS : [];
        let desktopMaps = [];

        if (window.electronAPI?.listMapAssets) {
            try {
                desktopMaps = await window.electronAPI.listMapAssets();
            } catch (err) {
                console.warn('[MapBrowserUI] Desktop map scan failed, using manifest fallback.', err);
            }
        }

        if (!desktopMaps.length) {
            return manifestMaps;
        }

        const manifestNamesByFile = new Map(
            manifestMaps.map(item => {
                if (typeof item === 'string') {
                    return [item, item];
                }
                return [item.file, item.name || item.file];
            })
        );

        return desktopMaps.map(item => ({
            file: item.file,
            name: manifestNamesByFile.get(item.file) || item.name
        }));
    }

    showError(msg) {
        if (!this.container) return;
        this.container.innerHTML = `<div style="grid-column: span 3; color: var(--color-text-muted); font-size: 13px; text-align: center; padding: 24px;">${msg}</div>`;
    }

    /**
     * Render the map gallery list
     */
    renderLocalMapList(maps) {
        if (!this.container) return;
        this.container.innerHTML = '';

        maps.forEach(mapData => {
            const fileName = typeof mapData === 'string' ? mapData : mapData.file;
            const displayName = typeof mapData === 'string' ? mapData : mapData.name;
            const fileUrl = fileName.startsWith('http') ? fileName : `Maps/${fileName}`;

            const item = document.createElement('div');
            item.className = 'map-list-item';
            item.title = displayName;

            const thumb = document.createElement('img');
            thumb.className = 'map-thumbnail';
            thumb.src = fileUrl;
            thumb.loading = 'lazy';
            thumb.alt = displayName;
            thumb.onerror = () => { thumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImdyYXkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIi8+PHBhdGggZD0ibTIxIDE1LTNlMy0zLTMtM3YxMmgyIi8+PC9zdmc+'; };

            const infoRow = document.createElement('div');
            infoRow.className = 'map-info-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'map-name';
            nameSpan.textContent = displayName;

            const actions = document.createElement('div');
            actions.className = 'map-actions';

            const btnNewTab = document.createElement('div');
            btnNewTab.className = 'action-icon';
            btnNewTab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
            btnNewTab.onclick = (e) => {
                e.stopPropagation();
                const url = new URL(window.location.href);
                url.searchParams.set('map', fileName);
                window.open(url.toString(), '_blank');
            };

            actions.appendChild(btnNewTab);
            infoRow.appendChild(nameSpan);
            infoRow.appendChild(actions);
            item.appendChild(thumb);
            item.appendChild(infoRow);

            item.addEventListener('click', () => {
                if (this.app.fileHandler) this.app.fileHandler.loadLocalMapImage(fileName);
            });
            
            this.container.appendChild(item);
        });

        if (window.lucide) lucide.createIcons();
    }
}

window.MapBrowserUI = MapBrowserUI;
