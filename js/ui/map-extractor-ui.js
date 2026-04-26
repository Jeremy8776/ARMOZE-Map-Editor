/**
 * Map Extractor UI Component
 * Premium modal interface for PAK texture extraction.
 * Manages state transitions between search, progress, and result views.
 */
class MapExtractorUI {
    constructor(app) {
        this.app = app;
        this.service = app.extractorService;
        this.modal = null;
        this.pendingSelections = [];
        this.lastExtractedFile = null;
        this.selectedFormat = 'png';
        this.mode = 'search'; // 'search' = automated one-shot, 'interactive' = full PS1 menu
    }

    refreshIcons(scope = this.modal || document) {
        if (!window.lucide || !scope) return;
        lucide.createIcons({ icons: scope.querySelectorAll('[data-lucide]') });
    }

    async init() {
        this.createModal();
        this.setupEventListeners();
        await this.setDefaultOutputDir();
    }

    /**
     * Pre-fill output directory with Downloads/MapSave_Exports
     */
    async setDefaultOutputDir() {
        if (this.service.config.outputDir) return;
        if (!window.electronAPI?.getDownloadsPath) return;

        try {
            const downloads = await window.electronAPI.getDownloadsPath();
            if (!downloads) return;

            const sep = downloads.endsWith('\\') ? '' : '\\';
            const finalPath = downloads + sep + 'MapSave_Exports';
            const outField = document.getElementById('extractorOutputDir');

            if (outField) {
                outField.value = finalPath;
                this.service.config.outputDir = finalPath;
            }
        } catch (err) {
            console.warn('Could not set default downloads path', err);
        }
    }

    // =============================================
    // Modal Creation
    // =============================================

    createModal() {
        document.body.insertAdjacentHTML('beforeend', MapExtractorView.buildModalMarkup());
        this.modal = document.getElementById('extractorModal');

        // Populate saved config values
        this.populateConfigFields();

        this.refreshIcons(this.modal);
    }

    populateConfigFields() {
        const scanEl = document.getElementById('extractorScanDir');
        const outEl = document.getElementById('extractorOutputDir');
        const toolsEl = document.getElementById('extractorToolsDir');

        if (scanEl) scanEl.value = this.service.config.scanDir;
        if (outEl) outEl.value = this.service.config.outputDir;
        if (toolsEl) toolsEl.value = this.service.config.toolsDir;
    }

    // =============================================
    // Event Listeners
    // =============================================

    setupEventListeners() {
        // Mode toggle via select
        const actionSelect = document.getElementById('extractorAction');
        if (actionSelect) {
            actionSelect.addEventListener('change', (e) => this.switchMode(e.target.value));
        }

        // Format select
        const formatSelect = document.getElementById('extractorFormat');
        if (formatSelect) {
            formatSelect.addEventListener('change', (e) => {
                this.selectedFormat = e.target.value;
            });
        }

        // Core actions
        document.getElementById('btnRunExtractor')?.addEventListener('click', () => this.handleRun());
        document.getElementById('btnCancelExtractor')?.addEventListener('click', () => this.hide());
        document.getElementById('btnResetExtractor')?.addEventListener('click', () => this.resetUI());
        document.getElementById('btnBackFromProgress')?.addEventListener('click', () => this.resetUI());
        document.getElementById('btnCloseExtractor')?.addEventListener('click', () => this.hide());
        document.getElementById('btnImportMap')?.addEventListener('click', () => this.handleImport());

        // Enter key on search input triggers extraction
        document.getElementById('extractorSearchTerm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleRun();
        });

        // Browse buttons
        document.querySelectorAll('[data-browse]').forEach(btn => {
            btn.addEventListener('click', () => this.handleBrowse(btn.dataset.browse));
        });

        // Backdrop click to close
        let isBackdropClick = false;
        this.modal.addEventListener('mousedown', (e) => {
            isBackdropClick = (e.target === this.modal);
        });
        this.modal.addEventListener('click', (e) => {
            if (isBackdropClick && e.target === this.modal) this.hide();
        });

        // Sidebar button
        const btnOpen = document.getElementById('btnOpenExtractor');
        if (btnOpen) btnOpen.addEventListener('click', () => this.show());

        // Real-time command output from Electron
        if (window.electronAPI?.onCommandOutput) {
            window.electronAPI.onCommandOutput((output) => this.handleCommandOutput(output));
        }
    }

    /**
     * Switch shown fields based on selected action
     */
    switchMode(mode) {
        this.mode = mode; // "Search", "BulkAll", "BulkTextures", "BulkExtension"

        const searchFields = document.getElementById('searchTermGroup');
        const extensionFields = document.getElementById('filterExtensionGroup');
        const formatRow = document.getElementById('extractorFormat')?.closest('.property-group');

        if (!searchFields || !extensionFields || !formatRow) return;

        // Reset
        searchFields.style.display = 'none';
        extensionFields.style.display = 'none';
        formatRow.style.display = 'flex';

        if (mode === 'Search') {
            searchFields.style.display = 'block';
        } else if (mode === 'BulkExtension') {
            extensionFields.style.display = 'block';
        } else if (mode === 'BulkAll') {
            // No extra fields needed, just format
        } else if (mode === 'BulkTextures') {
            // No extra fields needed, just format
        }
    }

    // =============================================
    // State Management
    // =============================================

    show() {
        this.resetUI();
        this.modal.classList.add('visible');
        // Slight delay for entrance animation to complete before focusing
        setTimeout(() => document.getElementById('extractorSearchTerm')?.focus(), 150);
    }

    hide() {
        this.modal.classList.remove('visible');
    }

    resetUI() {
        const search = document.getElementById('extractorSearchSection');
        const progress = document.getElementById('extractorProgress');
        const result = document.getElementById('extractorResult');

        if (search) search.style.display = 'flex';
        if (progress) progress.style.display = 'none';
        if (result) result.style.display = 'none';

        const searchInput = document.getElementById('extractorSearchTerm');
        if (searchInput) searchInput.value = '';

        const extInput = document.getElementById('extractorFilterExtension');
        if (extInput) extInput.value = '';

        const actionSelect = document.getElementById('extractorAction');
        if (actionSelect) {
            actionSelect.value = 'Search';
            this.switchMode('Search');
        }

        // Restore mode-appropriate button text
        const runBtn = document.getElementById('btnRunExtractor');
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i data-lucide="zap"></i> Extract';
        }

        this.lastExtractedFile = null;

        this.refreshIcons(this.modal);
    }

    /**
     * Transition from search view to progress view
     */
    showProgressState() {
        document.getElementById('extractorSearchSection').style.display = 'none';

        const progress = document.getElementById('extractorProgress');
        const log = document.getElementById('extractorLog');
        const bar = document.getElementById('extractorProgressBar');
        const percent = document.getElementById('progressPercent');

        progress.style.display = 'block';
        log.innerHTML = '';
        bar.style.width = '0%';
        percent.textContent = '0%';
        document.getElementById('extractorStatus').textContent = 'Initializing...';
        document.getElementById('extractorResult').style.display = 'none';
    }

    /**
     * Transition from progress view to result view
     */
    showResultState(type) {
        document.getElementById('extractorProgress').style.display = 'none';

        const result = document.getElementById('extractorResult');
        result.style.display = 'block';
        result.className = `extractor-result ${type}`;
    }

    // =============================================
    // Command Output Handling
    // =============================================

    handleCommandOutput(output) {
        const log = document.getElementById('extractorLog');
        const status = document.getElementById('extractorStatus');
        const bar = document.getElementById('extractorProgressBar');
        const percent = document.getElementById('progressPercent');

        if (!log) return;

        // Append to log
        const div = document.createElement('div');
        div.className = output.type === 'stderr' ? 'log-error' : 'log-info';
        div.textContent = output.data;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;

        // Clean ANSI escape codes before regex matching
        const cleanData = output.data.replace(/\x1B\[[0-9;]*[mK]/g, '');

        // Capture output file path (from one-shot search extraction)
        const fileMatch = cleanData.match(/SUCCESS!\s*->\s*(.*)/i) ||
            cleanData.match(/Saved to:\s*(.*(?:\.png|\.tif|\.tga|\.dds))$/i);
        if (fileMatch) {
            this.lastExtractedFile = fileMatch[1].trim();
        }

        // Capture output directory (from bulk extraction)
        const dirMatch = cleanData.match(/Output:\s*(.*)/i);
        if (dirMatch) {
            this.lastOutputDir = dirMatch[1].trim();
        }

        this.parseProgress(output.data, status, bar, percent);
    }

    /**
     * Parse progress indicators from output
     */
    parseProgress(data, status, bar, percent) {
        const progressMatch = data.match(/Processing:\s*(\d+)\/(\d+)/) || data.match(/(\d+)\/(\d+)/);
        if (progressMatch) {
            const current = parseInt(progressMatch[1]);
            const total = parseInt(progressMatch[2]);
            const p = Math.round((current / total) * 100);

            status.textContent = `Extracting ${current} of ${total}...`;
            bar.style.width = `${p}%`;
            percent.textContent = `${p}%`;
        } else if (data.includes('Starting extraction') || data.includes('Extracting:')) {
            status.textContent = 'Processing...';
        } else if (data.includes('Done!') || data.includes('SUCCESS!')) {
            status.textContent = 'Finalizing...';
            bar.style.width = '100%';
            percent.textContent = '100%';
        }
    }



    // =============================================
    // Core Actions
    // =============================================

    async handleRun() {
        const action = this.mode || 'Search';
        let searchTerm = '';
        let extension = '';

        if (action === 'Search') {
            searchTerm = document.getElementById('extractorSearchTerm').value.trim();
            if (!searchTerm) {
                this.shakeInput('extractorSearchTerm');
                return;
            }
        } else if (action === 'BulkExtension') {
            extension = document.getElementById('extractorFilterExtension').value.trim();
            if (!extension) {
                this.shakeInput('extractorFilterExtension');
                return;
            }
        }

        const outDir = document.getElementById('extractorOutputDir').value.trim();
        if (!outDir) {
            // Expand settings and focus output field
            this.shakeInput('extractorOutputDir');
            document.getElementById('extractorOutputDir').focus();
            return;
        }

        // Save configuration
        this.service.saveConfig({
            scanDir: document.getElementById('extractorScanDir').value.trim(),
            outputDir: document.getElementById('extractorOutputDir').value.trim(),
            toolsDir: document.getElementById('extractorToolsDir').value.trim()
        });

        // Switch to progress state
        this.showProgressState();
        this.pendingSelections = [];
        this.lastExtractedFile = null;

        try {
            const result = await this.service.executeExtraction(searchTerm, this.selectedFormat, action, extension);
            this.handleExtractionResult(result);
        } catch (err) {
            this.showResultState('error');
            document.getElementById('extractorResultMessage').innerHTML =
                `<strong>Error:</strong> ${err.message}`;
            document.getElementById('btnImportMap').style.display = 'none';
            this.removeOpenFolderButton();
        }
    }

    handleExtractionResult(result) {
        // Fallback: parse stdout for file path if missed during streaming
        if (!this.lastExtractedFile && result?.stdout) {
            const clean = result.stdout.replace(/\x1B\[[0-9;]*[mK]/g, '');
            const fileMatch = clean.match(/SUCCESS!\s*->\s*(.*)/i);
            if (fileMatch) this.lastExtractedFile = fileMatch[1].trim();
            
            const dirMatch = clean.match(/Output:\s*(.*)/i);
            if (dirMatch) this.lastOutputDir = dirMatch[1].trim();
        }

        const isManual = result.status === 'manual';
        this.showResultState(isManual ? 'manual' : 'success');

        const importBtn = document.getElementById('btnImportMap');

        if (isManual) {
            document.getElementById('extractorResultMessage').textContent = result.message;
            importBtn.style.display = 'none';
            this.removeOpenFolderButton();
        } else {
            document.getElementById('extractorResultMessage').innerHTML =
                '<strong>Success!</strong> Extraction completed.';

            // Allow importing. The IPC backend will detect if it's a directory and extract the core map image from inside it.
            if (this.lastExtractedFile) {
                importBtn.style.display = 'flex';
            } else {
                importBtn.style.display = 'none';
            }
            
            // Always allow opening the output folder if we have a path
            if (this.lastExtractedFile || this.lastOutputDir || this.service.config.outputDir) {
                this.createOpenFolderButton();
            } else {
                this.removeOpenFolderButton();
            }
        }

        this.refreshIcons(this.modal);
    }

    // =============================================
    // Helper Actions
    // =============================================

    createOpenFolderButton() {
        MapExtractorView.createOpenFolderButton(this);
    }

    removeOpenFolderButton() {
        MapExtractorView.removeOpenFolderButton();
    }

    /**
     * Subtle shake animation for validation feedback
     */
    shakeInput(inputId) {
        MapExtractorView.shakeInput(inputId);
    }

    async handleBrowse(type) {
        if (!window.electronAPI?.selectFolder) {
            this.app.notificationService?.showAlert('Folder browsing is only available in the Desktop version.', { title: 'Unsupported' });
            return;
        }

        try {
            const path = await window.electronAPI.selectFolder();
            if (path) {
                const fieldMap = {
                    scan: 'extractorScanDir',
                    output: 'extractorOutputDir',
                    tools: 'extractorToolsDir'
                };
                const field = document.getElementById(fieldMap[type]);
                if (field) field.value = path;
            }
        } catch (err) {
            console.error('Folder selection failed:', err);
        }
    }

    async handleImport() {
        if (!this.lastExtractedFile) return;

        const btn = document.getElementById('btnImportMap');
        if (!btn) return;

        const inferredName = this.lastExtractedFile
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, '')
            ?.replace(/[_-]+/g, ' ')
            ?.replace(/\b\w/g, (char) => char.toUpperCase()) || 'Imported Map';
        const desiredName = await (this.app.notificationService?.showPrompt('', {
            title: 'Import Map Name',
            defaultValue: inferredName,
            confirmLabel: 'Import'
        }) ?? Promise.resolve(null));
        if (!desiredName) return;

        const origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="lucide-refresh-cw" style="animation: spin 1s linear infinite; width:14px; height:14px;"></i> Importing...';
        
        try {
            if (window.electronAPI && window.electronAPI.importMapAsset) {
                const res = await window.electronAPI.importMapAsset(this.lastExtractedFile, desiredName);
                
                if (res.success) {
                    // Update the global local maps list for the side-drawer UI
                    if (window.LOCAL_MAPS) {
                        window.LOCAL_MAPS.push({ name: res.friendlyName, file: res.fileName });
                        if (this.app.mapBrowserUI?.renderLocalMapList) {
                            this.app.mapBrowserUI.renderLocalMapList(window.LOCAL_MAPS);
                        }
                    }
                    
                    // Tell the Canvas renderer to switch to the natively stored map
                    this.app.fileHandler.loadLocalMapImage(res.fileName, false);
                    
                    btn.innerHTML = '<i data-lucide="check"></i> Imported!';
                } else {
                    throw new Error(res.error);
                }
            } else {
                // Fallback for browsers or missing IPC bridge
                this.app.fileHandler.loadLocalMapImage(this.lastExtractedFile, true);
                btn.innerHTML = '<i data-lucide="check"></i> Displayed Temporarily';
            }
            
            this.hide(); // Close the modal upon success
        } catch (e) {
            console.error('Import failed', e);
            this.app.notificationService?.showToast(`Could not import: ${e.message}`, 'error');
            btn.innerHTML = origHtml;
        }

        this.refreshIcons(this.modal);
    }
}

window.MapExtractorUI = MapExtractorUI;
