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
            toolsDir: 'tools',
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
        if (savedTools) this.config.toolsDir = savedTools;
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
                throw new Error('Failed to run extraction: ' + err.message);
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
