const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeExtractor: (options) => ipcRenderer.invoke('execute-extractor', options),
    onCommandOutput: (callback) => ipcRenderer.on('command-output', (event, data) => callback(data)),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
    writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
    openPath: (path) => ipcRenderer.invoke('open-path', path),
    listMapAssets: () => ipcRenderer.invoke('list-map-assets'),
    getMapAssetUrl: (fileName) => ipcRenderer.invoke('get-map-asset-url', fileName),
    onWindowState: (callback) => ipcRenderer.on('window-state', (event, state) => callback(state)),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, data) => callback(data)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, data) => callback(data)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, data) => callback(data)),
    startUpdateDownload: () => ipcRenderer.invoke('start-update-download'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    importMapAsset: (sourcePath, friendlyName) => ipcRenderer.invoke('import-map-asset', sourcePath, friendlyName)
});
