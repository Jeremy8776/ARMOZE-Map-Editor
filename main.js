const { app, BrowserWindow, ipcMain, dialog, clipboard, shell, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

app.disableHardwareAcceleration();

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

// Store active process to allow input
let activeChild = null;

// IPC Handler for running commands
ipcMain.handle('run-command', async (event, command) => {
    return new Promise((resolve, reject) => {
        // Kill existing process if any (though UI prevents this usually)
        if (activeChild) {
            try { activeChild.kill(); } catch (e) { }
        }

        const child = spawn(command, {
            shell: true,
            windowsHide: true,
            env: { ...process.env, FORCE_COLOR: '1' } // Force color for nicer output parsing if supported
        });

        activeChild = child;
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
            activeChild = null;
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            activeChild = null;
            reject(err);
        });
    });
});

// IPC Handlers for window controls (fallback if native overlay fails)
ipcMain.handle('window-minimize', () => { BrowserWindow.getFocusedWindow()?.minimize(); });
ipcMain.handle('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize(); else win?.maximize();
});
ipcMain.handle('window-close', () => { BrowserWindow.getFocusedWindow()?.close(); });

// IPC Handler for sending input to the running command
ipcMain.handle('send-command-input', async (event, input) => {
    if (activeChild && activeChild.stdin) {
        activeChild.stdin.write(input + '\n');
        return true;
    }
    return false;
});

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
        const mapsDir = path.join(__dirname, 'Maps');
        const entries = await fs.readdir(mapsDir, { withFileTypes: true });
        const imageFiles = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => /\.(png|jpe?g|webp|tif|tiff|dds)$/i.test(name))
            .sort((a, b) => a.localeCompare(b));

        return imageFiles.map(fileName => ({
            file: fileName,
            name: path.basename(fileName, path.extname(fileName))
                .replace(/[_-]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
        }));
    } catch (err) {
        console.error('List Map Assets Error:', err);
        return [];
    }
});

// IPC Handler for importing a map asset
ipcMain.handle('import-map-asset', async (event, sourcePath, preferredName) => {
    try {
        const mapsDir = path.join(__dirname, 'Maps');
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
            
        const existingPattern = new RegExp(`\\{ name: "[^"]+", file: "${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" \\},?`, 'i');
        const newEntry = `    { name: "${friendlyName}", file: "${fileName}" },`;
        
        // Replace closing bracket with our new entry + closing bracket
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
const startAutoUpdateCheck = () => {
    const repo = 'Jeremy8776/Arma-Reforger-Map-Overlay-Zone-Editor';
    const currentVersion = require('./package.json').version;

    // Check GitHub API
    const request = net.request(`https://api.github.com/repos/${repo}/releases/latest`);

    request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => {
            body += chunk;
        });

        response.on('end', () => {
            try {
                if (response.statusCode === 200) {
                    const data = JSON.parse(body);
                    const latestVersion = data.tag_name.replace('v', '');

                    // Simple semantic version comparison
                    if (isNewerVersion(currentVersion, latestVersion)) {
                        BrowserWindow.getAllWindows()[0]?.webContents.send('update-available', {
                            version: latestVersion,
                            url: data.html_url,
                            notes: data.body
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
    await shell.openExternal(url);
});
