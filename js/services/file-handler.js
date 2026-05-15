/**
 * File Handler Module
 * Handles loading various file formats (DDS, EDDS, images)
 */
class FileHandler {
    constructor(app) {
        this.app = app;
    }

    static shouldOfferMapPersistence(file, options = {}) {
        if (!file?.name) return false;
        return options.source === 'upload' || options.source === 'conversion';
    }

    static getPersistentMapFileName(fileName, options = {}) {
        const rawName = String(fileName || 'Imported Map').split(/[\\/]/).pop() || 'Imported Map';
        const baseName = rawName.replace(/\.[^.]+$/, '') || 'Imported Map';
        const extension = options.converted
            ? 'png'
            : (rawName.match(/\.([^.]+)$/)?.[1] || 'png').toLowerCase();
        const safeBaseName = baseName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'Imported Map';
        return `${safeBaseName}.${extension}`;
    }

    static readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Could not read map file.'));
            reader.readAsDataURL(file);
        });
    }

    static isMissingIpcHandlerError(error) {
        return String(error?.message || error).includes('No handler registered');
    }

    static canUsePathImportFallback(file, options = {}) {
        return options.source === 'upload' && !options.converted && typeof file?.path === 'string' && file.path.length > 0;
    }

    static shouldLoadDroppedFileAsMap({ extension, hasMap, uploadPromptVisible } = {}) {
        const ext = String(extension || '').toLowerCase();
        return uploadPromptVisible || !hasMap || ext === 'edds' || ext === 'dds';
    }

    buildBundledAssetUrl(filename) {
        return new URL(`Maps/${encodeURIComponent(filename)}`, window.location.href).toString();
    }

    async resolveMapAssetSrc(filename, isUrl = false) {
        if (isUrl) {
            if (filename.match(/^[a-zA-Z]:\\/)) {
                return 'file:///' + filename.replace(/\\/g, '/');
            }

            return filename;
        }

        if (window.electronAPI?.getMapAssetUrl) {
            try {
                return await window.electronAPI.getMapAssetUrl(filename);
            } catch (error) {
                console.warn('[FileHandler] Falling back to bundled asset URL for map:', filename, error);
            }
        }

        return this.buildBundledAssetUrl(filename);
    }

    /**
     * Load a map file from File object
     * @param {File} file - The file to load
     */
    async loadMapFile(file) {
        const ext = file.name.toLowerCase().split('.').pop();

        try {
            if (ext === 'edds' || ext === 'dds') {
                await this.loadDDSFile(file);
            } else {
                await this.loadImageFile(file);
            }
        } catch (error) {
            console.error('Error loading map:', error);
            this.app.notificationService?.showAlert(`Error loading map file: ${error.message}`, { title: 'Load Failed', tone: 'danger' });
        }
    }

    /**
     * Load a DDS/EDDS file
     * @param {File} file - The DDS file to load
     */
    async loadDDSFile(file) {
        const ddsInfo = await Utils.parseDDSFile(file);

        // Create canvas from DDS data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = ddsInfo.width;
        tempCanvas.height = ddsInfo.height;
        const ctx = tempCanvas.getContext('2d');

        const imageData = Utils.ddsToImageData(ddsInfo);
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = tempCanvas.toDataURL('image/png');

        // Convert to image
        const img = new Image();
        img.onload = () => {
            this.app.onMapLoaded(img, file.name);
            this.persistMapAssetForFutureUse(file, dataUrl, { source: 'conversion', converted: true })
                .catch(error => this.handleMapPersistenceError(error));
        };
        img.src = dataUrl;
    }

    /**
     * Load a standard image file (PNG, JPG, SVG, etc.)
     * @param {File} file - The image file to load
     */
    async loadImageFile(file) {
        const img = await Utils.loadImage(file);
        this.app.onMapLoaded(img, file.name);
        const dataUrl = await FileHandler.readFileAsDataUrl(file);
        await this.persistMapAssetForFutureUse(file, dataUrl, { source: 'upload' })
            .catch(error => this.handleMapPersistenceError(error));
    }

    handleMapPersistenceError(error) {
        console.error('Error saving map asset:', error);
        this.app.notificationService?.showAlert?.(error.message || 'Could not save map for future use.', {
            title: 'Save Failed',
            tone: 'danger'
        });
    }

    async persistMapAssetForFutureUse(file, dataUrl, options = {}) {
        if (!FileHandler.shouldOfferMapPersistence(file, options)) return null;
        if (!dataUrl || !window.electronAPI?.saveMapAssetDataUrl) return null;

        const fileName = FileHandler.getPersistentMapFileName(file.name, options);
        const confirmed = await (this.app.notificationService?.showConfirm?.(
            `Save "${fileName}" to your map library for future use?`,
            { title: 'Save Map', confirmLabel: 'Save Map', cancelLabel: 'Not Now' }
        ) ?? Promise.resolve(window.confirm(`Save "${fileName}" to your map library for future use?`)));

        if (!confirmed) return null;

        const result = await this.saveMapAsset(file, dataUrl, fileName, options);
        if (!result?.success) {
            throw new Error(result?.error || 'Could not save map asset.');
        }

        if (this.app.mapBrowserUI?.refresh) {
            await this.app.mapBrowserUI.refresh();
        }
        this.app.notificationService?.showToast?.(`${result.friendlyName || result.fileName} saved to map library.`, 'success');
        return result;
    }

    async saveMapAsset(file, dataUrl, fileName, options = {}) {
        try {
            return await window.electronAPI.saveMapAssetDataUrl({ dataUrl, preferredName: fileName });
        } catch (error) {
            if (
                FileHandler.isMissingIpcHandlerError(error) &&
                FileHandler.canUsePathImportFallback(file, options) &&
                window.electronAPI?.importMapAsset
            ) {
                const friendlyName = fileName.replace(/\.[^.]+$/, '');
                return window.electronAPI.importMapAsset(file.path, friendlyName);
            }

            if (FileHandler.isMissingIpcHandlerError(error)) {
                throw new Error('Saving converted maps needs the desktop app to be restarted so the new save handler is registered.');
            }

            throw error;
        }
    }

    async importOverlayImage(file, placement = null) {
        if (!this.app.core?.mapImage) {
            return this.loadImageFile(file);
        }

        const ext = file.name.toLowerCase().split('.').pop();
        const svgMarkupOriginal = ext === 'svg' ? await file.text() : '';
        const image = await Utils.loadImage(file);
        const mapPoint = placement
            ? this.app.core.screenToMap(placement.x, placement.y)
            : null;
        if (this.app.historyManager) {
            this.app.historyManager.saveHistory();
        }
        const overlay = this.app.imageOverlayManager.createOverlayFromImage(
            image,
            file.name.replace(/\.[^.]+$/, ''),
            mapPoint ? { x: mapPoint.x, y: mapPoint.y } : {},
            {
                persist: true,
                sourceName: file.name,
                sourceType: ext === 'svg' ? 'svg' : 'raster',
                tintMode: ext === 'svg' ? 'vector' : 'pixel',
                svgMarkupOriginal
            }
        );

        if (overlay) {
            this.app.updateUI();
        }
    }

    /**
     * Load a local map image by filename
     * @param {string} filename - Filename or URL
     * @param {boolean} isUrl - Whether filename is a full URL
     */
    async loadLocalMapImage(filename, isUrl = false) {
        const src = await this.resolveMapAssetSrc(filename, isUrl);

        // Show loading state
        this.app.elements.uploadPrompt.style.opacity = '0.5';

        const img = new Image();
        img.onload = () => {
            this.app.elements.uploadPrompt.style.opacity = '1';
            this.app.onMapLoaded(img, filename);
        };
        img.onerror = () => {
            this.app.elements.uploadPrompt.style.opacity = '1';
            this.app.notificationService?.showAlert(`Failed to load image: ${src}`, { title: 'Load Failed', tone: 'danger' });
        };
        img.src = src;
    }

    /**
     * Handle file input change event
     * @param {Event} e - File input change event
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.loadMapFile(file);
        }
        e.target.value = '';
    }

    handleOverlayImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.importOverlayImage(file);
        }
        e.target.value = '';
    }

    /**
     * Setup drag and drop handlers
     * @param {HTMLElement} container - Drop target container
     * @param {HTMLElement} prompt - Upload prompt element
     */
    setupDragAndDrop(container, prompt) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            container.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        container.addEventListener('dragenter', () => prompt.classList.add('drag-over'));
        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                prompt.classList.remove('drag-over');
            }
        });
        container.addEventListener('drop', (e) => {
            prompt.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                const ext = file.name.toLowerCase().split('.').pop();
                const hasMap = !!this.app.core?.mapImage;
                const uploadPromptVisible = window.getComputedStyle(prompt).display !== 'none';
                const placement = { x: e.clientX, y: e.clientY };

                if (FileHandler.shouldLoadDroppedFileAsMap({ extension: ext, hasMap, uploadPromptVisible })) {
                    this.loadMapFile(file);
                } else {
                    this.importOverlayImage(file, placement);
                }
            }
        });
    }
}

// Export for use in other modules
window.FileHandler = FileHandler;
