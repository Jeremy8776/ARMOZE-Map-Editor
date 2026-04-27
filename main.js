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
    // Bundled Maps shipped inside the install dir (catalog.json + any
    // legacy bundled assets — none for v1.6.2 onward).
    return path.join(__dirname, 'Maps');
}

function getUserMapsDir() {
    // Where catalog-installed maps live. Survives app updates and
    // sits in the user's APPDATA so we don't need write access to
    // Program Files.
    return path.join(app.getPath('userData'), 'Maps');
}

async function ensureUserMapsDir() {
    const dir = getUserMapsDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

function resolveMapAssetPath(fileName) {
    // Prefer the user-installed copy, fall back to the bundled copy.
    // Returns { absPath, source } | null.
    const userPath = path.join(getUserMapsDir(), fileName);
    const bundledPath = path.join(getMapsDir(), fileName);
    return { userPath, bundledPath };
}

function getMapAssetFileUrl(fileName) {
    return pathToFileURL(path.join(getMapsDir(), fileName)).toString();
}

function getCatalogPath() {
    return path.join(getMapsDir(), 'catalog.json');
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

async function readMapsFromDir(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => /\.(png|jpe?g|webp|tif|tiff|dds)$/i.test(name));
    } catch {
        return [];
    }
}

ipcMain.handle('list-map-assets', async () => {
    try {
        await ensureUserMapsDir();
        const [bundled, userInstalled] = await Promise.all([
            readMapsFromDir(getMapsDir()),
            readMapsFromDir(getUserMapsDir())
        ]);

        // Union, prefer userInstalled (catalog downloads override any bundled
        // copy of the same filename, so re-downloading replaces cleanly).
        const seen = new Set();
        const ordered = [];
        for (const name of userInstalled) { seen.add(name); ordered.push({ name, source: 'user' }); }
        for (const name of bundled) { if (!seen.has(name)) ordered.push({ name, source: 'bundled' }); }
        ordered.sort((a, b) => a.name.localeCompare(b.name));

        return ordered.map(({ name, source }) => ({
            file: name,
            source,
            url: pathToFileURL(path.join(source === 'user' ? getUserMapsDir() : getMapsDir(), name)).toString(),
            name: path.basename(name, path.extname(name))
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

    // Look in user-installed first, then bundled. Reject any path traversal.
    const { userPath, bundledPath } = resolveMapAssetPath(normalizedFileName);
    for (const candidate of [userPath, bundledPath]) {
        const baseDir = candidate === userPath ? getUserMapsDir() : getMapsDir();
        const resolvedPath = path.resolve(baseDir, normalizedFileName);
        const relativePath = path.relative(baseDir, resolvedPath);
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            continue;
        }
        const stat = await fs.stat(resolvedPath).catch(() => null);
        if (stat?.isFile()) {
            return pathToFileURL(resolvedPath).toString();
        }
    }
    throw new Error(`Map asset not found: ${normalizedFileName}`);
});

ipcMain.handle('get-map-catalog', async () => {
    try {
        const text = await fs.readFile(getCatalogPath(), 'utf8');
        return JSON.parse(text);
    } catch (err) {
        console.error('Catalog read failed:', err);
        return { schemaVersion: 1, maps: [] };
    }
});

ipcMain.handle('list-installed-catalog-maps', async () => {
    await ensureUserMapsDir();
    const userInstalled = await readMapsFromDir(getUserMapsDir());
    return userInstalled;
});

ipcMain.handle('delete-catalog-map', async (event, fileName) => {
    const normalizedFileName = normalizeOptionalString(fileName, 260);
    if (!normalizedFileName) throw new Error('Filename required.');
    const baseDir = getUserMapsDir();
    const resolvedPath = path.resolve(baseDir, normalizedFileName);
    const relativePath = path.relative(baseDir, resolvedPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Invalid map asset path.');
    }
    await fs.unlink(resolvedPath).catch((err) => {
        if (err?.code !== 'ENOENT') throw err;
    });
    return true;
});

// Streams a map download from the catalog-host URL into the user's
// Maps dir, emitting progress events to the renderer for the calling
// map id. Validates the URL belongs to our maps-library release host.
ipcMain.handle('download-catalog-map', async (event, payload) => {
    const id = normalizeOptionalString(payload?.id, 64);
    const file = normalizeOptionalString(payload?.file, 260);
    const url = normalizeOptionalString(payload?.url, 2048);
    const expectedSize = Number(payload?.sizeBytes) || 0;

    if (!id || !file || !url) throw new Error('id, file and url required.');

    // URL allow-list: only download from our maps-library asset host on github.com.
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Invalid URL.'); }
    const repositoryPath = getGitHubRepositoryPath();
    const allowedPrefix = `/${repositoryPath}/releases/download/maps-library-`;
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith(allowedPrefix)) {
        throw new Error('Blocked: catalog download URL must point to the maps-library release on this repo.');
    }

    await ensureUserMapsDir();
    const destPath = path.join(getUserMapsDir(), file);
    const tmpPath = `${destPath}.part`;

    const sender = event.sender;
    const sendProgress = (data) => sender.send('catalog-download-progress', { id, ...data });

    const request = net.request({ url, redirect: 'follow' });
    return new Promise((resolve, reject) => {
        request.on('response', async (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                return;
            }
            const total = Number(response.headers['content-length']) || expectedSize || 0;
            let received = 0;
            try {
                const fileHandle = await fs.open(tmpPath, 'w');
                response.on('data', (chunk) => {
                    received += chunk.length;
                    fileHandle.write(chunk).catch(() => {});
                    if (total > 0) {
                        sendProgress({ percent: Math.round((received / total) * 100), received, total });
                    } else {
                        sendProgress({ percent: 0, received, total: 0 });
                    }
                });
                response.on('end', async () => {
                    try {
                        await fileHandle.close();
                        await fs.rename(tmpPath, destPath);
                        sendProgress({ percent: 100, received, total: total || received, done: true });
                        resolve({ id, file, sizeBytes: received });
                    } catch (err) {
                        reject(err);
                    }
                });
                response.on('error', async (err) => {
                    await fileHandle.close().catch(() => {});
                    await fs.unlink(tmpPath).catch(() => {});
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });
        request.on('error', (err) => reject(err));
        request.end();
    });
});

// Legacy handler signature (kept for safety)
ipcMain.handle('open-user-maps-folder', async () => {
    const dir = await ensureUserMapsDir();
    await shell.openPath(dir);
    return dir;
});

// IPC Handler for importing a map asset (from extractor / file picker).
// Writes into the user-data Maps directory so it survives app updates
// and doesn't require write access to Program Files.
ipcMain.handle('import-map-asset', async (event, sourcePath, preferredName) => {
    try {
        const mapsDir = await ensureUserMapsDir();
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

        // Copy the physical file. The map list (renderer-side) is now
        // built by scanning the user-data Maps directory at runtime —
        // no maps.js manifest to update.
        await fs.copyFile(targetFile, destPath);

        // Generate a friendly name (e.g. "my_map_tile.png" -> "My Map Tile")
        let friendlyName = path.basename(fileName, path.extname(fileName))
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        if (preferredName && preferredName.trim()) {
            friendlyName = preferredName.trim().replace(/\s+/g, ' ');
        }

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
    // Verbose log to help diagnose update issues — written to the user's
    // logs dir (Windows: %APPDATA%/ARMOZE/logs/main.log) and to stdout.
    autoUpdater.logger = console;
    // Allow installing over an unsigned Windows build (matches our current
    // release pipeline — code signing is on the roadmap). Without this,
    // squirrel rejects the package on signature mismatch.
    autoUpdater.disableWebInstaller = false;
    autoUpdater.allowDowngrade = false;
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

// Track per-check fallback state so listeners can dispatch without stacking.
let currentCheckFellBack = false;
let updateListenersWired = false;

const wireAutoUpdaterListeners = () => {
    if (!autoUpdater || updateListenersWired) return;
    updateListenersWired = true;

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
        sendToRenderer('update-error', {
            message: err?.message || 'Update failed'
        });
        // Fallback once per check cycle so we don't spam the manual check.
        if (!currentCheckFellBack) {
            currentCheckFellBack = true;
            startManualGitHubCheck();
        }
    });
};

const startAutoUpdateCheck = () => {
    if (!autoUpdater) {
        startManualGitHubCheck();
        return;
    }

    wireAutoUpdaterListeners();
    currentCheckFellBack = false;

    const fallback = (reason) => {
        if (currentCheckFellBack) return;
        currentCheckFellBack = true;
        console.warn('electron-updater fallback:', reason);
        startManualGitHubCheck();
    };

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

// Check for updates shortly after startup, then on a recurring interval
// while the app is running. The renderer banner de-dupes so re-firing
// for the same already-known version is a no-op.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
app.whenReady().then(() => {
    if (!app.isPackaged) {
        return;
    }

    setTimeout(startAutoUpdateCheck, 3000);
    setInterval(startAutoUpdateCheck, UPDATE_CHECK_INTERVAL_MS);
});

// IPC: manual "Check for updates" trigger from the renderer.
ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
        return { skipped: true, reason: 'dev build' };
    }
    startAutoUpdateCheck();
    return { ok: true };
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
