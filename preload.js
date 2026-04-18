const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    executeExtractor: (options) => ipcRenderer.invoke('execute-extractor', options),
    onCommandOutput: (callback) => ipcRenderer.on('command-output', (event, data) => callback(data)),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
    writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
    openPath: (path) => ipcRenderer.invoke('open-path', path),
    listMapAssets: () => ipcRenderer.invoke('list-map-assets'),
    onWindowState: (callback) => ipcRenderer.on('window-state', (event, state) => callback(state)),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    importMapAsset: (sourcePath, friendlyName) => ipcRenderer.invoke('import-map-asset', sourcePath, friendlyName)
});
