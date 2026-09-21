/**
 * Map Extractor Service
 * Interface for the Map Extractor Tool
 */
class MapExtractorService {
    constructor(app) {
        this.app = app;
        this.config = {
            scanDir: '',
            outputDir: '',
            toolsDir: '',
            gameDir: ''
        };
    }

    /**
     * Set default output directory based on environment
     */
    init() {
        // In a real browser we can't do much with local paths, 
        // but we can store them in localStorage for the user's convenience.
        const savedScan = localStorage.getItem('extractor_scanDir');
        if (savedScan) this.config.scanDir = savedScan;

        const savedOut = localStorage.getItem('extractor_outputDir');
        if (savedOut) this.config.outputDir = savedOut;

        const savedTools = localStorage.getItem('extractor_toolsDir');
        // Legacy relative values like 'tools' break the main-process
        // validation; the bundled tools dir is the default anyway.
        const isAbsolute = /^[A-Za-z]:[\\/]/.test(savedTools || '') || (savedTools || '').startsWith('\\\\');
        if (savedTools && isAbsolute) {
            this.config.toolsDir = savedTools;
        } else {
            this.config.toolsDir = '';
            localStorage.removeItem('extractor_toolsDir');
        }
    }

    saveConfig(config) {
        Object.assign(this.config, config);
        localStorage.setItem('extractor_scanDir', this.config.scanDir);
        localStorage.setItem('extractor_outputDir', this.config.outputDir);
        localStorage.setItem('extractor_toolsDir', this.config.toolsDir);
    }

    /**
     * Generate the PowerShell command for the user
     */
    generateCommand(searchTerm, format, action = "Search", filterExtension = "") {
        let absoluteToolsDir = this.config.toolsDir;

        // Qualify relative path for shell execution
        if (absoluteToolsDir === 'tools' && !absoluteToolsDir.includes(':')) {
            absoluteToolsDir = '.\\tools';
        }

        const scriptPath = `${absoluteToolsDir}\\ExtractTexture.ps1`;
        let cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;

        if (searchTerm) cmd += ` -ResourcePath "${searchTerm}"`;
        if (this.config.scanDir) cmd += ` -ScanDir "${this.config.scanDir}"`;
        if (this.config.outputDir) cmd += ` -OutputDir "${this.config.outputDir}"`;
        if (this.config.toolsDir) cmd += ` -ToolsDir "${absoluteToolsDir}"`;
        if (this.config.gameDir) cmd += ` -GameDir "${this.config.gameDir}"`;
        if (format) cmd += ` -Format "${format}"`;
        
        cmd += ` -Action "${action}"`;
        if (filterExtension) cmd += ` -FilterExtension "${filterExtension}"`;

        // Suppress folder-open in automated mode; Electron UI handles that
        cmd += ' -OpenFolder "0"';

        return cmd;
    }

    /**
     * In an Electron environment, this would actually run the command.
     * In a browser environment, we might offer to 'Copy to Clipboard'
     */
    /**
     * Translates extractor exit codes and raw PowerShell output into
     * plain-English messages so users know what to fix.
     */
    static explainExtractorError(rawMessage) {
        const raw = String(rawMessage || '');

        // Exit-code meanings (set by tools/ExtractTexture.ps1)
        const exitMatch = raw.match(/Exit code\s+(\d+)/i);
        const code = exitMatch ? parseInt(exitMatch[1], 10) : null;
        if (code === 2) {
            if (/no PAK entry matched/i.test(raw)) {
                return 'No file matching your search was found in any of the scanned PAK archives. Check the resource path is exact (e.g. "UI/Textures/Map/Worlds/MyMap/MyMap.edds") and the scan directory contains the right addon.';
            }
            return 'Nothing matched your request in the scanned archives. Check the search term or file extension filter.';
        }
        if (code === 3) {
            return 'Some files were extracted but could not be converted or saved. The output folder may be read-only, or a file was locked by another program.';
        }
        if (code === 4) {
            return 'The file was found but could not be converted to the selected format. Try a different output format (e.g. PNG).';
        }
        if (code === 0xfffd0000 || code === -196608 || /0xfffd0000/i.test(raw)) {
            return 'The extraction script could not be started. This is usually a missing tools folder — re-download the latest release.';
        }
        if (/Scan directory does not exist/i.test(raw)) {
            return 'The scan directory does not exist. Pick the folder that contains the addon PAK files.';
        }
        if (/Output directory must be an absolute path/i.test(raw)) {
            return 'The output directory must be a full path starting with a drive letter (e.g. C:\\Users\\you\\Downloads).';
        }
        if (/search term is required|A search term is required/i.test(raw)) {
            return 'Enter a resource path to search for before extracting.';
        }
        if (/filter extension is required/i.test(raw)) {
            return 'Enter a file extension to filter by (e.g. .edds).';
        }
        if (/Unsupported extractor action/i.test(raw)) {
            return 'That operation mode is not supported. Choose one from the dropdown.';
        }
        return null;
    }

    async executeExtraction(searchTerm, format, action = "Search", filterExtension = "") {
        console.log('Executing extraction for:', searchTerm, 'format:', format, 'action:', action);
        const command = this.generateCommand(searchTerm, format, action, filterExtension);

        if (window.electronAPI?.executeExtractor) {
            try {
                return await window.electronAPI.executeExtractor({
                    searchTerm,
                    format,
                    action,
                    filterExtension,
                    scanDir: this.config.scanDir,
                    outputDir: this.config.outputDir,
                    toolsDir: this.config.toolsDir,
                    gameDir: this.config.gameDir
                });
            } catch (err) {
                const friendly = MapExtractorService.explainExtractorError(err.message);
                throw new Error(friendly || ('Failed to run extraction: ' + err.message));
            }
        } else {
            // Provide the command to the user
            return {
                status: 'manual',
                command: command,
                message: 'Automatic extraction is only available in the Desktop version. Please run this command in your terminal:'
            };
        }
    }
}

window.MapExtractorService = MapExtractorService;
