/**
 * File Handler Module
 * Handles loading various file formats (DDS, EDDS, images)
 */
class FileHandler {
    constructor(app) {
        this.app = app;
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
            alert('Error loading map file: ' + error.message);
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

        // Convert to image
        const img = new Image();
        img.onload = () => {
            this.app.onMapLoaded(img, file.name);
        };
        img.src = tempCanvas.toDataURL();
    }

    /**
     * Load a standard image file (PNG, JPG, SVG, etc.)
     * @param {File} file - The image file to load
     */
    async loadImageFile(file) {
        const img = await Utils.loadImage(file);
        this.app.onMapLoaded(img, file.name);
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
        let src = filename;
        if (isUrl) {
            // Ensure absolute local filesystem paths are formatted correctly for the browser engine
            if (filename.match(/^[a-zA-Z]:\\/)) {
                src = 'file:///' + filename.replace(/\\/g, '/');
            }
        } else {
            src = `Maps/${filename}`;
        }

        // Show loading state
        this.app.elements.uploadPrompt.style.opacity = '0.5';

        const img = new Image();
        img.onload = () => {
            this.app.elements.uploadPrompt.style.opacity = '1';
            this.app.onMapLoaded(img, filename);
        };
        img.onerror = () => {
            this.app.elements.uploadPrompt.style.opacity = '1';
            alert(`Failed to load image: ${src}`);
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
                const isMapTexture = ext === 'edds' || ext === 'dds';
                const hasMap = !!this.app.core?.mapImage;
                const placement = { x: e.clientX, y: e.clientY };

                if (hasMap && !isMapTexture) {
                    this.importOverlayImage(file, placement);
                } else {
                    this.loadMapFile(file);
                }
            }
        });
    }
}

// Export for use in other modules
window.FileHandler = FileHandler;
