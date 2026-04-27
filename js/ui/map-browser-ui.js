/**
 * Map Browser / Library UI Module
 *
 * Renders the catalog of official maps. Each card shows install state:
 *   - Available: greyed, "Install (size MB)" button → triggers download
 *   - Downloading: progress bar updates live via IPC events
 *   - Installed: full thumbnail, click to load, delete via icon
 *
 * Sources of truth:
 *   - Catalog (Maps/catalog.json, served via electronAPI.getMapCatalog)
 *     defines the canonical list of official maps + their download URLs.
 *   - listMapAssets() is the merged installed-files view (user-data dir
 *     plus any legacy bundled). Determines which catalog entries are
 *     locally available, plus surfaces user-imported / extractor maps
 *     that aren't in the catalog.
 */
class MapBrowserUI {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.fallbackThumbnail = this.buildFallbackThumbnail();
        this.catalog = { maps: [] };
        this.installedFiles = new Set();
        this.activeDownloads = new Map(); // id -> { percent }
        this.cardsById = new Map();

        if (window.electronAPI?.onCatalogDownloadProgress) {
            window.electronAPI.onCatalogDownloadProgress((data) => this.handleDownloadProgress(data));
        }
    }

    async init(container) {
        this.container = container;
        await this.refresh();
    }

    async refresh() {
        try {
            const [catalog, installed] = await Promise.all([
                window.electronAPI?.getMapCatalog?.() ?? Promise.resolve({ maps: [] }),
                window.electronAPI?.listMapAssets?.() ?? Promise.resolve([])
            ]);
            this.catalog = catalog && Array.isArray(catalog.maps) ? catalog : { maps: [] };
            this.installedFiles = new Set(installed.map(item => item.file));
            this.installedAssets = installed;
            this.render();
        } catch (err) {
            console.error('[MapBrowserUI] Failed to refresh maps:', err);
            this.showError('Could not load the map library.');
        }
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.cardsById.clear();

        const catalogFiles = new Set(this.catalog.maps.map(m => m.file));

        // 1. Render catalog entries (official maps).
        for (const entry of this.catalog.maps) {
            const card = this.buildCatalogCard(entry);
            this.container.appendChild(card);
            this.cardsById.set(entry.id, card);
        }

        // 2. Render any installed files that AREN'T in the catalog
        //    (user imports / extractor outputs).
        const extras = (this.installedAssets || []).filter(item => !catalogFiles.has(item.file));
        for (const item of extras) {
            const card = this.buildExtraCard(item);
            this.container.appendChild(card);
        }

        if (!this.catalog.maps.length && !extras.length) {
            this.showError('No maps available. Connect to the internet and refresh to load the catalog.');
        }
    }

    buildCatalogCard(entry) {
        const installed = this.installedFiles.has(entry.file);
        const downloading = this.activeDownloads.has(entry.id);

        const item = document.createElement('div');
        item.className = 'map-list-item' + (installed ? '' : ' map-list-item-pending');
        item.dataset.mapId = entry.id;
        item.title = entry.name;

        const thumb = document.createElement('img');
        thumb.className = 'map-thumbnail';
        thumb.loading = 'lazy';
        thumb.alt = entry.name;

        // Three-tier thumbnail source:
        //   1. If installed, use the actual full-res file (already on disk).
        //   2. Otherwise use the small bundled JPG preview from Maps/thumbnails.
        //   3. Fall back to the SVG icon if neither is available.
        if (installed) {
            const installedAsset = this.installedAssets?.find(a => a.file === entry.file);
            thumb.src = installedAsset?.url || this.resolveBundledPath(entry.thumbnail) || this.fallbackThumbnail;
        } else if (entry.thumbnail) {
            thumb.src = this.resolveBundledPath(entry.thumbnail) || this.fallbackThumbnail;
        } else {
            thumb.src = this.fallbackThumbnail;
        }
        thumb.onerror = () => { thumb.src = this.fallbackThumbnail; };

        // Status badge (top-right corner)
        const badge = document.createElement('span');
        badge.className = 'map-status-badge';
        badge.dataset.role = 'status';
        if (downloading) {
            const pct = this.activeDownloads.get(entry.id)?.percent ?? 0;
            badge.textContent = `${pct}%`;
            badge.dataset.state = 'downloading';
        } else if (installed) {
            badge.textContent = 'Installed';
            badge.dataset.state = 'installed';
        } else {
            badge.textContent = this.formatSize(entry.sizeBytes);
            badge.dataset.state = 'available';
        }

        // Progress bar (only visible while downloading)
        const progressWrap = document.createElement('div');
        progressWrap.className = 'map-progress';
        progressWrap.dataset.role = 'progress';
        progressWrap.style.display = downloading ? 'block' : 'none';
        const progressFill = document.createElement('div');
        progressFill.className = 'map-progress-fill';
        progressFill.dataset.role = 'progress-fill';
        progressFill.style.width = `${this.activeDownloads.get(entry.id)?.percent ?? 0}%`;
        progressWrap.appendChild(progressFill);

        // Info row
        const infoRow = document.createElement('div');
        infoRow.className = 'map-info-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'map-name';
        nameSpan.textContent = entry.name;

        const actions = document.createElement('div');
        actions.className = 'map-actions';

        if (installed) {
            const btnDelete = this.makeIconButton('trash-2', 'Remove from this PC');
            btnDelete.onclick = (e) => {
                e.stopPropagation();
                this.handleDelete(entry);
            };
            actions.appendChild(btnDelete);
        } else if (!downloading) {
            const btnInstall = this.makeIconButton('download', `Install (${this.formatSize(entry.sizeBytes)})`);
            btnInstall.onclick = (e) => {
                e.stopPropagation();
                this.handleDownload(entry);
            };
            actions.appendChild(btnInstall);
        }

        infoRow.appendChild(nameSpan);
        infoRow.appendChild(actions);

        item.append(thumb, badge, progressWrap, infoRow);

        if (installed) {
            item.addEventListener('click', () => {
                if (this.app.fileHandler) this.app.fileHandler.loadLocalMapImage(entry.file);
            });
        } else if (!downloading) {
            item.addEventListener('click', () => this.handleDownload(entry));
        }

        return item;
    }

    buildExtraCard(asset) {
        const item = document.createElement('div');
        item.className = 'map-list-item';
        item.title = asset.name || asset.file;

        const thumb = document.createElement('img');
        thumb.className = 'map-thumbnail';
        thumb.loading = 'lazy';
        thumb.alt = asset.name || asset.file;
        thumb.src = asset.url || this.fallbackThumbnail;
        thumb.onerror = () => { thumb.src = this.fallbackThumbnail; };

        const infoRow = document.createElement('div');
        infoRow.className = 'map-info-row';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'map-name';
        nameSpan.textContent = asset.name || asset.file;
        infoRow.appendChild(nameSpan);

        item.append(thumb, infoRow);
        item.addEventListener('click', () => {
            if (this.app.fileHandler) this.app.fileHandler.loadLocalMapImage(asset.file);
        });
        return item;
    }

    async handleDownload(entry) {
        if (this.activeDownloads.has(entry.id) || this.installedFiles.has(entry.file)) return;
        if (!window.electronAPI?.downloadCatalogMap) {
            this.app?.notificationService?.showAlert('In-app downloads require the desktop build.', { title: 'Unavailable' });
            return;
        }

        this.activeDownloads.set(entry.id, { percent: 0 });
        this.refreshCard(entry.id);

        try {
            await window.electronAPI.downloadCatalogMap({
                id: entry.id,
                file: entry.file,
                url: entry.downloadUrl,
                sizeBytes: entry.sizeBytes
            });
            this.activeDownloads.delete(entry.id);
            this.installedFiles.add(entry.file);
            await this.refresh();
            this.app?.notificationService?.showToast(`${entry.name} installed.`, 'success');
        } catch (err) {
            this.activeDownloads.delete(entry.id);
            this.refreshCard(entry.id);
            this.app?.notificationService?.showAlert(err?.message || 'Download failed.', { title: 'Install Failed', tone: 'danger' });
        }
    }

    async handleDelete(entry) {
        const confirmed = await (this.app?.notificationService?.showConfirm?.(
            `Remove ${entry.name} from this PC? You can re-install it any time from the catalog.`,
            { title: 'Remove map', confirmLabel: 'Remove', tone: 'danger' }
        ) ?? Promise.resolve(window.confirm(`Remove ${entry.name}?`)));

        if (!confirmed) return;

        try {
            await window.electronAPI?.deleteCatalogMap?.(entry.file);
            this.installedFiles.delete(entry.file);
            await this.refresh();
            this.app?.notificationService?.showToast(`${entry.name} removed.`, 'success');
        } catch (err) {
            this.app?.notificationService?.showAlert(err?.message || 'Delete failed.', { title: 'Delete Failed', tone: 'danger' });
        }
    }

    handleDownloadProgress(data) {
        if (!data?.id) return;
        const state = this.activeDownloads.get(data.id) || {};
        state.percent = data.percent ?? state.percent ?? 0;
        this.activeDownloads.set(data.id, state);

        const card = this.cardsById.get(data.id);
        if (!card) return;
        const badge = card.querySelector('[data-role="status"]');
        const fill = card.querySelector('[data-role="progress-fill"]');
        const wrap = card.querySelector('[data-role="progress"]');
        if (wrap) wrap.style.display = 'block';
        if (badge) {
            badge.textContent = `${state.percent}%`;
            badge.dataset.state = 'downloading';
        }
        if (fill) fill.style.width = `${state.percent}%`;
    }

    refreshCard(id) {
        const entry = this.catalog.maps.find(m => m.id === id);
        if (!entry || !this.container) return;
        const old = this.cardsById.get(id);
        const replacement = this.buildCatalogCard(entry);
        if (old && old.parentNode) {
            old.parentNode.replaceChild(replacement, old);
        }
        this.cardsById.set(id, replacement);
    }

    formatSize(bytes) {
        if (!bytes) return '?';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    }

    makeIconButton(iconName, title) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-icon';
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        // Lucide hydrates icons on next tick; safe even if global is missing
        setTimeout(() => { try { window.lucide?.createIcons?.(); } catch {} }, 0);
        return btn;
    }

    /**
     * Resolve a path relative to the app's HTML root (e.g. "Maps/thumbnails/X.jpg").
     * Returns a URL the <img> tag can load directly.
     */
    resolveBundledPath(relativePath) {
        if (!relativePath || typeof relativePath !== 'string') return null;
        try {
            return new URL(relativePath, window.location.href).toString();
        } catch {
            return null;
        }
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

    /**
     * Backwards-compat shim — older code (map-extractor-ui) calls this
     * after a successful extraction. The new architecture refreshes
     * everything on its own scan.
     */
    renderLocalMapList() {
        return this.refresh();
    }
}

window.MapBrowserUI = MapBrowserUI;
