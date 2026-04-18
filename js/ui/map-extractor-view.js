/**
 * Map Extractor View Helpers
 * Keeps modal markup and result-area chrome separate from command orchestration.
 */
class MapExtractorView {
    static buildModalMarkup() {
        return `
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
    }

    static buildSearchSection() {
        return `
            <div class="extractor-form" id="extractorSearchSection">
                <div class="extractor-settings" id="extractorSettings" style="border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.15); padding-bottom: 12px; margin-bottom: 4px;">
                    <strong style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--color-accent);">Required Configuration</strong>
                    <div class="setting-row">
                        <label>Scan Directory (PAK files)</label>
                        <div class="input-group">
                            <input type="text" id="extractorScanDir" placeholder="e.g. C:\\Program Files\\Tactical Sandbox\\addons">
                            <button class="btn-icon-only" data-browse="scan" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Output Directory</label>
                        <div class="input-group">
                            <input type="text" id="extractorOutputDir" placeholder="e.g. C:\\Users\\Name\\Documents\\Exports">
                            <button class="btn-icon-only" data-browse="output" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Tools Directory</label>
                        <div class="input-group">
                            <input type="text" id="extractorToolsDir" placeholder="Path to project tools folder">
                            <button class="btn-icon-only" data-browse="tools" title="Browse">
                                <i data-lucide="folder"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="property-group" style="margin-bottom: 0;">
                    <label for="extractorAction">Operation Mode</label>
                    <select id="extractorAction">
                        <option value="Search">Search by Resource Path</option>
                        <option value="BulkAll">Extract All Textures</option>
                        <option value="BulkTextures">Extract Texture Files</option>
                        <option value="BulkExtension">Extract by Extension</option>
                    </select>
                </div>

                <div class="property-group" id="searchTermGroup">
                    <label for="extractorSearchTerm">Resource Path / Search Term</label>
                    <input type="text" id="extractorSearchTerm" placeholder="e.g. world/maps/Arland/materials/m_co.png">
                </div>

                <div class="property-group" id="filterExtensionGroup" style="display:none;">
                    <label for="extractorFilterExtension">File Extension Filter</label>
                    <input type="text" id="extractorFilterExtension" placeholder="e.g. .edds or .png">
                </div>

                <div class="property-group">
                    <label for="extractorFormat">Output Format</label>
                    <select id="extractorFormat">
                        <option value="png">PNG</option>
                        <option value="tif">TIF</option>
                        <option value="tga">TGA</option>
                        <option value="dds">DDS</option>
                        <option value="raw">RAW</option>
                    </select>
                </div>

                <div class="extractor-actions">
                    <button class="btn btn-secondary" id="btnCancelExtractor">Cancel</button>
                    <button class="btn btn-primary" id="btnRunExtractor"><i data-lucide="zap"></i> Extract</button>
                </div>
            </div>
        `;
    }

    static buildProgressSection() {
        return `
            <div class="extractor-progress" id="extractorProgress" style="display:none;">
                <div class="progress-header">
                    <span id="extractorStatus">Preparing extraction...</span>
                    <span id="progressPercent">0%</span>
                </div>
                <div class="progress-bar-shell">
                    <div class="progress-bar-fill" id="extractorProgressBar"></div>
                </div>
                <div class="extractor-log" id="extractorLog"></div>
            </div>
        `;
    }

    static buildResultSection() {
        return `
            <div class="extractor-result" id="extractorResult" style="display:none;">
                <div class="result-icon" id="extractorResultIcon"></div>
                <div class="result-copy">
                    <h3 id="extractorResultTitle">Done</h3>
                    <p id="extractorResultMessage"></p>
                </div>
                <div class="result-actions">
                    <button class="btn btn-primary" id="btnImportMap" style="display:none;"><i data-lucide="download"></i> Import as Map</button>
                </div>
            </div>
        `;
    }

    static createOpenFolderButton(ui) {
        this.removeOpenFolderButton();

        const actions = document.querySelector('.extractor-result .result-actions');
        if (!actions) return;

        const button = document.createElement('button');
        button.className = 'btn btn-secondary';
        button.id = 'btnOpenOutputFolder';
        button.innerHTML = '<i data-lucide="folder-open"></i> Open Output Folder';

        button.addEventListener('click', () => {
            if (!window.electronAPI?.openPath) return;

            let targetDir = ui.lastOutputDir || ui.service.config.outputDir;
            if (ui.lastExtractedFile && !ui.lastOutputDir) {
                targetDir = ui.lastExtractedFile.substring(0, ui.lastExtractedFile.lastIndexOf('\\'));
            }

            if (targetDir) window.electronAPI.openPath(targetDir);
        });

        actions.appendChild(button);
        ui.refreshIcons(actions);
    }

    static removeOpenFolderButton() {
        const existing = document.getElementById('btnOpenOutputFolder');
        if (existing) existing.remove();
    }

    static shakeInput(inputId) {
        const element = document.getElementById(inputId);
        if (!element) return;

        element.style.borderColor = 'var(--color-danger)';
        element.style.animation = 'none';
        element.offsetHeight;
        element.style.animation = 'shakeInput 0.4s ease';
        element.focus();

        setTimeout(() => {
            element.style.borderColor = '';
            element.style.animation = '';
        }, 600);
    }
}

window.MapExtractorView = MapExtractorView;
