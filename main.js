const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const packageMetadata = require('./package.json');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1366,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        icon: path.join(__dirname, 'logo-icon.png'),
        autoHideMenuBar: true,
        backgroundColor: '#080a0d',
        title: 'ARMOZE',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-state', 'maximized');
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-state', 'restored');
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Optional: Open DevTools
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    app.setAppUserModelId('com.armoze.editor');
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Store active extractor process to stream output
let activeExtractorChild = null;

const EXTRACTOR_ACTIONS = new Set(['Search', 'BulkAll', 'BulkTextures', 'BulkExtension']);
const EXTRACTOR_FORMATS = new Set(['png', 'tif', 'tga', 'dds', 'raw']);

function getGitHubRepositoryPath() {
    const repository = packageMetadata.repository;
    const rawUrl = typeof repository === 'string' ? repository : repository?.url;
    if (!rawUrl) {
        throw new Error('Missing package repository metadata.');
    }

    const normalized = rawUrl
        .replace(/^git\+/, '')
        .replace(/\.git$/i, '');
    const match = normalized.match(/github\.com[:/](.+?)\/(.+)$/i);
    if (!match) {
        throw new Error('Repository metadata must point to GitHub.');
    }

    return `${match[1]}/${match[2]}`;
}

function isSafeGitHubReleaseUrl(url, repositoryPath) {
    if (typeof url !== 'string' || !url.trim()) {
        return false;
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
            return false;
        }

        return parsed.pathname.startsWith(`/${repositoryPath}/releases/`);
    } catch {
        return false;
    }
}

function getMapsDir() {
    return path.join(__dirname, 'Maps');
}

function getMapAssetFileUrl(fileName) {
    return pathToFileURL(path.join(getMapsDir(), fileName)).toString();
}

function normalizeOptionalString(value, maxLength = 4096) {
    if (typeof value !== 'string') {
        return '';
    }

    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
        throw new Error('Input is too long.');
    }

    return trimmed;
}

async function validateExtractorDirectory(candidatePath, label, { mustExist = true } = {}) {
    if (!candidatePath) {
        return;
    }

    if (!path.isAbsolute(candidatePath)) {
        throw new Error(`${label} must be an absolute path.`);
    }

    const normalized = path.normalize(candidatePath);
    if (normalized.includes('\0')) {
        throw new Error(`${label} contains invalid characters.`);
    }

    if (mustExist) {
        const stat = await fs.stat(normalized).catch(() => null);
        if (!stat?.isDirectory()) {
            throw new Error(`${label} does not exist.`);
        }
    }
}

function buildExtractorSpawnOptions(options = {}) {
    const action = normalizeOptionalString(options.action, 32) || 'Search';
    const format = normalizeOptionalString(options.format, 16) || 'png';
    const searchTerm = normalizeOptionalString(options.searchTerm, 512);
    const filterExtension = normalizeOptionalString(options.filterExtension, 32);
    const scanDir = normalizeOptionalString(options.scanDir);
    const outputDir = normalizeOptionalString(options.outputDir);
    const configuredToolsDir = normalizeOptionalString(options.toolsDir);
    const gameDir = normalizeOptionalString(options.gameDir);

    if (!EXTRACTOR_ACTIONS.has(action)) {
        throw new Error(`Unsupported extractor action: ${action}`);
    }

    if (!EXTRACTOR_FORMATS.has(format)) {
        throw new Error(`Unsupported extractor format: ${format}`);
    }

    if (action === 'Search' && !searchTerm) {
        throw new Error('A search term is required.');
    }

    if (action === 'BulkExtension' && !filterExtension) {
        throw new Error('A filter extension is required.');
    }

    const bundledToolsDir = path.join(__dirname, 'tools');
    const toolsDir = configuredToolsDir
        ? path.resolve(__dirname, configuredToolsDir)
        : bundledToolsDir;
    const scriptPath = path.join(bundledToolsDir, 'ExtractTexture.ps1');

    const args = [
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Action', action,
        '-Format', format,
        '-ToolsDir', toolsDir,
        '-OpenFolder', '0'
    ];

    if (searchTerm) {
        args.push('-ResourcePath', searchTerm);
    }
    if (scanDir) {
        args.push('-ScanDir', scanDir);
    }
    if (outputDir) {
        args.push('-OutputDir', outputDir);
    }
    if (gameDir) {
        args.push('-GameDir', gameDir);
    }
    if (filterExtension) {
        args.push('-FilterExtension', filterExtension);
    }

    return {
        command: 'powershell.exe',
        args
    };
}

// IPC handler for the bundled extractor workflow
ipcMain.handle('execute-extractor', async (event, options) => {
    return new Promise((resolve, reject) => {
        Promise.all([
            validateExtractorDirectory(options?.scanDir, 'Scan directory'),
            validateExtractorDirectory(options?.gameDir, 'Game directory'),
            validateExtractorDirectory(options?.toolsDir, 'Tools directory'),
            validateExtractorDirectory(options?.outputDir, 'Output directory', { mustExist: false })
        ]).then(() => {
        if (activeExtractorChild) {
            try { activeExtractorChild.kill(); } catch (e) { }
        }

        let spawnOptions;
        try {
            spawnOptions = buildExtractorSpawnOptions(options);
        } catch (err) {
            reject(err);
            return;
        }

        const child = spawn(spawnOptions.command, spawnOptions.args, {
            windowsHide: true,
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        activeExtractorChild = child;
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            event.sender.send('command-output', { type: 'stdout', data: str });
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            event.sender.send('command-output', { type: 'stderr', data: str });
        });

        child.on('close', (code) => {
            activeExtractorChild = null;
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            activeExtractorChild = null;
            reject(err);
        });
        }).catch(reject);
    });
});

// IPC Handlers for window controls (fallback if native overlay fails)
ipcMain.handle('window-minimize', () => { BrowserWindow.getFocusedWindow()?.minimize(); });
ipcMain.handle('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize(); else win?.maximize();
});
ipcMain.handle('window-close', () => { BrowserWindow.getFocusedWindow()?.close(); });

// IPC Handler for folder selection
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (result.canceled) {
        return null;
    } else {
        return result.filePaths[0];
    }
});

// IPC Handler for getting default downloads path
ipcMain.handle('get-downloads-path', () => {
    return app.getPath('downloads');
});

ipcMain.handle('write-clipboard', (event, text) => {
    clipboard.writeText(text);
    return true;
});

ipcMain.handle('open-path', async (event, pathStr) => {
    await shell.openPath(pathStr);
});

ipcMain.handle('list-map-assets', async () => {
    try {
        const mapsDir = getMapsDir();
        const entries = await fs.readdir(mapsDir, { withFileTypes: true });
        const imageFiles = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => /\.(png|jpe?g|webp|tif|tiff|dds)$/i.test(name))
            .sort((a, b) => a.localeCompare(b));

        return imageFiles.map(fileName => ({
            file: fileName,
            url: getMapAssetFileUrl(fileName),
            name: path.basename(fileName, path.extname(fileName))
                .replace(/[_-]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
        }));
    } catch (err) {
        console.error('List Map Assets Error:', err);
        return [];
    }
});

ipcMain.handle('get-map-asset-url', async (event, fileName) => {
    const normalizedFileName = normalizeOptionalString(fileName, 260);
    if (!normalizedFileName) {
        throw new Error('A map asset filename is required.');
    }

    const resolvedPath = path.resolve(getMapsDir(), normalizedFileName);
    const relativePath = path.relative(getMapsDir(), resolvedPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Invalid map asset path.');
    }

    const stat = await fs.stat(resolvedPath).catch(() => null);
    if (!stat?.isFile()) {
        throw new Error(`Map asset not found: ${normalizedFileName}`);
    }

    return getMapAssetFileUrl(relativePath);
});

// IPC Handler for importing a map asset
ipcMain.handle('import-map-asset', async (event, sourcePath, preferredName) => {
    try {
        const mapsDir = getMapsDir();
        let targetFile = sourcePath;
        
        // Smart parse: If the UI passed a directory (e.g. Map_2 folder), automatically locate the image inside
        if (!path.extname(sourcePath)) {
            const stat = await fs.stat(sourcePath);
            if (stat.isDirectory()) {
                const files = await fs.readdir(sourcePath);
                const img = files.find(f => f.match(/\.(png|jpe?g|tif|dds|webp)$/i));
                if (!img) throw new Error("No map texture found inside the extracted directory.");
                targetFile = path.join(sourcePath, img);
            }
        }

        const fileName = path.basename(targetFile);
        const destPath = path.join(mapsDir, fileName);
        
        // Copy the physical file
        await fs.copyFile(targetFile, destPath);
        
        // Update maps.js
        const mapsJsPath = path.join(mapsDir, 'maps.js');
        let content = await fs.readFile(mapsJsPath, 'utf-8');
        
        // Generate a friendly name (e.g. "my_map_tile.png" -> "My Map Tile")
        let friendlyName = path.basename(fileName, path.extname(fileName))
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        if (preferredName && preferredName.trim()) {
            friendlyName = preferredName.trim().replace(/\s+/g, ' ');
        }
            
        // JSON.stringify yields a safely-escaped JavaScript string literal, which
        // prevents user-supplied names or filenames from breaking the maps.js
        // array (e.g. a quote or backslash in a filename could previously produce
        // invalid JS and brick the app on next load).
        const nameLiteral = JSON.stringify(friendlyName);
        const fileLiteral = JSON.stringify(fileName);
        const existingPattern = new RegExp(`\\{\\s*name:\\s*"[^"]*",\\s*file:\\s*"${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*\\},?`, 'i');
        const newEntry = `    { name: ${nameLiteral}, file: ${fileLiteral} },`;

        if (existingPattern.test(content)) {
            content = content.replace(existingPattern, newEntry.trim());
        } else if (content.includes('];')) {
            content = content.replace(/];/, `${newEntry}\n];`);
        }
        
        await fs.writeFile(mapsJsPath, content);
        
        return { success: true, friendlyName, fileName };
    } catch (err) {
        console.error('Import Error:', err);
        return { success: false, error: err.message };
    }
});

// Auto-Update Checker
//
// Two-tier strategy:
//   1. electron-updater handles in-app download + install when a release with
//      proper electron-builder artifacts (latest.yml + signed installer) is
//      available on GitHub.
//   2. Falls back to a manual GitHub Releases API check that surfaces a banner
//      with a link to the release page, for cases where electron-updater can't
//      find its metadata (e.g. older releases predating the build pipeline, or
//      when running on a platform without a published artifact).
let autoUpdater = null;
try {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
} catch (err) {
    console.warn('electron-updater not installed; falling back to manual update check.', err.message);
}

const sendToRenderer = (channel, payload) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload);
};

const startManualGitHubCheck = () => {
    const repositoryPath = getGitHubRepositoryPath();
    const currentVersion = packageMetadata.version;
    const request = net.request(`https://api.github.com/repos/${repositoryPath}/releases/latest`);

    request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
            try {
                if (response.statusCode === 200) {
                    const data = JSON.parse(body);
                    const latestVersion = data.tag_name.replace('v', '');
                    if (isNewerVersion(currentVersion, latestVersion) && isSafeGitHubReleaseUrl(data.html_url, repositoryPath)) {
                        sendToRenderer('update-available', {
                            version: latestVersion,
                            url: data.html_url,
                            notes: data.body,
                            canAutoInstall: false
                        });
                    }
                }
            } catch (err) {
                console.error('Update check failed parse:', err);
            }
        });
    });

    request.on('error', (err) => {
        console.error('Update check error:', err);
    });

    request.end();
};

const startAutoUpdateCheck = () => {
    if (!autoUpdater) {
        startManualGitHubCheck();
        return;
    }

    let fellBack = false;
    const fallback = (reason) => {
        if (fellBack) return;
        fellBack = true;
        console.warn('electron-updater fallback:', reason);
        startManualGitHubCheck();
    };

    autoUpdater.on('update-available', (info) => {
        const repositoryPath = getGitHubRepositoryPath();
        sendToRenderer('update-available', {
            version: info.version,
            url: `https://github.com/${repositoryPath}/releases/tag/v${info.version}`,
            notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
            canAutoInstall: true
        });
    });

    autoUpdater.on('update-not-available', () => {
        // Up to date; nothing to do.
    });

    autoUpdater.on('download-progress', (progress) => {
        sendToRenderer('update-progress', {
            percent: Math.round(progress.percent || 0),
            bytesPerSecond: progress.bytesPerSecond,
            transferred: progress.transferred,
            total: progress.total
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        sendToRenderer('update-downloaded', {
            version: info.version
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('autoUpdater error:', err);
        // If we never even saw "update-available", there's no banner up yet —
        // try the manual check so the user still sees a notification when a
        // GitHub release exists but lacks electron-updater metadata.
        sendToRenderer('update-error', {
            message: err?.message || 'Update failed'
        });
        fallback(err?.message || 'autoUpdater error');
    });

    try {
        autoUpdater.checkForUpdates().catch((err) => fallback(err?.message || 'checkForUpdates rejected'));
    } catch (err) {
        fallback(err?.message || 'checkForUpdates threw');
    }
};

function isNewerVersion(current, latest) {
    const sCurrent = current.split('.').map(Number);
    const sLatest = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(sCurrent.length, sLatest.length); i++) {
        const v1 = sCurrent[i] || 0;
        const v2 = sLatest[i] || 0;
        if (v2 > v1) return true;
        if (v2 < v1) return false;
    }
    return false;
}

// Check for updates shortly after startup in packaged builds only.
app.whenReady().then(() => {
    if (!app.isPackaged) {
        return;
    }

    setTimeout(startAutoUpdateCheck, 3000);
});

// IPC to open external links (for the update button)
ipcMain.handle('open-external', async (event, url) => {
    if (!isSafeGitHubReleaseUrl(url, getGitHubRepositoryPath())) {
        throw new Error('Blocked unsafe external URL.');
    }
    await shell.openExternal(url);
});

// IPC: kick off in-app download via electron-updater (called from "Download" button)
ipcMain.handle('start-update-download', async () => {
    if (!autoUpdater) throw new Error('Auto-updater unavailable in this build.');
    return autoUpdater.downloadUpdate();
});

// IPC: install the downloaded update and relaunch.
ipcMain.handle('quit-and-install', () => {
    if (!autoUpdater) throw new Error('Auto-updater unavailable in this build.');
    // Force restart, force run after install. Only invoked once "update-downloaded" has fired.
    autoUpdater.quitAndInstall(false, true);
});
