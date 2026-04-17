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
     * Load a standard image file (PNG, JPG, etc.)
     * @param {File} file - The image file to load
     */
    async loadImageFile(file) {
        const img = await Utils.loadImage(file);
        this.app.onMapLoaded(img, file.name);
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
                this.loadMapFile(files[0]);
            }
        });
    }
}

// Export for use in other modules
window.FileHandler = FileHandler;
