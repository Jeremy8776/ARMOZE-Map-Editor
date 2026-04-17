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
        const html = `
            <div class="modal-overlay" id="extractorModal">
                <div class="modal extractor-modal">
                    <div class="modal-header">
                        <h2><i data-lucide="package-search"></i> Texture Extractor</h2>
                        <button class="modal-close" id="btnCloseExtractor">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-description">
                            Search and extract map textures directly from tactical game archives.
                        </p>

                        ${this.buildSearchSection()}
                        ${this.buildProgressSection()}
                        ${this.buildResultSection()}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.modal = document.getElementById('extractorModal');

        // Populate saved config values
        this.populateConfigFields();

        if (window.lucide) lucide.createIcons();
    }

    buildSearchSection() {
        return `
            <div class="extractor-form" id="extractorSearchSection">

                <div class="extractor-settings" id="extractorSettings" style="border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.15); padding-bottom: 12px; margin-bottom: 4px;">
                    <strong style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--color-accent);">Required Configuration</strong>
                    <div class="setting-row">
                        <label>Scan Directory (PAK files)</label>
                        <div class="input-group">
                            <input type="text" id="extractorScanDir"
                                   placeholder="e.g. C:\\Program Files\\Tactical Sandbox\\addons">
                            <button class="btn-icon-only" data-browse="scan" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Output Directory</label>
                        <div class="input-group">
                            <input type="text" id="extractorOutputDir"
                                   placeholder="e.g. C:\\Users\\Name\\Documents\\Exports">
                            <button class="btn-icon-only" data-browse="output" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Tools Directory</label>
                        <div class="input-group">
                            <input type="text" id="extractorToolsDir"
                                   placeholder="Path to project tools folder">
                            <button class="btn-icon-only" data-browse="tools" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="property-group" style="margin-bottom: 0;">
                    <label for="extractorAction">Operation Mode</label>
                    <select id="extractorAction" style="width:100%; padding: 8px; font-size: 13px; background: var(--color-bg-primary); border: 1px solid var(--color-border); color: var(--color-text-primary); border-radius: var(--radius-sm);">
                        <option value="Search" selected>Search & Extract File</option>
                        <option value="BulkAll">Bulk Extract: All Files</option>
                        <option value="BulkTextures">Bulk Extract: Textures (.edds) Only</option>
                        <option value="BulkExtension">Bulk Extract: By Extension</option>
                    </select>
                </div>

                <div id="searchModeFields" class="dynamic-mode-field">
                    <div class="property-group">
                        <label for="extractorSearch">Resource Name / Search Term</label>
                        <div class="search-input-wrapper">
                            <input type="text" id="extractorSearch"
                                   placeholder="e.g. ArlandRasterized, Everon_Satellite..."
                                   autocomplete="off" spellcheck="false">
                        </div>
                    </div>
                </div>

                <div id="extensionModeFields" class="dynamic-mode-field" style="display: none;">
                    <div class="property-group">
                        <label for="extractorExtension">File Extension to Filter</label>
                        <div class="search-input-wrapper">
                            <input type="text" id="extractorExtension"
                                   placeholder="e.g. .et, .emat, .smap"
                                   autocomplete="off" spellcheck="false">
                        </div>
                    </div>
                </div>

                <div class="extractor-format-row" id="formatRow">
                    <label for="extractorFormat">Texture Conversion Output (.edds)</label>
                    <select id="extractorFormat">
                        <option value="png" selected>PNG (Recommended)</option>
                        <option value="tif">TIF</option>
                        <option value="tga">TGA</option>
                        <option value="dds">DDS</option>
                        <option value="raw">Raw (Keep .edds)</option>
                    </select>
                </div>

                <button class="btn btn-primary" id="btnRunExtractor" style="width: 100%; margin-top: 8px;">
                    <i data-lucide="zap"></i> Extract Matches
                </button>

                <div class="extractor-idle-hint">
                    Shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>
                </div>
            </div>
        `;
    }

    buildProgressSection() {
        return `
            <div class="extractor-progress" id="extractorProgress" style="display: none;">
                <div class="progress-header">
                    <span id="progressStatus">Initializing...</span>
                    <span id="progressPercent">0%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="extractorProgressBar" style="width: 0%"></div>
                </div>
                <div class="progress-log" id="extractorLog"></div>



                <button class="btn btn-reset" id="btnBackFromProgress" style="margin-top: 12px;">
                    <i data-lucide="arrow-left"></i> Back
                </button>
            </div>
        `;
    }

    buildResultSection() {
        return `
            <div class="extractor-result" id="extractorResult" style="display: none;">
                <div class="result-message" id="resultMessage"></div>
                <div class="result-actions">
                    <button class="btn btn-primary" id="btnImportMap" style="display: none;">
                        <i data-lucide="download"></i> Import to Workspace
                    </button>
                </div>
                <button class="btn btn-reset" id="btnResetExtractor">
                    <i data-lucide="rotate-ccw"></i> New Search
                </button>
            </div>
        `;
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
        document.getElementById('btnRunExtractor').addEventListener('click', () => this.handleRun());
        document.getElementById('btnResetExtractor').addEventListener('click', () => this.resetUI());
        document.getElementById('btnBackFromProgress').addEventListener('click', () => this.resetUI());
        document.getElementById('btnCloseExtractor').addEventListener('click', () => this.hide());
        document.getElementById('btnImportMap').addEventListener('click', () => this.handleImport());

        // Enter key on search input triggers extraction
        document.getElementById('extractorSearch').addEventListener('keydown', (e) => {
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

        const searchFields = document.getElementById('searchModeFields');
        const extensionFields = document.getElementById('extensionModeFields');
        const formatRow = document.getElementById('formatRow');

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
        setTimeout(() => document.getElementById('extractorSearch')?.focus(), 150);
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

        const searchInput = document.getElementById('extractorSearch');
        if (searchInput) searchInput.value = '';

        const extInput = document.getElementById('extractorExtension');
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

        if (window.lucide) lucide.createIcons();
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
        document.getElementById('progressStatus').textContent = 'Initializing...';
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
        const status = document.getElementById('progressStatus');
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
            searchTerm = document.getElementById('extractorSearch').value.trim();
            if (!searchTerm) {
                this.shakeInput('extractorSearch');
                return;
            }
        } else if (action === 'BulkExtension') {
            extension = document.getElementById('extractorExtension').value.trim();
            if (!extension) {
                this.shakeInput('extractorExtension');
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
            document.getElementById('resultMessage').innerHTML =
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
            document.getElementById('resultMessage').textContent = result.message;
            importBtn.style.display = 'none';
            this.removeOpenFolderButton();
        } else {
            document.getElementById('resultMessage').innerHTML =
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

        if (window.lucide) lucide.createIcons();
    }

    // =============================================
    // Helper Actions
    // =============================================

    createOpenFolderButton() {
        this.removeOpenFolderButton();

        const actions = document.querySelector('.extractor-result .result-actions');
        if (!actions) return;

        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.id = 'btnOpenOutputFolder';
        btn.innerHTML = '<i data-lucide="folder-open"></i> Open Output Folder';

        btn.addEventListener('click', () => {
            if (window.electronAPI?.openPath) {
                let targetDir = this.lastOutputDir || this.service.config.outputDir;
                
                if (this.lastExtractedFile && !this.lastOutputDir) {
                    targetDir = this.lastExtractedFile.substring(
                        0, this.lastExtractedFile.lastIndexOf('\\')
                    );
                }
                
                if (targetDir) window.electronAPI.openPath(targetDir);
            }
        });

        actions.appendChild(btn);
        if (window.lucide) lucide.createIcons();
    }

    removeOpenFolderButton() {
        const existing = document.getElementById('btnOpenOutputFolder');
        if (existing) existing.remove();
    }

    /**
     * Subtle shake animation for validation feedback
     */
    shakeInput(inputId) {
        const el = document.getElementById(inputId);
        if (!el) return;

        el.style.borderColor = 'var(--color-danger)';
        el.style.animation = 'none';
        el.offsetHeight; // Force reflow
        el.style.animation = 'shakeInput 0.4s ease';
        el.focus();

        setTimeout(() => {
            el.style.borderColor = '';
            el.style.animation = '';
        }, 600);
    }

    async handleBrowse(type) {
        if (!window.electronAPI?.selectFolder) {
            alert('Folder browsing is only available in the Desktop version.');
            return;
        }

        try {
            const path = await window.electronAPI.selectFolder();
            if (path) this.updatePathField(type, path);
        } catch (err) {
            console.error('Folder selection failed:', err);
        }
    }

    getPathField(type) {
        const map = {
            scan: 'extractorScanDir',
            output: 'extractorOutputDir',
            tools: 'extractorToolsDir'
        };
        return document.getElementById(map[type]);
    }

    updatePathField(type, path) {
        const field = this.getPathField(type);
        if (field) field.value = path;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const tint = type === 'error' ? '255, 77, 87' : '0, 255, 136';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 22, 28, 0.96);
            border: 1px solid rgba(${tint}, 0.35);
            border-radius: 12px;
            padding: 10px 16px;
            color: rgba(255,255,255,0.9);
            font-size: 13px;
            font-family: var(--font-primary);
            z-index: 2000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2600);
    }

    requestMapName(defaultValue) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(4, 6, 10, 0.7);
                backdrop-filter: blur(6px);
                z-index: 1500;
            `;

            overlay.innerHTML = `
                <div class="inline-prompt" style="width:min(380px, calc(100vw - 32px));">
                    <p>Import Map Name</p>
                    <input type="text" class="compact-input">
                    <div class="inline-prompt-actions">
                        <button class="btn-chip cancel-btn">Cancel</button>
                        <button class="btn-chip primary confirm-btn">Import</button>
                    </div>
                </div>
            `;

            const close = (value = null) => {
                overlay.remove();
                resolve(value);
            };

            document.body.appendChild(overlay);

            const input = overlay.querySelector('input');
            input.value = defaultValue || '';
            input.focus();
            input.select();

            overlay.querySelector('.cancel-btn').addEventListener('click', () => close(null));
            overlay.querySelector('.confirm-btn').addEventListener('click', () => close(input.value.trim() || null));
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close(null);
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') close(input.value.trim() || null);
                if (event.key === 'Escape') close(null);
            });
        });
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
        const desiredName = await this.requestMapName(inferredName);
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
            this.showToast(`Could not import: ${e.message}`, 'error');
            btn.innerHTML = origHtml;
        }

        if (window.lucide) lucide.createIcons();
    }
}

window.MapExtractorUI = MapExtractorUI;
