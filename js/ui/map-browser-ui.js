/**
 * Map Browser UI Module
 * Handles the display and interaction with the local maps gallery.
 */
class MapBrowserUI {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.fallbackThumbnail = this.buildFallbackThumbnail();
    }

    async init(container) {
        this.container = container;
        const manifestMaps = this.getManifestMaps();
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
            } else {
                this.showError('No local maps were found in your Maps folder.');
            }
        } catch (err) {
            console.error('[MapBrowserUI] Failed to refresh maps:', err);
            const manifestMaps = this.getManifestMaps();
            if (manifestMaps.length > 0) {
                this.renderLocalMapList(manifestMaps);
            } else {
                this.showError('Could not load local maps.');
            }
        }
    }

    async loadMaps() {
        const manifestMaps = this.getManifestMaps();
        let desktopMaps = [];

        if (window.electronAPI?.listMapAssets) {
            try {
                desktopMaps = (await window.electronAPI.listMapAssets())
                    .map(item => this.normalizeMapEntry(item))
                    .filter(Boolean);
            } catch (err) {
                console.warn('[MapBrowserUI] Desktop map scan failed, using manifest fallback.', err);
            }
        }

        if (desktopMaps.length) {
            const manifestNamesByFile = new Map(
                manifestMaps.map(item => [item.file, item.name || item.file])
            );

            return desktopMaps.map(item => ({
                file: item.file,
                name: manifestNamesByFile.get(item.file) || item.name,
                url: item.url || this.buildBundledAssetUrl(item.file)
            }));
        }

        if (!manifestMaps.length) {
            return [];
        }

        return Promise.all(manifestMaps.map(async item => {
            if (item.url) {
                return item;
            }

            if (window.electronAPI?.getMapAssetUrl) {
                try {
                    return {
                        ...item,
                        url: await window.electronAPI.getMapAssetUrl(item.file)
                    };
                } catch (err) {
                    console.warn('[MapBrowserUI] Failed to resolve map asset URL, using bundled path.', item.file, err);
                }
            }

            return {
                ...item,
                url: this.buildBundledAssetUrl(item.file)
            };
        }));
    }

    showError(msg) {
        if (!this.container) return;
        this.container.innerHTML = `<div style="grid-column: span 3; color: var(--color-text-muted); font-size: 13px; text-align: center; padding: 24px;">${msg}</div>`;
    }

    buildFallbackThumbnail() {
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.5-3.5-3 3L8 8l-5 5"/>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    getManifestMaps() {
        const manifestMaps = Array.isArray(window.LOCAL_MAPS) ? window.LOCAL_MAPS : [];
        return manifestMaps
            .map(item => this.normalizeMapEntry(item))
            .filter(Boolean);
    }

    normalizeMapEntry(mapData) {
        if (typeof mapData === 'string') {
            return {
                file: mapData,
                name: mapData
            };
        }

        if (!mapData || typeof mapData !== 'object' || typeof mapData.file !== 'string' || !mapData.file.trim()) {
            return null;
        }

        return {
            file: mapData.file.trim(),
            name: typeof mapData.name === 'string' && mapData.name.trim()
                ? mapData.name.trim()
                : mapData.file.trim(),
            url: typeof mapData.url === 'string' && mapData.url.trim()
                ? mapData.url.trim()
                : ''
        };
    }

    buildBundledAssetUrl(fileName) {
        return new URL(`Maps/${encodeURIComponent(fileName)}`, window.location.href).toString();
    }

    getMapThumbnailUrl(fileName, mapData) {
        if (typeof mapData === 'object' && typeof mapData.url === 'string' && mapData.url.trim()) {
            return mapData.url;
        }

        if (typeof fileName === 'string' && /^https?:/i.test(fileName)) {
            return fileName;
        }

        return this.buildBundledAssetUrl(fileName);
    }

    /**
     * Render the map gallery list
     */
    renderLocalMapList(maps) {
        if (!this.container) return;
        this.container.innerHTML = '';
        const normalizedMaps = maps
            .map(item => this.normalizeMapEntry(item))
            .filter(Boolean);

        if (!normalizedMaps.length) {
            this.showError('No local maps were found in your Maps folder.');
            return;
        }

        normalizedMaps.forEach(mapData => {
            const fileName = typeof mapData === 'string' ? mapData : mapData.file;
            const displayName = typeof mapData === 'string' ? mapData : mapData.name;
            const fileUrl = this.getMapThumbnailUrl(fileName, mapData);

            const item = document.createElement('div');
            item.className = 'map-list-item';
            item.title = displayName;

            const thumb = document.createElement('img');
            thumb.className = 'map-thumbnail';
            thumb.src = fileUrl;
            thumb.loading = 'lazy';
            thumb.alt = displayName;
            thumb.onerror = () => { thumb.src = this.fallbackThumbnail; };

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
    }
}

window.MapBrowserUI = MapBrowserUI;
